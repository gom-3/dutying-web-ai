import {describe, expect, it} from 'vitest';
import {
    getShiftShortNameEntryKey,
    hasInvalidShiftShortNameEntryKey,
    hasInvalidShiftShortNameLengthInput,
    normalizeShiftShortNameInput,
} from '../shift-short-name';

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

    it.each(['日', '夜', 'あ', 'ニ', 'ﾆ', 'ﾊﾞ', 'Ｄ', 'Ｎ１'])('accepts Japanese and width variants: %s', (input) => {
        expect(hasInvalidShiftShortNameEntryKey(input)).toBe(false);
    });

    it('normalizes width before counting characters or checking duplicate entry keys', () => {
        expect(normalizeShiftShortNameInput('ｎ１')).toBe('N1');
        expect(normalizeShiftShortNameInput('ﾊﾞﾝ')).toBe('バン');
        expect(normalizeShiftShortNameInput('ハ\u3099ン')).toBe('バン');
        expect(hasInvalidShiftShortNameLengthInput('ﾊﾞﾝ')).toBe(false);
        expect(hasInvalidShiftShortNameLengthInput('ハ\u3099ン')).toBe(false);
        expect(hasInvalidShiftShortNameLengthInput('ﾊﾞﾝﾄﾞ')).toBe(true);
        expect(getShiftShortNameEntryKey('Ｄ')).toBe(getShiftShortNameEntryKey('D'));
        expect(getShiftShortNameEntryKey('ﾊﾞ')).toBe(getShiftShortNameEntryKey('バ'));
        expect(hasInvalidShiftShortNameEntryKey('😀')).toBe(true);
    });

    it('preserves stored width variants when updating other fields of a legacy shift', () => {
        expect(normalizeShiftShortNameInput('Ｄ', {preserveWidth: true})).toBe('Ｄ');
        expect(normalizeShiftShortNameInput('ﾊﾞ', {preserveWidth: true})).toBe('ﾊﾞ');
        expect(normalizeShiftShortNameInput('Ⓓ', {preserveWidth: true})).toBe('ⓓ');
        expect(normalizeShiftShortNameInput('n1', {preserveWidth: true})).toBe('N1');
    });
});
