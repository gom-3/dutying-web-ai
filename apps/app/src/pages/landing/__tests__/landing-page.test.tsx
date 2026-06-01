import {MemoryRouter} from 'react-router';
import {describe, expect, it} from 'vitest';
import ROUTE from '@/shared/constant/path';
import {render, screen} from '@/shared/util/test-utils';
import LandingPage from '../landing-page';

describe('LandingPage', () => {
    it('renders the landing page at the app root without redirecting', () => {
        render(
            <MemoryRouter initialEntries={[ROUTE.ROOT]}>
                <LandingPage />
            </MemoryRouter>,
        );

        expect(screen.getByRole('heading', {name: /교대 근무표,.*듀팅으로 더 간편하게/})).toBeInTheDocument();
        expect(screen.getAllByRole('link', {name: '로그인'})[0]).toHaveAttribute('href', ROUTE.LOGIN);
        expect(screen.getByRole('link', {name: '근무표 관리자 웹'})).toHaveAttribute('href', '#web');
        expect(screen.getByRole('link', {name: '간호사 앱'})).toHaveAttribute('href', '#app');
    });
});
