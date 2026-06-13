import {MemoryRouter, Route, Routes, useLocation} from 'react-router';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import useAuth from '@/features/auth';
import type i18nDefault from '@/i18n';
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

vi.mock('@/shared/hook/use-typed-translation', async () => {
    const {default: i18n} = await vi.importActual<{default: typeof i18nDefault}>('@/i18n');

    return {
        useTypedTranslation: () => ({
            t: (key: string, values?: Record<string, string | number>) => i18n.t(key, values),
        }),
    };
});

const mockedUseAuth = vi.mocked(useAuth);
const mockedUseInterval = vi.mocked(useInterval);
const defaultHandleLogout = vi.fn();
const defaultSetDemoExpired = vi.fn();
const defaultStartDemoSignupTransition = vi.fn();
const CurrentLocation = () => {
    const location = useLocation();

    return <div>{`${location.pathname}${location.search}`}</div>;
};

describe('AuthLayout', () => {
    beforeEach(() => {
        defaultHandleLogout.mockReset();
        defaultSetDemoExpired.mockReset();
        defaultStartDemoSignupTransition.mockReset();
        mockedUseInterval.mockReset();
        mockedUseInterval.mockImplementation(() => undefined);
        mockedUseAuth.mockReturnValue({
            state: {
                isAuth: true,
                isDemoExpired: false,
                accessToken: 'token',
                accountMeStatus: 'success',
                accountMe: {
                    status: 'WARD_SELECT_PENDING',
                },
                demoStartDate: null,
                _loaded: true,
            },
            actions: {
                handleLogout: defaultHandleLogout,
                setDemoExpired: defaultSetDemoExpired,
                startDemoSignupTransition: defaultStartDemoSignupTransition,
            },
        } as never);
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('redirects unauthenticated users to login before rendering protected routes', async () => {
        mockedUseAuth.mockReturnValue({
            state: {
                isAuth: false,
                isDemoExpired: false,
                accessToken: null,
                accountMeStatus: 'idle',
                accountMe: null,
                demoStartDate: null,
                _loaded: true,
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

    it('preserves the social signup register URL when redirecting unauthenticated users to login', async () => {
        mockedUseAuth.mockReturnValue({
            state: {
                isAuth: false,
                isDemoExpired: false,
                accessToken: null,
                accountMeStatus: 'idle',
                accountMe: null,
                demoStartDate: null,
                _loaded: true,
            },
            actions: {
                handleLogout: defaultHandleLogout,
                setDemoExpired: defaultSetDemoExpired,
                startDemoSignupTransition: defaultStartDemoSignupTransition,
            },
        } as never);

        render(
            <MemoryRouter initialEntries={[`${ROUTE.REGISTER}?socialSignup=1`]}>
                <Routes>
                    <Route element={<AuthLayout />}>
                        <Route path={ROUTE.REGISTER} element={<div>register page</div>} />
                    </Route>
                    <Route path={ROUTE.LOGIN} element={<CurrentLocation />} />
                </Routes>
            </MemoryRouter>,
        );

        await waitFor(() => {
            expect(screen.getByText('/login?next=%2Fregister%3FsocialSignup%3D1')).toBeInTheDocument();
        });

        expect(screen.queryByText('register page')).not.toBeInTheDocument();
    });

    it('waits for persisted auth hydration before rendering protected routes', () => {
        mockedUseAuth.mockReturnValue({
            state: {
                isAuth: true,
                isDemoExpired: false,
                accessToken: null,
                accountMeStatus: 'idle',
                accountMe: null,
                demoStartDate: null,
                _loaded: false,
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

        expect(screen.getByText('로그인 상태를 확인하고 있어요')).toBeInTheDocument();
        expect(screen.queryByText('make page')).not.toBeInTheDocument();
        expect(screen.queryByText('login page')).not.toBeInTheDocument();
    });

    it('shows an account bootstrap loading state before protected routes render', async () => {
        const handleGetAccountMe = vi.fn().mockResolvedValue(undefined);

        mockedUseAuth.mockReturnValue({
            state: {
                isAuth: true,
                isDemoExpired: false,
                accessToken: 'token',
                accountMeStatus: 'loading',
                accountMe: null,
                demoStartDate: null,
                _loaded: true,
            },
            actions: {
                handleGetAccountMe,
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

        expect(screen.getByText('로그인 상태를 확인하고 있어요')).toBeInTheDocument();
        expect(screen.queryByText('make page')).not.toBeInTheDocument();
        await waitFor(() => {
            expect(handleGetAccountMe).toHaveBeenCalledTimes(1);
        });
    });

    it('shows retry and logout actions when account bootstrap fails', async () => {
        const handleGetAccountMe = vi.fn().mockRejectedValue(new Error('boom'));

        mockedUseAuth.mockReturnValue({
            state: {
                isAuth: true,
                isDemoExpired: false,
                accessToken: 'token',
                accountMeStatus: 'error',
                accountMe: null,
                demoStartDate: null,
                _loaded: true,
            },
            actions: {
                handleGetAccountMe,
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
                        <Route path={ROUTE.LOGIN} element={<div>login page</div>} />
                    </Route>
                </Routes>
            </MemoryRouter>,
        );

        expect(screen.getByText('로그인 상태를 확인하지 못했어요')).toBeInTheDocument();
        expect(screen.getByRole('button', {name: /다시 시도/})).toBeInTheDocument();
        screen.getByRole('button', {name: '로그아웃'}).click();

        await waitFor(() => {
            expect(defaultHandleLogout).toHaveBeenCalledWith(ROUTE.LOGIN);
        });
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
                accessToken: 'token',
                accountMeStatus: 'success',
                accountMe: {
                    status: 'LINKED',
                },
                demoStartDate: null,
                _loaded: true,
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

    it('renders a prominent demo session banner with remaining time for demo users', async () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-03-25T00:00:00.000Z'));

        mockedUseAuth.mockReturnValue({
            state: {
                isAuth: true,
                isDemoExpired: false,
                accessToken: 'token',
                accountMeStatus: 'success',
                accountMe: {
                    status: 'DEMO',
                },
                demoStartDate: '2026-03-24T23:31:00.000Z',
                _loaded: true,
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

        expect(screen.getByText('체험 계정')).toBeInTheDocument();
        expect(screen.getByText('회원가입 전환 필요')).toBeInTheDocument();
        expect(screen.getByText('지금은 체험용 임시 계정으로 근무표를 작성 중이에요.')).toBeInTheDocument();
        expect(screen.getByText('남은 시간')).toBeInTheDocument();
        expect(screen.getByText('30:00')).toBeInTheDocument();
        expect(screen.getByText('약 30분 남음')).toBeInTheDocument();
        expect(mockedUseInterval).toHaveBeenCalledWith(expect.any(Function), 1000);
    });

    it('marks the demo as expired immediately when the persisted demo start date is malformed', async () => {
        mockedUseAuth.mockReturnValue({
            state: {
                isAuth: true,
                isDemoExpired: false,
                accessToken: 'token',
                accountMeStatus: 'success',
                accountMe: {
                    status: 'DEMO',
                },
                demoStartDate: 'not-a-date',
                _loaded: true,
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

        await waitFor(() => {
            expect(defaultSetDemoExpired).toHaveBeenCalledWith(true);
        });
    });

    it('opens the demo conversion modal instead of logging out when demo time expires', async () => {
        mockedUseAuth.mockReturnValue({
            state: {
                isAuth: true,
                isDemoExpired: true,
                accessToken: 'token',
                accountMeStatus: 'success',
                accountMe: {
                    status: 'DEMO',
                },
                demoStartDate: '2026-03-25T00:00:00.000Z',
                _loaded: true,
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
