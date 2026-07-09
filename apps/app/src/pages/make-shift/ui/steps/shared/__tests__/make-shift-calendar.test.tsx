import {createEvent, fireEvent, render, screen, within} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {act} from 'react';
import toast from 'react-hot-toast';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {type TShift} from '@/entities';
import {useUIConfigStore} from '@/entities/ui/useUIConfig/store';
import {type TDutyDoc, type TViolation, useShiftEditorStore} from '@/features/shift-editor/model';
import {DEFAULT_SKILL_LEVEL_CONFIG} from '@/features/ward-skill/model/skill-level';
import i18n from '@/i18n';
import {MakeShiftCalendar} from '../make-shift-calendar';

vi.mock('react-hot-toast', () => ({
    default: {
        success: vi.fn(),
        error: vi.fn(),
        loading: vi.fn(),
        dismiss: vi.fn(),
    },
}));

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
    beforeEach(async () => {
        await i18n.changeLanguage('ko');
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.mocked(toast.success).mockClear();
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

    it('renders a dedicated row reorder handle column when row reordering is enabled', () => {
        render(<MakeShiftCalendar shift={shift} doc={doc} violationMap={new Map()} showFaults={false} canReorderRows />);

        const headerDragColumn = document.querySelector<HTMLElement>('.make-shift-calendar__header-label--drag');
        const rowDragHandle = document.querySelector<HTMLElement>('.make-shift-calendar__row-drag-handle');
        const rowGrid = document.querySelector<HTMLElement>('.make-shift-calendar__row-left');

        expect(headerDragColumn).toBeInTheDocument();
        expect(rowDragHandle).toBeInTheDocument();
        expect(rowDragHandle?.tagName).toBe('BUTTON');
        expect(rowDragHandle).toHaveAttribute('aria-label', expect.stringContaining('Kim'));
        expect(rowDragHandle).toHaveClass('text-gray-4', 'hover:bg-gray-7', 'hover:text-sub-2');
        expect(rowDragHandle).toHaveClass('self-center', 'justify-self-center', 'p-0', 'leading-none');
        expect(rowGrid?.firstElementChild).toHaveClass('make-shift-calendar__row-drag-handle');
    });

    it('shows rest shortage and surplus when rest check summaries are provided', () => {
        render(
            <MakeShiftCalendar
                shift={shift}
                doc={doc}
                violationMap={new Map()}
                showFaults={false}
                readonly
                restCheckByShiftNurseId={{
                    2: {
                        targetDays: 10,
                        assignedDays: 1,
                        carriedDays: 2,
                        carryOverApplied: true,
                        differenceDays: -9,
                    },
                }}
            />,
        );

        expect(screen.getByText('이월')).toBeInTheDocument();
        expect(screen.getByTitle(/\+2/)).toBeInTheDocument();
        expect(screen.getByText('+2')).toBeInTheDocument();
        expect(screen.getByText('휴무')).toBeInTheDocument();
        expect(screen.getByTitle('휴무 확인')).toBeInTheDocument();
        expect(screen.getByText('-9')).toBeInTheDocument();
    });

    it('hides the carry column when rest checks are shown without carry-over', () => {
        render(
            <MakeShiftCalendar
                shift={shift}
                doc={doc}
                violationMap={new Map()}
                showFaults={false}
                readonly
                restCheckByShiftNurseId={{
                    2: {
                        targetDays: 10,
                        assignedDays: 7,
                        carriedDays: 0,
                        carryOverApplied: false,
                        differenceDays: -3,
                    },
                }}
            />,
        );

        expect(screen.queryByText('?댁썡')).not.toBeInTheDocument();
        expect(document.querySelector('.make-shift-calendar__row-carried-value')).not.toBeInTheDocument();
        expect(screen.getByTitle('휴무 확인')).toBeInTheDocument();
        expect(screen.getByText('-3')).toBeInTheDocument();
    });

    it('includes off shift types in row and daily summaries when they are assigned', () => {
        const offShiftType = {
            wardShiftTypeId: 20,
            name: 'Off',
            shortName: 'O',
            startTime: '',
            endTime: '',
            color: '#465B7A',
            isDefault: true,
            isOff: true,
            isCounted: false,
            classification: 'OFF',
        } satisfies TShift['wardShiftTypes'][number];
        const shiftWithOff: TShift = {
            ...shift,
            wardShiftTypes: [offShiftType, ...shift.wardShiftTypes],
            divisionShiftNurses: [
                [],
                [
                    {
                        ...shift.divisionShiftNurses[1]![0]!,
                        wardShiftList: [20, 10],
                    },
                ],
            ],
        };
        const docWithOff: TDutyDoc = {
            ...doc,
            rows: [{...doc.rows[0]!, cells: ['O', 'D']}],
        };

        render(<MakeShiftCalendar shift={shiftWithOff} doc={docWithOff} violationMap={new Map()} showFaults={false} readonly />);

        expect(Array.from(document.querySelectorAll('.make-shift-calendar__type-summary-badge')).map((node) => node.textContent)).toEqual([
            'D',
            'O',
        ]);
        expect(Array.from(document.querySelectorAll('.make-shift-calendar__row-summary-count')).map((node) => node.textContent)).toEqual([
            '1',
            '1',
        ]);

        const offDailySummary = document.querySelector<HTMLElement>('.make-shift-daily-summary__row[data-shift-type-id="20"]');

        expect(offDailySummary).not.toBeNull();
        expect(within(offDailySummary!).getByText('O')).toBeInTheDocument();
        expect(Array.from(offDailySummary!.querySelectorAll('.make-shift-daily-summary__cell')).map((node) => node.textContent)).toEqual([
            '1',
            '0',
        ]);
    });

    it('does not render an unaccepted request as a request-only cell', () => {
        const requestedShift: TShift = {
            ...shift,
            divisionShiftNurses: [
                [],
                [
                    {
                        ...shift.divisionShiftNurses[1]![0]!,
                        wardReqShiftList: [10, null],
                    },
                ],
            ],
        };

        render(<MakeShiftCalendar shift={requestedShift} doc={doc} violationMap={new Map()} showFaults={false} readonly />);

        const firstCell = document.querySelector<HTMLElement>('[data-shift-nurse-id="2"] [data-day-index="0"]');

        expect(firstCell).not.toBeNull();
        expect(firstCell?.querySelector('.opacity-60')).not.toBeInTheDocument();
    });

    it('renders fixed and requested status pins on day shift badges when enabled', () => {
        const statusDoc: TDutyDoc = {
            ...doc,
            rows: [{...doc.rows[0]!, cells: ['D', 'D']}],
            fixedCells: {'2|2026-05-01': true},
            requestCells: {'2|2026-05-02': true},
        };

        render(<MakeShiftCalendar shift={shift} doc={statusDoc} violationMap={new Map()} showFaults={false} readonly showCellStatusPins />);

        const fixedCell = document.querySelector<HTMLElement>('[data-shift-nurse-id="2"] [data-day-index="0"]');
        const requestedCell = document.querySelector<HTMLElement>('[data-shift-nurse-id="2"] [data-day-index="1"]');
        const fixedPin = fixedCell?.querySelector<HTMLElement>('[data-cell-status-pin="fixed"]');
        const requestPin = requestedCell?.querySelector<HTMLElement>('[data-cell-status-pin="request"]');

        expect(fixedCell).toHaveAttribute('data-fixed-cell', 'true');
        expect(requestedCell).toHaveAttribute('data-request-cell', 'true');
        expect(fixedPin).toHaveAttribute('title', '고정 근무');
        expect(fixedPin).toHaveClass('text-[#374151]');
        expect(requestPin).toHaveAttribute('title', '신청 근무');
        expect(fixedCell?.querySelector('[data-cell-status-pin="request"]')).not.toBeInTheDocument();
        expect(requestedCell?.querySelector('[data-cell-status-pin="fixed"]')).not.toBeInTheDocument();
    });

    it('shows only the request status pin when a requested cell also exists in fixed cells', () => {
        const statusDoc: TDutyDoc = {
            ...doc,
            rows: [{...doc.rows[0]!, cells: ['D', 'D']}],
            fixedCells: {'2|2026-05-01': true},
            requestCells: {'2|2026-05-01': true},
        };

        render(<MakeShiftCalendar shift={shift} doc={statusDoc} violationMap={new Map()} showFaults={false} readonly showCellStatusPins />);

        const requestedCell = document.querySelector<HTMLElement>('[data-shift-nurse-id="2"] [data-day-index="0"]');

        expect(requestedCell).not.toHaveAttribute('data-fixed-cell');
        expect(requestedCell).toHaveAttribute('data-request-cell', 'true');
        expect(requestedCell?.querySelector('[data-cell-status-pin="request"]')).toHaveAttribute('title', '신청 근무');
        expect(requestedCell?.querySelector('[data-cell-status-pin="fixed"]')).not.toBeInTheDocument();
    });

    it('shows a busy shimmer layer while auto fill is loading', () => {
        render(<MakeShiftCalendar shift={shift} doc={doc} violationMap={new Map()} showFaults={false} readonly isShimmering />);

        const calendar = document.querySelector<HTMLElement>('.make-shift-calendar');
        const shimmer = document.querySelector<HTMLElement>('.make-shift-calendar__shimmer');

        expect(calendar).toHaveAttribute('aria-busy', 'true');
        expect(calendar).toHaveAttribute('data-shimmer', 'true');
        expect(shimmer).toBeInTheDocument();
        expect(shimmer).toHaveAttribute('data-shimmer-scope', 'duty-cells');
        expect(shimmer?.style.left).not.toBe('');
        expect(document.querySelector('.make-shift-calendar__header .make-shift-calendar__shimmer')).not.toBeInTheDocument();
        expect(document.querySelector('.make-shift-daily-summary .make-shift-calendar__shimmer')).not.toBeInTheDocument();
        expect(document.querySelector('.make-shift-calendar__shimmer-sweep')).toBeInTheDocument();
    });

    it('keeps the shimmer positioned when the skill column is visible', () => {
        render(
            <MakeShiftCalendar
                shift={shift}
                doc={doc}
                violationMap={new Map()}
                showFaults={false}
                readonly
                isShimmering
                skillColumn={{
                    config: DEFAULT_SKILL_LEVEL_CONFIG,
                    levelsByNurseId: {100: 3},
                }}
            />,
        );

        const shimmer = document.querySelector<HTMLElement>('.make-shift-calendar__shimmer');

        expect(shimmer).toBeInTheDocument();
        expect(shimmer?.style.left).not.toBe('');
        expect(shimmer?.style.left).not.toContain('minmax');
    });

    it('hides the carry column by default', () => {
        render(<MakeShiftCalendar shift={shift} doc={doc} violationMap={new Map()} showFaults={false} readonly />);

        expect(screen.queryByText('이월')).not.toBeInTheDocument();
        expect(document.querySelector('.make-shift-calendar__row-carried-value')).not.toBeInTheDocument();
    });

    it('replaces the carry column with a skill badge when skillColumn is provided', () => {
        render(
            <MakeShiftCalendar
                shift={shift}
                doc={doc}
                violationMap={new Map()}
                showFaults={false}
                readonly
                skillColumn={{
                    config: DEFAULT_SKILL_LEVEL_CONFIG,
                    levelsByNurseId: {100: 3},
                }}
            />,
        );

        expect(screen.getByText('숙련도')).toBeInTheDocument();
        expect(screen.queryByText('이월')).not.toBeInTheDocument();
        expect(document.querySelector('.make-shift-calendar__row-carried-value')).not.toBeInTheDocument();
        expect(document.querySelector('.make-shift-calendar__row-skill-badge')).toHaveTextContent('LV. 3');
        expect(document.querySelector('.make-shift-calendar__row-skill-badge')).toHaveClass(
            'min-h-[18px]',
            'w-full',
            'min-w-0',
            'text-[10px]',
        );
    });

    it('keeps custom skill badge labels visible', () => {
        render(
            <MakeShiftCalendar
                shift={shift}
                doc={doc}
                violationMap={new Map()}
                showFaults={false}
                readonly
                skillColumn={{
                    config: {
                        ...DEFAULT_SKILL_LEVEL_CONFIG,
                        levelLabels: {
                            3: '책임간호',
                        },
                    },
                    levelsByNurseId: {100: 3},
                }}
            />,
        );

        expect(document.querySelector('.make-shift-calendar__row-skill-badge')).toHaveTextContent('책임간호');
    });

    it('hides the skill column when skill settings are disabled', () => {
        render(
            <MakeShiftCalendar
                shift={shift}
                doc={doc}
                violationMap={new Map()}
                showFaults={false}
                readonly
                skillColumn={{
                    config: {...DEFAULT_SKILL_LEVEL_CONFIG, enabled: false},
                    levelsByNurseId: {100: 3},
                }}
            />,
        );

        expect(screen.queryByText('숙련도')).not.toBeInTheDocument();
        expect(screen.queryByText('이월')).not.toBeInTheDocument();
        expect(screen.getByText('전달 근무')).toBeInTheDocument();
        expect(document.querySelector('.make-shift-calendar__row-carry')).not.toBeInTheDocument();
        expect(document.querySelector('.make-shift-calendar__row-skill-badge')).not.toBeInTheDocument();
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

        const staffingRow = popoverContent.getByText('D 근무 인원이 부족해요.').closest<HTMLElement>('[data-violation-row="true"]');

        expect(staffingRow).not.toBeNull();
        expect(document.querySelector('[data-active-violation="true"]')).not.toBeInTheDocument();

        act(() => {
            fireEvent.pointerEnter(staffingRow!);
        });

        const activeViolation = document.querySelector<HTMLElement>('.make-shift-calendar__violation[data-active-violation="true"]');
        const dimmedViolation = document.querySelector<HTMLElement>('.make-shift-calendar__violation[data-dimmed-violation="true"]');

        expect(staffingRow).toHaveAttribute('data-active-violation-row', 'true');
        expect(activeViolation).toBeInTheDocument();
        expect(activeViolation).toHaveAttribute('data-violation-level', 'error');
        expect(activeViolation?.style.zIndex).toBe('48');
        expect(trigger).toHaveAttribute('data-active-violation-cell', 'true');
        expect(trigger!.querySelector('[data-active-violation-shift-badge="true"]')).toBeInTheDocument();
        expect(dimmedViolation).toBeInTheDocument();
        expect(dimmedViolation).toHaveAttribute('data-violation-level', 'warning');
        expect(dimmedViolation?.style.opacity).toBe('0.18');
        expect(trigger!.querySelector('[data-active-violation-marker="true"]')).toBeInTheDocument();
        expect((trigger!.querySelector('[data-active-violation-marker="true"]') as HTMLElement | null)?.style.zIndex).toBe('58');
        expect(trigger!.querySelector('[data-dimmed-violation-marker="true"]')).not.toBeInTheDocument();

        act(() => {
            fireEvent.pointerLeave(staffingRow!);
        });

        expect(document.querySelector('[data-active-violation="true"]')).not.toBeInTheDocument();
        expect(document.querySelector('[data-dimmed-violation="true"]')).not.toBeInTheDocument();
        expect(document.querySelector('[data-active-violation-marker="true"]')).not.toBeInTheDocument();
        expect(document.querySelector('[data-active-violation-cell="true"]')).not.toBeInTheDocument();
    });

    it('opens the violation popover after hovering a violation cell briefly', () => {
        vi.useFakeTimers();

        const violation: TViolation = {
            ruleId: 'hover-rule',
            message: 'Kim cannot work D after N.',
            level: 'error',
            cells: [{row: 0, col: 1}],
            scope: 'nurse',
        };

        render(<MakeShiftCalendar shift={shift} doc={doc} violationMap={new Map([['2,1-hover-rule', violation]])} showFaults readonly />);

        const trigger = document.querySelector<HTMLButtonElement>('[data-shift-nurse-id="2"] [data-day-index="1"]');

        expect(trigger).not.toBeNull();

        fireEvent.pointerEnter(trigger!);
        act(() => {
            vi.advanceTimersByTime(449);
        });

        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

        fireEvent.pointerLeave(trigger!);
        act(() => {
            vi.advanceTimersByTime(1);
        });

        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

        fireEvent.pointerEnter(trigger!);
        act(() => {
            vi.advanceTimersByTime(450);
        });

        const popover = screen.getByRole('dialog');

        expect(within(popover).getByText('Kim cannot work D after N.')).toBeInTheDocument();
    });

    it('focuses only the hovered violation instance when identical messages appear on different cells', async () => {
        const user = userEvent.setup();
        const message = 'Kim님은 N 다음날 D 근무를 할 수 없어요.';
        const firstViolation: TViolation = {
            ruleId: 'same-rule',
            message,
            level: 'error',
            cells: [{row: 0, col: 0}],
            scope: 'nurse',
            period: {startDate: '2026-05-01', endDate: '2026-05-01', dates: ['2026-05-01']},
        };
        const secondViolation: TViolation = {
            ruleId: 'same-rule',
            message,
            level: 'error',
            cells: [{row: 0, col: 1}],
            scope: 'nurse',
            period: {startDate: '2026-05-02', endDate: '2026-05-02', dates: ['2026-05-02']},
        };

        render(
            <MakeShiftCalendar
                shift={shift}
                doc={doc}
                violationMap={
                    new Map([
                        ['2,0-first-same-message', firstViolation],
                        ['2,1-second-same-message', secondViolation],
                    ])
                }
                showFaults
                readonly
            />,
        );

        const firstTrigger = document.querySelector<HTMLButtonElement>('[data-shift-nurse-id="2"] [data-day-index="0"]');
        const secondTrigger = document.querySelector<HTMLButtonElement>('[data-shift-nurse-id="2"] [data-day-index="1"]');

        expect(firstTrigger).not.toBeNull();
        expect(secondTrigger).not.toBeNull();

        await act(async () => {
            await user.click(firstTrigger!);
        });

        const popover = screen.getByRole('dialog', {name: '제약조건 위반 1개'});
        const popoverContent = within(popover);
        const row = popoverContent.getByText('N 다음날 D 근무를 할 수 없어요.').closest<HTMLElement>('[data-violation-row="true"]');

        expect(row).not.toBeNull();

        act(() => {
            fireEvent.pointerEnter(row!);
        });

        const activeViolations = Array.from(
            document.querySelectorAll<HTMLElement>('.make-shift-calendar__violation[data-active-violation="true"]'),
        );
        const dimmedViolations = Array.from(
            document.querySelectorAll<HTMLElement>('.make-shift-calendar__violation[data-dimmed-violation="true"]'),
        );

        expect(activeViolations).toHaveLength(1);
        expect(activeViolations[0]?.style.gridColumn).toBe('1 / span 1');
        expect(dimmedViolations).toHaveLength(1);
        expect(dimmedViolations[0]?.style.gridColumn).toBe('2 / span 1');
        expect(firstTrigger).toHaveAttribute('data-active-violation-cell', 'true');
        expect(firstTrigger!.querySelector('[data-active-violation-shift-badge="true"]')).toBeInTheDocument();
        expect(secondTrigger).not.toHaveAttribute('data-active-violation-cell', 'true');
        expect(secondTrigger).toHaveAttribute('data-dimmed-violation-cell', 'true');
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

    it('shows worker-management skill labels in proficiency staffing violations', async () => {
        const user = userEvent.setup();
        const violation: TViolation = {
            ruleId: 'proficiency-staffing',
            templateCode: 'MIN_PROFICIENCY_STAFF_BY_SHIFT',
            message: 'N 근무에는 LV5 이상 간호사가 0명이에요. 최소 1명이 필요해요.',
            level: 'warning',
            cells: [{row: 0, col: 1}],
            scope: 'team',
        };

        render(
            <MakeShiftCalendar
                shift={shift}
                doc={doc}
                violationMap={new Map()}
                teamViolations={[violation]}
                showFaults
                readonly
                skillColumn={{
                    config: {
                        ...DEFAULT_SKILL_LEVEL_CONFIG,
                        levelCount: 5,
                        levelLabels: {5: '전담'},
                    },
                    levelsByNurseId: {100: 5},
                }}
            />,
        );

        const dayHeader = document.querySelector<HTMLButtonElement>('[data-day-header-index="1"]');

        expect(dayHeader).not.toBeNull();

        await act(async () => {
            await user.click(dayHeader!);
        });

        const popover = await screen.findByRole('dialog');
        const popoverContent = within(popover);

        expect(popoverContent.getByText('N 근무에는 전담 이상 간호사가 0명이에요. 최소 1명이 필요해요.')).toBeInTheDocument();
        expect(popoverContent.queryByText(/LV5/)).not.toBeInTheDocument();
    });

    it('shows N interval violations as one concise issue without repeated N labels', async () => {
        const user = userEvent.setup();
        const firstNightIntervalViolation: TViolation = {
            ruleId: 'night-interval-prev',
            violationId: 'night-interval-prev',
            templateCode: 'CORE_MIN_NIGHT_INTERVAL',
            message: 'Kim님은 N 근무 간격이 짧아요. 최소 3일을 띄워 주세요. 앞N',
            level: 'error',
            cells: [{row: 0, col: 1}],
            scope: 'nurse',
            period: {startDate: '2026-05-01', endDate: '2026-05-02', dates: ['2026-05-01', '2026-05-02']},
        };
        const secondNightIntervalViolation: TViolation = {
            ruleId: 'night-interval-current',
            violationId: 'night-interval-current',
            templateCode: 'CORE_MIN_NIGHT_INTERVAL',
            message: 'Kim님은 N 근무 간격이 짧아요. 최소 3일을 띄워 주세요. N',
            level: 'error',
            cells: [{row: 0, col: 1}],
            scope: 'nurse',
            period: {startDate: '2026-05-01', endDate: '2026-05-02', dates: ['2026-05-01', '2026-05-02']},
        };

        render(
            <MakeShiftCalendar
                shift={shift}
                doc={doc}
                violationMap={
                    new Map([
                        ['2,1-night-interval-prev', firstNightIntervalViolation],
                        ['2,1-night-interval-current', secondNightIntervalViolation],
                    ])
                }
                showFaults
                readonly
            />,
        );

        const trigger = document.querySelector<HTMLButtonElement>('[data-shift-nurse-id="2"] [data-day-index="1"]');

        expect(trigger).not.toBeNull();
        expect(trigger).toHaveAttribute('data-violation-count', '1');

        await act(async () => {
            await user.click(trigger!);
        });

        const popover = screen.getByRole('dialog', {name: '제약조건 위반 1개'});
        const popoverContent = within(popover);

        expect(popoverContent.getByText('N 근무 사이를 3일 이상 띄워야 해요.')).toBeInTheDocument();
        expect(popoverContent.getByText('5/1 N ↔ 5/2 N')).toBeInTheDocument();
        expect(popoverContent.queryByText(/앞N/)).not.toBeInTheDocument();
        expect(popoverContent.queryByText(/N 근무 간격이 짧아요/)).not.toBeInTheDocument();
    });

    it('renders close N assignments with the standard violation highlight only', () => {
        const days = Array.from({length: 4}, (_, index) => ({day: index + 1, dayType: 'workday' as const}));
        const nightShiftType = {
            wardShiftTypeId: 11,
            name: 'Night',
            shortName: 'N',
            startTime: '22:00',
            endTime: '07:00',
            color: '#6B46C1',
            isDefault: true,
            isOff: false,
            isCounted: true,
            classification: 'NIGHT',
        } satisfies TShift['wardShiftTypes'][number];
        const intervalShift: TShift = {
            ...shift,
            days,
            wardShiftTypes: [...shift.wardShiftTypes, nightShiftType],
            divisionShiftNurses: [
                [],
                [
                    {
                        ...shift.divisionShiftNurses[1]![0]!,
                        wardShiftList: [11, null, 11, null],
                        wardReqShiftList: Array.from({length: 4}, () => null),
                    },
                ],
            ],
        };
        const intervalDoc: TDutyDoc = {
            ...doc,
            columns: days.map((day) => `2026-05-${String(day.day).padStart(2, '0')}`),
            rows: [{...doc.rows[0]!, cells: ['N', null, 'N', null]}],
        };
        const violation: TViolation = {
            ruleId: 'night-interval',
            templateCode: 'CORE_MIN_NIGHT_INTERVAL',
            message: 'Kim님은 N 근무 사이를 3일 이상 띄워야 해요.',
            level: 'error',
            cells: [
                {row: 0, col: 0},
                {row: 0, col: 2},
            ],
            scope: 'nurse',
            period: {startDate: '2026-05-01', endDate: '2026-05-03', dates: ['2026-05-01', '2026-05-03']},
        };

        render(
            <MakeShiftCalendar
                shift={intervalShift}
                doc={intervalDoc}
                violationMap={new Map([['2,0-night-interval', violation]])}
                showFaults
                readonly
            />,
        );

        const highlights = Array.from(document.querySelectorAll<HTMLElement>('.make-shift-calendar__violation'));

        expect(document.querySelector('[data-night-interval-bridge="true"]')).not.toBeInTheDocument();
        expect(highlights.map((highlight) => highlight.style.gridColumn)).toEqual(['1 / span 1', '3 / span 1']);
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

        const listbox = await screen.findByRole('listbox', {name: '근무유형 선택'});

        expect(listbox).toBeInTheDocument();
        expect(within(listbox).queryByText('고정하기')).not.toBeInTheDocument();
        expect(within(listbox).queryByText('비우기')).not.toBeInTheDocument();
        expect(trigger).not.toHaveClass('bg-main-4/70');
        expect(trigger!.closest('[data-shift-nurse-id]')?.querySelector('[data-selection-layer="true"]')).toHaveClass('bg-main-4/70');
        expect(trigger!.querySelector('.make-shift-calendar__shift-badge')).not.toHaveClass('outline-[1px]', 'outline-main-1');
        expect(trigger!.querySelector('.outline-2')).not.toBeInTheDocument();

        act(() => {
            fireEvent.click(screen.getByRole('option', {name: /^D D$/}));
        });

        expect(useShiftEditorStore.getState().doc.rows[0]?.cells[0]).toBe('D');
        expect(screen.queryByRole('listbox', {name: '근무유형 선택'})).not.toBeInTheDocument();
    });

    it('shows a fix action at the top of the shift type dropdown and fixes the current cell', async () => {
        act(() => {
            useShiftEditorStore.getState().setDoc(doc);
        });

        render(<MakeShiftCalendar shift={shift} doc={doc} violationMap={new Map()} showFaults />);
        await act(async () => undefined);

        const trigger = document.querySelector<HTMLButtonElement>('[data-shift-nurse-id="2"] [data-day-index="1"]');

        expect(trigger).not.toBeNull();
        act(() => {
            fireEvent.doubleClick(trigger!);
        });

        const listbox = await screen.findByRole('listbox', {name: '근무유형 선택'});
        const options = within(listbox).getAllByRole('option');

        expect(options[0]).toHaveTextContent('고정하기');
        expect(options[0]).toBeEnabled();

        act(() => {
            fireEvent.click(options[0]!);
        });

        expect(useShiftEditorStore.getState().doc.fixedCells['2|2026-05-02']).toBe(true);
        expect(toast.success).toHaveBeenCalledWith('근무를 고정했어요.');
        expect(screen.queryByRole('listbox', {name: '근무유형 선택'})).not.toBeInTheDocument();
    });

    it('shows an unfix action for fixed cells and unfixes the current cell', async () => {
        const fixedDoc: TDutyDoc = {
            ...doc,
            fixedCells: {'2|2026-05-02': true},
        };

        act(() => {
            useShiftEditorStore.getState().setDoc(fixedDoc);
        });

        render(<MakeShiftCalendar shift={shift} doc={fixedDoc} violationMap={new Map()} showFaults />);
        await act(async () => undefined);

        const trigger = document.querySelector<HTMLButtonElement>('[data-shift-nurse-id="2"] [data-day-index="1"]');

        expect(trigger).not.toBeNull();
        act(() => {
            fireEvent.doubleClick(trigger!);
        });

        const listbox = await screen.findByRole('listbox', {name: '근무유형 선택'});
        const options = within(listbox).getAllByRole('option');

        expect(options).toHaveLength(1);
        expect(options[0]).toHaveTextContent('고정해제하기');

        act(() => {
            fireEvent.click(options[0]!);
        });

        expect(useShiftEditorStore.getState().doc.fixedCells['2|2026-05-02']).toBeUndefined();
        expect(toast.success).toHaveBeenCalledWith('근무 고정을 해제했어요.');
        expect(screen.queryByRole('listbox', {name: '근무유형 선택'})).not.toBeInTheDocument();
    });

    it('toggles the underlying day cell fixed state on right click when context-menu fixing is enabled', () => {
        const maskedDoc: TDutyDoc = {
            ...doc,
            rows: [{...doc.rows[0]!, cells: [null, null]}],
        };

        act(() => {
            useShiftEditorStore.getState().setDoc(doc);
            useShiftEditorStore.getState().setEditorMode('fixed');
        });

        render(<MakeShiftCalendar shift={shift} doc={maskedDoc} violationMap={new Map()} showFaults={false} fixCellOnContextMenu />);

        const trigger = document.querySelector<HTMLButtonElement>('[data-shift-nurse-id="2"] [data-day-index="1"]');

        expect(trigger).not.toBeNull();

        const contextMenu = createEvent.contextMenu(trigger!, {button: 2});

        act(() => {
            fireEvent(trigger!, contextMenu);
        });

        expect(contextMenu.defaultPrevented).toBe(true);
        expect(useShiftEditorStore.getState().selection).toEqual({type: 'single', anchor: {row: 0, col: 1}});
        expect(useShiftEditorStore.getState().doc.fixedCells['2|2026-05-02']).toBe(true);
        expect(toast.success).toHaveBeenLastCalledWith('근무를 고정했어요.');

        const secondContextMenu = createEvent.contextMenu(trigger!, {button: 2});

        act(() => {
            fireEvent(trigger!, secondContextMenu);
        });

        expect(secondContextMenu.defaultPrevented).toBe(true);
        expect(useShiftEditorStore.getState().doc.fixedCells['2|2026-05-02']).toBeUndefined();
        expect(toast.success).toHaveBeenLastCalledWith('근무 고정을 해제했어요.');
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
        expect(trigger!.querySelector('.make-shift-calendar__row-last-shift-badge')).toHaveClass('ring-2', 'ring-inset', 'ring-main-1');

        act(() => {
            fireEvent.click(screen.getByRole('option', {name: /^D D$/}));
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
            fireEvent.click(screen.getByRole('option', {name: /^D D$/}));
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

    it('highlights the selected row carry-over value with the row label color', async () => {
        const user = userEvent.setup();

        act(() => {
            useShiftEditorStore.getState().setDoc(doc);
        });

        render(
            <MakeShiftCalendar
                shift={shift}
                doc={doc}
                violationMap={new Map()}
                showFaults={false}
                restCheckByShiftNurseId={{
                    2: {
                        targetDays: 10,
                        assignedDays: 1,
                        carriedDays: 2,
                        carryOverApplied: true,
                        differenceDays: -9,
                    },
                }}
            />,
        );

        const trigger = document.querySelector<HTMLButtonElement>('[data-shift-nurse-id="2"] [data-day-index="0"]');
        const carryOverValue = document.querySelector<HTMLElement>('[data-shift-nurse-id="2"] .make-shift-calendar__row-carried-value');

        expect(trigger).not.toBeNull();
        expect(carryOverValue).toHaveClass('text-red');

        await act(async () => {
            await user.click(trigger!);
        });

        expect(carryOverValue).toHaveAttribute('data-selected-row-label', 'true');
        expect(carryOverValue).toHaveClass('text-main-1');
        expect(carryOverValue).not.toHaveClass('text-red');
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
        expect(saturdayCell).toHaveClass('bg-blue/5');

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

        expect(rowDays?.querySelector('[data-selection-layer="true"]')).toHaveClass('z-[2]');
        expect(rowDays?.querySelector('.make-shift-calendar__violation')).toHaveClass('z-[6]');
        expect(marker).toHaveClass('top-[clamp(2px,0.18cqw,3px)]', 'right-[clamp(2px,0.18cqw,3px)]');
        expect(marker).not.toHaveClass('translate-x-1/2', '-translate-y-1/2');
        expect(marker?.className).not.toContain('shadow-[0_0_0_1px');
        expect(trigger).not.toHaveClass('bg-main-4/70');
    });

    it('draws separate violation highlights for non-contiguous affected cells', () => {
        const days = Array.from({length: 9}, (_, index) => ({day: index + 1, dayType: 'workday' as const}));
        const baseShiftNurse = shift.divisionShiftNurses[1]![0]!;
        const sparseShift: TShift = {
            ...shift,
            days,
            divisionShiftNurses: [
                [],
                [
                    {
                        ...baseShiftNurse,
                        wardShiftList: Array.from({length: 9}, () => 10),
                        wardReqShiftList: Array.from({length: 9}, () => null),
                    },
                ],
            ],
        };
        const sparseDoc: TDutyDoc = {
            ...doc,
            columns: days.map((day) => `2026-05-${String(day.day).padStart(2, '0')}`),
            rows: [{...doc.rows[0]!, cells: Array.from({length: 9}, () => 'D')}],
        };
        const violation: TViolation = {
            ruleId: '1591',
            templateCode: 'NURSE_FORBID_WEEKEND',
            message: 'Kim님은 주말이나 공휴일 근무를 할 수 없어요.',
            level: 'error',
            cells: [
                {row: 0, col: 4},
                {row: 0, col: 8},
            ],
            scope: 'nurse',
            period: {
                startDate: '2026-05-05',
                endDate: '2026-05-09',
                dates: ['2026-05-05', '2026-05-09'],
            },
        };

        render(
            <MakeShiftCalendar
                shift={sparseShift}
                doc={sparseDoc}
                violationMap={new Map([['2,4-weekend', violation]])}
                showFaults
                readonly
            />,
        );

        const highlights = Array.from(document.querySelectorAll<HTMLElement>('.make-shift-calendar__violation'));

        expect(highlights).toHaveLength(2);
        expect(highlights.map((highlight) => highlight.style.gridColumn)).toEqual(['5 / span 1', '9 / span 1']);
    });

    it('draws a weak context span behind the stronger overage span', () => {
        const days = Array.from({length: 10}, (_, index) => ({day: index + 1, dayType: 'workday' as const}));
        const baseShiftNurse = shift.divisionShiftNurses[1]![0]!;
        const longRunShift: TShift = {
            ...shift,
            days,
            divisionShiftNurses: [
                [],
                [
                    {
                        ...baseShiftNurse,
                        wardShiftList: Array.from({length: 10}, () => 10),
                        wardReqShiftList: Array.from({length: 10}, () => null),
                    },
                ],
            ],
        };
        const longRunDoc: TDutyDoc = {
            ...doc,
            columns: days.map((day) => `2026-05-${String(day.day).padStart(2, '0')}`),
            rows: [{...doc.rows[0]!, cells: Array.from({length: 10}, () => 'D')}],
        };
        const violation: TViolation = {
            ruleId: '1592',
            templateCode: 'CORE_MAX_CONTINUOUS_WORK',
            message: 'Kim님은 근무가 10일 연속이에요. 최대 5일까지 가능해요.',
            level: 'error',
            cells: Array.from({length: 5}, (_, index) => ({row: 0, col: index + 5})),
            scope: 'nurse',
            displayContext: {
                cells: Array.from({length: 10}, (_, col) => ({row: 0, col})),
            },
        };

        render(
            <MakeShiftCalendar
                shift={longRunShift}
                doc={longRunDoc}
                violationMap={new Map([['2,5-consecutive-work', violation]])}
                showFaults
                readonly
            />,
        );

        const contextHighlights = Array.from(document.querySelectorAll<HTMLElement>('.make-shift-calendar__violation-context'));
        const strongHighlights = Array.from(document.querySelectorAll<HTMLElement>('.make-shift-calendar__violation'));

        expect(contextHighlights).toHaveLength(1);
        expect(contextHighlights[0]).toHaveAttribute('data-violation-context', 'true');
        expect(contextHighlights[0]?.style.gridColumn).toBe('1 / span 10');
        expect(strongHighlights).toHaveLength(1);
        expect(strongHighlights[0]?.style.gridColumn).toBe('6 / span 5');
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
        expect(firstCell!.closest('[data-shift-nurse-id]')?.querySelector('[data-selection-row-layer="true"]')).not.toBeInTheDocument();
        expect(document.querySelector('[data-selection-column-layer="true"]')).not.toBeInTheDocument();
        expect(document.querySelector('[data-day-header-index="0"]')).toHaveAttribute('data-selected-column', 'true');
        expect(document.querySelector('[data-day-header-index="1"]')).toHaveAttribute('data-selected-column', 'true');
        expect(firstCell!.closest('[data-shift-nurse-id]')?.querySelector('[data-selected-row-label="true"]')).toBeInTheDocument();
    });

    it('draws same-cell-size row and column highlights when a make calendar cell is clicked', async () => {
        const user = userEvent.setup();
        const secondRow = {
            ...shift.divisionShiftNurses[1]![0]!,
            shiftNurse: {
                ...shift.divisionShiftNurses[1]![0]!.shiftNurse,
                shiftNurseId: 3,
                nurseId: 101,
                name: 'Lee',
            },
            wardShiftList: [10, null],
            wardReqShiftList: [null, null],
        };
        const twoRowShift: TShift = {
            ...shift,
            divisionShiftNurses: [[], [shift.divisionShiftNurses[1]![0]!, secondRow]],
        };
        const twoRowDoc: TDutyDoc = {
            ...doc,
            rows: [
                doc.rows[0]!,
                {
                    workerId: '3',
                    lastCells: [null, null, null, null],
                    cells: ['D', null],
                },
            ],
            workerMeta: {
                ...doc.workerMeta,
                '3': {name: 'Lee', nurseId: 101},
            },
        };

        act(() => {
            useShiftEditorStore.getState().setDoc(twoRowDoc);
        });

        render(<MakeShiftCalendar shift={twoRowShift} doc={twoRowDoc} violationMap={new Map()} showFaults={false} />);

        const trigger = document.querySelector<HTMLButtonElement>('[data-shift-nurse-id="2"] [data-day-index="0"]');

        expect(trigger).not.toBeNull();
        await act(async () => {
            await user.click(trigger!);
        });

        const selectedRow = trigger!.closest('[data-shift-nurse-id]');
        const columnLayers = Array.from(document.querySelectorAll<HTMLElement>('[data-selection-column-layer="true"]'));

        expect(selectedRow?.querySelector('[data-selection-row-layer="true"]')).toHaveStyle({gridColumn: '1 / span 2'});
        expect(columnLayers).toHaveLength(2);
        expect(columnLayers.map((layer) => layer.style.gridColumn)).toEqual(['1', '1']);
        expect(selectedRow?.querySelector('[data-selection-layer="true"]')).toHaveClass('bg-main-4/70');
        expect(document.querySelector('[data-day-header-index="0"]')).toHaveAttribute('data-selected-column', 'true');
    });

    it('draws row and column highlights for readonly make calendars without editing selection', async () => {
        const user = userEvent.setup();

        act(() => {
            useShiftEditorStore.getState().setDoc(doc);
        });

        render(<MakeShiftCalendar shift={shift} doc={doc} violationMap={new Map()} showFaults={false} readonly />);

        const trigger = document.querySelector<HTMLButtonElement>('[data-shift-nurse-id="2"] [data-day-index="0"]');

        expect(trigger).not.toBeNull();
        await act(async () => {
            await user.click(trigger!);
        });

        expect(useShiftEditorStore.getState().selection).toBeNull();
        expect(trigger!.closest('[data-shift-nurse-id]')?.querySelector('[data-selection-row-layer="true"]')).toBeInTheDocument();
        expect(trigger!.closest('[data-shift-nurse-id]')?.querySelector('[data-selection-column-layer="true"]')).toBeInTheDocument();
        expect(trigger!.closest('[data-shift-nurse-id]')?.querySelector('[data-selected-row-label="true"]')).toHaveClass('text-main-1');
    });

    it('clears the selected cell when clicking outside duty cells', async () => {
        const user = userEvent.setup();

        act(() => {
            useShiftEditorStore.getState().setDoc(doc);
            useShiftEditorStore.getState().setSelection({type: 'single', anchor: {row: 0, col: 0}});
        });

        render(<MakeShiftCalendar shift={shift} doc={doc} violationMap={new Map()} showFaults={false} />);

        expect(useShiftEditorStore.getState().selection).toEqual({type: 'single', anchor: {row: 0, col: 0}});

        await act(async () => {
            await user.click(document.body);
        });

        expect(useShiftEditorStore.getState().selection).toBeNull();
    });

    it('keeps the selected cell when clicking a selection-preserving toolbar area', async () => {
        const toolbar = document.createElement('button');

        toolbar.type = 'button';
        toolbar.dataset.preserveDutySelection = 'true';
        document.body.append(toolbar);

        act(() => {
            useShiftEditorStore.getState().setDoc(doc);
            useShiftEditorStore.getState().setSelection({type: 'single', anchor: {row: 0, col: 0}});
        });

        render(<MakeShiftCalendar shift={shift} doc={doc} violationMap={new Map()} showFaults={false} />);

        expect(useShiftEditorStore.getState().selection).toEqual({type: 'single', anchor: {row: 0, col: 0}});

        act(() => {
            fireEvent.pointerDown(toolbar);
        });

        expect(useShiftEditorStore.getState().selection).toEqual({type: 'single', anchor: {row: 0, col: 0}});
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
