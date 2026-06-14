import {MemoryRouter, Route, Routes} from 'react-router';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import useAuth from '@/features/auth';
import ROUTE from '@/shared/constant/path';
import {render, screen, waitFor} from '@/shared/util/test-utils';
import {NotAuthLayout} from '../not-auth-layout';

vi.mock('@/features/auth', () => ({
    default: vi.fn(),
}));

const mockedUseAuth = vi.mocked(useAuth);

describe('NotAuthLayout', () => {
    beforeEach(() => {
        mockedUseAuth.mockReset();
    });

    it('redirects authenticated users to home instead of root', async () => {
        mockedUseAuth.mockReturnValue({
            state: {
                isAuth: true,
                _loaded: true,
            },
        } as never);

        render(
            <MemoryRouter initialEntries={[ROUTE.LOGIN]}>
                <Routes>
                    <Route element={<NotAuthLayout />}>
                        <Route path={ROUTE.LOGIN} element={<div>login page</div>} />
                    </Route>
                    <Route path={ROUTE.HOME} element={<div>home page</div>} />
                    <Route path={ROUTE.ROOT} element={<div>root page</div>} />
                </Routes>
            </MemoryRouter>,
        );

        await waitFor(() => {
            expect(screen.getByText('home page')).toBeInTheDocument();
        });

        expect(screen.queryByText('login page')).not.toBeInTheDocument();
        expect(screen.queryByText('root page')).not.toBeInTheDocument();
    });

    it('redirects authenticated users to the requested next path', async () => {
        mockedUseAuth.mockReturnValue({
            state: {
                isAuth: true,
                _loaded: true,
            },
        } as never);

        render(
            <MemoryRouter initialEntries={[`${ROUTE.LOGIN}?next=%2Fregister%3FsocialSignup%3D1`]}>
                <Routes>
                    <Route element={<NotAuthLayout />}>
                        <Route path={ROUTE.LOGIN} element={<div>login page</div>} />
                    </Route>
                    <Route path={ROUTE.REGISTER} element={<div>register page</div>} />
                    <Route path={ROUTE.MAKE} element={<div>make page</div>} />
                </Routes>
            </MemoryRouter>,
        );

        await waitFor(() => {
            expect(screen.getByText('register page')).toBeInTheDocument();
        });

        expect(screen.queryByText('login page')).not.toBeInTheDocument();
        expect(screen.queryByText('make page')).not.toBeInTheDocument();
    });

    it('waits for persisted auth hydration before rendering the public route', () => {
        mockedUseAuth.mockReturnValue({
            state: {
                isAuth: false,
                _loaded: false,
            },
        } as never);

        render(
            <MemoryRouter initialEntries={[ROUTE.LOGIN]}>
                <Routes>
                    <Route element={<NotAuthLayout />}>
                        <Route path={ROUTE.LOGIN} element={<div>login page</div>} />
                    </Route>
                </Routes>
            </MemoryRouter>,
        );

        expect(screen.queryByText('login page')).not.toBeInTheDocument();
    });
});
