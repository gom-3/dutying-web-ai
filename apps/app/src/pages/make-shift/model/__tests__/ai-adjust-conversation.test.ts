import {describe, expect, it} from 'vitest';
import type {TDutyDoc} from '@/features/shift-editor';
import {describeAdjustChanges, mergeAdjustPatch, prepareAdjustDoc} from '../ai-adjust-conversation';

const doc: TDutyDoc = {
    columns: ['2026-10-01', '2026-10-02'],
    rows: [{workerId: '10', cells: ['D', 'N']}],
    workerMeta: {'10': {name: '김서현', nurseId: 1}},
    fixedCells: {},
    requestCells: {},
};

describe('staged adjustment cells', () => {
    it('stages cells and locks without mutating the current draft', () => {
        const staged = prepareAdjustDoc(doc, [{nurseId: 1, date: '2026-10-01', shiftCode: 'O'}], ['D', 'N', 'O']);

        expect(doc.rows[0]!.cells).toEqual(['D', 'N']);
        expect(doc.fixedCells).toEqual({});
        expect(staged.rows[0]!.cells).toEqual(['O', 'N']);
        expect(staged.fixedCells).toEqual({'10|2026-10-01': true});
    });
    it.each([
        {nurseId: 999, date: '2026-10-01', shiftCode: 'O'},
        {nurseId: 1, date: '2026-11-01', shiftCode: 'O'},
        {nurseId: 1, date: '2026-10-01', shiftCode: 'UNKNOWN'},
    ])('rejects unresolved cell selectors without partially applying valid cells', (cell) => {
        expect(() => prepareAdjustDoc(doc, [{nurseId: 1, date: '2026-10-01', shiftCode: 'O'}, cell], ['D', 'N', 'O'])).toThrow(
            'INVALID_CELL',
        );
        expect(doc.rows[0]!.cells).toEqual(['D', 'N']);
    });
    it.each(['fixedCells', 'requestCells'] as const)('protects %s from conflicting instructions', (field) => {
        const locked = {...doc, [field]: {'10|2026-10-01': true}} as TDutyDoc;

        expect(() => prepareAdjustDoc(locked, [{nurseId: 1, date: '2026-10-01', shiftCode: 'O'}], ['D', 'N', 'O'])).toThrow('LOCKED_CELL');
    });
    it('merges the patch around staged locks and describes the actual before/after changes', () => {
        const staged = prepareAdjustDoc(doc, [{nurseId: 1, date: '2026-10-01', shiftCode: 'O'}], ['D', 'N', 'O']);
        const patched = mergeAdjustPatch(
            staged,
            [
                {shiftNurseId: 10, date: '2026-10-01', shiftCode: 'N'},
                {shiftNurseId: 10, date: '2026-10-02', wardShiftTypeId: 20},
            ] as never,
            new Map([[20, 'D']]),
        );

        expect(patched.rows[0]!.cells).toEqual(['O', 'D']);
        expect(describeAdjustChanges(doc, patched)).toEqual([
            {name: '김서현', date: '2026-10-01', before: 'D', after: 'O'},
            {name: '김서현', date: '2026-10-02', before: 'N', after: 'D'},
        ]);
    });
});
