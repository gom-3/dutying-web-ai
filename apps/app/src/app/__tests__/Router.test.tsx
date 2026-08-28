import {MemoryRouter, useLocation} from 'react-router-dom';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import ROUTE from '@/shared/constant/path';
import {render, screen, waitFor} from '@/shared/util/test-utils';
import {isMarketingSiteHost, Router} from '../Router';

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

    it('renders the embedded landing instead of redirecting the marketing host to itself', () => {
        expect(isMarketingSiteHost('www.dutying.ai')).toBe(true);
        expect(isMarketingSiteHost('app.dutying.ai')).toBe(false);
    });

    it('redirects phone visitors away from auth routes to the public marketing site', async () => {
        setPhoneDevice(true);

        render(
            <MemoryRouter initialEntries={[ROUTE.LOGIN]}>
                <Router />
                <LocationProbe />
            </MemoryRouter>,
        );

        await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent(/^\/$/));

        expect(screen.getByRole('link', {name: '듀팅 홈페이지로 이동'})).toHaveAttribute('href', 'https://www.dutying.ai');
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

    it('keeps friend invite fallback available for phone visitors', async () => {
        setPhoneDevice(true);

        render(
            <MemoryRouter initialEntries={[`${ROUTE.FRIEND_INVITE}?code=UVWB2T`]}>
                <Router />
                <LocationProbe />
            </MemoryRouter>,
        );

        await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent(ROUTE.FRIEND_INVITE));

        expect(await screen.findByRole('heading', {name: '듀팅 앱에서 초대를 열어주세요'})).toBeInTheDocument();
        expect(screen.getByText('UVWB2T')).toBeInTheDocument();
        expect(screen.getByRole('link', {name: '듀팅 앱에서 초대 열기'})).toHaveAttribute(
            'href',
            'https://app.dutying.ai/app/friends/invite?code=UVWB2T',
        );
        expect(screen.getByRole('link', {name: 'App Store에서 받기'})).toHaveAttribute(
            'href',
            'https://apps.apple.com/kr/app/id6466558189',
        );
        expect(screen.getByRole('link', {name: 'Google Play에서 받기'})).toHaveAttribute(
            'href',
            'https://play.google.com/store/apps/details?id=ai.dutying.app',
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

        expect(await screen.findByRole('heading', {name: '듀팅 앱에서 초대를 열어주세요'})).toBeInTheDocument();
        expect(screen.getByText('모임 초대')).toBeInTheDocument();
        expect(screen.getByText('모임 코드')).toBeInTheDocument();
        expect(screen.getByText('PXZ7XE')).toBeInTheDocument();
        expect(screen.getByRole('link', {name: '듀팅 앱에서 초대 열기'})).toHaveAttribute(
            'href',
            'https://app.dutying.ai/app/moim/invite?code=PXZ7XE',
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
