import {render} from '@testing-library/react';
import {afterEach, describe, expect, it} from 'vitest';
import {type TShift} from '@/entities';
import {type TDutyDoc, useShiftEditorStore} from '@/features/shift-editor/model';
import {MakeShiftCalendar} from '../make-shift-calendar';

const shift = {
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
            color: '#4B7BEC',
            isDefault: true,
            isOff: false,
            isCounted: true,
            classification: 'DAY',
        },
    ],
    divisionShiftNurses: [
        [],
        [
            {
                shiftNurse: {
                    shiftNurseId: 2,
                    name: 'Kim',
                    carried: 0,
                    divisionNum: 1,
                    priority: 0,
                    isWorker: true,
                    nurseId: 100,
                },
                lastWardShiftList: [],
                lastWardReqShiftList: [],
                wardShiftList: [null, 10],
                wardReqShiftList: [null, null],
            },
        ],
    ],
} satisfies TShift;

const doc: TDutyDoc = {
    columns: ['2026-05-01', '2026-05-02'],
    rows: [{workerId: '2', cells: [null, 'D']}],
    workerMeta: {'2': {name: 'Kim', nurseId: 100}},
    fixedCells: {},
    requestCells: {},
};

describe('MakeShiftCalendar', () => {
    afterEach(() => {
        useShiftEditorStore.getState().reset();
    });

    it('assigns the tutorial cell id to the first visible day cell', () => {
        render(
            <MakeShiftCalendar
                shift={shift}
                doc={doc}
                violationMap={new Map()}
                showFaults={false}
                tutorialCellId="make_fixed_shift_sample_cell"
            />,
        );

        const target = document.getElementById('make_fixed_shift_sample_cell');

        expect(target).toBeInTheDocument();
        expect(document.querySelectorAll('#make_fixed_shift_sample_cell')).toHaveLength(1);
        expect(target).toHaveAttribute('data-day-index', '0');
        expect(target?.closest('[data-shift-nurse-id]')).toHaveAttribute('data-shift-nurse-id', '2');
    });
});
