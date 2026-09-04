import {MemoryRouter, useLocation} from 'react-router-dom';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import ROUTE from '@/shared/constant/path';
import {render, screen, waitFor} from '@/shared/util/test-utils';
import {Router} from '../Router';

vi.mock('@/features/auth', () => ({
    default: () => ({
        state: {
            accountMe: null,
            accountMeStatus: 'idle',
            accessToken: null,
            isAuth: false,
            wardId: null,
            _loaded: true,
        },
        actions: {
            handleGetAccountMe: () => undefined,
            handleLogout: () => undefined,
        },
    }),
}));

vi.mock('@/pages/landing', () => ({
    default: () => <div>renewed landing route</div>,
}));

const LocationProbe = () => {
    const location = useLocation();

    return <div data-testid="location">{location.pathname}</div>;
};
const setPhoneDevice = (isPhone: boolean) => {
    Object.defineProperty(window.navigator, 'userAgent', {
        configurable: true,
        writable: true,
        value: isPhone
            ? 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1'
            : 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/140.0.0.0 Safari/537.36',
    });
};

describe('Router', () => {
    beforeEach(() => {
        setPhoneDevice(false);
    });

    it('renders the renewed landing directly at the www root', async () => {
        render(
            <MemoryRouter initialEntries={[ROUTE.ROOT]}>
                <Router />
            </MemoryRouter>,
        );

        expect(await screen.findByText('renewed landing route')).toBeInTheDocument();
    });

    it.each([ROUTE.LANDING_EN, ROUTE.LANDING_JA, ROUTE.LANDING_ZH, ROUTE.LANDING_TH, ROUTE.LANDING_VI])(
        'renders the current production landing at %s',
        async (path) => {
            render(
                <MemoryRouter initialEntries={[path]}>
                    <Router />
                    <LocationProbe />
                </MemoryRouter>,
            );

            await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent(path));
            expect(await screen.findByText('renewed landing route')).toBeInTheDocument();
        },
    );

    it('redirects phone visitors away from auth routes to the landing page', async () => {
        setPhoneDevice(true);

        render(
            <MemoryRouter initialEntries={[ROUTE.LOGIN]}>
                <Router />
                <LocationProbe />
            </MemoryRouter>,
        );

        await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent(/^\/$/));

        expect(screen.getByText('renewed landing route')).toBeInTheDocument();
    });

    it('keeps legal routes public for desktop visitors', async () => {
        render(
            <MemoryRouter initialEntries={[ROUTE.PRIVACY]}>
                <Router />
                <LocationProbe />
            </MemoryRouter>,
        );

        await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent(ROUTE.PRIVACY));

        expect(await screen.findByRole('heading', {name: '개인정보 처리방침'})).toBeInTheDocument();
        expect(screen.getByText('3. Google 사용자 데이터 처리')).toBeInTheDocument();
    });

    it('keeps legal routes public for phone visitors', async () => {
        setPhoneDevice(true);

        render(
            <MemoryRouter initialEntries={[ROUTE.TERMS]}>
                <Router />
                <LocationProbe />
            </MemoryRouter>,
        );

        await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent(ROUTE.TERMS));

        expect(await screen.findByRole('heading', {name: '이용약관'})).toBeInTheDocument();
    });

    it('keeps service status routes available for phone visitors', async () => {
        setPhoneDevice(true);

        render(
            <MemoryRouter initialEntries={[ROUTE.RENEWAL]}>
                <Router />
                <LocationProbe />
            </MemoryRouter>,
        );

        await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent(ROUTE.RENEWAL));

        expect(await screen.findByRole('heading', {name: '곧 새로운 경험이 찾아와요'})).toBeInTheDocument();
    });

    it('renders oauth errors instead of falling through to not found', async () => {
        render(
            <MemoryRouter
                initialEntries={[
                    `${ROUTE.OAUTH_ERROR}?error=${encodeURIComponent('소셜 로그인 제공자를 사용할 수 없습니다.')}&errorCode=OAUTH_PROVIDER_UNAVAILABLE`,
                ]}
            >
                <Router />
            </MemoryRouter>,
        );

        expect(await screen.findByRole('heading', {name: '소셜 로그인에 실패했어요'})).toBeInTheDocument();
        expect(screen.getByText('소셜 로그인 제공자를 사용할 수 없습니다.')).toBeInTheDocument();
        expect(screen.getByText('OAUTH_PROVIDER_UNAVAILABLE')).toBeInTheDocument();
        expect(screen.queryByText('페이지를 찾을 수 없음')).not.toBeInTheDocument();
    });

    it('keeps friend invite fallback available for phone visitors', async () => {
        setPhoneDevice(true);

        render(
            <MemoryRouter initialEntries={[`${ROUTE.FRIEND_INVITE}?code=UVWB2T`]}>
                <Router />
                <LocationProbe />
            </MemoryRouter>,
        );

        await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent(ROUTE.FRIEND_INVITE));

        expect(await screen.findByRole('heading', {name: /친구와 근무 일정을\s+함께 확인해요/})).toBeInTheDocument();
        expect(screen.getByText('UVWB2T')).toBeInTheDocument();
        expect(screen.getByRole('link', {name: '듀팅 앱에서 친구 추가하기'})).toHaveAttribute(
            'href',
            'dutying://friends/invite?code=UVWB2T',
        );
        expect(screen.getByRole('link', {name: 'App Store'})).toHaveAttribute(
            'href',
            'https://apps.apple.com/us/app/dutying-nurse-shift-calendar/id6804144827',
        );
        expect(screen.getByRole('link', {name: 'Google Play'})).toHaveAttribute(
            'href',
            'https://play.google.com/store/apps/details?id=ai.dutying.app&hl=en&gl=US',
        );
    });

    it('keeps moim invite fallback available for phone visitors', async () => {
        setPhoneDevice(true);

        render(
            <MemoryRouter initialEntries={[`${ROUTE.MOIM_INVITE}?code=PXZ7XE`]}>
                <Router />
                <LocationProbe />
            </MemoryRouter>,
        );

        await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent(ROUTE.MOIM_INVITE));

        expect(await screen.findByRole('heading', {name: /모임 멤버와 일정을\s+함께 확인해요/})).toBeInTheDocument();
        expect(screen.getByText('모임 코드')).toBeInTheDocument();
        expect(screen.getByText('PXZ7XE')).toBeInTheDocument();
        expect(screen.getByRole('link', {name: '듀팅 앱에서 모임 초대 확인하기'})).toHaveAttribute(
            'href',
            'dutying://moim/invite?code=PXZ7XE',
        );
    });

    it.each([
        {
            name: '널톡 게시글',
            path: '/app/nultalk/posts/123',
            heading: '듀팅 앱에서 게시글을 확인해주세요',
        },
        {
            name: '병동 게시글',
            path: '/app/wards/7/board/posts/12',
            heading: '듀팅 앱에서 게시글을 확인해주세요',
        },
        {
            name: '듀팅 공지',
            path: '/app/notice/5',
            heading: '듀팅 앱에서 공지를 확인해주세요',
        },
    ])('keeps the $name fallback available for phone visitors', async ({path, heading}) => {
        setPhoneDevice(true);

        render(
            <MemoryRouter initialEntries={[path]}>
                <Router />
                <LocationProbe />
            </MemoryRouter>,
        );

        await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent(path));

        expect(await screen.findByRole('heading', {name: heading})).toBeInTheDocument();
        expect(screen.getByRole('link', {name: '듀팅 앱에서 열기'})).toHaveAttribute('href', `https://app.dutying.ai${path}`);
        await waitFor(() => expect(document.head.querySelector('meta[name="robots"]')).toHaveAttribute('content', 'noindex, nofollow'));
    });
});
