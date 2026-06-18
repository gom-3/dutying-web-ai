import {describe, expect, it} from 'vitest';
import {isValidContactPhone, normalizeContactPhoneForStorage, sanitizeContactPhoneInput} from '../contact-phone';

describe('contact phone helpers', () => {
    it('accepts Korean domestic and international phone numbers', () => {
        expect(isValidContactPhone('01012345678', 'KR')).toBe(true);
        expect(isValidContactPhone('+82 10-1234-5678', 'KR')).toBe(true);
    });

    it('accepts Japanese domestic and international phone numbers', () => {
        expect(isValidContactPhone('09012345678', 'JP')).toBe(true);
        expect(isValidContactPhone('+81 90-1234-5678', 'JP')).toBe(true);
    });

    it('accepts general English-region phone numbers', () => {
        expect(isValidContactPhone('+1 (415) 555-0132', 'EN')).toBe(true);
        expect(isValidContactPhone('4155550132', 'EN')).toBe(true);
    });

    it('rejects invalid phone-like values', () => {
        expect(isValidContactPhone('123', 'EN')).toBe(false);
        expect(isValidContactPhone('+81 90-1234-5678', 'KR')).toBe(false);
        expect(isValidContactPhone('++1 415 555 0132', 'EN')).toBe(false);
    });

    it('sanitizes display input while keeping common phone separators', () => {
        expect(sanitizeContactPhoneInput(' +1 (415) abc 555-0132 ')).toBe('+1 (415) 555-0132 ');
        expect(normalizeContactPhoneForStorage(' +1 (415)  abc 555-0132 ')).toBe('+1 (415) 555-0132');
    });
});
