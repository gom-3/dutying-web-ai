import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import useAuth from '@/features/auth';
import {clearSocialSignupProfile, readSocialSignupProfile} from '@/features/auth/model/social-signup';
import {render, waitFor} from '@/shared/util/test-utils';
import RedirectPage from '../redirect-page';

vi.mock('@/features/auth', () => ({
    default: vi.fn(),
}));

vi.mock('react-loading', () => ({
    __esModule: true,
    default: () => <div>spinner</div>,
}));

const mockedUseAuth = vi.mocked(useAuth);

describe('RedirectPage', () => {
    const handleLogin = vi.fn();

    afterEach(() => {
        vi.unstubAllEnvs();
    });

    beforeEach(() => {
        handleLogin.mockReset();
        clearSocialSignupProfile();
        mockedUseAuth.mockReset();
        mockedUseAuth.mockReturnValue({
            actions: {
                handleLogin,
            },
        } as never);

        vi.stubEnv('VITE_APP_PUBLIC_URL', 'https://app.dutying.net');
        window.history.replaceState({}, '', '/oauth2/redirect');
    });

    it('falls back when nextPageUrl points to the landing domain', async () => {
        window.history.replaceState(
            {},
            '',
            '/oauth2/redirect?accessToken=test-token&nextPageUrl=https%3A%2F%2Fdutying.net%2Frequest%3Fmonth%3D3',
        );

        render(<RedirectPage />);

        await waitFor(() => {
            expect(handleLogin).toHaveBeenCalledWith('test-token', '/make');
        });
    });

    it('preserves allowed app-domain nextPageUrl for login handler', async () => {
        window.history.replaceState(
            {},
            '',
            '/oauth2/redirect?accessToken=test-token&nextPageUrl=https%3A%2F%2Fapp.dutying.net%2Frequest%3Fmonth%3D3%23calendar',
        );

        render(<RedirectPage />);

        await waitFor(() => {
            expect(handleLogin).toHaveBeenCalledWith('test-token', '/request?month=3#calendar');
        });
    });

    it('routes new social accounts to onboarding and keeps the provider profile for prefill', async () => {
        window.history.replaceState(
            {},
            '',
            '/oauth2/redirect?accessToken=test-token&nextPageUrl=%2Fmake&socialSignupRequired=true&provider=KAKAO&socialName=Kim&socialEmail=kim%40dutying.net&socialProfileImgUrl=https%3A%2F%2Fcdn.example.com%2Fkim.png',
        );

        render(<RedirectPage />);

        await waitFor(() => {
            expect(handleLogin).toHaveBeenCalledWith('test-token', '/onboarding');
        });

        expect(readSocialSignupProfile()).toMatchObject({
            provider: 'KAKAO',
            name: 'Kim',
            email: 'kim@dutying.net',
            profileImgUrl: 'https://cdn.example.com/kim.png',
        });
    });

    it('does not trigger login without accessToken', () => {
        window.history.replaceState({}, '', '/oauth2/redirect?nextPageUrl=%2Frequest');

        render(<RedirectPage />);

        expect(handleLogin).not.toHaveBeenCalled();
    });
});
