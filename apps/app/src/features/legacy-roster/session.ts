import {createPersonalAccountSession} from '@/features/auth/model/personal-session';
import {RUNTIME_CONFIG} from '@/shared/config/runtime';
import ROUTE from '@/shared/constant/path';
import {createLegacyRosterApi} from './api';

export const isLegacyRosterReturn = (target?: string) => {
    if (!target) return false;

    try {
        const url = new URL(target, window.location.origin);

        return url.origin === window.location.origin && url.pathname === ROUTE.LEGACY_ROSTER && !url.search && !url.hash;
    } catch {
        return false;
    }
};
export const personalRosterLoginUrl = (provider: 'kakao' | 'apple') => {
    const url = new URL(`/oauth2/authorization/${provider}`, RUNTIME_CONFIG.serverUrl());

    url.searchParams.set('nextPageUrl', new URL(ROUTE.LEGACY_ROSTER, window.location.origin).toString());

    return url.toString();
};

/** Keep this short-lived token out of the administrator auth store, storage and URLs. */
async function createPersonalRosterSession() {
    const {account, client} = await createPersonalAccountSession();

    return {account, api: createLegacyRosterApi(client)};
}

export type TPersonalRosterSession = Awaited<ReturnType<typeof loadPersonalRosterSession>>;

let pendingSession: Promise<Awaited<ReturnType<typeof createPersonalRosterSession>>> | undefined;

export function loadPersonalRosterSession() {
    pendingSession ??= createPersonalRosterSession().finally(() => {
        pendingSession = undefined;
    });

    return pendingSession;
}
