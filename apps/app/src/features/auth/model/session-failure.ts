import type {TApiClientError} from '@/shared/api/error';

/**
 * Decides how an auth bootstrap / token refresh failure should be treated.
 *
 * - Session-invalid: the server definitively rejected the credentials (401/403). Only this may log out.
 * - Transient: the API was unreachable (network error, 5xx from nginx while the server restarts, timeout).
 *   These must never discard the stored session — retry with backoff, then surface a retryable state.
 */
export const TRANSIENT_RETRY_DELAYS_MS = [2000, 5000];

const NETWORK_ERROR_CODE = -1;
const TRANSIENT_HTTP_STATUSES = new Set([408, 429, 502, 503, 504]);
const getApiErrorCode = (error: unknown): number | undefined => {
    if (!(error instanceof Error)) return undefined;

    const code = (error as Partial<TApiClientError>).code;

    return typeof code === 'number' ? code : undefined;
};

export const isSessionInvalidError = (error: unknown) => {
    const code = getApiErrorCode(error);

    return code === 401 || code === 403;
};

export const isTransientApiFailure = (error: unknown) => {
    const code = getApiErrorCode(error);

    if (code === NETWORK_ERROR_CODE || (typeof code === 'number' && (code >= 500 || TRANSIENT_HTTP_STATUSES.has(code)))) {
        return true;
    }

    return error instanceof Error && code === undefined && /_timeout$/.test(error.message);
};

type TRetryOptions = {
    delaysMs?: number[];
    sleep?: (ms: number) => Promise<void>;
    onRetry?: (error: unknown, attempt: number) => void;
};

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Runs `task`, retrying only on transient failures. Any other error (401, 403, 4xx, unknown) is rethrown immediately.
 * The last transient error is rethrown once the delays are exhausted.
 */
export const retryOnTransientFailure = async <T>(task: () => Promise<T>, options: TRetryOptions = {}): Promise<T> => {
    const {delaysMs = TRANSIENT_RETRY_DELAYS_MS, sleep = defaultSleep, onRetry} = options;

    for (let attempt = 0; ; attempt += 1) {
        try {
            return await task();
        } catch (error) {
            const delayMs = delaysMs[attempt];

            if (!isTransientApiFailure(error) || delayMs === undefined) {
                throw error;
            }

            onRetry?.(error, attempt + 1);
            await sleep(delayMs);
        }
    }
};
