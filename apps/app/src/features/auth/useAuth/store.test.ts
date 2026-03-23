import {afterEach, describe, expect, it, vi} from 'vitest';

describe('useAuthStore', () => {
    afterEach(() => {
        localStorage.clear();
        vi.resetModules();
    });

    it('marks hydration as loaded even when persisted auth state is missing', async () => {
        localStorage.removeItem('useAuthStore');

        const {default: useAuthStore} = await import('./store');

        await vi.waitFor(() => {
            expect(useAuthStore.getState()._loaded).toBe(true);
        });
    });

    it('rehydrates persisted auth state and marks hydration as loaded', async () => {
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

        const {default: useAuthStore} = await import('./store');

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
    });
});
