import {describe, expect, it} from 'vitest';
import ROUTE from '@/shared/constant/path';
import {getLandingRedirectPath} from './landing-page-redirect';

describe('getLandingRedirectPath', () => {
    it('returns make for authenticated users', () => {
        expect(getLandingRedirectPath(true)).toBe(ROUTE.MAKE);
    });

    it('returns login for unauthenticated users', () => {
        expect(getLandingRedirectPath(false)).toBe(ROUTE.LOGIN);
    });
});
