import {describe, expect, it} from 'vitest';
import {formatBirthDateInput, isValidBirthDate, normalizeBirthDateForStorage} from '../birth-date';

describe('birth date helpers', () => {
    it('formats eight directly entered digits as YYYY-MM-DD', () => {
        expect(formatBirthDateInput('19960314')).toBe('1996-03-14');
        expect(formatBirthDateInput('1996-03-14')).toBe('1996-03-14');
    });

    it('limits birth date input to eight digits', () => {
        expect(formatBirthDateInput('199603141234')).toBe('1996-03-14');
    });

    it('validates the date format, calendar date, and allowed range', () => {
        expect(isValidBirthDate('1996-03-14', '2026-08-10')).toBe(true);
        expect(isValidBirthDate('1996-02-30', '2026-08-10')).toBe(false);
        expect(isValidBirthDate('1899-12-31', '2026-08-10')).toBe(false);
        expect(isValidBirthDate('2026-08-11', '2026-08-10')).toBe(false);
    });

    it('normalizes an empty value for storage', () => {
        expect(normalizeBirthDateForStorage('  ')).toBeNull();
        expect(normalizeBirthDateForStorage('1996-03-14')).toBe('1996-03-14');
    });
});
