import qs from 'qs';
import ROUTE from '@/shared/constant/path';

export const ACCESS_TOKEN_QUERY_KEYS = ['accessToken', 'access_token', 'token', 'adminAccessToken', 'jwt'];

let capturedOAuthRedirectPayload: Record<string, unknown> | null = null;

const getHashQueryString = (hash: string) => {
    const normalizedHash = hash.replace(/^#/, '');

    if (!normalizedHash) return '';

    if (normalizedHash.startsWith('?')) return normalizedHash.slice(1);

    const queryIndex = normalizedHash.indexOf('?');

    return queryIndex >= 0 ? normalizedHash.slice(queryIndex + 1) : normalizedHash;
};
const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const getCurrentRedirectQuery = () => {
    if (typeof window === 'undefined') return {};

    const hashQuery = qs.parse(getHashQueryString(window.location.hash));
    const searchQuery = qs.parse(window.location.search, {ignoreQueryPrefix: true});

    return {
        ...hashQuery,
        ...searchQuery,
    };
};

export const readStoredOAuthRedirectPayload = () => {
    return capturedOAuthRedirectPayload;
};

export const clearStoredOAuthRedirectPayload = () => {
    capturedOAuthRedirectPayload = null;
};

export const getOAuthRedirectQuery = () => ({
    ...(readStoredOAuthRedirectPayload() ?? {}),
    ...getCurrentRedirectQuery(),
});

export const captureOAuthRedirectPayload = () => {
    if (typeof window === 'undefined') return;

    if (window.location.pathname !== ROUTE.REDIRECT) return;

    if (!window.location.search && !window.location.hash) return;

    const payload = getCurrentRedirectQuery();

    if (Object.keys(payload).length === 0) return;

    capturedOAuthRedirectPayload = isRecord(payload) ? payload : null;

    window.history.replaceState(window.history.state, document.title, window.location.pathname);
};
