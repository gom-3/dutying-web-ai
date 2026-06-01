import {describe, expect, it} from 'vitest';
import {getAccessTokenPrincipalType, isWardAdminAccessToken} from '../admin-token';
import {DEV_AUTH_BYPASS_TOKEN} from '../dev-auth-bypass';

const createJwt = (payload: Record<string, unknown>) =>
    `header.${btoa(JSON.stringify(payload)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')}.signature`;

describe('admin-token', () => {
    it('detects ward admin access tokens by principalType claim', () => {
        const accessToken = createJwt({principalType: 'WARD_ADMIN', wardAdminAccountId: 123});

        expect(getAccessTokenPrincipalType(accessToken)).toBe('WARD_ADMIN');
        expect(isWardAdminAccessToken(accessToken)).toBe(true);
    });

    it('rejects regular app account tokens for admin APIs', () => {
        const accessToken = createJwt({principalType: 'ACCOUNT', accountId: 123});

        expect(getAccessTokenPrincipalType(accessToken)).toBe('ACCOUNT');
        expect(isWardAdminAccessToken(accessToken)).toBe(false);
    });

    it('keeps the dev bypass token usable for local admin onboarding', () => {
        expect(isWardAdminAccessToken(DEV_AUTH_BYPASS_TOKEN)).toBe(true);
    });
});
