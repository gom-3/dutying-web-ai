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
export const DEEP_LINK_APP_ORIGIN = 'https://app.dutying.ai';
export const FRIEND_INVITE_APP_ORIGIN = DEEP_LINK_APP_ORIGIN;
export const FRIEND_INVITE_SCHEME_BASE = INVITE_SCHEME_BASE_BY_KIND.friend;
export const MOIM_INVITE_SCHEME_BASE = INVITE_SCHEME_BASE_BY_KIND.moim;
export const IOS_APP_STORE_URL_JA =
    'https://apps.apple.com/jp/app/dutying-%E7%9C%8B%E8%AD%B7%E5%B8%AB%E3%82%B7%E3%83%95%E3%83%88%E7%AE%A1%E7%90%86/id6804144827';
export const IOS_APP_STORE_URL_KO =
    'https://apps.apple.com/kr/app/dutying-%E7%9C%8B%E8%AD%B7%E5%B8%AB%E3%82%B7%E3%83%95%E3%83%88%E7%AE%A1%E7%90%86/id6804144827';
export const IOS_APP_STORE_URL_DEFAULT = 'https://apps.apple.com/us/app/dutying-nurse-shift-calendar/id6804144827';
export const IOS_APP_STORE_URL = IOS_APP_STORE_URL_DEFAULT;
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

export const resolveIosAppStoreUrl = (languages: readonly string[]) => {
    const normalizedLanguages = languages.map((language) => language.toLowerCase());

    if (normalizedLanguages.some((language) => language.startsWith('ja'))) return IOS_APP_STORE_URL_JA;
    if (normalizedLanguages.some((language) => language.startsWith('ko'))) return IOS_APP_STORE_URL_KO;

    return IOS_APP_STORE_URL_DEFAULT;
};
