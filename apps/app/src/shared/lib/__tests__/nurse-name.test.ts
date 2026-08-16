import {describe, expect, it} from 'vitest';
import {isValidNurseName, normalizeNurseNameForRequest, sanitizeNurseNameInput} from '../nurse-name';

describe('nurse name helpers', () => {
    it('accepts Korean, English, digits, ASCII spaces, and Japanese names', () => {
        expect(isValidNurseName('신규 간호사 1')).toBe(true);
        expect(isValidNurseName('Nurse 1')).toBe(true);
        expect(isValidNurseName('山田 花子')).toBe(true);
        expect(isValidNurseName('佐藤・美咲')).toBe(true);
        expect(isValidNurseName('ジョン・スミス')).toBe(true);
    });

    it('rejects unsupported whitespace, emoji, special characters, and symbol-only values', () => {
        expect(isValidNurseName('山田　花子')).toBe(false);
        expect(isValidNurseName('山田\t花子')).toBe(false);
        expect(isValidNurseName('山田\n花子')).toBe(false);
        expect(isValidNurseName('🙂')).toBe(false);
        expect(isValidNurseName('・')).toBe(false);
        expect(isValidNurseName('Nurse_1')).toBe(false);
    });

    it('keeps previous Korean jamo and single-syllable safeguards', () => {
        expect(isValidNurseName('ㄱㅣㅁ')).toBe(false);
        expect(isValidNurseName('홍')).toBe(false);
    });

    it('normalizes only ASCII edge spaces for requests', () => {
        expect(normalizeNurseNameForRequest('  山田 花子  ')).toBe('山田 花子');
        expect(normalizeNurseNameForRequest('　山田 花子　')).toBe('　山田 花子　');
    });

    it('keeps Korean IME composition characters while sanitizing unsupported input', () => {
        expect(sanitizeNurseNameInput('ㅎㅗㅇ')).toBe('ㅎㅗㅇ');
        expect(sanitizeNurseNameInput('홍')).toBe('홍');
        expect(sanitizeNurseNameInput(' 山田　花子\t🙂Nurse_1・ー ')).toBe(' 山田花子Nurse1・ー ');
    });
});
