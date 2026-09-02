import {MemoryRouter} from 'react-router';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import useAuth from '@/features/auth';
import i18n from '@/i18n';
import {WardAPI} from '@/shared/api';
import ROUTE from '@/shared/constant/path';
import {render, screen, userEvent} from '@/shared/util/test-utils';
import LandingPage from '../landing-page';

vi.mock('@/features/auth', () => ({
    default: vi.fn(),
}));

const mockedUseAuth = vi.mocked(useAuth);
const mockHandleLogout = vi.fn();
const mockHandleGetAccountMe = vi.fn();
const setPhoneDevice = (isPhone: boolean) => {
    Object.defineProperty(window.navigator, 'userAgent', {
        configurable: true,
        writable: true,
        value: isPhone
            ? 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1'
            : 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/140.0.0.0 Safari/537.36',
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
        window.history.replaceState(null, '', '/');
        window.localStorage.clear();
        await i18n.changeLanguage('ko');
        mockHandleGetAccountMe.mockReset();
        mockHandleLogout.mockReset();
        setPhoneDevice(false);
        mockUseAuthState(false);
    });

    it('renders logged-out landing actions', async () => {
        const user = userEvent.setup();

        render(
            <MemoryRouter initialEntries={[ROUTE.ROOT]}>
                <LandingPage />
            </MemoryRouter>,
        );

        expect(screen.getByRole('heading', {name: /교대 근무표,.*듀팅으로 더 간편하게/})).toBeInTheDocument();
        expect(screen.getByRole('link', {name: '로그인'})).toHaveAttribute('href', ROUTE.LOGIN);
        expect(screen.getByRole('link', {name: '회원가입'})).toHaveAttribute('href', ROUTE.SIGN_UP);
        expect(screen.getByRole('button', {name: '언어 선택'})).toBeInTheDocument();
        expect(screen.getByRole('link', {name: '웹에서 근무표 만들기'})).toHaveAttribute('href', `${ROUTE.LOGIN}?next=%2Fmake`);
        expect(screen.getByRole('link', {name: '근무표 관리자 웹'})).toHaveAttribute('href', '#web');
        expect(screen.getByRole('link', {name: '간호사 앱'})).toHaveAttribute('href', '#app');

        await user.click(screen.getByRole('button', {name: '언어 선택'}));
        expect(screen.getByRole('option', {name: 'English'})).toHaveAttribute('aria-selected', 'false');

        await user.click(screen.getByRole('option', {name: 'English'}));

        expect(await screen.findByRole('button', {name: 'Select language'})).toHaveAttribute('aria-expanded', 'false');
    });

    it('links the App Store button to the localized iOS listing', async () => {
        render(
            <MemoryRouter initialEntries={[ROUTE.ROOT]}>
                <LandingPage />
            </MemoryRouter>,
        );

        const appStoreLinks = screen.getAllByRole('link', {name: 'App Store'});

        expect(appStoreLinks.length).toBeGreaterThan(0);
        expect(appStoreLinks[0]).toHaveAttribute(
            'href',
            'https://apps.apple.com/kr/app/dutying-%E7%9C%8B%E8%AD%B7%E5%B8%AB%E3%82%B7%E3%83%95%E3%83%88%E7%AE%A1%E7%90%86/id6804144827',
        );
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        expect(screen.getAllByRole('link', {name: 'Google Play'})[0]).toHaveAttribute(
            'href',
            'https://play.google.com/store/apps/details?id=ai.dutying.app',
        );
    });

    it.each([
        ['ko', '/img/landing-hero-kr.webp'],
        ['ja', '/img/landing-hero-jp.webp'],
        ['en', '/img/landing-hero-en.webp'],
        ['zh', '/img/landing-hero-cn.webp'],
        ['th', '/img/landing-hero-en.webp'],
        ['vi', '/img/landing-hero-en.webp'],
    ])('uses the localized desktop hero image for %s', async (language, expectedSrc) => {
        await i18n.changeLanguage(language);

        render(
            <MemoryRouter initialEntries={[ROUTE.ROOT]}>
                <LandingPage />
            </MemoryRouter>,
        );

        expect(document.querySelector('picture[aria-hidden="true"] img')).toHaveAttribute('src', expectedSrc);
    });

    it.each([
        ['ko', '/img/landing-work-schedule-2.webp'],
        ['ja', '/img/landing-work-schedule-jp.webp'],
        ['en', '/img/landing-work-schedule-en.webp'],
        ['zh', '/img/landing-work-schedule-cn.webp'],
        ['th', '/img/landing-work-schedule-th.webp'],
        ['vi', '/img/landing-work-schedule-vn.webp'],
    ])('uses the localized work schedule image for %s', async (language, expectedSrc) => {
        await i18n.changeLanguage(language);

        render(
            <MemoryRouter initialEntries={[ROUTE.ROOT]}>
                <LandingPage />
            </MemoryRouter>,
        );

        const imageSources = Array.from(document.querySelectorAll('img')).map((image) => image.getAttribute('src'));

        expect(imageSources).toContain(expectedSrc);
    });

    it.each([
        ['ko', '/img/124.webp'],
        ['ja', '/img/124-ja.webp'],
        ['en', '/img/124-en.webp'],
    ])('uses the localized AI feature image for %s', async (language, expectedSrc) => {
        await i18n.changeLanguage(language);

        render(
            <MemoryRouter initialEntries={[ROUTE.ROOT]}>
                <LandingPage />
            </MemoryRouter>,
        );

        const imageSources = Array.from(document.querySelectorAll('img')).map((image) => image.getAttribute('src'));

        expect(imageSources).toContain(expectedSrc);
    });

    it.each([
        ['ko', '/img/image-1002.webp'],
        ['ja', '/img/image-1002-ja.webp'],
        ['en', '/img/image-1002-en.webp'],
    ])('uses the localized ward feature image for %s', async (language, expectedSrc) => {
        await i18n.changeLanguage(language);

        render(
            <MemoryRouter initialEntries={[ROUTE.ROOT]}>
                <LandingPage />
            </MemoryRouter>,
        );

        const imageSources = Array.from(document.querySelectorAll('img')).map((image) => image.getAttribute('src'));

        expect(imageSources).toContain(expectedSrc);
    });

    it.each([
        ['ko', '/img/temp.webp', false],
        ['ja', '/img/temp-ja.webp', true],
        ['en', '/img/temp-en.webp', true],
    ])('uses the localized app section image for %s', async (language, expectedSrc, shouldCompact) => {
        await i18n.changeLanguage(language);

        render(
            <MemoryRouter initialEntries={[ROUTE.ROOT]}>
                <LandingPage />
            </MemoryRouter>,
        );

        const imageSources = Array.from(document.querySelectorAll('img')).map((image) => image.getAttribute('src'));
        const appSectionImage = document.querySelector(`img[src="${expectedSrc}"]`);

        expect(imageSources).toContain(expectedSrc);
        expect(appSectionImage).toHaveClass(shouldCompact ? 'landing-app-section__image--compact' : 'landing-app-section__image');

        if (!shouldCompact) {
            expect(appSectionImage).not.toHaveClass('landing-app-section__image--compact');
        }
    });

    it.each([
        ['ko', '/img/213213123123.webp'],
        ['ja', '/img/213213123123-ja.webp'],
        ['en', '/img/213213123123-en.webp'],
    ])('uses the localized app home feature image for %s', async (language, expectedSrc) => {
        await i18n.changeLanguage(language);

        render(
            <MemoryRouter initialEntries={[ROUTE.ROOT]}>
                <LandingPage />
            </MemoryRouter>,
        );

        const imageSources = Array.from(document.querySelectorAll('img')).map((image) => image.getAttribute('src'));

        expect(imageSources).toContain(expectedSrc);
    });

    it.each([
        ['ko', '/img/image-991.webp', '/img/image-992.webp'],
        ['ja', '/img/image-991-ja.webp', '/img/image-992-ja.webp'],
        ['en', '/img/image-991-en.webp', '/img/image-992-en.webp'],
    ])('uses the localized app home secondary images for %s', async (language, expectedSquareSrc, expectedWideSrc) => {
        await i18n.changeLanguage(language);

        render(
            <MemoryRouter initialEntries={[ROUTE.ROOT]}>
                <LandingPage />
            </MemoryRouter>,
        );

        const imageSources = Array.from(document.querySelectorAll('img')).map((image) => image.getAttribute('src'));

        expect(imageSources).toContain(expectedSquareSrc);
        expect(imageSources).toContain(expectedWideSrc);
    });

    it.each([
        ['ko', '/img/ward-schedule.webp', false],
        ['ja', '/img/ward-schedule-ja.webp', true],
        ['en', '/img/ward-schedule-en.webp', true],
    ])('uses the localized app ward feature image for %s', async (language, expectedSrc, shouldCompact) => {
        await i18n.changeLanguage(language);

        render(
            <MemoryRouter initialEntries={[ROUTE.ROOT]}>
                <LandingPage />
            </MemoryRouter>,
        );

        const imageSources = Array.from(document.querySelectorAll('img')).map((image) => image.getAttribute('src'));
        const wardImage = document.querySelector(`img[src="${expectedSrc}"]`);

        expect(imageSources).toContain(expectedSrc);
        expect(wardImage).toHaveClass(shouldCompact ? 'w-[80%]' : 'w-full');
    });

    it.each([
        ['ko', '/img/12223.webp'],
        ['ja', '/img/12223-ja.webp'],
        ['en', '/img/12223-en.webp'],
    ])('uses the localized app community feature image for %s', async (language, expectedSrc) => {
        await i18n.changeLanguage(language);

        render(
            <MemoryRouter initialEntries={[ROUTE.ROOT]}>
                <LandingPage />
            </MemoryRouter>,
        );

        const imageSources = Array.from(document.querySelectorAll('img')).map((image) => image.getAttribute('src'));

        expect(imageSources).toContain(expectedSrc);
    });

    it.each([
        ['ko', '/img/image-987.webp'],
        ['ja', '/img/image-987-ja.webp'],
        ['en', '/img/image-987-en.webp'],
    ])('uses the localized web schedule image for %s', async (language, expectedSrc) => {
        await i18n.changeLanguage(language);

        render(
            <MemoryRouter initialEntries={[ROUTE.ROOT]}>
                <LandingPage />
            </MemoryRouter>,
        );

        const imageSources = Array.from(document.querySelectorAll('img')).map((image) => image.getAttribute('src'));

        expect(imageSources).toContain(expectedSrc);
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
        expect(screen.queryByRole('link', {name: '회원가입'})).not.toBeInTheDocument();
        expect(screen.queryByRole('link', {name: '마이페이지'})).not.toBeInTheDocument();
        expect(screen.getByRole('button', {name: '언어 선택'})).toBeInTheDocument();
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

    it('renders profile modal account fields while ward profile is still loading', async () => {
        const pendingWardRequest = new Promise<never>(() => undefined);
        const getWardSpy = vi.spyOn(WardAPI, 'getWard').mockImplementation(() => pendingWardRequest);

        mockUseAuthState(true, {
            accountId: 7,
            email: 'linked@example.com',
            isManager: false,
            name: '김연결',
            nurseId: 77,
            phoneNum: '01012345678',
            profileImgUrl: '',
            shiftTeamId: 3,
            status: 'LINKED',
            wardId: 24,
        });

        const user = userEvent.setup();

        render(
            <MemoryRouter initialEntries={[ROUTE.ROOT]}>
                <LandingPage />
            </MemoryRouter>,
        );

        await user.click(screen.getByRole('button', {name: '프로필 메뉴'}));
        await user.click(screen.getByRole('menuitem', {name: '마이페이지'}));

        expect(getWardSpy).toHaveBeenCalledWith(24);
        expect(screen.getByRole('dialog', {name: '마이페이지'})).toBeInTheDocument();
        expect(screen.queryByText('프로필 정보를 준비하고 있어요')).not.toBeInTheDocument();
        expect(screen.getByLabelText('이름')).toHaveValue('김연결');
        expect(screen.getByLabelText('전화번호')).toHaveValue('01012345678');

        getWardSpy.mockRestore();
    });

    it('shows app-only landing content on a phone device', () => {
        setPhoneDevice(true);

        render(
            <MemoryRouter initialEntries={[ROUTE.ROOT]}>
                <LandingPage />
            </MemoryRouter>,
        );

        expect(screen.getByRole('heading', {name: /듀팅에서 바로 확인해요/})).toBeInTheDocument();
        expect(screen.getByRole('heading', {name: /간호사에게 꼭 필요한 기능을\s*듀팅에 담았어요/})).toBeInTheDocument();
        expect(screen.queryByRole('button', {name: /PC 버전으로 보기/})).not.toBeInTheDocument();
        expect(screen.queryByRole('link', {name: '근무표 관리자 웹'})).not.toBeInTheDocument();
        expect(screen.queryByRole('link', {name: /웹에서 근무표 만들기/})).not.toBeInTheDocument();
        expect(screen.queryByRole('link', {name: '로그인'})).not.toBeInTheDocument();
        expect(screen.queryByRole('link', {name: '회원가입'})).not.toBeInTheDocument();
        expect(document.querySelector('main.landing-main--web-fixed')).not.toBeInTheDocument();
    });

    it('ignores desktop landing preference on a phone device', () => {
        setPhoneDevice(true);
        window.localStorage.setItem('dutying:landing-view-preference', 'desktop');
        window.history.pushState(null, '', '/?view=desktop');

        render(
            <MemoryRouter initialEntries={[ROUTE.ROOT]}>
                <LandingPage />
            </MemoryRouter>,
        );

        expect(screen.getByRole('heading', {name: /듀팅에서 바로 확인해요/})).toBeInTheDocument();
        expect(screen.queryByRole('link', {name: '근무표 관리자 웹'})).not.toBeInTheDocument();
        expect(screen.queryByRole('button', {name: /모바일 버전으로 보기/})).not.toBeInTheDocument();
        expect(document.querySelector('meta[name="viewport"]')).toHaveAttribute('content', 'width=device-width, initial-scale=1.0');
    });

    it('keeps the full landing for a narrow desktop browser viewport', () => {
        setPhoneDevice(false);
        Object.defineProperty(window, 'innerWidth', {configurable: true, writable: true, value: 500});

        render(
            <MemoryRouter initialEntries={[ROUTE.ROOT]}>
                <LandingPage />
            </MemoryRouter>,
        );

        expect(screen.getByRole('heading', {name: /교대 근무표,.*듀팅으로 더 간편하게/})).toBeInTheDocument();
        expect(screen.getByRole('link', {name: '로그인'})).toBeInTheDocument();
        expect(screen.queryByRole('heading', {name: /듀팅에서 바로 확인해요/})).not.toBeInTheDocument();
        expect(document.querySelector('main.landing-main--web-fixed')).toBeInTheDocument();
    });
});
