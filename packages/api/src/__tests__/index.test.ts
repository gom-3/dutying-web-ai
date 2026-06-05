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

    it('builds the account deletion endpoint', async () => {
        const client = createClient();
        const deleteMock = client.delete as ReturnType<typeof vi.fn>;

        deleteMock.mockResolvedValueOnce({data: undefined});

        const accountApi = createAccountApi(client);

        await expect(accountApi.deleteAccount(7)).resolves.toBeUndefined();

        expect(deleteMock).toHaveBeenCalledWith('/accounts/7');
    });

    it('builds the tutorial seen endpoint', async () => {
        const client = createClient();
        const postMock = client.post as ReturnType<typeof vi.fn>;

        postMock.mockResolvedValueOnce({data: undefined});

        const accountApi = createAccountApi(client);

        await expect(accountApi.markTutorialSeen('make-step-1')).resolves.toBeUndefined();

        expect(postMock).toHaveBeenCalledWith('/accounts/me/tutorials/make-step-1/seen');
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
