import type {ClipboardPayload} from '../../editor-core/clipboard';
import {paste} from '../../editor-core/clipboard';
import type {CommandContext, CommandResult} from '../../editor-core/command';
import {Command} from '../../editor-core/command';
import type {EditorOp} from '../../editor-core/operation';
import type {Selection} from '../../editor-core/selection';
import type {Transaction} from '../../editor-core/types';
import {DutyGridDoc} from '../doc';
import type {DutyDoc} from '../doc';

/**
 * ClipboardPayload → SetCellsOp 변환 커맨드.
 * - 결과는 항상 Tx 1개(SetCellsOp 1개)
 * - 실패/에러 없음(editor.mdc 스펙)
 */
export class PasteShiftCommand extends Command<DutyDoc, Selection | null, EditorOp, [payload: ClipboardPayload]> {
    run(ctx: CommandContext<DutyDoc, Selection | null>, payload: ClipboardPayload): CommandResult<EditorOp> {
        const gridDoc = new DutyGridDoc(ctx.doc);
        const op = paste(payload, ctx.selection, gridDoc);
        const tx: Transaction<EditorOp> = {ops: [op], source: 'user', timestamp: Date.now()};

        return {ok: true, tx};
    }
}
