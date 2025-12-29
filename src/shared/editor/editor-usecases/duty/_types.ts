import type {DutyDoc} from '../../duty/doc';
import type {EditorOp} from '../../editor-core/operation';
import type {Selection} from '../../editor-core/selection';
import type {Violation} from '../../editor-core/validation';
import type {EditorStore} from '../../editor-store/store';

export type DutyEditorStore = EditorStore<DutyDoc, Selection | null, EditorOp, Violation>;
