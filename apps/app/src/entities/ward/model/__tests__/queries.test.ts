import {describe, expect, it, vi} from 'vitest';
import {WAITING_NURSES_REFETCH_INTERVAL_MS, wardQueryKeys, wardQueryOptions} from '../queries';

vi.mock('@/shared/api', () => ({
    WardAPI: {
        getWaitingNurses: vi.fn(),
    },
}));

describe('wardQueryOptions', () => {
    it('keeps waiting nurse requests fresh without polling in the background', () => {
        expect(wardQueryOptions.waitingNurses(1)).toMatchObject({
            queryKey: wardQueryKeys.waitingNurses(1),
            refetchInterval: WAITING_NURSES_REFETCH_INTERVAL_MS,
            refetchIntervalInBackground: false,
            refetchOnReconnect: true,
            refetchOnWindowFocus: true,
        });
        expect(WAITING_NURSES_REFETCH_INTERVAL_MS).toBe(30_000);
    });
});
