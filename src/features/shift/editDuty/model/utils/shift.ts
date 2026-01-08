import {type DutyDoc} from '@/shared/editor';
import {type Shift} from '@/shared/types/shift';
import {type WardShiftType} from '@/shared/types/ward';

export function buildDutyDocFromShift(
    shift: Shift,
    wardShiftTypeMap: Map<number, WardShiftType>,
    year: number,
    month: number,
): {doc: DutyDoc; requestedOffByRow: boolean[][]; rowIndexByShiftNurseId: Map<number, number>} {
    const columns = shift.days.map((_, idx) => `${year}-${month.toString().padStart(2, '0')}-${(idx + 1).toString().padStart(2, '0')}`);
    const rowsFlat = shift.divisionShiftNurses.flatMap((division) => division);
    const rowIndexByShiftNurseId = new Map<number, number>();
    const rows = rowsFlat.map((row, idx) => {
        rowIndexByShiftNurseId.set(row.shiftNurse.shiftNurseId, idx);

        return {
            workerId: String(row.shiftNurse.shiftNurseId),
            cells: row.wardShiftList.map((id) => (id ? (wardShiftTypeMap.get(id)?.shortName ?? null) : null)),
        };
    });
    const workerMeta = rowsFlat.reduce<Record<string, {name: string}>>((acc, row) => {
        acc[String(row.shiftNurse.shiftNurseId)] = {name: row.shiftNurse.name};

        return acc;
    }, {});
    const requestedOffByRow = rowsFlat.map((row) =>
        row.wardShiftList.map((currentId, col) => {
            if (!currentId) return false;

            const reqId = row.wardReqShiftList[col];

            if (!reqId) return false;

            if (reqId !== currentId) return false;

            return wardShiftTypeMap.get(currentId)?.isOff === true;
        }),
    );

    return {doc: {columns, rows, workerMeta}, requestedOffByRow, rowIndexByShiftNurseId};
}
