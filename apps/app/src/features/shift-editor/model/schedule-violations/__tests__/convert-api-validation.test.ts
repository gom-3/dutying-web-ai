import {beforeEach, describe, expect, it} from 'vitest';
import type {TAiValidation} from '@dutying/api/ward';
import i18n from '@/i18n';
import type {TDutyDoc} from '../../types';
import {violationsFromApiValidation} from '../convert-api-validation';

const doc: TDutyDoc = {
    columns: Array.from({length: 5}, (_, i) => `2026-05-0${i + 1}`),
    rows: [
        {workerId: '8753', cells: ['D', 'N', 'O', 'E', 'D']},
        {workerId: '8754', cells: ['E', 'D', 'D', 'N', 'O']},
    ],
    workerMeta: {
        8753: {name: '김민정', nurseId: 3414},
        8754: {name: '이서연', nurseId: 3415},
    },
    fixedCells: {},
    requestCells: {},
};

describe('violationsFromApiValidation', () => {
    beforeEach(async () => {
        await i18n.changeLanguage('ko');
    });

    it('maps nurse-specific soft violations to warning level with nurse row', () => {
        const validation: TAiValidation = {
            valid: false,
            hard_constraints_violated: [],
            soft_constraints_violated: [
                {
                    id: 'L2_MIN_OFF_AFTER_NIGHT:3414',
                    severity: 'SOFT',
                    title: '야간 후 휴무 부족',
                    message: 'Nurse 3414 has 1 off days after night shift, but 2 are required.',
                    nurse_id: '3414',
                    period: {start_day: 2, end_day: 4},
                },
            ],
            warnings: [],
        };

        const violations = violationsFromApiValidation(validation, doc);

        expect(violations).toEqual([
            {
                ruleId: 'llm.L2_MIN_OFF_AFTER_NIGHT:3414',
                message: '야간 후 휴무가 1일이라 2일보다 부족해요.',
                level: 'warning',
                scope: 'nurse',
                cells: [
                    {row: 0, col: 1},
                    {row: 0, col: 2},
                    {row: 0, col: 3},
                ],
            },
        ]);
    });

    it('maps team hard violations to a single division-column overlay', () => {
        const validation: TAiValidation = {
            valid: false,
            hard_constraints_violated: [
                {
                    id: 'L3_MIN_STAFF_SHORTAGE:E:2026-05-03',
                    severity: 'HARD',
                    title: '필요 인원 부족',
                    message: 'E shift staffing is low',
                    nurse_id: null,
                    affected_days: [3],
                },
            ],
            soft_constraints_violated: [],
            warnings: [],
        };

        const violations = violationsFromApiValidation(validation, doc);

        expect(violations).toHaveLength(1);
        expect(violations[0]).toMatchObject({
            message: 'E 근무 인원이 부족해요.',
            level: 'error',
            scope: 'team',
            cells: [{row: 0, col: 2}],
        });
    });

    it('uses the translated title instead of exposing unknown English details', () => {
        const validation: TAiValidation = {
            valid: false,
            hard_constraints_violated: [],
            soft_constraints_violated: [
                {
                    id: 'UNKNOWN_ENGLISH:3415',
                    severity: 'SOFT',
                    title: '제약 조건 확인 필요',
                    message: 'Some new English validator detail.',
                    nurse_id: '3415',
                    period: {start_day: 4, end_day: 4},
                },
            ],
            warnings: [],
        };

        const violations = violationsFromApiValidation(validation, doc);

        expect(violations[0]?.message).toBe('제약 조건 확인 필요');
    });

    it('formats message_key with the active locale', async () => {
        await i18n.changeLanguage('ja');

        const validation: TAiValidation = {
            valid: false,
            hard_constraints_violated: [
                {
                    id: 'L1_CONSECUTIVE_WORK:3414',
                    type: 'L1_CONSECUTIVE_WORK',
                    severity: 'HARD',
                    title: '연속 근무일 초과',
                    message: 'Nurse 3414 works 6 consecutive days, exceeding the limit of 5.',
                    message_key: 'schedule.validation.l1ConsecutiveWork',
                    message_args: {
                        nurse_id: '3414',
                        nurse_name: 'Kim',
                        actual: 6,
                        expected: 5,
                    },
                    nurse_id: '3414',
                    period: {start_day: 1, end_day: 5},
                },
            ],
            soft_constraints_violated: [],
            warnings: [],
        };

        const violations = violationsFromApiValidation(validation, doc);

        expect(violations[0]?.message).toBe('連続勤務が6日で、5日の上限を超えています。');
    });
});
