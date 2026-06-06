import {MemoryRouter} from 'react-router';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import useAuth from '@/features/auth';
import ROUTE from '@/shared/constant/path';
import {render, screen, userEvent} from '@/shared/util/test-utils';
import LandingPage from '../landing-page';

vi.mock('@/features/auth', () => ({
    default: vi.fn(),
}));

const mockedUseAuth = vi.mocked(useAuth);
const setPhoneViewport = (matches: boolean) => {
    Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: vi.fn().mockImplementation((query: string) => ({
            matches: query === '(max-width: 767px)' ? matches : false,
            media: query,
            onchange: null,
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
            addListener: vi.fn(),
            removeListener: vi.fn(),
            dispatchEvent: vi.fn(),
        })),
    });
};
const mockUseAuthState = (isAuth: boolean) => {
    mockedUseAuth.mockReturnValue({
        state: {isAuth},
        actions: {},
    } as ReturnType<typeof useAuth>);
};

describe('LandingPage', () => {
    beforeEach(() => {
        document.head.innerHTML = '<meta name="viewport" content="width=device-width, initial-scale=1.0" />';
        window.localStorage.clear();
        setPhoneViewport(false);
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

    it('shows app-only landing content on phone viewport', () => {
        setPhoneViewport(true);

        render(
            <MemoryRouter initialEntries={[ROUTE.ROOT]}>
                <LandingPage />
            </MemoryRouter>,
        );

        expect(screen.getByRole('heading', {name: /듀팅에서 바로 확인해요/})).toBeInTheDocument();
        expect(screen.getByRole('heading', {name: /간호사에게 꼭 필요한 기능을\s*듀팅에 담았어요/})).toBeInTheDocument();
        expect(screen.getByRole('button', {name: /PC 버전으로 보기/})).toBeInTheDocument();
        expect(screen.queryByRole('link', {name: '근무표 관리자 웹'})).not.toBeInTheDocument();
        expect(screen.queryByRole('link', {name: /웹에서 근무표 만들기/})).not.toBeInTheDocument();
    });

    it('keeps the desktop landing when a phone user selects PC version', async () => {
        setPhoneViewport(true);

        const user = userEvent.setup();

        render(
            <MemoryRouter initialEntries={[ROUTE.ROOT]}>
                <LandingPage />
            </MemoryRouter>,
        );

        await user.click(screen.getByRole('button', {name: /PC 버전으로 보기/}));

        expect(screen.getByRole('link', {name: '근무표 관리자 웹'})).toHaveAttribute('href', '#web');
        expect(screen.getByRole('button', {name: /모바일 버전으로 보기/})).toBeInTheDocument();
        expect(window.localStorage.getItem('dutying:landing-view-preference')).toBe('desktop');
        expect(document.querySelector('meta[name="viewport"]')).toHaveAttribute('content', 'width=1180');
    });
});
