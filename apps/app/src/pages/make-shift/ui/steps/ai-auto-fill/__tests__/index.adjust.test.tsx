import type {TSnapshotCellDTO} from '@dutying/api/ward';
import {useEffect} from 'react';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import type * as ShiftEditorModule from '@/features/shift-editor';
import {type TDutyDoc, useShiftEditorStore} from '@/features/shift-editor';
import {act, render, screen, userEvent, waitFor} from '@/shared/util/test-utils';
import {AiAutofill} from '../index';

// 칩 바는 빌드 플래그 뒤에 있고, 플래그는 모듈 로드 시점에 한 번만 읽힌다.
// vitest 가 hoisted 블록을 import 위로 끌어올려 주므로 여기서 세워도 늦지 않다.
vi.hoisted(() => {
    vi.stubEnv('VITE_AI_ADJUST_ENABLED', 'true');
});

const mocks = vi.hoisted(() => ({
    requestAiSchedule: vi.fn(),
    setStepNavigationBusy: vi.fn(),
    moveScheduleRow: vi.fn(),
    month: 7,
    shift: {
        days: [],
        wardShiftTypes: [],
        divisionShiftNurses: [],
    },
    dutyDoc: null as TDutyDoc | null,
}));

vi.mock('@/shared/hook/use-typed-translation', () => ({
    useTypedTranslation: () => ({
        t: (key: string, values?: Record<string, unknown>) => (values ? `${key} ${JSON.stringify(values)}` : key),
    }),
}));

vi.mock('@/features/auth', () => ({
    default: () => ({state: {wardId: 1}}),
}));

vi.mock('@/features/shift-editor', async (importOriginal) => {
    const actual = (await importOriginal()) as typeof ShiftEditorModule;

    return {
        ...actual,
        useAsyncScheduleValidation: () => ({status: 'idle'}),
    };
});

vi.mock('@/widgets/navigation-bar/navigation-bar-fold-store', () => ({
    useNavigationBarFoldStore: (selector: (state: {collapse: () => void}) => unknown) => selector({collapse: vi.fn()}),
}));

vi.mock('../../../../model/make-shift-store', () => ({
    isMakeShiftTeamReadyForWard: () => true,
    useMakeShiftStore: (selector: (state: unknown) => unknown) =>
        selector({
            year: 2026,
            month: mocks.month,
            currentShiftTeamId: 10,
            wardId: 1,
            shiftTeams: [{shiftTeamId: 10, name: 'A'}],
            shiftTeamsStatus: 'success',
            setStepNavigationBusy: mocks.setStepNavigationBusy,
        }),
}));

vi.mock('../../../../model/make-shift-use-case', () => ({
    useMakeShiftUseCase: () => ({confirm: vi.fn()}),
}));

vi.mock('../../../../model/use-make-shift-nurse-order', () => ({
    useMakeShiftNurseOrder: () => ({
        currentTeamNurses: [],
        isReorderingRows: false,
        moveScheduleRow: mocks.moveScheduleRow,
    }),
}));

vi.mock('../../../../model/nurse-order-sync', () => ({
    sortScheduleByTeamNurseOrder: (shift: unknown) => shift,
}));

vi.mock('../../../../model/rest-carry-over', () => ({
    syncNextMonthRestCarryOver: vi.fn(),
}));

vi.mock('../../../../model/rest-target-adjustment', () => ({
    useRestTargetAdjustment: () => ({adjustmentDays: 0}),
}));

vi.mock('../../../../model/rest-target-days', () => ({
    calculateRestCheckByShiftNurse: () => ({}),
}));

vi.mock('../../../../model/use-schedule-snapshots', () => ({
    MAX_SCHEDULE_SNAPSHOT_COUNT: 5,
    normalizeScheduleSnapshots: (snapshots: unknown) => snapshots,
    prependSnapshotToListCache: vi.fn(),
    removeSnapshotFromListCache: vi.fn(),
    scheduleSnapshotsQueryKey: (...args: unknown[]) => ['scheduleSnapshots', ...args],
    updateSnapshotTitleInListCache: vi.fn(),
    useInvalidateScheduleSnapshots: () => vi.fn(),
    useScheduleSnapshots: () => ({data: [], isLoading: false, isError: false, refetch: vi.fn()}),
}));

vi.mock('../../../../model/ai-schedule-provider', () => ({
    requestAiSchedule: mocks.requestAiSchedule,
}));

vi.mock('@/pages/ward-settings/model/rest-leave-policy', () => ({
    useRestLeavePolicy: () => ({policy: null}),
}));

vi.mock('../../rest-leave-policy-summary-card', () => ({
    RestLeavePolicySummaryButton: () => null,
}));

vi.mock('../../shared/use-duty-editor-step', () => ({
    useDutyEditorStep: () => ({
        dutyQuery: {data: mocks.shift, isLoading: false, isError: false, refetch: vi.fn()},
        editorRef: {current: null},
        editorDoc: mocks.dutyDoc,
        onKeyDown: vi.fn(),
        onPasteCapture: vi.fn(),
        violationMap: new Map(),
        teamViolations: [],
        focusEditor: vi.fn(),
        isHydratingEditor: false,
    }),
}));

vi.mock('../../shared/make-shift-calendar-skeleton', () => ({
    MakeShiftCalendarSkeleton: () => <div data-testid="calendar-skeleton" />,
}));

vi.mock('../../shared/make-shift-calendar', () => ({
    MakeShiftCalendar: () => <div data-testid="calendar" />,
}));

vi.mock('../ai-autofill-toolbar', () => ({
    AiAutofillToolbar: ({onAiFill, onUndo}: {onAiFill: () => void; onUndo: () => void}) => (
        <>
            <button type="button" onClick={onAiFill}>
                auto fill
            </button>
            <button type="button" onClick={onUndo}>
                undo
            </button>
        </>
    ),
}));

// 실제 오버레이는 애니메이션이 끝나야 onFinish 를 부른다. 그때까지 조절 칩은 눌러도 무시되므로,
// 테스트에서는 마무리 단계에 들어가는 즉시 끝난 것으로 만든다.
vi.mock('../ai-autofill-loading-overlay', () => ({
    AiAutofillLoadingOverlay: ({isFinishing, onFinish}: {isFinishing: boolean; onFinish: () => void}) => {
        useEffect(() => {
            if (isFinishing) onFinish();
        }, [isFinishing, onFinish]);

        return <div data-testid="ai-loading-overlay" />;
    },
}));

vi.mock('../ai-snapshot-sidebar', () => ({
    AiSnapshotSidebar: () => null,
}));

vi.mock('../last-shift-warning', () => ({
    findFirstBlankLastShiftCell: () => null,
    getBlankLastShiftCellsWarningKey: () => null,
}));

const ADJUST_TITLE = 'page.makeShift.aiRefill.adjust.title';
const OFF_BALANCE_CHIP = 'page.makeShift.aiRefill.adjust.offBalance';
const CLUSTER_ON_CHIP = 'page.makeShift.aiRefill.adjust.clusterOn';
const DECISION_TITLE = 'page.makeShift.aiRefill.prefillDecision.title';
const DECISION_CONFIRM = 'page.makeShift.aiRefill.prefillDecision.confirm';

function makeDoc(): TDutyDoc {
    return {
        columns: ['2026-07-01', '2026-07-02', '2026-07-03', '2026-07-04'],
        rows: [
            {workerId: '10', cells: ['D', 'E', 'N', 'D']},
            {workerId: '11', cells: ['N', 'D', 'E', 'E']},
        ],
        workerMeta: {'10': {name: 'Kim'}, '11': {name: 'Lee'}},
        fixedCells: {'10|2026-07-01': true},
        requestCells: {'10|2026-07-02': true},
    };
}

function seedEditor(doc = makeDoc()) {
    act(() => {
        useShiftEditorStore.getState().reset();
        useShiftEditorStore.getState().setDoc(doc);
        useShiftEditorStore.getState().setRulesHash('sha256:test');
    });

    mocks.dutyDoc = doc;
}

function cell(workerId: number, date: string, shiftCode: string | null): TSnapshotCellDTO {
    return {shiftNurseId: workerId, date, wardShiftTypeId: null, shiftCode: shiftCode ?? undefined};
}

/** 응답의 draftRevision 은 호출 시점의 스토어 값이어야 한다 — 미리 굳히면 버려진다. */
function okResult(changedCells: TSnapshotCellDTO[], operationType: 'GENERATE' | 'ADJUST') {
    const draftRevision = useShiftEditorStore.getState().draftRevision;
    const validation = {
        draftRevision,
        rulesHash: 'sha256:test',
        summary: {valid: true, hardCount: 0, softCount: 0, totalCount: 0},
        violations: [],
    };

    return {
        ok: true,
        response: {
            operationType,
            draftRevision,
            resultType: 'PATCH',
            changedCells,
            validation,
            unmetInstructions: [],
            sameAsPrevious: false,
        },
        validation,
    };
}

const FIRST_FILL_CELLS = [
    cell(10, '2026-07-03', 'D'),
    cell(10, '2026-07-04', 'E'),
    cell(11, '2026-07-01', 'N'),
    cell(11, '2026-07-02', 'D'),
    cell(11, '2026-07-03', 'E'),
    cell(11, '2026-07-04', 'E'),
];

function rowCells(workerId: string) {
    return useShiftEditorStore.getState().doc.rows.find((row) => row.workerId === workerId)?.cells;
}

async function completeFirstFill(user: ReturnType<typeof userEvent.setup>) {
    mocks.requestAiSchedule.mockImplementation(async () => okResult(FIRST_FILL_CELLS, 'GENERATE'));

    await user.click(screen.getByRole('button', {name: 'auto fill'}));
    await screen.findByRole('dialog', {name: DECISION_TITLE});
    await user.click(screen.getByRole('button', {name: DECISION_CONFIRM}));

    await screen.findByText(ADJUST_TITLE);
}

describe('AiAutofill adjust chips', () => {
    beforeEach(() => {
        mocks.requestAiSchedule.mockReset();
        mocks.setStepNavigationBusy.mockReset();
        mocks.moveScheduleRow.mockReset();
        mocks.month = 7;
        seedEditor();
    });

    it('hides the adjust chips until the first autofill succeeds', async () => {
        const user = userEvent.setup();

        render(<AiAutofill />);

        expect(screen.queryByText(ADJUST_TITLE)).not.toBeInTheDocument();

        await completeFirstFill(user);

        expect(screen.getByText(ADJUST_TITLE)).toBeInTheDocument();
        expect(screen.getByRole('button', {name: OFF_BALANCE_CHIP})).toHaveAttribute('aria-pressed', 'false');
    });

    it('sends the pressed knob and locks fixed, requested and hand-edited cells together', async () => {
        const user = userEvent.setup();

        render(<AiAutofill />);

        await completeFirstFill(user);

        // 자동완성 뒤 사람이 한 칸 고친 상황을 만든다.
        act(() => {
            const doc = useShiftEditorStore.getState().doc;

            useShiftEditorStore.getState().setDoc({
                ...doc,
                rows: doc.rows.map((row) => (row.workerId === '11' ? {...row, cells: ['N', 'D', 'E', 'N']} : row)),
            });
        });

        mocks.requestAiSchedule.mockImplementation(async () => okResult([], 'ADJUST'));

        await user.click(screen.getByRole('button', {name: OFF_BALANCE_CHIP}));

        await waitFor(() => expect(mocks.requestAiSchedule).toHaveBeenCalledTimes(2));

        const payload = mocks.requestAiSchedule.mock.calls[1]?.[0];

        expect(payload.adjust).toEqual({knobs: {OFF_BALANCE: 1}, strength: 'NORMAL'});
        expect(payload.lockedCellKeys).toEqual(expect.arrayContaining(['10:2026-07-01', '10:2026-07-02', '11:2026-07-04']));
        expect(payload.lockedCellKeys).not.toContain('11:2026-07-03');
    });

    it('reports the cells the adjust actually moved, not the cells the server returned', async () => {
        const user = userEvent.setup();

        render(<AiAutofill />);

        await completeFirstFill(user);

        // 세 칸을 돌려주지만 고정 칸은 적용되지 않으므로 실제로 움직이는 것은 두 칸이다.
        mocks.requestAiSchedule.mockImplementation(async () =>
            okResult([cell(10, '2026-07-01', 'N'), cell(11, '2026-07-01', 'D'), cell(11, '2026-07-02', 'E')], 'ADJUST'),
        );

        await user.click(screen.getByRole('button', {name: OFF_BALANCE_CHIP}));

        expect(await screen.findByText(`page.makeShift.aiRefill.adjust.applied {"count":2}`)).toBeInTheDocument();
        expect(rowCells('10')).toEqual(['D', 'E', 'D', 'E']);
        expect(rowCells('11')).toEqual(['D', 'E', 'E', 'E']);
    });

    it('restores the pre-adjust schedule with a single undo', async () => {
        const user = userEvent.setup();

        render(<AiAutofill />);

        await completeFirstFill(user);

        const beforeAdjust = rowCells('11');

        mocks.requestAiSchedule.mockImplementation(async () =>
            okResult([cell(11, '2026-07-01', 'D'), cell(11, '2026-07-02', 'E')], 'ADJUST'),
        );

        await user.click(screen.getByRole('button', {name: OFF_BALANCE_CHIP}));

        await waitFor(() => expect(rowCells('11')).toEqual(['D', 'E', 'E', 'E']));

        await user.click(screen.getByRole('button', {name: 'undo'}));

        expect(rowCells('11')).toEqual(beforeAdjust);
    });

    it('turns the chip back off when the adjust request is rejected', async () => {
        const user = userEvent.setup();

        render(<AiAutofill />);

        await completeFirstFill(user);

        mocks.requestAiSchedule.mockImplementation(async () => ({ok: false, message: 'rejected'}));

        await user.click(screen.getByRole('button', {name: CLUSTER_ON_CHIP}));

        await waitFor(() => expect(screen.getByRole('button', {name: CLUSTER_ON_CHIP})).toHaveAttribute('aria-pressed', 'false'));
        expect(rowCells('11')).toEqual(['N', 'D', 'E', 'E']);
    });

    it('drops an adjust response that lands after the month changed', async () => {
        const user = userEvent.setup();
        const {rerender} = render(<AiAutofill />);

        await completeFirstFill(user);

        const beforeAdjust = rowCells('11');

        let resolveAdjust: ((value: unknown) => void) | undefined;

        mocks.requestAiSchedule.mockImplementation(
            () =>
                new Promise((resolve) => {
                    resolveAdjust = resolve;
                }),
        );

        await user.click(screen.getByRole('button', {name: OFF_BALANCE_CHIP}));
        await waitFor(() => expect(mocks.requestAiSchedule).toHaveBeenCalledTimes(2));

        mocks.month = 8;
        rerender(<AiAutofill />);

        await act(async () => {
            resolveAdjust?.(okResult([cell(11, '2026-07-01', 'D')], 'ADJUST'));
        });

        expect(rowCells('11')).toEqual(beforeAdjust);
    });

    it('clears the chips when the schedule is generated again', async () => {
        const user = userEvent.setup();

        render(<AiAutofill />);

        await completeFirstFill(user);

        mocks.requestAiSchedule.mockImplementation(async () => okResult([cell(11, '2026-07-01', 'D')], 'ADJUST'));

        await user.click(screen.getByRole('button', {name: OFF_BALANCE_CHIP}));

        await waitFor(() => expect(screen.getByRole('button', {name: OFF_BALANCE_CHIP})).toHaveAttribute('aria-pressed', 'true'));
        expect(screen.getByText(`page.makeShift.aiRefill.adjust.applied {"count":1}`)).toBeInTheDocument();

        // 조절 직후에는 손으로 고친 칸이 없으므로 재생성은 확인 다이얼로그 없이 바로 돈다.
        mocks.requestAiSchedule.mockImplementation(async () => okResult(FIRST_FILL_CELLS, 'GENERATE'));

        await user.click(screen.getByRole('button', {name: 'auto fill'}));

        await waitFor(() => expect(mocks.requestAiSchedule).toHaveBeenCalledTimes(3));
        await waitFor(() => expect(screen.getByRole('button', {name: OFF_BALANCE_CHIP})).toHaveAttribute('aria-pressed', 'false'));
        expect(screen.queryByText(/aiRefill\.adjust\.applied/)).not.toBeInTheDocument();
    });
});
