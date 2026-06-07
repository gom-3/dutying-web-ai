import {beforeEach, describe, expect, it, vi} from 'vitest';
import AdminAPI from '..';

const {mockGet, mockPatch, mockPost, mockDelete} = vi.hoisted(() => ({
    mockGet: vi.fn(),
    mockPatch: vi.fn(),
    mockPost: vi.fn(),
    mockDelete: vi.fn(),
}));

vi.mock('../../client', () => ({
    default: {
        get: mockGet,
        patch: mockPatch,
        post: mockPost,
        delete: mockDelete,
    },
    adminAxiosInstance: {
        get: mockGet,
        patch: mockPatch,
        post: mockPost,
        delete: mockDelete,
    },
}));

describe('AdminAPI', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('creates an admin workspace through the ward admin endpoint', async () => {
        const payload = {
            hospitalName: 'Dutying Hospital',
            wardName: 'ICU',
            adminName: 'Kim',
            phoneNum: '01012345678',
            profileImgUrl: '',
            wardShiftTypes: [],
            shiftTeams: [],
        };
        const response = {ward: {wardId: 10}};

        mockPost.mockResolvedValue({data: response});

        await expect(AdminAPI.createWorkspace(payload)).resolves.toBe(response);

        expect(mockPost).toHaveBeenCalledWith('/accounts/me/admin-workspace', payload);
    });

    it('updates the admin profile through the ward admin endpoint', async () => {
        const payload = {
            name: '종문',
            phoneNum: '01012345678',
            defaultProfileImgId: 1,
        };
        const response = {
            adminAccountId: 1,
            accountId: 1,
            name: '종문',
            phoneNum: '01012345678',
            status: 'WORKSPACE_SETUP_PENDING',
        };

        mockPatch.mockResolvedValue({data: response});

        await expect(AdminAPI.updateMe(payload)).resolves.toBe(response);

        expect(mockPatch).toHaveBeenCalledWith('/admin/accounts/me', payload);
    });

    it('deletes the current admin account through the ward admin endpoint', async () => {
        mockDelete.mockResolvedValue({data: undefined});

        await expect(AdminAPI.deleteMe()).resolves.toBeUndefined();

        expect(mockDelete).toHaveBeenCalledWith('/admin/accounts/me');
    });

    it('quits an admin ward through the ward admin endpoint', async () => {
        mockDelete.mockResolvedValue({data: undefined});

        await expect(AdminAPI.quitWard(10)).resolves.toBeUndefined();

        expect(mockDelete).toHaveBeenCalledWith('/admin/wards/10/quit');
    });

    it('joins an admin ward through the ward admin code endpoint', async () => {
        const payload = {code: 'A7K29Q'};
        const response = {ward: {wardId: 10}};

        mockPost.mockResolvedValue({data: response});

        await expect(AdminAPI.joinWardByCode(payload)).resolves.toBe(response);

        expect(mockPost).toHaveBeenCalledWith('/admin/wards/join-by-code', payload);
    });
});
