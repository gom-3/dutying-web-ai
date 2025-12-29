import {makeAutoObservable} from 'mobx';
import type {EditorHistory, HistoryEntry} from '../editor-core/history';
import type {EditorState} from '../editor-core/state';
import type {Transaction} from '../editor-core/types';

type SelectionDeriver<Doc, Sel, Op> = (args: {tx: Transaction<Op>; prevSelection: Sel; nextDoc: Doc}) => Sel;

/**
 * Store는 세션 단위 mutable 상태의 유일한 소유자.
 * - Transaction 적용 파이프라인
 * - undo/redo
 * - dispose 시작점
 */
export class EditorStore<Doc, Sel, Op, Vio> {
    state: EditorState<Doc, Sel, Op, Vio>;
    history: EditorHistory<Op, Sel>;
    private readonly deriveNextSelection?: SelectionDeriver<Doc, Sel, Op>;

    constructor(opts: {
        initialState: EditorState<Doc, Sel, Op, Vio>;
        history: EditorHistory<Op, Sel>;
        deriveNextSelection?: SelectionDeriver<Doc, Sel, Op>;
    }) {
        this.state = opts.initialState;
        this.history = opts.history;
        this.deriveNextSelection = opts.deriveNextSelection;
        makeAutoObservable(this);
    }

    applyTransaction(tx: Transaction<Op>, inverseOps: Op[]): void {
        const prevSelection = this.state.selection;
        const nextState = this.state.apply(tx);
        const nextSelection = this.deriveNextSelection
            ? this.deriveNextSelection({tx, prevSelection, nextDoc: nextState.doc})
            : nextState.selection;
        const entry: HistoryEntry<Op, Sel> = {tx, inverseOps, prevSelection, nextSelection};

        this.history.push(entry);
        this.state = nextState.withSelection(nextSelection);
    }

    undo(makeSystemTx: (inverseOps: Op[]) => Transaction<Op>): void {
        const entry = this.history.undo();

        if (!entry) return;

        const nextState = this.state.apply(makeSystemTx(entry.inverseOps));

        this.state = nextState.withSelection(entry.prevSelection);
    }

    redo(): void {
        const entry = this.history.redo();

        if (!entry) return;

        const nextState = this.state.apply(entry.tx);

        this.state = nextState.withSelection(entry.nextSelection);
    }

    dispose(): void {
        this.state.dispose();
        this.history.dispose();
    }
}
