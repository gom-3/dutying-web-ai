import {act, renderHook} from '@testing-library/react';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {useConversationPolling} from '../use-conversation-polling';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());
describe('conversation outcome polling', () => {
    it('shows connection failure and clears it when the same lookup recovers', async () => {
        const refresh = vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValue(undefined);
        const {result} = renderHook(() => useConversationPolling(true, 1, refresh));

        await act(() => vi.advanceTimersByTimeAsync(3000));
        expect(result.current.issue).toBe('connection');
        await act(() => vi.advanceTimersByTimeAsync(3000));
        expect(result.current.issue).toBeNull();
        expect(refresh).toHaveBeenCalledTimes(2);
    });
    it('does not overlap a slow lookup, even on repeated manual retries', async () => {
        let finish!: () => void;

        const refresh = vi.fn(
            () =>
                new Promise<void>((resolve) => {
                    finish = resolve;
                }),
        );
        const {result, unmount} = renderHook(() => useConversationPolling(true, 1, refresh));

        await act(() => vi.advanceTimersByTimeAsync(3000));
        act(() => result.current.retry());
        await act(() => vi.advanceTimersByTimeAsync(12000));
        expect(refresh).toHaveBeenCalledOnce();
        unmount();
        await act(async () => finish());
        await act(() => vi.advanceTimersByTimeAsync(12000));
        expect(refresh).toHaveBeenCalledOnce();
    });
    it('explains the limit and lets the user restart checking without executing a new request', async () => {
        const refresh = vi.fn().mockResolvedValue(undefined);
        const {result} = renderHook(() => useConversationPolling(true, 1, refresh));

        await act(() => vi.advanceTimersByTimeAsync(300000));
        expect(refresh).toHaveBeenCalledTimes(100);
        expect(result.current.issue).toBe('timeout');
        await act(() => vi.advanceTimersByTimeAsync(9000));
        expect(refresh).toHaveBeenCalledTimes(100);
        act(() => result.current.retry());
        await act(() => vi.advanceTimersByTimeAsync(1));
        expect(refresh).toHaveBeenCalledTimes(101);
        expect(result.current.issue).toBeNull();
    });
});
