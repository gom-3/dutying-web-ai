// Normalize width variants without changing meaningful symbols such as ⓓ and ⓝ.
export function normalizeInputWidth(value: string) {
    return value
        .replace(/[！-～]/g, (character) => String.fromCharCode(character.charCodeAt(0) - 0xfee0))
        .replace(/[｡-ﾟ]+/g, (characters) => characters.normalize('NFKC'))
        .normalize('NFC');
}
