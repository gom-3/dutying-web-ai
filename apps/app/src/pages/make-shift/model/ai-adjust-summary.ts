import type {TScheduleMonthRequestItem} from '@dutying/api/ward';

/** Combine equivalent cell assignments for display only; the execution payload stays intact. */
export function summarizeInterpretationItems(items: TScheduleMonthRequestItem[]): TScheduleMonthRequestItem[] {
    const result: TScheduleMonthRequestItem[] = [];
    const groups = new Map<string, number>();

    for (const item of items) {
        if (item.kind !== 'CELL' && item.kind !== 'CELL_SET') {
            result.push(item);
            continue;
        }

        const nurseIds = [...new Set(item.kind === 'CELL' ? [item.nurseId!] : item.nurseIds)].sort((a, b) => a - b);
        const dates = item.kind === 'CELL' ? [item.date!] : (item.dates ?? []);
        const key = JSON.stringify([
            nurseIds,
            item.shiftCode,
            item.requiresConfirmation,
            item.confirmationReasons,
            item.assumedSlots,
            item.lifetimeHint,
            item.applyMonths,
        ]);
        const index = groups.get(key);

        if (index === undefined) {
            groups.set(key, result.length);
            result.push({...item, kind: 'CELL_SET', nurseIds, dates: [...new Set(dates)]});
        } else {
            result[index] = {...result[index]!, dates: [...new Set([...(result[index]!.dates ?? []), ...dates])]};
        }
    }

    return result;
}

/** Keep gaps and month/year boundaries explicit rather than implying extra assigned dates. */
export function formatInterpretationDates(dates: string[], language = 'ko'): string {
    const unique = [...new Set(dates)].sort();

    if (!unique.length) return '—';

    if (
        unique.some(
            (date) =>
                !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
                Number.isNaN(Date.parse(`${date}T00:00:00Z`)) ||
                new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) !== date,
        )
    )
        return unique.join(', ');

    const years = new Set(unique.map((date) => date.slice(0, 4)));
    const months = new Map<string, number[]>();

    for (const date of unique) {
        const month = date.slice(0, 7);

        months.set(month, [...(months.get(month) ?? []), Number(date.slice(8))]);
    }

    return [...months]
        .map(([month, days]) => {
            const ranges: string[] = [];

            for (let index = 0; index < days.length; index++) {
                const start = days[index]!;

                let end = start;

                while (days[index + 1] === end + 1) end = days[++index]!;

                ranges.push(start === end ? `${start}` : `${start}~${end}`);
            }

            const [year, monthNumber] = month.split('-').map(Number);

            if (language.startsWith('ko'))
                return `${years.size > 1 ? `${year}년 ` : ''}${monthNumber}월 ${ranges.map((range) => `${range}일`).join(', ')}`;

            const monthLabel = new Intl.DateTimeFormat(language || 'en', {month: 'short', timeZone: 'UTC'}).format(
                new Date(`${month}-01T00:00:00Z`),
            );

            return `${monthLabel} ${ranges.join(', ')}${years.size > 1 ? `, ${year}` : ''}`;
        })
        .join(' · ');
}
