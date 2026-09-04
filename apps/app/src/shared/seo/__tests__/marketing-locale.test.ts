import {describe, expect, it} from 'vitest';
import {getIndexedMarketingLanguageFromPath, getMarketingLanguageHref} from '../marketing-locale';

describe('marketing locale routing', () => {
    it('maps indexed landing paths to their language', () => {
        expect(getIndexedMarketingLanguageFromPath('/')).toBe('ko');
        expect(getIndexedMarketingLanguageFromPath('/en')).toBe('en');
        expect(getIndexedMarketingLanguageFromPath('/ja/')).toBe('ja');
        expect(getIndexedMarketingLanguageFromPath('/login')).toBeUndefined();
    });

    it('uses crawlable paths for indexed languages and query selection for the remaining app languages', () => {
        expect(getMarketingLanguageHref('ko')).toBe('/');
        expect(getMarketingLanguageHref('en')).toBe('/en');
        expect(getMarketingLanguageHref('ja')).toBe('/ja');
        expect(getMarketingLanguageHref('zh')).toBe('/?lng=zh');
    });
});
