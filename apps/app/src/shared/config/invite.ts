export const INVITE_PATH_BY_KIND = {
    friend: '/app/friends/invite',
    moim: '/app/moim/invite',
} as const;
export const INVITE_SCHEME_BASE_BY_KIND = {
    friend: 'dutying://friends/invite',
    moim: 'dutying://moim/invite',
} as const;
export const FRIEND_INVITE_PATH = INVITE_PATH_BY_KIND.friend;
export const MOIM_INVITE_PATH = INVITE_PATH_BY_KIND.moim;
export const FRIEND_INVITE_APP_ORIGIN = 'https://app.dutying.ai';
export const FRIEND_INVITE_SCHEME_BASE = INVITE_SCHEME_BASE_BY_KIND.friend;
export const MOIM_INVITE_SCHEME_BASE = INVITE_SCHEME_BASE_BY_KIND.moim;
export const IOS_APP_STORE_URL = 'https://apps.apple.com/kr/app/id6804144827';
export const ANDROID_PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=ai.dutying.app';

export type TInviteKind = keyof typeof INVITE_PATH_BY_KIND;

const stripTrailingSlash = (value: string) => value.replace(/\/+$/, '');

export const normalizeInviteSearch = (search: string | undefined) => {
    if (!search) return '';

    const trimmedSearch = search.trim();
    if (!trimmedSearch) return '';

    return trimmedSearch.startsWith('?') ? trimmedSearch : `?${trimmedSearch}`;
};

export const buildInviteAppUrl = (kind: TInviteKind, search?: string) =>
    `${stripTrailingSlash(FRIEND_INVITE_APP_ORIGIN)}${INVITE_PATH_BY_KIND[kind]}${normalizeInviteSearch(search)}`;

export const buildInviteSchemeUrl = (kind: TInviteKind, search?: string) =>
    `${INVITE_SCHEME_BASE_BY_KIND[kind]}${normalizeInviteSearch(search)}`;

export const buildFriendInviteAppUrl = (search?: string) => buildInviteAppUrl('friend', search);

export const buildMoimInviteAppUrl = (search?: string) => buildInviteAppUrl('moim', search);

export const buildFriendInviteSchemeUrl = (search?: string) => buildInviteSchemeUrl('friend', search);

export const buildMoimInviteSchemeUrl = (search?: string) => buildInviteSchemeUrl('moim', search);
