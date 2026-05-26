import {type TDutyRequest, type TRequestShift} from '@/entities/shift';

type TMockDutyRequestDecisionById = Record<number, boolean | null>;

type TMergeFrontendMockDutyRequestsParams = {
    dutyRequestList: TDutyRequest[] | undefined;
    requestShift: TRequestShift | undefined;
    year: number;
    month: number;
    mockRequestDecisionById: TMockDutyRequestDecisionById;
};

const FRONTEND_MOCK_REQUEST_ID_START = -9001;
const MOCK_REQUEST_SPECS = [
    {preferredDate: 3, nurseIndex: 0, shiftTypeIndex: 0},
    {preferredDate: 3, nurseIndex: 1, shiftTypeIndex: 1},
    {preferredDate: 7, nurseIndex: 0, shiftTypeIndex: 1},
    {preferredDate: 12, nurseIndex: 1, shiftTypeIndex: 0},
    {preferredDate: 12, nurseIndex: 0, shiftTypeIndex: 1},
    {preferredDate: 18, nurseIndex: 0, shiftTypeIndex: 0},
    {preferredDate: 18, nurseIndex: 1, shiftTypeIndex: 1},
    {preferredDate: 22, nurseIndex: 0, shiftTypeIndex: 0},
];

export const isFrontendMockDutyRequestId = (requestId: number) => requestId <= FRONTEND_MOCK_REQUEST_ID_START;

const getRequestTimestamp = ({year, month, date, index}: {year: number; month: number; date: number; index: number}) =>
    new Date(Date.UTC(year, month - 1, Math.max(date - 2, 1), 1 + index, 0, 0)).toISOString();
const createFrontendMockDutyRequests = ({
    requestShift,
    year,
    month,
    mockRequestDecisionById,
}: Omit<TMergeFrontendMockDutyRequestsParams, 'dutyRequestList'>): TDutyRequest[] => {
    if (!requestShift) return [];

    const requestRows = requestShift.divisionShiftNurses.flatMap((division) => division);
    const requestableShiftTypes = requestShift.wardShiftTypes.filter((shiftType) => shiftType.isCounted || shiftType.isOff);

    if (requestRows.length === 0 || requestableShiftTypes.length === 0 || requestShift.days.length === 0) return [];

    const mockRequests = MOCK_REQUEST_SPECS.map(({preferredDate, nurseIndex, shiftTypeIndex}, index) => {
        const requestId = FRONTEND_MOCK_REQUEST_ID_START - index;
        const requestRow = requestRows[nurseIndex % requestRows.length];
        const shiftType = requestableShiftTypes[shiftTypeIndex % requestableShiftTypes.length];
        const fallbackDay = requestShift.days[index % requestShift.days.length].day;
        const date = requestShift.days.find((day) => day.day === preferredDate)?.day ?? fallbackDay;

        return {
            wardReqShiftId: requestId,
            nurseId: requestRow.shiftNurse.nurseId,
            nurseName: requestRow.shiftNurse.name,
            date,
            requestDate: getRequestTimestamp({year, month, date, index}),
            wardShiftTypeId: shiftType.wardShiftTypeId,
            wardShiftTypeShortName: shiftType.shortName,
            wardShiftTypeColor: shiftType.color,
            isRead: false,
            isAccepted: mockRequestDecisionById[requestId] ?? null,
        };
    });
    const seenRequestKeys = new Set<string>();

    return mockRequests.filter((request) => {
        const requestKey = `${request.nurseId}:${request.date}`;

        if (seenRequestKeys.has(requestKey)) return false;

        seenRequestKeys.add(requestKey);

        return true;
    });
};

export const mergeFrontendMockDutyRequests = ({
    dutyRequestList,
    requestShift,
    year,
    month,
    mockRequestDecisionById,
}: TMergeFrontendMockDutyRequestsParams): TDutyRequest[] | undefined => {
    if (!requestShift && !dutyRequestList) return undefined;

    const realRequests = dutyRequestList ?? [];
    const realRequestKeys = new Set(realRequests.map((request) => `${request.nurseId}:${request.date}`));
    const mockRequests = createFrontendMockDutyRequests({requestShift, year, month, mockRequestDecisionById}).filter(
        (request) => !realRequestKeys.has(`${request.nurseId}:${request.date}`),
    );

    return [...realRequests, ...mockRequests];
};
