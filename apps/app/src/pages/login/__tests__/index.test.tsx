import type {ReactNode} from 'react';
import {MemoryRouter, Route, Routes} from 'react-router';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import ROUTE from '@/shared/constant/path';
import {render, screen} from '@/shared/util/test-utils';
import LoginPage from '../index';

vi.mock('react-responsive-carousel', () => ({
    Carousel: ({children}: {children: ReactNode}) => <div>{children}</div>,
}));

describe('LoginPage', () => {
    afterEach(() => {
        vi.unstubAllEnvs();
    });

    beforeEach(() => {
        vi.stubEnv('VITE_APP_PUBLIC_URL', 'https://app.dutying.net');
        vi.stubEnv('VITE_SERVER_URL', 'https://api.dutying.net');
    });

    it('renders sign-in as the default admin login page with a signup link', () => {
        render(
            <MemoryRouter initialEntries={[ROUTE.SIGN_IN]}>
                <Routes>
                    <Route path={ROUTE.SIGN_IN} element={<LoginPage />} />
                </Routes>
            </MemoryRouter>,
        );

        expect(screen.getByRole('heading', {name: '관리자 로그인'})).toBeInTheDocument();
        expect(screen.queryByLabelText('병원명 또는 기관명')).not.toBeInTheDocument();
        expect(screen.getByRole('link', {name: '회원가입'})).toHaveAttribute('href', ROUTE.SIGN_UP);
        expect(screen.getByRole('link', {name: '카카오로 계속하기'})).toBeInTheDocument();
    });

    it('renders sign-up as a separate account page and sends social signup to onboarding', () => {
        render(
            <MemoryRouter initialEntries={[`${ROUTE.SIGN_UP}?reason=demo-expired&next=%2Fregister`]}>
                <Routes>
                    <Route path={ROUTE.SIGN_UP} element={<LoginPage />} />
                </Routes>
            </MemoryRouter>,
        );

        expect(screen.getByText('체험 계정을 정식 계정으로 전환해요')).toBeInTheDocument();
        expect(screen.getByRole('heading', {name: '관리자 계정 만들기'})).toBeInTheDocument();
        expect(screen.getByLabelText('이메일')).toBeInTheDocument();
        expect(screen.queryByLabelText('병원명 또는 기관명')).not.toBeInTheDocument();
        expect(screen.getByRole('link', {name: '로그인'})).toHaveAttribute('href', ROUTE.SIGN_IN);

        const kakaoLink = screen.getByRole('link', {name: '카카오로 시작하기'});
        const url = new URL(kakaoLink.getAttribute('href') ?? '');

        expect(url.pathname).toBe('/oauth2/authorization/kakao');
        expect(url.searchParams.get('nextPageUrl')).toBe('https://app.dutying.net/onboarding');
    });
});
