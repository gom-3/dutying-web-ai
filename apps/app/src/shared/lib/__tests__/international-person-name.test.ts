import {describe, expect, it} from 'vitest';
import {isValidAccountName} from '../account-name';
import {
    isValidNurseName,
    isValidOnboardingNurseName,
    isValidRosterNurseName,
    normalizeRosterNurseNameForRequest,
    sanitizeNurseNameInput,
} from '../nurse-name';

const names = [
    '김민수',
    '홍',
    '山田 花子',
    '𠮷田',
    '山田󠄀',
    'ﾔﾏﾀﾞ･ﾀﾛｳ',
    'Ａｌｅｘ １２',
    "Jean-Luc O'Neill",
    'D’Arcy',
    'OʼConnor',
    'J. Smith',
    'Jean‑Luc',
    'Ａｎｎｅ－Ｍａｒｉｅ',
    '阿依古丽·买买提',
    'Nguyễn Thị Hương',
    'José García',
    'สมหญิง ใจดี',
    'محمد أحمد',
    'علی‌رضا',
    'श्री‍राम',
    'דָּוִד לוי',
    'Αλέξανδρος',
    'Мария Иванова',
    'ნინო',
    'ሐና',
    'অনুষ্কা',
    'அனுஷ்கா',
    'Անի',
    'សុភា',
    'အောင်',
    'अनुष्का शर्मा',
];

describe('international person name contract', () => {
    it.each(names)('accepts %s in onboarding, roster, profile and account names', (name) => {
        expect(isValidNurseName(name)).toBe(true);
        expect(isValidOnboardingNurseName(name)).toBe(true);
        expect(isValidRosterNurseName(name)).toBe(true);
        expect(isValidAccountName(name)).toBe(true);
        expect(sanitizeNurseNameInput(name)).toBe(name);
    });
    it.each([
        '\u200cAlex',
        'Alex\u200d',
        'Alex \u200cNurse',
        'Alex\u200d\u200cNurse',
        'Alex\u202eNurse',
        'Alex\u2028Nurse',
        'Alex\u2029Nurse',
        '1\ufe0f\u20e3',
        'Alex🙂',
    ])('rejects malformed controls or emoji: %s', (name) => {
        expect(isValidAccountName(name)).toBe(false);
        expect(isValidRosterNurseName(name)).toBe(false);
    });
    it('rejects controls at name edges and preserves letter-like apostrophes', () => {
        expect(isValidRosterNurseName('\tAlex')).toBe(false);
        expect(isValidRosterNurseName('Alex\n')).toBe(false);
        expect(isValidAccountName('ʼAli')).toBe(true);
        expect(isValidRosterNurseName('ʼAli')).toBe(true);
    });

    it('normalizes horizontal Unicode spaces while keeping the name and its punctuation', () => {
        expect(normalizeRosterNurseNameForRequest('　Jean-Luc\u00a0O’Neill\u202f')).toBe('Jean-Luc O’Neill');
        expect(normalizeRosterNurseNameForRequest('山田\u2009花子')).toBe('山田 花子');
    });
});
