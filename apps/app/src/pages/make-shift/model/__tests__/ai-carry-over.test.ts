import type {TScheduleMonthRequestRes} from '@dutying/api/ward';
import {describe, expect, it} from 'vitest';
import type {TDutyDoc} from '@/features/shift-editor';
import {carryOverOptions} from '../ai-carry-over';

const doc: TDutyDoc = {
    columns: [],
    rows: [{workerId: '20', cells: []}],
    workerMeta: {'20': {name: '김서현', nurseId: 7}},
    fixedCells: {},
    requestCells: {},
};
const request = (overrides: Partial<TScheduleMonthRequestRes> = {}): TScheduleMonthRequestRes => ({
    id: 1,
    kind: 'KNOB',
    lifetime: 'MONTH',
    status: 'ACTIVE',
    origin: 'TEXT',
    displayLabel: '오프를 공평하게',
    knob: 'OFF_BALANCE',
    value: 1,
    ...overrides,
});
const options = (rows: TScheduleMonthRequestRes[], current: TScheduleMonthRequestRes[] = []) =>
    carryOverOptions(rows, current, doc, 2026, 2);

describe('carry-over eligibility', () => {
    it('excludes disabled, recurring, promoted and already copied requests', () => {
        const rows = [
            request(),
            request({id: 2, status: 'DISABLED'}),
            request({id: 3, lifetime: 'TEAM'}),
            request({id: 4, promotedRuleId: 9}),
        ];

        expect(options(rows).map(({request}) => request.id)).toEqual([1]);
        expect(options([request()], [request({id: 9, carriedFromRequestId: 1, value: 2, status: 'DISABLED'})])).toEqual([]);
    });

    it('does not offer an equivalent request already saved this month', () => {
        expect(options([request()], [request({id: 99, displayLabel: '같은 조건의 다른 문구'})])).toEqual([]);
    });

    it('preserves ordered rule patterns when comparing requests', () => {
        const rule = request({kind: 'RULE', templateCode: 'AVOID_PATTERN', params: {pattern: ['N', 'D']}});

        expect(options([rule], [{...rule, id: 2, params: {pattern: ['D', 'N']}}])).toHaveLength(1);
    });

    it('keeps safe relative days but blocks invalid or absolute dates', () => {
        const rule = request({
            kind: 'RULE',
            templateCode: 'SHIFT_COUNT',
            displayLabel: '15일 나이트 제외',
            params: {date: {type: 'DAY_OF_MONTH', day: 15}},
        });

        expect(options([rule])[0]?.unavailable).toBeUndefined();
        expect(options([{...rule, params: {date: {type: 'DAY_OF_MONTH', day: 31}}}])[0]?.unavailable).toBe('date');
        expect(options([{...rule, params: {dates: ['2026-01-15']}}])[0]?.unavailable).toBe('date');
        expect(options([{...rule, displayLabel: '1월 15일 나이트 제외'}])[0]?.unavailable).toBe('date');
    });

    it('validates nested nurse targets against the current roster', () => {
        const rule = request({kind: 'RULE', templateCode: 'MAX_CONSECUTIVE_SHIFT', params: {target: {type: 'NURSE', nurseId: 7}}});

        expect(options([rule])[0]?.unavailable).toBeUndefined();
        expect(options([{...rule, params: {target: {type: 'NURSES', nurseIds: [7, 999]}}}])[0]?.unavailable).toBe('nurse');
        expect(options([{...rule, params: {target: 'ALL'}}])[0]?.unavailable).toBeUndefined();
    });

    it('does not reuse previous-month shift row ids for goals', () => {
        expect(options([request({kind: 'GOAL', targetNurseIds: [99]})])[0]?.unavailable).toBe('nurse');
        expect(options([request({kind: 'GOAL', targetNurseIds: [20]})])[0]?.unavailable).toBeUndefined();
    });
});
