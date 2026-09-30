import type {TAnnualLeaveCommand, TAnnualLeavePerson} from '@dutying/api/ward';

export type TGrantMode = 'GRANT' | 'SETTLEMENT';

export type TGrantJob = {
    kind?: TGrantMode;
    id: string;
    date: string;
    days: number;
    reason: string;
    people: {nurseId: number; name: string; before: number; version: number; done: boolean}[];
};

export function canGrant(person: TAnnualLeavePerson) {
    return person.active && person.currentDays != null && person.openingDays != null && !person.checks.includes('RESTART_REQUIRED');
}

export function grantGroup(details: string | null): string | null {
    try {
        return /^bulk_([a-f0-9]{32})_\d+$/.exec(JSON.parse(details ?? '{}').requestId ?? '')?.[1] ?? null;
    } catch {
        return null;
    }
}

export async function runGrantJob(
    job: TGrantJob,
    current: TAnnualLeavePerson[],
    send: (nurseId: number, command: TAnnualLeaveCommand) => Promise<void>,
    progress: (job: TGrantJob) => void,
) {
    const next: TGrantJob = {...job, people: job.people.map((person) => ({...person}))};

    for (const person of next.people) {
        if (person.done) continue;

        const latest = current.find((item) => item.nurseId === person.nurseId);

        if (!latest || !canGrant(latest)) continue;

        try {
            await send(person.nurseId, {
                requestId: `${job.id}_${person.nurseId}`,
                version: latest.version,
                kind: job.kind ?? 'GRANT',
                effectiveOn: job.date,
                days: job.days,
                reason: job.reason,
            });
            person.done = true;
        } catch {
            // Keep the same request ID on retry: the server deduplicates uncertain responses.
        }

        progress({...next, people: next.people.map((item) => ({...item}))});
    }

    return next;
}

export function restoreGrantJob(value: string | null): TGrantJob | null {
    try {
        const job = JSON.parse(value ?? 'null') as TGrantJob | null;

        if (
            !job ||
            (job.kind !== undefined && job.kind !== 'GRANT' && job.kind !== 'SETTLEMENT') ||
            !/^bulk_[a-f0-9]{32}$/.test(job.id) ||
            !/^\d{4}-\d{2}-\d{2}$/.test(job.date) ||
            !Number.isFinite(job.days) ||
            job.days <= 0 ||
            job.days > 99999 ||
            typeof job.reason !== 'string' ||
            !job.reason.trim() ||
            job.reason.length > 500 ||
            !Array.isArray(job.people) ||
            !job.people.length ||
            job.people.length > 500 ||
            !job.people.every(
                (person) =>
                    Number.isSafeInteger(person.nurseId) &&
                    person.nurseId > 0 &&
                    typeof person.name === 'string' &&
                    Number.isFinite(person.before) &&
                    Number.isSafeInteger(person.version) &&
                    person.version >= 0 &&
                    typeof person.done === 'boolean',
            ) ||
            new Set(job.people.map((person) => person.nurseId)).size !== job.people.length
        )
            return null;

        return job;
    } catch {
        return null;
    }
}
