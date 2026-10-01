import type {TAnnualLeaveDay, TAnnualLeaveHistoryItem} from '@dutying/api/ward';

export type TAnnualLeaveHistoryGroup =
    | {kind: 'entry'; entry: TAnnualLeaveHistoryItem}
    | {kind: 'month'; month: string; entries: TAnnualLeaveHistoryItem[]};

export type TAnnualLeaveScheduleChange = {
    entry: TAnnualLeaveHistoryItem;
    previousDays: number | null;
    kind: 'recorded' | 'changed' | 'removed';
};

/** Display meaningful transitions from loaded revisions; monthly totals still use resolved usage. */
export function annualLeaveScheduleChanges(entries: TAnnualLeaveHistoryItem[]): TAnnualLeaveScheduleChange[] {
    const previousByDate = new Map<string, number>();
    const seen = new Set<number>();
    const changes: TAnnualLeaveScheduleChange[] = [];

    for (const entry of [...entries].sort((a, b) => a.id - b.id)) {
        if (entry.kind !== 'SCHEDULE' || seen.has(entry.id)) continue;

        seen.add(entry.id);

        const previous = previousByDate.get(entry.effectiveOn) ?? 0;
        const current = entry.voided ? 0 : entry.days;

        previousByDate.set(entry.effectiveOn, current);

        if (current === previous) continue;

        if (current <= 0) {
            if (previous > 0) changes.push({entry, previousDays: previous, kind: 'removed'});

            continue;
        }

        changes.push({entry, previousDays: previous > 0 ? previous : null, kind: previous > 0 ? 'changed' : 'recorded'});
    }

    return changes.reverse();
}

/** Preserve activity order, combining a month's schedule revisions across loaded pages. */
export function groupAnnualLeaveHistory(entries: TAnnualLeaveHistoryItem[]): TAnnualLeaveHistoryGroup[] {
    const groups: TAnnualLeaveHistoryGroup[] = [];
    const months = new Map<string, Extract<TAnnualLeaveHistoryGroup, {kind: 'month'}>>();
    const seen = new Set<number>();

    for (const entry of entries) {
        if (seen.has(entry.id) || (entry.kind === 'PREVIOUS_USAGE' && entry.voided)) continue;

        seen.add(entry.id);

        if (entry.kind !== 'SCHEDULE') {
            groups.push({kind: 'entry', entry});
            continue;
        }

        const month = entry.effectiveOn.slice(0, 7);

        let group = months.get(month);

        if (!group) {
            group = {kind: 'month', month, entries: []};
            months.set(month, group);
            groups.push(group);
        }

        group.entries.push(entry);
    }

    return groups.filter((group) => group.kind === 'entry' || annualLeaveScheduleChanges(group.entries).length > 0);
}

/** Sum resolved daily usage, never the append-only change history. */
export function annualLeaveMonthUsage(days: TAnnualLeaveDay[], nurseId: number, month: string, cutoff: string) {
    const dates = days
        .filter((day) => day.nurseId === nurseId && day.date.startsWith(`${month}-`) && day.days > 0)
        .sort((a, b) => a.date.localeCompare(b.date));
    const used = dates.filter((day) => day.date <= cutoff).reduce((sum, day) => sum + Math.round(day.days * 1000), 0) / 1000;
    const planned = dates.filter((day) => day.date > cutoff).reduce((sum, day) => sum + Math.round(day.days * 1000), 0) / 1000;

    return {dates, used, planned};
}
