import {describe, expect, it, vi} from 'vitest';
import type {IApiClient} from '../client';
import {createAccountApi, createNurseApi, createWardApi} from '../index';

const createClient = (): IApiClient => ({
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
});

describe('@dutying/api public entry', () => {
    it('exposes the package factories from the root export', () => {
        expect(createAccountApi).toBeTypeOf('function');
        expect(createNurseApi).toBeTypeOf('function');
        expect(createWardApi).toBeTypeOf('function');
    });

    it('keeps account and ward factories callable through the package root', async () => {
        const client = createClient();
        const getMock = client.get as ReturnType<typeof vi.fn>;
        const postMock = client.post as ReturnType<typeof vi.fn>;

        getMock.mockResolvedValueOnce({data: {accountId: 12}});
        postMock.mockResolvedValueOnce({data: undefined});

        const accountApi = createAccountApi(client);
        const wardApi = createWardApi(client);

        await expect(accountApi.getAccountMe()).resolves.toEqual({accountId: 12});
        await expect(wardApi.postShift(7, 3, 2026, 3)).resolves.toBeUndefined();

        expect(getMock).toHaveBeenCalledWith('/accounts/me');
        expect(postMock).toHaveBeenCalledWith('/wards/7/shift-teams/3/post?year=2026&month=03');
    });

    it('posts onboarding ward creation payload to /wards once', async () => {
        const client = createClient();
        const postMock = client.post as ReturnType<typeof vi.fn>;

        postMock.mockResolvedValueOnce({
            data: {
                wardId: 10,
                name: 'ICU',
                hospitalName: 'Dutying Hospital',
                code: 'A7K29Q',
                nurseCnt: 1,
                wardShiftTypes: [],
                shiftTeams: [{shiftTeamId: 1, name: 'Team 1', nurseCnt: 1, nurses: []}],
            },
        });

        const wardApi = createWardApi(client);
        const payload = {
            name: 'ICU',
            hospitalName: 'Dutying Hospital',
            wardShiftTypes: [
                {
                    name: 'Day',
                    shortName: 'D',
                    startTime: '07:00',
                    endTime: '15:00',
                    color: '#4DC2AD',
                    isOff: false,
                    isDefault: true,
                    isCounted: true,
                    classification: 'DAY' as const,
                },
                {
                    name: 'Off',
                    shortName: 'O',
                    startTime: '',
                    endTime: '',
                    color: '#465B7A',
                    isOff: true,
                    isDefault: true,
                    isCounted: false,
                    classification: 'OFF' as const,
                },
            ],
            shiftTeams: [
                {
                    name: 'Team 1',
                    nurseNames: ['Kim Nurse'],
                    nurses: [{name: 'Kim Nurse', memo: 'preceptor'}],
                },
            ],
        };

        await expect(wardApi.createWard(payload)).resolves.toMatchObject({wardId: 10});

        expect(postMock).toHaveBeenCalledTimes(1);
        expect(postMock).toHaveBeenCalledWith('/wards', {
            name: 'ICU',
            hospitalName: 'Dutying Hospital',
            wardShiftTypes: [
                payload.wardShiftTypes[0],
                {
                    ...payload.wardShiftTypes[1],
                    startTime: null,
                    endTime: null,
                },
            ],
            shiftTeams: [
                {
                    name: 'Team 1',
                    nurseNames: ['Kim Nurse'],
                    nurses: [{name: 'Kim Nurse', memo: 'preceptor'}],
                },
            ],
        });
    });

    it('posts onboarding draft and completion to split onboarding endpoints', async () => {
        const client = createClient();
        const postMock = client.post as ReturnType<typeof vi.fn>;
        const patchMock = client.patch as ReturnType<typeof vi.fn>;
        const wardApi = createWardApi(client);

        postMock
            .mockResolvedValueOnce({
                data: {
                    wardId: 10,
                    name: 'ICU',
                    hospitalName: 'Dutying Hospital',
                    code: 'A7K29Q',
                    nurseCnt: 0,
                    setupStatus: 'SETUP_IN_PROGRESS',
                    wardShiftTypes: [],
                    shiftTeams: [],
                },
            })
            .mockResolvedValueOnce({
                data: {
                    wardId: 10,
                    name: 'ICU',
                    hospitalName: 'Dutying Hospital',
                    code: 'A7K29Q',
                    nurseCnt: 1,
                    setupStatus: 'ACTIVE',
                    wardShiftTypes: [],
                    shiftTeams: [],
                },
            });
        patchMock.mockResolvedValueOnce({
            data: {
                ward: {
                    wardId: 10,
                    name: 'ICU',
                    hospitalName: 'Dutying Hospital',
                    code: 'A7K29Q',
                    nurseCnt: 0,
                    setupStatus: 'SETUP_IN_PROGRESS',
                    wardShiftTypes: [],
                    shiftTeams: [],
                },
                draftPayload: {draft: {currentStep: 2}},
            },
        });

        await expect(wardApi.createOnboardingWardDraft({name: 'ICU', hospitalName: 'Dutying Hospital'})).resolves.toMatchObject({
            wardId: 10,
            setupStatus: 'SETUP_IN_PROGRESS',
        });

        await expect(
            wardApi.updateOnboardingWardDraft(10, {
                name: 'ICU',
                hospitalName: 'Dutying Hospital',
                draftPayload: {draft: {currentStep: 2}},
            }),
        ).resolves.toMatchObject({
            ward: {
                wardId: 10,
                setupStatus: 'SETUP_IN_PROGRESS',
            },
            draftPayload: {draft: {currentStep: 2}},
        });

        await expect(
            wardApi.completeOnboardingWardDraft(10, {
                name: 'ICU',
                hospitalName: 'Dutying Hospital',
                wardShiftTypes: [],
                shiftTeams: [
                    {
                        name: 'Team 1',
                        nurseNames: ['Kim Nurse'],
                        nurses: [{name: 'Kim Nurse', initialShifts: [{date: '2026-05-01', shiftShortName: 'D'}]}],
                        constraintRules: [
                            {
                                templateCode: 'MIN_STAFF_BY_SHIFT',
                                severity: 'HARD',
                                selected: true,
                                params: {staffing: [{shift: 'D', count: 2}]},
                            },
                        ],
                    },
                ],
            }),
        ).resolves.toMatchObject({
            wardId: 10,
            setupStatus: 'ACTIVE',
        });

        expect(postMock).toHaveBeenNthCalledWith(1, '/wards/onboarding/drafts', {
            name: 'ICU',
            hospitalName: 'Dutying Hospital',
        });
        expect(patchMock).toHaveBeenCalledWith('/wards/10/onboarding/draft', {
            name: 'ICU',
            hospitalName: 'Dutying Hospital',
            draftPayload: {draft: {currentStep: 2}},
        });
        expect(postMock).toHaveBeenNthCalledWith(2, '/wards/10/onboarding/complete', {
            name: 'ICU',
            hospitalName: 'Dutying Hospital',
            wardShiftTypes: [],
            shiftTeams: [
                {
                    name: 'Team 1',
                    nurseNames: ['Kim Nurse'],
                    nurses: [{name: 'Kim Nurse', initialShifts: [{date: '2026-05-01', shiftShortName: 'D'}]}],
                    constraintRules: [
                        {
                            templateCode: 'MIN_STAFF_BY_SHIFT',
                            severity: 'HARD',
                            selected: true,
                            params: {staffing: [{shift: 'D', count: 2}]},
                        },
                    ],
                },
            ],
        });
    });

    it('posts onboarding manual schedule input preview to the ward onboarding endpoint', async () => {
        const client = createClient();
        const postMock = client.post as ReturnType<typeof vi.fn>;
        const wardApi = createWardApi(client);
        const request = {
            targetYear: 2026,
            targetMonth: 5,
            nurseNameBlock: '간호사A\n간호사B',
            dutyBlock: 'D\t/\n-\tN',
        };

        postMock.mockResolvedValueOnce({
            data: {
                targetYear: 2026,
                targetMonth: 5,
                nurses: [
                    {name: '간호사A', displayOrder: 1, initialShifts: [{date: '2026-05-01', shiftShortName: 'D'}]},
                    {name: '간호사B', displayOrder: 2, initialShifts: [{date: '2026-05-01', shiftShortName: 'O'}]},
                ],
                wardShiftTypes: [{name: 'R', shortName: 'R', color: '#94A3B8', isOff: false, isDefault: false}],
                warnings: [],
                unresolvedCodes: [],
            },
        });

        await expect(wardApi.previewOnboardingScheduleInput(request)).resolves.toMatchObject({
            targetYear: 2026,
            targetMonth: 5,
            nurses: [{name: '간호사A'}, {name: '간호사B'}],
            wardShiftTypes: [{shortName: 'R', color: '#94A3B8'}],
        });

        expect(postMock).toHaveBeenCalledWith('/wards/onboarding/schedule-input/preview', request);
    });

    it('builds the account deletion endpoint', async () => {
        const client = createClient();
        const deleteMock = client.delete as ReturnType<typeof vi.fn>;

        deleteMock.mockResolvedValueOnce({data: undefined});

        const accountApi = createAccountApi(client);

        await expect(accountApi.deleteAccount(7)).resolves.toBeUndefined();

        expect(deleteMock).toHaveBeenCalledWith('/accounts/7');
    });

    it('builds the schedule snapshot deletion endpoint', async () => {
        const client = createClient();
        const deleteMock = client.delete as ReturnType<typeof vi.fn>;

        deleteMock.mockResolvedValueOnce({data: undefined});

        const wardApi = createWardApi(client);

        await expect(wardApi.deleteSnapshot(7, 3, 99)).resolves.toBeUndefined();

        expect(deleteMock).toHaveBeenCalledWith('/wards/7/shift-teams/3/schedule/snapshots/99');
    });

    it('builds the tutorial seen endpoint', async () => {
        const client = createClient();
        const postMock = client.post as ReturnType<typeof vi.fn>;

        postMock.mockResolvedValueOnce({data: undefined});

        const accountApi = createAccountApi(client);

        await expect(accountApi.markTutorialSeen('make-step-1')).resolves.toBeUndefined();

        expect(postMock).toHaveBeenCalledWith('/accounts/me/tutorials/make-step-1/seen');
    });

    it('builds the waiting nurse request deletion endpoint', async () => {
        const client = createClient();
        const deleteMock = client.delete as ReturnType<typeof vi.fn>;

        deleteMock.mockResolvedValueOnce({data: undefined});

        const wardApi = createWardApi(client);

        await expect(wardApi.deleteWaitingNurseRequest(7, 42)).resolves.toBeUndefined();

        expect(deleteMock).toHaveBeenCalledWith('/wards/7/waiting-nurses/42/v1');
    });

    it('builds ward chat endpoints', async () => {
        const client = createClient();
        const getMock = client.get as ReturnType<typeof vi.fn>;
        const postMock = client.post as ReturnType<typeof vi.fn>;
        const putMock = client.put as ReturnType<typeof vi.fn>;

        getMock.mockResolvedValueOnce({
            data: {
                messages: [],
                nextCursorMessageId: 11,
                lastReadMessageId: 10,
                unreadCount: 1,
            },
        });
        postMock.mockResolvedValueOnce({data: {messageId: 12}});
        putMock.mockResolvedValueOnce({data: undefined});
        getMock.mockResolvedValueOnce({data: {moimId: 2, wardId: 7, unreadCount: 1}});
        getMock.mockResolvedValueOnce({data: [{moimId: 2, wardId: 7, unreadCount: 1}]});

        const wardApi = createWardApi(client);

        await expect(wardApi.getWardChatMessages(7, {cursorMessageId: 10, size: 30})).resolves.toMatchObject({
            nextCursorMessageId: 11,
        });
        await expect(wardApi.createWardChatMessage(7, {text: 'hello', clientMessageId: 'client-1'})).resolves.toEqual({messageId: 12});
        await expect(wardApi.readWardChat(7, {lastReadMessageId: 12})).resolves.toBeUndefined();
        await expect(wardApi.getWardChatUnreadCount(7)).resolves.toEqual({moimId: 2, wardId: 7, unreadCount: 1});
        await expect(wardApi.getMyWardChatUnreadCounts()).resolves.toEqual([{moimId: 2, wardId: 7, unreadCount: 1}]);

        expect(getMock).toHaveBeenNthCalledWith(1, '/wards/7/chat/messages?cursorMessageId=10&size=30');
        expect(postMock).toHaveBeenCalledWith('/wards/7/chat/messages', {text: 'hello', clientMessageId: 'client-1'});
        expect(putMock).toHaveBeenCalledWith('/wards/7/chat/read', {lastReadMessageId: 12});
        expect(getMock).toHaveBeenNthCalledWith(2, '/wards/7/chat/unread-count');
        expect(getMock).toHaveBeenNthCalledWith(3, '/wards/chat/unread-counts');
    });

    it('builds ward admin email registration endpoints', async () => {
        const client = createClient();
        const getMock = client.get as ReturnType<typeof vi.fn>;
        const postMock = client.post as ReturnType<typeof vi.fn>;
        const deleteMock = client.delete as ReturnType<typeof vi.fn>;

        getMock.mockResolvedValueOnce({
            data: {
                members: [],
                reservedEmails: [],
                invitations: [],
            },
        });
        postMock.mockResolvedValueOnce({
            data: {
                wardId: 7,
                email: 'editor@example.com',
                role: 'EDITOR',
                status: 'RESERVED',
                emailRegistrationId: 301,
            },
        });
        deleteMock.mockResolvedValue({data: undefined});

        const wardApi = createWardApi(client);

        await expect(wardApi.getWardAdmins(7)).resolves.toMatchObject({reservedEmails: []});
        await expect(wardApi.createWardAdminEmail(7, {email: 'editor@example.com', role: 'EDITOR'})).resolves.toMatchObject({
            status: 'RESERVED',
        });
        await expect(wardApi.removeWardAdmin(7, 201)).resolves.toBeUndefined();
        await expect(wardApi.removeWardAdminEmail(7, 301)).resolves.toBeUndefined();

        expect(getMock).toHaveBeenCalledWith('/admin/wards/7/admins');
        expect(postMock).toHaveBeenCalledWith('/admin/wards/7/admin-emails', {email: 'editor@example.com', role: 'EDITOR'});
        expect(deleteMock).toHaveBeenNthCalledWith(1, '/admin/wards/7/admins/201');
        expect(deleteMock).toHaveBeenNthCalledWith(2, '/admin/wards/7/admin-emails/301');
    });

    it('builds request shift endpoints', async () => {
        const client = createClient();
        const getMock = client.get as ReturnType<typeof vi.fn>;
        const patchMock = client.patch as ReturnType<typeof vi.fn>;

        getMock.mockResolvedValueOnce({data: {days: [], wardShiftTypes: [], divisionShiftNurses: []}});
        getMock.mockResolvedValueOnce({data: []});
        patchMock.mockResolvedValue({data: undefined});

        const wardApi = createWardApi(client);

        await expect(wardApi.getReqShift(7, 3, 2026, 3)).resolves.toMatchObject({days: []});
        await expect(wardApi.getRequestList(7, 3, 2026, 3)).resolves.toEqual([]);
        await expect(wardApi.updateReqShift(7, 2026, 3, 4, 12, 99)).resolves.toBeUndefined();
        await expect(wardApi.acceptRequestShift(7, 301, true)).resolves.toBeUndefined();

        expect(getMock).toHaveBeenNthCalledWith(1, '/wards/7/shift-teams/3/req-duty?year=2026&month=3');
        expect(getMock).toHaveBeenNthCalledWith(2, '/wards/7/shift-teams/3/req-duty/req-list?year=2026&month=3');
        expect(patchMock).toHaveBeenNthCalledWith(1, '/wards/7/req-shifts', {
            shiftNurseId: 12,
            date: '2026-03-04',
            wardShiftTypeId: 99,
        });
        expect(patchMock).toHaveBeenNthCalledWith(2, '/wards/7/req-shifts/301/accept', {isAccepted: true});
    });

    it('filters retired fields from shift-team nurse create payloads', async () => {
        const client = createClient();
        const postMock = client.post as ReturnType<typeof vi.fn>;

        postMock.mockResolvedValueOnce({data: {nurseId: 12}});

        const wardApi = createWardApi(client);

        await expect(
            wardApi.addNurseIntoShiftTeam(7, 3, {
                name: ' 김간호사 ',
                phoneNum: '',
                gender: '여',
                employmentDate: '',
                isDutyManager: false,
                isWorker: true,
                isWardManager: false,
                memo: '',
            } as never),
        ).resolves.toEqual({nurseId: 12});

        expect(postMock).toHaveBeenCalledWith('/wards/7/shift-teams/3/nurses', {
            name: '김간호사',
            isWorker: true,
            isWardManager: false,
            memo: '',
        });
    });

    it('filters retired fields from nurse patch payloads', async () => {
        const client = createClient();
        const patchMock = client.patch as ReturnType<typeof vi.fn>;

        patchMock.mockResolvedValueOnce({data: {nurseId: 12}});

        const nurseApi = createNurseApi(client);

        await expect(
            nurseApi.updateNurse(12, {
                name: '김간호사',
                phoneNum: '010-1234-5678',
                gender: '여',
                employmentDate: '2025-01-01',
                isDutyManager: false,
                isWorker: true,
                isWardManager: false,
                memo: '메모',
            } as never),
        ).resolves.toEqual({nurseId: 12});

        expect(patchMock).toHaveBeenCalledWith('/nurses/12', {
            name: '김간호사',
            phoneNum: '010-1234-5678',
            isWorker: true,
            isWardManager: false,
            memo: '메모',
        });
    });

    it('preserves explicit null phone values in nurse patch payloads', async () => {
        const client = createClient();
        const patchMock = client.patch as ReturnType<typeof vi.fn>;

        patchMock.mockResolvedValueOnce({data: {nurseId: 12}});

        const nurseApi = createNurseApi(client);

        await expect(nurseApi.updateNurse(12, {phoneNum: null})).resolves.toEqual({nurseId: 12});

        expect(patchMock).toHaveBeenCalledWith('/nurses/12', {
            phoneNum: null,
        });
    });

    it('clears dummy phone values in nurse patch payloads', async () => {
        const client = createClient();
        const patchMock = client.patch as ReturnType<typeof vi.fn>;

        patchMock.mockResolvedValueOnce({data: {nurseId: 12, phoneNum: '01000000000'}});

        const nurseApi = createNurseApi(client);

        await expect(nurseApi.updateNurse(12, {phoneNum: '010-0000-0000'})).resolves.toMatchObject({
            phoneNum: null,
        });

        expect(patchMock).toHaveBeenCalledWith('/nurses/12', {
            phoneNum: null,
        });
    });

    it('normalizes dummy phone values from shift-team responses', async () => {
        const client = createClient();
        const getMock = client.get as ReturnType<typeof vi.fn>;

        getMock.mockResolvedValueOnce({
            data: {
                shiftTeams: [
                    {
                        shiftTeamId: 3,
                        name: 'A',
                        nurseCnt: 1,
                        nurses: [{nurseId: 12, name: 'Kim', phoneNum: '01000000000'}],
                    },
                ],
            },
        });

        const wardApi = createWardApi(client);

        await expect(wardApi.getShiftTeams(7)).resolves.toEqual([
            {
                shiftTeamId: 3,
                name: 'A',
                nurseCnt: 1,
                nurses: [{nurseId: 12, name: 'Kim', phoneNum: null}],
            },
        ]);
    });

    it('normalizes nurse shift type preference payloads', async () => {
        const client = createClient();
        const patchMock = client.patch as ReturnType<typeof vi.fn>;

        patchMock.mockResolvedValueOnce({data: undefined});

        const nurseApi = createNurseApi(client);

        await expect(nurseApi.updateNurseShiftType(7, 104, {isPossible: false, isPrefer: true})).resolves.toBeUndefined();

        expect(patchMock).toHaveBeenCalledWith('/nurses/7/shift-types/104', {
            isPossible: false,
            isPreferred: true,
        });
    });
});
