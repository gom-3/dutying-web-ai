import {afterEach, describe, expect, it, vi} from 'vitest';
import {withTimeout} from '../with-timeout';

describe('withTimeout', () => {
    afterEach(() => {
        vi.useRealTimers();
    });

    it('resolves when the wrapped promise completes before the timeout', async () => {
        await expect(withTimeout(Promise.resolve('done'), 1000)).resolves.toBe('done');
    });

    it('rejects when the wrapped promise does not complete before the timeout', async () => {
        vi.useFakeTimers();

        const result = withTimeout(new Promise(() => undefined), 1000, 'too_slow');
        const assertion = expect(result).rejects.toThrow('too_slow');

        await vi.advanceTimersByTimeAsync(1000);

        await assertion;
    });
});
