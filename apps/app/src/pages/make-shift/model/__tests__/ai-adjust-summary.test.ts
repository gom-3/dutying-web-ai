import type {TScheduleMonthRequestItem} from '@dutying/api/ward';
import {describe, expect, it} from 'vitest';
import {formatInterpretationDates, summarizeInterpretationItems} from '../ai-adjust-summary';

describe('interpretation summary', () => {
    it('compacts consecutive dates without filling in gaps', () => {
        expect(formatInterpretationDates(['2026-10-04', '2026-10-01', '2026-10-02', '2026-10-04', '2026-10-03'], 'ko')).toBe('10월 1~4일');
        expect(formatInterpretationDates(['2026-10-01', '2026-10-02', '2026-10-04', '2026-10-06'], 'ko')).toBe('10월 1~2일, 4일, 6일');
    });
    it('keeps month and year boundaries explicit and preserves invalid values', () => {
        expect(formatInterpretationDates(['2026-10-31', '2026-11-01'], 'ko')).toBe('10월 31일 · 11월 1일');
        expect(formatInterpretationDates(['2026-12-31', '2027-01-01'], 'ko')).toBe('2026년 12월 31일 · 2027년 1월 1일');
        expect(formatInterpretationDates(['2026-02-30'], 'ko')).toBe('2026-02-30');
        expect(formatInterpretationDates(['2026-10-01', '2026-10-02'], 'en')).toBe('Oct 1~2');
    });
    it('groups CELL and CELL_SET for display without changing execution data or merging different people', () => {
        const items: TScheduleMonthRequestItem[] = [
            {kind: 'CELL', nurseId: 1, date: '2026-10-01', shiftCode: 'D'},
            {kind: 'CELL_SET', nurseIds: [1], dates: ['2026-10-02', '2026-10-03'], shiftCode: 'D'},
            {kind: 'CELL', nurseId: 2, date: '2026-10-04', shiftCode: 'D'},
            {kind: 'CELL', nurseId: 1, date: '2026-10-04', shiftCode: 'N'},
        ];
        const original = JSON.stringify(items);

        expect(summarizeInterpretationItems(items)).toMatchObject([
            {kind: 'CELL_SET', nurseIds: [1], dates: ['2026-10-01', '2026-10-02', '2026-10-03'], shiftCode: 'D'},
            {nurseIds: [2], dates: ['2026-10-04'], shiftCode: 'D'},
            {nurseIds: [1], dates: ['2026-10-04'], shiftCode: 'N'},
        ]);
        expect(JSON.stringify(items)).toBe(original);
    });
    it('does not merge away required confirmation metadata', () => {
        const cell: TScheduleMonthRequestItem = {kind: 'CELL', nurseId: 1, date: '2026-10-01', shiftCode: 'D'};

        expect(
            summarizeInterpretationItems([
                cell,
                {...cell, date: '2026-10-02', requiresConfirmation: true, confirmationReasons: ['MULTI_MONTH_SCOPE']},
            ]),
        ).toHaveLength(2);
    });
});
