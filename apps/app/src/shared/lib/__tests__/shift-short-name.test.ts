import {describe, expect, it} from 'vitest';
import {getShiftShortNameEntryKey, normalizeShiftShortNameInput} from '../shift-short-name';

describe('shift short-name normalization', () => {
    it('uppercases ASCII letters without changing the two-shift circled symbols', () => {
        expect(normalizeShiftShortNameInput('ab')).toBe('AB');
        expect(normalizeShiftShortNameInput('ⓓ')).toBe('ⓓ');
        expect(normalizeShiftShortNameInput('ⓝ')).toBe('ⓝ');
        expect(normalizeShiftShortNameInput('Ⓓ')).toBe('ⓓ');
        expect(normalizeShiftShortNameInput('Ⓝ')).toBe('ⓝ');
    });

    it('uses the same duplicate key for legacy uppercase and canonical lowercase circled symbols', () => {
        expect(getShiftShortNameEntryKey('Ⓓ')).toBe(getShiftShortNameEntryKey('ⓓ'));
        expect(getShiftShortNameEntryKey('Ⓝ')).toBe(getShiftShortNameEntryKey('ⓝ'));
    });
});
