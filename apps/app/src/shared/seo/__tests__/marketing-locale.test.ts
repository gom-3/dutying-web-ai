import {describe, expect, it} from 'vitest';
import {getIndexedMarketingLanguageFromPath, getMarketingLanguageHref} from '../marketing-locale';

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
});
