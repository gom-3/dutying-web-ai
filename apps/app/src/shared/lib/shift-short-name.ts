import {normalizeInputWidth} from './input-width';

export const SHIFT_SHORT_NAME_MAX_LENGTH = 2;

const SHIFT_SHORT_NAME_ENTRY_KEY_REGEX = /^[!-~ⓓⓝ\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}ー]$/u;

function uppercaseAscii(value: string) {
    return value
        .replace(/Ⓓ/g, 'ⓓ')
        .replace(/Ⓝ/g, 'ⓝ')
        .replace(/[a-z]/g, (character) => character.toUpperCase());
}

export function normalizeShiftShortNameInput(value: string, {preserveWidth = false}: {preserveWidth?: boolean} = {}) {
    return Array.from(uppercaseAscii(preserveWidth ? value : normalizeInputWidth(value)).replace(/\s/g, ''))
        .slice(0, SHIFT_SHORT_NAME_MAX_LENGTH)
        .join('');
}

export function hasInvalidShiftShortNameLengthInput(value: string) {
    const normalized = normalizeInputWidth(value);

    return /\s/.test(normalized) || Array.from(normalized.replace(/\s/g, '')).length > SHIFT_SHORT_NAME_MAX_LENGTH;
}

export function getShiftShortNameEntryKey(value: string) {
    return Array.from(normalizeShiftShortNameInput(value))[0]?.toLowerCase() ?? '';
}

export function getShiftShortNameValueKey(value: string) {
    return normalizeShiftShortNameInput(value.trim());
}

export function hasInvalidShiftShortNameEntryKey(value: string) {
    const entryKey = getShiftShortNameEntryKey(value);

    return entryKey !== '' && !SHIFT_SHORT_NAME_ENTRY_KEY_REGEX.test(entryKey);
}
