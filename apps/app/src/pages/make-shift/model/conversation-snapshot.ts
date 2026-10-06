import type {TScheduleRowDto, TScheduleShiftTypeDto} from '@dutying/api/ward';
import type {TDay, TShift} from '@/entities/shift';
import {snapshotDetailToDoc} from '@/features/shift-editor/model/snapshot-to-doc';
import type {TResultVersion} from './schedule-conversation-api';

/** Read-only historical rendering must never fall back to the current roster or assignments. */
export function buildConversationSnapshot(version: TResultVersion) {
    let context: {rows?: TScheduleRowDto[]; shiftTypes?: TScheduleShiftTypeDto[]; calendarDays?: {date: string; isHoliday: boolean}[]} = {};

    try {
        const parsed = JSON.parse(version.constraintsJson);

        if (parsed && typeof parsed === 'object') context = parsed;
    } catch {
        // Older results without metadata retain their stored IDs and codes.
    }

    const metadata = Array.isArray(context.rows) ? context.rows : [];
    const types = Array.isArray(context.shiftTypes) ? context.shiftTypes : [];
    const cellTypes = new Map(types.filter((type) => type?.wardShiftTypeId != null).map((type) => [type.wardShiftTypeId, type.code]));

    for (const cell of [...version.cells, ...version.carryOverCells]) {
        if (cell.wardShiftTypeId != null)
            cellTypes.set(cell.wardShiftTypeId, cell.shiftCode ?? cellTypes.get(cell.wardShiftTypeId) ?? `#${cell.wardShiftTypeId}`);
    }

    const holidays = new Set(
        (Array.isArray(context.calendarDays) ? context.calendarDays : []).filter((item) => item?.isHoliday).map((item) => item.date),
    );
    const wardShiftTypes: TShift['wardShiftTypes'] = [...cellTypes].map(([id, storedCode]) => {
        const saved = types.find((type) => type?.wardShiftTypeId === id);
        const code = storedCode ?? saved?.code ?? `#${id}`;
        const off = saved?.isOff ?? (code === 'O' || code === '/');

        return {
            wardShiftTypeId: id,
            name: saved?.name ?? code,
            shortName: code,
            startTime: saved?.startTime ?? '',
            endTime: saved?.endTime ?? '',
            color: saved?.color ?? '#626D7A',
            isDefault: true,
            isOff: off,
            isCounted: saved?.isCounted ?? true,
            classification: saved?.classification ?? (off ? 'OFF' : code === 'N' ? 'NIGHT' : code === 'E' ? 'EVENING' : 'DAY'),
        };
    });
    const day = (date: string): TDay => {
        const parsed = new Date(`${date}T00:00:00Z`);

        return {
            day: parsed.getUTCDate(),
            dayType:
                parsed.getUTCDay() === 0 ? 'sunday' : parsed.getUTCDay() === 6 ? 'saturday' : holidays.has(date) ? 'holiday' : 'workday',
        };
    };
    const prefix = `${version.year}-${String(version.month).padStart(2, '0')}-`;
    const count = new Date(Date.UTC(version.year, version.month, 0)).getUTCDate();
    const dates = Array.from({length: count}, (_, i) => `${prefix}${String(i + 1).padStart(2, '0')}`);
    const carryDates = [...new Set(version.carryOverCells.map((cell) => cell.date))].sort();
    const ordered = [...version.rowOrder].sort((a, b) => a.displayOrder - b.displayOrder);
    const divisionShiftNurses: TShift['divisionShiftNurses'] = [];

    for (const row of ordered) {
        const saved = metadata.find((item) => item?.shiftNurseId === row.shiftNurseId);
        const division = row.divisionNum ?? saved?.divisionNum ?? 0;
        const entry: TShift['divisionShiftNurses'][number][number] = {
            shiftNurse: {
                shiftNurseId: row.shiftNurseId,
                nurseId: row.nurseId ?? saved?.nurseId ?? row.shiftNurseId,
                name: saved?.name?.trim() ? saved.name : `#${row.shiftNurseId}`,
                carried: 0,
                isWorker: true,
                priority: row.priority ?? row.displayOrder,
                divisionNum: division,
                divisionName: row.divisionName ?? saved?.divisionName,
            },
            wardShiftList: dates.map(() => null),
            wardReqShiftList: dates.map(() => null),
            lastWardShiftList: carryDates.map(() => null),
            lastWardReqShiftList: carryDates.map(() => null),
        };
        const last = divisionShiftNurses[divisionShiftNurses.length - 1];

        if (last?.[0]?.shiftNurse.divisionNum === division) last.push(entry);
        else divisionShiftNurses.push([entry]);
    }

    const shift: TShift = {days: dates.map(day), lastDays: carryDates.map(day), wardShiftTypes, divisionShiftNurses};
    const lastCellsByWorkerId = Object.fromEntries(
        ordered.map((row) => [
            String(row.shiftNurseId),
            carryDates.map((date) => {
                const cell = version.carryOverCells.find((item) => item.shiftNurseId === row.shiftNurseId && item.date === date);

                return cell?.wardShiftTypeId == null
                    ? null
                    : (cell.shiftCode ?? wardShiftTypes.find((type) => type.wardShiftTypeId === cell.wardShiftTypeId)?.shortName ?? null);
            }),
        ]),
    );
    const doc = snapshotDetailToDoc(version, shift, version.year, version.month, {fixedCells: {}, requestCells: {}, lastCellsByWorkerId});

    return {shift, doc};
}
