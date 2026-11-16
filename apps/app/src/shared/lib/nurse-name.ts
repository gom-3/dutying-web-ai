import {isValidAccountName} from './account-name';

export const NURSE_NAME_MAX_LENGTH = 50;

const ASCII_SPACE_EDGE_REGEX = /^ +| +$/g;
const KOREAN_JAMO_REGEX = /[\u1100-\u11ff\u3130-\u318f\ua960-\ua97f\ud7b0-\ud7ff]/u;

export const normalizeNurseNameForRequest = (name: string) =>
    name
        .replace(/\p{Zs}/gu, ' ')
        .normalize('NFC')
        .replace(ASCII_SPACE_EDGE_REGEX, '');

export const normalizeRosterNurseNameForRequest = (name: string) => normalizeNurseNameForRequest(name.replace(/･/g, '・'));

export function isValidRosterNurseName(name: string): boolean {
    const requestName = normalizeRosterNurseNameForRequest(name);

    return requestName.length <= NURSE_NAME_MAX_LENGTH && isValidAccountName(requestName, {allowLegacySeparators: true});
}

export function isValidOnboardingNurseName(name: string): boolean {
    const requestName = normalizeNurseNameForRequest(name);

    if (KOREAN_JAMO_REGEX.test(requestName) || /[^\S ]/u.test(requestName)) return false;

    return isValidRosterNurseName(requestName);
}

// Retain international characters and IME drafts. Validate on submission and
// enforce the existing input length without splitting a surrogate pair.
export function sanitizeNurseNameInput(rawValue: string): string {
    let result = '';

    for (const character of rawValue) {
        if (result.length + character.length > NURSE_NAME_MAX_LENGTH) break;

        result += character;
    }

    return result;
}

export const isValidNurseName = isValidOnboardingNurseName;
