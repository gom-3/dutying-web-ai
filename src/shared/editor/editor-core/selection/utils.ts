import {clampPos, type GridBounds} from './model';
import type {CellPos, Selection} from './types';

export type NormalizedRange = {from: CellPos; to: CellPos};

export function normalizeRange(sel: Selection): NormalizedRange {
    if (sel.type === 'single') return {from: sel.anchor, to: sel.anchor};

    const fromRow = Math.min(sel.from.row, sel.to.row);
    const toRow = Math.max(sel.from.row, sel.to.row);
    const fromCol = Math.min(sel.from.col, sel.to.col);
    const toCol = Math.max(sel.from.col, sel.to.col);

    return {
        from: {row: fromRow, col: fromCol},
        to: {row: toRow, col: toCol},
    };
}

export function moveSelection(
    selection: Selection | null,
    dir: 'left' | 'right' | 'up' | 'down',
    bounds: GridBounds,
    shiftKey: boolean,
    jumpToEdge: boolean = false,
): Selection | null {
    if (bounds.rowCount <= 0 || bounds.colCount <= 0) return null;

    const baseSel: Selection = selection ?? {type: 'single', anchor: {row: 0, col: 0}};
    const normalized = normalizeRange(baseSel);
    const anchor = baseSel.type === 'single' ? baseSel.anchor : baseSel.to;
    const from = shiftKey ? normalized.from : anchor;
    const to = shiftKey ? normalized.to : anchor;
    const current = shiftKey ? to : anchor;
    const lastRow = bounds.rowCount - 1;
    const lastCol = bounds.colCount - 1;

    let next: CellPos = current;

    switch (dir) {
        case 'right': {
            if (jumpToEdge && current.col !== lastCol) {
                next = {row: current.row, col: lastCol};
            } else if (current.col === lastCol) {
                if (current.row === lastRow) return selection;

                next = {row: current.row + 1, col: 0};
            } else {
                next = {row: current.row, col: current.col + 1};
            }

            break;
        }
        case 'left': {
            if (jumpToEdge && current.col !== 0) {
                next = {row: current.row, col: 0};
            } else if (current.col === 0) {
                if (current.row === 0) return selection;

                next = {row: current.row - 1, col: lastCol};
            } else {
                next = {row: current.row, col: current.col - 1};
            }

            break;
        }
        case 'down': {
            if (jumpToEdge && current.row !== lastRow) {
                next = {row: lastRow, col: current.col};
            } else {
                if (current.row === lastRow) return selection;

                next = {row: current.row + 1, col: current.col};
            }

            break;
        }
        case 'up': {
            if (jumpToEdge && current.row !== 0) {
                next = {row: 0, col: current.col};
            } else {
                if (current.row === 0) return selection;

                next = {row: current.row - 1, col: current.col};
            }

            break;
        }
    }

    next = clampPos(next, bounds);

    if (!shiftKey) return {type: 'single', anchor: next};

    return {type: 'range', from, to: next};
}
