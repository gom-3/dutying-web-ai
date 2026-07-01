import type {TValidationRes} from '@dutying/api/ward';
import {describe, expect, it} from 'vitest';
import {buildViolationMapAll} from '../../validator';
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
                    period: {startDate: '2026-05-02', endDate: '2026-05-03', dates: ['2026-05-02', '2026-05-03']},
                    affectedCells: [
                        {
                            cellKey: '8753:2026-05-02',
                            shiftNurseId: 8753,
                            nurseName: '김민정',
                            date: '2026-05-02',
                            wardShiftTypeId: 101,
                            shiftCode: 'N',
                        },
                        {
                            cellKey: '8753:2026-05-03',
                            shiftNurseId: 8753,
                            nurseName: '김민정',
                            date: '2026-05-03',
                            wardShiftTypeId: 102,
                            shiftCode: 'O',
                        },
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
                templateCode: 'MIN_OFF_AFTER_N',
                message: '야간 후 휴무가 부족해요.',
                level: 'warning',
                scope: 'nurse',
                period: {startDate: '2026-05-02', endDate: '2026-05-03', dates: ['2026-05-02', '2026-05-03']},
                affectedCells: [
                    {
                        cellKey: '8753:2026-05-02',
                        shiftNurseId: 8753,
                        nurseName: '김민정',
                        date: '2026-05-02',
                        wardShiftTypeId: 101,
                        shiftCode: 'N',
                    },
                    {
                        cellKey: '8753:2026-05-03',
                        shiftNurseId: 8753,
                        nurseName: '김민정',
                        date: '2026-05-03',
                        wardShiftTypeId: 102,
                        shiftCode: 'O',
                    },
                ],
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

    it('maps nurse-pair same-shift violations to the affected nurse cells', () => {
        const validation: TValidationRes = {
            draftRevision: 1,
            rulesHash: 'hash',
            summary: {valid: false, hardCount: 0, softCount: 1, totalCount: 1},
            violations: [
                {
                    violationId: 'v-pair',
                    ruleId: 9004,
                    templateCode: 'NURSE_PAIR_NOT_SAME_SHIFT',
                    severity: 'SOFT',
                    message: '오지현님과 윤정은님은 같은 근무를 할 수 없어요.',
                    affectedCells: [
                        {
                            cellKey: '8753:2026-05-03',
                            shiftNurseId: 8753,
                            nurseName: '오지현',
                            date: '2026-05-03',
                            wardShiftTypeId: 101,
                            shiftCode: 'D',
                        },
                        {
                            cellKey: '8754:2026-05-03',
                            shiftNurseId: 8754,
                            nurseName: '윤정은',
                            date: '2026-05-03',
                            wardShiftTypeId: 101,
                            shiftCode: 'D',
                        },
                    ],
                    fixable: true,
                },
            ],
        };
        const violations = violationsFromSpringValidation(validation, doc);
        const map = buildViolationMapAll(violations, doc);

        expect(violations[0]).toMatchObject({
            level: 'warning',
            scope: 'nurse',
            cells: [
                {row: 0, col: 2},
                {row: 1, col: 2},
            ],
        });
        expect(map.get('8753,2,9004')).toBe(violations[0]);
        expect(map.get('8754,2,9004')).toBeDefined();
    });

    it('preserves display context cells separately from violating cells', () => {
        const validation: TValidationRes = {
            draftRevision: 1,
            rulesHash: 'hash',
            summary: {valid: false, hardCount: 1, softCount: 0, totalCount: 1},
            violations: [
                {
                    violationId: 'v-3',
                    ruleId: 9003,
                    templateCode: 'CORE_MAX_CONTINUOUS_WORK',
                    severity: 'HARD',
                    message: '7일 연속 근무입니다. 최대 5일까지 가능해요.',
                    period: {startDate: '2026-05-06', endDate: '2026-05-07'},
                    affectedCells: [
                        {cellKey: '8753:2026-05-06', shiftNurseId: 8753, date: '2026-05-06', wardShiftTypeId: 101},
                        {cellKey: '8753:2026-05-07', shiftNurseId: 8753, date: '2026-05-07', wardShiftTypeId: 101},
                    ],
                    displayContext: {
                        period: {startDate: '2026-05-01', endDate: '2026-05-07'},
                        affectedCells: Array.from({length: 7}, (_, index) => {
                            const date = `2026-05-0${index + 1}`;

                            return {cellKey: `8753:${date}`, shiftNurseId: 8753, date, wardShiftTypeId: 101};
                        }),
                    },
                    fixable: true,
                },
            ],
        };
        const extendedDoc: TDutyDoc = {
            ...doc,
            columns: Array.from({length: 7}, (_, i) => `2026-05-0${i + 1}`),
            rows: [{...doc.rows[0]!, cells: Array.from({length: 7}, () => 'D')}],
        };
        const violations = violationsFromSpringValidation(validation, extendedDoc);

        expect(violations[0]?.cells).toEqual([
            {row: 0, col: 5},
            {row: 0, col: 6},
        ]);
        expect(violations[0]?.displayContext?.cells).toEqual(Array.from({length: 7}, (_, col) => ({row: 0, col})));
        expect(violations[0]?.displayContext?.period).toEqual({startDate: '2026-05-01', endDate: '2026-05-07'});
    });
});
