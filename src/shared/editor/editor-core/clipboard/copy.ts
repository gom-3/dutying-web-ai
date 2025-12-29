import type {GridDoc} from '../grid';
import type {Selection} from '../selection';
import {normalizeRange} from '../selection';
import type {ClipboardPayload} from './types';

/**
 * selection을 정규화된 직사각형으로 변환하여 2D payload로 복사한다.
 * - selection이 null이면 빈 payload 반환
 */
export function copy(selection: Selection | null, doc: GridDoc): ClipboardPayload {
    if (!selection) return {width: 0, height: 0, cells: []};

    const {from, to} = normalizeRange(selection);
    const fromRow = Math.max(0, Math.min(doc.rowCount - 1, from.row));
    const toRow = Math.max(0, Math.min(doc.rowCount - 1, to.row));
    const fromCol = Math.max(0, Math.min(doc.colCount - 1, from.col));
    const toCol = Math.max(0, Math.min(doc.colCount - 1, to.col));

    if (doc.rowCount <= 0 || doc.colCount <= 0) return {width: 0, height: 0, cells: []};

    if (fromRow > toRow || fromCol > toCol) return {width: 0, height: 0, cells: []};

    const height = toRow - fromRow + 1;
    const width = toCol - fromCol + 1;
    const cells = Array.from({length: height}, (_, r) => Array.from({length: width}, (_, c) => doc.getCell(fromRow + r, fromCol + c)));

    return {width, height, cells};
}
