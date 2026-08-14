/** 근무표·근무자 목록 등에서 표시용 이름. null이면 글자 수를 제한하지 않는다. */
export function formatNurseDisplayName(name: string, maxChars: number | null = 4): string {
    const trimmed = name.trim();

    if (maxChars === null) return trimmed;

    if (trimmed.length <= maxChars) return trimmed;

    return `${trimmed.slice(0, maxChars)}…`;
}
