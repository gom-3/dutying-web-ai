import {MemoryRouter, Route, Routes} from 'react-router-dom';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import useRefresh, {REFRESH_DEMO_EXPIRED_REDIRECT_ERROR, REFRESH_UNAVAILABLE_ERROR} from '@/features/refresh';
import ROUTE from '@/shared/constant/path';
import {fireEvent, render, screen, waitFor} from '@/shared/util/test-utils';
import RefreshPage from '../index';

vi.mock('@/features/refresh', () => ({
    default: vi.fn(),
    REFRESH_DEMO_EXPIRED_REDIRECT_ERROR: 'refresh_demo_expired_redirect',
    REFRESH_UNAVAILABLE_ERROR: 'refresh_unavailable',
}));

vi.mock('@/shared/hook/use-typed-translation', () => ({
    useTypedTranslation: () => ({
        t: (key: string) => key,
    }),
}));

const mockedUseRefresh = vi.mocked(useRefresh);

describe('RefreshPage', () => {
    const refreshSpy = vi.fn();
    const logoutSpy = vi.fn();
    const replaceSpy = vi.fn();

    beforeEach(() => {
        refreshSpy.mockReset();
        logoutSpy.mockReset();
        replaceSpy.mockReset();
        mockedUseRefresh.mockReset();
        mockedUseRefresh.mockReturnValue({
            refresh: refreshSpy,
            logout: logoutSpy,
        } as never);
        Object.defineProperty(window, 'location', {
            configurable: true,
            value: {
                ...window.location,
                replace: replaceSpy,
            },
        });
    });

    it('redirects to the requested internal path after refresh succeeds', async () => {
        refreshSpy.mockResolvedValue(undefined);

        render(
            <MemoryRouter initialEntries={['/refresh?next=%2Fmember%3Ftab%3Dprofile']}>
                <Routes>
                    <Route path={ROUTE.REFRESH} element={<RefreshPage />} />
                </Routes>
            </MemoryRouter>,
        );

        await waitFor(() => {
            expect(replaceSpy).toHaveBeenCalledWith('/member?tab=profile');
        });
    });

    it('falls back to home when the next path is external', async () => {
        refreshSpy.mockResolvedValue(undefined);

        render(
            <MemoryRouter initialEntries={['/refresh?next=https%3A%2F%2Fevil.example%2Fphish']}>
                <Routes>
                    <Route path={ROUTE.REFRESH} element={<RefreshPage />} />
                </Routes>
            </MemoryRouter>,
        );

        await waitFor(() => {
            expect(replaceSpy).toHaveBeenCalledWith(ROUTE.HOME);
        });
    });

    it('falls back to home when the next path is protocol-relative', async () => {
        refreshSpy.mockResolvedValue(undefined);

        render(
            <MemoryRouter initialEntries={['/refresh?next=%2F%2Fevil.example%2Fphish']}>
                <Routes>
                    <Route path={ROUTE.REFRESH} element={<RefreshPage />} />
                </Routes>
            </MemoryRouter>,
        );

        await waitFor(() => {
            expect(replaceSpy).toHaveBeenCalledWith(ROUTE.HOME);
        });
    });

    it('returns to the landing root when refresh fails', async () => {
        refreshSpy.mockRejectedValue(new Error('expired'));

        render(
            <MemoryRouter initialEntries={['/refresh?next=%2Fmake']}>
                <Routes>
                    <Route path={ROUTE.REFRESH} element={<RefreshPage />} />
                </Routes>
            </MemoryRouter>,
        );

        await waitFor(() => {
            expect(replaceSpy).toHaveBeenCalledWith(ROUTE.ROOT);
        });
    });

    it('does not retry refresh when auth state changes recreate the refresh callback', async () => {
        let rejectRefresh: (error: Error) => void = () => undefined;

        const firstRefreshSpy = vi.fn(
            () =>
                new Promise((_resolve, reject) => {
                    rejectRefresh = reject;
                }),
        );
        const recreatedRefreshSpy = vi.fn();
        const refreshRoute = (
            <MemoryRouter initialEntries={['/refresh?next=%2F']}>
                <Routes>
                    <Route path={ROUTE.REFRESH} element={<RefreshPage />} />
                </Routes>
            </MemoryRouter>
        );

        mockedUseRefresh.mockReset();
        mockedUseRefresh.mockReturnValueOnce({
            refresh: firstRefreshSpy,
            logout: logoutSpy,
        } as never);
        mockedUseRefresh.mockReturnValue({
            refresh: recreatedRefreshSpy,
            logout: logoutSpy,
        } as never);

        const {rerender} = render(refreshRoute);

        rerender(refreshRoute);

        expect(firstRefreshSpy).toHaveBeenCalledTimes(1);
        expect(recreatedRefreshSpy).not.toHaveBeenCalled();

        rejectRefresh(new Error('expired'));

        await waitFor(() => {
            expect(replaceSpy).toHaveBeenCalledWith(ROUTE.ROOT);
        });
        expect(recreatedRefreshSpy).not.toHaveBeenCalled();
    });

    it('does not overwrite the demo-expired signup redirect when refresh already redirected', async () => {
        refreshSpy.mockRejectedValue(new Error(REFRESH_DEMO_EXPIRED_REDIRECT_ERROR));

        render(
            <MemoryRouter initialEntries={['/refresh?next=%2Fmake']}>
                <Routes>
                    <Route path={ROUTE.REFRESH} element={<RefreshPage />} />
                </Routes>
            </MemoryRouter>,
        );

        await waitFor(() => {
            expect(refreshSpy).toHaveBeenCalled();
        });

        expect(replaceSpy).not.toHaveBeenCalled();
    });

    it('shows a retryable error state and keeps the session when the refresh endpoint is unreachable', async () => {
        refreshSpy.mockRejectedValue(new Error(REFRESH_UNAVAILABLE_ERROR));

        render(
            <MemoryRouter initialEntries={['/refresh?next=%2Fmake']}>
                <Routes>
                    <Route path={ROUTE.REFRESH} element={<RefreshPage />} />
                </Routes>
            </MemoryRouter>,
        );

        await waitFor(() => {
            expect(screen.getByText('feature.auth.state.errorTitle')).toBeInTheDocument();
        });

        expect(replaceSpy).not.toHaveBeenCalled();
        expect(logoutSpy).not.toHaveBeenCalled();
        expect(refreshSpy).toHaveBeenCalledTimes(1);
    });

    it('retries the refresh from the error state and redirects once it succeeds', async () => {
        refreshSpy.mockRejectedValueOnce(new Error(REFRESH_UNAVAILABLE_ERROR)).mockResolvedValueOnce(undefined);

        render(
            <MemoryRouter initialEntries={['/refresh?next=%2Fmake']}>
                <Routes>
                    <Route path={ROUTE.REFRESH} element={<RefreshPage />} />
                </Routes>
            </MemoryRouter>,
        );

        await waitFor(() => {
            expect(screen.getByText('feature.auth.state.retry')).toBeInTheDocument();
        });

        fireEvent.click(screen.getByText('feature.auth.state.retry'));

        await waitFor(() => {
            expect(replaceSpy).toHaveBeenCalledWith('/make');
        });
        expect(refreshSpy).toHaveBeenCalledTimes(2);
        expect(logoutSpy).not.toHaveBeenCalled();
    });

    it('lets the user log out explicitly from the unreachable error state', async () => {
        refreshSpy.mockRejectedValue(new Error(REFRESH_UNAVAILABLE_ERROR));
        logoutSpy.mockResolvedValue(undefined);

        render(
            <MemoryRouter initialEntries={['/refresh?next=%2Fmake']}>
                <Routes>
                    <Route path={ROUTE.REFRESH} element={<RefreshPage />} />
                </Routes>
            </MemoryRouter>,
        );

        await waitFor(() => {
            expect(screen.getByText('feature.auth.state.logout')).toBeInTheDocument();
        });

        fireEvent.click(screen.getByText('feature.auth.state.logout'));

        expect(logoutSpy).toHaveBeenCalledTimes(1);
        expect(replaceSpy).not.toHaveBeenCalled();
    });
});
