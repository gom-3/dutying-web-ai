import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import {act, renderHook} from '@testing-library/react';
import type {ReactNode} from 'react';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import ROUTE from '@/shared/constant/path';
import useEditAccount from '../model/use-edit-account';

const {
    mockAdminDeleteMe,
    mockAdminQuitWard,
    mockCaptureException,
    mockDeleteAccount,
    mockEditAccountStatus,
    mockHandleGetAccountMe,
    mockHandleLogout,
    mockNavigate,
    mockSetLoading,
    mockToastError,
    mockUseAuth,
    mockWardQuitWard,
} = vi.hoisted(() => ({
        mockAdminDeleteMe: vi.fn(),
        mockAdminQuitWard: vi.fn(),
        mockCaptureException: vi.fn(),
        mockDeleteAccount: vi.fn(),
        mockEditAccountStatus: vi.fn(),
        mockHandleGetAccountMe: vi.fn(),
        mockHandleLogout: vi.fn(),
        mockNavigate: vi.fn(),
        mockSetLoading: vi.fn(),
        mockToastError: vi.fn(),
        mockUseAuth: vi.fn(),
        mockWardQuitWard: vi.fn(),
    }));

vi.mock('@sentry/react', () => ({
    captureException: mockCaptureException,
}));

vi.mock('react-hot-toast', () => ({
    default: {
        error: mockToastError,
    },
}));

vi.mock('react-router', () => ({
    useNavigate: () => mockNavigate,
}));

vi.mock('@/features/auth', () => ({
    default: () => mockUseAuth(),
}));

vi.mock('@/features/edit-ward', () => ({
    default: () => ({
        queryKey: {
            getWardQueryKey: ['ward'],
        },
    }),
}));

vi.mock('@/features/loading', () => ({
    default: () => ({
        setLoading: mockSetLoading,
    }),
}));

vi.mock('@/shared/api', () => ({
    AccountAPI: {
        deleteAccount: mockDeleteAccount,
        editAccount: vi.fn(),
        editAccountStatus: mockEditAccountStatus,
    },
    AdminAPI: {
        deleteMe: mockAdminDeleteMe,
        quitWard: mockAdminQuitWard,
        updateMe: vi.fn(),
    },
    NurseAPI: {
        updateNurse: vi.fn(),
    },
    WardAPI: {
        quitWard: mockWardQuitWard,
    },
}));

const createJwt = (payload: Record<string, unknown>) =>
    `header.${btoa(JSON.stringify(payload)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')}.signature`;
const createWrapper = (queryClient: QueryClient) => {
    const Wrapper = ({children}: {children: ReactNode}) => <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;

    return Wrapper;
};

describe('useEditAccount.deleteAccount', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockAdminDeleteMe.mockResolvedValue(undefined);
        mockAdminQuitWard.mockResolvedValue(undefined);
        mockDeleteAccount.mockResolvedValue(undefined);
        mockEditAccountStatus.mockResolvedValue(undefined);
        mockHandleGetAccountMe.mockResolvedValue(undefined);
        mockHandleLogout.mockResolvedValue(undefined);
        mockWardQuitWard.mockResolvedValue(undefined);
        mockUseAuth.mockReturnValue({
            state: {
                accountMe: {
                    accountId: 7,
                    wardId: 3,
                    nurseId: 11,
                    email: 'user@example.com',
                    name: 'User',
                    profileImgUrl: '',
                    status: 'LINKED',
                },
                accessToken: createJwt({principalType: 'WARD_ADMIN'}),
            },
            actions: {
                handleGetAccountMe: mockHandleGetAccountMe,
                handleLogout: mockHandleLogout,
            },
        });
    });

    it('uses the admin deletion API for ward admin tokens and goes to the landing page', async () => {
        const queryClient = new QueryClient();

        queryClient.setQueryData(['private', 'account'], {accountId: 7});

        const {result} = renderHook(() => useEditAccount(), {wrapper: createWrapper(queryClient)});

        await act(async () => {
            await result.current.deleteAccount();
        });

        expect(mockAdminDeleteMe).toHaveBeenCalledTimes(1);
        expect(mockDeleteAccount).not.toHaveBeenCalled();
        expect(queryClient.getQueryData(['private', 'account'])).toBeUndefined();
        expect(mockHandleLogout).toHaveBeenCalledWith(ROUTE.ROOT);
        expect(mockSetLoading).toHaveBeenNthCalledWith(1, true);
        expect(mockSetLoading).toHaveBeenLastCalledWith(false);
    });

    it('uses the account deletion API for account tokens and goes to the landing page', async () => {
        const queryClient = new QueryClient();

        mockUseAuth.mockReturnValue({
            state: {
                accountMe: {
                    accountId: 7,
                    wardId: 3,
                    nurseId: 11,
                    email: 'user@example.com',
                    name: 'User',
                    profileImgUrl: '',
                    status: 'LINKED',
                },
                accessToken: createJwt({principalType: 'ACCOUNT'}),
            },
            actions: {
                handleGetAccountMe: mockHandleGetAccountMe,
                handleLogout: mockHandleLogout,
            },
        });
        queryClient.setQueryData(['private', 'account'], {accountId: 7});

        const {result} = renderHook(() => useEditAccount(), {wrapper: createWrapper(queryClient)});

        await act(async () => {
            await result.current.deleteAccount();
        });

        expect(mockAdminDeleteMe).not.toHaveBeenCalled();
        expect(mockDeleteAccount).toHaveBeenCalledWith(7);
        expect(queryClient.getQueryData(['private', 'account'])).toBeUndefined();
        expect(mockHandleLogout).toHaveBeenCalledWith(ROUTE.ROOT);
        expect(mockSetLoading).toHaveBeenNthCalledWith(1, true);
        expect(mockSetLoading).toHaveBeenLastCalledWith(false);
    });

    it('keeps the current session when account deletion fails', async () => {
        const error = new Error('delete failed');
        const queryClient = new QueryClient();

        queryClient.setQueryData(['private', 'account'], {accountId: 7});
        mockAdminDeleteMe.mockRejectedValueOnce(error);

        const {result} = renderHook(() => useEditAccount(), {wrapper: createWrapper(queryClient)});

        await act(async () => {
            await result.current.deleteAccount();
        });

        expect(mockHandleLogout).not.toHaveBeenCalled();
        expect(queryClient.getQueryData(['private', 'account'])).toEqual({accountId: 7});
        expect(mockCaptureException).toHaveBeenCalledWith(
            error,
            expect.objectContaining({
                tags: {feature: 'account', action: 'delete-account'},
                extra: {accountId: 7},
            }),
        );
        expect(mockToastError).toHaveBeenCalled();
        expect(mockSetLoading).toHaveBeenLastCalledWith(false);
    });
});

describe('useEditAccount.quitWard', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockAdminQuitWard.mockResolvedValue(undefined);
        mockEditAccountStatus.mockResolvedValue(undefined);
        mockHandleGetAccountMe.mockResolvedValue(undefined);
        mockWardQuitWard.mockResolvedValue(undefined);
        mockUseAuth.mockReturnValue({
            state: {
                accountMe: {
                    accountId: 7,
                    wardId: 3,
                    nurseId: 11,
                    email: 'admin@example.com',
                    name: 'Admin',
                    profileImgUrl: '',
                    status: 'LINKED',
                },
                accessToken: createJwt({principalType: 'WARD_ADMIN'}),
            },
            actions: {
                handleGetAccountMe: mockHandleGetAccountMe,
                handleLogout: mockHandleLogout,
            },
        });
    });

    it('lets a ward admin leave the ward without deleting the account or patching account status', async () => {
        const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
        const queryClient = new QueryClient();
        const {result} = renderHook(() => useEditAccount(), {wrapper: createWrapper(queryClient)});

        await act(async () => {
            await result.current.quitWard();
        });

        expect(confirmSpy).toHaveBeenCalledWith('병동을 나갈까요?');
        expect(mockAdminQuitWard).toHaveBeenCalledWith(3);
        expect(mockWardQuitWard).not.toHaveBeenCalled();
        expect(mockEditAccountStatus).not.toHaveBeenCalled();
        expect(mockHandleGetAccountMe).toHaveBeenCalledTimes(1);
        expect(mockNavigate).toHaveBeenCalledWith(ROUTE.REGISTER, {replace: true, state: {fromQuitWard: true}});
        expect(mockSetLoading).toHaveBeenNthCalledWith(1, true);
        expect(mockSetLoading).toHaveBeenLastCalledWith(false);

        confirmSpy.mockRestore();
    });

    it('keeps the regular account quit flow unchanged', async () => {
        const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
        const queryClient = new QueryClient();

        mockUseAuth.mockReturnValue({
            state: {
                accountMe: {
                    accountId: 7,
                    wardId: 3,
                    nurseId: 11,
                    email: 'user@example.com',
                    name: 'User',
                    profileImgUrl: '',
                    status: 'LINKED',
                },
                accessToken: createJwt({principalType: 'ACCOUNT'}),
            },
            actions: {
                handleGetAccountMe: mockHandleGetAccountMe,
                handleLogout: mockHandleLogout,
            },
        });

        const {result} = renderHook(() => useEditAccount(), {wrapper: createWrapper(queryClient)});

        await act(async () => {
            await result.current.quitWard();
        });

        expect(mockAdminQuitWard).not.toHaveBeenCalled();
        expect(mockWardQuitWard).toHaveBeenCalledWith(3);
        expect(mockEditAccountStatus).toHaveBeenCalledWith(7, 'WARD_SELECT_PENDING');
        expect(mockHandleGetAccountMe).toHaveBeenCalledTimes(1);
        expect(mockNavigate).toHaveBeenCalledWith(ROUTE.REGISTER, {replace: true, state: {fromQuitWard: true}});

        confirmSpy.mockRestore();
    });
});
