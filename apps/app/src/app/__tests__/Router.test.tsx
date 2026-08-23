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
    default: () => <div>mobile landing route</div>,
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

    it('redirects phone visitors away from auth routes to the landing page', async () => {
        setPhoneDevice(true);

        render(
            <MemoryRouter initialEntries={[ROUTE.LOGIN]}>
                <Router />
                <LocationProbe />
            </MemoryRouter>,
        );

        await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent(/^\/$/));

        expect(screen.getByText('mobile landing route')).toBeInTheDocument();
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
});
