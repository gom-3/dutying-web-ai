import type {TCellPos, TDirection, TSelection} from './types';

type TSelectionBounds = {rowCount: number; colCount: number; minCol?: number};

function getMinCol(bounds: TSelectionBounds): number {
    return bounds.minCol ?? 0;
}

function clampToBounds(pos: TCellPos, bounds: TSelectionBounds): TCellPos {
    const {rowCount, colCount} = bounds;
    const minCol = getMinCol(bounds);
    const row = Math.max(0, Math.min(rowCount - 1, pos.row));
    const col = Math.max(minCol, Math.min(colCount - 1, pos.col));

    return {row, col};
}

function moveCell(pos: TCellPos, dir: TDirection, bounds: TSelectionBounds): TCellPos {
    const {rowCount, colCount} = bounds;
    const minCol = getMinCol(bounds);
    let {row, col} = pos;

    switch (dir) {
        case 'right':
            col++;

            if (col >= colCount) {
                row++;
                col = minCol;
            }

            break;
        case 'left':
            col--;

            if (col < minCol) {
                row--;
                col = colCount - 1;
            }

            break;
        case 'down':
            row++;
            break;
        case 'up':
            row--;
            break;
    }

    // bounds 초과는 이동 무시
    if (row < 0 || row >= rowCount) return pos;

    if (col < minCol || col >= colCount) return pos;

    return {row, col};
}

export function moveSelection(
    selection: TSelection | null,
    dir: TDirection,
    extend: boolean,
    bounds: TSelectionBounds,
): TSelection | null {
    if (!selection) return null;

    const {rowCount, colCount} = bounds;

    if (rowCount <= 0 || colCount <= 0) return null;

    if (selection.type === 'single') {
        const next = moveCell(clampToBounds(selection.anchor, bounds), dir, bounds);

        if (extend) {
            return {type: 'range', from: selection.anchor, to: next};
        }

        return {type: 'single', anchor: next};
    }

    const nextTo = moveCell(clampToBounds(selection.to, bounds), dir, bounds);

    // range 상태에서 shift 없이 이동하면 range를 접고 single로 전환
    if (!extend) {
        return {type: 'single', anchor: nextTo};
    }

    return {type: 'range', from: selection.from, to: nextTo};
}

function moveToEdgePos(pos: TCellPos, dir: TDirection, bounds: TSelectionBounds): TCellPos {
    const {rowCount, colCount} = bounds;
    const minCol = getMinCol(bounds);

    if (rowCount <= 0 || colCount <= 0) return pos;

    switch (dir) {
        case 'left':
            return {row: pos.row, col: minCol};
        case 'right':
            return {row: pos.row, col: colCount - 1};
        case 'up':
            return {row: 0, col: pos.col};
        case 'down':
            return {row: rowCount - 1, col: pos.col};
    }
}

export function moveSelectionToEdge(
    selection: TSelection | null,
    dir: TDirection,
    extend: boolean,
    bounds: TSelectionBounds,
): TSelection | null {
    if (!selection) return null;

    const {rowCount, colCount} = bounds;

    if (rowCount <= 0 || colCount <= 0) return null;

    if (selection.type === 'single') {
        const anchor = clampToBounds(selection.anchor, bounds);
        const edge = moveToEdgePos(anchor, dir, bounds);

        if (extend) return {type: 'range', from: selection.anchor, to: edge};

        return {type: 'single', anchor: edge};
    }

    const to = clampToBounds(selection.to, bounds);
    const edge = moveToEdgePos(to, dir, bounds);

    if (!extend) {
        return {type: 'single', anchor: edge};
    }

    return {type: 'range', from: selection.from, to: edge};
}

export function makeSelectAllSelection(bounds: TSelectionBounds): TSelection | null {
    const {rowCount, colCount} = bounds;
    const minCol = getMinCol(bounds);

    if (rowCount <= 0 || colCount <= 0) return null;

    return {type: 'range', from: {row: 0, col: minCol}, to: {row: rowCount - 1, col: colCount - 1}};
}

export function normalizeSelection(selection: TSelection): {top: number; left: number; bottom: number; right: number} {
    if (selection.type === 'single') {
        const {row, col} = selection.anchor;

        return {top: row, bottom: row, left: col, right: col};
    }

    return {
        top: Math.min(selection.from.row, selection.to.row),
        bottom: Math.max(selection.from.row, selection.to.row),
        left: Math.min(selection.from.col, selection.to.col),
        right: Math.max(selection.from.col, selection.to.col),
    };
}

export function getCellsInSelection(selection: TSelection): TCellPos[] {
    const {top, left, bottom, right} = normalizeSelection(selection);
    const res: TCellPos[] = [];

    for (let row = top; row <= bottom; row++) {
        for (let col = left; col <= right; col++) {
            res.push({row, col});
        }
    }

    return res;
}
