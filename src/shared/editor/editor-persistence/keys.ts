export function makeDutyDraftStorageKey(args: {wardId: number; shiftTeamId: number; year: number; month: number}): string {
    const {wardId, shiftTeamId, year, month} = args;
    const ym = `${year}-${String(month).padStart(2, '0')}`;

    return `duty:draft:${wardId}:${shiftTeamId}:${ym}`;
}

export function makeLegacyMakeShiftWardDraftKey(args: {wardId: number}): string {
    return `make-shift:draft:${args.wardId}`;
}

export function makeLegacyDutyDraftKey(args: {wardId: number; shiftTeamId: number; year: number; month: number}): string {
    const {wardId, shiftTeamId, year, month} = args;

    return `duty:${wardId}:${shiftTeamId}:${year}:${month}`;
}
