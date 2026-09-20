import {describe, expect, it} from 'vitest';
import {resources} from '@/shared/i18n/resources.generated';
import {getIndexedMarketingLanguageFromPath, getMarketingLanguageHref} from '../marketing-locale';
import marketingPages from '../marketing-pages.json';

describe('marketing locale routing', () => {
    it('maps indexed landing paths to their language', () => {
        expect(getIndexedMarketingLanguageFromPath('/')).toBe('ko');
        expect(getIndexedMarketingLanguageFromPath('/en')).toBe('en');
        expect(getIndexedMarketingLanguageFromPath('/ja/')).toBe('ja');
        expect(getIndexedMarketingLanguageFromPath('/zh')).toBe('zh');
        expect(getIndexedMarketingLanguageFromPath('/th/')).toBe('th');
        expect(getIndexedMarketingLanguageFromPath('/vi')).toBe('vi');
        expect(getIndexedMarketingLanguageFromPath('/login')).toBeUndefined();
    });

    it('uses crawlable paths for every supported language', () => {
        expect(getMarketingLanguageHref('ko')).toBe('/');
        expect(getMarketingLanguageHref('en')).toBe('/en');
        expect(getMarketingLanguageHref('ja')).toBe('/ja');
        expect(getMarketingLanguageHref('zh')).toBe('/zh');
        expect(getMarketingLanguageHref('th')).toBe('/th');
        expect(getMarketingLanguageHref('vi')).toBe('/vi');
    });

    it('keeps product app titles identical to the localized landing titles', () => {
        for (const page of marketingPages.pages) {
            const language = page.language as keyof typeof resources;

            expect(resources[language].translation.feature.auth.documentTitle).toBe(page.title);
        }
    });
});
