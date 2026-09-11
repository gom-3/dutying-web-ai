import {renderHook} from '@testing-library/react';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import useRefresh, {REFRESH_DEMO_EXPIRED_REDIRECT_ERROR, REFRESH_FAILED_ERROR, REFRESH_UNAVAILABLE_ERROR} from '../index';

const {mockAuthState, mockHandleLogin, mockHandleLogout, mockStartDemoSignupTransition, mockPost, mockToastError} = vi.hoisted(() => ({
    mockAuthState: {isDemoExpired: false},
    mockHandleLogin: vi.fn(),
    mockHandleLogout: vi.fn(),
    mockStartDemoSignupTransition: vi.fn(),
    mockPost: vi.fn(),
    mockToastError: vi.fn(),
}));

vi.mock('@/features/auth', () => ({
    default: () => ({
        state: mockAuthState,
        actions: {
            handleLogin: mockHandleLogin,
            handleLogout: mockHandleLogout,
            startDemoSignupTransition: mockStartDemoSignupTransition,
        },
    }),
}));

vi.mock('@/shared/api/client', () => ({
    default: {
        defaults: {headers: {common: {}}},
        post: (...args: unknown[]) => mockPost(...args),
    },
}));

vi.mock('react-hot-toast', () => ({
    default: {error: (...args: unknown[]) => mockToastError(...args)},
}));

vi.mock('@/shared/hook/use-typed-translation', () => ({
    useTypedTranslation: () => ({t: (key: string) => key}),
}));

const apiError = (code: number) => Object.assign(new Error(`status ${code}`), {code});
const flushRetries = async () => {
    // Backoff delays are 2s + 5s; advance past both so every retry attempt has run.
    await vi.advanceTimersByTimeAsync(2000);
    await vi.advanceTimersByTimeAsync(5000);
};

describe('useRefresh', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        vi.clearAllMocks();
        mockAuthState.isDemoExpired = false;
        mockHandleLogout.mockResolvedValue(undefined);
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('retries while the API is restarting and logs in with the refreshed token once it is back', async () => {
        mockPost
            .mockRejectedValueOnce(apiError(502))
            .mockRejectedValueOnce(apiError(-1))
            .mockResolvedValueOnce({data: {accessToken: 'fresh-token'}});

        const {result} = renderHook(() => useRefresh());
        const refreshPromise = result.current.refresh();

        await flushRetries();

        await expect(refreshPromise).resolves.toBe('fresh-token');
        expect(mockPost).toHaveBeenCalledTimes(3);
        expect(mockHandleLogin).toHaveBeenCalledWith('fresh-token', null, {preserveDemoStartDate: true});
        expect(mockHandleLogout).not.toHaveBeenCalled();
        expect(mockToastError).not.toHaveBeenCalled();
    });

    it('keeps the session and reports the API as unavailable when every retry fails transiently', async () => {
        mockPost.mockRejectedValue(apiError(503));

        const {result} = renderHook(() => useRefresh());
        const refreshPromise = result.current.refresh();
        const assertion = expect(refreshPromise).rejects.toThrow(REFRESH_UNAVAILABLE_ERROR);

        await flushRetries();
        await assertion;

        expect(mockPost).toHaveBeenCalledTimes(3);
        expect(mockHandleLogout).not.toHaveBeenCalled();
        expect(mockHandleLogin).not.toHaveBeenCalled();
        expect(mockToastError).not.toHaveBeenCalled();
    });

    it('keeps the session on a refresh timeout', async () => {
        mockPost.mockImplementation(() => new Promise(() => undefined));

        const {result} = renderHook(() => useRefresh());
        const refreshPromise = result.current.refresh();
        const assertion = expect(refreshPromise).rejects.toThrow(REFRESH_UNAVAILABLE_ERROR);

        // 3 attempts x 15s timeout + 7s of backoff.
        await vi.advanceTimersByTimeAsync(60000);
        await assertion;

        expect(mockPost).toHaveBeenCalledTimes(3);
        expect(mockHandleLogout).not.toHaveBeenCalled();
    });

    it('logs out without retrying when the refresh token is definitively rejected', async () => {
        mockPost.mockRejectedValue(apiError(401));

        const {result} = renderHook(() => useRefresh());

        await expect(result.current.refresh()).rejects.toThrow(REFRESH_FAILED_ERROR);

        expect(mockPost).toHaveBeenCalledTimes(1);
        expect(mockHandleLogout).toHaveBeenCalledTimes(1);
        expect(mockToastError).toHaveBeenCalledTimes(1);
    });

    it('logs out when the refresh token is expired (403)', async () => {
        mockPost.mockRejectedValue(apiError(403));

        const {result} = renderHook(() => useRefresh());

        await expect(result.current.refresh()).rejects.toThrow(REFRESH_FAILED_ERROR);

        expect(mockHandleLogout).toHaveBeenCalledTimes(1);
    });

    it('routes an expired demo session to signup only on a definitive rejection', async () => {
        mockAuthState.isDemoExpired = true;
        mockPost.mockRejectedValue(apiError(401));

        const {result} = renderHook(() => useRefresh());

        await expect(result.current.refresh()).rejects.toThrow(REFRESH_DEMO_EXPIRED_REDIRECT_ERROR);

        expect(mockStartDemoSignupTransition).toHaveBeenCalledTimes(1);
        expect(mockHandleLogout).not.toHaveBeenCalled();
    });
});
