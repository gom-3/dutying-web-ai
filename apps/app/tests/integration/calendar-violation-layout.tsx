import {useEffect, useMemo, useState} from 'react';
import {createRoot} from 'react-dom/client';
import type {TShift} from '@/entities/shift';
import {type TDutyDoc, type TViolation, useShiftEditorStore} from '@/features/shift-editor/model';
import {MakeShiftCalendar} from '@/pages/make-shift/ui/steps/shared/make-shift-calendar';
import '@/i18n';
import '@/index.css';

const params = new URLSearchParams(location.search);
const dayCount = Number(params.get('days') ?? 31);
const isRequest = params.get('mode') === 'request';
const nameSamples = params.get('names') === 'long' ? ['남궁서연지희가온다솜하늘', 'Alexandra Elizabeth Montgomery-Wellington', '김민'] : [];
const showFaults = !isRequest && params.get('faults') !== '0';
const requestedCalendarWidth = Number(params.get('calendarWidth'));
const calendarWidth = Number.isFinite(requestedCalendarWidth) && requestedCalendarWidth > 0 ? requestedCalendarWidth : undefined;
const columns = Array.from({length: dayCount}, (_, index) => `2026-10-${String(index + 1).padStart(2, '0')}`);
const types = [
    {shortName: 'D', name: 'Day', color: '#4CBFA8', classification: 'DAY'},
    {shortName: 'E', name: 'Evening', color: '#FF83A7', classification: 'EVENING'},
    {shortName: 'N', name: 'Night', color: '#347CFF', classification: 'NIGHT'},
    {shortName: 'O', name: 'Off', color: '#485C7B', classification: 'OFF'},
].map((type, index) => ({
    ...type,
    classification: type.classification as 'DAY' | 'EVENING' | 'NIGHT' | 'OFF',
    wardShiftTypeId: index + 1,
    startTime: '07:00',
    endTime: '15:00',
    isDefault: true,
    isOff: index === 3,
    isCounted: true,
}));
const workers = Array.from({length: 14}, (_, row) => ({
    shiftNurse: {
        shiftNurseId: row + 1,
        nurseId: row + 101,
        name: nameSamples[row] ?? `${isRequest ? '신규 간호사' : '간호사'} ${row + 1}`,
        carried: 0,
        divisionNum: 1,
        priority: row,
        isWorker: true,
    },
    lastWardShiftList: [1, 2, 3, 4],
    lastWardReqShiftList: [null, null, null, null],
    wardShiftList: columns.map((_, col) => ((row + col) % 4) + 1),
    wardReqShiftList: columns.map((_, col) => (col === 10 ? ((row + col) % 4) + 1 : null)),
}));
const shift: TShift = {
    lastDays: [27, 28, 29, 30].map((day) => ({day, dayType: 'workday'})),
    days: columns.map((_, index) => ({day: index + 1, dayType: index % 7 === 3 ? 'sunday' : index % 7 === 2 ? 'saturday' : 'workday'})),
    wardShiftTypes: types,
    divisionShiftNurses: [[], workers],
};
const doc: TDutyDoc = {
    columns,
    rows: workers.map((worker, row) => ({
        workerId: String(worker.shiftNurse.shiftNurseId),
        lastCells: ['D', 'E', 'N', 'O'],
        cells: columns.map((_, col) => types[(row + col) % 4].shortName),
    })),
    workerMeta: Object.fromEntries(
        workers.map(({shiftNurse}) => [String(shiftNurse.shiftNurseId), {name: shiftNurse.name, nurseId: shiftNurse.nurseId}]),
    ),
    fixedCells: Object.fromEntries(
        workers.flatMap(({shiftNurse}) => columns.slice(0, 9).map((date) => [`${shiftNurse.shiftNurseId}|${date}`, true as const])),
    ),
    requestCells: Object.fromEntries(workers.map(({shiftNurse}) => [`${shiftNurse.shiftNurseId}|${columns[10]}`, true as const])),
};
const violations: TViolation[] = [
    {
        ruleId: 'layout-error',
        message: '연속 근무가 허용 범위를 초과했어요.',
        level: 'error',
        cells: [4, 5, 6, 7].map((col) => ({row: 0, col})),
        scope: 'nurse',
    },
    {
        ruleId: 'layout-warning',
        message: '야간 근무 사이 휴무를 확인해 주세요.',
        level: 'warning',
        cells: [10, 11, 12].map((col) => ({row: 1, col})),
        scope: 'nurse',
    },
    {
        ruleId: 'layout-context',
        message: '야간 이후 휴무가 부족해요.',
        level: 'error',
        cells: [{row: 2, col: 19}],
        displayContext: {cells: [16, 17, 18, 19, 20].map((col) => ({row: 2, col}))},
        scope: 'nurse',
    },
    {
        ruleId: 'layout-overlap',
        message: '연속 근무와 야간 배치를 함께 확인해 주세요.',
        level: 'warning',
        cells: [6, 7, 8].map((col) => ({row: 0, col})),
        scope: 'nurse',
    },
];

function Harness() {
    const [open, setOpen] = useState(false);
    const violationMap = useMemo(
        () =>
            new Map(
                violations.flatMap((violation) =>
                    violation.cells.map(({row, col}) => [`${row + 1},${col}-${violation.ruleId}`, violation]),
                ),
            ),
        [],
    );
    useEffect(() => {
        useShiftEditorStore.getState().setDoc(doc);
    }, []);
    useEffect(() => {
        document.documentElement.dataset.makeAiAdjustOpen = String(open);
        document.documentElement.style.setProperty('--make-ai-adjust-sidebar-width', open ? '407px' : '0px');
    }, [open]);
    return (
        <div className="page-view" style={{minWidth: 1280}}>
            <main className="make-shift-page-frame mx-auto flex min-h-full w-full max-w-[1680px] min-w-0 flex-col pt-4 pr-[calc(var(--make-ai-snapshot-sidebar-offset,0px)+0.75rem)] pb-3 pl-3 min-[1600px]:pr-[calc(var(--make-ai-snapshot-sidebar-offset,0px)+2.5rem)] min-[1600px]:pl-10 lg:pr-[calc(var(--make-ai-snapshot-sidebar-offset,0px)+1rem)] lg:pl-4">
                <button
                    data-testid="toggle-sidebar"
                    onClick={() => setOpen((value) => !value)}
                    style={{alignSelf: 'start', marginBottom: 24, padding: 8}}
                >
                    AI 시트 {open ? '닫기' : '열기'}
                </button>
                <div data-testid="calendar-fixture" data-mode={isRequest ? 'request' : 'autofill'} style={{width: calendarWidth}}>
                    <MakeShiftCalendar
                        shift={shift}
                        doc={doc}
                        violationMap={violationMap}
                        showFaults={showFaults}
                        variant={isRequest ? 'simplified' : 'default'}
                        nameColumnDensity={isRequest ? 'comfortable' : 'compact'}
                        nurseNameMaxChars={isRequest ? null : undefined}
                        rowGapClassName={isRequest ? 'gap-y-3' : undefined}
                        showCellStatusPins
                        canReorderRows
                        showDivisionHeaders
                        showDivisionStatistics={!isRequest}
                        stickyHeader
                    />
                </div>
            </main>
            {open && (
                <aside
                    aria-label="AI sheet"
                    style={{position: 'fixed', inset: '0 0 0 auto', width: 407, background: '#FAF9FF', padding: 24, zIndex: 1400}}
                >
                    Dutying AI
                </aside>
            )}
        </div>
    );
}
createRoot(document.getElementById('root')!).render(<Harness />);
