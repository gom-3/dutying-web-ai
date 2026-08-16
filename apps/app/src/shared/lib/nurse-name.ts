export const NURSE_NAME_MAX_LENGTH = 20;

const ASCII_SPACE_EDGE_REGEX = /^ +| +$/g;
const KOREAN_SYLLABLE_REGEX = /[\uAC00-\uD7A3]/g;
const KOREAN_SYLLABLE_OR_SPACE_REGEX = /^[\uAC00-\uD7A3 ]+$/u;
const KOREAN_JAMO_REGEX = /[\u1100-\u11ff\u3130-\u318f\ua960-\ua97f\ud7b0-\ud7ff]/u;
const NURSE_NAME_ALLOWED_REGEXP = /^[\uAC00-\uD7A3A-Za-z0-9 \u3040-\u309F\u30A0-\u30FF\u3400-\u9FFF\u3005・ー]+$/u;
const NURSE_NAME_MEANINGFUL_REGEXP = /[\uAC00-\uD7A3A-Za-z0-9\u3040-\u309F\u30A1-\u30FA\u30FD-\u30FF\u3400-\u9FFF\u3005]/u;
// Keep Hangul jamo while a Korean IME is composing. Final validation still rejects uncombined jamo.
const NURSE_NAME_INPUT_SANITIZE_REGEXP =
    /[^\u1100-\u11FF\u3130-\u318F\uA960-\uA97F\uD7B0-\uD7FF\uAC00-\uD7A3A-Za-z0-9 \u3040-\u309F\u30A0-\u30FF\u3400-\u9FFF\u3005・ー]/gu;

export const normalizeNurseNameForRequest = (name: string) => name.replace(ASCII_SPACE_EDGE_REGEX, '');

export const sanitizeNurseNameInput = (rawValue: string) =>
    rawValue.replace(NURSE_NAME_INPUT_SANITIZE_REGEXP, '').slice(0, NURSE_NAME_MAX_LENGTH);

export function isValidNurseName(name: string): boolean {
    const requestName = normalizeNurseNameForRequest(name);

    if (!requestName) return false;

    if (requestName.length > NURSE_NAME_MAX_LENGTH) return false;

    if (KOREAN_JAMO_REGEX.test(requestName)) return false;

    if (!NURSE_NAME_ALLOWED_REGEXP.test(requestName)) return false;

    if (!NURSE_NAME_MEANINGFUL_REGEXP.test(requestName)) return false;

    const koreanSyllableCount = requestName.match(KOREAN_SYLLABLE_REGEX)?.length ?? 0;

    if (KOREAN_SYLLABLE_OR_SPACE_REGEX.test(requestName) && koreanSyllableCount < 2) return false;

    return true;
}
