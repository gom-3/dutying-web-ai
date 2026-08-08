import {beforeEach, describe, expect, it, vi} from 'vitest';
import type * as ShiftEditorModule from '@/features/shift-editor';
import {type TDutyDoc, useShiftEditorStore} from '@/features/shift-editor';
import {act, render, screen, userEvent, waitFor} from '@/shared/util/test-utils';
import {AiAutofill} from '../index';

const mocks = vi.hoisted(() => ({
    calendarDocs: [] as TDutyDoc[],
    calendarProps: [] as Array<{
        doc: TDutyDoc;
        fixCellOnContextMenu?: boolean;
        onCellClick?: (rowIndex: number, colIndex: number) => void;
    }>,
    requestAiSchedule: vi.fn(),
    setStepNavigationBusy: vi.fn(),
    moveScheduleRow: vi.fn(),
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
    default: () => ({
        state: {
            wardId: 1,
        },
    }),
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
            month: 7,
            currentShiftTeamId: 10,
            wardId: 1,
            shiftTeams: [{shiftTeamId: 10, name: 'A'}],
            shiftTeamsStatus: 'success',
            setStepNavigationBusy: mocks.setStepNavigationBusy,
        }),
}));

vi.mock('../../../../model/make-shift-use-case', () => ({
    useMakeShiftUseCase: () => ({
        confirm: vi.fn(),
    }),
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
    useScheduleSnapshots: () => ({
        data: [],
        isLoading: false,
        isError: false,
        refetch: vi.fn(),
    }),
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
        dutyQuery: {
            data: mocks.shift,
            isLoading: false,
            isError: false,
            refetch: vi.fn(),
        },
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
    MakeShiftCalendar: (props: {
        doc: TDutyDoc;
        fixCellOnContextMenu?: boolean;
        onCellClick?: (rowIndex: number, colIndex: number) => void;
    }) => {
        const {doc} = props;

        mocks.calendarDocs.push(doc);
        mocks.calendarProps.push(props);

        return (
            <div data-testid="calendar">
                {doc.rows[0]?.cells.map((cell, index) => (
                    <button key={index} type="button" data-testid={`cell-${index}`} onClick={() => props.onCellClick?.(0, index)}>
                        {cell ?? ''}
                    </button>
                ))}
            </div>
        );
    },
}));

vi.mock('../ai-autofill-toolbar', () => ({
    AiAutofillToolbar: ({
        onAiFill,
        onConfirm,
        onRequestClearUnlockedCells,
    }: {
        onAiFill: () => void;
        onConfirm: () => void;
        onRequestClearUnlockedCells: () => void;
    }) => (
        <>
            <button type="button" onClick={onAiFill}>
                auto fill
            </button>
            <button type="button" onClick={onRequestClearUnlockedCells}>
                clear unlocked
            </button>
            <button type="button" onClick={onConfirm}>
                confirm
            </button>
        </>
    ),
}));

vi.mock('../ai-autofill-loading-overlay', () => ({
    AiAutofillLoadingOverlay: () => <div data-testid="ai-loading-overlay" />,
}));

vi.mock('../ai-snapshot-sidebar', () => ({
    AiSnapshotSidebar: () => null,
}));

vi.mock('../last-shift-warning', () => ({
    findFirstBlankLastShiftCell: () => null,
    getBlankLastShiftCellsWarningKey: () => null,
}));

function makeDoc(): TDutyDoc {
    return {
        columns: ['2026-07-01', '2026-07-02', '2026-07-03'],
        rows: [
            {
                workerId: '10',
                cells: ['D', 'E', 'N'],
            },
        ],
        workerMeta: {'10': {name: 'Kim'}},
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

describe('AiAutofill blank preview', () => {
    beforeEach(() => {
        mocks.calendarDocs.length = 0;
        mocks.calendarProps.length = 0;
        mocks.requestAiSchedule.mockReset();
        mocks.setStepNavigationBusy.mockReset();
        mocks.moveScheduleRow.mockReset();
        seedEditor();
    });

    it('enables right-click fixing on the step 4 calendar', () => {
        render(<AiAutofill />);

        expect(mocks.calendarProps[mocks.calendarProps.length - 1]?.fixCellOnContextMenu).toBe(true);
    });

    it('clears every filled editor cell except fixed and requested shifts after confirmation', async () => {
        const user = userEvent.setup();

        render(<AiAutofill />);

        await user.click(screen.getByRole('button', {name: 'clear unlocked'}));

        expect(await screen.findByRole('dialog', {name: 'page.makeShift.aiRefill.clearUnlockedCellsDialog.title'})).toBeInTheDocument();

        await user.click(screen.getByRole('button', {name: 'page.makeShift.aiRefill.clearUnlockedCellsDialog.confirm'}));

        await waitFor(() =>
            expect(screen.queryByRole('dialog', {name: 'page.makeShift.aiRefill.clearUnlockedCellsDialog.title'})).not.toBeInTheDocument(),
        );
        expect(useShiftEditorStore.getState().doc.rows[0]?.cells).toEqual(['D', 'E', null]);
        expect(useShiftEditorStore.getState().doc.fixedCells).toEqual({'10|2026-07-01': true});
        expect(useShiftEditorStore.getState().doc.requestCells).toEqual({'10|2026-07-02': true});
    });

    it('confirms immediately without a publish confirmation when no nurses are connected', async () => {
        const user = userEvent.setup();

        render(<AiAutofill />);

        await user.click(screen.getByRole('button', {name: 'confirm'}));

        await waitFor(() =>
            expect(screen.queryByRole('dialog', {name: 'page.makeShift.aiRefill.publishConfirm.title'})).not.toBeInTheDocument(),
        );
    });

    it('shows every shift cell in the decision dialog before autofill starts', async () => {
        const user = userEvent.setup();

        render(<AiAutofill />);

        expect(screen.getByTestId('cell-0')).toHaveTextContent('D');
        expect(screen.getByTestId('cell-1')).toHaveTextContent('E');
        expect(screen.getByTestId('cell-2')).toHaveTextContent('N');

        await user.click(screen.getByRole('button', {name: 'auto fill'}));

        expect(await screen.findByRole('dialog', {name: 'page.makeShift.aiRefill.prefillDecision.title'})).toBeInTheDocument();
        expect(screen.getByTestId('cell-0')).toHaveTextContent('D');
        expect(screen.getByTestId('cell-1')).toHaveTextContent('E');
        expect(screen.getByTestId('cell-2')).toHaveTextContent('N');
        expect(useShiftEditorStore.getState().doc.rows[0]?.cells).toEqual(['D', 'E', 'N']);
    });

    it('toggles a non-empty decision-dialog cell between fixed and unfixed', async () => {
        const user = userEvent.setup();

        render(<AiAutofill />);

        await user.click(screen.getByRole('button', {name: 'auto fill'}));
        await screen.findByRole('dialog', {name: 'page.makeShift.aiRefill.prefillDecision.title'});

        expect(useShiftEditorStore.getState().doc.fixedCells['10|2026-07-03']).toBeUndefined();

        await user.click(screen.getByTestId('cell-2'));
        expect(useShiftEditorStore.getState().doc.fixedCells['10|2026-07-03']).toBe(true);

        await user.click(screen.getByTestId('cell-2'));
        expect(useShiftEditorStore.getState().doc.fixedCells['10|2026-07-03']).toBeUndefined();
    });

    it('does not change a requested shift when it is clicked in the decision dialog', async () => {
        const user = userEvent.setup();

        render(<AiAutofill />);

        await user.click(screen.getByRole('button', {name: 'auto fill'}));
        await screen.findByRole('dialog', {name: 'page.makeShift.aiRefill.prefillDecision.title'});

        await user.click(screen.getByTestId('cell-1'));

        expect(useShiftEditorStore.getState().doc.fixedCells['10|2026-07-02']).toBeUndefined();
        expect(useShiftEditorStore.getState().doc.requestCells['10|2026-07-02']).toBe(true);
    });

    it('returns to editing without requesting AI when the initial decision is canceled', async () => {
        const user = userEvent.setup();

        render(<AiAutofill />);

        await user.click(screen.getByRole('button', {name: 'auto fill'}));
        await screen.findByRole('dialog', {name: 'page.makeShift.aiRefill.prefillDecision.title'});

        await user.click(screen.getByTestId('cell-2'));
        expect(useShiftEditorStore.getState().doc.fixedCells['10|2026-07-03']).toBe(true);

        await user.click(screen.getByRole('button', {name: 'page.makeShift.aiRefill.prefillDecision.cancel'}));

        await waitFor(() =>
            expect(screen.queryByRole('dialog', {name: 'page.makeShift.aiRefill.prefillDecision.title'})).not.toBeInTheDocument(),
        );
        expect(mocks.requestAiSchedule).not.toHaveBeenCalled();
        expect(screen.getByTestId('cell-2')).toHaveTextContent('N');
        expect(useShiftEditorStore.getState().doc.rows[0]?.cells).toEqual(['D', 'E', 'N']);
        expect(useShiftEditorStore.getState().doc.fixedCells['10|2026-07-03']).toBeUndefined();
    });

    it('keeps the editable cells visually blank while AI generation is running after the dialog action', async () => {
        const user = userEvent.setup();

        let resolveRequest: ((value: unknown) => void) | undefined;

        mocks.requestAiSchedule.mockImplementation(
            () =>
                new Promise((resolve) => {
                    resolveRequest = resolve;
                }),
        );

        render(<AiAutofill />);

        await user.click(screen.getByRole('button', {name: 'auto fill'}));
        await screen.findByRole('dialog', {name: 'page.makeShift.aiRefill.prefillDecision.title'});

        await user.click(screen.getByRole('button', {name: 'page.makeShift.aiRefill.prefillDecision.confirm'}));

        await waitFor(() => expect(mocks.requestAiSchedule).toHaveBeenCalledTimes(1));
        expect(screen.getByTestId('ai-loading-overlay')).toBeInTheDocument();
        expect(screen.getByTestId('cell-0')).toHaveTextContent('D');
        expect(screen.getByTestId('cell-1')).toHaveTextContent('E');
        expect(screen.getByTestId('cell-2')).toHaveTextContent('');

        await act(async () => {
            resolveRequest?.({
                ok: true,
                response: {
                    operationType: 'GENERATE',
                    draftRevision: useShiftEditorStore.getState().draftRevision,
                    resultType: 'PATCH',
                    changedCells: [],
                    validation: {
                        draftRevision: useShiftEditorStore.getState().draftRevision,
                        rulesHash: 'sha256:test',
                        summary: {valid: true, hardCount: 0, softCount: 0, totalCount: 0},
                        violations: [],
                    },
                    unmetInstructions: [],
                    sameAsPrevious: false,
                },
                validation: {
                    draftRevision: useShiftEditorStore.getState().draftRevision,
                    rulesHash: 'sha256:test',
                    summary: {valid: true, hardCount: 0, softCount: 0, totalCount: 0},
                    violations: [],
                },
            });
        });
    });
});
