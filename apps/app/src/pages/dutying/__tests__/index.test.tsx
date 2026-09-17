import {MemoryRouter} from 'react-router-dom';
import {describe, expect, it} from 'vitest';
import ROUTE from '@/shared/constant/path';
import {render, screen} from '@/shared/util/test-utils';
import DutyingPage from '../index';

describe('DutyingPage', () => {
    it('routes legal links through the preserved web paths', () => {
        render(
            <MemoryRouter>
                <DutyingPage />
            </MemoryRouter>,
        );

        expect(screen.getByRole('link', {name: /이용약관/})).toHaveAttribute('href', ROUTE.TERMS);
        expect(screen.getByRole('link', {name: /개인정보 처리방침/})).toHaveAttribute('href', ROUTE.PRIVACY);
    });
});
