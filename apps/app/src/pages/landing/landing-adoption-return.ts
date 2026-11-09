import {RUNTIME_CONFIG} from '@/shared/config/runtime';
import ROUTE from '@/shared/constant/path';
import {getIndexedMarketingLanguageFromPath, isNurseAppMarketingPath} from '@/shared/seo/marketing-locale';

export type TAdoptionDraft = {hospitalName: string; wardName: string; contact: string};

const STORAGE_KEY = 'dutying.landingAdoptionDraft';
const RETURN_KEY = 'landingAdoption';
const MAX_DRAFT_AGE_MS = 15 * 60 * 1000;

export function adoptionSignInUrl(provider: 'google' | 'kakao' | 'apple', pathname: string) {
    const url = new URL(`/oauth2/authorization/${provider}`, RUNTIME_CONFIG.serverUrl());
    // The existing personal OAuth route preserves a separate ward admin session for this callback path.
    const callback = new URL(ROUTE.LEGACY_ROSTER, window.location.origin);

    callback.searchParams.set(RETURN_KEY, pathname);
    url.searchParams.set('nextPageUrl', callback.toString());

    return url.toString();
}

export function getAdoptionReturnPath(target?: string) {
    if (!target) return undefined;

    try {
        const url = new URL(target, window.location.origin);
        const pathname = url.searchParams.get(RETURN_KEY);

        if (
            url.origin === window.location.origin &&
            url.pathname === ROUTE.LEGACY_ROSTER &&
            pathname &&
            getIndexedMarketingLanguageFromPath(pathname) &&
            !isNurseAppMarketingPath(pathname)
        )
            return `${pathname}#adoption`;
    } catch {
        // Ignore invalid OAuth targets.
    }

    return undefined;
}

export function saveAdoptionDraft(pathname: string, draft: TAdoptionDraft) {
    try {
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify({pathname, draft, expiresAt: Date.now() + MAX_DRAFT_AGE_MS}));
    } catch {
        // Sign-in is still possible in browsers that disable tab storage.
    }
}

export function takeAdoptionDraft(pathname: string): TAdoptionDraft | undefined {
    try {
        const value = sessionStorage.getItem(STORAGE_KEY);

        if (!value) return undefined;

        sessionStorage.removeItem(STORAGE_KEY);

        const saved = JSON.parse(value);
        const draft = saved?.draft;

        if (
            saved?.pathname === pathname &&
            saved.expiresAt > Date.now() &&
            typeof draft?.hospitalName === 'string' &&
            typeof draft.wardName === 'string' &&
            typeof draft.contact === 'string'
        )
            return draft;
    } catch {
        // A malformed or unavailable draft can be re-entered on the form.
    }

    return undefined;
}
