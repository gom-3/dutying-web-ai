import type {TAnnualLeaveDay} from '@dutying/api/ward';
import {renderHook} from '@testing-library/react';
import {describe, expect, it} from 'vitest';
import type {TShift} from '@/entities';
import type {TDutyDoc} from '@/features/shift-editor/model';
// eslint-disable-next-line import/no-restricted-paths
import {calculateRestCheckByShiftNurse} from '@/pages/make-shift/model/rest-target-days';
// eslint-disable-next-line import/no-restricted-paths
import {DEFAULT_REST_LEAVE_POLICY} from '@/pages/ward-settings/model/rest-leave-policy';
import {annualLeaveAssignments, annualLeaveCounts, annualLeavePreview, annualLeaveUnits, parseAnnualLeaveBulk} from '../model';
import {useAnnualLeaveRequestId} from '../ui';

const type = (id: number, shortName: string, classification: 'ANNUAL_LEAVE' | 'OFF' | 'DAY' | 'OTHER_LEAVE') => ({
    wardShiftTypeId: id,
    shortName,
    classification,
    name: shortName,
    color: '#000000',
    isDefault: false,
    isOff: classification !== 'DAY',
    isCounted: classification === 'DAY',
    startTime: '00:00',
    endTime: '00:00',
});
const shift: TShift = {
    lastDays: [],
    days: [
        {day: 1, dayType: 'workday'},
        {day: 2, dayType: 'workday'},
    ],
    wardShiftTypes: [type(1, 'AL', 'ANNUAL_LEAVE'), type(2, 'H', 'ANNUAL_LEAVE'), type(3, 'O', 'OFF'), type(4, 'D', 'DAY')],
    divisionShiftNurses: [
        [
            {
                shiftNurse: {nurseId: 20, shiftNurseId: 100, name: '김간호', carried: 0, divisionNum: 0, priority: 0, isWorker: true},
                wardShiftList: [],
                wardReqShiftList: [],
                lastWardShiftList: [],
                lastWardReqShiftList: [],
            },
        ],
    ],
};
const doc: TDutyDoc = {
    columns: ['2026-09-01', '2026-09-02'],
    rows: [{workerId: '100', cells: ['AL', 'H']}],
    workerMeta: {},
    fixedCells: {},
    requestCells: {},
};
const day: TAnnualLeaveDay = {
    nurseId: 20,
    date: '2026-09-01',
    days: 0.5,
    source: 'DAY_USAGE',
    shiftTypeId: 1,
    referenceShiftTypeId: 1,
    entryId: 1,
    needsReview: false,
    partialWork: false,
};
const people = [
    {nurseId: 20, name: '김간호', version: 1},
    {nurseId: 21, name: '김간호', version: 3},
];
const bulk = (value: string) => parseAnnualLeaveBulk(value, people, '2026-09-01', null, '병원 자료');

describe('annual leave accounting inputs', () => {
    it('counts multiple annual types using date-effective fractional units only', () => {
        const rules = [
            {shiftTypeId: 2, days: 0.125, effectiveFrom: '2026-09-01'},
            {shiftTypeId: 2, days: 0.5, effectiveFrom: '2026-10-01'},
        ];

        expect(annualLeaveCounts(shift, annualLeavePreview(shift, doc, 3, 2026, 9), rules).get(20)).toBe(1.125);
        expect(annualLeaveUnits(type(5, 'S', 'OTHER_LEAVE'), '2026-09-01')).toBe(0);
        expect(annualLeaveUnits(shift.wardShiftTypes[1], '2026-10-01', rules)).toBe(0.5);
    });
    it('date override replaces a cell rather than being added', () => {
        expect(annualLeaveCounts(shift, annualLeavePreview(shift, doc, 3, 2026, 9), [], [day]).get(20)).toBe(1.5);
    });
    it('never propagates an exception to another month', () => {
        const next = {...doc, columns: ['2026-10-01', '2026-10-02']};

        expect(annualLeaveCounts(shift, annualLeavePreview(shift, next, 3, 2026, 10), [], [day]).get(20)).toBe(2);
    });
    it('uses frozen confirmed deductions for matching assignments, and current rules for new types', () => {
        const saved = {...day, source: 'SCHEDULE' as const, days: 1};
        const rules = [
            {shiftTypeId: 1, days: 0.5, effectiveFrom: null},
            {shiftTypeId: 2, days: 0.125, effectiveFrom: null},
        ];
        const request = annualLeavePreview(shift, doc, 3, 2026, 9);
        const resolved = annualLeaveAssignments(shift, request, rules, [saved]);

        expect(resolved.map((item) => item.days)).toEqual([1, 0.125]);
        expect(annualLeaveCounts(shift, request, rules, [saved]).get(20)).toBe(1.125);

        const changed = {...request, cells: request.cells.map((cell) => ({...cell, shiftTypeId: 2}))};

        expect(annualLeaveCounts(shift, changed, rules, [saved]).get(20)).toBe(0.25);
    });
    it('counts displayed assignments even when the ledger omits the opening date or dates before tracking', () => {
        const request = annualLeavePreview(shift, doc, 3, 2026, 9);
        const partial = [{...day, date: '2026-09-02', shiftTypeId: 2, source: 'SCHEDULE' as const, days: 0.5}];

        expect(annualLeaveAssignments(shift, request, [], partial).map((item) => item.days)).toEqual([1, 0.5]);
        expect(annualLeaveCounts(shift, request, [], partial).get(20)).toBe(1.5);
    });
    it('preserves blank versus verified zero and disambiguates same names by ID', () => {
        const rows = bulk('20\t김간호\t0\n21\t김간호\t');

        expect(rows.map((row) => row.remainingDays)).toEqual([0, null]);
        expect(rows.map((row) => row.version)).toEqual([1, 3]);
    });
    it('allows negative and fractional opening days', () => {
        expect(bulk('20\t김간호\t-1.125')[0]?.remainingDays).toBe(-1.125);
    });
    it.each(['20\t다른이름\t1', '99\t김간호\t1', '20\t김간호\t1\n20\t김간호\t2', '20\t김간호\t1.1234', '20\t김간호\tNaN'])(
        'rejects ambiguous or invalid bulk input %s',
        (input) => {
            expect(() => bulk(input)).toThrow();
        },
    );
    it('keeps request ID on a version refresh after an uncertain response', () => {
        const {result, rerender} = renderHook(() => useAnnualLeaveRequestId());
        const first = result.current({entries: [{version: 1, remainingDays: 5}]});

        rerender();
        expect(result.current({entries: [{version: 2, remainingDays: 5}]})).toBe(first);
        expect(result.current({entries: [{version: 2, remainingDays: 6}]})).not.toBe(first);
    });
});

describe('OFF cell annual leave exceptions and monthly rest policy', () => {
    function rest(exception: TAnnualLeaveDay) {
        return calculateRestCheckByShiftNurse({
            shift,
            doc: {...doc, rows: [{workerId: '100', cells: ['O', 'O']}]},
            policy: {
                ...DEFAULT_REST_LEAVE_POLICY,
                enabled: true,
                countedRestShiftTypeIds: [3],
                targetMode: 'fixed',
                fixedMonthlyOffDays: 2,
            },
            year: 2026,
            month: 9,
            adjustmentDays: 0,
            annualLeaveDays: [exception],
        })?.[100]?.assignedDays;
    }

    it('uses the referenced annual type for a full OFF day processed as leave', () =>
        expect(rest({...day, days: 1, shiftTypeId: 3})).toBe(1));
    it('does not turn partial leave into a full OFF exclusion', () => expect(rest({...day, days: 0.5, shiftTypeId: 3})).toBe(2));
    it('does not silently apply an unresolved exception', () => expect(rest({...day, days: 1, shiftTypeId: 3, needsReview: true})).toBe(2));
});
