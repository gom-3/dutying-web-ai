import type {TAnnualLeaveDay, TAnnualLeavePreview, TAnnualLeaveUnitRule, TAnnualLeaveInitialization} from '@dutying/api/ward';
import type {TShift, TWardShiftType} from '@/entities';
import type {TDutyDoc} from '@/features/shift-editor/model';

export function annualLeaveDate() {
    return new Intl.DateTimeFormat('sv-SE', {timeZone: 'Asia/Seoul'}).format(new Date());
}

export function annualLeaveMonthRange(year: number, month: number) {
    const prefix = `${year}-${String(month).padStart(2, '0')}`;

    return {from: `${prefix}-01`, to: `${prefix}-${new Date(year, month, 0).getDate()}`};
}

export function canConfigureLeaveDeduction(type: TWardShiftType) {
    return type.isOff || ['ANNUAL_LEAVE', 'OTHER_LEAVE', 'OFF'].includes(type.classification ?? '');
}

export function annualLeaveUnits(type: TWardShiftType | undefined, date: string, rules: TAnnualLeaveUnitRule[] = []) {
    if (!type || !canConfigureLeaveDeduction(type)) return 0;

    const current = rules.find((rule) => rule.shiftTypeId === type.wardShiftTypeId && rule.effectiveFrom === null);

    if (current) return current.days;

    return (
        rules
            .filter((rule) => rule.shiftTypeId === type.wardShiftTypeId && rule.effectiveFrom !== null && rule.effectiveFrom <= date)
            .sort((a, b) => (b.effectiveFrom ?? '').localeCompare(a.effectiveFrom ?? ''))[0]?.days ??
        (type.classification === 'ANNUAL_LEAVE' ? 1 : 0)
    );
}

export function annualLeavePreview(shift: TShift, doc: TDutyDoc, shiftTeamId: number, year: number, month: number): TAnnualLeavePreview {
    const rows = new Map(shift.divisionShiftNurses.flat().map((row) => [String(row.shiftNurse.shiftNurseId), row.shiftNurse.nurseId]));
    const types = new Map(shift.wardShiftTypes.map((type) => [type.shortName, type.wardShiftTypeId]));

    return {
        shiftTeamId,
        year,
        month,
        cells: doc.rows.flatMap((row) => {
            const nurseId = rows.get(row.workerId);

            if (nurseId == null) return [];

            return doc.columns.map((date, index) => ({nurseId, date, shiftTypeId: types.get(row.cells[index] ?? '') ?? null}));
        }),
    };
}

/** Resolve every assignment in the visible schedule, even before leave tracking began. */
export function annualLeaveAssignments(
    shift: TShift,
    request: TAnnualLeavePreview,
    rules: TAnnualLeaveUnitRule[] = [],
    resolvedDays: TAnnualLeaveDay[] = [],
): TAnnualLeaveDay[] {
    const types = new Map(shift.wardShiftTypes.map((type) => [type.wardShiftTypeId, type]));
    const resolved = new Map(resolvedDays.map((day) => [`${day.nurseId}:${day.date}`, day]));

    return request.cells.map((cell) => {
        const saved = resolved.get(`${cell.nurseId}:${cell.date}`);

        // Keep confirmed deduction amounts for unchanged assignments. New types use today's rules.
        if (saved && (saved.source === 'DAY_USAGE' || saved.shiftTypeId === cell.shiftTypeId)) return saved;

        return {
            nurseId: cell.nurseId,
            date: cell.date,
            shiftTypeId: cell.shiftTypeId,
            days: annualLeaveUnits(types.get(cell.shiftTypeId ?? -1), cell.date, rules),
            source: 'SCHEDULE',
            entryId: null,
            referenceShiftTypeId: null,
            needsReview: false,
            partialWork: false,
        };
    });
}

/** Integer thousandths keep 0.125-day values exact when aggregating many cells. */
export function sumAnnualLeaveAssignments(days: TAnnualLeaveDay[]) {
    const totals = new Map<number, number>();

    for (const day of days) totals.set(day.nurseId, (totals.get(day.nurseId) ?? 0) + Math.round(day.days * 1000));

    return new Map([...totals].map(([id, count]) => [id, count / 1000]));
}

export function annualLeaveCounts(
    shift: TShift,
    request: TAnnualLeavePreview,
    rules: TAnnualLeaveUnitRule[] = [],
    resolvedDays: TAnnualLeaveDay[] = [],
) {
    return sumAnnualLeaveAssignments(annualLeaveAssignments(shift, request, rules, resolvedDays));
}

export function parseAnnualLeaveBulk(
    text: string,
    people: {nurseId: number; name: string; version: number}[],
    startedOn: string,
    reviewOn: string | null,
    reason: string,
): TAnnualLeaveInitialization[] {
    const seen = new Set<number>();

    return text
        .trim()
        .split(/\r?\n/)
        .filter(Boolean)
        .map((line) => {
            const [rawId, name, rawDays, ...extra] = line.split('\t');
            const id = Number(rawId);
            const person = people.find((item) => item.nurseId === id);

            if (person?.name !== name?.trim() || extra.length || seen.has(id)) throw new Error('BULK_MATCH');

            seen.add(id);

            const value = rawDays?.trim() ?? '';

            if (value && !/^-?\d{1,5}(\.\d{1,3})?$/.test(value)) throw new Error('BULK_DAYS');

            return {
                nurseId: id,
                version: person.version,
                startedOn,
                remainingDays: value === '' ? null : Number(value),
                balanceBasis: 'PAST_ONLY',
                includedPlannedDates: [],
                reviewOn,
                reason,
            };
        });
}
