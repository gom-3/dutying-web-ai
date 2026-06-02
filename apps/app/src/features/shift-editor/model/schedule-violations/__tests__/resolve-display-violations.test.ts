import {describe, expect, it} from 'vitest';
import type {TValidationRes} from '@dutying/api/ward';
import type {TDutyDoc, TViolation} from '../../types';
import {createScheduleValidationSnapshot, resolveScheduleDisplayViolations} from '../resolve-display-violations';

const doc: TDutyDoc = {
    columns: ['2026-05-01', '2026-05-02', '2026-05-03'],
    rows: [{workerId: '1', cells: ['D', 'N', 'O']}],
    workerMeta: {1: {name: 'Kim', nurseId: 10}},
    fixedCells: {},
    requestCells: {},
};

const validation: TValidationRes = {
    draftRevision: 1,
    rulesHash: 'hash',
    summary: {valid: false, hardCount: 0, softCount: 1, totalCount: 1},
    violations: [
        {
            violationId: 'v-1',
            ruleId: 1,
            templateCode: 'TEST',
            severity: 'SOFT',
            message: 'msg',
            affectedCells: [
                {cellKey: '1:2026-05-01', shiftNurseId: 1, date: '2026-05-01', wardShiftTypeId: null},
                {cellKey: '1:2026-05-02', shiftNurseId: 1, date: '2026-05-02', wardShiftTypeId: null},
            ],
            fixable: true,
        },
    ],
};

describe('resolveScheduleDisplayViolations', () => {
    it('re-derives cells from snapshot when doc rows change', () => {
        const snapshot = createScheduleValidationSnapshot(validation);
        const reorderedDoc: TDutyDoc = {
            ...doc,
            rows: [{workerId: '99', cells: ['O', 'D', 'N']}],
            workerMeta: {99: {name: 'Other', nurseId: 10}},
        };

        const violations = resolveScheduleDisplayViolations(reorderedDoc, snapshot, []);

        expect(violations[0]?.cells).toEqual([
            {row: 0, col: 0},
            {row: 0, col: 1},
        ]);
    });

    it('falls back to legacy violations when snapshot is absent', () => {
        const legacy: TViolation[] = [
            {
                ruleId: 'legacy',
                message: 'legacy msg',
                level: 'warning',
                cells: [{row: 0, col: 0}],
            },
        ];

        expect(resolveScheduleDisplayViolations(doc, null, legacy)).toEqual(legacy);
    });
});
