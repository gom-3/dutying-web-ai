import type {CommandContext, CommandResult} from '../../editor-core/command';
import {Command} from '../../editor-core/command';
import type {EditorOp, ReorderRowsOp} from '../../editor-core/operation';
import type {Selection} from '../../editor-core/selection';
import type {Transaction} from '../../editor-core/types';
import type {DutyDoc} from '../doc';

/**
 * 근무자 이름순 정렬.
 * - 정렬 기준은 duty 구현체에만 존재
 * - selection 처리(해제)는 state/UI 정책에서 담당(editor.mdc)
 */
export class SortRowsByNameCommand extends Command<DutyDoc, Selection | null, EditorOp> {
    run(ctx: CommandContext<DutyDoc, Selection | null>): CommandResult<EditorOp> {
        const prevOrder = ctx.doc.rows.map((_, idx) => idx);
        const nextOrder = [...prevOrder].sort((a, b) => {
            const aId = ctx.doc.rows[a]?.workerId;
            const bId = ctx.doc.rows[b]?.workerId;
            const aName = aId ? (ctx.doc.workerMeta[aId]?.name ?? '') : '';
            const bName = bId ? (ctx.doc.workerMeta[bId]?.name ?? '') : '';

            return aName.localeCompare(bName);
        });
        const op: ReorderRowsOp = {kind: 'reorderRows', prevOrder, nextOrder};
        const tx: Transaction<EditorOp> = {ops: [op], source: 'user', timestamp: Date.now()};

        return {ok: true, tx};
    }
}
