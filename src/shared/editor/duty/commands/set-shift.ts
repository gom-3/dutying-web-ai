import type {CommandContext, CommandResult} from '../../editor-core/command';
import {Command} from '../../editor-core/command';
import type {EditorOp, SetCellsOp} from '../../editor-core/operation';
import type {Selection} from '../../editor-core/selection';
import type {Transaction} from '../../editor-core/types';
import type {DutyDoc} from '../doc';
import {getSelectionRect} from './_utils';

export class SetShiftCommand extends Command<DutyDoc, Selection | null, EditorOp, [shiftCode: string]> {
    run(ctx: CommandContext<DutyDoc, Selection | null>, shiftCode: string): CommandResult<EditorOp> {
        const rect = getSelectionRect(ctx.selection);

        if (!rect) return {ok: false, reason: 'NO_SELECTION'};

        const {from, to} = rect;
        const cells: SetCellsOp['cells'] = [];

        for (let r = from.row; r <= to.row; r++) {
            const row = ctx.doc.rows[r];

            if (!row) continue;

            for (let c = from.col; c <= to.col; c++) {
                if (c < 0 || c >= ctx.doc.columns.length) continue;

                const prev = row.cells[c] ?? null;
                const next = shiftCode;

                if (prev === next) continue;

                cells.push({row: r, col: c, prev, next});
            }
        }

        const tx: Transaction<EditorOp> = {ops: [{kind: 'setCells', cells}], source: 'user', timestamp: Date.now()};

        return {ok: true, tx};
    }
}
