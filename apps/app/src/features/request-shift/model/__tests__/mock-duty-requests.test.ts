import {describe, expect, it} from 'vitest';
import type {TDutyRequest, TRequestShift} from '@/entities/shift';
import {isFrontendMockDutyRequestId, mergeFrontendMockDutyRequests} from '../mock-duty-requests';

const requestShiftFixture: TRequestShift = {
    days: [
        {day: 1, dayType: 'workday'},
        {day: 2, dayType: 'workday'},
        {day: 3, dayType: 'workday'},
        {day: 4, dayType: 'workday'},
        {day: 7, dayType: 'saturday'},
        {day: 12, dayType: 'workday'},
        {day: 18, dayType: 'workday'},
        {day: 22, dayType: 'workday'},
    ],
    wardShiftTypes: [
        {
            wardShiftTypeId: 11,
            name: 'Day',
            shortName: 'D',
            startTime: '07:00',
            endTime: '15:00',
            color: '#7457FF',
            isDefault: true,
            isOff: false,
            isCounted: true,
            classification: 'DAY',
        },
        {
            wardShiftTypeId: 12,
            name: 'Off',
            shortName: 'O',
            startTime: '',
            endTime: '',
            color: '#E4E7EC',
            isDefault: false,
            isOff: true,
            isCounted: false,
            classification: 'OFF',
        },
    ],
    divisionShiftNurses: [
        [
            {
                shiftNurse: {
                    shiftNurseId: 101,
                    nurseId: 1001,
                    name: 'Kim',
                    carried: 0,
                    divisionNum: 1,
                    priority: 1,
                    isWorker: true,
                },
                carry: 0,
                wardReqShiftList: [],
            },
        ],
        [
            {
                shiftNurse: {
                    shiftNurseId: 102,
                    nurseId: 1002,
                    name: 'Lee',
                    carried: 0,
                    divisionNum: 2,
                    priority: 2,
                    isWorker: true,
                },
                carry: 0,
                wardReqShiftList: [],
            },
        ],
    ],
};
const realRequestFixture: TDutyRequest = {
    wardReqShiftId: 301,
    nurseId: 1001,
    nurseName: 'Kim',
    date: 3,
    requestDate: '2026-05-01T00:00:00.000Z',
    wardShiftTypeId: 11,
    wardShiftTypeShortName: 'D',
    wardShiftTypeColor: '#7457FF',
    isRead: true,
    isAccepted: null,
};

describe('frontend request shift mocks', () => {
    it('adds temporary mock requests that can be identified by id', () => {
        const mergedRequests = mergeFrontendMockDutyRequests({
            dutyRequestList: [],
            requestShift: requestShiftFixture,
            year: 2026,
            month: 6,
            mockRequestDecisionById: {},
        });

        expect(mergedRequests).toHaveLength(8);
        expect(mergedRequests?.every((request) => isFrontendMockDutyRequestId(request.wardReqShiftId))).toBe(true);
        expect(mergedRequests?.map((request) => request.nurseName)).toEqual(['Kim', 'Lee', 'Kim', 'Lee', 'Kim', 'Kim', 'Lee', 'Kim']);
    });

    it('includes same-day requests from multiple nurses and multiple requests from one nurse', () => {
        const mergedRequests = mergeFrontendMockDutyRequests({
            dutyRequestList: [],
            requestShift: requestShiftFixture,
            year: 2026,
            month: 6,
            mockRequestDecisionById: {},
        });
        const requestsByDate = new Map<number, TDutyRequest[]>();
        const kimRequests = mergedRequests?.filter((request) => request.nurseName === 'Kim') ?? [];

        for (const request of mergedRequests ?? []) {
            requestsByDate.set(request.date, [...(requestsByDate.get(request.date) ?? []), request]);
        }

        expect(requestsByDate.get(3)?.map((request) => request.nurseName)).toEqual(['Kim', 'Lee']);
        expect(requestsByDate.get(12)?.map((request) => request.nurseName)).toEqual(['Lee', 'Kim']);
        expect(kimRequests.map((request) => request.date)).toEqual([3, 7, 12, 18, 22]);
    });

    it('keeps real requests first and does not duplicate the same nurse/date slot', () => {
        const mergedRequests = mergeFrontendMockDutyRequests({
            dutyRequestList: [realRequestFixture],
            requestShift: requestShiftFixture,
            year: 2026,
            month: 6,
            mockRequestDecisionById: {},
        });

        expect(mergedRequests?.[0]).toEqual(realRequestFixture);
        expect(mergedRequests?.filter((request) => request.nurseId === 1001 && request.date === 3)).toHaveLength(1);
    });

    it('applies local decisions to mock requests', () => {
        const mergedRequests = mergeFrontendMockDutyRequests({
            dutyRequestList: [],
            requestShift: requestShiftFixture,
            year: 2026,
            month: 6,
            mockRequestDecisionById: {
                [-9001]: true,
            },
        });

        expect(mergedRequests?.[0]?.isAccepted).toBe(true);
        expect(mergedRequests?.[1]?.isAccepted).toBeNull();
    });
});
