import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import useAuth from '@/features/auth';
import {clearSocialSignupProfile, readSocialSignupProfile} from '@/features/auth/model/social-signup';
import i18n from '@/i18n';
import {render, screen, waitFor} from '@/shared/util/test-utils';
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
    const createJwt = (payload: Record<string, unknown>) =>
        `header.${btoa(JSON.stringify(payload)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')}.signature`;
    const adminToken = createJwt({principalType: 'WARD_ADMIN', wardAdminAccountId: 123});

    afterEach(() => {
        vi.unstubAllEnvs();
    });

    beforeEach(async () => {
        await i18n.changeLanguage('ko');
        handleLogin.mockReset();
        clearSocialSignupProfile();
        mockedUseAuth.mockReset();
        mockedUseAuth.mockReturnValue({
            state: {
                _loaded: true,
            },
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
            `/oauth2/redirect?accessToken=${adminToken}&nextPageUrl=https%3A%2F%2Fdutying.net%2Frequest%3Fmonth%3D3`,
        );

        render(<RedirectPage />);

        expect(screen.queryByLabelText('loading')).not.toBeInTheDocument();

        await waitFor(() => {
            expect(handleLogin).toHaveBeenCalledWith(adminToken, '/make');
        });
    });

    it('preserves allowed app-domain nextPageUrl for login handler', async () => {
        window.history.replaceState(
            {},
            '',
            `/oauth2/redirect?accessToken=${adminToken}&nextPageUrl=https%3A%2F%2Fapp.dutying.net%2Frequest%3Fmonth%3D3%23calendar`,
        );

        render(<RedirectPage />);

        await waitFor(() => {
            expect(handleLogin).toHaveBeenCalledWith(adminToken, '/request?month=3#calendar');
        });
    });

    it('accepts access tokens from the callback hash payload', async () => {
        window.history.replaceState({}, '', `/oauth2/redirect#access_token=${adminToken}&next=%2Frequest`);

        render(<RedirectPage />);

        await waitFor(() => {
            expect(handleLogin).toHaveBeenCalledWith(adminToken, '/request');
        });
    });

    it('maps legacy onboarding callback targets to register', async () => {
        window.history.replaceState({}, '', `/oauth2/redirect?accessToken=${adminToken}&nextPageUrl=%2Fonboarding`);

        render(<RedirectPage />);

        await waitFor(() => {
            expect(handleLogin).toHaveBeenCalledWith(adminToken, '/register');
        });
    });

    it('routes new social accounts to register and keeps the provider profile for prefill', async () => {
        window.history.replaceState(
            {},
            '',
            `/oauth2/redirect?accessToken=${adminToken}&nextPageUrl=%2Fmake&socialSignupRequired=true&provider=KAKAO&socialName=Kim&socialEmail=kim%40dutying.net&socialProfileImgUrl=https%3A%2F%2Fcdn.example.com%2Fkim.png`,
        );

        render(<RedirectPage />);

        await waitFor(() => {
            expect(handleLogin).toHaveBeenCalledWith(adminToken, '/register?socialSignup=1');
        });

        expect(readSocialSignupProfile()).toMatchObject({
            provider: 'KAKAO',
            name: 'Kim',
            email: 'kim@dutying.net',
            profileImgUrl: 'https://cdn.example.com/kim.png',
        });
    });

    it('marks social signup even when the provider profile is not included in the redirect query', async () => {
        window.history.replaceState({}, '', `/oauth2/redirect?accessToken=${adminToken}&nextPageUrl=%2Fmake&socialSignupRequired=true`);

        render(<RedirectPage />);

        await waitFor(() => {
            expect(handleLogin).toHaveBeenCalledWith(adminToken, '/register?socialSignup=1');
        });

        expect(readSocialSignupProfile()).toMatchObject({
            capturedAt: expect.any(String),
        });
    });

    it('treats a social signup nextPageUrl marker as a social signup even without backend flags', async () => {
        window.history.replaceState({}, '', `/oauth2/redirect?accessToken=${adminToken}&nextPageUrl=%2Fregister%3FsocialSignup%3D1`);

        render(<RedirectPage />);

        await waitFor(() => {
            expect(handleLogin).toHaveBeenCalledWith(adminToken, '/register?socialSignup=1');
        });

        expect(readSocialSignupProfile()).toMatchObject({
            capturedAt: expect.any(String),
        });
    });

    it('routes social onboarding callbacks through the contact step before ward selection', async () => {
        window.history.replaceState(
            {},
            '',
            `/oauth2/redirect?accessToken=${adminToken}&nextPageUrl=%2Fonboarding&provider=KAKAO&socialName=Kim`,
        );

        render(<RedirectPage />);

        await waitFor(() => {
            expect(handleLogin).toHaveBeenCalledWith(adminToken, '/register?socialSignup=1');
        });

        expect(readSocialSignupProfile()).toMatchObject({
            provider: 'KAKAO',
            name: 'Kim',
        });
    });

    it('waits for persisted auth hydration before applying the callback token', async () => {
        window.history.replaceState({}, '', `/oauth2/redirect?accessToken=${adminToken}&nextPageUrl=%2Frequest`);
        mockedUseAuth
            .mockReturnValueOnce({
                state: {
                    _loaded: false,
                },
                actions: {
                    handleLogin,
                },
            } as never)
            .mockReturnValue({
                state: {
                    _loaded: true,
                },
                actions: {
                    handleLogin,
                },
            } as never);

        const {rerender} = render(<RedirectPage />);

        expect(handleLogin).not.toHaveBeenCalled();

        rerender(<RedirectPage />);

        await waitFor(() => {
            expect(handleLogin).toHaveBeenCalledWith(adminToken, '/request');
        });
    });

    it('does not trigger login without accessToken', () => {
        window.history.replaceState({}, '', '/oauth2/redirect?nextPageUrl=%2Frequest');

        render(<RedirectPage />);

        expect(handleLogin).not.toHaveBeenCalled();
    });

    it('does not stay in the loading state when the callback has no token', async () => {
        window.history.replaceState({}, '', '/oauth2/redirect?nextPageUrl=%2Frequest');

        render(<RedirectPage />);

        expect(await screen.findByRole('alert')).toBeInTheDocument();
        expect(screen.queryByLabelText('loading')).not.toBeInTheDocument();
        expect(handleLogin).not.toHaveBeenCalled();
    });

    it('does not store a social callback token that is not a ward admin token', async () => {
        const regularToken = createJwt({sub: 'securityteam@kakao.com'});

        window.history.replaceState({}, '', `/oauth2/redirect?accessToken=${regularToken}&nextPageUrl=%2Fonboarding&provider=KAKAO`);

        render(<RedirectPage />);

        expect(await screen.findByText('소셜 로그인에 실패했어요')).toBeInTheDocument();
        expect(handleLogin).not.toHaveBeenCalled();
    });
});
