import {getCountries, isSupportedCountry, parsePhoneNumberFromString, type CountryCode} from 'libphonenumber-js/max';
import {normalizeInputWidth} from './input-width';

export type TPhoneCountry = CountryCode;
export const GLOBAL_PHONE_INPUT_MAX_LENGTH = 64;
export const PHONE_COUNTRIES = getCountries();

const DECIMAL_DIGIT = /\p{Nd}/u;

function normalizeDecimalDigit(character: string) {
    const codePoint = character.codePointAt(0)!;

    let blockStart = codePoint;

    while (blockStart > 0 && DECIMAL_DIGIT.test(String.fromCodePoint(blockStart - 1))) blockStart -= 1;

    return String((codePoint - blockStart) % 10);
}

// Fold representation only. Invalid letters, controls and extensions must remain
// visible and fail validation instead of being removed from a contact number.
export const normalizeGlobalPhoneInput = (value: string) =>
    normalizeInputWidth(value)
        .replace(/\p{Nd}/gu, normalizeDecimalDigit)
        .replace(/\p{Zs}/gu, ' ')
        .replace(/[‐-―−]/g, '-')
        .replace(/^ +| +$/g, '');

export function parseGlobalContactPhone(value: string, country?: TPhoneCountry) {
    if (value.length > GLOBAL_PHONE_INPUT_MAX_LENGTH || (country && !isSupportedCountry(country))) return undefined;

    const normalized = normalizeGlobalPhoneInput(value).replace(/^00/, '+');

    if (!/^\+?[0-9(). -]+$/.test(normalized) || (!normalized.startsWith('+') && !country)) return undefined;

    const phone = parsePhoneNumberFromString(normalized, {defaultCountry: country, extract: false});

    return phone && !phone.ext && phone.isValid() && /^\+[1-9][0-9]{1,14}$/.test(phone.number) ? phone : undefined;
}

export function resolveContactPhoneCountry(value?: string | null, serviceRegion?: string | null, savedCountry?: string | null) {
    const normalized = value ? normalizeGlobalPhoneInput(value) : '';
    const parsed = normalized.startsWith('+') || normalized.startsWith('00') ? parseGlobalContactPhone(normalized) : undefined;

    if (parsed) return parsed.country;

    if (savedCountry && isSupportedCountry(savedCountry)) return savedCountry as TPhoneCountry;

    return serviceRegion && isSupportedCountry(serviceRegion) ? (serviceRegion as TPhoneCountry) : undefined;
}
