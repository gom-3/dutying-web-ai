import {normalizeSelection} from './selection';
import {isDutyCellPositionInBounds, readDutyCell} from './duty-doc-cells';
import type {TClipboardPayload, TDutyDoc, TSelection, TSetCellsOp} from './types';

export function copySelection(doc: TDutyDoc, selection: TSelection | null): TClipboardPayload | null {
    if (!selection) return null;

    const {top, left, bottom, right} = normalizeSelection(selection);
    const height = bottom - top + 1;
    const width = right - left + 1;
    const cells: TClipboardPayload['cells'] = [];

    for (let r = 0; r < height; r++) {
        const row: TClipboardPayload['cells'][number] = [];

        for (let c = 0; c < width; c++) {
            const docRow = doc.rows[top + r];

            row.push(docRow ? readDutyCell(docRow, left + c) : null);
        }

        cells.push(row);
    }

    return {width, height, cells};
}

export function pastePayload(payload: TClipboardPayload, selection: TSelection, doc: TDutyDoc): TSetCellsOp {
    const rect = selection.type === 'single' ? null : normalizeSelection(selection);
    const startRow = selection.type === 'single' ? selection.anchor.row : rect!.top;
    const startCol = selection.type === 'single' ? selection.anchor.col : rect!.left;
    const cells: TSetCellsOp['cells'] = [];

    for (let r = 0; r < payload.height; r++) {
        for (let c = 0; c < payload.width; c++) {
            const row = startRow + r;
            const col = startCol + c;

            if (!isDutyCellPositionInBounds(doc, row, col)) continue; // 자동 자르기

            const docRow = doc.rows[row];

            if (!docRow) continue;

            const prev = readDutyCell(docRow, col);
            const next = payload.cells[r]?.[c] ?? null;

            if (prev !== next) {
                cells.push({row, col, prev, next});
            }
        }
    }

    return {kind: 'setCells', cells};
}
