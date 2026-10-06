import toast from 'react-hot-toast';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import type * as ShiftEditorModule from '@/features/shift-editor';
import {type TDutyDoc, useShiftEditorStore} from '@/features/shift-editor';
import {ko} from '@/shared/i18n/resources.generated';
import {act, render, screen, userEvent, waitFor} from '@/shared/util/test-utils';
import {useSchedulePublishSuccessStore} from '../../../../model/schedule-publish-success-store';
import {AiAutofill} from '../index';

const mocks = vi.hoisted(() => ({
    previousBlank: false,
    calendarDocs: [] as TDutyDoc[],
    calendarProps: [] as Array<{
        doc: TDutyDoc;
        fixCellOnContextMenu?: boolean;
        nurseNameMaxChars?: number | null;
        onCellClick?: (rowIndex: number, colIndex: number) => void;
        stickyHeader?: boolean;
    }>,
    requestAiSchedule: vi.fn(),
    setStepNavigationBusy: vi.fn(),
    moveScheduleRow: vi.fn(),
    currentTeamNurses: [] as Array<{isConnected: boolean}>,
    wardApi: {
        getSnapshots: vi.fn(),
        saveSnapshot: vi.fn(),
        publishSnapshot: vi.fn(),
    },
    shift: {
        days: [],
        wardShiftTypes: [],
        divisionShiftNurses: [],
    },
    dutyDoc: null as TDutyDoc | null,
}));

vi.mock('react-hot-toast', () => ({
    default: Object.assign(vi.fn(), {success: vi.fn(), error: vi.fn(), loading: vi.fn(), dismiss: vi.fn()}),
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
        buildSaveSnapshotDTO: () => ({}),
        docToShift: () => mocks.shift,
        useAsyncScheduleValidation: () => ({status: 'idle'}),
    };
});

vi.mock('@/shared/api/ward', () => ({
    default: mocks.wardApi,
}));

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
        currentTeamNurses: mocks.currentTeamNurses,
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
        nurseNameMaxChars?: number | null;
        onCellClick?: (rowIndex: number, colIndex: number) => void;
        stickyHeader?: boolean;
    }) => {
        const {doc} = props;

        mocks.calendarDocs.push(doc);
        mocks.calendarProps.push(props);

        return (
            <div data-testid="calendar">
                <span className="make-shift-calendar__header-label--last" data-testid="last-shift-header" />
                <div className="make-shift-calendar__row-last-shifts" data-testid="last-shift-row">
                    <span className="make-shift-calendar__row-last-shift-badge" />
                </div>
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
        onUndo,
        onRedo,
        canUndo,
        canRedo,
    }: {
        onAiFill: () => void;
        onConfirm: () => void;
        onRequestClearUnlockedCells: () => void;
        onUndo: () => void;
        onRedo: () => void;
        canUndo: boolean;
        canRedo: boolean;
    }) => (
        <>
            <div className="ai-autofill-toolbar" data-testid="preparation-tools">
                <button onClick={onUndo} disabled={!canUndo}>
                    undo
                </button>
                <button onClick={onRedo} disabled={!canRedo}>
                    redo
                </button>
            </div>
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
    getBlankLastShiftCellsWarningKey: () => (mocks.previousBlank ? 'previous:blank' : null),
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
        mocks.previousBlank = false;
        localStorage.clear();
        mocks.calendarDocs.length = 0;
        mocks.calendarProps.length = 0;
        mocks.requestAiSchedule.mockReset();
        mocks.setStepNavigationBusy.mockReset();
        mocks.moveScheduleRow.mockReset();
        mocks.currentTeamNurses = [];
        mocks.wardApi.getSnapshots.mockReset().mockResolvedValue({snapshots: []});
        mocks.wardApi.saveSnapshot.mockReset().mockResolvedValue({snapshotId: 101});
        mocks.wardApi.publishSnapshot.mockReset().mockResolvedValue(undefined);
        useSchedulePublishSuccessStore.getState().close();
        seedEditor();
    });

    it('enables right-click fixing on the step 4 calendar', () => {
        render(<AiAutofill />);

        expect(mocks.calendarProps[mocks.calendarProps.length - 1]?.fixCellOnContextMenu).toBe(true);
    });

    it('shows one more name character on the step 4 calendar', () => {
        render(<AiAutofill />);

        expect(mocks.calendarProps[mocks.calendarProps.length - 1]?.nurseNameMaxChars).toBe(5);
    });

    it('pins the step 4 calendar header while scrolling', () => {
        render(<AiAutofill />);

        expect(mocks.calendarProps[mocks.calendarProps.length - 1]?.stickyHeader).toBe(true);
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

    it('shows the success dialog without a negative delivery message when no nurses are connected', async () => {
        const user = userEvent.setup();

        render(<AiAutofill />);

        await user.click(screen.getByRole('button', {name: 'confirm'}));

        await waitFor(() =>
            expect(screen.queryByRole('dialog', {name: 'page.makeShift.aiRefill.publishConfirm.title'})).not.toBeInTheDocument(),
        );
        await waitFor(() =>
            expect(useSchedulePublishSuccessStore.getState().notice).toEqual({connectedNurseCount: 0, showConnectionHint: true}),
        );
        expect(ko.page.makeShift.aiRefill.publishSuccessWithoutRecipients).toBe('병동코드를 간호사에게 공유해 주세요.');
        expect(ko.page.makeShift.aiRefill.publishSuccessConnectionDescription).toBe(
            '듀팅 앱에서 확정된 근무표를 자동으로 받아볼 수 있어요!',
        );
        expect(ko.page.makeShift.aiRefill.publishSuccessWithoutRecipients).not.toContain('연동된 인원이 없어');
    });

    it('uses the purple previous-shift warning image in the publish confirmation', async () => {
        const user = userEvent.setup();

        mocks.currentTeamNurses = [{isConnected: true}];

        render(<AiAutofill />);

        await user.click(screen.getByRole('button', {name: 'confirm'}));

        const dialog = await screen.findByRole('dialog', {name: 'page.makeShift.aiRefill.publishConfirm.title'});

        expect(dialog.querySelector('img')).toHaveAttribute('src', expect.stringContaining('purple-warn-icon'));
    });

    it('adds the connection hint to the animated success dialog when any nurse is unlinked', async () => {
        const user = userEvent.setup();

        mocks.currentTeamNurses = [{isConnected: true}, {isConnected: false}];

        render(<AiAutofill />);

        await user.click(screen.getByRole('button', {name: 'confirm'}));
        await user.click(await screen.findByRole('button', {name: 'page.makeShift.aiRefill.publishConfirm.confirm'}));

        await waitFor(() =>
            expect(useSchedulePublishSuccessStore.getState().notice).toEqual({connectedNurseCount: 1, showConnectionHint: true}),
        );
    });

    it('does not show the connection hint when every nurse is connected', async () => {
        const user = userEvent.setup();

        mocks.currentTeamNurses = [{isConnected: true}];

        render(<AiAutofill />);

        await user.click(screen.getByRole('button', {name: 'confirm'}));
        await user.click(await screen.findByRole('button', {name: 'page.makeShift.aiRefill.publishConfirm.confirm'}));

        await waitFor(() =>
            expect(useSchedulePublishSuccessStore.getState().notice).toEqual({connectedNurseCount: 1, showConnectionHint: false}),
        );
    });

    it('checks previous shifts before skipping fixed preparation for an empty table', async () => {
        mocks.previousBlank = true;

        const doc = makeDoc();

        seedEditor({...doc, rows: doc.rows.map((row) => ({...row, cells: row.cells.map(() => null)})), fixedCells: {}, requestCells: {}});
        mocks.requestAiSchedule.mockImplementation(() => new Promise(() => {}));

        const user = userEvent.setup();

        render(<AiAutofill />);
        await user.click(screen.getByRole('button', {name: 'auto fill'}));
        expect(await screen.findByRole('region', {name: 'page.makeShift.aiRefill.lastShiftBlankDialog.title'})).toBeVisible();
        expect(mocks.requestAiSchedule).not.toHaveBeenCalled();
        await user.click(screen.getByRole('button', {name: 'aiAdjust.preparation.continue'}));
        await waitFor(() => expect(mocks.requestAiSchedule).toHaveBeenCalledTimes(1));
        expect(screen.queryByRole('region', {name: 'page.makeShift.aiRefill.prefillDecision.title'})).not.toBeInTheDocument();
    });

    it('checks previous shifts in chat before choosing fixed shifts and keeps the grey spotlight', async () => {
        mocks.previousBlank = true;

        const user = userEvent.setup();

        render(<AiAutofill />);

        // Read-only previous shifts render badges, not editable cell buttons.
        const headerRect = vi
            .spyOn(screen.getByTestId('last-shift-header'), 'getBoundingClientRect')
            .mockReturnValue(new DOMRect(150, 60, 60, 24));
        const rowRect = vi
            .spyOn(screen.getByTestId('last-shift-row'), 'getBoundingClientRect')
            .mockReturnValue(new DOMRect(150, 360, 60, 32));

        await user.click(screen.getByRole('button', {name: 'auto fill'}));
        expect(await screen.findByRole('region', {name: 'page.makeShift.aiRefill.lastShiftBlankDialog.title'})).toBeVisible();
        expect(screen.queryByRole('dialog', {name: 'page.makeShift.aiRefill.lastShiftBlankDialog.title'})).not.toBeInTheDocument();
        expect(document.querySelector('[data-confirmation-spotlight]')).toBeInTheDocument();
        await waitFor(() => expect(document.querySelector('[data-spotlight-blocker]')).toHaveStyle({top: '52px', height: '348px'}));
        // Navigation keeps moving after the old 100ms retry, without a resize/scroll event.
        await act(async () => new Promise((resolve) => window.setTimeout(resolve, 150)));
        headerRect.mockReturnValue(new DOMRect(100, 60, 60, 24));
        rowRect.mockReturnValue(new DOMRect(100, 380, 60, 32));
        await waitFor(() =>
            expect(document.querySelector('[data-spotlight-blocker]')).toHaveStyle({left: '92px', width: '76px', height: '368px'}),
        );
        expect(mocks.requestAiSchedule).not.toHaveBeenCalled();
        await user.click(screen.getByRole('button', {name: 'aiAdjust.preparation.continue'}));
        expect(await screen.findByRole('region', {name: 'page.makeShift.aiRefill.prefillDecision.title'})).toBeVisible();
        expect(screen.getByText('aiAdjust.preparation.continue')).toBeVisible();
        expect(mocks.requestAiSchedule).not.toHaveBeenCalled();
        await user.click(screen.getByRole('button', {name: 'aiAdjust.close'}));
        expect(document.querySelector('[data-confirmation-spotlight]')).not.toBeInTheDocument();
        expect(useShiftEditorStore.getState().doc.rows[0]?.cells).toEqual(['D', 'E', 'N']);
        expect(mocks.requestAiSchedule).not.toHaveBeenCalled();
        await user.click(screen.getByRole('button', {name: 'auto fill'}));
        expect(await screen.findByRole('region', {name: 'page.makeShift.aiRefill.prefillDecision.title'})).toBeVisible();
        expect(mocks.requestAiSchedule).not.toHaveBeenCalled();
    });

    it('keeps the previous-month question and selected reply after preparation finishes', async () => {
        mocks.previousBlank = true;
        mocks.requestAiSchedule.mockRejectedValue({serverCode: 'AI_QUOTA_EXCEEDED'});

        const user = userEvent.setup();

        render(<AiAutofill />);

        await user.click(screen.getByRole('button', {name: 'auto fill'}));
        await user.click(await screen.findByRole('button', {name: 'aiAdjust.preparation.continue'}));
        await user.click(await screen.findByRole('button', {name: 'aiAdjust.preparation.fill'}));
        await waitFor(() => expect(mocks.requestAiSchedule).toHaveBeenCalledOnce());
        await screen.findByRole('alert');
        expect(screen.getByRole('log').textContent).toMatch(
            /aiAdjust.preparation.previous[\s\S]*aiAdjust.preparation.continue[\s\S]*aiAdjust.preparation.fixed[\s\S]*aiAdjust.preparation.fill/,
        );
        expect(screen.getByText('aiAdjust.preparation.continue')).toBeVisible();
        expect(screen.queryByRole('button', {name: 'aiAdjust.preparation.continue'})).not.toBeInTheDocument();
    });

    it('applies a review draft and keeps its rule warning visible beside the schedule', async () => {
        const doc = makeDoc();

        seedEditor({...doc, rows: doc.rows.map((row) => ({...row, cells: row.cells.map(() => null)})), fixedCells: {}, requestCells: {}});
        mocks.requestAiSchedule.mockImplementation(async (request) => ({
            ok: true,
            response: {
                operationType: 'GENERATE',
                draftRevision: request.draftRevision,
                applicable: true,
                approvable: false,
                validationTarget: 'RESULT',
                changedCells: [{cellKey: '10:2026-07-01', shiftNurseId: 10, date: '2026-07-01', wardShiftTypeId: 1, shiftCode: 'D'}],
                unmetInstructions: ['기존 고정표의 11일은 D가 1명씩 부족해요.'],
                engineResult: {status: 'REJECTED', candidateVisible: true, reviewRequired: true},
            },
            validation: {
                draftRevision: request.draftRevision,
                rulesHash: 'sha256:test',
                summary: {valid: false, hardCount: 1, softCount: 0, totalCount: 1},
                violations: [],
            },
        }));

        const user = userEvent.setup();

        render(<AiAutofill />);
        await user.click(screen.getByRole('button', {name: 'auto fill'}));

        if (screen.queryByRole('button', {name: 'aiAdjust.preparation.fill'})) {
            await user.click(screen.getByRole('button', {name: 'aiAdjust.preparation.fill'}));
        }

        expect(await screen.findByText('초안을 만들었어요 · 확인할 규칙이 있어요')).toBeVisible();
        expect(screen.getByText('기존 고정표의 11일은 D가 1명씩 부족해요.')).toBeVisible();
        expect(useShiftEditorStore.getState().doc.rows[0]?.cells[0]).toBe('D');
        expect(toast.error).not.toHaveBeenCalled();
        await user.click(screen.getByRole('button', {name: '안내 닫기'}));
        expect(screen.queryByText('초안을 만들었어요 · 확인할 규칙이 있어요')).not.toBeInTheDocument();
    });

    it('shows every shift cell in the preparation chat before autofill starts', async () => {
        const user = userEvent.setup();

        render(<AiAutofill />);

        expect(screen.getByTestId('cell-0')).toHaveTextContent('D');
        expect(screen.getByTestId('cell-1')).toHaveTextContent('E');
        expect(screen.getByTestId('cell-2')).toHaveTextContent('N');

        await user.click(screen.getByRole('button', {name: 'auto fill'}));

        expect(await screen.findByRole('region', {name: 'page.makeShift.aiRefill.prefillDecision.title'})).toBeInTheDocument();
        expect(screen.getByTestId('cell-0')).toHaveTextContent('D');
        expect(screen.getByTestId('cell-1')).toHaveTextContent('E');
        expect(screen.getByTestId('cell-2')).toHaveTextContent('N');
        expect(useShiftEditorStore.getState().doc.rows[0]?.cells).toEqual(['D', 'E', 'N']);
    });

    it('toggles a non-empty preparation cell between fixed and unfixed', async () => {
        const user = userEvent.setup();

        render(<AiAutofill />);

        await user.click(screen.getByRole('button', {name: 'auto fill'}));
        await screen.findByRole('region', {name: 'page.makeShift.aiRefill.prefillDecision.title'});

        expect(useShiftEditorStore.getState().doc.fixedCells['10|2026-07-03']).toBeUndefined();

        await user.click(screen.getByTestId('cell-2'));
        expect(useShiftEditorStore.getState().doc.fixedCells['10|2026-07-03']).toBe(true);

        await user.click(screen.getByTestId('cell-2'));
        expect(useShiftEditorStore.getState().doc.fixedCells['10|2026-07-03']).toBeUndefined();
    });

    it.each([false, true])('blocks entry only when the protected schedule has no blanks (blank: %s)', async (hasBlank) => {
        const doc = makeDoc();

        seedEditor({
            ...doc,
            fixedCells: {...doc.fixedCells, '10|2026-07-03': true},
            rows: doc.rows.map((row) => ({...row, cells: hasBlank ? ['D', 'E', null] : row.cells})),
        });

        const user = userEvent.setup();

        render(<AiAutofill />);

        const entry = screen.getByRole('button', {name: 'auto fill'});

        if (hasBlank) {
            expect(entry).toBeEnabled();
            await user.click(entry);
            expect(await screen.findByRole('region', {name: 'page.makeShift.aiRefill.prefillDecision.title'})).toBeVisible();
            expect(screen.getByRole('button', {name: 'aiAdjust.autofill'})).toBeEnabled();
        } else {
            expect(entry).toBeEnabled();
            await user.click(entry);
            expect(toast).toHaveBeenCalledWith('aiAdjust.allFixed', {id: 'ai-autofill-all-fixed'});
            expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        }

        expect(mocks.requestAiSchedule).not.toHaveBeenCalled();
    });

    it('fixes every editable filled shift from the preparation chat at once', async () => {
        const user = userEvent.setup();

        render(<AiAutofill />);

        await user.click(screen.getByRole('button', {name: 'auto fill'}));
        await screen.findByRole('region', {name: 'page.makeShift.aiRefill.prefillDecision.title'});

        expect(screen.queryByRole('button', {name: 'aiAdjust.undo'})).not.toBeInTheDocument();
        await user.click(screen.getByRole('button', {name: 'aiAdjust.preparation.fixAll'}));

        expect(useShiftEditorStore.getState().doc.fixedCells).toEqual({
            '10|2026-07-01': true,
            '10|2026-07-03': true,
        });
        expect(useShiftEditorStore.getState().doc.requestCells).toEqual({'10|2026-07-02': true});
        expect(screen.queryByRole('button', {name: 'aiAdjust.preparation.fixAll'})).not.toBeInTheDocument();
        expect(screen.getByRole('button', {name: 'aiAdjust.autofill'})).toBeDisabled();
        await user.click(screen.getByRole('button', {name: 'aiAdjust.autofill'}));
        expect(mocks.requestAiSchedule).not.toHaveBeenCalled();
        expect(screen.queryByText('aiAdjust.preparation.fixAll')).not.toBeInTheDocument();
        expect(mocks.requestAiSchedule).not.toHaveBeenCalled();

        const undo = screen.getByRole('button', {name: 'aiAdjust.undo'});

        expect(undo).toHaveClass('bg-transparent');
        expect(undo.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
        await user.click(undo);
        expect(useShiftEditorStore.getState().doc.fixedCells).toEqual({'10|2026-07-01': true});
        expect(useShiftEditorStore.getState().doc.requestCells).toEqual({'10|2026-07-02': true});
        expect(screen.queryByRole('button', {name: 'aiAdjust.undo'})).not.toBeInTheDocument();
        expect(screen.getByRole('button', {name: 'aiAdjust.preparation.fill'})).toBeEnabled();
        expect(screen.getByRole('button', {name: 'aiAdjust.preparation.fixAll'})).toBeEnabled();
        await user.click(screen.getByRole('button', {name: 'redo'}));
        expect(screen.getByRole('button', {name: 'aiAdjust.undo'})).toBeEnabled();
        expect(screen.getByRole('button', {name: 'aiAdjust.autofill'})).toBeDisabled();
        await user.click(screen.getByRole('button', {name: 'aiAdjust.autofill'}));
        expect(mocks.requestAiSchedule).not.toHaveBeenCalled();
        await user.click(screen.getByTestId('cell-2'));
        expect(screen.queryByRole('button', {name: 'aiAdjust.undo'})).not.toBeInTheDocument();
        expect(screen.getByRole('button', {name: 'aiAdjust.preparation.fill'})).toBeEnabled();
        expect(mocks.requestAiSchedule).not.toHaveBeenCalled();
    });

    it('opens the toolbar and calendar in the fixed-shift spotlight', async () => {
        const user = userEvent.setup();

        render(<AiAutofill />);
        vi.spyOn(screen.getByTestId('preparation-tools'), 'getBoundingClientRect').mockReturnValue(new DOMRect(80, 40, 600, 84));
        vi.spyOn(document.querySelector('.ai-autofill-preparation-calendar')!, 'getBoundingClientRect').mockReturnValue(
            new DOMRect(80, 160, 600, 350),
        );
        await user.click(screen.getByRole('button', {name: 'auto fill'}));
        await waitFor(() =>
            expect(document.querySelector('[data-spotlight-blocker]')).toHaveStyle({
                top: '32px',
                left: '72px',
                height: '486px',
                width: '616px',
            }),
        );
        expect(document.querySelector('[data-spotlight-blocker]')).not.toHaveClass('pointer-events-auto');
    });

    it('restores bulk-fixed shifts when the preparation chat is canceled', async () => {
        const user = userEvent.setup();

        render(<AiAutofill />);

        await user.click(screen.getByRole('button', {name: 'auto fill'}));
        await screen.findByRole('region', {name: 'page.makeShift.aiRefill.prefillDecision.title'});
        await user.click(screen.getByRole('button', {name: 'aiAdjust.preparation.fixAll'}));
        await user.click(screen.getByRole('button', {name: 'aiAdjust.close'}));

        await waitFor(() =>
            expect(screen.queryByRole('region', {name: 'page.makeShift.aiRefill.prefillDecision.title'})).not.toBeInTheDocument(),
        );
        expect(useShiftEditorStore.getState().doc.fixedCells).toEqual({'10|2026-07-01': true});
    });

    it('rolls back unfinished fixed choices when leaving the page', async () => {
        const user = userEvent.setup();
        const view = render(<AiAutofill />);

        await user.click(screen.getByRole('button', {name: 'auto fill'}));
        await user.click(screen.getByRole('button', {name: 'aiAdjust.preparation.fixAll'}));
        expect(useShiftEditorStore.getState().doc.fixedCells['10|2026-07-03']).toBe(true);
        view.unmount();
        expect(useShiftEditorStore.getState().doc.fixedCells).toEqual({'10|2026-07-01': true});
        expect(mocks.requestAiSchedule).not.toHaveBeenCalled();
    });

    it('does not change a requested shift when it is clicked in the preparation chat', async () => {
        const user = userEvent.setup();

        render(<AiAutofill />);

        await user.click(screen.getByRole('button', {name: 'auto fill'}));
        await screen.findByRole('region', {name: 'page.makeShift.aiRefill.prefillDecision.title'});

        await user.click(screen.getByTestId('cell-1'));

        expect(useShiftEditorStore.getState().doc.fixedCells['10|2026-07-02']).toBeUndefined();
        expect(useShiftEditorStore.getState().doc.requestCells['10|2026-07-02']).toBe(true);
    });

    it('returns to editing without requesting AI when the initial decision is canceled', async () => {
        const user = userEvent.setup();

        render(<AiAutofill />);

        await user.click(screen.getByRole('button', {name: 'auto fill'}));
        await screen.findByRole('region', {name: 'page.makeShift.aiRefill.prefillDecision.title'});

        await user.click(screen.getByTestId('cell-2'));
        expect(useShiftEditorStore.getState().doc.fixedCells['10|2026-07-03']).toBe(true);

        await user.click(screen.getByRole('button', {name: 'aiAdjust.close'}));

        await waitFor(() =>
            expect(screen.queryByRole('region', {name: 'page.makeShift.aiRefill.prefillDecision.title'})).not.toBeInTheDocument(),
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
        await screen.findByRole('region', {name: 'page.makeShift.aiRefill.prefillDecision.title'});

        await user.click(screen.getByRole('button', {name: 'aiAdjust.preparation.fill'}));

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
