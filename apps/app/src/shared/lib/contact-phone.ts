import type {TServiceRegion} from '@dutying/domain';

export const CONTACT_PHONE_MAX_LENGTH = 24;

const ALLOWED_PHONE_CHAR_REGEXP = /[^\d+()\-\s]/g;
const KR_COUNTRY_CODE = '82';
const JP_COUNTRY_CODE = '81';
const hasValidPlus = (value: string) => {
    const firstPlusIndex = value.indexOf('+');

    if (firstPlusIndex === -1) return true;

    return firstPlusIndex === 0 && value.indexOf('+', 1) === -1;
};
const startsWithInternationalPrefix = (value: string) => value.trim().startsWith('+');
const getPhoneDigits = (value: string) => value.replace(/\D/g, '');

export const sanitizeContactPhoneInput = (rawValue: string) => {
    const withoutInvalidChars = rawValue.replace(ALLOWED_PHONE_CHAR_REGEXP, '').replace(/\s+/g, ' ');

    let hasLeadingPlus = false;

    const sanitized = Array.from(withoutInvalidChars)
        .filter((char, index) => {
            if (char !== '+') return true;

            if (hasLeadingPlus) return false;

            const firstNonSpaceIndex = withoutInvalidChars.search(/\S/);
            const isLeadingPlus = index === firstNonSpaceIndex;

            hasLeadingPlus = isLeadingPlus;

            return isLeadingPlus;
        })
        .join('');

    return sanitized.trimStart().slice(0, CONTACT_PHONE_MAX_LENGTH);
};

export const normalizeContactPhoneForStorage = (value: string) => sanitizeContactPhoneInput(value).trim().replace(/\s+/g, ' ');

export const isValidContactPhone = (value: string, serviceRegion: TServiceRegion) => {
    const normalizedValue = value.trim().replace(/\s+/g, ' ');
    const digits = getPhoneDigits(normalizedValue);

    if (normalizedValue !== normalizeContactPhoneForStorage(value)) return false;

    if (!normalizedValue || !hasValidPlus(normalizedValue)) return false;

    if (digits.length < 7 || digits.length > 15) return false;

    const isInternational = startsWithInternationalPrefix(normalizedValue);

    if (serviceRegion === 'KR') {
        if (isInternational) {
            return digits.startsWith(KR_COUNTRY_CODE) && digits.length >= 10 && digits.length <= 12;
        }

        return digits.startsWith('0') && digits.length >= 9 && digits.length <= 11;
    }

    if (serviceRegion === 'JP') {
        if (isInternational) {
            return digits.startsWith(JP_COUNTRY_CODE) && digits.length >= 11 && digits.length <= 12;
        }

        return digits.startsWith('0') && digits.length >= 10 && digits.length <= 11;
    }

    return digits.length >= 7 && digits.length <= 15;
};
