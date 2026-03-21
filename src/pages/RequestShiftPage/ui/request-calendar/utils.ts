import {type DropResult} from '@hello-pangea/dnd';
import {type TDutyRequest, type TRequestShift} from '@/entities/shift';
import {type TShiftTeam} from '@/entities/ward';
import {type TFocus} from '@/features/shift/useRequestShift/type';

const PRIORITY_GAP = 2024;

export const getYearMonthLabel = (year: number, month: number) => `${year}-${month.toString().padStart(2, '0')}`;

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

export const getUnresolvedRequestCount = (dutyRequestStatus: string, dutyRequestList: TDutyRequest[] | undefined) =>
    dutyRequestStatus === 'success' ? (dutyRequestList?.filter((request) => request.isAccepted === null).length ?? 0) : 0;

export const getDutyRequestStatusLabel = (isAccepted: boolean | null) => {
    if (isAccepted === true) return '수락됨';

    if (isAccepted === false) return '거절됨';

    return '확인 필요';
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
        return '현재 신청한 근무가 반영되어 있어요.';
    }

    if (isAccepted === false) {
        return '현재 근무표에는 다른 근무로 확정되어 있어요.';
    }

    if (requestFocus === null) {
        return '현재 팀에 연결된 간호사 정보가 없어 달력 위치로는 바로 이동할 수 없어요.';
    }

    if (readonly) {
        return '패널에서는 바로 처리할 수 있고, 수정하기를 누르면 해당 날짜 위치도 함께 확인할 수 있어요.';
    }

    return '이름을 누르면 해당 날짜로 이동해 검토할 수 있어요.';
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

export const getDayBadgeClass = (dayType: TRequestShift['days'][number]['dayType'], isFocused: boolean, separateWeekendColor: boolean) => {
    if (dayType === 'saturday') {
        if (isFocused) return separateWeekendColor ? 'bg-blue text-white' : 'bg-red text-white';

        return separateWeekendColor ? 'text-blue' : 'text-red';
    }

    if (dayType === 'sunday' || dayType === 'holiday') {
        return isFocused ? 'bg-red text-white' : 'text-red';
    }

    if (dayType === 'workday') {
        return isFocused ? 'bg-main-1 text-white' : 'text-sub-2.5';
    }

    return '';
};

export const getDayCellClass = (
    dayType: TRequestShift['days'][number]['dayType'],
    isFocusedDay: boolean,
    separateWeekendColor: boolean,
) => {
    const classes = [];

    if (dayType === 'sunday' || dayType === 'holiday') {
        classes.push('bg-[#FFE1E680]');
    } else if (dayType === 'saturday') {
        classes.push(separateWeekendColor ? 'bg-[#E1E5FF80]' : 'bg-[#FFE1E680]');
    }

    if (isFocusedDay) {
        classes.push('bg-main-4');
    }

    return classes.join(' ');
};

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
