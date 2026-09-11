import {describe, expect, it, vi} from 'vitest';
import {isSessionInvalidError, isTransientApiFailure, retryOnTransientFailure} from '../model/session-failure';

const apiError = (code: number) => Object.assign(new Error(`status ${code}`), {code});

describe('session failure classification', () => {
    it('treats only 401/403 as a definitive session rejection', () => {
        expect(isSessionInvalidError(apiError(401))).toBe(true);
        expect(isSessionInvalidError(apiError(403))).toBe(true);
        expect(isSessionInvalidError(apiError(502))).toBe(false);
        expect(isSessionInvalidError(apiError(-1))).toBe(false);
        expect(isSessionInvalidError(new Error('refresh_timeout'))).toBe(false);
        expect(isSessionInvalidError(new Error('boom'))).toBe(false);
    });

    it('treats network errors, gateway 5xx and timeouts as transient', () => {
        expect(isTransientApiFailure(apiError(-1))).toBe(true);
        expect(isTransientApiFailure(apiError(500))).toBe(true);
        expect(isTransientApiFailure(apiError(502))).toBe(true);
        expect(isTransientApiFailure(apiError(503))).toBe(true);
        expect(isTransientApiFailure(apiError(504))).toBe(true);
        expect(isTransientApiFailure(new Error('refresh_timeout'))).toBe(true);
        expect(isTransientApiFailure(new Error('account_bootstrap_timeout'))).toBe(true);
    });

    it('does not treat auth rejections or unknown errors as transient', () => {
        expect(isTransientApiFailure(apiError(401))).toBe(false);
        expect(isTransientApiFailure(apiError(403))).toBe(false);
        expect(isTransientApiFailure(apiError(400))).toBe(false);
        expect(isTransientApiFailure(new Error('boom'))).toBe(false);
        expect(isTransientApiFailure(undefined)).toBe(false);
    });
});

describe('retryOnTransientFailure', () => {
    it('retries transient failures with the configured backoff and resolves once the API is back', async () => {
        const sleep = vi.fn(() => Promise.resolve());
        const task = vi.fn().mockRejectedValueOnce(apiError(502)).mockRejectedValueOnce(apiError(-1)).mockResolvedValueOnce('token');

        await expect(retryOnTransientFailure(task, {delaysMs: [2000, 5000], sleep})).resolves.toBe('token');

        expect(task).toHaveBeenCalledTimes(3);
        expect(sleep.mock.calls).toEqual([[2000], [5000]]);
    });

    it('rethrows the last transient error after the retries are exhausted', async () => {
        const sleep = vi.fn(() => Promise.resolve());
        const task = vi.fn().mockRejectedValue(apiError(503));

        await expect(retryOnTransientFailure(task, {delaysMs: [1, 1], sleep})).rejects.toMatchObject({code: 503});
        expect(task).toHaveBeenCalledTimes(3);
    });

    it('does not retry a definitive 401/403 rejection', async () => {
        const sleep = vi.fn(() => Promise.resolve());
        const task = vi.fn().mockRejectedValue(apiError(401));

        await expect(retryOnTransientFailure(task, {sleep})).rejects.toMatchObject({code: 401});
        expect(task).toHaveBeenCalledTimes(1);
        expect(sleep).not.toHaveBeenCalled();
    });

    it('does not retry unknown errors', async () => {
        const task = vi.fn().mockRejectedValue(new Error('boom'));

        await expect(retryOnTransientFailure(task, {sleep: () => Promise.resolve()})).rejects.toThrow('boom');
        expect(task).toHaveBeenCalledTimes(1);
    });
});
