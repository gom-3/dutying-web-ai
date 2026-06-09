import {createEvent, fireEvent, render, screen, within} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {act} from 'react';
import {afterEach, describe, expect, it} from 'vitest';
import {type TShift} from '@/entities';
import {useUIConfigStore} from '@/entities/ui/useUIConfig/store';
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
    rows: [{workerId: '2', lastCells: [null, null, null, null], cells: [null, 'D']}],
    workerMeta: {'2': {name: 'Kim', nurseId: 100}},
    fixedCells: {},
    requestCells: {},
};

describe('MakeShiftCalendar', () => {
    afterEach(() => {
        useShiftEditorStore.getState().reset();
        useUIConfigStore.getState().reset();
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

    it('aligns date headers to the same day grid as calendar cells', () => {
        render(<MakeShiftCalendar shift={shift} doc={doc} violationMap={new Map()} showFaults={false} readonly />);

        const headerGrid = document.querySelector<HTMLElement>('.make-shift-calendar__day-header-pill');
        const cellGrid = document.querySelector<HTMLElement>('.make-shift-calendar__row-days');

        expect(headerGrid).toHaveClass('px-0');
        expect(headerGrid).not.toHaveClass('px-1.5');
        expect(headerGrid?.style.gridTemplateColumns).toBe(cellGrid?.style.gridTemplateColumns);
    });

    it('shows the nurse once in the header and keeps violation rows compact', async () => {
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
            templateCode: 'MIN_STAFF_BY_SHIFT',
            affectedCells: [
                {
                    cellKey: '2:2026-05-02',
                    shiftNurseId: 2,
                    nurseId: 100,
                    nurseName: 'Kim',
                    date: '2026-05-02',
                    wardShiftTypeId: 10,
                    shiftCode: 'D',
                },
                {
                    cellKey: '3:2026-05-02',
                    shiftNurseId: 3,
                    nurseId: 101,
                    nurseName: 'Lee',
                    date: '2026-05-02',
                    wardShiftTypeId: null,
                    shiftCode: null,
                },
            ],
            fixable: true,
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

        const popover = screen.getByRole('dialog', {name: '제약조건 위반 2개'});
        const popoverContent = within(popover);

        expect(popover).toBeInTheDocument();
        expect(popoverContent.getByText('Kim')).toBeInTheDocument();
        expect(popoverContent.getByText('2일 · 중요 1 · 일반 1')).toBeInTheDocument();
        expect(popoverContent.getByText('중요')).toBeInTheDocument();
        expect(popoverContent.getByText('일반')).toBeInTheDocument();
        expect(popoverContent.getByText('야간 후 휴무가 1일이라 2일보다 부족해요.')).toBeInTheDocument();
        expect(popoverContent.getByText('D 근무 인원이 부족해요.')).toBeInTheDocument();
        expect(popoverContent.queryByText('Kim · 2일')).not.toBeInTheDocument();
        expect(popoverContent.queryByText('5/2 · Kim 외 1명')).not.toBeInTheDocument();
        expect(popoverContent.queryByText('Kim 외 1명')).not.toBeInTheDocument();
        expect(popoverContent.queryByText('Kim · D')).not.toBeInTheDocument();
        expect(popoverContent.queryByText('Lee · 미배정')).not.toBeInTheDocument();
        expect(popoverContent.queryByText('수정 가능')).not.toBeInTheDocument();
    });

    it('counts duplicate date violations once in the header popover', async () => {
        const user = userEvent.setup();
        const repeatedDayCells = Array.from({length: 10}, (_, row) => ({row, col: 1}));
        const dayStaffingViolation: TViolation = {
            ruleId: 'staffing-D',
            message: 'D 근무 인원이 0명이에요. 최소 1명이 필요해요.',
            level: 'error',
            cells: repeatedDayCells,
            scope: 'team',
        };
        const eveningStaffingViolation: TViolation = {
            ruleId: 'staffing-E',
            message: 'E 근무 인원이 0명이에요. 최소 1명이 필요해요.',
            level: 'error',
            cells: repeatedDayCells,
            scope: 'team',
        };

        render(
            <MakeShiftCalendar
                shift={shift}
                doc={doc}
                violationMap={new Map()}
                teamViolations={[dayStaffingViolation, eveningStaffingViolation]}
                showFaults
                readonly
            />,
        );

        const dayHeader = document.querySelector<HTMLButtonElement>('[data-day-header-index="1"]');

        expect(dayHeader).not.toBeNull();
        expect(dayHeader).toHaveAttribute('data-violation-trigger', 'true');
        expect(dayHeader!.querySelector('.make-shift-calendar__violation-marker')).toHaveTextContent('2');

        await act(async () => {
            await user.click(dayHeader!);
        });

        const popover = screen.getByRole('dialog', {name: '제약조건 위반 2개'});
        const popoverContent = within(popover);

        expect(popoverContent.getByText('중요 2')).toBeInTheDocument();
        expect(popoverContent.getAllByText('D 근무 인원이 0명이에요. 최소 1명이 필요해요.')).toHaveLength(1);
        expect(popoverContent.getAllByText('E 근무 인원이 0명이에요. 최소 1명이 필요해요.')).toHaveLength(1);
        expect(screen.queryByRole('dialog', {name: '제약조건 위반 20개'})).not.toBeInTheDocument();
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
        expect(trigger).not.toHaveClass('bg-main-4/70');
        expect(trigger!.closest('[data-shift-nurse-id]')?.querySelector('[data-selection-layer="true"]')).toHaveClass('bg-main-4/70');
        expect(trigger!.querySelector('.make-shift-calendar__shift-badge')).not.toHaveClass('outline-[1px]', 'outline-main-1');
        expect(trigger!.querySelector('.outline-2')).not.toBeInTheDocument();

        act(() => {
            fireEvent.click(screen.getByRole('option', {name: /Day/}));
        });

        expect(useShiftEditorStore.getState().doc.rows[0]?.cells[0]).toBe('D');
        expect(screen.queryByRole('listbox', {name: '근무유형 선택'})).not.toBeInTheDocument();
    });

    it('opens the shift type dropdown on editable previous-shift cells', async () => {
        act(() => {
            useShiftEditorStore.getState().setDoc(doc);
        });

        render(<MakeShiftCalendar shift={shift} doc={doc} violationMap={new Map()} showFaults editableLastShifts />);
        await act(async () => undefined);

        const trigger = document.querySelector<HTMLButtonElement>('[data-shift-nurse-id="2"] [data-last-shift-index="0"]');

        expect(trigger).not.toBeNull();
        act(() => {
            fireEvent.doubleClick(trigger!);
        });

        expect(await screen.findByRole('listbox', {name: '근무유형 선택'})).toBeInTheDocument();
        expect(trigger).not.toHaveClass('bg-main-4/70');
        expect(trigger!.querySelector('.make-shift-calendar__selection-bg')).toHaveClass('bg-main-4/70');
        expect(trigger!.querySelector('.make-shift-calendar__row-last-shift-badge')).not.toHaveClass('outline-[1px]', 'outline-main-1');
        expect(trigger!.querySelector('.outline-2')).not.toBeInTheDocument();

        act(() => {
            fireEvent.click(screen.getByRole('option', {name: /Day/}));
        });

        expect(useShiftEditorStore.getState().doc.rows[0]?.lastCells?.[0]).toBe('D');
        expect(screen.queryByRole('listbox', {name: '근무유형 선택'})).not.toBeInTheDocument();
    });

    it('opens the shift type dropdown on editable previous-shift cells in fixed mode', async () => {
        const user = userEvent.setup();

        act(() => {
            useShiftEditorStore.getState().setDoc(doc);
            useShiftEditorStore.getState().setEditorMode('fixed');
        });

        render(<MakeShiftCalendar shift={shift} doc={doc} violationMap={new Map()} showFaults editableLastShifts />);
        await act(async () => undefined);

        const trigger = document.querySelector<HTMLButtonElement>('[data-shift-nurse-id="2"] [data-last-shift-index="0"]');

        expect(trigger).not.toBeNull();
        await act(async () => {
            await user.dblClick(trigger!);
        });

        expect(await screen.findByRole('listbox')).toBeInTheDocument();

        act(() => {
            fireEvent.click(screen.getByRole('option', {name: /Day/}));
        });

        expect(useShiftEditorStore.getState().doc.rows[0]?.lastCells?.[0]).toBe('D');
        expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    });

    it('highlights selected day cells with a background instead of a stroke', async () => {
        const user = userEvent.setup();

        act(() => {
            useShiftEditorStore.getState().setDoc(doc);
        });

        render(<MakeShiftCalendar shift={shift} doc={doc} violationMap={new Map()} showFaults={false} />);

        const trigger = document.querySelector<HTMLButtonElement>('[data-shift-nurse-id="2"] [data-day-index="0"]');

        expect(trigger).not.toBeNull();
        await act(async () => {
            await user.click(trigger!);
        });

        expect(trigger).not.toHaveClass('bg-main-4/70');
        expect(trigger!.closest('[data-shift-nurse-id]')?.querySelector('[data-selection-layer="true"]')).toHaveClass('bg-main-4/70');
        expect(document.querySelector('[data-day-header-index="0"]')).toHaveClass('bg-[#8D7CF6]', 'text-white');
        expect(document.querySelector('[data-day-header-index="0"]')?.className).not.toContain('shadow-[inset');
        expect(trigger!.closest('[data-shift-nurse-id]')?.querySelector('[data-selected-row-label="true"]')).toHaveClass('text-main-1');
        expect(trigger!.closest('[data-shift-nurse-id]')?.querySelector('[data-selected-row-label="true"]')).not.toHaveClass(
            'bg-main-4/70',
        );
        expect(trigger!.querySelector('.make-shift-calendar__shift-badge')).not.toHaveClass('outline-[1px]', 'outline-main-1');
        expect(trigger!.querySelector('span[aria-hidden]')).not.toBeInTheDocument();
    });

    it('prevents editable day cells from taking native mouse focus', () => {
        act(() => {
            useShiftEditorStore.getState().setDoc(doc);
        });

        render(<MakeShiftCalendar shift={shift} doc={doc} violationMap={new Map()} showFaults={false} />);

        const trigger = document.querySelector<HTMLButtonElement>('[data-shift-nurse-id="2"] [data-day-index="0"]');

        expect(trigger).not.toBeNull();

        const mouseDown = createEvent.mouseDown(trigger!, {button: 0});

        fireEvent(trigger!, mouseDown);

        expect(mouseDown.defaultPrevented).toBe(true);
    });

    it.each([
        ['holiday', 'holiday'],
        ['HOLIDAY', 'holiday'],
        ['public_holiday', 'publicholiday'],
        ['substituteHoliday', 'substituteholiday'],
    ])('uses red selected date backgrounds for %s day types', async (dayType, normalizedDayType) => {
        const user = userEvent.setup();
        const holidayShift = {
            ...shift,
            days: [
                {day: 1, dayType: 'workday'},
                {day: 2, dayType: dayType as TShift['days'][number]['dayType']},
            ],
        } satisfies TShift;

        act(() => {
            useShiftEditorStore.getState().setDoc(doc);
        });

        render(<MakeShiftCalendar shift={holidayShift} doc={doc} violationMap={new Map()} showFaults={false} />);

        const holidayCell = document.querySelector<HTMLButtonElement>('[data-shift-nurse-id="2"] [data-day-index="1"]');

        expect(holidayCell).not.toBeNull();
        expect(document.querySelector('[data-day-header-index="1"]')).toHaveClass('text-red');
        expect(document.querySelector('[data-day-header-index="1"]')).toHaveAttribute('data-day-type', normalizedDayType);
        expect(holidayCell).toHaveAttribute('data-day-type', normalizedDayType);
        expect(holidayCell).toHaveClass('bg-red/5');

        await act(async () => {
            await user.click(holidayCell!);
        });

        expect(document.querySelector('[data-day-header-index="1"]')).toHaveClass('bg-[#FF8491]', 'text-white');
    });

    it('uses blue for selected Saturdays', async () => {
        const user = userEvent.setup();
        const saturdayShift = {
            ...shift,
            days: [
                {day: 1, dayType: 'saturday'},
                {day: 2, dayType: 'workday'},
            ],
        } satisfies TShift;

        act(() => {
            useShiftEditorStore.getState().setDoc(doc);
        });

        render(<MakeShiftCalendar shift={saturdayShift} doc={doc} violationMap={new Map()} showFaults={false} />);

        const saturdayCell = document.querySelector<HTMLButtonElement>('[data-shift-nurse-id="2"] [data-day-index="0"]');

        expect(saturdayCell).not.toBeNull();
        expect(document.querySelector('[data-day-header-index="0"]')).toHaveClass('text-blue');
        expect(document.querySelector('[data-day-header-index="0"]')).toHaveAttribute('data-day-type', 'saturday');

        await act(async () => {
            await user.click(saturdayCell!);
        });

        expect(document.querySelector('[data-day-header-index="0"]')).toHaveClass('bg-[#6EA8FF]', 'text-white');
    });

    it('keeps the selected day background below violation highlights', async () => {
        const user = userEvent.setup();
        const violation: TViolation = {
            ruleId: 'llm.L3_MIN_STAFF_SHORTAGE:D:2026-05-01',
            message: 'D 근무 인원이 부족해요.',
            level: 'error',
            cells: [{row: 0, col: 0}],
            scope: 'nurse',
        };

        act(() => {
            useShiftEditorStore.getState().setDoc(doc);
        });

        render(<MakeShiftCalendar shift={shift} doc={doc} violationMap={new Map([['2,0-staffing', violation]])} showFaults />);

        const trigger = document.querySelector<HTMLButtonElement>('[data-shift-nurse-id="2"] [data-day-index="0"]');

        expect(trigger).not.toBeNull();
        await act(async () => {
            await user.click(trigger!);
        });

        const rowDays = trigger!.closest('.make-shift-calendar__row-days');
        const marker = trigger!.querySelector('.make-shift-calendar__violation-marker');

        expect(rowDays?.querySelector('[data-selection-layer="true"]')).toHaveClass('z-[1]');
        expect(rowDays?.querySelector('.make-shift-calendar__violation')).toHaveClass('z-[6]');
        expect(marker).toHaveClass('top-[clamp(2px,0.18cqw,3px)]', 'right-[clamp(2px,0.18cqw,3px)]');
        expect(marker).not.toHaveClass('translate-x-1/2', '-translate-y-1/2');
        expect(marker?.className).not.toContain('shadow-[0_0_0_1px');
        expect(trigger).not.toHaveClass('bg-main-4/70');
    });

    it('selects a range by dragging across day cells', () => {
        act(() => {
            useShiftEditorStore.getState().setDoc(doc);
        });

        render(<MakeShiftCalendar shift={shift} doc={doc} violationMap={new Map()} showFaults={false} />);

        const firstCell = document.querySelector<HTMLButtonElement>('[data-shift-nurse-id="2"] [data-day-index="0"]');
        const secondCell = document.querySelector<HTMLButtonElement>('[data-shift-nurse-id="2"] [data-day-index="1"]');

        expect(firstCell).not.toBeNull();
        expect(secondCell).not.toBeNull();

        act(() => {
            fireEvent.pointerDown(firstCell!, {button: 0, pointerId: 7});
            fireEvent.pointerEnter(secondCell!, {pointerId: 7});
            fireEvent.pointerUp(document, {pointerId: 7});
        });

        expect(useShiftEditorStore.getState().selection).toEqual({
            type: 'range',
            from: {row: 0, col: 0},
            to: {row: 0, col: 1},
        });
        expect(firstCell).not.toHaveClass('bg-main-4/70');
        expect(secondCell).not.toHaveClass('bg-main-4/70');
        expect(firstCell!.closest('[data-shift-nurse-id]')?.querySelectorAll('[data-selection-layer="true"]')).toHaveLength(2);
        expect(document.querySelector('[data-day-header-index="0"]')).toHaveAttribute('data-selected-column', 'true');
        expect(document.querySelector('[data-day-header-index="1"]')).toHaveAttribute('data-selected-column', 'true');
        expect(firstCell!.closest('[data-shift-nurse-id]')?.querySelector('[data-selected-row-label="true"]')).toBeInTheDocument();
    });

    it('clears the selected cell when clicking outside duty cells', async () => {
        const user = userEvent.setup();

        act(() => {
            useShiftEditorStore.getState().setDoc(doc);
        });

        render(<MakeShiftCalendar shift={shift} doc={doc} violationMap={new Map()} showFaults={false} />);

        const trigger = document.querySelector<HTMLButtonElement>('[data-shift-nurse-id="2"] [data-day-index="0"]');

        expect(trigger).not.toBeNull();
        await act(async () => {
            await user.click(trigger!);
        });

        expect(useShiftEditorStore.getState().selection).toEqual({type: 'single', anchor: {row: 0, col: 0}});

        await act(async () => {
            await user.click(document.body);
        });

        expect(useShiftEditorStore.getState().selection).toBeNull();
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
