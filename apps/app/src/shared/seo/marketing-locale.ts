import type {TPreferredLanguage} from '@dutying/domain';
import marketingPages from './marketing-pages.json';

export type TIndexedMarketingLanguage = TPreferredLanguage;

const indexedMarketingPathByLanguage = Object.fromEntries(marketingPages.pages.map((page) => [page.language, page.path])) as Record<
    TIndexedMarketingLanguage,
    string
>;
const indexedMarketingLanguageByPath = Object.fromEntries(marketingPages.pages.map((page) => [page.path, page.language])) as Record<
    string,
    TIndexedMarketingLanguage
>;
const normalizePathname = (pathname: string) => {
    if (pathname === '/') return '/';

    return pathname.replace(/\/+$/, '');
};

export const getIndexedMarketingLanguageFromPath = (pathname: string) => indexedMarketingLanguageByPath[normalizePathname(pathname)];

export const getMarketingLanguageHref = (language: TPreferredLanguage) => {
    if (language in indexedMarketingPathByLanguage) {
        return indexedMarketingPathByLanguage[language as TIndexedMarketingLanguage];
    }

    return `/?lng=${language}`;
};
