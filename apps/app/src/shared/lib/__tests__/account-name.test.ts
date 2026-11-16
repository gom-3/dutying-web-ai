import {describe, expect, it} from 'vitest';
import {ACCOUNT_NAME_MAX_LENGTH, isValidAccountName, normalizeAccountNameForRequest} from '../account-name';

describe('account Unicode person names', () => {
    it.each([
        '김민수',
        '홍',
        '山田 花子',
        '𠮷野 髙橋 﨑',
        'ﾔﾏﾀﾞ･ﾀﾛｳ',
        'Ａｌｅｘ １２',
        '王小明',
        '陳怡君',
        'สมหญิง ใจดี',
        'Nguyễn Thị Hương',
        'Nguyễn Thị Hương'.normalize('NFD'),
        'Jose\u0301 Garci\u0301a',
        "Jean-Luc O'Neill",
        'D’Arcy',
        '阿依古丽·买买提',
        'محمد أحمد',
        'Мария Иванова',
        'अनुष्का शर्मा',
    ])('accepts %s without limiting the script to the display language', (name) => {
        expect(isValidAccountName(name)).toBe(true);
    });

    it.each([
        '',
        '　　',
        '🙂',
        '山田🙂',
        'Nurse_1',
        '山田\n花子',
        '山田\t花子',
        '\u0301Alex',
        'Alex \u0301',
        '-Alex',
        'Alex・',
        'Jean--Luc',
        '\u202eAlex',
    ])('rejects unsupported or malformed input without rewriting it: %s', (name) => {
        expect(isValidAccountName(name)).toBe(false);
    });

    it('normalizes name spacing at submission without changing letters or marks', () => {
        expect(normalizeAccountNameForRequest('　𠮷野　　花子　')).toBe('𠮷野 花子');
        expect(normalizeAccountNameForRequest(' José\u00a0García ')).toBe('José García');
        expect(normalizeAccountNameForRequest('  Jose\u0301  ')).toBe('Jose\u0301');
        expect(normalizeAccountNameForRequest('  ﾔﾏﾀﾞ･ﾀﾛｳ  ')).toBe('ﾔﾏﾀﾞ･ﾀﾛｳ');
    });

    it('enforces the existing account API length limit without slicing a draft or a surrogate pair', () => {
        expect(isValidAccountName('A'.repeat(ACCOUNT_NAME_MAX_LENGTH))).toBe(true);
        expect(isValidAccountName('A'.repeat(ACCOUNT_NAME_MAX_LENGTH + 1))).toBe(false);
        expect(isValidAccountName('𠮷'.repeat(25))).toBe(true);
        expect(isValidAccountName('𠮷'.repeat(26))).toBe(false);
    });
});

describe('legacy account API name compatibility', () => {
    it.each(['สมหญิง ใจดี', "Jean-Luc O'Neill", 'Nguyễn Thị Hương', '山田 花子'])(
        'keeps names already accepted by legacy accounts: %s',
        (name) => {
            expect(isValidAccountName(name, {legacyAccount: true})).toBe(true);
        },
    );
    it.each(['J. Smith', 'Jean‑Luc', 'علی‌رضا', 'श्री‍राम'])(
        'reserves expanded names for web V2 instead of submitting them to a legacy account: %s',
        (name) => {
            expect(isValidAccountName(name)).toBe(true);
            expect(isValidAccountName(name, {legacyAccount: true})).toBe(false);
        },
    );
});
