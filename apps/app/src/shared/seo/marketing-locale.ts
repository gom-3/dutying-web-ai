import type {TWebLanguage} from '@/shared/i18n/locale';
import marketingPages from './marketing-pages.json';

export type TIndexedMarketingLanguage = TWebLanguage;

const indexedMarketingPathByLanguage = Object.fromEntries(marketingPages.pages.map((page) => [page.language, page.path])) as Record<
    TIndexedMarketingLanguage,
    string
>;
const nurseAppPathByLanguage = Object.fromEntries(marketingPages.pages.map((page) => [page.language, page.nurseApp.path])) as Record<
    TIndexedMarketingLanguage,
    string
>;
const indexedMarketingLanguageByPath = new Map<string, TIndexedMarketingLanguage>(
    marketingPages.pages.flatMap((page) => [
        [page.path, page.language as TIndexedMarketingLanguage],
        [page.nurseApp.path, page.language as TIndexedMarketingLanguage],
    ]),
);

export const nurseAppMarketingPaths = marketingPages.pages.map((page) => page.nurseApp.path);

const normalizePathname = (pathname: string) => {
    if (pathname === '/') return '/';

    return pathname.replace(/\/+$/, '');
};

export const getIndexedMarketingLanguageFromPath = (pathname: string) => indexedMarketingLanguageByPath.get(normalizePathname(pathname));

export const getNurseAppHref = (language: TWebLanguage) => nurseAppPathByLanguage[language];

export const isNurseAppMarketingPath = (pathname: string) => nurseAppMarketingPaths.includes(normalizePathname(pathname));

export const getMarketingLanguageHref = (language: TWebLanguage) => {
    if (language in indexedMarketingPathByLanguage) {
        return indexedMarketingPathByLanguage[language as TIndexedMarketingLanguage];
    }

    return `/?lng=${language}`;
};

export const getMarketingAppStoreUrls = (language: TWebLanguage) => {
    const page = marketingPages.pages.find((page) => page.language === language)!;

    return {ios: page.iosStoreUrl, android: page.androidStoreUrl};
};
