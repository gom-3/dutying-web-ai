import type {TPreferredLanguage, TServiceRegion} from '@dutying/domain';

export const SUPPORTED_LANGUAGES = ['ko', 'ja', 'en', 'zh', 'th', 'vi'] as const satisfies readonly TPreferredLanguage[];
export const SUPPORTED_SERVICE_REGIONS = ['KR', 'JP', 'EN', 'CN', 'TH', 'VN'] as const satisfies readonly TServiceRegion[];

export const SERVICE_REGION_STORAGE_KEY = 'dutying.serviceRegion';

type TBcp47Locale = 'ko-KR' | 'ja-JP' | 'en-US' | 'zh-CN' | 'th-TH' | 'vi-VN';

const LANGUAGE_TO_LOCALE: Record<TPreferredLanguage, TBcp47Locale> = {
    ko: 'ko-KR',
    ja: 'ja-JP',
    en: 'en-US',
    zh: 'zh-CN',
    th: 'th-TH',
    vi: 'vi-VN',
};

const LANGUAGE_TO_REGION: Record<TPreferredLanguage, TServiceRegion> = {
    ko: 'KR',
    ja: 'JP',
    en: 'EN',
    zh: 'CN',
    th: 'TH',
    vi: 'VN',
};

const isSupportedLanguage = (value: string): value is TPreferredLanguage => SUPPORTED_LANGUAGES.includes(value as TPreferredLanguage);
const isSupportedServiceRegion = (value: string): value is TServiceRegion => SUPPORTED_SERVICE_REGIONS.includes(value as TServiceRegion);

export const normalizePreferredLanguage = (value?: string | null): TPreferredLanguage | undefined => {
    if (!value) return undefined;

    const language = value.split(/[-_]/)[0]?.toLowerCase();

    return language && isSupportedLanguage(language) ? language : undefined;
};

export const normalizeServiceRegion = (value?: string | null): TServiceRegion | undefined => {
    if (!value) return undefined;

    const region = value.toUpperCase();

    return isSupportedServiceRegion(region) ? region : undefined;
};

export const getLocaleForLanguage = (value?: string | null): TBcp47Locale => {
    const language = normalizePreferredLanguage(value) ?? 'en';

    return LANGUAGE_TO_LOCALE[language];
};

export const getDefaultServiceRegionForLanguage = (value?: string | null): TServiceRegion => {
    const language = normalizePreferredLanguage(value) ?? 'en';

    return LANGUAGE_TO_REGION[language];
};

export const getStoredServiceRegion = (): TServiceRegion | undefined => {
    if (typeof window === 'undefined') return undefined;

    return normalizeServiceRegion(window.localStorage.getItem(SERVICE_REGION_STORAGE_KEY));
};

export const setStoredServiceRegion = (value: TServiceRegion) => {
    window.localStorage.setItem(SERVICE_REGION_STORAGE_KEY, value);
};

export const buildApiLocaleHeaders = (language?: string | null, serviceRegion?: string | null): Record<string, string> => {
    const normalizedLanguage = normalizePreferredLanguage(language) ?? 'en';
    const normalizedRegion = normalizeServiceRegion(serviceRegion) ?? getDefaultServiceRegionForLanguage(normalizedLanguage);

    return {
        'Accept-Language': getLocaleForLanguage(normalizedLanguage),
        'X-Service-Region': normalizedRegion,
    };
};
