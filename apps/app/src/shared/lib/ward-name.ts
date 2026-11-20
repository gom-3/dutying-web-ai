// Organization names include punctuation, full-width forms and rare kanji.
// Match the ward API's UTF-16 @Size limits rather than a person-name allowlist.
export const HOSPITAL_NAME_MAX_LENGTH = 100;
export const WARD_NAME_MAX_LENGTH = 50;

export function isValidWardIdentityName(value: string, maxLength: number): boolean {
    const name = value.trim();

    return name.length > 0 && name.length <= maxLength && !/[\p{Cc}\p{Cf}\p{Cs}]/u.test(name) && /[\p{L}\p{N}]/u.test(name);
}
