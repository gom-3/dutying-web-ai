export const SHIFT_SHORT_NAME_MAX_LENGTH = 2;

const SHIFT_SHORT_NAME_ENTRY_KEY_REGEX = /^[!-~ⓓⓝ]$/u;

function uppercaseAscii(value: string) {
    return value
        .replace(/Ⓓ/g, 'ⓓ')
        .replace(/Ⓝ/g, 'ⓝ')
        .replace(/[a-z]/g, (character) => character.toUpperCase());
}

export function normalizeShiftShortNameInput(value: string) {
    return Array.from(uppercaseAscii(value).replace(/\s/g, '')).slice(0, SHIFT_SHORT_NAME_MAX_LENGTH).join('');
}

export function hasInvalidShiftShortNameLengthInput(value: string) {
    return /\s/.test(value) || Array.from(value.replace(/\s/g, '')).length > SHIFT_SHORT_NAME_MAX_LENGTH;
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
