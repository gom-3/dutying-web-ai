import type {TNurse} from '@/entities/nurse';
import type {TRequestShift, TShift} from '@/entities/shift';
import type {TShiftTeam} from '@/entities/ward';
import type {TDutyDoc} from '@/features/shift-editor';

export type TNurseOrderMovePayload = {
    nurseId: number;
    sourceShiftTeamId: number;
    destinationShiftTeamId: number;
    divisionNum: number;
    prevPriority: number;
    nextPriority: number;
};

type TScheduleRow = TShift['divisionShiftNurses'][number][number] | TRequestShift['divisionShiftNurses'][number][number];
type TScheduleLike<TRow extends TScheduleRow> = {
    divisionShiftNurses: TRow[][];
};

const FALLBACK_DIVISION = Number.MAX_SAFE_INTEGER;
const FALLBACK_PRIORITY = Number.MAX_SAFE_INTEGER;

function movedPriority(payload: TNurseOrderMovePayload) {
    return Math.floor((payload.prevPriority + payload.nextPriority) / 2);
}

function compareSavedNurseOrder(left: Pick<TNurse, 'divisionNum' | 'priority' | 'nurseId'>, right: Pick<TNurse, 'divisionNum' | 'priority' | 'nurseId'>) {
    return (
        (left.divisionNum ?? FALLBACK_DIVISION) - (right.divisionNum ?? FALLBACK_DIVISION) ||
        (left.priority ?? FALLBACK_PRIORITY) - (right.priority ?? FALLBACK_PRIORITY) ||
        left.nurseId - right.nurseId
    );
}

function compareScheduleRows(left: TScheduleRow, right: TScheduleRow) {
    return (
        (left.shiftNurse.divisionNum ?? FALLBACK_DIVISION) - (right.shiftNurse.divisionNum ?? FALLBACK_DIVISION) ||
        (left.shiftNurse.priority ?? FALLBACK_PRIORITY) - (right.shiftNurse.priority ?? FALLBACK_PRIORITY) ||
        left.shiftNurse.shiftNurseId - right.shiftNurse.shiftNurseId
    );
}

export function getCurrentTeamNurses(shiftTeams: TShiftTeam[], shiftTeamId: number | null | undefined): TNurse[] {
    if (shiftTeamId == null) return [];

    return shiftTeams.find((team) => team.shiftTeamId === shiftTeamId)?.nurses ?? [];
}

export function sortNursesBySavedOrder(nurses: TNurse[]): TNurse[] {
    return [...nurses].sort(compareSavedNurseOrder);
}

function groupScheduleRowsByDivision<TRow extends TScheduleRow>(rows: TRow[]): TRow[][] {
    const groups = new Map<number, TRow[]>();

    for (const row of rows.sort(compareScheduleRows)) {
        const divisionNum = row.shiftNurse.divisionNum ?? 1;
        const group = groups.get(divisionNum) ?? [];

        group.push(row);
        groups.set(divisionNum, group);
    }

    return [...groups.entries()].sort(([left], [right]) => left - right).map(([, divisionRows]) => divisionRows);
}

export function sortScheduleByTeamNurseOrder<TSchedule extends TScheduleLike<TScheduleRow> | null | undefined>(
    schedule: TSchedule,
    teamNurses: TNurse[],
): TSchedule {
    if (!schedule) return schedule;

    const nurseById = new Map(teamNurses.map((nurse) => [nurse.nurseId, nurse]));
    const rows = schedule.divisionShiftNurses.flatMap((division) =>
        division.map((row) => {
            const nurse = nurseById.get(row.shiftNurse.nurseId);

            if (!nurse) return row;

            return {
                ...row,
                shiftNurse: {
                    ...row.shiftNurse,
                    divisionNum: nurse.divisionNum,
                    priority: nurse.priority,
                },
            } as typeof row;
        }),
    );

    return {
        ...schedule,
        divisionShiftNurses: groupScheduleRowsByDivision(rows),
    };
}

export function sortDutyDocByScheduleOrder<TSchedule extends TScheduleLike<TScheduleRow>>(
    doc: TDutyDoc,
    schedule: TSchedule,
): TDutyDoc {
    const orderedWorkerIds = schedule.divisionShiftNurses
        .flat()
        .filter((row) => row.shiftNurse.isWorker)
        .map((row) => String(row.shiftNurse.shiftNurseId));
    const rowByWorkerId = new Map(doc.rows.map((row) => [row.workerId, row]));
    const seen = new Set<string>();
    const orderedRows: TDutyDoc['rows'] = [];

    for (const workerId of orderedWorkerIds) {
        const row = rowByWorkerId.get(workerId);

        if (!row) continue;

        orderedRows.push(row);
        seen.add(workerId);
    }

    for (const row of doc.rows) {
        if (!seen.has(row.workerId)) orderedRows.push(row);
    }

    if (orderedRows.length === doc.rows.length && orderedRows.every((row, index) => row.workerId === doc.rows[index]?.workerId)) {
        return doc;
    }

    return {...doc, rows: orderedRows};
}

export function sortDutyDocByTeamNurseOrder(doc: TDutyDoc, teamNurses: TNurse[]): TDutyDoc {
    const orderByNurseId = new Map(sortNursesBySavedOrder(teamNurses).map((nurse, index) => [nurse.nurseId, index]));

    if (orderByNurseId.size === 0) return doc;

    const orderedRows = [...doc.rows].sort((left, right) => {
        const leftNurseId = doc.workerMeta[left.workerId]?.nurseId;
        const rightNurseId = doc.workerMeta[right.workerId]?.nurseId;

        return (
            (leftNurseId == null ? FALLBACK_PRIORITY : (orderByNurseId.get(leftNurseId) ?? FALLBACK_PRIORITY)) -
            (rightNurseId == null ? FALLBACK_PRIORITY : (orderByNurseId.get(rightNurseId) ?? FALLBACK_PRIORITY))
        );
    });

    if (orderedRows.every((row, index) => row.workerId === doc.rows[index]?.workerId)) return doc;

    return {...doc, rows: orderedRows};
}

export function getDisplayWorkersFromSchedule<TSchedule extends TScheduleLike<TScheduleRow>>(
    schedule: TSchedule,
    teamNurses: TNurse[],
): TNurse[] | null {
    const nurseById = new Map(teamNurses.map((nurse) => [nurse.nurseId, nurse]));
    const workers: TNurse[] = [];

    for (const row of schedule.divisionShiftNurses.flat()) {
        if (!row.shiftNurse.isWorker) continue;

        const nurse = nurseById.get(row.shiftNurse.nurseId);

        if (!nurse) return null;

        workers.push({
            ...nurse,
            divisionNum: row.shiftNurse.divisionNum,
            priority: row.shiftNurse.priority,
            isWorker: true,
        });
    }

    return workers;
}

export function applyNursePriorityMoveToShiftTeams(shiftTeams: TShiftTeam[], payload: TNurseOrderMovePayload): TShiftTeam[] {
    const priority = movedPriority(payload);
    const nextTeams = shiftTeams.map((team) => ({
        ...team,
        nurses: [...team.nurses],
    }));
    const sourceTeam = nextTeams.find((team) => team.shiftTeamId === payload.sourceShiftTeamId);
    const destinationTeam = nextTeams.find((team) => team.shiftTeamId === payload.destinationShiftTeamId);

    if (!sourceTeam || !destinationTeam) return shiftTeams;

    const sourceIndex = sourceTeam.nurses.findIndex((nurse) => nurse.nurseId === payload.nurseId);

    if (sourceIndex === -1) return shiftTeams;

    const [sourceNurse] = sourceTeam.nurses.splice(sourceIndex, 1);

    if (!sourceNurse) return shiftTeams;

    destinationTeam.nurses.push({
        ...sourceNurse,
        shiftTeamId: payload.destinationShiftTeamId,
        divisionNum: payload.divisionNum,
        priority,
    });
    sourceTeam.nurses = sortNursesBySavedOrder(sourceTeam.nurses);
    destinationTeam.nurses = sortNursesBySavedOrder(destinationTeam.nurses);
    sourceTeam.nurseCnt = sourceTeam.nurses.length;
    destinationTeam.nurseCnt = destinationTeam.nurses.length;

    return nextTeams;
}

export function applyNursePriorityMoveToNurses(nurses: TNurse[] | undefined, payload: TNurseOrderMovePayload): TNurse[] | undefined {
    if (!nurses) return nurses;

    return sortNursesBySavedOrder(
        nurses.map((nurse) =>
            nurse.nurseId === payload.nurseId
                ? {
                      ...nurse,
                      shiftTeamId: payload.destinationShiftTeamId,
                      divisionNum: payload.divisionNum,
                      priority: movedPriority(payload),
                  }
                : nurse,
        ),
    );
}

export function applyNursePriorityMoveToSchedule<TSchedule extends TScheduleLike<TScheduleRow> | undefined>(
    schedule: TSchedule,
    payload: TNurseOrderMovePayload,
): TSchedule {
    if (!schedule) return schedule;

    const priority = movedPriority(payload);
    const rows = schedule.divisionShiftNurses.flatMap((division) =>
        division.map((row) =>
            row.shiftNurse.nurseId === payload.nurseId
                ? ({
                      ...row,
                      shiftNurse: {
                          ...row.shiftNurse,
                          divisionNum: payload.divisionNum,
                          priority,
                      },
                  } as typeof row)
                : row,
        ),
    );

    return {
        ...schedule,
        divisionShiftNurses: groupScheduleRowsByDivision(rows),
    };
}
