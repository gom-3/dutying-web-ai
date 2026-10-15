import type {TScheduleMonthRequestRes} from '@dutying/api/ward';
import type {TDutyDoc} from '@/features/shift-editor';

export type TCarryOverOption = {
    request: TScheduleMonthRequestRes;
    unavailable?: 'date' | 'nurse' | 'unsupported';
};

const stable = (value: unknown): string => {
    if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;

    if (value && typeof value === 'object')
        return JSON.stringify(
            Object.entries(value)
                .filter(([, item]) => item != null)
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([key, item]) => [key, stable(item)]),
        );

    return JSON.stringify(value ?? null);
};
const signature = ({
    kind,
    knob,
    value,
    operation,
    minimumOff,
    targetOff,
    source,
    goalType,
    maxOffDifference,
    required,
    targetNurseIds,
    comparisonNurseIds,
    templateCode,
    params,
    severity,
    condition,
}: TScheduleMonthRequestRes) =>
    stable({
        kind,
        knob,
        value,
        operation,
        minimumOff,
        targetOff,
        source,
        goalType,
        maxOffDifference,
        required,
        targetNurseIds,
        comparisonNurseIds,
        templateCode,
        params,
        severity,
        condition,
    });

/** The existing carry-over API copies payloads verbatim. Do not pretend to move absolute dates. */
export function carryOverOptions(
    candidates: TScheduleMonthRequestRes[],
    current: TScheduleMonthRequestRes[],
    doc: TDutyDoc,
    year: number,
    month: number,
): TCarryOverOption[] {
    const copied = new Set(current.map((request) => request.carriedFromRequestId));
    const existing = new Set(current.map(signature));
    const nurses = new Set(Object.values(doc.workerMeta).map((meta) => meta.nurseId));
    const workers = new Set(doc.rows.map((row) => Number(row.workerId)));
    const lastDay = new Date(year, month, 0).getDate();
    const seen = new Set<number>();

    return candidates
        .filter((request) => {
            if (
                seen.has(request.id) ||
                request.status !== 'ACTIVE' ||
                request.lifetime !== 'MONTH' ||
                request.promotedRuleId ||
                copied.has(request.id) ||
                existing.has(signature(request))
            )
                return false;

            seen.add(request.id);

            return true;
        })
        .map((request) => {
            let unavailable: TCarryOverOption['unavailable'];

            const visit = (value: unknown, key = '') => {
                if (typeof value === 'string' && /\d{4}-\d{2}(?:-\d{2})?/.test(value)) unavailable = 'date';

                if (Array.isArray(value)) {
                    value.forEach((item) => visit(item, key));
                } else if (value && typeof value === 'object') {
                    const record = value as Record<string, unknown>;

                    if (
                        record.type === 'DAY_OF_MONTH' &&
                        (!Number.isInteger(record.day) || Number(record.day) < 1 || Number(record.day) > lastDay)
                    )
                        unavailable = 'date';

                    Object.entries(record).forEach(([field, item]) => visit(item, field));
                } else if (
                    ['target', 'nurse', 'nurseId', 'nurseIds', 'nurseA', 'nurseB', 'preceptor', 'preceptee'].includes(key) &&
                    value !== 'ALL'
                ) {
                    if ((typeof value === 'number' || typeof value === 'string') && !nurses.has(Number(value))) unavailable = 'nurse';
                }
            };

            visit(request.params);
            visit(request.condition);

            // A label tied to a particular month is not a trustworthy preview of the copied payload.
            if (/\d{1,2}\s*월(?!요일)|\d{4}[-/.]\d{1,2}|\d{1,2}\/\d{1,2}/.test(`${request.displayLabel} ${request.requestText ?? ''}`))
                unavailable = 'date';

            if (
                request.kind === 'GOAL' &&
                [...(request.targetNurseIds ?? []), ...(request.comparisonNurseIds ?? [])].some((id) => !workers.has(id))
            )
                unavailable = 'nurse';

            if (!request.displayLabel.trim() || (request.kind === 'RULE' && !request.templateCode)) unavailable = 'unsupported';

            return {request, unavailable};
        });
}
