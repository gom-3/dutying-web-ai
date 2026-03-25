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

    it('shows demo conversion guidance and keeps the requested next path', () => {
        render(
            <MemoryRouter initialEntries={[`${ROUTE.LOGIN}?reason=demo-expired&next=%2Fregister`]}>
                <Routes>
                    <Route path={ROUTE.LOGIN} element={<LoginPage />} />
                </Routes>
            </MemoryRouter>,
        );

        expect(screen.getByText('회원가입하고 이어서 사용하기')).toBeInTheDocument();

        const kakaoLink = screen.getByRole('link', {name: '카카오 계정으로 시작하기'});
        const url = new URL(kakaoLink.getAttribute('href') ?? '');

        expect(url.pathname).toBe('/oauth2/authorization/kakao');
        expect(url.searchParams.get('nextPageUrl')).toBe('https://app.dutying.net/register');
    });
});
