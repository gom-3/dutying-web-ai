import {type DropResult} from '@hello-pangea/dnd';
import {type TDutyRequest, type TRequestShift, type TShift} from '@/entities/shift';
import {type TShiftTeam} from '@/entities/ward';
import {type TFocus} from '@/features/request-shift/model/types';
import {type TCellValue, type TDutyDoc} from '@/features/shift-editor/model';
import i18n from '@/i18n';

const PRIORITY_GAP = 2024;

export const getYearMonthLabel = (year: number, month: number) => `${year}-${month.toString().padStart(2, '0')}`;

const getDateKey = (year: number, month: number, day: number) =>
    `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;

export const getDutyRequestLookupKey = (nurseId: number, dateIndex: number) => `${nurseId}:${dateIndex}`;

export const createDutyRequestLookup = (dutyRequestList: TDutyRequest[] | undefined) =>
    new Map(dutyRequestList?.map((request) => [getDutyRequestLookupKey(request.nurseId, request.date - 1), request]) ?? []);

export const createShiftNurseIdByNurseId = (requestShift: TRequestShift) =>
    new Map(
        requestShift.divisionShiftNurses
            .flatMap((division) => division)
            .map((row) => [row.shiftNurse.nurseId, row.shiftNurse.shiftNurseId]),
    );

export const createConnectedNurseIdSet = (currentShiftTeam: TShiftTeam) =>
    new Set(currentShiftTeam.nurses.filter((nurse) => nurse.isConnected).map((nurse) => nurse.nurseId));

type TRequestCalendarDocRowMeta = {
    shiftNurseId: number;
    nurseId: number;
    nurseName: string;
};

export type TRequestCalendarData = {
    shift: TShift;
    doc: TDutyDoc;
    rowsByDocIndex: TRequestCalendarDocRowMeta[];
    rowIndexByShiftNurseId: Map<number, number>;
};

export function requestShiftToCalendarData(
    requestShift: TRequestShift,
    year: number,
    month: number,
    dutyRequestList: TDutyRequest[] | undefined,
): TRequestCalendarData {
    const idToType = new Map(requestShift.wardShiftTypes.map((type) => [type.wardShiftTypeId, type]));
    const dutyRequestLookup = createDutyRequestLookup(dutyRequestList);
    const columns = requestShift.days.map((day) => getDateKey(year, month, day.day));
    const workerMeta: TDutyDoc['workerMeta'] = {};
    const requestCells: TDutyDoc['requestCells'] = {};
    const rowsByDocIndex: TRequestCalendarDocRowMeta[] = [];
    const rowIndexByShiftNurseId = new Map<number, number>();
    const docRows: TDutyDoc['rows'] = [];
    const divisionShiftNurses: TShift['divisionShiftNurses'] = requestShift.divisionShiftNurses.map((division) =>
        division.map((row) => {
            const workerId = String(row.shiftNurse.shiftNurseId);
            const displayShiftTypeIds: (number | null)[] = [];
            const cells: TCellValue[] = requestShift.days.map((day, dayIndex) => {
                const dutyRequest = dutyRequestLookup.get(getDutyRequestLookupKey(row.shiftNurse.nurseId, day.day - 1)) ?? null;
                const displayShiftTypeId = row.wardReqShiftList[dayIndex] ?? dutyRequest?.wardShiftTypeId ?? null;

                displayShiftTypeIds.push(displayShiftTypeId);

                if (dutyRequest?.isAccepted === true) {
                    const date = columns[dayIndex];

                    if (date) requestCells[`${workerId}|${date}`] = true;
                }

                if (displayShiftTypeId === null) return null;

                return idToType.get(displayShiftTypeId)?.shortName ?? dutyRequest?.wardShiftTypeShortName ?? null;
            });

            if (row.shiftNurse.isWorker) {
                const docRowIndex = docRows.length;

                rowIndexByShiftNurseId.set(row.shiftNurse.shiftNurseId, docRowIndex);
                rowsByDocIndex.push({
                    shiftNurseId: row.shiftNurse.shiftNurseId,
                    nurseId: row.shiftNurse.nurseId,
                    nurseName: row.shiftNurse.name,
                });
                workerMeta[workerId] = {
                    name: row.shiftNurse.name,
                    nurseId: row.shiftNurse.nurseId,
                    priority: row.shiftNurse.priority,
                    divisionNum: row.shiftNurse.divisionNum,
                };
                docRows.push({workerId, lastCells: [], cells});
            }

            return {
                shiftNurse: row.shiftNurse,
                lastWardShiftList: [],
                lastWardReqShiftList: [],
                wardShiftList: displayShiftTypeIds,
                wardReqShiftList: displayShiftTypeIds,
            };
        }),
    );

    return {
        shift: {
            lastDays: [],
            days: requestShift.days,
            wardShiftTypes: requestShift.wardShiftTypes,
            divisionShiftNurses,
        },
        doc: {
            columns,
            rows: docRows,
            workerMeta,
            fixedCells: {},
            requestCells,
        },
        rowsByDocIndex,
        rowIndexByShiftNurseId,
    };
}

export const getDutyRequestStatusLabel = (isAccepted: boolean | null) => {
    if (isAccepted === true) return i18n.t('page.request.calendar.status.accepted');

    if (isAccepted === false) return i18n.t('page.request.calendar.status.rejected');

    return i18n.t('page.request.calendar.status.pending');
};

export const getDutyRequestStatusDescription = ({
    isAccepted,
    readonly,
    requestFocus,
}: {
    isAccepted: boolean | null;
    readonly: boolean;
    requestFocus: TFocus | null;
}) => {
    if (isAccepted === true) {
        return i18n.t('page.request.calendar.statusDescription.accepted');
    }

    if (isAccepted === false) {
        return i18n.t('page.request.calendar.statusDescription.rejected');
    }

    if (requestFocus === null) {
        return i18n.t('page.request.calendar.statusDescription.noFocus');
    }

    if (readonly) {
        return i18n.t('page.request.calendar.statusDescription.readonly');
    }

    return i18n.t('page.request.calendar.statusDescription.editable');
};

export const getRequestFocus = (dutyRequest: TDutyRequest, shiftNurseIdByNurseId: Map<number, number>): TFocus | null => {
    const matchedShiftNurseId = shiftNurseIdByNurseId.get(dutyRequest.nurseId);

    if (matchedShiftNurseId === undefined) return null;

    return {
        shiftNurseName: dutyRequest.nurseName,
        shiftNurseId: matchedShiftNurseId,
        day: dutyRequest.date - 1,
    };
};

export const createRequestCalendarCellFocus = ({
    shiftNurseName,
    shiftNurseId,
    day,
}: {
    shiftNurseName: string;
    shiftNurseId: number;
    day: number;
}): TFocus => ({
    shiftNurseName,
    shiftNurseId,
    day,
});

type TMoveNurseOrderPayload = {
    nurseId: number;
    destinationDivisionNum: number;
    prevPriority: number;
    nextPriority: number;
};

export const getMoveNurseOrderPayload = ({
    destination,
    draggableId,
    requestShift,
    source,
}: Pick<DropResult, 'destination' | 'draggableId' | 'source'> & {
    requestShift: TRequestShift;
} & Partial<Omit<DropResult, 'destination' | 'draggableId' | 'source'>>): TMoveNurseOrderPayload | null => {
    if (!destination) return null;

    const sourceDivision = Number.parseInt(source.droppableId, 10);
    const destinationDivision = Number.parseInt(destination.droppableId, 10);
    const draggedNurse = requestShift.divisionShiftNurses[sourceDivision].find(
        (row) => row.shiftNurse.shiftNurseId === Number.parseInt(draggableId, 10),
    )?.shiftNurse;

    if (!draggedNurse) return null;

    const destinationNurses = requestShift.divisionShiftNurses[destinationDivision];
    const destinationDivisionNum = destinationNurses[0]?.shiftNurse.divisionNum;

    if (destinationDivisionNum === undefined) return null;

    if (destination.droppableId === source.droppableId) {
        const currentIndex = destinationNurses.findIndex((row) => row.shiftNurse.shiftNurseId === draggedNurse.shiftNurseId);

        if (currentIndex !== -1 && currentIndex < destination.index) {
            return {
                nurseId: draggedNurse.nurseId,
                destinationDivisionNum,
                prevPriority: destination.index === 0 ? 0 : destinationNurses[destination.index].shiftNurse.priority,
                nextPriority:
                    destination.index === destinationNurses.length - 1
                        ? destinationNurses[destination.index].shiftNurse.priority + PRIORITY_GAP
                        : destinationNurses[destination.index + 1].shiftNurse.priority,
            };
        }
    }

    return {
        nurseId: draggedNurse.nurseId,
        destinationDivisionNum,
        prevPriority: destination.index === 0 ? 0 : destinationNurses[destination.index - 1].shiftNurse.priority,
        nextPriority:
            destination.index === destinationNurses.length
                ? destinationNurses[destination.index - 1].shiftNurse.priority + PRIORITY_GAP
                : destinationNurses[destination.index].shiftNurse.priority,
    };
};
