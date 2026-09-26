const LEGACY_KOREAN_PREFIX = '신규간호사';

export const getNextNewNurseNumber = (names: string[], prefix: string): number => {
    const normalizedPrefix = prefix.trim();
    const prefixes = normalizedPrefix === '신규 간호사' ? [normalizedPrefix, LEGACY_KOREAN_PREFIX] : [normalizedPrefix];
    const usedNumbers = names.flatMap((name) => {
        const trimmedName = name.trim();
        const matchingPrefix = prefixes.find((candidate) => trimmedName.startsWith(candidate));
        if (!matchingPrefix) return [];

        const suffix = trimmedName.slice(matchingPrefix.length).trim();
        if (!/^[1-9]\d*$/.test(suffix)) return [];

        const number = Number(suffix);
        return Number.isSafeInteger(number) ? [number] : [];
    });

    return Math.max(0, ...usedNumbers) + 1;
};

export const getNextNewNurseName = (names: string[], prefix: string): string =>
    `${prefix.trim()} ${getNextNewNurseNumber(names, prefix)}`;
