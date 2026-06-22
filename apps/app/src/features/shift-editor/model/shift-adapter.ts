import type {TSnapshotCellDTO, TSnapshotRowOrderDTO, TWardShiftsDTO} from '@dutying/api/ward';
import type {TShift, TWardShiftType} from '@/entities';
import {getShiftShortNameEntryKey} from '@/shared/lib/shift-short-name';
import type {TCellValue, TDutyDoc, TWorkKeyMap} from './types';

type TWardShiftTypeMaps = {
    idToType: Map<number, TWardShiftType>;
    shortNameToType: Map<string, TWardShiftType>;
};

export const LAST_SHIFT_CONTEXT_COUNT = 4;

type TShiftToDocOptions = {
    previousConfirmedShift?: TShift | null;
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

function normalizeLastShiftIds(list: (number | null)[] | undefined): (number | null)[] {
    const sliced = (list ?? []).slice(-LAST_SHIFT_CONTEXT_COUNT);

    if (sliced.length >= LAST_SHIFT_CONTEXT_COUNT) return sliced;

    const padding: (number | null)[] = Array.from({length: LAST_SHIFT_CONTEXT_COUNT - sliced.length}, () => null);

    return padding.concat(sliced);
}

function findShiftRowByShiftNurseId(shift: TShift | null | undefined, shiftNurseId: number) {
    if (!shift) return null;

    for (const division of shift.divisionShiftNurses) {
        for (const row of division) {
            if (row.shiftNurse.shiftNurseId === shiftNurseId) return row;
        }
    }

    return null;
}

function resolveLastShiftIds(
    row: TShift['divisionShiftNurses'][number][number],
    previousConfirmedShift?: TShift | null,
): (number | null)[] {
    const previousRow = findShiftRowByShiftNurseId(previousConfirmedShift, row.shiftNurse.shiftNurseId);

    if (previousRow?.wardShiftList) {
        return normalizeLastShiftIds(previousRow.wardShiftList);
    }

    return normalizeLastShiftIds(row.lastWardShiftList);
}

/**
 * API가 근무 배정이 없어도 날짜/골격만 채운 `TShift`를 줄 때가 있어,
 * /duty 등에서 "근무표 없음"으로 취급할 때 사용한다.
 */
export function isDutyShiftWithoutAssignments(shift: TShift): boolean {
    if (!shift.days?.length) return true;

    const divisions = shift.divisionShiftNurses ?? [];

    for (const division of divisions) {
        for (const row of division) {
            if (!row.shiftNurse.isWorker) continue;

            for (const cell of row.wardShiftList ?? []) {
                if (cell != null) return false;
            }
        }
    }

    return true;
}

/** 모든 근무자(worker) 행의 날짜별 칸이 비어 있지 않을 때 true (골격만 있는 응답 / 미배정 칸이 하나라도 있으면 false). */
export function isDutyShiftFullyAssigned(shift: TShift): boolean {
    if (!shift.days?.length) return false;

    const dayCount = shift.days.length;
    const divisions = shift.divisionShiftNurses ?? [];

    let seenWorker = false;

    for (const division of divisions) {
        for (const row of division) {
            if (!row.shiftNurse.isWorker) continue;

            seenWorker = true;

            const list = row.wardShiftList ?? [];

            for (let j = 0; j < dayCount; j += 1) {
                if (list[j] == null) return false;
            }
        }
    }

    return seenWorker;
}

export function shiftToDoc(shift: TShift, year: number, month: number, options: TShiftToDocOptions = {}): TDutyDoc {
    const {idToType} = buildWardShiftTypeMaps(shift);
    const columns = shift.days.map((d) => formatDateKey(year, month, d.day));
    const workerMeta: TDutyDoc['workerMeta'] = {};
    const rows = shift.divisionShiftNurses.flatMap((division, divisionIdx) =>
        division
            .filter((row) => row.shiftNurse.isWorker)
            .map((row) => {
                const workerId = String(row.shiftNurse.shiftNurseId);
                const cells = row.wardShiftList.map((value) => {
                    if (value === null) return null;

                    const type = idToType.get(value);

                    return type?.shortName ?? null;
                });
                const lastCells = resolveLastShiftIds(row, options.previousConfirmedShift).map((value) => {
                    if (value === null) return null;

                    const type = idToType.get(value);

                    return type?.shortName ?? null;
                });

                workerMeta[workerId] = {
                    name: row.shiftNurse.name,
                    nurseId: row.shiftNurse.nurseId,
                    priority: row.shiftNurse.priority,
                    divisionNum: divisionIdx + 1,
                };

                return {workerId, lastCells, cells};
            }),
    );

    return {columns, rows, workerMeta, fixedCells: {}, requestCells: {}};
}

function cellToWardShiftTypeId(cell: TCellValue, maps: TWardShiftTypeMaps): number | null {
    if (cell === null || cell === '') return null;

    const type = maps.shortNameToType.get(cell);

    return type?.wardShiftTypeId ?? null;
}

function buildSnapshotCellKey(shiftNurseId: number, date: string): string {
    return `${shiftNurseId}:${date}`;
}

function resolveSnapshotCellSource(params: {fixed: boolean; requested: boolean; cell: TCellValue}): string {
    const {fixed, requested, cell} = params;

    if (fixed) return 'FIXED';

    if (requested) return 'REQUEST';

    if (cell === null || cell === '') return 'EMPTY';

    return 'DRAFT';
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
            const nextLastWardShiftList = docRow.lastCells
                ? docRow.lastCells.map((cell) => cellToWardShiftTypeId(cell, maps) ?? null)
                : row.lastWardShiftList;

            return {...row, lastWardShiftList: nextLastWardShiftList, wardShiftList: nextWardShiftList};
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

export function docToSnapshotCellsDTO(doc: TDutyDoc, originalShift: TShift): TSnapshotCellDTO[] {
    const maps = buildWardShiftTypeMaps(originalShift);
    const dto: TSnapshotCellDTO[] = [];

    for (const row of doc.rows) {
        const shiftNurseId = Number(row.workerId);
        const nurseId = doc.workerMeta[row.workerId]?.nurseId;

        for (let colIdx = 0; colIdx < doc.columns.length; colIdx += 1) {
            const date = doc.columns[colIdx]!;
            const cell = row.cells[colIdx] ?? null;
            const wardShiftTypeId = cellToWardShiftTypeId(cell, maps);
            const lockKey = `${row.workerId}|${date}`;
            const fixed = doc.fixedCells[lockKey] === true;
            const requested = doc.requestCells[lockKey] === true;

            dto.push({
                cellKey: buildSnapshotCellKey(shiftNurseId, date),
                shiftNurseId,
                nurseId,
                date,
                wardShiftTypeId,
                shiftCode: cell ?? undefined,
                source: resolveSnapshotCellSource({fixed, requested, cell}),
                fixed,
            });
        }
    }

    return dto;
}

export function docToSnapshotRowOrderDTO(doc: TDutyDoc): TSnapshotRowOrderDTO[] {
    return doc.rows.map((row, index) => {
        const shiftNurseId = Number(row.workerId);
        const meta = doc.workerMeta[row.workerId];
        const displayOrder = index + 1;

        return {
            shiftNurseId,
            nurseId: meta?.nurseId,
            displayOrder,
            priority: meta?.priority ?? displayOrder * 1024,
            divisionNum: meta?.divisionNum ?? 1,
        };
    });
}

export function buildWorkKeyMap(shift?: TShift): TWorkKeyMap {
    if (!shift) return {};

    return shift.wardShiftTypes
        .filter((shiftType) => shiftType.isActive !== false)
        .reduce<TWorkKeyMap>((acc, shiftType) => {
            const normalizedShortName = shiftType.shortName.trim();
            const key = getShiftShortNameEntryKey(normalizedShortName);

            if (!key || acc[key] !== undefined) return acc;

            acc[key] = normalizedShortName;

            return acc;
        }, {});
}
