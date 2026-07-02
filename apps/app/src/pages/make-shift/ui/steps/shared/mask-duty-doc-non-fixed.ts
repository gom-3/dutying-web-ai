import type {TDutyDoc} from '@/features/shift-editor/model';

type TMaskDutyDocOptions = {
    hideFixed?: boolean;
    hideRequests?: boolean;
};

export function maskDutyDocFixedCells(doc: TDutyDoc): TDutyDoc {
    return maskDutyDocCells(doc, {hideFixed: true});
}

export function maskDutyDocCells(doc: TDutyDoc, {hideFixed = false, hideRequests = false}: TMaskDutyDocOptions): TDutyDoc {
    return {
        ...doc,
        requestCells: hideRequests ? {} : doc.requestCells,
        rows: doc.rows.map((row) => ({
            ...row,
            cells: row.cells.map((cell, colIdx) => {
                const date = doc.columns[colIdx];
                if (!date) return cell;

                const key = `${row.workerId}|${date}`;

                return hideFixed && doc.fixedCells[key] === true ? null : cell;
            }),
        })),
    };
}
