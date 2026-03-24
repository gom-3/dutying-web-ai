import {MemoryRouter, Route, Routes} from 'react-router';
import {describe, expect, it, vi, beforeEach} from 'vitest';
import useAuth from '@/features/auth';
import ROUTE from '@/shared/constant/path';
import {render, screen, waitFor} from '@/shared/util/test-utils';
import {AuthLayout} from '../auth-layout';

vi.mock('@/features/auth', () => ({
    default: vi.fn(),
}));

vi.mock('@/shared/util/useInterval', () => ({
    default: vi.fn(),
}));

const mockedUseAuth = vi.mocked(useAuth);

describe('AuthLayout', () => {
    beforeEach(() => {
        mockedUseAuth.mockReturnValue({
            state: {
                isAuth: true,
                accountMe: {
                    status: 'WARD_SELECT_PENDING',
                },
                demoStartDate: null,
            },
            actions: {
                handleLogout: vi.fn(),
            },
        } as never);
    });

    it('redirects unauthenticated users to login before rendering protected routes', async () => {
        mockedUseAuth.mockReturnValue({
            state: {
                isAuth: false,
                accountMe: null,
                demoStartDate: null,
            },
            actions: {
                handleLogout: vi.fn(),
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
                accountMe: {
                    status: 'LINKED',
                },
                demoStartDate: null,
            },
            actions: {
                handleLogout: vi.fn(),
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
});
