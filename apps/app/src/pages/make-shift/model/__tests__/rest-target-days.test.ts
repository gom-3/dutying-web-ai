import {describe, expect, it} from 'vitest';
import type {TShift} from '@/entities';
import type {TDutyDoc} from '@/features/shift-editor/model';
import {DEFAULT_REST_LEAVE_POLICY} from '@/pages/ward-settings/model/rest-leave-policy';
import {calculateRestCheckByShiftNurse} from '../rest-target-days';

const restShiftType = {
    wardShiftTypeId: 1,
    name: 'Off',
    shortName: 'O',
    startTime: '00:00',
    endTime: '00:00',
    color: '#465b7a',
    isDefault: true,
    isOff: true,
    isCounted: true,
    classification: 'OFF',
} satisfies TShift['wardShiftTypes'][number];
const shiftNurse = {
    shiftNurseId: 101,
    nurseId: 201,
    name: 'Kim',
    carried: 0,
    divisionNum: 1,
    priority: 1,
    isWorker: true,
} satisfies TShift['divisionShiftNurses'][number][number]['shiftNurse'];

function createShift(days: TShift['days']): TShift {
    return {
        lastDays: [],
        days,
        wardShiftTypes: [restShiftType],
        divisionShiftNurses: [
            [
                {
                    shiftNurse,
                    lastWardShiftList: [],
                    lastWardReqShiftList: [],
                    wardShiftList: days.map(() => null),
                    wardReqShiftList: days.map(() => null),
                },
            ],
        ],
    };
}

function createDoc(days: TShift['days']): TDutyDoc {
    return {
        columns: days.map((day) => `2026-06-${String(day.day).padStart(2, '0')}`),
        rows: [{workerId: String(shiftNurse.shiftNurseId), cells: days.map(() => null)}],
        workerMeta: {},
        fixedCells: {},
        requestCells: {},
    };
}

describe('rest target days', () => {
    it('uses the configured monthly target without adding holidays automatically', () => {
        const days: TShift['days'] = [
            {day: 1, dayType: 'workday'},
            {day: 2, dayType: 'holiday'},
        ];
        const result = calculateRestCheckByShiftNurse({
            shift: createShift(days),
            doc: createDoc(days),
            policy: {
                ...DEFAULT_REST_LEAVE_POLICY,
                targetMode: 'fixed',
                fixedMonthlyOffDays: 10,
                includeHolidays: true,
            },
            year: 2026,
            month: 6,
            adjustmentDays: 0,
        });

        expect(result?.[shiftNurse.shiftNurseId]).toMatchObject({
            targetDays: 10,
            assignedDays: 0,
            differenceDays: -10,
        });
    });

    it('applies the make page adjustment to the configured target', () => {
        const days: TShift['days'] = [
            {day: 1, dayType: 'workday'},
            {day: 2, dayType: 'holiday'},
        ];
        const result = calculateRestCheckByShiftNurse({
            shift: createShift(days),
            doc: createDoc(days),
            policy: {
                ...DEFAULT_REST_LEAVE_POLICY,
                targetMode: 'fixed',
                fixedMonthlyOffDays: 10,
                includeHolidays: true,
            },
            year: 2026,
            month: 6,
            adjustmentDays: 1,
        });

        expect(result?.[shiftNurse.shiftNurseId]).toMatchObject({
            targetDays: 11,
            assignedDays: 0,
            differenceDays: -11,
        });
    });
});
