export const ACCOUNT_NAME_MAX_LENGTH = 50;

const LETTER_OR_NUMBER = /[\p{L}\p{N}]/u;
const COMBINING_MARK = /[\p{Mn}\p{Mc}゛゜]/u;
const NAME_PUNCTUATION = new Set(["'", '’', '·', '・', '･', '－', '＇', '-', '‐', '‑', '.', '．']);
const LEGACY_ACCOUNT_PUNCTUATION = new Set(["'", '’', '·', '・', '･', '－', '＇', '-']);
const NAME_ONLY_MARKS = new Set(['ー', 'ｰ', 'ﾞ', 'ﾟ']);

// Match the account API's Unicode person-name policy. Never apply this while an
// IME is composing: retain the draft and normalize only the submitted value.
export const normalizeAccountNameForRequest = (value: string) => value.replace(/\p{Zs}+/gu, ' ').replace(/^ +| +$/g, '');

export function isValidAccountName(
    value: string,
    {allowLegacySeparators = false, legacyAccount = false}: {allowLegacySeparators?: boolean; legacyAccount?: boolean} = {},
): boolean {
    const name = normalizeAccountNameForRequest(value);
    const allowedPunctuation = legacyAccount ? LEGACY_ACCOUNT_PUNCTUATION : NAME_PUNCTUATION;

    // Account DTOs also enforce a 50 UTF-16 code-unit limit with @Size.
    if (!name || name.length > ACCOUNT_NAME_MAX_LENGTH) return false;

    let hasBaseCharacter = false;
    let hasMeaningfulCharacter = false;
    let previousPunctuation = false;

    const characters = Array.from(name);

    for (const [index, character] of characters.entries()) {
        if (allowedPunctuation.has(character) && (allowLegacySeparators || !previousPunctuation)) {
            hasBaseCharacter = false;
            previousPunctuation = true;
        } else if (LETTER_OR_NUMBER.test(character) && !allowedPunctuation.has(character)) {
            hasBaseCharacter = true;
            hasMeaningfulCharacter ||= !NAME_ONLY_MARKS.has(character);
            previousPunctuation = false;
        } else if (COMBINING_MARK.test(character) && hasBaseCharacter && !previousPunctuation) {
            continue;
        } else if (
            !legacyAccount &&
            (character === '\u200c' || character === '\u200d') &&
            hasBaseCharacter &&
            characters[index + 1] &&
            LETTER_OR_NUMBER.test(characters[index + 1]!) &&
            !allowedPunctuation.has(characters[index + 1]!)
        ) {
            hasBaseCharacter = false;
        } else if (character === ' ') {
            hasBaseCharacter = false;
            previousPunctuation = false;
        } else {
            return false;
        }
    }

    return (
        hasMeaningfulCharacter &&
        (allowLegacySeparators || (!allowedPunctuation.has(name[0]!) && !allowedPunctuation.has(name[name.length - 1]!)))
    );
}
