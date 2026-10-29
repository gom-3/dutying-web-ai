import {describe, expect, it} from 'vitest';
import type {TShift} from '@/entities';
import {DEFAULT_REST_LEAVE_POLICY} from '@/pages/ward-settings/model/rest-leave-policy';
import {monthlyRestRequirement} from '../monthly-rest-requirement';

const shift = {
    wardShiftTypes: [
        {wardShiftTypeId: 4, isOff: true, classification: 'OFF'},
        {wardShiftTypeId: 5, isOff: true, classification: 'OTHER_LEAVE'},
    ],
    divisionShiftNurses: [
        [
            {shiftNurse: {shiftNurseId: 11, isWorker: true, carried: 0}},
            {shiftNurse: {shiftNurseId: 12, isWorker: true, carried: 1}},
            {shiftNurse: {shiftNurseId: 13, isWorker: false, carried: 0}},
        ],
    ],
} as unknown as TShift;

describe('monthly rest requirement', () => {
    it('sends the November nine-day target for each active nurse after excluding a worker', () => {
        expect(monthlyRestRequirement(shift, {...DEFAULT_REST_LEAVE_POLICY, enabled: true, includeHolidays: false}, 2026, 11, 0)).toEqual({
            minimumDaysByShiftNurseId: {11: 9, 12: 9},
            countedWardShiftTypeIds: [4, 5],
        });
    });
    it('uses fixed calculation as a minimum without inventing an exact upper bound', () => {
        expect(
            monthlyRestRequirement(
                shift,
                {
                    ...DEFAULT_REST_LEAVE_POLICY,
                    enabled: true,
                    targetMode: 'fixed',
                    fixedMonthlyOffDays: 8,
                    carryOverEnabled: true,
                    countedRestShiftTypeIds: [4],
                    includeHolidays: false,
                },
                2026,
                11,
                1,
            ),
        ).toEqual({minimumDaysByShiftNurseId: {11: 9, 12: 10}, countedWardShiftTypeIds: [4]});
    });
    it('omits disabled rest policy', () => {
        expect(monthlyRestRequirement(shift, {...DEFAULT_REST_LEAVE_POLICY, enabled: false}, 2026, 11, 0)).toBeUndefined();
    });
});
