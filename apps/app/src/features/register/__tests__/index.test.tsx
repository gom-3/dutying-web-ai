import {act, renderHook} from '@testing-library/react';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import useRegister from '..';

const {
    mockNavigate,
    mockHandleGetAccountMe,
    mockApplyAccountMe,
    mockSetLoading,
    mockInitTutorial,
    mockCreateWard,
    mockCreateWorkspace,
    mockJoinWardByCode,
    mockUpdateAdminMe,
    mockEditAccount,
    mockInitAccount,
    mockEditAccountStatus,
    mockAccountMe,
} = vi.hoisted(() => ({
    mockNavigate: vi.fn(),
    mockHandleGetAccountMe: vi.fn(),
    mockApplyAccountMe: vi.fn(),
    mockSetLoading: vi.fn(),
    mockInitTutorial: vi.fn(),
    mockCreateWard: vi.fn(),
    mockCreateWorkspace: vi.fn(),
    mockJoinWardByCode: vi.fn(),
    mockUpdateAdminMe: vi.fn(),
    mockEditAccount: vi.fn(),
    mockInitAccount: vi.fn(),
    mockEditAccountStatus: vi.fn(),
    mockAccountMe: {
        current: {
            accountId: 1,
            status: 'WARD_SELECT_PENDING',
        },
    } as {current: Record<string, unknown>},
}));

vi.mock('react-router', async () => {
    const actual = await vi.importActual('react-router');

    return {
        ...actual,
        useNavigate: () => mockNavigate,
    };
});

vi.mock('@tanstack/react-query', async () => {
    const actual = await vi.importActual('@tanstack/react-query');

    return {
        ...actual,
        useQuery: vi.fn(() => ({data: null})),
    };
});

vi.mock('@/features/auth', () => ({
    default: () => ({
        state: {
            accountMe: mockAccountMe.current,
            accountId: 1,
        },
        actions: {
            handleGetAccountMe: mockHandleGetAccountMe,
            applyAccountMe: mockApplyAccountMe,
        },
    }),
}));

vi.mock('@/features/loading', () => ({
    default: () => ({
        setLoading: mockSetLoading,
    }),
}));

vi.mock('@/features/tutorial', () => ({
    default: () => ({
        initTutorial: mockInitTutorial,
    }),
}));

vi.mock('@/shared/api', () => ({
    AccountAPI: {
        editAccount: mockEditAccount,
        initAccount: mockInitAccount,
        editAccountStatus: mockEditAccountStatus,
    },
    AdminAPI: {
        createWorkspace: mockCreateWorkspace,
        joinWardByCode: mockJoinWardByCode,
        updateMe: mockUpdateAdminMe,
    },
    NurseAPI: {},
    WardAPI: {
        createWard: mockCreateWard,
        addMeToWaitingNurses: vi.fn(),
        deleteWaitingNurses: vi.fn(),
    },
}));

describe('useRegister', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockHandleGetAccountMe.mockResolvedValue(undefined);
        mockAccountMe.current = {
            accountId: 1,
            status: 'WARD_SELECT_PENDING',
        };
    });

    it('applies the linked account immediately after creating a ward', async () => {
        const createdWard = {wardId: 10, name: 'ICU'};

        mockAccountMe.current = {
            accountId: 1,
            nurseId: null,
            wardId: null,
            shiftTeamId: null,
            email: 'nurse@example.com',
            name: 'Kim',
            profileImgUrl: '',
            isManager: true,
            status: 'WARD_SELECT_PENDING',
        };

        mockCreateWorkspace.mockResolvedValue(createdWard);
        mockHandleGetAccountMe.mockImplementation(() => new Promise(() => undefined));

        const {result} = renderHook(() => useRegister());

        await act(async () => {
            await expect(
                result.current.actions.createWard(
                    {
                        name: 'ICU',
                        hospitalName: 'Dutying Hospital',
                        shiftTeams: [],
                        wardShiftTypes: [],
                    },
                    {navigateOnLinked: false},
                ),
            ).resolves.toBe(createdWard);
        });

        expect(mockCreateWorkspace).toHaveBeenCalledWith({
            hospitalName: 'Dutying Hospital',
            wardName: 'ICU',
            adminName: 'Kim',
            phoneNum: null,
            profileImgUrl: '',
        });
        expect(mockCreateWard).not.toHaveBeenCalled();
        expect(mockApplyAccountMe).toHaveBeenCalledWith({
            ...mockAccountMe.current,
            wardId: 10,
            status: 'LINKED',
        });
        expect(mockHandleGetAccountMe).not.toHaveBeenCalled();
        expect(mockNavigate).not.toHaveBeenCalled();
    });

    it('does not let a stale account refetch overwrite the linked account after ward creation', async () => {
        const createdWard = {wardId: 271, name: 'ICU'};
        const linkedAccount = {
            adminAccountId: 1,
            accountId: 1,
            nurseId: null,
            wardId: 271,
            shiftTeamId: null,
            email: 'admin@example.com',
            name: 'Kim',
            phoneNum: '01012341234',
            profileImgUrl: '',
            isManager: true,
            status: 'LINKED',
            role: 'OWNER',
            permissions: ['DUTY_MANAGE'],
            memberships: [],
        };

        mockAccountMe.current = {
            accountId: 1,
            nurseId: null,
            wardId: null,
            shiftTeamId: null,
            email: 'admin@example.com',
            name: 'Kim',
            profileImgUrl: '',
            phoneNum: '01012341234',
            isManager: true,
            status: 'WORKSPACE_SETUP_PENDING',
        };
        mockHandleGetAccountMe.mockResolvedValue({
            ...mockAccountMe.current,
            status: 'WORKSPACE_SETUP_PENDING',
            wardId: null,
        });
        mockCreateWorkspace.mockResolvedValue({
            account: linkedAccount,
            ward: createdWard,
        });

        const {result} = renderHook(() => useRegister());

        await act(async () => {
            await result.current.actions.createWard(
                {
                    name: 'ICU',
                    hospitalName: 'Dutying Hospital',
                    shiftTeams: [],
                    wardShiftTypes: [],
                },
                {navigateOnLinked: false},
            );
        });

        expect(mockApplyAccountMe).toHaveBeenCalledTimes(1);
        expect(mockApplyAccountMe).toHaveBeenCalledWith(linkedAccount);
        expect(mockHandleGetAccountMe).not.toHaveBeenCalled();
    });

    it('prefers the linked admin account returned by workspace creation', async () => {
        const createdWard = {wardId: 271, name: 'ICU'};
        const linkedAccount = {
            adminAccountId: 1,
            accountId: 1,
            nurseId: null,
            wardId: 271,
            shiftTeamId: null,
            email: 'admin@example.com',
            name: 'Kim',
            phoneNum: '01012341234',
            profileImgUrl: '',
            isManager: true,
            status: 'LINKED',
            role: 'OWNER',
            permissions: ['DUTY_MANAGE'],
            memberships: [],
        };

        mockAccountMe.current = {
            accountId: 1,
            nurseId: null,
            wardId: null,
            shiftTeamId: null,
            email: 'admin@example.com',
            name: 'Kim',
            profileImgUrl: '',
            phoneNum: '01012341234',
            isManager: true,
            status: 'WORKSPACE_SETUP_PENDING',
        };
        mockCreateWorkspace.mockResolvedValue({
            account: linkedAccount,
            ward: createdWard,
        });

        const {result} = renderHook(() => useRegister());

        await act(async () => {
            await expect(
                result.current.actions.createWard(
                    {
                        name: 'ICU',
                        hospitalName: 'Dutying Hospital',
                        shiftTeams: [],
                        wardShiftTypes: [],
                    },
                    {navigateOnLinked: false},
                ),
            ).resolves.toBe(createdWard);
        });

        expect(mockApplyAccountMe).toHaveBeenCalledWith(linkedAccount);
        expect(mockNavigate).not.toHaveBeenCalled();
    });

    it('normalizes a returned setup-pending admin account after workspace creation', async () => {
        const createdWard = {wardId: 271, name: 'ICU'};
        const setupPendingAccount = {
            adminAccountId: 1,
            accountId: 1,
            nurseId: null,
            wardId: null,
            shiftTeamId: null,
            email: 'admin@example.com',
            name: 'Kim',
            phoneNum: '01012341234',
            profileImgUrl: '',
            isManager: true,
            status: 'WORKSPACE_SETUP_PENDING',
            role: 'OWNER',
            permissions: ['DUTY_MANAGE'],
            memberships: [],
        };

        mockAccountMe.current = {
            accountId: 1,
            nurseId: null,
            wardId: null,
            shiftTeamId: null,
            email: 'admin@example.com',
            name: 'Kim',
            profileImgUrl: '',
            phoneNum: '01012341234',
            isManager: true,
            status: 'WORKSPACE_SETUP_PENDING',
        };
        mockCreateWorkspace.mockResolvedValue({
            account: setupPendingAccount,
            ward: createdWard,
        });

        const {result} = renderHook(() => useRegister());

        await act(async () => {
            await expect(
                result.current.actions.createWard({
                    name: 'ICU',
                    hospitalName: 'Dutying Hospital',
                    shiftTeams: [],
                    wardShiftTypes: [],
                }),
            ).resolves.toBe(createdWard);
        });

        expect(mockApplyAccountMe).toHaveBeenCalledWith({
            ...setupPendingAccount,
            wardId: 271,
            status: 'LINKED',
        });
        expect(mockNavigate).toHaveBeenCalledWith('/make');
    });

    it('joins a ward through the admin code endpoint', async () => {
        const joinedAccount = {
            accountId: 1,
            nurseId: null,
            wardId: 10,
            shiftTeamId: null,
            email: 'admin@example.com',
            name: 'Kim',
            profileImgUrl: '',
            isManager: true,
            status: 'LINKED',
            adminAccountId: 1,
            role: 'EDITOR',
            permissions: [],
            memberships: [],
        };

        mockJoinWardByCode.mockResolvedValue({account: joinedAccount});

        const {result} = renderHook(() => useRegister());

        await act(async () => {
            await expect(result.current.actions.joinWardByCode({code: 'A7K29Q'})).resolves.toEqual({account: joinedAccount});
        });

        expect(mockJoinWardByCode).toHaveBeenCalledWith({code: 'A7K29Q'});
        expect(mockApplyAccountMe).toHaveBeenCalledWith({
            ...joinedAccount,
            status: 'LINKED',
        });
        expect(mockNavigate).toHaveBeenCalledWith('/make');
    });

    it('saves name and profile with editAccount for initial accounts', async () => {
        mockAccountMe.current = {
            accountId: 1,
            status: 'INITIAL',
        };

        const updatedAccount = {
            accountId: 1,
            nurseId: null,
            wardId: null,
            shiftTeamId: null,
            email: 'nurse@example.com',
            name: '홍길동',
            profileImgUrl: '',
            isManager: false,
            status: 'WARD_SELECT_PENDING',
        };

        mockEditAccount.mockResolvedValue(updatedAccount);
        mockEditAccountStatus.mockResolvedValue(updatedAccount);
        mockHandleGetAccountMe.mockImplementation(() => new Promise(() => undefined));

        const {result} = renderHook(() => useRegister());

        await act(async () => {
            await result.current.actions.registerAccountProfile({
                name: '홍길동',
                phoneNum: '01012345678',
                profileImg: {defaultProfileImgId: 1},
            });
        });

        expect(mockEditAccount).toHaveBeenCalledWith({
            accountId: 1,
            name: '홍길동',
            phoneNum: '01012345678',
            defaultProfileImgId: 1,
        });
        expect(mockInitAccount).not.toHaveBeenCalled();
        expect(mockEditAccountStatus).toHaveBeenCalledWith(1, 'WARD_SELECT_PENDING');
    });

    it('saves contact information for workspace setup accounts without changing legacy account status', async () => {
        mockAccountMe.current = {
            accountId: 1,
            status: 'WORKSPACE_SETUP_PENDING',
        };

        mockUpdateAdminMe.mockResolvedValue({
            accountId: 1,
            status: 'WORKSPACE_SETUP_PENDING',
            phoneNum: '01012345678',
        });

        const {result} = renderHook(() => useRegister());

        await act(async () => {
            await result.current.actions.registerAccountProfile({
                name: '종문',
                phoneNum: '01012345678',
                profileImg: {defaultProfileImgId: 1},
            });
        });

        expect(mockUpdateAdminMe).toHaveBeenCalledWith({
            name: '종문',
            phoneNum: '01012345678',
            defaultProfileImgId: 1,
        });
        expect(mockEditAccount).not.toHaveBeenCalled();
        expect(mockEditAccountStatus).not.toHaveBeenCalled();
        expect(mockHandleGetAccountMe).toHaveBeenCalledTimes(1);
        expect(mockApplyAccountMe).toHaveBeenCalledWith({
            accountId: 1,
            status: 'WORKSPACE_SETUP_PENDING',
            phoneNum: '01012345678',
        });
    });
});
