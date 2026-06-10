import {describe, expect, it} from 'vitest';
import {
    buildApiLocaleHeaders,
    getDefaultServiceRegionForLanguage,
    getLocaleForLanguage,
    normalizePreferredLanguage,
    normalizeServiceRegion,
} from '../locale';

describe('locale helpers', () => {
    it('normalizes browser language tags to supported service languages', () => {
        expect(normalizePreferredLanguage('ko-KR')).toBe('ko');
        expect(normalizePreferredLanguage('ja-JP')).toBe('ja');
        expect(normalizePreferredLanguage('en-US')).toBe('en');
        expect(normalizePreferredLanguage('fr-FR')).toBeUndefined();
    });

    it('normalizes service region values without accepting unknown regions', () => {
        expect(normalizeServiceRegion('kr')).toBe('KR');
        expect(normalizeServiceRegion('JP')).toBe('JP');
        expect(normalizeServiceRegion('us')).toBeUndefined();
    });

    it('keeps BCP 47 display locales separate from service regions', () => {
        expect(getLocaleForLanguage('ko')).toBe('ko-KR');
        expect(getLocaleForLanguage('ja')).toBe('ja-JP');
        expect(getLocaleForLanguage('en')).toBe('en-US');
        expect(getDefaultServiceRegionForLanguage('ja-JP')).toBe('JP');
    });

    it('builds API locale headers with explicit service region taking priority', () => {
        expect(buildApiLocaleHeaders('ja-JP', 'KR')).toEqual({
            'Accept-Language': 'ja-JP',
            'X-Service-Region': 'KR',
        });
    });

    it('falls back to language-based service region when no region is stored', () => {
        expect(buildApiLocaleHeaders('ko-KR')).toEqual({
            'Accept-Language': 'ko-KR',
            'X-Service-Region': 'KR',
        });
    });
});
