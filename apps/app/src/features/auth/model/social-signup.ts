import ROUTE from '@/shared/constant/path';

export type TSocialSignupProvider = 'KAKAO' | 'APPLE' | 'LINE' | 'GOOGLE';

export type TSocialSignupProfile = {
    provider?: TSocialSignupProvider;
    name?: string;
    email?: string;
    profileImgUrl?: string;
    capturedAt: string;
};

const SOCIAL_SIGNUP_PROFILE_STORAGE_KEY = 'dutying.social-signup-profile';
const SOCIAL_SIGNUP_SEARCH_PARAM = 'socialSignup';
const SOCIAL_SIGNUP_REQUIRED_FLAGS = new Set(['true', '1', 'yes']);
const INCOMPLETE_ACCOUNT_STATUSES = new Set([
    'INITIAL',
    'NURSE_INFO_PENDING',
    'WARD_SELECT_PENDING',
    'WARD_ENTRY_PENDING',
    'WORKSPACE_SETUP_PENDING',
]);
const normalizeValue = (value: unknown) => (typeof value === 'string' && value.trim() ? value.trim() : undefined);
const normalizeProvider = (value: unknown): TSocialSignupProvider | undefined => {
    const provider = normalizeValue(value)?.toUpperCase();

    return provider === 'KAKAO' || provider === 'APPLE' || provider === 'LINE' || provider === 'GOOGLE' ? provider : undefined;
};
const getStringQueryValue = (query: Record<string, unknown>, keys: string[]) => {
    for (const key of keys) {
        const value = normalizeValue(query[key]);

        if (value) return value;
    }

    return undefined;
};

export const getIsSocialSignupRequired = (query: Record<string, unknown>) => {
    const explicitFlag = getStringQueryValue(query, ['socialSignupRequired', 'signupRequired', 'isNewAccount', 'requiresSignup']);

    if (explicitFlag && SOCIAL_SIGNUP_REQUIRED_FLAGS.has(explicitFlag.toLowerCase())) {
        return true;
    }

    const accountStatus = getStringQueryValue(query, ['accountStatus', 'status']);

    return accountStatus ? INCOMPLETE_ACCOUNT_STATUSES.has(accountStatus.toUpperCase()) : false;
};

export const getSocialSignupProfileFromQuery = (query: Record<string, unknown>): TSocialSignupProfile | null => {
    const provider = normalizeProvider(getStringQueryValue(query, ['provider', 'authProvider', 'socialProvider']));
    const name = getStringQueryValue(query, ['socialName', 'name']);
    const email = getStringQueryValue(query, ['socialEmail', 'email']);
    const profileImgUrl = getStringQueryValue(query, ['socialProfileImgUrl', 'profileImgUrl', 'picture']);

    if (!provider && !name && !email && !profileImgUrl) {
        return null;
    }

    return {
        provider,
        name,
        email,
        profileImgUrl,
        capturedAt: new Date().toISOString(),
    };
};

export const saveSocialSignupProfile = (profile: TSocialSignupProfile | null) => {
    if (!profile || typeof window === 'undefined') return;

    try {
        window.sessionStorage.setItem(SOCIAL_SIGNUP_PROFILE_STORAGE_KEY, JSON.stringify(profile));
    } catch {
        // The profile is a UX prefill only. If storage is unavailable, the server-backed account profile still drives signup.
    }
};

export const buildSocialSignupRegisterPath = () => `${ROUTE.REGISTER}?${SOCIAL_SIGNUP_SEARCH_PARAM}=1`;

export const getIsSocialSignupPath = (search: string) => {
    const queryString = search.includes('?') ? search.slice(search.indexOf('?') + 1) : search;
    const flag = new URLSearchParams(queryString).get(SOCIAL_SIGNUP_SEARCH_PARAM);

    return Boolean(flag && SOCIAL_SIGNUP_REQUIRED_FLAGS.has(flag.toLowerCase()));
};

export const readSocialSignupProfile = (): TSocialSignupProfile | null => {
    if (typeof window === 'undefined') return null;

    try {
        const raw = window.sessionStorage.getItem(SOCIAL_SIGNUP_PROFILE_STORAGE_KEY);

        return raw ? (JSON.parse(raw) as TSocialSignupProfile) : null;
    } catch {
        return null;
    }
};

export const clearSocialSignupProfile = () => {
    if (typeof window === 'undefined') return;

    try {
        window.sessionStorage.removeItem(SOCIAL_SIGNUP_PROFILE_STORAGE_KEY);
    } catch {
        // Ignore storage failures during cleanup.
    }
};
