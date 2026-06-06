import type {TSnapshotCellDTO, TSnapshotDetailRes, TSnapshotRowOrderDTO} from '@dutying/api/ward';
import type {TShift} from '@/entities';
import {buildWardShiftTypeMaps, shiftToDoc} from './shift-adapter';
import type {TDutyDoc} from './types';

function cellValueFromSnapshotCell(
    cell: TSnapshotCellDTO | undefined,
    idToType: ReturnType<typeof buildWardShiftTypeMaps>['idToType'],
): string | null {
    if (!cell || cell.wardShiftTypeId == null) return null;

    if (cell.shiftCode) return cell.shiftCode;

    return idToType.get(cell.wardShiftTypeId)?.shortName ?? null;
}

/**
 * 저장된 스냅샷 상세를 편집기 draft로 복원한다.
 * 고정·신청근무 잠금은 현재 화면 값을 유지한다.
 */
export function snapshotDetailToDoc(
    detail: Pick<TSnapshotDetailRes, 'cells' | 'rowOrder'>,
    shift: TShift,
    year: number,
    month: number,
    locks: Pick<TDutyDoc, 'fixedCells' | 'requestCells'>,
): TDutyDoc {
    const base = shiftToDoc(shift, year, month);
    const {idToType} = buildWardShiftTypeMaps(shift);
    const cellByKey = new Map<string, TSnapshotCellDTO>(detail.cells.map((cell) => [`${cell.shiftNurseId}:${cell.date}`, cell]));

    const orderedRowIds = [...detail.rowOrder]
        .sort((a, b) => a.displayOrder - b.displayOrder)
        .map((item) => String(item.shiftNurseId));

    const baseRowIds = base.rows.map((row) => row.workerId);
    const rowIds = [...new Set([...orderedRowIds, ...baseRowIds])];

    const fixedCells: TDutyDoc['fixedCells'] = {...locks.fixedCells};

    for (const cell of detail.cells) {
        if (cell.fixed) {
            fixedCells[`${cell.shiftNurseId}|${cell.date}`] = true;
        }
    }

    const workerMeta: TDutyDoc['workerMeta'] = {...base.workerMeta};

    const applyRowMeta = (shiftNurseId: string, rowOrder?: TSnapshotRowOrderDTO) => {
        const workerId = shiftNurseId;
        const prev = workerMeta[workerId] ?? {name: ''};

        workerMeta[workerId] = {
            ...prev,
            nurseId: rowOrder?.nurseId ?? prev.nurseId,
            priority: rowOrder?.priority ?? prev.priority,
            divisionNum: rowOrder?.divisionNum ?? prev.divisionNum,
        };
    };

    for (const item of detail.rowOrder) {
        applyRowMeta(String(item.shiftNurseId), item);
    }

    const rows = rowIds.map((workerId) => {
        const baseRow = base.rows.find((row) => row.workerId === workerId);
        const cells = base.columns.map((date) => {
            const snapshotCell = cellByKey.get(`${workerId}:${date}`);

            if (snapshotCell) {
                return cellValueFromSnapshotCell(snapshotCell, idToType);
            }

            return baseRow?.cells[base.columns.indexOf(date)] ?? null;
        });

        return {workerId, cells};
    });

    return {
        columns: base.columns,
        rows,
        workerMeta,
        fixedCells,
        requestCells: {...locks.requestCells},
    };
}
