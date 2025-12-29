import {singleton} from 'tsyringe';
import type {DutyDoc} from '../../duty/doc';
import type {EditorOp} from '../../editor-core/operation';
import type {Selection} from '../../editor-core/selection';
import type {Violation} from '../../editor-core/validation';
import {EditorStore} from '../../editor-store/store';

@singleton()
export class RedoUseCase {
    constructor(private readonly store: EditorStore<DutyDoc, Selection | null, EditorOp, Violation>) {}

    execute(): void {
        this.store.redo();
    }
}
