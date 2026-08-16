import {describe, expect, it, vi} from 'vitest';
import type {IApiClient} from '../client';
import type {TShiftConstraintRulesResponse} from '../ward';
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

    it('updates account birthDate through the dedicated endpoint', async () => {
        const client = createClient();
        const patchMock = client.patch as ReturnType<typeof vi.fn>;

        patchMock.mockResolvedValueOnce({data: {accountId: 12, birthDate: '1996-03-14'}});

        const accountApi = createAccountApi(client);

        await expect(accountApi.updateBirthDate('1996-03-14')).resolves.toEqual({accountId: 12, birthDate: '1996-03-14'});

        expect(patchMock).toHaveBeenCalledWith('/accounts/me/birth-date', {
            birthDate: '1996-03-14',
        });
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
                    rotationSystem: 'NONE',
                    paidMinutes: null,
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

    it('preserves the selected classification for overnight ward shift types', async () => {
        const client = createClient();
        const postMock = client.post as ReturnType<typeof vi.fn>;

        postMock.mockResolvedValueOnce({
            data: {
                wardId: 10,
                name: 'ICU',
                hospitalName: 'Dutying Hospital',
                code: 'A7K29Q',
                nurseCnt: 0,
                wardShiftTypes: [],
                shiftTeams: [],
            },
        });

        const wardApi = createWardApi(client);
        const overnightShiftType = {
            name: 'Late',
            shortName: 'L',
            startTime: '16:30',
            endTime: '00:30',
            color: '#5A95F8',
            isOff: false,
            isDefault: false,
            isCounted: true,
            classification: 'OTHER_WORK' as const,
        };

        await wardApi.createWard({
            name: 'ICU',
            hospitalName: 'Dutying Hospital',
            wardShiftTypes: [overnightShiftType],
            shiftTeams: [],
        });

        expect(postMock).toHaveBeenCalledWith('/wards', {
            name: 'ICU',
            hospitalName: 'Dutying Hospital',
            wardShiftTypes: [
                {
                    ...overnightShiftType,
                    classification: 'OTHER_WORK',
                },
            ],
            shiftTeams: [],
        });
    });

    it('preserves annual leave as a distinct non-working classification', async () => {
        const client = createClient();
        const postMock = client.post as ReturnType<typeof vi.fn>;
        const wardApi = createWardApi(client);
        const annualLeave = {
            name: '연차',
            shortName: '연',
            startTime: '',
            endTime: '',
            color: '#B9A6F3',
            isOff: true,
            isDefault: false,
            isCounted: false,
            classification: 'ANNUAL_LEAVE' as const,
        };

        postMock.mockResolvedValueOnce({data: {wardShiftTypeId: 3}});

        await wardApi.createShiftType(7, annualLeave);

        expect(postMock).toHaveBeenCalledWith('/wards/7/shift-types', {
            ...annualLeave,
            classification: 'ANNUAL_LEAVE',
            rotationSystem: 'NONE',
            paidMinutes: null,
        });
    });

    it('sends inactive onboarding ward shift types without work times', async () => {
        const client = createClient();
        const postMock = client.post as ReturnType<typeof vi.fn>;

        postMock.mockResolvedValueOnce({
            data: {
                wardId: 10,
                name: 'ICU',
                hospitalName: 'Dutying Hospital',
                code: 'A7K29Q',
                nurseCnt: 0,
                wardShiftTypes: [],
                shiftTeams: [],
            },
        });

        const wardApi = createWardApi(client);

        await wardApi.createWard({
            name: 'ICU',
            hospitalName: 'Dutying Hospital',
            wardShiftTypes: [
                {
                    name: 'Archived A',
                    shortName: 'A',
                    startTime: '',
                    endTime: '',
                    color: '#5A95F8',
                    isOff: false,
                    isDefault: false,
                    isCounted: true,
                    classification: 'OTHER_WORK',
                    isActive: false,
                },
            ],
            shiftTeams: [],
        });

        expect(postMock).toHaveBeenCalledWith('/wards', {
            name: 'ICU',
            hospitalName: 'Dutying Hospital',
            wardShiftTypes: [
                expect.objectContaining({
                    shortName: 'A',
                    isActive: false,
                    startTime: null,
                    endTime: null,
                }),
            ],
            shiftTeams: [],
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

        await expect(
            wardApi.createOnboardingWardDraft({name: 'ICU', hospitalName: 'Dutying Hospital', rotationMode: 'THREE'}),
        ).resolves.toMatchObject({
            wardId: 10,
            setupStatus: 'SETUP_IN_PROGRESS',
        });

        await expect(
            wardApi.updateOnboardingWardDraft(10, {
                name: 'ICU',
                hospitalName: 'Dutying Hospital',
                rotationMode: 'TWO',
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
                rotationMode: 'TWO',
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
            rotationMode: 'THREE',
        });
        expect(patchMock).toHaveBeenCalledWith('/wards/10/onboarding/draft', {
            name: 'ICU',
            hospitalName: 'Dutying Hospital',
            rotationMode: 'TWO',
            draftPayload: {draft: {currentStep: 2}},
        });
        expect(postMock).toHaveBeenNthCalledWith(2, '/wards/10/onboarding/complete', {
            name: 'ICU',
            hospitalName: 'Dutying Hospital',
            rotationMode: 'TWO',
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

    it('gets and updates shift constraint rules for a shift team', async () => {
        const client = createClient();
        const getMock = client.get as ReturnType<typeof vi.fn>;
        const putMock = client.put as ReturnType<typeof vi.fn>;
        const wardApi = createWardApi(client);
        const response = {
            schemaVersion: 1,
            wardId: 7,
            shiftTeamId: 3,
            rules: [
                {
                    shiftConstraintRuleId: 12,
                    templateCode: 'SOFT_NO_SAME_DUTY_PAIR',
                    category: 'COMBINATION',
                    severity: 'SOFT' as const,
                    sortOrder: 1,
                    params: {nurseA: 'A', nurseB: 'B'},
                    selected: true,
                    isImportant: false,
                },
            ],
            warnings: [
                {
                    code: 'MAX_WORK_BELOW_WORK_OFF_TRIGGER',
                    message: 'Maximum consecutive work is lower than the work-off trigger.',
                    relatedTemplateCodes: ['CORE_MAX_CONTINUOUS_WORK', 'MIN_OFF_AFTER_CONSECUTIVE_WORK'],
                },
            ],
        } satisfies TShiftConstraintRulesResponse;
        const payload = {
            rules: [
                {
                    shiftConstraintRuleId: 12,
                    templateCode: 'SOFT_NO_SAME_DUTY_PAIR',
                    severity: 'SOFT' as const,
                    sortOrder: 1,
                    params: {nurseA: 'A', nurseB: 'B'},
                    selected: true,
                    isImportant: false,
                },
            ],
        };
        const candidateResponse = {
            schemaVersion: 1,
            wardId: 7,
            shiftTeamId: 3,
            rotationMode: 'TWO' as const,
            options: {},
            templates: [],
        };

        getMock.mockResolvedValueOnce({data: response}).mockResolvedValueOnce({data: candidateResponse});
        putMock.mockResolvedValueOnce({data: response});

        await expect(wardApi.getShiftConstraintRules(7, 3)).resolves.toEqual(response);
        await expect(wardApi.getShiftConstraintRuleCandidates(7, 3)).resolves.toEqual(candidateResponse);
        await expect(wardApi.updateShiftConstraintRules(7, 3, payload)).resolves.toEqual(response);

        expect(getMock).toHaveBeenCalledWith('/wards/7/shift-teams/3/shift-constraint-rules');
        expect(getMock).toHaveBeenCalledWith('/wards/7/shift-teams/3/shift-constraint-rules/candidates');
        expect(putMock).toHaveBeenCalledWith('/wards/7/shift-teams/3/shift-constraint-rules', payload);
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

    it('builds the shift workflow update endpoint', async () => {
        const client = createClient();
        const patchMock = client.patch as ReturnType<typeof vi.fn>;
        const payload = {workflowStatus: 'IN_PROGRESS' as const, workflowStep: 3};

        patchMock.mockResolvedValueOnce({data: payload});

        const wardApi = createWardApi(client);

        await expect(wardApi.updateShiftWorkflow(7, 3, 2026, 7, payload)).resolves.toEqual(payload);

        expect(patchMock).toHaveBeenCalledWith('/wards/7/shift-teams/3/duty/workflow?year=2026&month=7', payload);
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
        getMock.mockResolvedValueOnce({data: {totalPendingCount: 12}});
        patchMock.mockResolvedValue({data: undefined});

        const wardApi = createWardApi(client);

        await expect(wardApi.getReqShift(7, 3, 2026, 3)).resolves.toMatchObject({days: []});
        await expect(wardApi.getRequestList(7, 3, 2026, 3)).resolves.toEqual([]);
        await expect(wardApi.getReqShiftPendingCount(7)).resolves.toEqual({totalPendingCount: 12});
        await expect(wardApi.updateReqShift(7, 2026, 3, 4, 12, 99)).resolves.toBeUndefined();
        await expect(wardApi.acceptRequestShift(7, 301, true)).resolves.toBeUndefined();

        expect(getMock).toHaveBeenNthCalledWith(1, '/wards/7/shift-teams/3/req-duty?year=2026&month=3');
        expect(getMock).toHaveBeenNthCalledWith(2, '/wards/7/shift-teams/3/req-duty/req-list?year=2026&month=3');
        expect(getMock).toHaveBeenNthCalledWith(3, '/wards/7/req-shifts/pending-count');
        expect(patchMock).toHaveBeenNthCalledWith(1, '/wards/7/req-shifts', {
            shiftNurseId: 12,
            date: '2026-03-04',
            wardShiftTypeId: 99,
        });
        expect(patchMock).toHaveBeenNthCalledWith(2, '/wards/7/req-shifts/301/accept', {isAccepted: true});
    });

    it('preserves explicit classification and rotation metadata for shift type create and update payloads', async () => {
        const client = createClient();
        const postMock = client.post as ReturnType<typeof vi.fn>;
        const putMock = client.put as ReturnType<typeof vi.fn>;
        const wardApi = createWardApi(client);
        const payload = {
            name: 'Late',
            shortName: 'L',
            startTime: '16:30',
            endTime: '00:30',
            color: '#5A95F8',
            isOff: false,
            isDefault: false,
            isCounted: true,
            classification: 'OTHER_WORK' as const,
            rotationSystem: 'TWO' as const,
            paidMinutes: 630,
            isActive: true,
        };

        postMock.mockResolvedValueOnce({data: {wardShiftTypeId: 3}});
        putMock.mockResolvedValueOnce({data: {wardShiftTypeId: 3}});

        await wardApi.createShiftType(7, payload);
        await wardApi.updateShiftType(7, 3, payload);

        expect(postMock).toHaveBeenCalledWith('/wards/7/shift-types', {
            ...payload,
            classification: 'OTHER_WORK',
        });
        expect(putMock).toHaveBeenCalledWith('/wards/7/shift-types/3', {
            ...payload,
            classification: 'OTHER_WORK',
        });
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

    it('filters retired fields and sends birthDate in nurse patch payloads', async () => {
        const client = createClient();
        const patchMock = client.patch as ReturnType<typeof vi.fn>;

        patchMock.mockResolvedValueOnce({data: {nurseId: 12}});

        const nurseApi = createNurseApi(client);

        await expect(
            nurseApi.updateNurse(12, {
                name: '김간호사',
                phoneNum: '010-1234-5678',
                birthDate: '1996-03-14',
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
            birthDate: '1996-03-14',
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

    it('clears birthDate values in nurse patch payloads', async () => {
        const client = createClient();
        const patchMock = client.patch as ReturnType<typeof vi.fn>;

        patchMock.mockResolvedValueOnce({data: {nurseId: 12}});

        const nurseApi = createNurseApi(client);

        await expect(nurseApi.updateNurse(12, {birthDate: null} as never)).resolves.toEqual({nurseId: 12});

        expect(patchMock).toHaveBeenCalledWith('/nurses/12', {
            birthDate: '',
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

    it('normalizes snake_case birth dates from nurse responses', async () => {
        const client = createClient();
        const getMock = client.get as ReturnType<typeof vi.fn>;

        getMock.mockResolvedValueOnce({data: {nurseId: 12, name: 'Kim', birth_date: '1996-03-14'}});

        const nurseApi = createNurseApi(client);

        await expect(nurseApi.getNurse(12)).resolves.toMatchObject({
            nurseId: 12,
            birthDate: '1996-03-14',
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
                        nurses: [{nurseId: 12, name: 'Kim', phoneNum: '01000000000', birth_date: '1996-03-14'}],
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
                divisions: [],
                nurses: [{nurseId: 12, name: 'Kim', phoneNum: null, birth_date: '1996-03-14', birthDate: '1996-03-14'}],
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

    it('sends nurse shift type target ratio weight values', async () => {
        const client = createClient();
        const patchMock = client.patch as ReturnType<typeof vi.fn>;

        patchMock.mockResolvedValueOnce({data: undefined});

        const nurseApi = createNurseApi(client);

        await expect(nurseApi.updateNurseShiftType(7, 104, {isPossible: true, targetRatioWeight: 14})).resolves.toBeUndefined();

        expect(patchMock).toHaveBeenCalledWith('/nurses/7/shift-types/104', {
            isPossible: true,
            targetRatioWeight: 14,
        });
    });
});
