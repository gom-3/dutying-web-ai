import {describe, expect, it} from 'vitest';
import {ClearShiftCommand, PasteShiftCommand, SetShiftCommand, SortRowsByNameCommand} from '../../duty/commands';
import type {DutyDoc} from '../../duty/doc';
import {DutyEditorState} from '../../duty/state';
import type {ClipboardPayload} from '../../editor-core/clipboard';
import {MemoryEditorHistory} from '../../editor-core/history';
import type {EditorOp} from '../../editor-core/operation';
import type {Selection} from '../../editor-core/selection';
import type {Violation} from '../../editor-core/validation';
import {EditorStore} from '../../editor-store/store';
import {ClearShiftUseCase} from './clear-shift';
import {PasteUseCase} from './paste';
import {RedoUseCase} from './redo';
import {SetShiftUseCase} from './set-shift';
import {SortRowsUseCase} from './sort-rows';
import {UndoUseCase} from './undo';

function createStore(doc: DutyDoc, selection: Selection | null) {
    const initialState = new DutyEditorState({doc, selection});
    const history = new MemoryEditorHistory<EditorOp, Selection | null>(50);

    return new EditorStore<DutyDoc, Selection | null, EditorOp, Violation>({initialState, history});
}

describe('editor-usecases/duty', () => {
    it('SetShiftUseCase는 tx를 store에 적용하고 undo로 되돌릴 수 있다', () => {
        const doc: DutyDoc = {
            columns: ['d1'],
            rows: [{workerId: 'w1', cells: [null]}],
            workerMeta: {w1: {name: 'Kim'}},
        };
        const store = createStore(doc, {type: 'single', anchor: {row: 0, col: 0}});
        const uc = new SetShiftUseCase(store, new SetShiftCommand());
        const undo = new UndoUseCase(store);
        const redo = new RedoUseCase(store);

        uc.execute('D');
        expect(store.state.doc.rows[0]?.cells[0]).toBe('D');

        undo.execute();
        expect(store.state.doc.rows[0]?.cells[0]).toBeNull();

        redo.execute();
        expect(store.state.doc.rows[0]?.cells[0]).toBe('D');
    });

    it('ClearShiftUseCase는 선택 범위를 null로 만든다', () => {
        const doc: DutyDoc = {
            columns: ['d1', 'd2'],
            rows: [{workerId: 'w1', cells: ['N', 'D']}],
            workerMeta: {w1: {name: 'Kim'}},
        };
        const store = createStore(doc, {type: 'range', from: {row: 0, col: 0}, to: {row: 0, col: 1}});
        const uc = new ClearShiftUseCase(store, new ClearShiftCommand());

        uc.execute();
        expect(store.state.doc.rows[0]?.cells).toEqual([null, null]);
    });

    it('PasteUseCase는 clipboard payload를 selection 좌상단 기준으로 붙인다', () => {
        const doc: DutyDoc = {
            columns: ['d1', 'd2'],
            rows: [{workerId: 'w1', cells: [null, null]}],
            workerMeta: {w1: {name: 'Kim'}},
        };
        const store = createStore(doc, {type: 'single', anchor: {row: 0, col: 1}});
        const uc = new PasteUseCase(store, new PasteShiftCommand());
        const payload: ClipboardPayload = {width: 1, height: 1, cells: [['E']]};

        uc.execute(payload);

        expect(store.state.doc.rows[0]?.cells).toEqual([null, 'E']);
    });

    it('SortRowsUseCase는 이름순 reorderRows를 적용하고 selection을 초기화한다', () => {
        const doc: DutyDoc = {
            columns: ['d1'],
            rows: [
                {workerId: 'w1', cells: ['A']},
                {workerId: 'w2', cells: ['B']},
            ],
            workerMeta: {w1: {name: 'B'}, w2: {name: 'A'}},
        };
        const store = createStore(doc, {type: 'single', anchor: {row: 1, col: 0}});
        const uc = new SortRowsUseCase(store, new SortRowsByNameCommand());

        uc.execute();
        expect(store.state.doc.rows.map((r) => r.workerId)).toEqual(['w2', 'w1']);
        expect(store.state.selection).toEqual({type: 'single', anchor: {row: 0, col: 0}});
    });
});
