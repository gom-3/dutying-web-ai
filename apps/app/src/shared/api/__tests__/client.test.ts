import {describe, expect, it} from 'vitest';
import ROUTE from '@/shared/constant/path';
import {shouldRedirectToRefreshOnUnauthorized} from '../client';

describe('api client unauthorized redirect policy', () => {
    it('keeps credential auth failures on the current auth page', () => {
        expect(shouldRedirectToRefreshOnUnauthorized('/auth/admin/password/login', ROUTE.LOGIN)).toBe(false);
        expect(shouldRedirectToRefreshOnUnauthorized('/auth/admin/password/signup', ROUTE.SIGN_UP)).toBe(false);
    });

    it('does not redirect token lifecycle failures back into refresh', () => {
        expect(shouldRedirectToRefreshOnUnauthorized('/token/refresh', ROUTE.REFRESH)).toBe(false);
        expect(shouldRedirectToRefreshOnUnauthorized('/token/blacklist', ROUTE.PROFILE)).toBe(false);
    });

    it('redirects protected api failures to the refresh route', () => {
        expect(shouldRedirectToRefreshOnUnauthorized('/accounts/me', ROUTE.MAKE)).toBe(true);
        expect(shouldRedirectToRefreshOnUnauthorized('https://api.dutying.net/wards/1/nurses', ROUTE.MEMBER)).toBe(true);
    });
});
