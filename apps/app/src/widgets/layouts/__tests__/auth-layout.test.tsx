import {MemoryRouter, Route, Routes} from 'react-router';
import {describe, expect, it, vi, beforeEach} from 'vitest';
import useAuth from '@/features/auth';
import ROUTE from '@/shared/constant/path';
import {render, screen, waitFor} from '@/shared/util/test-utils';
import useInterval from '@/shared/util/useInterval';
import {AuthLayout} from '../auth-layout';

vi.mock('@/features/auth', () => ({
    default: vi.fn(),
}));

vi.mock('@/shared/util/useInterval', () => ({
    default: vi.fn(),
}));

const mockedUseAuth = vi.mocked(useAuth);
const mockedUseInterval = vi.mocked(useInterval);
const defaultHandleLogout = vi.fn();
const defaultSetDemoExpired = vi.fn();
const defaultStartDemoSignupTransition = vi.fn();

describe('AuthLayout', () => {
    beforeEach(() => {
        defaultHandleLogout.mockReset();
        defaultSetDemoExpired.mockReset();
        defaultStartDemoSignupTransition.mockReset();
        mockedUseInterval.mockReset();
        mockedUseAuth.mockReturnValue({
            state: {
                isAuth: true,
                isDemoExpired: false,
                accountMe: {
                    status: 'WARD_SELECT_PENDING',
                },
                demoStartDate: null,
            },
            actions: {
                handleLogout: defaultHandleLogout,
                setDemoExpired: defaultSetDemoExpired,
                startDemoSignupTransition: defaultStartDemoSignupTransition,
            },
        } as never);
    });

    it('redirects unauthenticated users to login before rendering protected routes', async () => {
        mockedUseAuth.mockReturnValue({
            state: {
                isAuth: false,
                isDemoExpired: false,
                accountMe: null,
                demoStartDate: null,
            },
            actions: {
                handleLogout: defaultHandleLogout,
                setDemoExpired: defaultSetDemoExpired,
                startDemoSignupTransition: defaultStartDemoSignupTransition,
            },
        } as never);

        render(
            <MemoryRouter initialEntries={[ROUTE.MAKE]}>
                <Routes>
                    <Route element={<AuthLayout />}>
                        <Route path={ROUTE.MAKE} element={<div>make page</div>} />
                    </Route>
                    <Route path={ROUTE.LOGIN} element={<div>login page</div>} />
                </Routes>
            </MemoryRouter>,
        );

        await waitFor(() => {
            expect(screen.getByText('login page')).toBeInTheDocument();
        });

        expect(screen.queryByText('make page')).not.toBeInTheDocument();
    });

    it('allows onboarding ward create preview route for onboarding accounts', async () => {
        render(
            <MemoryRouter initialEntries={[ROUTE.ONBOARDING_WARD_CREATE]}>
                <Routes>
                    <Route element={<AuthLayout />}>
                        <Route path={ROUTE.ONBOARDING_WARD_CREATE} element={<div>preview page</div>} />
                        <Route path={ROUTE.REGISTER} element={<div>register page</div>} />
                    </Route>
                </Routes>
            </MemoryRouter>,
        );

        await waitFor(() => {
            expect(screen.getByText('preview page')).toBeInTheDocument();
        });
        expect(screen.queryByText('register page')).not.toBeInTheDocument();
    });

    it('redirects onboarding accounts away from app routes to register', async () => {
        render(
            <MemoryRouter initialEntries={[ROUTE.MAKE]}>
                <Routes>
                    <Route element={<AuthLayout />}>
                        <Route path={ROUTE.MAKE} element={<div>make page</div>} />
                        <Route path={ROUTE.REGISTER} element={<div>register page</div>} />
                    </Route>
                </Routes>
            </MemoryRouter>,
        );

        await waitFor(() => {
            expect(screen.getByText('register page')).toBeInTheDocument();
        });

        expect(screen.queryByText('make page')).not.toBeInTheDocument();
    });

    it('keeps linked accounts on protected app routes', async () => {
        mockedUseAuth.mockReturnValue({
            state: {
                isAuth: true,
                isDemoExpired: false,
                accountMe: {
                    status: 'LINKED',
                },
                demoStartDate: null,
            },
            actions: {
                handleLogout: defaultHandleLogout,
                setDemoExpired: defaultSetDemoExpired,
                startDemoSignupTransition: defaultStartDemoSignupTransition,
            },
        } as never);

        render(
            <MemoryRouter initialEntries={[ROUTE.MAKE]}>
                <Routes>
                    <Route element={<AuthLayout />}>
                        <Route path={ROUTE.MAKE} element={<div>make page</div>} />
                        <Route path={ROUTE.REGISTER} element={<div>register page</div>} />
                    </Route>
                </Routes>
            </MemoryRouter>,
        );

        await waitFor(() => {
            expect(screen.getByText('make page')).toBeInTheDocument();
        });

        expect(screen.queryByText('register page')).not.toBeInTheDocument();
    });

    it('opens the demo conversion modal instead of logging out when demo time expires', async () => {
        mockedUseAuth.mockReturnValue({
            state: {
                isAuth: true,
                isDemoExpired: true,
                accountMe: {
                    status: 'DEMO',
                },
                demoStartDate: '2026-03-25T00:00:00.000Z',
            },
            actions: {
                handleLogout: defaultHandleLogout,
                setDemoExpired: defaultSetDemoExpired,
                startDemoSignupTransition: defaultStartDemoSignupTransition,
            },
        } as never);

        render(
            <MemoryRouter initialEntries={[ROUTE.MAKE]}>
                <Routes>
                    <Route element={<AuthLayout />}>
                        <Route path={ROUTE.MAKE} element={<div>make page</div>} />
                    </Route>
                </Routes>
            </MemoryRouter>,
        );

        expect(screen.getByRole('dialog')).toBeInTheDocument();
        expect(screen.getByText('회원가입하고 이어서 사용')).toBeInTheDocument();
        expect(defaultHandleLogout).not.toHaveBeenCalled();
    });
});
