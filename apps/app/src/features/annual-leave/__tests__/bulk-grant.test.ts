import type {TAnnualLeavePerson} from '@dutying/api/ward';
import {describe, expect, it, vi} from 'vitest';
import {canGrant, grantGroup, restoreGrantJob, runGrantJob, type TGrantJob} from '../bulk-grant';

const people = [1, 2].map(
    (nurseId) =>
        ({
            nurseId,
            name: `간호사 ${nurseId}`,
            active: true,
            currentDays: nurseId * 7,
            openingDays: 15,
            version: 1,
            checks: [],
            shiftTeamId: 1,
            startedOn: '2026-01-01',
            balanceBasis: 'PAST_ONLY',
            reviewOn: null,
            reconciledOn: null,
            usedDays: 0,
            plannedDays: 0,
            remainingDays: nurseId * 7,
            monthDays: 0,
        }) as TAnnualLeavePerson,
);
const job: TGrantJob = {
    id: 'bulk_0123456789abcdef0123456789abcdef',
    date: '2026-09-28',
    days: 1,
    reason: '창립기념일',
    people: people.map((person) => ({
        nurseId: person.nurseId,
        name: person.name,
        before: person.currentDays!,
        version: person.version,
        done: false,
    })),
};

describe('bulk annual leave grants', () => {
    it('adds a delta for each person with distinct IDs in the same durable group', async () => {
        const send = vi.fn().mockResolvedValue(undefined);
        const result = await runGrantJob(job, people, send, vi.fn());

        expect(result.people.every((person) => person.done)).toBe(true);
        expect(send).toHaveBeenCalledTimes(2);

        for (const [id, payload] of send.mock.calls) {
            expect(payload).toMatchObject({kind: 'GRANT', days: 1, reason: '창립기념일', requestId: `${job.id}_${id}`});
            expect(grantGroup(JSON.stringify(payload))).toBe('0123456789abcdef0123456789abcdef');
            expect(payload.requestId.length).toBeLessThanOrEqual(64);
        }

        expect(job.people.every((person) => !person.done)).toBe(true);
    });

    it('retries only unconfirmed saves with the same ID and refreshed version', async () => {
        const send = vi.fn().mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error('response lost'));
        const partial = await runGrantJob(job, people, send, vi.fn());

        expect(partial.people.map((person) => person.done)).toEqual([true, false]);

        const retry = vi.fn().mockResolvedValue(undefined);
        const result = await runGrantJob(
            partial,
            people.map((person) => ({...person, version: 2})),
            retry,
            vi.fn(),
        );

        expect(retry).toHaveBeenCalledOnce();
        expect(retry).toHaveBeenCalledWith(2, {...send.mock.calls[1][1], version: 2});
        expect(result.people.every((person) => person.done)).toBe(true);
    });

    it('deducts with a positive SETTLEMENT amount and preserves the mode when restoring a retry', async () => {
        const deduction = {...job, kind: 'SETTLEMENT' as const, days: 2};
        const restored = restoreGrantJob(JSON.stringify(deduction));
        const send = vi.fn().mockResolvedValue(undefined);

        expect(restored?.kind).toBe('SETTLEMENT');
        await runGrantJob(restored!, people, send, vi.fn());
        expect(send).toHaveBeenCalledWith(1, expect.objectContaining({kind: 'SETTLEMENT', days: 2}));
        expect(restoreGrantJob(JSON.stringify({...deduction, kind: 'DAY_USAGE'}))).toBeNull();
        expect(restoreGrantJob(JSON.stringify(job))).not.toBeNull();
    });

    it('does not send grants for unknown, restarted or inactive accounts', async () => {
        const send = vi.fn();
        const unavailable = [
            {...people[0], currentDays: null},
            {...people[1], active: false},
        ];

        await runGrantJob(job, unavailable, send, vi.fn());
        expect(send).not.toHaveBeenCalled();
        expect(canGrant({...people[0], checks: ['RESTART_REQUIRED']})).toBe(false);
        expect(canGrant({...people[0], currentDays: 0})).toBe(true);
        expect(canGrant({...people[0], currentDays: -2})).toBe(true);
    });

    it('leaves ordinary and malformed history entries ungrouped', () => {
        expect(grantGroup(null)).toBeNull();
        expect(grantGroup('{')).toBeNull();
        expect(grantGroup('{"requestId":"ordinary-request"}')).toBeNull();
    });
});
