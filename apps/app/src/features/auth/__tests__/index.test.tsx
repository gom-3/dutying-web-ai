import {act, renderHook} from '@testing-library/react';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import {AdminAPI, AuthAPI} from '@/shared/api';
import useAuth from '../index';
import useAuthStore from '../model/store';

const {
    mockNavigate,
    mockResetRequestShiftState,
    mockSetLoading,
    mockInitTutorial,
    mockSendEvent,
    mockExecuteLoginRedirect,
    mockGetLoginRedirectDecision,
    setAccessTokenMock,
    setAdminAccessTokenMock,
} = vi.hoisted(() => ({
    mockNavigate: vi.fn(),
    mockResetRequestShiftState: vi.fn(),
    mockSetLoading: vi.fn(),
    mockInitTutorial: vi.fn(),
    mockSendEvent: vi.fn(),
    mockExecuteLoginRedirect: vi.fn(),
    mockGetLoginRedirectDecision: vi.fn(() => ({type: 'none'})),
    setAccessTokenMock: vi.fn(),
    setAdminAccessTokenMock: vi.fn(),
}));

vi.mock('react-router', () => ({
    useLocation: () => ({pathname: '/request'}),
    useNavigate: () => mockNavigate,
}));

vi.mock('@/analytics', () => ({
    events: {
        auth: {
            login: 'login',
            logut: 'logout',
        },
    },
    sendEvent: (...args: unknown[]) => mockSendEvent(...args),
}));

vi.mock('@/features/request-shift/model/store', () => ({
    useRequestShiftStore: (selector: (state: {resetState: () => void}) => unknown) =>
        selector({
            resetState: mockResetRequestShiftState,
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

vi.mock('@/shared/api/client', () => ({
    setAccessToken: (...args: unknown[]) => setAccessTokenMock(...args),
    setAdminAccessToken: (...args: unknown[]) => setAdminAccessTokenMock(...args),
}));

vi.mock('@/shared/api', () => ({
    AdminAPI: {
        getMe: vi.fn(),
    },
    AuthAPI: {
        demoStart: vi.fn(),
    },
}));

vi.mock('../model/login-redirect', () => ({
    executeLoginRedirect: mockExecuteLoginRedirect,
    getLoginRedirectDecision: mockGetLoginRedirectDecision,
}));

describe('useAuth', () => {
    const createJwt = (payload: Record<string, unknown>) =>
        `header.${btoa(JSON.stringify(payload)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')}.signature`;

    beforeEach(() => {
        vi.clearAllMocks();
        localStorage.clear();
        useAuthStore.setState({
            accountMe: {accountId: 9, wardId: 99, nurseId: 19} as never,
            accountMeStatus: 'success',
            isAuth: true,
            isDemoExpired: false,
            accessToken: createJwt({principalType: 'WARD_ADMIN', wardAdminAccountId: 9}),
            accountId: 9,
            nurseId: 19,
            wardId: 99,
            demoStartDate: '2026-03-01T00:00:00.000Z',
            _loaded: true,
        });
    });

    it('clears stale identity fields when login starts a new bootstrap', () => {
        const {result} = renderHook(() => useAuth());

        act(() => {
            result.current.actions.handleLogin(createJwt({principalType: 'WARD_ADMIN', wardAdminAccountId: 12}), null);
        });

        expect(useAuthStore.getState()).toMatchObject({
            accountMe: null,
            accountMeStatus: 'loading',
            accessToken: createJwt({principalType: 'WARD_ADMIN', wardAdminAccountId: 12}),
            accountId: null,
            nurseId: null,
            wardId: null,
            demoStartDate: null,
            isAuth: true,
        });
        expect(setAccessTokenMock).toHaveBeenCalledWith(createJwt({principalType: 'WARD_ADMIN', wardAdminAccountId: 12}));
        expect(setAdminAccessTokenMock).toHaveBeenCalledWith(createJwt({principalType: 'WARD_ADMIN', wardAdminAccountId: 12}));
        expect(setAccessTokenMock.mock.invocationCallOrder[0]).toBeLessThan(mockExecuteLoginRedirect.mock.invocationCallOrder[0]);
    });

    it('does not attach non-admin tokens to the admin API client', () => {
        const {result} = renderHook(() => useAuth());
        const appToken = createJwt({principalType: 'ACCOUNT', accountId: 12});

        act(() => {
            result.current.actions.handleLogin(appToken, null);
        });

        expect(setAccessTokenMock).toHaveBeenCalledWith(appToken);
        expect(setAdminAccessTokenMock).toHaveBeenCalledWith('');
    });

    it('preserves demoStartDate when login is used for token refresh', () => {
        const {result} = renderHook(() => useAuth());

        act(() => {
            result.current.actions.handleLogin(createJwt({principalType: 'WARD_ADMIN', wardAdminAccountId: 15}), null, {
                preserveDemoStartDate: true,
            });
        });

        expect(useAuthStore.getState()).toMatchObject({
            accountMe: null,
            accountMeStatus: 'loading',
            accessToken: createJwt({principalType: 'WARD_ADMIN', wardAdminAccountId: 15}),
            accountId: null,
            nurseId: null,
            wardId: null,
            demoStartDate: '2026-03-01T00:00:00.000Z',
            isAuth: true,
        });
    });

    it('preserves stale identity fields and rethrows when account bootstrap fails', async () => {
        vi.mocked(AdminAPI.getMe).mockRejectedValueOnce(new Error('boom'));

        const {result} = renderHook(() => useAuth());

        await expect(
            act(async () => {
                await result.current.actions.handleGetAccountMe();
            }),
        ).rejects.toThrow('boom');

        expect(useAuthStore.getState()).toMatchObject({
            accountMe: {accountId: 9, wardId: 99, nurseId: 19},
            accountMeStatus: 'error',
            accountId: 9,
            nurseId: 19,
            wardId: 99,
        });
    });

    it('normalizes setup-pending admin accounts with a ward membership as linked during bootstrap', async () => {
        vi.mocked(AdminAPI.getMe).mockResolvedValueOnce({
            accountId: 9,
            nurseId: null,
            wardId: null,
            shiftTeamId: null,
            email: 'admin@example.com',
            name: 'Kim',
            profileImgUrl: '',
            isManager: true,
            status: 'WORKSPACE_SETUP_PENDING',
            memberships: [{wardId: 99, role: 'OWNER', status: 'ACTIVE'}],
        } as never);

        const {result} = renderHook(() => useAuth());

        await act(async () => {
            await result.current.actions.handleGetAccountMe();
        });

        expect(useAuthStore.getState()).toMatchObject({
            accountMe: {
                accountId: 9,
                wardId: 99,
                status: 'LINKED',
            },
            wardId: 99,
            accountMeStatus: 'success',
        });
    });

    it('marks the demo session as expired during bootstrap instead of logging out', async () => {
        useAuthStore.setState({
            demoStartDate: '2026-02-01T00:00:00.000Z',
            isDemoExpired: false,
        });

        vi.mocked(AdminAPI.getMe).mockResolvedValueOnce({accountId: 9, wardId: 99, nurseId: 19} as never);

        await act(async () => {
            renderHook(() => useAuth(true));
            await Promise.resolve();
        });

        expect(useAuthStore.getState()).toMatchObject({
            isAuth: true,
            accessToken: createJwt({principalType: 'WARD_ADMIN', wardAdminAccountId: 9}),
            isDemoExpired: true,
        });
        expect(mockResetRequestShiftState).not.toHaveBeenCalled();
    });

    it('turns loading off again when demo bootstrap fails', async () => {
        vi.mocked(AuthAPI.demoStart).mockRejectedValueOnce(new Error('demo failed'));

        const {result} = renderHook(() => useAuth());

        await expect(
            act(async () => {
                await result.current.actions.demoTry();
            }),
        ).rejects.toThrow('demo failed');

        expect(mockSetLoading).toHaveBeenNthCalledWith(1, true);
        expect(mockSetLoading).toHaveBeenNthCalledWith(2, false);
    });

    it('turns loading off again when tutorial initialization fails during demo bootstrap', async () => {
        mockInitTutorial.mockImplementationOnce(() => {
            throw new Error('tutorial failed');
        });

        const {result} = renderHook(() => useAuth());

        await expect(
            act(async () => {
                await result.current.actions.demoTry();
            }),
        ).rejects.toThrow('tutorial failed');

        expect(mockSetLoading).toHaveBeenNthCalledWith(1, true);
        expect(mockSetLoading).toHaveBeenNthCalledWith(2, false);
        expect(AuthAPI.demoStart).not.toHaveBeenCalled();
    });

    it('syncs the api client token before navigating after demo bootstrap', async () => {
        vi.mocked(AuthAPI.demoStart).mockResolvedValueOnce({
            accessToken: 'demo-token',
            accountResDto: {
                accountId: 12,
                nurseId: 34,
                wardId: 56,
            },
        } as never);

        const {result} = renderHook(() => useAuth());

        await act(async () => {
            await result.current.actions.demoTry();
        });

        expect(useAuthStore.getState()).toMatchObject({
            accountMe: null,
            accessToken: 'demo-token',
            accountId: 12,
            nurseId: 34,
            wardId: 56,
            isAuth: true,
            isDemoExpired: false,
        });
        expect(setAccessTokenMock).toHaveBeenCalledWith('demo-token');
        expect(mockNavigate).toHaveBeenCalled();
        expect(setAccessTokenMock.mock.invocationCallOrder[0]).toBeLessThan(mockNavigate.mock.invocationCallOrder[0]);
    });
});
