import {describe, expect, it} from 'vitest';
import {type SetCellsOp} from '../editor-core';
import {PasteShiftCommand, SetShiftCommand, SortRowsByNameCommand} from './commands';
import {createColumnsByYearMonth, DutyGridDoc} from './doc';
import type {DutyDoc} from './doc';
import {DutyEditorState} from './state';
import {createDutyValidator} from './validation';

describe('duty/doc', () => {
    it('createColumnsByYearMonth는 해당 월의 일수를 YYYY-MM-DD로 생성한다', () => {
        const cols = createColumnsByYearMonth(2024, 2); // leap year

        expect(cols[0]).toBe('2024-02-01');
        expect(cols[cols.length - 1]).toBe('2024-02-29');
        expect(cols.length).toBe(29);
    });

    it('DutyGridDoc은 rows/columns 기반으로 GridDoc을 제공한다', () => {
        const doc: DutyDoc = {
            columns: ['2025-01-01', '2025-01-02'],
            rows: [{workerId: 'w1', cells: ['D', null]}],
            workerMeta: {w1: {name: 'Kim'}},
        };
        const grid = new DutyGridDoc(doc);

        expect(grid.rowCount).toBe(1);
        expect(grid.colCount).toBe(2);
        expect(grid.getCell(0, 0)).toBe('D');
        expect(grid.getCell(0, 1)).toBeNull();
    });
});

describe('duty/commands', () => {
    const baseDoc: DutyDoc = {
        columns: ['2025-01-01', '2025-01-02'],
        rows: [
            {workerId: 'w1', cells: [null, null]},
            {workerId: 'w2', cells: ['N', null]},
        ],
        workerMeta: {w1: {name: 'B'}, w2: {name: 'A'}},
    };

    it('SetShiftCommand는 selection 범위에 동일 shiftCode를 setCells로 만든다', () => {
        const cmd = new SetShiftCommand();
        const res = cmd.run({doc: baseDoc, selection: {type: 'range', from: {row: 0, col: 0}, to: {row: 1, col: 0}}}, 'D');

        expect(res.ok).toBe(true);

        if (!res.ok) return;

        expect(res.tx.ops).toHaveLength(1);
        expect(res.tx.ops[0].kind).toBe('setCells');
        expect((res.tx.ops[0] as SetCellsOp).cells).toEqual([
            {row: 0, col: 0, prev: null, next: 'D'},
            {row: 1, col: 0, prev: 'N', next: 'D'},
        ]);
    });

    it('PasteShiftCommand는 clipboard payload를 selection 좌상단 기준으로 잘라 붙인다', () => {
        const cmd = new PasteShiftCommand();
        const res = cmd.run(
            {doc: baseDoc, selection: {type: 'single', anchor: {row: 0, col: 1}}},
            {width: 2, height: 1, cells: [['D', 'E']]},
        );

        expect(res.ok).toBe(true);

        if (!res.ok) return;

        expect(res.tx.ops[0].kind).toBe('setCells');
        expect((res.tx.ops[0] as SetCellsOp).cells).toEqual([{row: 0, col: 1, prev: null, next: 'D'}]);
    });

    it('SortRowsByNameCommand는 workerMeta.name 기준으로 reorderRows op를 만든다', () => {
        const cmd = new SortRowsByNameCommand();
        const res = cmd.run({doc: baseDoc, selection: null});

        expect(res.ok).toBe(true);

        if (!res.ok) return;

        expect(res.tx.ops[0]).toEqual({kind: 'reorderRows', prevOrder: [0, 1], nextOrder: [1, 0]});
    });
});

describe('duty/state', () => {
    it('apply(setCells)는 doc을 immutable하게 갱신한다', () => {
        const doc: DutyDoc = {
            columns: ['2025-01-01'],
            rows: [{workerId: 'w1', cells: [null]}],
            workerMeta: {w1: {name: 'Kim'}},
        };
        const state = new DutyEditorState({doc, selection: {type: 'single', anchor: {row: 0, col: 0}}});
        const next = state.apply({
            ops: [{kind: 'setCells', cells: [{row: 0, col: 0, prev: null, next: 'D'}]}],
            source: 'user',
            timestamp: 1,
        });

        expect(next.doc).not.toBe(doc);
        expect(next.doc.rows[0]).not.toBe(doc.rows[0]);
        expect(next.doc.rows[0]?.cells[0]).toBe('D');
    });

    it('apply(reorderRows)는 rows를 재정렬하고 selection을 초기화한다', () => {
        const doc: DutyDoc = {
            columns: ['2025-01-01'],
            rows: [
                {workerId: 'w1', cells: ['A']},
                {workerId: 'w2', cells: ['B']},
            ],
            workerMeta: {w1: {name: 'B'}, w2: {name: 'A'}},
        };
        const state = new DutyEditorState({doc, selection: {type: 'single', anchor: {row: 1, col: 0}}});
        const next = state.apply({
            ops: [{kind: 'reorderRows', prevOrder: [0, 1], nextOrder: [1, 0]}],
            source: 'user',
            timestamp: 1,
        });

        expect(next.doc.rows.map((r) => r.workerId)).toEqual(['w2', 'w1']);
        expect(next.selection).toEqual({type: 'single', anchor: {row: 0, col: 0}});
    });
});

describe('duty/validation', () => {
    it('maxContinuousNight 규칙이 위반되면 error violation이 생성된다', () => {
        const doc: DutyDoc = {
            columns: ['d1', 'd2', 'd3', 'd4'],
            rows: [{workerId: 'w1', cells: ['N', 'N', 'N', null]}],
            workerMeta: {w1: {name: 'Kim'}},
        };
        const validator = createDutyValidator({
            wardConstraint: {
                maxContinuousWork: false,
                maxContinuousWorkVal: 3,
                minNightInterval: false,
                minNightIntervalVal: 2,
                maxContinuousNight: true,
                maxContinuousNightVal: 2,
                minContinuousNight: false,
                minContinuousNightVal: 2,
                minOffAssignAfterNight: false,
                minOffAssignAfterNightVal: 2,
                excludeCertainWorkTypes: false,
                excludeNightBeforeReqOff: false,
            },
        });
        const v = validator(doc);

        expect(v.some((x) => x.ruleId === 'duty.maxContinuousNight' && x.level === 'error')).toBe(true);
    });
});
