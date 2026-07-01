import type {TDutyDoc} from '@/features/shift-editor/model';

/**
 * 고정 근무 셀만 숨기고 나머지 배정은 그대로 보이게 할 때 사용.
 */
export function maskDutyDocFixedCells(doc: TDutyDoc): TDutyDoc {
    return {
        ...doc,
        rows: doc.rows.map((row) => ({
            ...row,
            cells: row.cells.map((cell, colIdx) => {
                const date = doc.columns[colIdx];
                if (!date) return cell;

                const key = `${row.workerId}|${date}`;

                return doc.fixedCells[key] === true ? null : cell;
            }),
        })),
    };
}
