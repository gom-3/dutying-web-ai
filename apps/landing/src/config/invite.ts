export const FRIEND_INVITE_PATH = '/app/friends/invite';
export const MOIM_INVITE_PATH = '/app/moim/invite';
export const FRIEND_INVITE_SCHEME_BASE = 'dutying://friends/invite';
export const MOIM_INVITE_SCHEME_BASE = 'dutying://moim/invite';
export const IOS_APP_STORE_URL_JA =
    'https://apps.apple.com/jp/app/dutying-%E7%9C%8B%E8%AD%B7%E5%B8%AB%E3%82%B7%E3%83%95%E3%83%88%E7%AE%A1%E7%90%86/id6804144827';
export const IOS_APP_STORE_URL_KO =
    'https://apps.apple.com/kr/app/dutying-%E7%9C%8B%E8%AD%B7%E5%B8%AB%E3%82%B7%E3%83%95%E3%83%88%E7%AE%A1%E7%90%86/id6804144827';
export const IOS_APP_STORE_URL_DEFAULT = 'https://apps.apple.com/us/app/dutying-nurse-shift-calendar/id6804144827';
export const IOS_APP_STORE_URL = IOS_APP_STORE_URL_DEFAULT;
export const ANDROID_PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=ai.dutying.app';

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

export const resolveIosAppStoreUrl = (languages: readonly string[]) => {
    const normalizedLanguages = languages.map((language) => language.toLowerCase());

    if (normalizedLanguages.some((language) => language.startsWith('ja'))) return IOS_APP_STORE_URL_JA;
    if (normalizedLanguages.some((language) => language.startsWith('ko'))) return IOS_APP_STORE_URL_KO;

    return IOS_APP_STORE_URL_DEFAULT;
};
