import {describe, expect, it} from 'vitest';
import type {TValidationRes} from '@dutying/api/ward';
import type {TDutyDoc} from '../../types';
import {violationsFromSpringValidation} from '../convert-spring-validation';

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

describe('violationsFromSpringValidation', () => {
    it('maps nurse-specific violations using affectedCells', () => {
        const validation: TValidationRes = {
            draftRevision: 1,
            rulesHash: 'hash',
            summary: {valid: false, hardCount: 0, softCount: 1, totalCount: 1},
            violations: [
                {
                    violationId: 'v-1',
                    ruleId: 9001,
                    templateCode: 'MIN_OFF_AFTER_N',
                    severity: 'SOFT',
                    message: '야간 후 휴무가 부족해요.',
                    affectedCells: [
                        {cellKey: '8753:2026-05-02', shiftNurseId: 8753, date: '2026-05-02', wardShiftTypeId: 101},
                        {cellKey: '8753:2026-05-03', shiftNurseId: 8753, date: '2026-05-03', wardShiftTypeId: 102},
                    ],
                    fixable: true,
                },
            ],
        };

        const violations = violationsFromSpringValidation(validation, doc);

        expect(violations).toEqual([
            {
                ruleId: '9001',
                violationId: 'v-1',
                message: '야간 후 휴무가 부족해요.',
                level: 'warning',
                scope: 'nurse',
                fixable: true,
                cells: [
                    {row: 0, col: 1},
                    {row: 0, col: 2},
                ],
            },
        ]);
    });

    it('maps multi-nurse violations to team scope', () => {
        const validation: TValidationRes = {
            draftRevision: 1,
            rulesHash: 'hash',
            summary: {valid: false, hardCount: 1, softCount: 0, totalCount: 1},
            violations: [
                {
                    violationId: 'v-2',
                    ruleId: 9002,
                    templateCode: 'MIN_STAFF_BY_SHIFT',
                    severity: 'HARD',
                    message: 'E 근무 인원이 부족해요.',
                    affectedCells: [
                        {cellKey: '8753:2026-05-03', shiftNurseId: 8753, date: '2026-05-03', wardShiftTypeId: 101},
                        {cellKey: '8754:2026-05-03', shiftNurseId: 8754, date: '2026-05-03', wardShiftTypeId: 102},
                    ],
                    fixable: true,
                },
            ],
        };

        const violations = violationsFromSpringValidation(validation, doc);

        expect(violations[0]).toMatchObject({
            level: 'error',
            scope: 'team',
            cells: [
                {row: 0, col: 2},
                {row: 1, col: 2},
            ],
        });
    });
});
