import type {CellValue} from '../types';

export type SetCellsOp = {
    kind: 'setCells';
    cells: Array<{
        row: number;
        col: number;
        prev: CellValue;
        next: CellValue;
    }>;
};

export type ReorderRowsOp = {
    kind: 'reorderRows';
    prevOrder: number[];
    nextOrder: number[];
};

export type EditorOp = SetCellsOp | ReorderRowsOp;
