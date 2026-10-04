import {beforeEach, describe, expect, it, vi} from 'vitest';
import {
    getCountryLanguage,
    getCountryServiceRegion,
    getVisitorCountry,
    isLikelyKoreanVisitor,
    loadVisitorCountry,
} from '../visitor-country';

describe('visitor country', () => {
    beforeEach(() => {
        window.sessionStorage.clear();
        vi.unstubAllGlobals();
    });

    it('uses IP country for the market without deriving it from the UI language', () => {
        expect(getCountryLanguage('JP')).toBe('ja');
        expect(getCountryServiceRegion('JP')).toBe('JP');
        expect(getCountryServiceRegion('US')).toBe('EN');
        expect(isLikelyKoreanVisitor('JP', '01012345678')).toBe(false);
        expect(isLikelyKoreanVisitor('KR', null)).toBe(true);
    });

    it('uses a Korean mobile number only when the IP country is unavailable', () => {
        expect(isLikelyKoreanVisitor(undefined, '+82 10-1234-5678')).toBe(true);
        expect(isLikelyKoreanVisitor(undefined, '010-1234-5678')).toBe(true);
        expect(isLikelyKoreanVisitor(undefined, '12345')).toBe(false);
    });

    it('loads the country from the same-origin edge endpoint', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ok: true, json: async () => ({country: 'KR'})}));

        expect(await loadVisitorCountry()).toBe('KR');
        expect(getVisitorCountry()).toBe('KR');
        expect(fetch).toHaveBeenCalledWith('/__visitor-country', expect.objectContaining({cache: 'no-store'}));
    });
});
