import {fireEvent, render, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {act} from 'react';
import {afterEach, describe, expect, it} from 'vitest';
import {type TShift} from '@/entities';
import {type TDutyDoc, type TViolation, useShiftEditorStore} from '@/features/shift-editor/model';
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

    it('shows only one plain problem sentence per violation in the popover', async () => {
        const user = userEvent.setup();
        const offViolation: TViolation = {
            ruleId: 'llm.L2_MIN_OFF_AFTER_NIGHT:100',
            message: '야간 후 휴무가 부족해요: Kim님은 야간 후 휴무가 1일이에요. 2일 필요해요.',
            level: 'warning',
            cells: [{row: 0, col: 1}],
            scope: 'nurse',
        };
        const staffingViolation: TViolation = {
            ruleId: 'llm.L3_MIN_STAFF_SHORTAGE:D:2026-05-02',
            message: 'D 근무 인원이 부족해요.',
            level: 'error',
            cells: [{row: 0, col: 1}],
            scope: 'nurse',
        };

        render(
            <MakeShiftCalendar
                shift={shift}
                doc={doc}
                violationMap={
                    new Map([
                        ['2,1-off', offViolation],
                        ['2,1-staffing', staffingViolation],
                    ])
                }
                showFaults
                readonly
            />,
        );

        const trigger = document.querySelector<HTMLButtonElement>('[data-shift-nurse-id="2"] [data-day-index="1"]');

        expect(trigger).not.toBeNull();
        await act(async () => {
            await user.click(trigger!);
        });

        expect(screen.getByRole('dialog', {name: '제약 문제'})).toBeInTheDocument();
        expect(screen.getByText('야간 후 휴무가 1일이라 2일보다 부족해요.')).toBeInTheDocument();
        expect(screen.getByText('D 근무 인원이 부족해요.')).toBeInTheDocument();
        expect(screen.queryByText('Kim · 2일')).not.toBeInTheDocument();
        expect(screen.queryByText('확인할 제약이 2개 있어요')).not.toBeInTheDocument();
        expect(screen.queryByText('필수')).not.toBeInTheDocument();
        expect(screen.queryByText('권장')).not.toBeInTheDocument();
        expect(screen.queryByText('참고')).not.toBeInTheDocument();
    });

    it('opens a shift type dropdown on editable cell double click and writes the selected type', async () => {
        act(() => {
            useShiftEditorStore.getState().setDoc(doc);
        });

        render(<MakeShiftCalendar shift={shift} doc={doc} violationMap={new Map()} showFaults />);
        await act(async () => undefined);

        const trigger = document.querySelector<HTMLButtonElement>('[data-shift-nurse-id="2"] [data-day-index="0"]');

        expect(trigger).not.toBeNull();
        act(() => {
            fireEvent.doubleClick(trigger!);
        });

        expect(await screen.findByRole('listbox', {name: '근무유형 선택'})).toBeInTheDocument();

        act(() => {
            fireEvent.click(screen.getByRole('option', {name: /Day/}));
        });

        expect(useShiftEditorStore.getState().doc.rows[0]?.cells[0]).toBe('D');
        expect(screen.queryByRole('listbox', {name: '근무유형 선택'})).not.toBeInTheDocument();
    });

    it('does not open the shift type dropdown when the calendar is readonly', async () => {
        act(() => {
            useShiftEditorStore.getState().setDoc(doc);
        });

        render(<MakeShiftCalendar shift={shift} doc={doc} violationMap={new Map()} showFaults={false} readonly />);

        const trigger = document.querySelector<HTMLButtonElement>('[data-shift-nurse-id="2"] [data-day-index="0"]');

        expect(trigger).not.toBeNull();
        act(() => {
            fireEvent.doubleClick(trigger!);
        });

        expect(screen.queryByRole('listbox', {name: '근무유형 선택'})).not.toBeInTheDocument();
    });
});
