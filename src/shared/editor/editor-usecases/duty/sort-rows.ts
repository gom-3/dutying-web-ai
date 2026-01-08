import type {SortRowsByNameCommand} from '../../duty/commands';
import type {DutyDoc} from '../../duty/doc';
import type {CommandResult} from '../../editor-core/command';
import type {EditorOp} from '../../editor-core/operation';
import type {Selection} from '../../editor-core/selection';
import type {Violation} from '../../editor-core/validation';
import type {EditorStore} from '../../editor-store/store';
import {inverseFromTx} from './_helpers';

export class SortRowsUseCase {
    constructor(
        private readonly store: EditorStore<DutyDoc, Selection | null, EditorOp, Violation>,
        private readonly command: SortRowsByNameCommand,
    ) {}

    execute(): CommandResult<EditorOp> {
        const res = this.command.run({doc: this.store.state.doc, selection: this.store.state.selection});

        if (!res.ok) return res;

        this.store.applyTransaction(res.tx, inverseFromTx(res.tx));

        return res;
    }
}
