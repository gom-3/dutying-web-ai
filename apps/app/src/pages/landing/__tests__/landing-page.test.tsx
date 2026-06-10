import {MemoryRouter} from 'react-router';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import i18n from '@/i18n';
import useAuth from '@/features/auth';
import ROUTE from '@/shared/constant/path';
import {render, screen, userEvent} from '@/shared/util/test-utils';
import LandingPage from '../landing-page';

vi.mock('@/features/auth', () => ({
    default: vi.fn(),
}));

const mockedUseAuth = vi.mocked(useAuth);
const mockHandleLogout = vi.fn();
const mockHandleGetAccountMe = vi.fn();
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
const mockUseAuthState = (isAuth: boolean, accountMe: ReturnType<typeof useAuth>['state']['accountMe'] = null) => {
    mockedUseAuth.mockReturnValue({
        state: {
            accountMe,
            accountMeStatus: accountMe ? 'success' : 'idle',
            accessToken: null,
            isAuth,
            wardId: accountMe?.wardId ?? null,
            _loaded: true,
        },
        actions: {handleGetAccountMe: mockHandleGetAccountMe, handleLogout: mockHandleLogout},
    } as unknown as ReturnType<typeof useAuth>);
};

describe('LandingPage', () => {
    beforeEach(async () => {
        document.head.innerHTML = '<meta name="viewport" content="width=device-width, initial-scale=1.0" />';
        window.localStorage.clear();
        await i18n.changeLanguage('ko');
        mockHandleGetAccountMe.mockReset();
        mockHandleLogout.mockReset();
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

    it('shows profile menu actions instead of my page text when already authenticated', async () => {
        mockUseAuthState(true, {
            accountId: 1,
            email: 'admin@example.com',
            isManager: true,
            name: '김관리',
            nurseId: null,
            profileImgUrl: 'https://cdn.example.com/profile.png',
            shiftTeamId: null,
            status: 'LINKED',
            wardId: null,
        });

        const user = userEvent.setup();

        render(
            <MemoryRouter initialEntries={[ROUTE.ROOT]}>
                <LandingPage />
            </MemoryRouter>,
        );

        expect(screen.queryByRole('link', {name: '로그인'})).not.toBeInTheDocument();
        expect(screen.queryByRole('link', {name: '마이페이지'})).not.toBeInTheDocument();
        expect(screen.getByRole('img', {name: '김관리 프로필 이미지'})).toHaveAttribute('src', 'https://cdn.example.com/profile.png');

        const profileMenuButton = screen.getByRole('button', {name: '프로필 메뉴'});

        expect(profileMenuButton).toHaveAttribute('aria-expanded', 'false');

        await user.click(profileMenuButton);

        expect(profileMenuButton).toHaveAttribute('aria-expanded', 'true');

        const accountSettingsMenuItem = screen.getByRole('menuitem', {name: '마이페이지'});

        expect(accountSettingsMenuItem).not.toHaveAttribute('href');

        await user.click(accountSettingsMenuItem);

        expect(screen.getByRole('dialog', {name: '마이페이지'})).toBeInTheDocument();
        expect(screen.getByRole('heading', {name: '마이페이지', level: 1})).toBeInTheDocument();
        expect(screen.queryByText('기본 정보')).not.toBeInTheDocument();
        expect(screen.queryByText('이름과 연락처를 확인해요.')).not.toBeInTheDocument();

        await user.click(screen.getByRole('button', {name: '마이페이지 닫기'}));

        await user.click(profileMenuButton);

        await user.click(screen.getByRole('menuitem', {name: '로그아웃'}));

        expect(mockHandleLogout).toHaveBeenCalledWith(ROUTE.ROOT);
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
