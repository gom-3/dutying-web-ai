import type {TScheduleMonthRequestRes} from '@dutying/api/ward';
import {beforeEach, describe, expect, it} from 'vitest';
import {
    deriveAdjustKnobs,
    findActiveKnobRequests,
    isCarryOverAnswered,
    markCarryOverAnswered,
    toChipRequestItem,
    toTextRequestItems,
} from '../schedule-month-requests';

function request(overrides: Partial<TScheduleMonthRequestRes>): TScheduleMonthRequestRes {
    return {
        id: 1,
        kind: 'KNOB',
        lifetime: 'MONTH',
        status: 'ACTIVE',
        origin: 'CHIP',
        displayLabel: 'x',
        knob: 'OFF_BALANCE',
        value: 1,
        ...overrides,
    };
}

describe('deriveAdjustKnobs', () => {
    it('sums ACTIVE knob requests like the server and clamps to the catalog range', () => {
        const knobs = deriveAdjustKnobs([
            request({id: 1, knob: 'OFF_BALANCE', value: 1}),
            request({id: 2, knob: 'OFF_BALANCE', value: 2, origin: 'TEXT'}),
            request({id: 3, knob: 'CLUSTERING', value: 1}),
        ]);

        expect(knobs).toEqual({OFF_BALANCE: 2, CLUSTERING: 1});
    });

    it('ignores DISABLED, RULE and out-of-catalog rows, and drops a sum of zero', () => {
        const knobs = deriveAdjustKnobs([
            request({id: 1, knob: 'CLUSTERING', value: 1}),
            request({id: 2, knob: 'CLUSTERING', value: -1, origin: 'TEXT'}),
            request({id: 3, knob: 'SENIORITY_MIX', value: 1, status: 'DISABLED'}),
            request({id: 4, kind: 'RULE', knob: undefined, value: undefined, nurseId: 7}),
            request({id: 5, knob: 'WEEKEND' as never, value: 1}),
        ]);

        expect(knobs).toEqual({});
    });
});

describe('findActiveKnobRequests', () => {
    it('returns only the live rows for that knob', () => {
        const rows = [
            request({id: 1, knob: 'CLUSTERING', value: 1}),
            request({id: 2, knob: 'CLUSTERING', value: -1, status: 'DISABLED'}),
            request({id: 3, knob: 'OFF_BALANCE', value: 1}),
        ];

        expect(findActiveKnobRequests(rows, 'CLUSTERING').map((row) => row.id)).toEqual([1]);
    });
});

describe('request item builders', () => {
    it('builds a chip request with MONTH lifetime and CHIP origin', () => {
        expect(toChipRequestItem('SENIORITY_MIX', 1, '숙련도 섞기')).toEqual({
            kind: 'KNOB',
            knob: 'SENIORITY_MIX',
            value: 1,
            lifetime: 'MONTH',
            origin: 'CHIP',
            displayLabel: '숙련도 섞기',
        });
    });

    it('keeps the chosen lifetime and drops RULE items from the text requests', () => {
        const items = toTextRequestItems(
            [
                {item: {kind: 'KNOB', knob: 'OFF_BALANCE', value: 1, displayLabel: 'fair', lifetimeHint: 'TEAM'}, lifetime: 'TEAM'},
                {item: {kind: 'RULE', nurseId: 5, displayLabel: 'Kim'}, lifetime: 'MONTH'},
            ],
            'fair please',
        );

        expect(items).toEqual([
            {
                kind: 'KNOB',
                knob: 'OFF_BALANCE',
                value: 1,
                displayLabel: 'fair',
                lifetime: 'TEAM',
                origin: 'TEXT',
                requestText: 'fair please',
            },
        ]);
    });
});

describe('carry-over answered flag', () => {
    beforeEach(() => window.sessionStorage.clear());

    it('is scoped to ward, team and month', () => {
        const key = {wardId: 1, shiftTeamId: 10, year: 2026, month: 7};

        expect(isCarryOverAnswered(key)).toBe(false);

        markCarryOverAnswered(key);

        expect(isCarryOverAnswered(key)).toBe(true);
        expect(isCarryOverAnswered({...key, month: 8})).toBe(false);
    });
});
