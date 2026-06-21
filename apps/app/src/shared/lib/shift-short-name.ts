export const SHIFT_SHORT_NAME_MAX_LENGTH = 3;

const SHIFT_SHORT_NAME_ENTRY_KEY_REGEX = /^[!-~]$/;

export function normalizeShiftShortNameInput(value: string) {
    return Array.from(value.toLocaleUpperCase().replace(/\s/g, '')).slice(0, SHIFT_SHORT_NAME_MAX_LENGTH).join('');
}

export function hasInvalidShiftShortNameLengthInput(value: string) {
    return /\s/.test(value) || Array.from(value.replace(/\s/g, '')).length > SHIFT_SHORT_NAME_MAX_LENGTH;
}

export function getShiftShortNameEntryKey(value: string) {
    return Array.from(value.trim().toLocaleUpperCase())[0]?.toLowerCase() ?? '';
}

export function getShiftShortNameValueKey(value: string) {
    return value.trim().toLocaleUpperCase();
}

export function hasInvalidShiftShortNameEntryKey(value: string) {
    const entryKey = getShiftShortNameEntryKey(value);

    return entryKey !== '' && !SHIFT_SHORT_NAME_ENTRY_KEY_REGEX.test(entryKey);
}
