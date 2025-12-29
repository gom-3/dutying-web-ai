import type {GridDoc} from '../../editor-core/grid';
import type {CellValue} from '../../editor-core/types';
import type {DutyDoc} from './types';

/**
 * DutyDoc을 editor-core 유틸(clipboard 등)에서 사용 가능하도록 GridDoc으로 어댑트한다.
 */
export class DutyGridDoc implements GridDoc {
    constructor(private readonly doc: DutyDoc) {}

    get rowCount(): number {
        return this.doc.rows.length;
    }

    get colCount(): number {
        return this.doc.columns.length;
    }

    getCell(row: number, col: number): CellValue {
        return this.doc.rows[row]?.cells[col] ?? null;
    }
}
