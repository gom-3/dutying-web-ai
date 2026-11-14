import {describe, expect, it} from 'vitest';
import {isValidNurseName} from '../nurse-name';
import {isValidProfileName, sanitizeProfileNameInput} from '../profile-name';

describe('profile name policy', () => {
    it.each(['김듀팅', '심사·QA 검증', 'Kim-Dutying', '山田・花子'])('keeps and accepts %s', (name) => {
        expect(sanitizeProfileNameInput(name)).toBe(name);
        expect(isValidProfileName(name)).toBe(true);
    });
    it('retains the 50 character boundary and meaningful name safeguards', () => {
        expect(isValidProfileName('가'.repeat(50))).toBe(true);
        expect(isValidProfileName('가'.repeat(51))).toBe(false);
        expect(isValidProfileName('·-')).toBe(false);
        expect(isValidProfileName('ㄱㅣㅁ')).toBe(false);
        expect(isValidNurseName('Kim-Dutying')).toBe(false);
    });
});
