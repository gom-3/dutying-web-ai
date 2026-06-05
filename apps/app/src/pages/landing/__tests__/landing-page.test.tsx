import {MemoryRouter} from 'react-router';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import useAuth from '@/features/auth';
import ROUTE from '@/shared/constant/path';
import {render, screen} from '@/shared/util/test-utils';
import LandingPage from '../landing-page';

vi.mock('@/features/auth', () => ({
    default: vi.fn(),
}));

const mockedUseAuth = vi.mocked(useAuth);
const mockUseAuthState = (isAuth: boolean) => {
    mockedUseAuth.mockReturnValue({
        state: {isAuth},
        actions: {},
    } as ReturnType<typeof useAuth>);
};

describe('LandingPage', () => {
    beforeEach(() => {
        mockUseAuthState(false);
    });

    it('renders logged-out landing actions', () => {
        render(
            <MemoryRouter initialEntries={[ROUTE.ROOT]}>
                <LandingPage />
            </MemoryRouter>,
        );

        expect(screen.getByRole('heading', {name: /교대 근무표,.*듀팅으로 더 간편하게/})).toBeInTheDocument();
        expect(screen.getByRole('link', {name: '로그인'})).toHaveAttribute('href', ROUTE.LOGIN);
        expect(screen.getByRole('link', {name: '웹에서 근무표 만들기'})).toHaveAttribute('href', `${ROUTE.LOGIN}?next=%2Fmake`);
        expect(screen.getByRole('link', {name: '근무표 관리자 웹'})).toHaveAttribute('href', '#web');
        expect(screen.getByRole('link', {name: '간호사 앱'})).toHaveAttribute('href', '#app');
    });

    it('shows admin entry actions instead of login when already authenticated', () => {
        mockUseAuthState(true);

        render(
            <MemoryRouter initialEntries={[ROUTE.ROOT]}>
                <LandingPage />
            </MemoryRouter>,
        );

        expect(screen.queryByRole('link', {name: '로그인'})).not.toBeInTheDocument();
        expect(screen.getByRole('link', {name: '마이페이지'})).toHaveAttribute('href', ROUTE.PROFILE);
        expect(screen.getAllByRole('link', {name: '근무표 만들기'})[0]).toHaveAttribute('href', ROUTE.MAKE);
        expect(screen.queryByRole('link', {name: '웹에서 근무표 만들기'})).not.toBeInTheDocument();
    });
});
