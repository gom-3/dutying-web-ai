import {Link, MemoryRouter, Route, Routes} from 'react-router';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import ROUTE from '@/shared/constant/path';
import {render, screen, userEvent, waitFor} from '@/shared/util/test-utils';
import type * as NavigationBarFoldStoreModule from '@/widgets/navigation-bar/navigation-bar-fold-store';
import {useNavigationBarFoldStore} from '@/widgets/navigation-bar/navigation-bar-fold-store';
import {MainLayout} from '../main-layout';

const mockUseQuery = vi.fn();
const mockAuthState = vi.hoisted(() => ({
    accessToken: null as string | null,
}));

vi.mock('@tanstack/react-query', async () => {
    const actual = await vi.importActual('@tanstack/react-query');

    return {
        ...actual,
        useQuery: (...args: unknown[]) => mockUseQuery(...args),
    };
});

vi.mock('@/features/auth', () => ({
    default: () => ({
        state: {
            accessToken: mockAuthState.accessToken,
            wardId: 10,
        },
    }),
}));

vi.mock('@/features/auth/model/admin-token', () => ({
    isWardAdminAccessToken: (accessToken?: string | null) => accessToken === 'ward-admin-token',
}));

vi.mock('@/widgets/notifications/notification-bell', () => ({
    NotificationBell: () => (
        <button type="button" aria-label="notification bell">
            bell
        </button>
    ),
}));

vi.mock('@/widgets/navigation-bar', async () => {
    const {useNavigationBarFoldStore} = await vi.importActual<typeof NavigationBarFoldStoreModule>(
        '@/widgets/navigation-bar/navigation-bar-fold-store',
    );

    type TMockNavigationBarProps = {
        compactMode?: boolean;
    };

    return {
        default: ({compactMode = false}: TMockNavigationBarProps) => {
            const isFold = useNavigationBarFoldStore((state) => state.isFold);
            const setFold = useNavigationBarFoldStore((state) => state.setFold);
            const isRenderedFolded = compactMode || isFold;

            return (
                <nav data-testid="navigation-bar" data-compact-mode={compactMode ? 'true' : 'false'}>
                    <span>{isRenderedFolded ? 'folded navigation' : 'expanded navigation'}</span>
                    {compactMode ? null : (
                        <button type="button" onClick={() => setFold(!isFold, 'user')}>
                            toggle navigation
                        </button>
                    )}
                </nav>
            );
        },
    };
});

vi.mock('@/widgets/ward-chat', () => ({
    default: () => null,
}));

const setViewportWidth = (width: number) => {
    Object.defineProperty(window, 'innerWidth', {
        configurable: true,
        value: width,
        writable: true,
    });
    window.dispatchEvent(new Event('resize'));
};

describe('MainLayout', () => {
    beforeEach(() => {
        mockUseQuery.mockReset();
        mockUseQuery.mockReturnValue({
            data: {
                hospitalName: '듀팅병원',
                name: '중환자실',
                code: 'ABC123',
            },
        });
        mockAuthState.accessToken = null;
        window.sessionStorage.clear();
        useNavigationBarFoldStore.getState().reset();
        setViewportWidth(1600);
    });

    it('opens the ward code guide immediately from onboarding-created navigation state', async () => {
        render(
            <MemoryRouter
                initialEntries={[
                    {
                        pathname: '/duty',
                        state: {
                            onboardingWardCreated: {
                                wardCode: 'NEW123',
                                wardTitle: '듀팅병원 신규병동',
                            },
                        },
                    },
                ]}
            >
                <Routes>
                    <Route element={<MainLayout />}>
                        <Route path="/duty" element={<div>duty page</div>} />
                    </Route>
                </Routes>
            </MemoryRouter>,
        );

        expect(await screen.findByRole('dialog')).toBeInTheDocument();
        expect(screen.getByText('NEW123')).toBeInTheDocument();
        expect(screen.getByText((content) => content.includes('듀팅병원 신규병동'))).toBeInTheDocument();
    });

    it('falls back to the one-time stored onboarding-created signal', async () => {
        window.sessionStorage.setItem('dutying:onboardingWardCreatedGuide', JSON.stringify(true));

        render(
            <MemoryRouter initialEntries={['/duty']}>
                <Routes>
                    <Route element={<MainLayout />}>
                        <Route path="/duty" element={<div>duty page</div>} />
                    </Route>
                </Routes>
            </MemoryRouter>,
        );

        expect(await screen.findByRole('dialog')).toBeInTheDocument();
        expect(screen.getByText('ABC123')).toBeInTheDocument();
        expect(window.sessionStorage.getItem('dutying:onboardingWardCreatedGuide')).toBeNull();

        await waitFor(() => {
            expect(screen.getByText('duty page')).toBeInTheDocument();
        });
    });

    it('folds the navigation by default on make/member workspaces below 1536px', async () => {
        setViewportWidth(1512);

        render(
            <MemoryRouter initialEntries={[ROUTE.MAKE]}>
                <Routes>
                    <Route element={<MainLayout />}>
                        <Route path={ROUTE.MAKE} element={<div>make page</div>} />
                    </Route>
                </Routes>
            </MemoryRouter>,
        );

        await waitFor(() => {
            expect(screen.getByText('folded navigation')).toBeInTheDocument();
        });
        expect(screen.getByTestId('navigation-bar')).toHaveAttribute('data-compact-mode', 'true');
        expect(screen.queryByRole('button', {name: 'toggle navigation'})).not.toBeInTheDocument();
    });

    it('positions the ward admin notification bell inside the make workspace frame', () => {
        mockAuthState.accessToken = 'ward-admin-token';

        render(
            <MemoryRouter initialEntries={[ROUTE.MAKE]}>
                <Routes>
                    <Route element={<MainLayout />}>
                        <Route path={ROUTE.MAKE} element={<div>make page</div>} />
                    </Route>
                </Routes>
            </MemoryRouter>,
        );

        const notificationBell = screen.getByRole('button', {name: 'notification bell'});
        const notificationFrame = notificationBell.parentElement;
        const notificationLayer = notificationFrame?.parentElement;

        expect(notificationLayer).toHaveClass('pointer-events-none', 'absolute', 'inset-x-0', 'top-4');
        expect(notificationFrame).toHaveClass('mx-auto', 'max-w-[1680px]', 'justify-end', 'px-3', 'lg:px-4', 'min-[1600px]:px-10');
    });

    it('keeps the navigation expanded on non-workspace pages at the same width', () => {
        setViewportWidth(1512);

        render(
            <MemoryRouter initialEntries={[ROUTE.BOARD]}>
                <Routes>
                    <Route element={<MainLayout />}>
                        <Route path={ROUTE.BOARD} element={<div>board page</div>} />
                    </Route>
                </Routes>
            </MemoryRouter>,
        );

        expect(screen.getByText('expanded navigation')).toBeInTheDocument();
        expect(screen.getByTestId('navigation-bar')).toHaveAttribute('data-compact-mode', 'false');
        expect(screen.getByRole('button', {name: 'toggle navigation'})).toBeInTheDocument();
    });

    it('keeps compact navigation controls hidden after moving from a compact workspace page to another page', async () => {
        setViewportWidth(1512);

        render(
            <MemoryRouter initialEntries={[ROUTE.MAKE]}>
                <Routes>
                    <Route element={<MainLayout />}>
                        <Route
                            path={ROUTE.MAKE}
                            element={
                                <div>
                                    <Link to={ROUTE.BOARD}>go board</Link>
                                    make page
                                </div>
                            }
                        />
                        <Route path={ROUTE.BOARD} element={<div>board page</div>} />
                    </Route>
                </Routes>
            </MemoryRouter>,
        );

        await waitFor(() => {
            expect(screen.getByText('folded navigation')).toBeInTheDocument();
        });

        await userEvent.click(screen.getByRole('link', {name: 'go board'}));

        expect(await screen.findByText('board page')).toBeInTheDocument();
        expect(screen.getByText('folded navigation')).toBeInTheDocument();
        expect(screen.getByTestId('navigation-bar')).toHaveAttribute('data-compact-mode', 'true');
        expect(screen.queryByRole('button', {name: 'toggle navigation'})).not.toBeInTheDocument();
    });

    it('switches to compact navigation controls when the navigation is folded on a small screen', async () => {
        setViewportWidth(1512);

        render(
            <MemoryRouter initialEntries={[ROUTE.BOARD]}>
                <Routes>
                    <Route element={<MainLayout />}>
                        <Route path={ROUTE.BOARD} element={<div>board page</div>} />
                    </Route>
                </Routes>
            </MemoryRouter>,
        );

        await userEvent.click(screen.getByRole('button', {name: 'toggle navigation'}));

        expect(screen.getByText('folded navigation')).toBeInTheDocument();
        expect(screen.getByTestId('navigation-bar')).toHaveAttribute('data-compact-mode', 'true');
        expect(screen.queryByRole('button', {name: 'toggle navigation'})).not.toBeInTheDocument();
    });

    it('folds the navigation on every page below 1280px', async () => {
        setViewportWidth(1279);

        render(
            <MemoryRouter initialEntries={[ROUTE.BOARD]}>
                <Routes>
                    <Route element={<MainLayout />}>
                        <Route path={ROUTE.BOARD} element={<div>board page</div>} />
                    </Route>
                </Routes>
            </MemoryRouter>,
        );

        await waitFor(() => {
            expect(screen.getByText('folded navigation')).toBeInTheDocument();
        });
        expect(screen.queryByRole('button', {name: 'toggle navigation'})).not.toBeInTheDocument();
    });

    it('keeps the ward settings scroll container stable across tab height changes', () => {
        render(
            <MemoryRouter initialEntries={[ROUTE.WARD_SETTINGS]}>
                <Routes>
                    <Route element={<MainLayout />}>
                        <Route path={ROUTE.WARD_SETTINGS} element={<div>ward settings page</div>} />
                    </Route>
                </Routes>
            </MemoryRouter>,
        );

        expect(screen.getByRole('main')).toHaveClass('overflow-y-scroll');
    });
});
