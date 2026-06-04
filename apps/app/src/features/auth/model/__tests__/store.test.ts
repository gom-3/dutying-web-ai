import {afterEach, describe, expect, it, vi} from 'vitest';

describe('useAuthStore', () => {
    afterEach(() => {
        localStorage.clear();
        vi.resetModules();
    });

    it('marks hydration as loaded even when persisted auth state is missing', async () => {
        localStorage.removeItem('useAuthStore');

        const {default: useAuthStore} = await import('../store');

        await vi.waitFor(() => {
            expect(useAuthStore.getState()._loaded).toBe(true);
        });
    });

    it('rehydrates persisted auth state and marks hydration as loaded', async () => {
        const setAccessToken = vi.fn();
        const setAdminAccessToken = vi.fn();

        vi.doMock('@/shared/api/client', () => ({
            setAccessToken,
            setAdminAccessToken,
        }));
        localStorage.setItem(
            'useAuthStore',
            JSON.stringify({
                state: {
                    isAuth: true,
                    accessToken: 'token',
                    accountId: 1,
                    nurseId: 2,
                    wardId: 3,
                    demoStartDate: null,
                },
                version: 0,
            }),
        );

        const {default: useAuthStore} = await import('../store');

        await vi.waitFor(() => {
            expect(useAuthStore.getState()).toMatchObject({
                isAuth: true,
                accessToken: 'token',
                accountId: 1,
                nurseId: 2,
                wardId: 3,
                _loaded: true,
            });
        });
        expect(setAccessToken).toHaveBeenCalledWith('token');
        expect(setAdminAccessToken).toHaveBeenCalledWith('');
    });

    it('rehydrates a persisted ward admin token into both api clients before marking loaded', async () => {
        const setAccessToken = vi.fn();
        const setAdminAccessToken = vi.fn();
        const adminToken = `header.${btoa(JSON.stringify({principalType: 'WARD_ADMIN'}))
            .replace(/\+/g, '-')
            .replace(/\//g, '_')
            .replace(/=+$/, '')}.signature`;

        vi.doMock('@/shared/api/client', () => ({
            setAccessToken,
            setAdminAccessToken,
        }));
        localStorage.setItem(
            'useAuthStore',
            JSON.stringify({
                state: {
                    isAuth: true,
                    accessToken: adminToken,
                    accountId: 1,
                    nurseId: null,
                    wardId: 306,
                    demoStartDate: null,
                },
                version: 0,
            }),
        );

        const {default: useAuthStore} = await import('../store');

        await vi.waitFor(() => {
            expect(useAuthStore.getState()._loaded).toBe(true);
        });
        expect(setAccessToken).toHaveBeenCalledWith(adminToken);
        expect(setAdminAccessToken).toHaveBeenCalledWith(adminToken);
    });

    it('marks hydration as loaded and falls back to safe defaults when persisted payload is malformed', async () => {
        localStorage.setItem('useAuthStore', '{invalid-json');

        const {default: useAuthStore} = await import('../store');

        await vi.waitFor(() => {
            expect(useAuthStore.getState()).toMatchObject({
                isAuth: false,
                accessToken: null,
                accountId: null,
                nurseId: null,
                wardId: null,
                demoStartDate: null,
                _loaded: true,
            });
        });
    });
});
