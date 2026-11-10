import type {TPreferredLanguage, TServiceRegion} from '@dutying/domain';

export const SUPPORTED_LANGUAGES = ['ko', 'ja', 'en', 'zh', 'th', 'vi'] as const satisfies readonly TPreferredLanguage[];
export const WEB_LANGUAGES = ['ko', 'ja', 'en', 'zh', 'zh-TW', 'th', 'vi'] as const;
export type TWebLanguage = (typeof WEB_LANGUAGES)[number];
export const SUPPORTED_SERVICE_REGIONS = ['KR', 'JP', 'EN', 'CN', 'TW', 'TH', 'VN'] as const satisfies readonly TServiceRegion[];

export const DEFAULT_PREFERRED_LANGUAGE = 'ko' as const satisfies TPreferredLanguage;
export const DEFAULT_SERVICE_REGION = 'KR' as const satisfies TServiceRegion;
export const SERVICE_REGION_STORAGE_KEY = 'dutying.serviceRegion';

type TBcp47Locale = 'ko-KR' | 'ja-JP' | 'en-US' | 'zh-CN' | 'zh-TW' | 'th-TH' | 'vi-VN';

const LANGUAGE_TO_LOCALE: Record<TWebLanguage, TBcp47Locale> = {
    ko: 'ko-KR',
    ja: 'ja-JP',
    en: 'en-US',
    zh: 'zh-CN',
    'zh-TW': 'zh-TW',
    th: 'th-TH',
    vi: 'vi-VN',
};

const LANGUAGE_TO_REGION: Record<TWebLanguage, TServiceRegion> = {
    ko: 'KR',
    ja: 'JP',
    en: 'EN',
    zh: 'CN',
    'zh-TW': 'TW',
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

export const normalizeWebLanguage = (value?: string | null, serviceRegion?: TServiceRegion): TWebLanguage | undefined => {
    const language = normalizePreferredLanguage(value);

    if (language === 'zh' && (serviceRegion === 'TW' || /^zh[-_](?:tw|hant)(?:[-_]|$)/i.test(value ?? ''))) return 'zh-TW';

    return language;
};

export const normalizeServiceRegion = (value?: string | null): TServiceRegion | undefined => {
    if (!value) return undefined;

    const region = value.toUpperCase();

    return isSupportedServiceRegion(region) ? region : undefined;
};

export const getLocaleForLanguage = (value?: string | null): TBcp47Locale => {
    const language = normalizeWebLanguage(value) ?? DEFAULT_PREFERRED_LANGUAGE;

    return LANGUAGE_TO_LOCALE[language];
};

export const getDefaultServiceRegionForLanguage = (value?: string | null): TServiceRegion => {
    const language = normalizeWebLanguage(value);

    return language ? LANGUAGE_TO_REGION[language] : DEFAULT_SERVICE_REGION;
};

export const getStoredServiceRegion = (): TServiceRegion | undefined => {
    if (typeof window === 'undefined') return undefined;

    return normalizeServiceRegion(window.localStorage.getItem(SERVICE_REGION_STORAGE_KEY));
};

export const setStoredServiceRegion = (value: TServiceRegion) => {
    window.localStorage.setItem(SERVICE_REGION_STORAGE_KEY, value);
};

export const buildApiLocaleHeaders = (language?: string | null, serviceRegion?: string | null): Record<string, string> => {
    const normalizedRegion = normalizeServiceRegion(serviceRegion) ?? getDefaultServiceRegionForLanguage(language);
    const normalizedLanguage = normalizeWebLanguage(language, normalizedRegion) ?? DEFAULT_PREFERRED_LANGUAGE;

    return {
        'Accept-Language': getLocaleForLanguage(normalizedLanguage),
        'X-Service-Region': normalizedRegion,
    };
};
