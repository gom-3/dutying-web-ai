import {describe, expect, it} from 'vitest';
import type {TShift} from '@/entities';
import {
    buildWorkKeyMap,
    docToCarryOverCellsDTO,
    docToFixedWardShiftsDTO,
    docToShift,
    docToSnapshotCellsDTO,
    docToWardShiftsDTO,
    isDutyDocInScheduleScope,
    isDutyShiftFullyAssigned,
    isDutyShiftWithoutAssignments,
    shiftToDoc,
} from '../shift-adapter';
import {snapshotDetailToDoc} from '../snapshot-to-doc';

function createShift(): TShift {
    return {
        lastDays: [],
        days: [
            {day: 1, dayType: 'workday'},
            {day: 2, dayType: 'workday'},
        ],
        wardShiftTypes: [
            {
                wardShiftTypeId: 10,
                name: 'Day',
                shortName: 'D',
                startTime: '07:00',
                endTime: '15:00',
                color: '#fff',
                isDefault: true,
                isOff: false,
                isCounted: true,
                classification: 'DAY',
            },
            {
                wardShiftTypeId: 20,
                name: 'Off',
                shortName: 'O',
                startTime: '00:00',
                endTime: '00:00',
                color: '#000',
                isDefault: true,
                isOff: true,
                isCounted: false,
                classification: 'OFF',
            },
            {
                wardShiftTypeId: 30,
                name: 'Training',
                shortName: 'TR',
                startTime: '09:00',
                endTime: '18:00',
                color: '#ccc',
                isDefault: false,
                isOff: false,
                isCounted: false,
                classification: 'OTHER_WORK',
            },
        ],
        divisionShiftNurses: [
            [
                {
                    shiftNurse: {
                        shiftNurseId: 1,
                        name: 'Kim',
                        carried: 0,
                        divisionNum: 0,
                        priority: 0,
                        isWorker: true,
                        nurseId: 100,
                    },
                    lastWardShiftList: [],
                    lastWardReqShiftList: [],
                    wardShiftList: [10, null],
                    wardReqShiftList: [],
                },
                {
                    shiftNurse: {
                        shiftNurseId: 2,
                        name: 'Lee',
                        carried: 0,
                        divisionNum: 0,
                        priority: 1,
                        isWorker: false as never,
                        nurseId: 101,
                    },
                    lastWardShiftList: [],
                    lastWardReqShiftList: [],
                    wardShiftList: [20, 10],
                    wardReqShiftList: [],
                },
            ],
        ],
    };
}

describe('shift-adapter', () => {
    it('detects empty shift payloads from API shape', () => {
        expect(isDutyShiftWithoutAssignments(createShift())).toBe(false);

        const noWorkers: TShift = {
            ...createShift(),
            divisionShiftNurses: [[]],
        };

        expect(isDutyShiftWithoutAssignments(noWorkers)).toBe(true);

        const onlyNullCells: TShift = {
            ...createShift(),
            divisionShiftNurses: [
                [
                    {
                        ...createShift().divisionShiftNurses[0]![0]!,
                        wardShiftList: [null, null],
                    },
                ],
            ],
        };

        expect(isDutyShiftWithoutAssignments(onlyNullCells)).toBe(true);
    });

    it('detects fully assigned worker grids', () => {
        expect(isDutyShiftFullyAssigned(createShift())).toBe(false);

        const full: TShift = {
            ...createShift(),
            divisionShiftNurses: [
                [
                    {
                        ...createShift().divisionShiftNurses[0]![0]!,
                        wardShiftList: [10, 20],
                    },
                ],
            ],
        };

        expect(isDutyShiftFullyAssigned(full)).toBe(true);

        const noWorkers: TShift = {
            ...createShift(),
            divisionShiftNurses: [[]],
        };

        expect(isDutyShiftFullyAssigned(noWorkers)).toBe(false);
    });

    it('checks that a draft belongs to the current schedule scope', () => {
        const shift = createShift();
        const doc = shiftToDoc(shift, 2026, 9);

        expect(isDutyDocInScheduleScope(doc, shift, 2026, 9)).toBe(true);
        expect(isDutyDocInScheduleScope(doc, shift, 2026, 8)).toBe(false);

        expect(isDutyDocInScheduleScope({...doc, rows: [{...doc.rows[0]!, workerId: '999'}]}, shift, 2026, 9)).toBe(false);
        expect(isDutyDocInScheduleScope({...doc, columns: ['2026-09-01']}, shift, 2026, 9)).toBe(false);
    });

    it('converts only worker rows into editor doc', () => {
        const doc = shiftToDoc(createShift(), 2026, 3);

        expect(doc.columns).toEqual(['2026-03-01', '2026-03-02']);
        expect(doc.rows).toEqual([{workerId: '1', lastCells: [null, null, null, null], cells: ['D', null]}]);
        expect(doc.workerMeta).toEqual({
            1: {name: 'Kim', nurseId: 100, priority: 0, divisionNum: 0},
        });
    });

    it('uses the previous confirmed schedule as the last-shift context', () => {
        const previousShift: TShift = {
            ...createShift(),
            days: [
                {day: 1, dayType: 'workday'},
                {day: 2, dayType: 'workday'},
                {day: 3, dayType: 'workday'},
                {day: 4, dayType: 'workday'},
                {day: 5, dayType: 'workday'},
            ],
            divisionShiftNurses: [
                [
                    {
                        ...createShift().divisionShiftNurses[0]![0]!,
                        wardShiftList: [10, 20, 30, 10, 20],
                    },
                ],
            ],
        };
        const doc = shiftToDoc(createShift(), 2026, 4, {previousConfirmedShift: previousShift});

        expect(doc.rows[0]?.lastCells).toEqual(['O', 'TR', 'D', 'O']);
    });

    it('renders snapshot cells with the current short name when the shift type id is unchanged', () => {
        const shift = createShift();

        shift.wardShiftTypes = shift.wardShiftTypes.map((shiftType) =>
            shiftType.wardShiftTypeId === 20 ? {...shiftType, shortName: '-'} : shiftType,
        );

        const doc = snapshotDetailToDoc(
            {
                rowOrder: [{shiftNurseId: 1, nurseId: 100, displayOrder: 1, priority: 0, divisionNum: 1}],
                cells: [
                    {
                        shiftNurseId: 1,
                        nurseId: 100,
                        date: '2026-03-01',
                        wardShiftTypeId: 20,
                        shiftCode: 'O',
                    },
                ],
            },
            shift,
            2026,
            3,
            {fixedCells: {}, requestCells: {}},
        );

        expect(doc.rows[0]?.cells).toEqual(['-', null]);
        expect(doc.shiftTypeRefs?.find((shiftType) => shiftType.wardShiftTypeId === 20)?.shortName).toBe('-');
    });

    it('converts editor doc back to ward shifts dto', () => {
        const shift = createShift();
        const doc = {
            columns: ['2026-03-01', '2026-03-02'],
            rows: [{workerId: '1', cells: ['O', 'D']}],
            workerMeta: {1: {name: 'Kim'}},
            fixedCells: {},
            requestCells: {},
        };

        expect(docToWardShiftsDTO(doc, shift)).toEqual([
            {shiftNurseId: 1, date: '2026-03-01', wardShiftTypeId: 20},
            {shiftNurseId: 1, date: '2026-03-02', wardShiftTypeId: 10},
        ]);
    });

    it('converts only fixed cells for the fixed-shifts step dto', () => {
        const shift = createShift();
        const doc = {
            columns: ['2026-03-01', '2026-03-02'],
            rows: [{workerId: '1', cells: ['O', 'D']}],
            workerMeta: {1: {name: 'Kim'}},
            fixedCells: {'1|2026-03-01': true as const},
            requestCells: {'1|2026-03-02': true as const},
        };

        expect(docToFixedWardShiftsDTO(doc, shift)).toEqual([
            {shiftNurseId: 1, date: '2026-03-01', wardShiftTypeId: 20},
            {shiftNurseId: 1, date: '2026-03-02', wardShiftTypeId: null},
        ]);
    });

    it('does not convert requested cells as fixed when a cell is marked both fixed and requested', () => {
        const shift = createShift();
        const doc = {
            columns: ['2026-03-01'],
            rows: [{workerId: '1', cells: ['O']}],
            workerMeta: {1: {name: 'Kim'}},
            fixedCells: {'1|2026-03-01': true as const},
            requestCells: {'1|2026-03-01': true as const},
        };

        expect(docToFixedWardShiftsDTO(doc, shift)).toEqual([{shiftNurseId: 1, date: '2026-03-01', wardShiftTypeId: null}]);
        expect(docToSnapshotCellsDTO(doc, shift)[0]).toMatchObject({
            source: 'REQUEST',
            fixed: false,
        });
    });

    it('builds rich snapshot cells for Spring schedule authoring', () => {
        const shift = createShift();
        const doc = {
            columns: ['2026-03-01', '2026-03-02'],
            rows: [{workerId: '1', cells: ['O', null]}],
            workerMeta: {1: {name: 'Kim', nurseId: 100, priority: 0, divisionNum: 1}},
            fixedCells: {'1|2026-03-01': true as const},
            requestCells: {'1|2026-03-02': true as const},
        };

        expect(docToSnapshotCellsDTO(doc, shift)).toEqual([
            {
                cellKey: '1:2026-03-01',
                shiftNurseId: 1,
                nurseId: 100,
                date: '2026-03-01',
                wardShiftTypeId: 20,
                shiftCode: 'O',
                source: 'FIXED',
                fixed: true,
            },
            {
                cellKey: '1:2026-03-02',
                shiftNurseId: 1,
                nurseId: 100,
                date: '2026-03-02',
                wardShiftTypeId: null,
                shiftCode: undefined,
                source: 'REQUEST',
                fixed: false,
            },
        ]);
    });

    it('maps carry-over cells onto the last calendar days of the previous month, right-aligned', () => {
        const shift = createShift();
        const doc = {
            columns: ['2026-04-01'],
            rows: [{workerId: '1', lastCells: ['D', 'O', 'TR', 'D'], cells: [null]}],
            workerMeta: {1: {name: 'Kim', nurseId: 100, priority: 0, divisionNum: 1}},
            fixedCells: {},
            requestCells: {},
        };

        // 2026-04 기준 직전 달은 2026-03(말일 31). 마지막 원소가 말일에 매핑된다.
        expect(docToCarryOverCellsDTO(doc, shift, 2026, 4)).toEqual([
            {
                cellKey: '1:2026-03-31',
                shiftNurseId: 1,
                nurseId: 100,
                date: '2026-03-31',
                wardShiftTypeId: 10,
                shiftCode: 'D',
                source: 'CARRY_OVER',
                fixed: true,
            },
            {
                cellKey: '1:2026-03-30',
                shiftNurseId: 1,
                nurseId: 100,
                date: '2026-03-30',
                wardShiftTypeId: 30,
                shiftCode: 'TR',
                source: 'CARRY_OVER',
                fixed: true,
            },
            {
                cellKey: '1:2026-03-29',
                shiftNurseId: 1,
                nurseId: 100,
                date: '2026-03-29',
                wardShiftTypeId: 20,
                shiftCode: 'O',
                source: 'CARRY_OVER',
                fixed: true,
            },
            {
                cellKey: '1:2026-03-28',
                shiftNurseId: 1,
                nurseId: 100,
                date: '2026-03-28',
                wardShiftTypeId: 10,
                shiftCode: 'D',
                source: 'CARRY_OVER',
                fixed: true,
            },
        ]);
    });

    it('skips left-padding blanks and unknown carry-over codes', () => {
        const shift = createShift();
        const doc = {
            columns: ['2026-04-01'],
            // 왼쪽 두 칸은 패딩 null, 'ZZ'는 알 수 없는 코드
            rows: [{workerId: '1', lastCells: [null, 'ZZ', 'O', 'D'], cells: [null]}],
            workerMeta: {1: {name: 'Kim', nurseId: 100, priority: 0, divisionNum: 1}},
            fixedCells: {},
            requestCells: {},
        };

        expect(docToCarryOverCellsDTO(doc, shift, 2026, 4)).toEqual([
            {
                cellKey: '1:2026-03-31',
                shiftNurseId: 1,
                nurseId: 100,
                date: '2026-03-31',
                wardShiftTypeId: 10,
                shiftCode: 'D',
                source: 'CARRY_OVER',
                fixed: true,
            },
            {
                cellKey: '1:2026-03-30',
                shiftNurseId: 1,
                nurseId: 100,
                date: '2026-03-30',
                wardShiftTypeId: 20,
                shiftCode: 'O',
                source: 'CARRY_OVER',
                fixed: true,
            },
        ]);
    });

    it('rolls over to the previous December for January and emits nothing without carry-over data', () => {
        const shift = createShift();
        const withCarry = {
            columns: ['2026-01-01'],
            rows: [{workerId: '1', lastCells: ['D'], cells: [null]}],
            workerMeta: {1: {name: 'Kim', nurseId: 100, priority: 0, divisionNum: 1}},
            fixedCells: {},
            requestCells: {},
        };

        expect(docToCarryOverCellsDTO(withCarry, shift, 2026, 1)).toEqual([
            {
                cellKey: '1:2025-12-31',
                shiftNurseId: 1,
                nurseId: 100,
                date: '2025-12-31',
                wardShiftTypeId: 10,
                shiftCode: 'D',
                source: 'CARRY_OVER',
                fixed: true,
            },
        ]);

        const noCarry = {
            columns: ['2026-04-01'],
            rows: [{workerId: '1', lastCells: [null, null, null, null], cells: [null]}],
            workerMeta: {1: {name: 'Kim'}},
            fixedCells: {},
            requestCells: {},
        };

        expect(docToCarryOverCellsDTO(noCarry, shift, 2026, 4)).toEqual([]);
    });

    it('builds work key map from the first character of each short name', () => {
        const shift = createShift();

        shift.wardShiftTypes = [
            shift.wardShiftTypes[0]!,
            {...shift.wardShiftTypes[1]!, shortName: 'OFF'},
            shift.wardShiftTypes[2]!,
            {
                wardShiftTypeId: 40,
                name: 'Custom',
                shortName: '_11',
                startTime: '09:00',
                endTime: '18:00',
                color: '#ddd',
                isDefault: false,
                isOff: false,
                isCounted: false,
                classification: 'OTHER_WORK',
            },
        ];

        expect(buildWorkKeyMap(shift)).toEqual({
            _: '_11',
            d: 'D',
            o: 'OFF',
            t: 'TR',
        });
    });

    it('excludes inactive shift types from keyboard entry candidates', () => {
        const shift = createShift();

        shift.wardShiftTypes = [
            shift.wardShiftTypes[0]!,
            {
                ...shift.wardShiftTypes[2]!,
                wardShiftTypeId: 40,
                name: 'Archived',
                shortName: 'A',
                isActive: false,
            },
        ];

        expect(buildWorkKeyMap(shift)).toEqual({d: 'D'});
    });

    it('projects editor doc back onto worker rows while preserving non-worker rows', () => {
        const shift = createShift();
        const doc = {
            columns: ['2026-03-01', '2026-03-02'],
            rows: [{workerId: '1', cells: ['O', 'TR']}],
            workerMeta: {1: {name: 'Kim'}},
            fixedCells: {},
            requestCells: {},
        };
        const nextShift = docToShift(doc, shift);

        expect(nextShift.divisionShiftNurses[0]?.[0]?.wardShiftList).toEqual([20, 30]);
        expect(nextShift.divisionShiftNurses[0]?.[1]?.wardShiftList).toEqual([20, 10]);
    });

    it('preserves the original shift type id when a stale editor cell no longer maps by short name', () => {
        const shift = createShift();

        shift.divisionShiftNurses[0]![0]!.wardShiftList = [20, 10];
        shift.wardShiftTypes = shift.wardShiftTypes.map((shiftType) =>
            shiftType.wardShiftTypeId === 20 ? {...shiftType, shortName: '-'} : shiftType,
        );

        const doc = {
            columns: ['2026-03-01', '2026-03-02'],
            rows: [{workerId: '1', cells: ['O', 'D']}],
            workerMeta: {1: {name: 'Kim'}},
            fixedCells: {},
            requestCells: {},
        };

        expect(docToWardShiftsDTO(doc, shift)).toEqual([
            {shiftNurseId: 1, date: '2026-03-01', wardShiftTypeId: 20},
            {shiftNurseId: 1, date: '2026-03-02', wardShiftTypeId: 10},
        ]);
    });
});
