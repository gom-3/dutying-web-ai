import examples from 'libphonenumber-js/examples.mobile.json';
import {getExampleNumber} from 'libphonenumber-js/max';
import {describe, expect, it} from 'vitest';
import {
    normalizeGlobalPhoneInput,
    parseGlobalContactPhone,
    PHONE_COUNTRIES,
    resolveContactPhoneCountry,
    type TPhoneCountry,
} from '../global-contact-phone';

describe('global contact phone contract', () => {
    it.each(PHONE_COUNTRIES)('round trips the metadata example for phone country %s', (country) => {
        const example = getExampleNumber(country, examples)!;

        expect(example).toBeDefined();
        expect(parseGlobalContactPhone(example.formatNational(), country)?.number).toBe(example.number);
        expect(parseGlobalContactPhone(example.number)?.number).toBe(example.number);
    });

    it.each([
        ['KR', '01012345678', '+821012345678'],
        ['JP', '09012345678', '+819012345678'],
        ['CN', '13800138000', '+8613800138000'],
        ['TW', '0912345678', '+886912345678'],
        ['TH', '0812345678', '+66812345678'],
        ['VN', '0912345678', '+84912345678'],
        ['US', '4155550132', '+14155550132'],
        ['CA', '4165550123', '+14165550123'],
        ['GB', '02079460018', '+442079460018'],
        ['DE', '030123456', '+4930123456'],
        ['IN', '9876543210', '+919876543210'],
        ['AU', '0412345678', '+61412345678'],
        ['ZA', '0821234567', '+27821234567'],
        ['HK', '91234567', '+85291234567'],
    ] as const)(
        'normalizes %s national numbers and accepts the international form independently of display country',
        (country, national, e164) => {
            expect(parseGlobalContactPhone(national, country)?.number).toBe(e164);
            expect(parseGlobalContactPhone(e164, 'KR')?.number).toBe(e164);
            expect(parseGlobalContactPhone(e164)?.number).toBe(e164);
        },
    );

    it.each([
        ['', 'CN'],
        ['123', 'CN'],
        ['+', 'CN'],
        ['+000123456789', undefined],
        ['+861380013800000000', 'CN'],
        ['call +8613800138000', 'CN'],
        ['+86 13800138000 ext 5', 'CN'],
        ['+86 13800138000#5', 'CN'],
        ['++8613800138000', 'CN'],
        ['86+13800138000', 'CN'],
        ['+86\n13800138000', 'CN'],
        ['+86\t13800138000', 'CN'],
        ['🙂13800138000', 'CN'],
        ['\u202e+8613800138000', 'CN'],
        ['0912345678', undefined],
    ] as const)('rejects malformed or ambiguous contact %s', (number, country) => {
        expect(parseGlobalContactPhone(number, country)).toBeUndefined();
    });

    it('folds fullwidth, Arabic, Devanagari and Thai decimal digits without stripping invalid text', () => {
        expect(parseGlobalContactPhone('＋８１　（９０）１２３４－５６７８', 'JP')?.number).toBe('+819012345678');
        expect(parseGlobalContactPhone('+٨٦ ١٣٨٠٠١٣٨٠٠٠')?.number).toBe('+8613800138000');
        expect(parseGlobalContactPhone('०९१२३४५६७८', 'TW')?.number).toBe('+886912345678');
        expect(parseGlobalContactPhone('๐๘๑๒๓๔๕๖๗๘', 'TH')?.number).toBe('+66812345678');
        expect(parseGlobalContactPhone('+86 138‑0013‑8000')?.number).toBe('+8613800138000');
        expect(normalizeGlobalPhoneInput('call +8613800138000')).toBe('call +8613800138000');
    });

    it('accepts the explicit 00 international prefix and rejects unsupported country codes', () => {
        expect(parseGlobalContactPhone('0086 13800138000')?.number).toBe('+8613800138000');
        expect(parseGlobalContactPhone('+8613800138000', 'ZZ' as TPhoneCountry)).toBeUndefined();
    });

    it('restores the stored phone country before considering service region and never treats EN as a country', () => {
        expect(resolveContactPhoneCountry('+886912345678', 'JP', 'CN')).toBe('TW');
        expect(resolveContactPhoneCountry('0912345678', 'KR', 'TW')).toBe('TW');
        expect(resolveContactPhoneCountry('13800138000', 'CN')).toBe('CN');
        expect(resolveContactPhoneCountry('', 'EN')).toBeUndefined();
    });
});
