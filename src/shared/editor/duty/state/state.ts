import type {EditorOp, ReorderRowsOp, SetCellsOp} from '../../editor-core/operation';
import type {Selection} from '../../editor-core/selection';
import {EditorState} from '../../editor-core/state';
import type {Transaction} from '../../editor-core/types';
import type {Validator, Violation} from '../../editor-core/validation';
import type {DutyDoc} from '../doc';

type DutySelection = Selection | null;

export type DutyEditorStateParams = {
    doc: DutyDoc;
    selection: DutySelection;
    validators?: Array<Validator<DutyDoc>>;
};

export class DutyEditorState extends EditorState<DutyDoc, DutySelection, EditorOp, Violation> {
    readonly doc: DutyDoc;
    readonly selection: DutySelection;
    readonly violations: Violation[];

    private readonly validators: Array<Validator<DutyDoc>>;

    constructor(params: DutyEditorStateParams) {
        super();
        this.doc = params.doc;
        this.selection = params.selection;
        this.validators = params.validators ?? [];
        this.violations = runValidators(this.doc, this.validators);
    }

    apply(tx: Transaction<EditorOp>): DutyEditorState {
        let doc = this.doc;
        let selection = this.selection;

        for (const op of tx.ops) {
            switch (op.kind) {
                case 'setCells':
                    doc = applySetCells(doc, op);
                    break;
                case 'reorderRows':
                    doc = applyReorderRows(doc, op);
                    selection = defaultSelectionAfterReorder(doc);
                    break;
                default: {
                    break;
                }
            }
        }

        return new DutyEditorState({doc, selection, validators: this.validators});
    }

    withSelection(selection: DutySelection): DutyEditorState {
        return new DutyEditorState({doc: this.doc, selection, validators: this.validators});
    }
}

function runValidators(doc: DutyDoc, validators: Array<Validator<DutyDoc>>): Violation[] {
    if (validators.length === 0) return [];

    return validators.flatMap((v) => v(doc));
}

function defaultSelectionAfterReorder(doc: DutyDoc): DutySelection {
    // editor.mdc: 정렬 시 selection은 항상 해제. (UI 정책에 따라 null 또는 (0,0))
    if (doc.rows.length === 0 || doc.columns.length === 0) return null;

    return {type: 'single', anchor: {row: 0, col: 0}};
}

function applySetCells(doc: DutyDoc, op: SetCellsOp): DutyDoc {
    if (op.cells.length === 0) return doc;

    // row별로 묶어서 최소 변경
    const byRow = new Map<number, Array<(cells: (string | null)[]) => void>>();

    for (const c of op.cells) {
        if (c.row < 0 || c.row >= doc.rows.length) continue;

        if (c.col < 0 || c.col >= doc.columns.length) continue;

        const list = byRow.get(c.row) ?? [];

        list.push((cells) => {
            cells[c.col] = c.next;
        });
        byRow.set(c.row, list);
    }

    if (byRow.size === 0) return doc;

    const rows = doc.rows.map((row, idx) => {
        const updates = byRow.get(idx);

        if (!updates) return row;

        const nextCells = [...row.cells];

        for (const u of updates) u(nextCells);

        return {...row, cells: nextCells};
    });

    return {...doc, rows};
}

function applyReorderRows(doc: DutyDoc, op: ReorderRowsOp): DutyDoc {
    const {nextOrder} = op;

    if (nextOrder.length !== doc.rows.length) return doc;

    const rows = nextOrder.map((idx) => doc.rows[idx]).filter(Boolean);

    if (rows.length !== doc.rows.length) return doc;

    return {...doc, rows};
}
