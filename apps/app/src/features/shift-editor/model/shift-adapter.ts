import type {TWardShiftsDTO} from '@dutying/api/ward';
import type {TShift, TWardShiftType} from '@/entities';
import type {TCellValue, TDutyDoc, TWorkKeyMap} from './types';

type TWardShiftTypeMaps = {
    idToType: Map<number, TWardShiftType>;
    shortNameToType: Map<string, TWardShiftType>;
};

function formatDateKey(year: number, month: number, day: number): string {
    const yyyy = String(year);
    const mm = String(month).padStart(2, '0');
    const dd = String(day).padStart(2, '0');

    return `${yyyy}-${mm}-${dd}`;
}

export function buildWardShiftTypeMaps(shift: TShift): TWardShiftTypeMaps {
    const idToType = new Map<number, TWardShiftType>();
    const shortNameToType = new Map<string, TWardShiftType>();

    for (const t of shift.wardShiftTypes) {
        idToType.set(t.wardShiftTypeId, t);
        shortNameToType.set(t.shortName, t);
    }

    return {idToType, shortNameToType};
}

export function shiftToDoc(shift: TShift, year: number, month: number): TDutyDoc {
    const {idToType} = buildWardShiftTypeMaps(shift);
    const columns = shift.days.map((d) => formatDateKey(year, month, d.day));
    const workerMeta: TDutyDoc['workerMeta'] = {};
    const rows = shift.divisionShiftNurses
        .flatMap((division) => division)
        .filter((row) => row.shiftNurse.isWorker)
        .map((row) => {
            const workerId = String(row.shiftNurse.shiftNurseId);
            const cells = row.wardShiftList.map((value) => {
                if (value === null) return null;

                const type = idToType.get(value);

                return type?.shortName ?? null;
            });

            workerMeta[workerId] = {name: row.shiftNurse.name};

            return {workerId, cells};
        });

    return {columns, rows, workerMeta};
}

function cellToWardShiftTypeId(cell: TCellValue, maps: TWardShiftTypeMaps): number | null {
    if (cell === null || cell === '') return null;

    const type = maps.shortNameToType.get(cell);

    return type?.wardShiftTypeId ?? null;
}

export function docToShift(doc: TDutyDoc, originalShift: TShift): TShift {
    const maps = buildWardShiftTypeMaps(originalShift);
    const rowMap = new Map(doc.rows.map((row) => [row.workerId, row]));
    const nextDivisionShiftNurses = originalShift.divisionShiftNurses.map((division) =>
        division.map((row) => {
            if (!row.shiftNurse.isWorker) return row;

            const docRow = rowMap.get(String(row.shiftNurse.shiftNurseId));

            if (!docRow) return row;

            const nextWardShiftList = row.wardShiftList.map((_current, index) => {
                const cell = docRow.cells[index] ?? null;
                const nextId = cellToWardShiftTypeId(cell, maps);

                return nextId ?? null;
            });

            return {...row, wardShiftList: nextWardShiftList};
        }),
    );

    return {...originalShift, divisionShiftNurses: nextDivisionShiftNurses};
}

export function docToWardShiftsDTO(doc: TDutyDoc, originalShift: TShift): TWardShiftsDTO {
    const maps = buildWardShiftTypeMaps(originalShift);
    const dto: TWardShiftsDTO = [];

    for (const row of doc.rows) {
        const shiftNurseId = Number(row.workerId);

        for (let colIdx = 0; colIdx < doc.columns.length; colIdx += 1) {
            const date = doc.columns[colIdx]!;
            const cell = row.cells[colIdx] ?? null;
            const wardShiftTypeId = cellToWardShiftTypeId(cell, maps);

            dto.push({shiftNurseId, date, wardShiftTypeId});
        }
    }

    return dto;
}

export function buildWorkKeyMap(shift?: TShift): TWorkKeyMap {
    if (!shift) return {};

    return shift.wardShiftTypes.reduce<TWorkKeyMap>((acc, shiftType) => {
        if (shiftType.shortName.length !== 1) return acc;

        const key = shiftType.shortName.toLowerCase();

        if (acc[key] !== undefined) return acc;

        acc[key] = shiftType.shortName;

        return acc;
    }, {});
}
