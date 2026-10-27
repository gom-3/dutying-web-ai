import type {TScheduleViolationDto} from '@dutying/api/ward';

type TStaffingWarning = {
    date: string;
    shift: string;
    actual: number;
    required: number;
    family: 'configured' | 'zero-coverage';
    equivalentKey?: string;
};
export type TScheduleWarningRow = {
    /** Original server objects stay intact, including all coordinates and rule identities. */
    violations: TScheduleViolationDto[];
    staffing?: TStaffingWarning;
};

function canonical(value: unknown): unknown {
    if (Array.isArray(value)) return value.map(canonical);

    if (value && typeof value === 'object')
        return Object.fromEntries(
            Object.entries(value)
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([key, item]) => [key, canonical(item)]),
        );

    return value;
}

function staffingWarning(issue: TScheduleViolationDto): TStaffingWarning | undefined {
    const family =
        issue.templateCode === 'MIN_STAFF_BY_SHIFT'
            ? 'configured'
            : issue.templateCode === 'L3_ZERO_CORE_COVERAGE'
              ? 'zero-coverage'
              : undefined;
    const actual = issue.messageArgs?.actual;
    const required = issue.messageArgs?.expected;
    const shift = issue.messageArgs?.shift;
    const dates = issue.period?.dates;
    const date =
        dates?.length === 1
            ? dates[0]
            : !dates?.length && issue.period?.startDate === issue.period?.endDate
              ? issue.period?.startDate
              : undefined;

    if (
        !family ||
        typeof actual !== 'number' ||
        !Number.isSafeInteger(actual) ||
        actual < 0 ||
        typeof required !== 'number' ||
        !Number.isSafeInteger(required) ||
        required <= actual ||
        typeof shift !== 'string' ||
        !shift.trim() ||
        !date ||
        !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
        !Number.isFinite(Date.parse(date)) ||
        new Date(date).toISOString().slice(0, 10) !== date
    )
        return;

    const comparison = issue.comparisonKey;
    const scope = comparison?.[2];
    const group = scope && typeof scope === 'object' && !Array.isArray(scope) ? (scope as {group?: unknown}).group : undefined;
    const target = group && typeof group === 'object' && !Array.isArray(group) ? (group as {target?: unknown}).target : undefined;
    const period = comparison?.[3];
    const shifts = comparison?.[4];
    const comparable =
        issue.comparisonAvailable === true &&
        comparison?.[1] === 'STAFFING_SHORTAGE' &&
        group != null &&
        typeof group === 'object' &&
        !Array.isArray(group) &&
        'division' in group &&
        target != null &&
        typeof target === 'object' &&
        !Array.isArray(target) &&
        (!issue.period?.startDate || issue.period.startDate === date) &&
        (!issue.period?.endDate || issue.period.endDate === date) &&
        Array.isArray(period) &&
        period.length === 2 &&
        period.every((day) => day === date) &&
        Array.isArray(shifts) &&
        shifts.length > 0 &&
        shifts.every(
            (id) => (typeof id === 'number' && Number.isSafeInteger(id) && id > 0) || (typeof id === 'string' && id.trim().length > 0),
        ) &&
        issue.unit === 'NURSE';

    return {
        date,
        shift,
        actual,
        required,
        family,
        equivalentKey: comparable
            ? JSON.stringify(canonical([date, shift, actual, required, issue.severity, issue.unit, issue.magnitude ?? null, scope, shifts]))
            : undefined,
    };
}

/** Display projection only: merge a configured shortage with its identical built-in zero-coverage report. */
export function scheduleWarningRows(violations: readonly TScheduleViolationDto[]): TScheduleWarningRow[] {
    const rows: TScheduleWarningRow[] = [];

    for (const issue of violations) {
        const staffing = staffingWarning(issue);
        const duplicate = staffing?.equivalentKey
            ? rows.find(
                  (row) =>
                      row.violations.length === 1 &&
                      row.staffing?.equivalentKey === staffing.equivalentKey &&
                      row.staffing?.family !== staffing.family,
              )
            : undefined;

        if (duplicate) duplicate.violations.push(issue);
        else rows.push({violations: [issue], staffing});
    }

    return rows;
}
