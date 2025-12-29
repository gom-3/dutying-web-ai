import type {CellValue} from '../types';

export type ClipboardPayload = {
    width: number;
    height: number;
    cells: CellValue[][];
};
