export const FRIEND_INVITE_PATH = '/app/friends/invite';
export const MOIM_INVITE_PATH = '/app/moim/invite';
export const FRIEND_INVITE_SCHEME_BASE = 'dutying://friends/invite';
export const MOIM_INVITE_SCHEME_BASE = 'dutying://moim/invite';
export const IOS_APP_STORE_URL = 'https://apps.apple.com/kr/app/id6804144827';

const stripTrailingSlash = (value: string) => value.replace(/\/+$/, '');

export const normalizeInviteSearch = (search: string | undefined) => {
    if (!search) return '';

    const trimmedSearch = search.trim();
    if (!trimmedSearch) return '';

    return trimmedSearch.startsWith('?') ? trimmedSearch : `?${trimmedSearch}`;
};

export const buildFriendInviteAppUrl = (appOrigin: string, search?: string) =>
    `${stripTrailingSlash(appOrigin)}${FRIEND_INVITE_PATH}${normalizeInviteSearch(search)}`;

export const buildMoimInviteAppUrl = (appOrigin: string, search?: string) =>
    `${stripTrailingSlash(appOrigin)}${MOIM_INVITE_PATH}${normalizeInviteSearch(search)}`;

export const buildFriendInviteSchemeUrl = (search?: string) => `${FRIEND_INVITE_SCHEME_BASE}${normalizeInviteSearch(search)}`;

export const buildMoimInviteSchemeUrl = (search?: string) => `${MOIM_INVITE_SCHEME_BASE}${normalizeInviteSearch(search)}`;
