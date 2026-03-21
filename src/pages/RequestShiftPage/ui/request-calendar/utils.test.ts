import {describe, expect, it} from 'vitest';
import {type TRequestShift} from '@/entities/shift';
import {getMoveNurseOrderPayload, getRequestFocus} from './utils';

const createRequestShift = (): TRequestShift =>
    ({
        days: [],
        wardShiftTypes: [],
        divisionShiftNurses: [
            [
                {
                    shiftNurse: {
                        shiftNurseId: 11,
                        nurseId: 101,
                        divisionNum: 1,
                        priority: 100,
                    },
                    carry: 0,
                    wardReqShiftList: [],
                },
                {
                    shiftNurse: {
                        shiftNurseId: 12,
                        nurseId: 102,
                        divisionNum: 1,
                        priority: 200,
                    },
                    carry: 0,
                    wardReqShiftList: [],
                },
                {
                    shiftNurse: {
                        shiftNurseId: 13,
                        nurseId: 103,
                        divisionNum: 1,
                        priority: 300,
                    },
                    carry: 0,
                    wardReqShiftList: [],
                },
            ],
            [
                {
                    shiftNurse: {
                        shiftNurseId: 21,
                        nurseId: 201,
                        divisionNum: 2,
                        priority: 400,
                    },
                    carry: 0,
                    wardReqShiftList: [],
                },
                {
                    shiftNurse: {
                        shiftNurseId: 22,
                        nurseId: 202,
                        divisionNum: 2,
                        priority: 500,
                    },
                    carry: 0,
                    wardReqShiftList: [],
                },
            ],
        ],
    }) as TRequestShift;

describe('request-calendar utils', () => {
    it('같은 division 안에서 아래로 이동할 때 다음 우선순위를 기준으로 계산한다', () => {
        const requestShift = createRequestShift();
        const payload = getMoveNurseOrderPayload({
            source: {droppableId: '0', index: 0},
            destination: {droppableId: '0', index: 2},
            draggableId: '11',
            requestShift,
            type: 'DEFAULT',
            reason: 'DROP',
            mode: 'FLUID',
            combine: null,
        });

        expect(payload).toEqual({
            nurseId: 101,
            destinationDivisionNum: 1,
            prevPriority: 300,
            nextPriority: 2324,
        });
    });

    it('다른 division으로 이동할 때 이전 행 우선순위를 기준으로 계산한다', () => {
        const requestShift = createRequestShift();
        const payload = getMoveNurseOrderPayload({
            source: {droppableId: '0', index: 1},
            destination: {droppableId: '1', index: 1},
            draggableId: '12',
            requestShift,
            type: 'DEFAULT',
            reason: 'DROP',
            mode: 'FLUID',
            combine: null,
        });

        expect(payload).toEqual({
            nurseId: 102,
            destinationDivisionNum: 2,
            prevPriority: 400,
            nextPriority: 500,
        });
    });

    it('신청 내역에서 포커스 가능한 간호사를 찾으면 focus 객체를 반환한다', () => {
        const focus = getRequestFocus(
            {
                wardReqShiftId: 1,
                nurseId: 101,
                nurseName: '김간호',
                date: 3,
                requestDate: '2026-03-01',
                wardShiftTypeId: 9,
                wardShiftTypeShortName: 'D',
                wardShiftTypeColor: '#000000',
                isRead: false,
                isAccepted: null,
            },
            new Map([[101, 11]]),
        );

        expect(focus).toEqual({
            shiftNurseName: '김간호',
            shiftNurseId: 11,
            day: 2,
        });
    });

    it('매칭되는 간호사가 없으면 focus를 만들지 않는다', () => {
        const focus = getRequestFocus(
            {
                wardReqShiftId: 1,
                nurseId: 999,
                nurseName: '김간호',
                date: 3,
                requestDate: '2026-03-01',
                wardShiftTypeId: 9,
                wardShiftTypeShortName: 'D',
                wardShiftTypeColor: '#000000',
                isRead: false,
                isAccepted: null,
            },
            new Map([[101, 11]]),
        );

        expect(focus).toBeNull();
    });
});
