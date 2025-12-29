import {describe, expect, it} from 'vitest';
import type {DutyDoc} from '../duty/doc';
import {DutyEditorState} from '../duty/state';
import {MemoryEditorHistory} from '../editor-core/history';
import type {EditorOp} from '../editor-core/operation';
import {invertOps} from '../editor-core/operation';
import type {Selection} from '../editor-core/selection';
import type {Violation} from '../editor-core/validation';
import {EditorStore} from './store';

function deriveSelection(args: {tx: {ops: EditorOp[]}; prevSelection: Selection | null}): Selection | null {
    const lastOp = args.tx.ops[args.tx.ops.length - 1];

    if (!lastOp) return args.prevSelection;

    if (lastOp.kind === 'setCells') {
        const lastCell = lastOp.cells[lastOp.cells.length - 1];

        if (!lastCell) return args.prevSelection;

        return {type: 'single', anchor: {row: lastCell.row, col: lastCell.col}};
    }

    return {type: 'single', anchor: {row: 0, col: 0}};
}

describe('editor-store/EditorStore', () => {
    it('applyTransaction → undo → redo가 transaction 단위로 동작한다', () => {
        const doc: DutyDoc = {
            columns: ['d1'],
            rows: [{workerId: 'w1', cells: [null]}],
            workerMeta: {w1: {name: 'Kim'}},
        };
        const initialState = new DutyEditorState({doc, selection: {type: 'single', anchor: {row: 0, col: 0}}});
        const history = new MemoryEditorHistory<EditorOp, Selection | null>(10);
        const store = new EditorStore<DutyDoc, Selection | null, EditorOp, Violation>({
            initialState,
            history,
            deriveNextSelection: ({tx, prevSelection}) => deriveSelection({tx, prevSelection}),
        });
        const tx = {
            ops: [{kind: 'setCells', cells: [{row: 0, col: 0, prev: null, next: 'D'}]}] as EditorOp[],
            source: 'user' as const,
            timestamp: 1,
        };

        store.applyTransaction(tx, invertOps(tx.ops));
        expect(store.state.doc.rows[0]?.cells[0]).toBe('D');

        store.undo((inverseOps) => ({ops: inverseOps, source: 'system', timestamp: 2}));
        expect(store.state.doc.rows[0]?.cells[0]).toBeNull();

        store.redo();
        expect(store.state.doc.rows[0]?.cells[0]).toBe('D');
    });
});
