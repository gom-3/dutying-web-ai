import type {TPreferredLanguage, TServiceRegion} from '@dutying/domain';
import {getCountryServiceRegion, getVisitorCountry} from './visitor-country';

export const SUPPORTED_LANGUAGES = ['ko', 'ja', 'en', 'zh', 'th', 'vi'] as const satisfies readonly TPreferredLanguage[];
export const SUPPORTED_SERVICE_REGIONS = ['KR', 'JP', 'EN', 'CN', 'TH', 'VN'] as const satisfies readonly TServiceRegion[];

export const DEFAULT_PREFERRED_LANGUAGE = 'ko' as const satisfies TPreferredLanguage;
export const DEFAULT_SERVICE_REGION = 'KR' as const satisfies TServiceRegion;
export const SERVICE_REGION_STORAGE_KEY = 'dutying.serviceRegion';
export const LANGUAGE_PREFERENCE_COOKIE = 'dutying.locale';

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
    const language = normalizePreferredLanguage(value) ?? DEFAULT_PREFERRED_LANGUAGE;

    return LANGUAGE_TO_LOCALE[language];
};

export const getDefaultServiceRegionForLanguage = (value?: string | null): TServiceRegion => {
    const language = normalizePreferredLanguage(value);

    return language ? LANGUAGE_TO_REGION[language] : DEFAULT_SERVICE_REGION;
};

export const getStoredServiceRegion = (): TServiceRegion | undefined => {
    if (typeof window === 'undefined') return undefined;

    return normalizeServiceRegion(window.localStorage.getItem(SERVICE_REGION_STORAGE_KEY));
};

export const setStoredServiceRegion = (value: TServiceRegion) => {
    window.localStorage.setItem(SERVICE_REGION_STORAGE_KEY, value);
};

export const getSavedLanguagePreferenceCookie = (): TPreferredLanguage | undefined => {
    if (typeof document === 'undefined') return undefined;

    const value = document.cookie
        .split(';')
        .map((part) => part.trim())
        .find((part) => part.startsWith(`${LANGUAGE_PREFERENCE_COOKIE}=`))
        ?.slice(LANGUAGE_PREFERENCE_COOKIE.length + 1);

    return normalizePreferredLanguage(value);
};

export const saveLanguagePreferenceCookie = (value: string) => {
    if (typeof document === 'undefined') return;

    const language = normalizePreferredLanguage(value);

    if (!language) return;

    const secure = window.location.protocol === 'https:' ? '; Secure' : '';

    document.cookie = `${LANGUAGE_PREFERENCE_COOKIE}=${language}; Path=/; Max-Age=31536000; SameSite=Lax${secure}`;
};

export const buildApiLocaleHeaders = (language?: string | null, serviceRegion?: string | null): Record<string, string> => {
    const normalizedLanguage = normalizePreferredLanguage(language) ?? DEFAULT_PREFERRED_LANGUAGE;
    const normalizedRegion = normalizeServiceRegion(serviceRegion) ?? getCountryServiceRegion(getVisitorCountry());

    return {
        'Accept-Language': getLocaleForLanguage(normalizedLanguage),
        ...(normalizedRegion ? {'X-Service-Region': normalizedRegion} : {}),
    };
};
