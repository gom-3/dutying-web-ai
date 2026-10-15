import {describe, expect, it} from 'vitest';
import {reviewConditions} from './ai-ux-review-request';

const names = ['간호사 1', '신규 간호사 2', '간호사 3'];

describe('local review request fixtures', () => {
    it('grounds the reported request in nurse 1 only, through the fifth day', () => {
        const text = '간호사 1 5일까지 N 없게 해줘.';
        const conditions = reviewConditions(text, names, 2026, 11);

        expect(conditions).toHaveLength(1);
        expect(conditions?.[0]).toMatchObject({
            nurseIds: [1],
            action: 'FORBID',
            shiftCodes: ['N'],
            sourceSpan: {quote: text},
            dates: ['2026-11-01', '2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05'],
        });
    });
    it('keeps two conditions only when both were actually requested', () => {
        const text = '신규 간호사 2는 11월 1~5일 N 근무 없이 배정하고, 간호사 3은 12일 O로 배정해줘.';
        const conditions = reviewConditions(text, names, 2026, 11);

        expect(conditions).toHaveLength(2);
        expect(conditions?.[0]).toMatchObject({nurseIds: [2], action: 'FORBID', shiftCodes: ['N']});
        expect(conditions?.[1]).toMatchObject({nurseIds: [3], action: 'ASSIGN', shiftCodes: ['O'], dates: ['2026-11-12']});
    });
    it('respects the requested start date and shift instead of the example defaults', () => {
        expect(reviewConditions('간호사 3 3~7일 E 근무 제외해줘.', names, 2026, 11)?.[0]).toMatchObject({
            nurseIds: [3],
            shiftCodes: ['E'],
            action: 'FORBID',
            dates: ['2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06', '2026-11-07'],
        });
    });
    it.each([
        '간호사 9 5일까지 N 없게 해줘.',
        '간호사 1 31일까지 N 없게 해줘.',
        '간호사 1 10월 5일까지 N 없게 해줘.',
        '간호사 1 5일까지 N 없게 해줘. 오프도 공평하게 해줘.',
        '간호사 1 5일까지 N 없게 해줘. 간호사 3은 야간 6개 이하로 해줘.',
    ])('does not silently replace or drop an unsupported part: %s', (text) => {
        expect(reviewConditions(text, names, 2026, 11)).toBeNull();
    });
});
