import type {GridDoc} from '../grid';
import type {SetCellsOp} from '../operation';
import type {Selection} from '../selection';
import {normalizeRange} from '../selection';
import type {ClipboardPayload} from './types';

/**
 * payload를 selection 좌상단 기준으로 붙여넣는다.
 * - 범위 초과는 자동으로 잘라서 적용
 * - 결과는 항상 SetCellsOp 1개(실패/에러 없음)
 */
export function paste(payload: ClipboardPayload, selection: Selection | null, doc: GridDoc): SetCellsOp {
    if (!selection) return {kind: 'setCells', cells: []};

    if (payload.width <= 0 || payload.height <= 0) return {kind: 'setCells', cells: []};

    if (doc.rowCount <= 0 || doc.colCount <= 0) return {kind: 'setCells', cells: []};

    const {from} = normalizeRange(selection);
    const startRow = from.row;
    const startCol = from.col;
    const cells: SetCellsOp['cells'] = [];

    for (let r = 0; r < payload.height; r++) {
        const rowCells = payload.cells[r];

        if (!rowCells) continue;

        for (let c = 0; c < payload.width; c++) {
            const next = rowCells[c] ?? null;
            const tr = startRow + r;
            const tc = startCol + c;

            if (tr < 0 || tr >= doc.rowCount) continue;

            if (tc < 0 || tc >= doc.colCount) continue;

            const prev = doc.getCell(tr, tc);

            if (prev === next) continue;

            cells.push({row: tr, col: tc, prev, next});
        }
    }

    return {kind: 'setCells', cells};
}
