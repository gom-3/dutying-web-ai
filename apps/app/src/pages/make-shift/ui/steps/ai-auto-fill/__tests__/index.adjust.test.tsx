import type {TScheduleAdjustmentNotice, TScheduleMonthRequestItem, TScheduleMonthRequestRes, TSnapshotCellDTO} from '@dutying/api/ward';
import {useEffect} from 'react';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import type * as ShiftEditorModule from '@/features/shift-editor';
import {type TDutyDoc, useShiftEditorStore} from '@/features/shift-editor';
import {act, render, screen, userEvent, waitFor} from '@/shared/util/test-utils';
import {AiAutofill} from '../index';

// 칩 노출은 서버(workspace 응답)가 정하고, 로컬 override 만 그것을 덮는다.
// 이 파일의 대부분은 칩이 열린 상태를 보므로 override 로 켜 둔다 —
// 게이트 자체는 아래 두 테스트가 override 를 비우고 확인한다.
vi.hoisted(() => {
    vi.stubEnv('VITE_AI_ADJUST_ENABLED', 'true');
});

const mocks = vi.hoisted(() => ({
    requestAiSchedule: vi.fn(),
    collapseNavigationBar: vi.fn(),
    setStepNavigationBusy: vi.fn(),
    moveScheduleRow: vi.fn(),
    month: 7,
    previousBlank: false,
    shift: {
        days: [],
        wardShiftTypes: ['D', 'E', 'N', 'O'].map((shortName, index) => ({wardShiftTypeId: index + 1, shortName})),
        divisionShiftNurses: [],
    },
    dutyDoc: null as TDutyDoc | null,
    /** 서버의 이번 달 요청 저장소 흉내. autofill 의 adjust.requests 가 여기로 들어오고, 목록·PATCH 가 여기를 읽는다. */
    monthRequests: [] as TScheduleMonthRequestRes[],
    nextRequestId: 1,
    getScheduleMonthRequests: vi.fn(),
    updateScheduleMonthRequest: vi.fn(),
    getScheduleCarryOverCandidates: vi.fn(),
    carryOverScheduleMonthRequests: vi.fn(),
    interpretScheduleAdjust: vi.fn(),
    getScheduleGoalCandidate: vi.fn(),
    applyScheduleGoalCandidate: vi.fn(),
    undoScheduleGoalCandidate: vi.fn(),
}));

vi.mock('@/shared/api/ward', () => ({
    default: {
        getScheduleMonthRequests: mocks.getScheduleMonthRequests,
        updateScheduleMonthRequest: mocks.updateScheduleMonthRequest,
        getScheduleCarryOverCandidates: mocks.getScheduleCarryOverCandidates,
        carryOverScheduleMonthRequests: mocks.carryOverScheduleMonthRequests,
        interpretScheduleAdjust: mocks.interpretScheduleAdjust,
        getScheduleGoalCandidate: mocks.getScheduleGoalCandidate,
        applyScheduleGoalCandidate: mocks.applyScheduleGoalCandidate,
        undoScheduleGoalCandidate: mocks.undoScheduleGoalCandidate,
    },
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
    useNavigationBarFoldStore: (selector: (state: {collapse: () => void}) => unknown) => selector({collapse: mocks.collapseNavigationBar}),
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

// 에디터 루트(onKeyDown) 는 실제 키 바인딩을 쓴다 — 그 안에 놓인 문장 입력창의 Backspace·방향키·근무키가
// 셀 편집으로 새는 회귀를 이 파일에서 잡기 위해서다.
vi.mock('../../shared/use-duty-editor-step', async () => {
    const {useShiftEditorKeyBindings} = await vi.importActual<typeof ShiftEditorModule>('@/features/shift-editor');

    return {
        useDutyEditorStep: () => {
            const {onKeyDown, onPasteCapture} = useShiftEditorKeyBindings();

            return {
                dutyQuery: {data: mocks.shift, isLoading: false, isError: false, refetch: vi.fn()},
                editorRef: {current: null},
                editorDoc: mocks.dutyDoc,
                onKeyDown,
                onPasteCapture,
                violationMap: new Map(),
                teamViolations: [],
                focusEditor: vi.fn(),
                isHydratingEditor: false,
            };
        },
    };
});

vi.mock('../../shared/make-shift-calendar-skeleton', () => ({
    MakeShiftCalendarSkeleton: () => <div data-testid="calendar-skeleton" />,
}));

vi.mock('../../shared/make-shift-calendar', () => ({
    MakeShiftCalendar: () => <div data-testid="calendar" />,
}));

vi.mock('../ai-autofill-toolbar', () => ({
    AiAutofillToolbar: ({
        onAiFill,
        onUndo,
        onAdjust,
        onRegenerate,
        hasGeneratedSchedule,
        isAdjustEnabled,
    }: {
        onAiFill: () => void;
        onUndo: () => void;
        onAdjust?: () => void;
        onRegenerate: () => void;
        hasGeneratedSchedule: boolean;
        isAdjustEnabled: boolean;
    }) => (
        <>
            <button type="button" onClick={onAiFill}>
                auto fill
            </button>
            <button type="button" onClick={onUndo}>
                undo
            </button>
            {onAdjust && (
                <button type="button" onClick={onAdjust}>
                    adjust shifts
                </button>
            )}
            {isAdjustEnabled && hasGeneratedSchedule && (
                <button type="button" onClick={onRegenerate}>
                    regenerate schedule
                </button>
            )}
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
    getBlankLastShiftCellsWarningKey: () => (mocks.previousBlank ? 'previous:blank' : null),
}));

const ADJUST_TITLE = 'aiAdjust.chat.welcome';
const ADJUST_DIALOG_TITLE = 'aiAdjust.title';
const CLUSTER_ON_EXAMPLE = 'aiAdjust.offExample';
const TEXT_INPUT_LABEL = 'page.makeShift.aiRefill.adjust.textInput.label';
const TEXT_SUBMIT = 'aiAdjust.send';
const CARD_APPLY = 'aiAdjust.chat.applyReply';
const DECISION_TITLE = 'page.makeShift.aiRefill.prefillDecision.title';
const DECISION_CONFIRM = 'aiAdjust.preparation.fill';

function makeDoc(): TDutyDoc {
    return {
        columns: ['2026-07-01', '2026-07-02', '2026-07-03', '2026-07-04'],
        rows: [
            {workerId: '10', cells: ['D', 'E', 'N', 'D']},
            {workerId: '11', cells: ['N', 'D', 'E', 'E']},
        ],
        workerMeta: {'10': {name: 'Kim', nurseId: 910}, '11': {name: 'Lee', nurseId: 911}},
        fixedCells: {'10|2026-07-01': true},
        requestCells: {'10|2026-07-02': true},
    };
}

/** 아직 아무것도 채우지 않은 표. 조절 패널이 닫혀 있어야 하는 유일한 상태다. */
function makeEmptyDoc(): TDutyDoc {
    return {
        columns: ['2026-07-01', '2026-07-02', '2026-07-03', '2026-07-04'],
        rows: [
            {workerId: '10', cells: [null, null, null, null]},
            {workerId: '11', cells: [null, null, null, null]},
        ],
        workerMeta: {'10': {name: 'Kim', nurseId: 910}, '11': {name: 'Lee', nurseId: 911}},
        fixedCells: {},
        requestCells: {},
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
function okResult(
    changedCells: TSnapshotCellDTO[],
    operationType: 'GENERATE' | 'ADJUST',
    adjustmentNotices: TScheduleAdjustmentNotice[] = [],
) {
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
            engineResult: {status: 'ACCEPTED'},
            draftRevision,
            resultType: 'PATCH',
            changedCells,
            validation,
            unmetInstructions: [],
            sameAsPrevious: false,
            adjustmentNotices,
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

function storeRequest(item: TScheduleMonthRequestItem): TScheduleMonthRequestRes {
    const stored: TScheduleMonthRequestRes = {
        id: mocks.nextRequestId++,
        kind: item.kind,
        lifetime: item.lifetime ?? 'MONTH',
        status: 'ACTIVE',
        origin: item.origin ?? 'CHIP',
        displayLabel: item.displayLabel ?? '',
        knob: item.knob,
        value: item.value,
        templateCode: item.templateCode,
        params: item.params,
        severity: item.severity,
        requestText: item.requestText,
    };

    mocks.monthRequests.push(stored);

    return stored;
}

/** 서버처럼: 요청을 먼저 저장하고 나서 결과를 돌려준다. */
function adjustResultSavingRequests(changedCells: TSnapshotCellDTO[]) {
    return async (request: {adjust?: {requests?: TScheduleMonthRequestItem[]}}) => {
        request.adjust?.requests?.forEach(storeRequest);

        return okResult(changedCells, 'ADJUST');
    };
}

function installRequestStore() {
    mocks.monthRequests = [];
    mocks.nextRequestId = 1;
    mocks.getScheduleMonthRequests.mockReset();
    mocks.updateScheduleMonthRequest.mockReset();
    mocks.getScheduleCarryOverCandidates.mockReset();
    mocks.carryOverScheduleMonthRequests.mockReset();
    mocks.getScheduleMonthRequests.mockImplementation(async () => ({year: 2026, month: mocks.month, requests: [...mocks.monthRequests]}));
    mocks.updateScheduleMonthRequest.mockImplementation(async (_w: number, _t: number, id: number, dto: {status?: string}) => {
        const target = mocks.monthRequests.find((request) => request.id === id);

        if (target && dto.status) target.status = dto.status as TScheduleMonthRequestRes['status'];

        return target;
    });
    mocks.getScheduleCarryOverCandidates.mockResolvedValue({sourceYear: 2026, sourceMonth: 6, requests: []});
    mocks.carryOverScheduleMonthRequests.mockResolvedValue([]);
    mocks.interpretScheduleAdjust.mockReset();
    mocks.getScheduleGoalCandidate.mockReset();
    mocks.applyScheduleGoalCandidate.mockReset();
    mocks.undoScheduleGoalCandidate.mockReset();
}

function rowCells(workerId: string) {
    return useShiftEditorStore.getState().doc.rows.find((row) => row.workerId === workerId)?.cells;
}

async function completeFirstFill(user: ReturnType<typeof userEvent.setup>) {
    mocks.requestAiSchedule.mockImplementation(async () => okResult(FIRST_FILL_CELLS, 'GENERATE'));

    await user.click(screen.getByRole('button', {name: 'auto fill'}));
    await screen.findByRole('region', {name: DECISION_TITLE});
    await user.click(screen.getByRole('button', {name: DECISION_CONFIRM}));

    await waitFor(() => expect(mocks.requestAiSchedule).toHaveBeenCalledTimes(1));
}

/** 생성과 별개인 조절 진입점으로, 닫은 사이드바도 다시 열 수 있다. */
async function openAdjustDialog(user: ReturnType<typeof userEvent.setup>) {
    await user.click(screen.getByRole('button', {name: 'adjust shifts'}));

    await screen.findByRole('dialog', {name: ADJUST_DIALOG_TITLE});
}

async function openModification(user: ReturnType<typeof userEvent.setup>) {
    await openAdjustDialog(user);

    const modify = screen.queryByRole('button', {name: 'aiAdjust.chat.modify'});

    if (modify) await user.click(modify);
}

/**
 * 문장으로 조절을 건다. 칩(즉시 토글)이 사라진 뒤로 조절을 시작하는 경로는 이것 하나다 —
 * 예시를 누르면 입력창이 채워질 뿐이고, 실행은 사용자가 "조절"을 눌러야 일어난다.
 */
async function answerDefaultQuestions(user: ReturnType<typeof userEvent.setup>) {
    for (let count = 0; count < 30; count++) {
        const button =
            screen.queryByRole('button', {name: 'aiAdjust.chat.confirmProposal'}) ??
            screen.queryByRole('button', {name: 'aiAdjust.savedRequests.lifetime.MONTH'}) ??
            screen.queryByRole('button', {name: 'aiAdjust.chat.preferred'});
        if (!button) break;
        await user.click(button);
    }
}

async function finishAdjustmentPreparation(user: ReturnType<typeof userEvent.setup>) {
    await waitFor(() => {
        expect(
            screen.queryByRole('button', {name: DECISION_CONFIRM}) ?? screen.queryByRole('textbox', {name: TEXT_INPUT_LABEL}),
        ).toBeEnabled();
    });

    const confirm = screen.queryByRole('button', {name: DECISION_CONFIRM});

    if (confirm) await user.click(confirm);
}

async function adjustBySentence(user: ReturnType<typeof userEvent.setup>, items: TScheduleMonthRequestItem[], sentence = '근무를 몰아서') {
    mocks.interpretScheduleAdjust.mockResolvedValue({items, unmapped: [], strength: 'NORMAL'});

    await openModification(user);
    await user.type(screen.getByRole('textbox', {name: TEXT_INPUT_LABEL}), sentence);
    await user.click(screen.getByRole('button', {name: TEXT_SUBMIT}));
    await screen.findByText('aiAdjust.understood');
    await answerDefaultQuestions(user);
    await user.click(screen.getByRole('button', {name: CARD_APPLY}));
    await finishAdjustmentPreparation(user);
}

const CLUSTER_ITEM: TScheduleMonthRequestItem = {
    kind: 'KNOB',
    knob: 'CLUSTERING',
    value: 1,
    displayLabel: 'cluster',
};

const GOAL_CANDIDATE_STORAGE_KEY = 'dutying:goal-candidate:1:10:2026:7';

function goalResult() {
    return {
        goalType: 'MINIMIZE_SINGLE_NIGHT_RUNS' as const,
        maxOffDifference: 1,
        required: false,
        goalStatus: 'SATISFIED' as const,
        beforeSingleNightRuns: 1,
        afterSingleNightRuns: 0,
        actualOffDifference: 1,
        boundaryUnknownCount: 0,
        metricDefinitionVersion: 'goal-metrics-v1',
    };
}

function appliedGoalCandidateDetail() {
    return {
        candidate: {
            candidateId: 'candidate-1',
            baseDraftRevision: 1,
            appliedDraftRevision: 1,
            baseCellsHash: 'sha256:base',
            planHash: 'sha256:plan',
            applicationStatus: 'APPLIED' as const,
        },
        changedCells: [cell(11, '2026-07-01', 'D')],
        revertCells: [cell(11, '2026-07-01', 'N')],
        goalResult: goalResult(),
        events: [],
    };
}

describe('AiAutofill adjust panel', () => {
    beforeEach(() => {
        mocks.requestAiSchedule.mockReset();
        mocks.collapseNavigationBar.mockReset();
        mocks.setStepNavigationBusy.mockReset();
        mocks.moveScheduleRow.mockReset();
        mocks.month = 7;
        mocks.previousBlank = false;
        vi.stubEnv('VITE_AI_ADJUST_ENABLED', 'true');
        window.sessionStorage.clear();
        window.localStorage.clear();
        installRequestStore();
        seedEditor();
    });

    // 게이트 테스트가 override 와 서버 플래그를 비운 채 실패해도 다음 테스트로 번지지 않도록 여기서 되돌린다.
    afterEach(() => {
        vi.stubEnv('VITE_AI_ADJUST_ENABLED', 'true');
        useShiftEditorStore.getState().setAutofillAdjustEnabled(false);
    });

    it('skips fixed-shift preparation for an empty table and shows completion only after success', async () => {
        seedEditor(makeEmptyDoc());

        const user = userEvent.setup();

        render(<AiAutofill />);

        // 빈 표는 고정 선택 없이 바로 실행하고, 완료 문구는 성공한 뒤에만 보여 준다.
        let finishFill!: (result: ReturnType<typeof okResult>) => void;
        mocks.requestAiSchedule.mockImplementation(
            () =>
                new Promise((resolve) => {
                    finishFill = resolve;
                }),
        );
        await user.click(screen.getByRole('button', {name: 'auto fill'}));
        expect(screen.queryByRole('region', {name: DECISION_TITLE})).not.toBeInTheDocument();

        await waitFor(() => expect(mocks.requestAiSchedule).toHaveBeenCalledTimes(1));
        expect(screen.getByRole('dialog', {name: ADJUST_DIALOG_TITLE})).toBeVisible();
        expect(screen.queryByText('aiAdjust.generationCompleted')).not.toBeInTheDocument();
        expect(mocks.collapseNavigationBar).toHaveBeenCalledTimes(1);

        await act(async () => finishFill(okResult(FIRST_FILL_CELLS, 'GENERATE')));
        await screen.findByRole('dialog', {name: ADJUST_DIALOG_TITLE});

        expect(mocks.collapseNavigationBar).toHaveBeenCalledTimes(1);
        expect(document.documentElement).toHaveStyle({'--make-ai-adjust-sidebar-width': '407px'});
        expect(screen.getAllByText('aiAdjust.generationCompleted')).toHaveLength(1);
        expect(screen.queryByText(ADJUST_TITLE)).not.toBeInTheDocument();
        expect(screen.getByRole('button', {name: 'aiAdjust.chat.modify'})).toBeInTheDocument();
    });

    it.each([false, true])('keeps a blocked generation in chat and preserves the draft (adjust enabled: %s)', async (enabled) => {
        useShiftEditorStore.getState().setAutofillAdjustEnabled(enabled);
        const before = useShiftEditorStore.getState().doc;
        const message = 'AI 사용 횟수를 모두 썼어요.\n요금제와 남은 횟수를 확인해 주세요.';

        mocks.requestAiSchedule.mockResolvedValue({ok: false, message, failure: {message, blocked: true}});
        const user = userEvent.setup();
        render(<AiAutofill />);
        await user.click(screen.getByRole('button', {name: 'auto fill'}));
        await user.click(screen.getByRole('button', {name: DECISION_CONFIRM}));
        expect(await screen.findByRole('alert')).toHaveTextContent('AI 사용 횟수를 모두 썼어요.');
        expect(screen.getByRole('dialog', {name: ADJUST_DIALOG_TITLE})).toBeVisible();
        expect(screen.queryByText('aiAdjust.generationCompleted')).not.toBeInTheDocument();
        expect(screen.queryByRole('button', {name: 'aiAdjust.failure.retry'})).not.toBeInTheDocument();
        expect(useShiftEditorStore.getState().doc).toEqual(before);
        expect(mocks.requestAiSchedule.mock.calls[0][0].doc.rows[0].cells).toEqual(['D', 'E', null, null]);
        await user.click(screen.getByRole('button', {name: 'aiAdjust.close'}));
        expect(useShiftEditorStore.getState().doc).toEqual(before);
    });

    it('keeps the adjust panel open when the user comes back to a filled table', async () => {
        // 회귀: 패널이 "이번 세션에서 자동 채우기를 했는지"에만 걸려 있어, 나갔다 들어오면 이미 걸어 둔
        // 요청이 화면에서 사라졌다. 서버는 그 요청을 다음 자동 채우기에 그대로 싣는데도.
        storeRequest({kind: 'KNOB', knob: 'CLUSTERING', value: 1, origin: 'CHIP', displayLabel: 'cluster'});

        const user = userEvent.setup();

        render(<AiAutofill />);

        await openModification(user);

        expect(screen.getByText(ADJUST_TITLE)).toBeInTheDocument();
        await waitFor(() => expect(screen.getByRole('button', {name: /savedRequests\.titleCount \{"count":1\}/})).toBeInTheDocument());
        expect(mocks.requestAiSchedule).not.toHaveBeenCalled();
    });

    it.each([
        ['GENERATE', 'REPAIRED', true],
        ['GENERATE', 'REJECTED', false],
        ['GENERATE', 'ERROR', false],
        ['GENERATE', undefined, false],
        ['ADJUST', 'ACCEPTED', false],
    ] as const)('only shows completion guidance for successful generation: %s / %s', async (operation, status, shouldOpen) => {
        seedEditor(makeEmptyDoc());

        const user = userEvent.setup();
        mocks.requestAiSchedule.mockImplementation(async () => {
            const result = okResult(FIRST_FILL_CELLS, operation);
            return {...result, response: {...result.response, engineResult: status ? {status} : undefined}};
        });
        render(<AiAutofill />);

        await user.click(screen.getByRole('button', {name: 'auto fill'}));
        await waitFor(() => expect(mocks.requestAiSchedule).toHaveBeenCalledTimes(1));

        if (shouldOpen) {
            await screen.findByRole('dialog', {name: ADJUST_DIALOG_TITLE});
            expect(screen.getAllByText('aiAdjust.generationCompleted')).toHaveLength(1);
        } else {
            expect(screen.getByRole('dialog', {name: ADJUST_DIALOG_TITLE})).toBeVisible();
            expect(screen.queryByText('aiAdjust.generationCompleted')).not.toBeInTheDocument();
            expect(mocks.collapseNavigationBar).toHaveBeenCalledTimes(1);
        }
    });

    it.each([true, false])('starts a new chat from previous-month preparation without generating or closing the sheet (adjust: %s)', async (adjustEnabled) => {
        vi.stubEnv('VITE_AI_ADJUST_ENABLED', String(adjustEnabled));
        mocks.previousBlank = true;
        const user = userEvent.setup();
        render(<AiAutofill />);
        const before = useShiftEditorStore.getState().doc;
        await user.click(screen.getByRole('button', {name: 'auto fill'}));
        await screen.findByRole('button', {name: 'aiAdjust.preparation.continue'});
        await user.click(screen.getByRole('button', {name: 'aiAdjust.chat.restart'}));

        expect(screen.getByRole('dialog', {name: ADJUST_DIALOG_TITLE})).toBeVisible();
        expect(screen.getByRole('button', {name: 'aiAdjust.chat.regenerate'})).toBeEnabled();
        if (adjustEnabled) expect(screen.getByRole('button', {name: 'aiAdjust.chat.modify'})).toBeEnabled();
        else expect(screen.getByRole('button', {name: 'aiAdjust.chat.modify'})).toBeDisabled();
        expect(screen.queryByRole('button', {name: 'aiAdjust.preparation.continue'})).not.toBeInTheDocument();
        expect(document.documentElement.dataset.makeAiPreparing).toBe('false');
        expect(useShiftEditorStore.getState().doc).toEqual(before);
        expect(mocks.requestAiSchedule).not.toHaveBeenCalled();

        await user.click(screen.getByRole('button', {name: 'aiAdjust.chat.regenerate'}));
        expect(await screen.findByRole('button', {name: 'aiAdjust.preparation.continue'})).toBeEnabled();
    });

    it('allows a new chat when all preparation cells are fixed and restores only tentative fixes', async () => {
        const user = userEvent.setup();
        render(<AiAutofill />);
        const before = useShiftEditorStore.getState().doc;
        await user.click(screen.getByRole('button', {name: 'auto fill'}));
        await user.click(await screen.findByRole('button', {name: 'aiAdjust.preparation.fixAll'}));
        expect(useShiftEditorStore.getState().doc.fixedCells).not.toEqual(before.fixedCells);
        expect(screen.getByRole('button', {name: 'aiAdjust.chat.restart'})).toBeEnabled();
        await user.click(screen.getByRole('button', {name: 'aiAdjust.chat.restart'}));

        expect(useShiftEditorStore.getState().doc).toEqual(before);
        expect(screen.queryByRole('region', {name: DECISION_TITLE})).not.toBeInTheDocument();
        expect(screen.queryByRole('log')).not.toBeInTheDocument();
        expect(screen.getByRole('button', {name: 'aiAdjust.chat.modify'})).toBeEnabled();
        expect(mocks.requestAiSchedule).not.toHaveBeenCalled();
    });

    it('cancels adjustment preparation and returns to a clean conversation', async () => {
        const user = userEvent.setup();
        mocks.interpretScheduleAdjust.mockResolvedValue({items: [CLUSTER_ITEM], unmapped: [], strength: 'NORMAL'});
        render(<AiAutofill />);
        await completeFirstFill(user);
        const before = useShiftEditorStore.getState().doc;
        await openModification(user);
        await user.type(screen.getByRole('textbox', {name: TEXT_INPUT_LABEL}), '근무를 몰아서');
        await user.click(screen.getByRole('button', {name: TEXT_SUBMIT}));
        await screen.findByText('aiAdjust.understood');
        await answerDefaultQuestions(user);
        await user.click(screen.getByRole('button', {name: CARD_APPLY}));
        await screen.findByRole('region', {name: DECISION_TITLE});
        await user.click(screen.getByRole('button', {name: 'aiAdjust.chat.restart'}));
        await user.click(screen.getByRole('button', {name: 'aiAdjust.chat.modify'}));

        expect(screen.getByRole('textbox', {name: TEXT_INPUT_LABEL})).toHaveValue('');
        expect(screen.getByRole('textbox', {name: TEXT_INPUT_LABEL})).toHaveFocus();
        expect(screen.queryByText('aiAdjust.stale')).not.toBeInTheDocument();
        expect(screen.queryByRole('region', {name: DECISION_TITLE})).not.toBeInTheDocument();
        expect(useShiftEditorStore.getState().doc).toEqual(before);
        expect(mocks.requestAiSchedule).toHaveBeenCalledTimes(1);
    });

    it('does not reopen adjustment preparation when its request check finishes after restarting', async () => {
        const user = userEvent.setup();
        mocks.interpretScheduleAdjust.mockResolvedValue({items: [CLUSTER_ITEM], unmapped: [], strength: 'NORMAL'});
        render(<AiAutofill />);
        await completeFirstFill(user);
        await openModification(user);
        await user.type(screen.getByRole('textbox', {name: TEXT_INPUT_LABEL}), '근무를 몰아서');
        await user.click(screen.getByRole('button', {name: TEXT_SUBMIT}));
        await screen.findByText('aiAdjust.understood');
        await answerDefaultQuestions(user);

        let resolve!: (value: unknown) => void;
        mocks.getScheduleMonthRequests.mockImplementationOnce(() => new Promise((done) => { resolve = done; }));
        await user.click(screen.getByRole('button', {name: CARD_APPLY}));
        await user.click(screen.getByRole('button', {name: 'aiAdjust.chat.restart'}));
        await act(async () => resolve({year: 2026, month: 7, requests: []}));

        expect(screen.getByRole('button', {name: 'aiAdjust.chat.modify'})).toBeEnabled();
        expect(screen.queryByRole('region', {name: DECISION_TITLE})).not.toBeInTheDocument();
        expect(screen.queryByRole('log')).not.toBeInTheDocument();
        expect(mocks.requestAiSchedule).toHaveBeenCalledTimes(1);
    });

    it('aborts a running generation and ignores its late result after a new chat starts', async () => {
        const user = userEvent.setup();
        let resolveOld!: (value: unknown) => void;
        let resolveNew!: (value: unknown) => void;
        mocks.requestAiSchedule
            .mockImplementationOnce(() => new Promise((resolve) => { resolveOld = resolve; }))
            .mockImplementationOnce(() => new Promise((resolve) => { resolveNew = resolve; }));
        render(<AiAutofill />);
        const before = useShiftEditorStore.getState().doc;
        await user.click(screen.getByRole('button', {name: 'auto fill'}));
        await user.click(await screen.findByRole('button', {name: DECISION_CONFIRM}));
        const signal = mocks.requestAiSchedule.mock.calls[0]![0].signal as AbortSignal;
        await user.click(screen.getByRole('button', {name: 'aiAdjust.chat.restart'}));

        expect(signal.aborted).toBe(true);
        expect(useShiftEditorStore.getState().doc).toEqual(before);
        expect(screen.queryByTestId('ai-loading-overlay')).not.toBeInTheDocument();
        expect(screen.getByRole('button', {name: 'aiAdjust.chat.regenerate'})).toBeEnabled();
        await user.click(screen.getByRole('button', {name: 'aiAdjust.chat.regenerate'}));
        await user.click(await screen.findByRole('button', {name: DECISION_CONFIRM}));
        await act(async () => resolveOld(okResult(FIRST_FILL_CELLS, 'GENERATE')));

        expect(useShiftEditorStore.getState().doc).toEqual(before);
        expect(screen.queryByText('aiAdjust.generationCompleted')).not.toBeInTheDocument();
        expect(screen.getByTestId('ai-loading-overlay')).toBeInTheDocument();
        await act(async () => resolveNew(okResult(FIRST_FILL_CELLS, 'GENERATE')));
        expect(screen.getByText('aiAdjust.generationCompleted')).toBeVisible();
        expect(useShiftEditorStore.getState().doc.rows).not.toEqual(before.rows);
    });

    it('resumes fixed-shift preparation after closing without requesting a result', async () => {
        const user = userEvent.setup();
        render(<AiAutofill />);
        await completeFirstFill(user);

        const before = useShiftEditorStore.getState().doc;

        await user.click(screen.getByRole('button', {name: 'aiAdjust.close'}));
        expect(screen.queryByRole('dialog', {name: ADJUST_DIALOG_TITLE})).not.toBeInTheDocument();
        await openAdjustDialog(user);
        expect(screen.getAllByText('aiAdjust.generationCompleted')).toHaveLength(1);
        await user.click(screen.getByRole('button', {name: 'regenerate schedule'}));

        await screen.findByRole('region', {name: DECISION_TITLE});

        expect(mocks.requestAiSchedule).toHaveBeenCalledTimes(1);
        await user.click(screen.getByRole('button', {name: 'aiAdjust.close'}));

        expect(screen.queryByRole('dialog', {name: ADJUST_DIALOG_TITLE})).not.toBeInTheDocument();
        await user.click(screen.getByRole('button', {name: 'auto fill'}));
        expect(screen.getByRole('region', {name: DECISION_TITLE})).toBeVisible();
        expect(screen.queryByRole('button', {name: 'aiAdjust.chat.modify'})).not.toBeInTheDocument();
        expect(screen.queryByText('aiAdjust.chat.welcome')).not.toBeInTheDocument();
        expect(useShiftEditorStore.getState().doc).toEqual(before);
        expect(mocks.requestAiSchedule).toHaveBeenCalledTimes(1);
        expect(mocks.interpretScheduleAdjust).not.toHaveBeenCalled();
    });

    it.each([
        {generated: false, completedPrevious: false},
        {generated: false, completedPrevious: true},
        {generated: true, completedPrevious: false},
        {generated: true, completedPrevious: true},
    ])('resumes the previous-month conversation after editing: %j', async ({generated, completedPrevious}) => {
        const user = userEvent.setup();
        const view = render(<AiAutofill />);

        mocks.requestAiSchedule.mockImplementation(async () => okResult(FIRST_FILL_CELLS, 'GENERATE'));

        if (generated) await completeFirstFill(user);

        mocks.previousBlank = true;
        act(() => useShiftEditorStore.getState().setDoc({...useShiftEditorStore.getState().doc}));
        view.rerender(<AiAutofill />);
        await user.click(screen.getByRole('button', {name: generated ? 'regenerate schedule' : 'auto fill'}));
        await user.click(await screen.findByRole('button', {name: 'aiAdjust.preparation.editPrevious'}));
        expect(screen.queryByRole('dialog', {name: ADJUST_DIALOG_TITLE})).not.toBeInTheDocument();
        expect(document.querySelector('[data-confirmation-spotlight]')).not.toBeInTheDocument();

        mocks.previousBlank = !completedPrevious;
        act(() => useShiftEditorStore.getState().setDoc({...useShiftEditorStore.getState().doc}));
        view.rerender(<AiAutofill />);
        expect(screen.queryByRole('dialog', {name: ADJUST_DIALOG_TITLE})).not.toBeInTheDocument();
        await user.click(screen.getByRole('button', {name: 'auto fill'}));
        expect(screen.getByRole('region', {name: 'page.makeShift.aiRefill.lastShiftBlankDialog.title'})).toBeVisible();
        expect(screen.getByRole('log').textContent).toContain('aiAdjust.preparation.editPrevious');
        expect(screen.queryByText(ADJUST_TITLE)).not.toBeInTheDocument();
        expect(screen.queryByRole('button', {name: 'aiAdjust.chat.modify'})).not.toBeInTheDocument();
        expect(mocks.requestAiSchedule).toHaveBeenCalledTimes(generated ? 1 : 0);

        const nextLabel = completedPrevious ? 'aiAdjust.preparation.next' : 'aiAdjust.preparation.continue';

        expect(screen.getByRole('button', {name: nextLabel})).toBeVisible();

        if (completedPrevious) {
            expect(screen.getByText('aiAdjust.preparation.previousReady')).toBeVisible();
            expect(screen.queryByRole('button', {name: 'aiAdjust.preparation.editPrevious'})).not.toBeInTheDocument();
        }

        const history = screen.getByRole('log').textContent;

        await user.click(screen.getByRole('button', {name: 'aiAdjust.close'}));
        await user.click(screen.getByRole('button', {name: 'auto fill'}));
        expect(screen.getByRole('log').textContent).toBe(history);
        await user.click(screen.getByRole('button', {name: nextLabel}));
        expect(screen.getByRole('region', {name: DECISION_TITLE})).toBeVisible();
        expect(mocks.requestAiSchedule).toHaveBeenCalledTimes(generated ? 1 : 0);
        await user.click(screen.getByRole('button', {name: DECISION_CONFIRM}));
        await waitFor(() => expect(mocks.requestAiSchedule).toHaveBeenCalledTimes(generated ? 2 : 1));
    });

    it('reviews previous and fixed shifts before rebuilding and resumes with the confirmed modification', async () => {
        const user = userEvent.setup();
        const view = render(<AiAutofill />);
        await completeFirstFill(user);
        mocks.previousBlank = true;
        act(() => useShiftEditorStore.getState().setDoc({...useShiftEditorStore.getState().doc}));
        view.rerender(<AiAutofill />);
        mocks.interpretScheduleAdjust.mockResolvedValue({
            items: [CLUSTER_ITEM],
            llmPrompt: '자연스럽게 다듬어줘',
            strength: 'LIGHT',
            unmapped: [],
        });
        await openModification(user);
        await user.type(screen.getByRole('textbox', {name: TEXT_INPUT_LABEL}), '근무를 몰아서');
        await user.click(screen.getByRole('button', {name: TEXT_SUBMIT}));
        await screen.findByText('aiAdjust.understood');
        await answerDefaultQuestions(user);
        await user.click(screen.getByRole('button', {name: CARD_APPLY}));
        await user.click(await screen.findByRole('button', {name: 'aiAdjust.preparation.editPrevious'}));
        expect(mocks.requestAiSchedule).toHaveBeenCalledTimes(1);
        expect(screen.queryByRole('dialog', {name: ADJUST_DIALOG_TITLE})).not.toBeInTheDocument();
        mocks.previousBlank = false;
        act(() => {
            const doc = useShiftEditorStore.getState().doc;

            useShiftEditorStore.getState().setDoc({...doc, rows: doc.rows.map((row) => ({...row, lastCells: ['D', 'E', 'O']}))});
        });
        view.rerender(<AiAutofill />);
        await user.click(screen.getByRole('button', {name: 'auto fill'}));
        await user.click(screen.getByRole('button', {name: 'aiAdjust.preparation.next'}));
        expect(screen.getByRole('region', {name: DECISION_TITLE})).toBeVisible();
        expect(mocks.requestAiSchedule).toHaveBeenCalledTimes(1);
        mocks.requestAiSchedule.mockImplementation(adjustResultSavingRequests([]));
        await user.click(screen.getByRole('button', {name: DECISION_CONFIRM}));
        await waitFor(() => expect(mocks.requestAiSchedule).toHaveBeenCalledTimes(2));
        expect(mocks.requestAiSchedule.mock.calls[1]?.[0]).toMatchObject({
            prompt: '자연스럽게 다듬어줘',
            adjust: {strength: 'LIGHT', rebuild: true, requests: [{kind: 'KNOB', knob: 'CLUSTERING', value: 1}]},
            doc: {rows: [{lastCells: ['D', 'E', 'O']}, {lastCells: ['D', 'E', 'O']}]},
        });

        const history = screen.getByRole('log').textContent ?? '';

        expect(history).toContain('aiAdjust.preparation.editPrevious');
        expect(history.indexOf('aiAdjust.understood')).toBeLessThan(history.indexOf('aiAdjust.preparation.previous'));
    });

    it('waits for a reply after returning from previous-month entry even when the current schedule is empty', async () => {
        seedEditor(makeEmptyDoc());
        mocks.previousBlank = true;
        mocks.requestAiSchedule.mockImplementation(async () => okResult(FIRST_FILL_CELLS, 'GENERATE'));

        const user = userEvent.setup();
        const view = render(<AiAutofill />);

        await user.click(screen.getByRole('button', {name: 'auto fill'}));
        await user.click(screen.getByRole('button', {name: 'aiAdjust.preparation.editPrevious'}));
        mocks.previousBlank = false;
        act(() => useShiftEditorStore.getState().setDoc({...useShiftEditorStore.getState().doc}));
        view.rerender(<AiAutofill />);
        await user.click(screen.getByRole('button', {name: 'auto fill'}));
        expect(screen.getByText('aiAdjust.preparation.previousReady')).toBeVisible();
        expect(mocks.requestAiSchedule).not.toHaveBeenCalled();
        await user.click(screen.getByRole('button', {name: 'aiAdjust.preparation.next'}));
        await waitFor(() => expect(mocks.requestAiSchedule).toHaveBeenCalledOnce());
        expect(screen.queryByRole('region', {name: DECISION_TITLE})).not.toBeInTheDocument();
    });

    it('reopens successful results for changes after closing and after reloading', async () => {
        const user = userEvent.setup();
        const view = render(<AiAutofill />);

        await completeFirstFill(user);
        await user.click(screen.getByRole('button', {name: 'aiAdjust.close'}));
        await user.click(screen.getByRole('button', {name: 'auto fill'}));
        expect(screen.getByRole('button', {name: 'aiAdjust.chat.modify'})).toBeVisible();
        expect(screen.queryByRole('region', {name: DECISION_TITLE})).not.toBeInTheDocument();
        expect(mocks.requestAiSchedule).toHaveBeenCalledTimes(1);
        view.unmount();
        render(<AiAutofill />);
        await user.click(screen.getByRole('button', {name: 'auto fill'}));
        expect(screen.getByRole('button', {name: 'aiAdjust.chat.modify'})).toBeVisible();
        expect(screen.queryByRole('region', {name: DECISION_TITLE})).not.toBeInTheDocument();
        expect(mocks.requestAiSchedule).toHaveBeenCalledTimes(1);
    });

    it('opens the existing confirmation flow from the last post-generation choice', async () => {
        storeRequest({
            kind: 'RULE',
            templateCode: 'MAX_CONSECUTIVE_SHIFT',
            params: {target: 'ALL', shift: 'D', count: 4},
            displayLabel: 'day max 4',
            origin: 'TEXT',
        });

        const user = userEvent.setup();

        render(<AiAutofill />);
        await completeFirstFill(user);

        const confirm = await screen.findByRole('button', {name: 'aiAdjust.chat.confirmSchedule'});

        expect(confirm.parentElement?.lastElementChild).toBe(confirm);
        expect(confirm.previousElementSibling).toBe(screen.getByRole('button', {name: 'aiAdjust.chat.modify'}));
        expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
        await user.click(confirm);
        expect(screen.queryByRole('dialog', {name: ADJUST_DIALOG_TITLE})).not.toBeInTheDocument();
        expect(await screen.findByRole('dialog', {name: 'page.makeShift.aiRefill.adjust.promote.title'})).toBeVisible();
        expect(mocks.requestAiSchedule).toHaveBeenCalledTimes(1);
    });

    it('keeps preparation replies and completed runs in one conversation until starting a new chat', async () => {
        const user = userEvent.setup();
        render(<AiAutofill />);
        mocks.requestAiSchedule.mockImplementation(async () => okResult(FIRST_FILL_CELLS, 'GENERATE'));

        await user.click(screen.getByRole('button', {name: 'auto fill'}));
        await user.click(screen.getByRole('button', {name: 'aiAdjust.preparation.fill'}));
        await screen.findByText('aiAdjust.generationCompleted');

        const log = screen.getByRole('log');

        expect(log.textContent).toMatch(/aiAdjust.preparation.fixed[\s\S]*aiAdjust.preparation.fill[\s\S]*aiAdjust.generationCompleted/);
        expect(screen.queryByRole('button', {name: 'aiAdjust.preparation.fixAll'})).not.toBeInTheDocument();
        expect(screen.queryByRole('button', {name: 'aiAdjust.preparation.fill'})).not.toBeInTheDocument();

        await user.click(screen.getByRole('button', {name: 'aiAdjust.close'}));
        await openAdjustDialog(user);
        expect(screen.getByText('aiAdjust.preparation.fill')).toBeVisible();
        await user.click(screen.getByRole('button', {name: 'aiAdjust.chat.regenerate'}));
        expect(screen.getAllByText('aiAdjust.preparation.fixed')).toHaveLength(2);
        expect(screen.getAllByText('aiAdjust.generationCompleted')).toHaveLength(1);
        await user.click(screen.getByRole('button', {name: 'aiAdjust.preparation.fill'}));
        await waitFor(() => expect(screen.getAllByText('aiAdjust.generationCompleted')).toHaveLength(2));
        expect(screen.getByRole('log').textContent).toMatch(
            /aiAdjust.generationCompleted[\s\S]*aiAdjust.chat.regenerate[\s\S]*aiAdjust.preparation.fixed[\s\S]*aiAdjust.preparation.fill[\s\S]*aiAdjust.generationCompleted/,
        );
        expect(screen.getAllByText('aiAdjust.preparation.fill')).toHaveLength(2);
        expect(mocks.requestAiSchedule).toHaveBeenCalledTimes(2);

        await user.click(screen.getByRole('button', {name: 'aiAdjust.chat.restart'}));
        expect(screen.queryByRole('log')).not.toBeInTheDocument();
        expect(screen.queryByText('aiAdjust.preparation.fill')).not.toBeInTheDocument();
        expect(screen.queryByText('aiAdjust.generationCompleted')).not.toBeInTheDocument();
        expect(mocks.requestAiSchedule).toHaveBeenCalledTimes(2);
    });

    it('resets local guidance when moving to another schedule month', async () => {
        const user = userEvent.setup();
        const {rerender} = render(<AiAutofill />);

        await completeFirstFill(user);
        expect(screen.getByText('aiAdjust.generationCompleted')).toBeInTheDocument();

        mocks.month = 8;
        rerender(<AiAutofill />);
        expect(screen.queryByRole('dialog', {name: ADJUST_DIALOG_TITLE})).not.toBeInTheDocument();
        await openAdjustDialog(user);
        expect(screen.queryByText('aiAdjust.generationCompleted')).not.toBeInTheDocument();
    });

    it('keeps the chips hidden when the server has not opened adjust for this account', async () => {
        // 서버가 사람 단위로 막은 계정. 프론트는 호스트로 짐작하지 않고 이 값만 본다.
        vi.stubEnv('VITE_AI_ADJUST_ENABLED', '');
        act(() => {
            useShiftEditorStore.getState().setAutofillAdjustEnabled(false);
        });

        const user = userEvent.setup();

        render(<AiAutofill />);

        mocks.requestAiSchedule.mockImplementation(async () => okResult(FIRST_FILL_CELLS, 'GENERATE'));

        await user.click(screen.getByRole('button', {name: 'auto fill'}));
        await screen.findByRole('region', {name: DECISION_TITLE});
        await user.click(screen.getByRole('button', {name: DECISION_CONFIRM}));
        await waitFor(() => expect(mocks.requestAiSchedule).toHaveBeenCalledTimes(1));

        // 수정 권한이 없는 계정도 다시 채우기 전에 고정할 근무를 확인한다.
        await user.click(screen.getByRole('button', {name: 'auto fill'}));
        await user.click(screen.getByRole('button', {name: DECISION_CONFIRM}));

        await waitFor(() => expect(mocks.requestAiSchedule).toHaveBeenCalledTimes(2));
        await waitFor(() => expect(screen.queryByRole('dialog', {name: ADJUST_DIALOG_TITLE})).not.toBeInTheDocument());
        expect(screen.getByText(ADJUST_DIALOG_TITLE).closest('[role="dialog"]')).toHaveAttribute('aria-hidden', 'true');
        expect(screen.getByText(ADJUST_DIALOG_TITLE).closest('[role="dialog"]')).toHaveAttribute('inert');
        expect(screen.queryByText('aiAdjust.generationCompleted')).not.toBeInTheDocument();
        expect(screen.queryByRole('button', {name: 'adjust shifts'})).not.toBeInTheDocument();
        expect(screen.queryByRole('button', {name: 'regenerate schedule'})).not.toBeInTheDocument();
    });

    it('shows the chips on the server flag alone, with no local override', async () => {
        vi.stubEnv('VITE_AI_ADJUST_ENABLED', '');
        act(() => {
            useShiftEditorStore.getState().setAutofillAdjustEnabled(true);
        });

        const user = userEvent.setup();

        render(<AiAutofill />);

        await completeFirstFill(user);
        await openAdjustDialog(user);

        expect(screen.getByText('aiAdjust.generationCompleted')).toBeInTheDocument();
    });

    it('rebuilds with the requested knob and protects only fixed and requested cells', async () => {
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

        mocks.requestAiSchedule.mockImplementation(adjustResultSavingRequests([]));

        await adjustBySentence(user, [CLUSTER_ITEM]);

        await waitFor(() => expect(mocks.requestAiSchedule).toHaveBeenCalledTimes(2));

        const payload = mocks.requestAiSchedule.mock.calls[1]?.[0];

        // 문장 한 줄이 이번 달 요청 한 건이 된다. 서버가 저장한 뒤 ACTIVE 전부를 합산한다.
        expect(payload.adjust).toEqual({
            strength: 'NORMAL',
            rebuild: true,
            requests: [
                {
                    kind: 'KNOB',
                    knob: 'CLUSTERING',
                    value: 1,
                    lifetime: 'MONTH',
                    origin: 'TEXT',
                    displayLabel: 'cluster',
                    requestText: '근무를 몰아서',
                },
            ],
        });
        await waitFor(() => expect(mocks.getScheduleMonthRequests).toHaveBeenCalled());
        expect(payload.lockedCellKeys).toEqual(expect.arrayContaining(['10:2026-07-01', '10:2026-07-02']));
        expect(payload.lockedCellKeys).not.toContain('11:2026-07-03');
        expect(payload.lockedCellKeys).not.toContain('11:2026-07-04');
    });

    it('reports only cells actually changed in the draft and skips fixed cells', async () => {
        const user = userEvent.setup();

        render(<AiAutofill />);

        await completeFirstFill(user);

        // 응답의 changedCells 를 그대로 센다 — 서버가 이미 고정·신청 칸을 걸러 낸 "적용된 칸"이고,
        // 어드민 이력의 변경 칸 수도 같은 값이다. 두 숫자가 갈리면 같은 조절을 두 크기로 말하게 된다.
        // 여기 mock 은 서버가 거르지 못한 고정 칸까지 섞어, 표에는 그 칸이 반영되지 않는 것도 함께 본다.
        mocks.requestAiSchedule.mockImplementation(
            adjustResultSavingRequests([cell(10, '2026-07-01', 'N'), cell(11, '2026-07-01', 'D'), cell(11, '2026-07-02', 'E')]),
        );

        await adjustBySentence(user, [CLUSTER_ITEM]);

        expect(await screen.findByText(`page.makeShift.aiRefill.adjust.applied {"count":2}`)).toBeInTheDocument();
        expect(rowCells('10')).toEqual(['D', 'E', 'D', 'E']);
        expect(rowCells('11')).toEqual(['D', 'E', 'E', 'E']);
    });

    it('shows a non-blocking notice when this month adjustment overrides a stored ward rule', async () => {
        const user = userEvent.setup();

        render(<AiAutofill />);
        await completeFirstFill(user);

        mocks.requestAiSchedule.mockImplementation(async () =>
            okResult([], 'ADJUST', [
                {
                    type: 'MONTH_REQUEST_OVERRIDES_WARD_RULE',
                    requestId: 21,
                    relatedRuleId: 8,
                    message: "이번 달 조절이 기존 '월 나이트 최대 4회' 조건보다 우선 적용돼요. 기존 제약조건은 변경되지 않아요.",
                },
            ]),
        );

        await adjustBySentence(user, [CLUSTER_ITEM]);

        expect((await screen.findAllByText(/기존 제약조건은 변경되지 않아요/)).length).toBeGreaterThan(0);
    });

    it('restores the pre-adjust schedule with a single undo', async () => {
        const user = userEvent.setup();

        render(<AiAutofill />);

        await completeFirstFill(user);

        const beforeAdjust = rowCells('11');

        mocks.requestAiSchedule.mockImplementation(adjustResultSavingRequests([cell(11, '2026-07-01', 'D'), cell(11, '2026-07-02', 'E')]));

        await adjustBySentence(user, [CLUSTER_ITEM]);

        await waitFor(() => expect(rowCells('11')).toEqual(['D', 'E', 'E', 'E']));

        await user.click(screen.getByRole('button', {name: 'undo'}));

        expect(rowCells('11')).toEqual(beforeAdjust);
    });

    it('rehydrates an applied goal candidate after refresh so it can be safely undone', async () => {
        // 후보 적용 결과는 확정 전이라 서버 근무표에 아직 없을 수 있다. 새로고침 뒤에는
        // immutable changed/revert 셀로 후보 출력만 다시 올린 뒤, 서버 hash 검증을 거쳐 undo한다.
        window.localStorage.setItem(GOAL_CANDIDATE_STORAGE_KEY, JSON.stringify({candidateId: 'candidate-1'}));
        mocks.getScheduleGoalCandidate.mockResolvedValue(appliedGoalCandidateDetail());
        mocks.undoScheduleGoalCandidate.mockResolvedValue({
            ...appliedGoalCandidateDetail(),
            candidate: {...appliedGoalCandidateDetail().candidate, applicationStatus: 'UNDONE'},
        });

        const user = userEvent.setup();

        render(<AiAutofill />);

        await waitFor(() => expect(mocks.getScheduleGoalCandidate).toHaveBeenCalled());
        expect(window.localStorage.getItem(GOAL_CANDIDATE_STORAGE_KEY)).not.toBeNull();
        await waitFor(() => expect(rowCells('11')?.[0]).toBe('D'));
        await user.click(screen.getByRole('button', {name: 'undo'}));

        await waitFor(() => expect(mocks.undoScheduleGoalCandidate).toHaveBeenCalledTimes(1));
        expect(rowCells('11')?.[0]).toBe('N');
        expect(window.localStorage.getItem(GOAL_CANDIDATE_STORAGE_KEY)).toBeNull();
    });

    it('rejects goal-candidate undo after manual edits and preserves the edited cell', async () => {
        const edited = makeDoc();

        edited.rows[1] = {...edited.rows[1]!, cells: ['O', 'D', 'E', 'E']};
        seedEditor(edited);
        window.localStorage.setItem(GOAL_CANDIDATE_STORAGE_KEY, JSON.stringify({candidateId: 'candidate-1'}));
        mocks.getScheduleGoalCandidate.mockResolvedValue(appliedGoalCandidateDetail());
        mocks.undoScheduleGoalCandidate.mockRejectedValue(new Error('candidate result is stale'));

        const user = userEvent.setup();

        render(<AiAutofill />);

        await waitFor(() => expect(mocks.getScheduleGoalCandidate).toHaveBeenCalled());
        await user.click(screen.getByRole('button', {name: 'undo'}));

        await waitFor(() => expect(mocks.undoScheduleGoalCandidate).toHaveBeenCalledTimes(1));
        expect(rowCells('11')?.[0]).toBe('O');
    });

    it('leaves the table untouched when the adjust request is rejected', async () => {
        const user = userEvent.setup();

        render(<AiAutofill />);

        await completeFirstFill(user);

        mocks.requestAiSchedule.mockImplementation(async () => ({ok: false, message: 'rejected'}));

        await adjustBySentence(user, [CLUSTER_ITEM]);

        await waitFor(() => expect(mocks.requestAiSchedule).toHaveBeenCalledTimes(2));
        expect(rowCells('11')).toEqual(['N', 'D', 'E', 'E']);
        // Keep the explanation in chat; the table only links back to it after the sheet closes.
        expect(await screen.findByRole('dialog', {name: ADJUST_DIALOG_TITLE})).toBeInTheDocument();
        expect(screen.getByRole('alert')).toHaveTextContent('rejected');
        await user.click(screen.getByRole('button', {name: 'aiAdjust.close'}));
        expect(screen.getByText('aiAdjust.executionFailure.summary')).toBeVisible();
        await user.click(screen.getByRole('button', {name: 'aiAdjust.executionFailure.openChat'}));
        expect(screen.getByRole('alert')).toHaveTextContent('rejected');
    });

    it.each(['solver_result_failed_final_gate', 'solver_result_validation_unavailable'])(
        'keeps preparation before the failed result and recovers from %s without losing history',
        async (reason) => {
            const user = userEvent.setup();

            render(<AiAutofill />);
            await completeFirstFill(user);

            const originalDoc = useShiftEditorStore.getState().doc;
            const rejected = okResult([cell(11, '2026-07-01', 'O')], 'ADJUST');

            mocks.requestAiSchedule.mockResolvedValueOnce({
                ...rejected,
                response: {
                    ...rejected.response,
                    engineResult: {status: 'REJECTED', solver: {reason}},
                    applicable: false,
                    unmetInstructions: ['승인 조건을 충족하지 못한 근무표 후보를 검토용으로 반환합니다.'],
                },
            });
            await adjustBySentence(user, [CLUSTER_ITEM]);

            const failure = await screen.findByRole('alert');
            const message = failure.textContent!;
            const log = screen.getByRole('log').textContent!;

            expect(message).toContain('기존 근무표는 그대로예요.');
            expect(log.lastIndexOf('aiAdjust.preparation.fill')).toBeLessThan(log.indexOf(message));
            expect(log).not.toContain('검토용');
            expect(screen.queryByRole('button', {name: CARD_APPLY})).not.toBeInTheDocument();
            expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
            expect(useShiftEditorStore.getState().doc).toBe(originalDoc);

            if (reason === 'solver_result_failed_final_gate') {
                expect(screen.queryByRole('button', {name: 'aiAdjust.failure.retry'})).not.toBeInTheDocument();
                await user.click(screen.getByRole('button', {name: 'aiAdjust.executionFailure.review'}));
                expect(screen.queryByRole('dialog', {name: ADJUST_DIALOG_TITLE})).not.toBeInTheDocument();
                await user.click(screen.getByRole('button', {name: 'aiAdjust.executionFailure.openChat'}));
                await user.click(screen.getByRole('button', {name: 'aiAdjust.issue.edit'}));
                expect(screen.getByRole('textbox')).toHaveValue('');
                expect(screen.getByRole('textbox')).toHaveFocus();
                expect(screen.getByRole('log').textContent).toContain(message);
                expect(mocks.requestAiSchedule).toHaveBeenCalledTimes(2);
            } else {
                mocks.requestAiSchedule.mockImplementation(async () => okResult([cell(11, '2026-07-01', 'O')], 'ADJUST'));
                await user.click(screen.getByRole('button', {name: 'aiAdjust.failure.retry'}));
                await screen.findByRole('region', {name: DECISION_TITLE});
                expect(mocks.requestAiSchedule).toHaveBeenCalledTimes(2);
                await finishAdjustmentPreparation(user);
                await waitFor(() => expect(rowCells('11')?.[0]).toBe('O'));
                expect(mocks.requestAiSchedule.mock.calls[2]?.[0].idempotencyKey).not.toBe(mocks.requestAiSchedule.mock.calls[1]?.[0].idempotencyKey);
                expect(screen.getByRole('log').textContent).toContain(message);
                expect(screen.getByRole('log').textContent).toMatch(/aiAdjust.failure.retry[\s\S]*aiAdjust.preparation.fixed[\s\S]*aiAdjust.preparation.fill[\s\S]*aiAdjust.completed/);
            }
        },
    );

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

        mocks.interpretScheduleAdjust.mockResolvedValue({items: [CLUSTER_ITEM], unmapped: [], strength: 'NORMAL'});
        await openModification(user);
        await user.type(screen.getByRole('textbox', {name: TEXT_INPUT_LABEL}), '근무를 몰아서');
        await user.click(screen.getByRole('button', {name: TEXT_SUBMIT}));
        await screen.findByText('aiAdjust.understood');
        await answerDefaultQuestions(user);
        await user.click(screen.getByRole('button', {name: CARD_APPLY}));
        await finishAdjustmentPreparation(user);
        await waitFor(() => expect(mocks.requestAiSchedule).toHaveBeenCalledTimes(2));

        mocks.month = 8;
        rerender(<AiAutofill />);

        await act(async () => {
            resolveAdjust?.(okResult([cell(11, '2026-07-01', 'D')], 'ADJUST'));
        });

        expect(rowCells('11')).toEqual(beforeAdjust);
    });

    it('keeps the requests when the schedule is generated again', async () => {
        const user = userEvent.setup();

        render(<AiAutofill />);

        await completeFirstFill(user);

        mocks.requestAiSchedule.mockImplementation(adjustResultSavingRequests([cell(11, '2026-07-01', 'D')]));

        await adjustBySentence(user, [CLUSTER_ITEM]);

        await waitFor(() => expect(mocks.monthRequests).toHaveLength(1));
        expect(screen.getByText(`page.makeShift.aiRefill.adjust.applied {"count":1}`)).toBeInTheDocument();

        // 조절 대화상자 다음에는, 손으로 고친 칸이 없어도 현재 근무 중 고정할 것을 고르는
        // 단계를 한 번 보여 준다. 이 단계를 건너뛰면 조절 기능을 켠 사용자만 고정 기회를 잃는다.
        mocks.requestAiSchedule.mockImplementation(async () => okResult(FIRST_FILL_CELLS, 'GENERATE'));

        await openAdjustDialog(user);
        await user.click(screen.getByRole('button', {name: 'aiAdjust.chat.restart'}));
        await user.click(screen.getByRole('button', {name: 'aiAdjust.chat.regenerate'}));

        await screen.findByRole('region', {name: DECISION_TITLE});
        expect(mocks.requestAiSchedule).toHaveBeenCalledTimes(2);
        await user.click(screen.getByRole('button', {name: DECISION_CONFIRM}));
        await waitFor(() => expect(mocks.requestAiSchedule).toHaveBeenCalledTimes(3));
        expect(mocks.requestAiSchedule.mock.calls[2]![0].adjust).toBeUndefined();
        expect(screen.getByRole('dialog', {name: ADJUST_DIALOG_TITLE})).toBeVisible();
        await openAdjustDialog(user);
        expect(screen.getByRole('button', {name: 'aiAdjust.chat.regenerate'})).toBeInTheDocument();
        // 요청은 서버 상태라 재생성해도 남는다. 바뀐 칸 수만 지난 조절의 것이라 지운다.
        expect(mocks.monthRequests.filter((request) => request.status === 'ACTIVE')).toHaveLength(1);
        expect(screen.queryByText(/aiRefill\.adjust\.applied/)).not.toBeInTheDocument();
    });

    it('lists a stored request on entry so the user sees what is already hanging', async () => {
        // 요청은 서버 상태다. 새로고침하고 들어와도 목록에 그대로 있어야 "내가 건 것이
        // 반영된 표인가"를 사용자가 판단할 수 있다.
        storeRequest({kind: 'KNOB', knob: 'OFF_BALANCE', value: 1, origin: 'TEXT', displayLabel: 'fair off', requestText: 'x'});

        const user = userEvent.setup();

        render(<AiAutofill />);

        // 채우기 전이라도 조절 버튼으로 이미 저장된 요청을 확인할 수 있다.
        await openModification(user);

        await user.click(await screen.findByRole('button', {name: /savedRequests\.titleCount \{"count":1\}/}));

        expect(screen.getByText('fair off')).toBeInTheDocument();
        expect(mocks.requestAiSchedule).not.toHaveBeenCalled();
    });

    it('removes a request from the month list without autofilling', async () => {
        storeRequest({kind: 'KNOB', knob: 'OFF_BALANCE', value: 1, origin: 'TEXT', displayLabel: 'fair off', requestText: 'x'});

        const user = userEvent.setup();

        render(<AiAutofill />);

        await openModification(user);

        await user.click(await screen.findByRole('button', {name: /savedRequests\.titleCount \{"count":1\}/}));
        expect(screen.getByText('fair off')).toBeInTheDocument();

        await user.click(screen.getByRole('button', {name: 'aiAdjust.savedRequests.removeLabel {"label":"fair off"}'}));

        await waitFor(() => expect(mocks.updateScheduleMonthRequest).toHaveBeenCalledWith(1, 10, 1, {status: 'DISABLED'}));
        expect(mocks.requestAiSchedule).not.toHaveBeenCalled();
        await waitFor(() => expect(screen.queryByText('fair off')).not.toBeInTheDocument());
        expect(screen.getByRole('dialog', {name: ADJUST_DIALOG_TITLE})).toBeInTheDocument();
    });

    it('interprets a sentence and applies the card as TEXT requests with the chosen lifetime', async () => {
        const user = userEvent.setup();

        render(<AiAutofill />);

        await completeFirstFill(user);

        mocks.interpretScheduleAdjust.mockResolvedValue({
            items: [
                {kind: 'KNOB', knob: 'CLUSTERING', value: 1, displayLabel: 'fair off', lifetimeHint: 'TEAM'},
                {
                    kind: 'RULE',
                    templateCode: 'MAX_CONSECUTIVE_SHIFT',
                    params: {target: 'ALL', shift: 'D', count: 4},
                    severity: 'SOFT',
                    displayLabel: 'day max 4',
                },
            ],
            llmPrompt: '전체 흐름은 자연스럽게 다듬어줘',
            unmapped: [{text: 'weekends please', hint: '주말 공평은 아직 안 돼요. 이렇게 써 보세요: 주말 근무는 3번 이하로'}],
            strength: 'NORMAL',
        });

        await openModification(user);
        await user.type(screen.getByRole('textbox', {name: 'page.makeShift.aiRefill.adjust.textInput.label'}), 'fair off please');
        await user.click(screen.getByRole('button', {name: 'aiAdjust.send'}));

        expect(await screen.findByText('aiAdjust.issue.partialTitle')).toBeInTheDocument();
        expect(mocks.interpretScheduleAdjust).toHaveBeenCalledWith(
            1,
            10,
            expect.objectContaining({text: 'fair off please', year: 2026, month: 7}),
        );
        // unmapped 는 취소선이 아니라 고쳐 쓸 문장이다. 사용자의 말이 틀린 것이 아니라 아직 못 하는 것이다.
        expect(screen.getByText('주말 공평은 아직 안 돼요. 이렇게 써 보세요: 주말 근무는 3번 이하로')).toBeInTheDocument();
        expect(screen.queryByText(/aiAdjust.template/)).not.toBeInTheDocument();
        await user.click(screen.getByText('aiAdjust.review.details'));
        expect(screen.getByText('aiAdjust.review.consecutiveDays')).toBeVisible();

        // 해석이 "계속"으로 제안한 TEAM을 카드에서 확인할 수 있다.
        await user.click(screen.getByRole('button', {name: 'aiAdjust.issue.partialConfirm'}));
        await user.click(screen.getByRole('button', {name: 'aiAdjust.savedRequests.lifetime.TEAM'}));

        mocks.requestAiSchedule.mockImplementation(adjustResultSavingRequests([cell(11, '2026-07-01', 'D')]));

        await answerDefaultQuestions(user);
        await user.click(screen.getByRole('button', {name: 'aiAdjust.issue.partialApply'}));
        await finishAdjustmentPreparation(user);

        await waitFor(() => expect(mocks.requestAiSchedule).toHaveBeenCalledTimes(2));
        expect(mocks.requestAiSchedule.mock.calls[1]?.[0].adjust).toEqual({
            strength: 'NORMAL',
            rebuild: true,
            requests: [
                {
                    kind: 'KNOB',
                    knob: 'CLUSTERING',
                    value: 1,
                    displayLabel: 'fair off',
                    lifetime: 'TEAM',
                    origin: 'TEXT',
                    requestText: 'fair off please',
                },
                {
                    // 지속 표현이 없는 RULE은 이번 달로 유지된다.
                    kind: 'RULE',
                    templateCode: 'MAX_CONSECUTIVE_SHIFT',
                    params: {target: 'ALL', shift: 'D', count: 4},
                    severity: 'SOFT',
                    displayLabel: 'day max 4',
                    lifetime: 'MONTH',
                    origin: 'TEXT',
                    requestText: 'fair off please',
                },
            ],
        });
        expect(mocks.requestAiSchedule.mock.calls[1]?.[0].prompt).toBe('전체 흐름은 자연스럽게 다듬어줘');
        await waitFor(() => expect(mocks.monthRequests).toHaveLength(2));
        expect(screen.getByText('aiAdjust.issue.partialTitle')).toBeInTheDocument();
        await user.click(await screen.findByRole('button', {name: 'aiAdjust.confirmSchedule'}));
        expect(screen.queryByRole('dialog', {name: ADJUST_DIALOG_TITLE})).not.toBeInTheDocument();
        expect(await screen.findByRole('dialog', {name: 'page.makeShift.aiRefill.adjust.promote.title'})).toBeVisible();
    });

    it('applies a pure residual sentence through ADJUST even when there are no structured cards', async () => {
        const user = userEvent.setup();

        render(<AiAutofill />);

        await completeFirstFill(user);

        mocks.interpretScheduleAdjust.mockResolvedValue({
            items: [],
            llmPrompt: '전체 흐름만 자연스럽게 다듬어줘',
            unmapped: [],
            strength: 'LIGHT',
        });
        mocks.requestAiSchedule.mockImplementation(async () => okResult([], 'ADJUST'));

        await openModification(user);
        await user.type(screen.getByRole('textbox', {name: TEXT_INPUT_LABEL}), '전체 흐름만 자연스럽게 다듬어줘');
        await user.click(screen.getByRole('button', {name: TEXT_SUBMIT}));

        expect(await screen.findByRole('region', {name: 'aiAdjust.understood'})).toHaveTextContent('전체 흐름만 자연스럽게 다듬어줘');
        expect(screen.getByRole('button', {name: CARD_APPLY})).toBeEnabled();

        await answerDefaultQuestions(user);
        await user.click(screen.getByRole('button', {name: CARD_APPLY}));
        await finishAdjustmentPreparation(user);

        await waitFor(() => expect(mocks.requestAiSchedule).toHaveBeenCalledTimes(2));
        expect(mocks.requestAiSchedule.mock.calls[1]?.[0]).toMatchObject({
            adjust: {strength: 'LIGHT'},
            prompt: '전체 흐름만 자연스럽게 다듬어줘',
        });
    });

    it('writes a named cell into the table and pins it instead of sending it as a month request', async () => {
        // "김OO 쌤 15일은 오프 줘" 는 규칙이 아니라 표의 한 자리다. 이번 달 요청으로 보내면
        // 서버가 거절하고, 저장된다 해도 재생성 때마다 한 칸짜리 지정이 되살아난다.
        const user = userEvent.setup();

        render(<AiAutofill />);

        await completeFirstFill(user);

        mocks.interpretScheduleAdjust.mockResolvedValue({
            items: [{kind: 'CELL', nurseId: 911, date: '2026-07-03', shiftCode: 'O', displayLabel: 'Lee 3일 오프'}],
            unmapped: [],
            strength: 'NORMAL',
        });

        await openModification(user);
        await user.type(screen.getByRole('textbox', {name: 'page.makeShift.aiRefill.adjust.textInput.label'}), 'Lee 3일은 오프 줘');
        await user.click(screen.getByRole('button', {name: 'aiAdjust.send'}));

        expect(await screen.findByText('aiAdjust.understood')).toBeInTheDocument();

        mocks.requestAiSchedule.mockImplementation(async () => okResult([], 'ADJUST'));
        const callsBefore = mocks.requestAiSchedule.mock.calls.length;

        await answerDefaultQuestions(user);
        await user.click(screen.getByRole('button', {name: 'aiAdjust.chat.applyReply'}));
        await finishAdjustmentPreparation(user);

        await waitFor(() => {
            const {doc} = useShiftEditorStore.getState();

            expect(doc.rows[1]?.cells[2]).toBe('O');
        });
        // 고정까지 해야 다음 조절이 그 칸을 다시 옮기지 않는다.
        expect(useShiftEditorStore.getState().doc.fixedCells['11|2026-07-03']).toBe(true);
        // Explicit cells are included in the staged seed and locked, never stored as month requests.
        expect(mocks.requestAiSchedule).toHaveBeenCalledTimes(callsBefore + 1);
        expect(mocks.requestAiSchedule.mock.calls[callsBefore]?.[0].adjust.requests).toEqual([]);
        expect(mocks.requestAiSchedule.mock.calls[callsBefore]?.[0].lockedCellKeys).toContain('11:2026-07-03');
        await user.click(screen.getByRole('button', {name: 'aiAdjust.undo'}));
        expect(rowCells('11')?.[2]).toBe('E');
        expect(useShiftEditorStore.getState().doc.fixedCells['11|2026-07-03']).toBeUndefined();
    });

    it('preserves explicit cells and retries the same failed action with the same idempotency key', async () => {
        const user = userEvent.setup();
        render(<AiAutofill />);
        await completeFirstFill(user);
        const originalDoc = useShiftEditorStore.getState().doc;
        mocks.requestAiSchedule.mockResolvedValueOnce({ok: false, message: 'network failed'});
        await adjustBySentence(user, [{kind: 'CELL', nurseId: 911, date: '2026-07-03', shiftCode: 'O'}], 'Lee 3일은 오프 줘');
        await screen.findByRole('button', {name: 'aiAdjust.failure.retry'});
        expect(useShiftEditorStore.getState().doc).toBe(originalDoc);
        expect(mocks.requestAiSchedule.mock.calls[1]?.[0].doc.rows[1].cells[2]).toBe('O');
        mocks.requestAiSchedule.mockImplementation(async () => okResult([], 'ADJUST'));
        await user.click(screen.getByRole('button', {name: 'aiAdjust.failure.retry'}));
        await finishAdjustmentPreparation(user);
        await waitFor(() => expect(rowCells('11')?.[2]).toBe('O'));
        expect(mocks.requestAiSchedule.mock.calls[2]?.[0].idempotencyKey).toBe(mocks.requestAiSchedule.mock.calls[1]?.[0].idempotencyKey);
    });

    it('does not apply a non-ADJUST response to a confirmed adjustment', async () => {
        const user = userEvent.setup();

        render(<AiAutofill />);
        await completeFirstFill(user);
        const originalDoc = useShiftEditorStore.getState().doc;
        mocks.requestAiSchedule.mockImplementation(async () => okResult([cell(11, '2026-07-01', 'D')], 'GENERATE'));
        await adjustBySentence(user, [CLUSTER_ITEM]);
        await screen.findByText('aiAdjust.unexpectedOperation');
        expect(useShiftEditorStore.getState().doc).toBe(originalDoc);
    });

    it('requires another confirmation if stored ACTIVE requests changed after interpretation', async () => {
        const user = userEvent.setup();

        render(<AiAutofill />);
        await completeFirstFill(user);
        mocks.interpretScheduleAdjust.mockResolvedValue({items: [CLUSTER_ITEM], unmapped: []});
        await openModification(user);
        await user.type(screen.getByRole('textbox', {name: TEXT_INPUT_LABEL}), '근무를 몰아서');
        await user.click(screen.getByRole('button', {name: TEXT_SUBMIT}));
        await screen.findByText('aiAdjust.understood');
        storeRequest({kind: 'KNOB', knob: 'OFF_BALANCE', value: 1, displayLabel: '다른 창에서 추가한 요청'});
        await answerDefaultQuestions(user);
        await user.click(screen.getByRole('button', {name: CARD_APPLY}));
        await finishAdjustmentPreparation(user);
        await screen.findByText('aiAdjust.requestsChanged');
        expect(mocks.requestAiSchedule).toHaveBeenCalledTimes(1);
        expect(screen.getByText(/다른 창에서 추가한 요청/)).toBeVisible();
    });

    it('marks a number the interpreter had to choose so the user can see it before accepting', async () => {
        const user = userEvent.setup();

        render(<AiAutofill />);

        await completeFirstFill(user);

        mocks.interpretScheduleAdjust.mockResolvedValue({
            items: [
                {
                    kind: 'RULE',
                    templateCode: 'MAX_CONSECUTIVE_SHIFT',
                    params: {target: 'ALL', shift: 'D', count: 4},
                    severity: 'SOFT',
                    displayLabel: 'D 연속 4일까지',
                    assumedSlots: ['count'],
                },
            ],
            unmapped: [],
            strength: 'STRONG',
        });

        await openModification(user);
        await user.type(screen.getByRole('textbox', {name: 'page.makeShift.aiRefill.adjust.textInput.label'}), '데이는 너무 길지 않게');
        await user.click(screen.getByRole('button', {name: 'aiAdjust.send'}));

        expect(await screen.findByText('aiAdjust.understood')).toBeInTheDocument();
        // 배지에 우리가 고른 값이 함께 보여야 한다 — "기본값"만으로는 무엇이 4인지 알 수 없다.
        expect(screen.getByText(/aiAdjust\.review\.suggestion.*consecutiveDays.*4/)).toBeInTheDocument();

        await answerDefaultQuestions(user);
        await user.click(screen.getByRole('button', {name: 'aiAdjust.chat.applyReply'}));
        await finishAdjustmentPreparation(user);

        await waitFor(() => expect(mocks.requestAiSchedule).toHaveBeenCalledTimes(2));
        expect(mocks.requestAiSchedule.mock.calls[1]?.[0].adjust).toMatchObject({
            strength: 'STRONG',
            requests: [{assumedSlots: ['count']}],
        });
    });

    it('lets the sentence box be edited without the editor key bindings eating Backspace, arrows or shift keys', async () => {
        const user = userEvent.setup();

        render(<AiAutofill />);

        await completeFirstFill(user);
        await openModification(user);

        const textarea = screen.getByRole('textbox', {name: 'page.makeShift.aiRefill.adjust.textInput.label'});

        // 문장 입력창은 에디터 루트(onKeyDown) 안에 놓여 있다. Backspace 는 셀 지우기가 아니라 글자 지우기,
        // 방향키는 셀 이동이 아니라 캐럿 이동, d 는 근무 D 입력이 아니라 글자여야 한다.
        await user.type(textarea, 'day off');
        expect(textarea).toHaveValue('day off');

        await user.keyboard('{Backspace}');
        expect(textarea).toHaveValue('day of');

        await user.keyboard('{ArrowLeft}d');
        expect(textarea).toHaveValue('day odf');

        await user.keyboard('{Delete}');
        expect(textarea).toHaveValue('day od');
    });

    it('shows the empty hint when nothing could be interpreted and does not allow applying', async () => {
        const user = userEvent.setup();

        render(<AiAutofill />);

        await completeFirstFill(user);

        mocks.interpretScheduleAdjust.mockResolvedValue({
            items: [],
            unmapped: [{text: 'hmm', hint: '숫자를 넣어 써 보세요: 데이는 4일 연속까지만'}],
        });

        await openModification(user);
        await user.type(screen.getByRole('textbox', {name: TEXT_INPUT_LABEL}), 'hmm');
        await user.click(screen.getByRole('button', {name: TEXT_SUBMIT}));

        expect(await screen.findByText('숫자를 넣어 써 보세요: 데이는 4일 연속까지만')).toBeInTheDocument();
        expect(screen.queryByRole('button', {name: CARD_APPLY})).not.toBeInTheDocument();

        expect(screen.getByRole('textbox', {name: TEXT_INPUT_LABEL})).toBeEnabled();
        expect(mocks.requestAiSchedule).toHaveBeenCalledTimes(1);
    });

    it('fills the box from an example instead of running it', async () => {
        // 칩과의 결정적 차이다. 예시는 출발점이지 명령이 아니다.
        const user = userEvent.setup();

        render(<AiAutofill />);

        await completeFirstFill(user);
        await openAdjustDialog(user);

        await user.click(screen.getByRole('button', {name: 'aiAdjust.chat.modify'}));
        await user.click(screen.getByRole('button', {name: CLUSTER_ON_EXAMPLE}));

        expect(screen.getByRole('textbox', {name: TEXT_INPUT_LABEL})).toHaveValue(CLUSTER_ON_EXAMPLE);
        expect(mocks.requestAiSchedule).toHaveBeenCalledTimes(1);
    });

    it('offers a stronger re-run when a month rule is still unmet', async () => {
        const user = userEvent.setup();

        render(<AiAutofill />);

        await completeFirstFill(user);

        mocks.requestAiSchedule.mockImplementation(async (payload: {adjust?: {requests?: TScheduleMonthRequestItem[]}}) => {
            const result = await adjustResultSavingRequests([cell(11, '2026-07-01', 'D')])(payload);

            return {
                ...result,
                response: {
                    ...result.response,
                    requestRuleResults: [{requestId: 1, displayLabel: 'day max 4', violationCount: 2}],
                },
            };
        });

        await adjustBySentence(user, [CLUSTER_ITEM]);

        // 잔여 위반이 "12칸 바꿨어요"보다 먼저다 — 사용자가 다음에 할 일을 그것이 정한다.
        expect(await screen.findByText('page.makeShift.aiRefill.adjust.remaining {"label":"day max 4","count":2}')).toBeInTheDocument();

        await user.click(screen.getByRole('button', {name: 'page.makeShift.aiRefill.adjust.remainingAction'}));

        await waitFor(() => expect(mocks.requestAiSchedule).toHaveBeenCalledTimes(3));
        expect(mocks.requestAiSchedule.mock.calls[2]?.[0].adjust).toEqual({strength: 'STRONG'});
    });

    describe('carry-over conversation', () => {
        const CARRY_OVER_TITLE = 'aiAdjust.carryOver.title';

        beforeEach(() => {
            mocks.getScheduleCarryOverCandidates.mockResolvedValue({
                sourceYear: 2026,
                sourceMonth: 6,
                requests: [
                    {
                        id: 91,
                        kind: 'KNOB',
                        lifetime: 'MONTH',
                        status: 'ACTIVE',
                        origin: 'CHIP',
                        displayLabel: 'june fair off',
                        knob: 'OFF_BALANCE',
                        value: 1,
                    },
                    {
                        id: 92,
                        kind: 'KNOB',
                        lifetime: 'MONTH',
                        status: 'ACTIVE',
                        origin: 'TEXT',
                        displayLabel: 'june cluster',
                        knob: 'CLUSTERING',
                        value: 1,
                    },
                ],
            });
        });

        it('opens the selection in chat only after autofill starts and records just the selected requests', async () => {
            const user = userEvent.setup();

            render(<AiAutofill />);
            await waitFor(() => expect(mocks.getScheduleCarryOverCandidates).toHaveBeenCalledWith(1, 10, 2026, 7));
            expect(screen.queryByRole('region', {name: CARRY_OVER_TITLE})).not.toBeInTheDocument();
            await user.click(screen.getByRole('button', {name: 'auto fill'}));

            const card = await screen.findByRole('region', {name: CARRY_OVER_TITLE});

            expect(card.closest('[role="dialog"]')).not.toBeNull();
            expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
            expect(screen.getByRole('checkbox', {name: 'june fair off'})).toBeChecked();
            expect(screen.getByRole('checkbox', {name: 'june cluster'})).toBeChecked();
            await user.click(screen.getByRole('checkbox', {name: 'june cluster'}));
            await user.click(screen.getByRole('button', {name: 'aiAdjust.carryOver.confirm'}));
            await waitFor(() =>
                expect(mocks.carryOverScheduleMonthRequests).toHaveBeenCalledWith(1, 10, {year: 2026, month: 7, requestIds: [91]}),
            );
            await waitFor(() => expect(card).not.toBeInTheDocument());
            expect(screen.getByRole('log').textContent).toContain('june fair off');
            expect(screen.getByRole('log').textContent).not.toContain('june cluster');
            expect(screen.getByRole('region', {name: DECISION_TITLE})).toBeVisible();
            expect(mocks.requestAiSchedule).not.toHaveBeenCalled();
        });

        it('skips carry-over without adding chat messages when every request is unavailable', async () => {
            mocks.getScheduleCarryOverCandidates.mockResolvedValue({
                sourceYear: 2026,
                sourceMonth: 6,
                requests: [
                    {
                        id: 93,
                        kind: 'RULE',
                        lifetime: 'MONTH',
                        status: 'ACTIVE',
                        origin: 'TEXT',
                        displayLabel: '신규 간호사 2 6월 초반 5일(1일~5일) 나이트 제외',
                        templateCode: 'SHIFT_COUNT',
                        params: {},
                    },
                ],
            });

            const user = userEvent.setup();

            render(<AiAutofill />);
            await user.click(screen.getByRole('button', {name: 'auto fill'}));
            expect(await screen.findByRole('region', {name: DECISION_TITLE})).toBeVisible();
            expect(screen.queryByRole('region', {name: CARRY_OVER_TITLE})).not.toBeInTheDocument();
            expect(screen.queryByText('aiAdjust.carryOver.question')).not.toBeInTheDocument();
            expect(screen.queryByText('aiAdjust.carryOver.thisMonth')).not.toBeInTheDocument();
            expect(screen.queryByText('aiAdjust.carryOver.skip')).not.toBeInTheDocument();
            expect(mocks.carryOverScheduleMonthRequests).not.toHaveBeenCalled();
            expect(mocks.requestAiSchedule).not.toHaveBeenCalled();
        });

        it('keeps checked items when closed and reopened, and can skip with no items selected', async () => {
            const user = userEvent.setup();
            const {unmount} = render(<AiAutofill />);

            await user.click(screen.getByRole('button', {name: 'auto fill'}));
            await screen.findByRole('region', {name: CARRY_OVER_TITLE});
            await user.click(screen.getByRole('checkbox', {name: 'june cluster'}));
            await user.click(screen.getByRole('button', {name: 'aiAdjust.close'}));
            await user.click(screen.getByRole('button', {name: 'auto fill'}));
            expect(await screen.findByRole('checkbox', {name: 'june fair off'})).toBeChecked();
            expect(screen.getByRole('checkbox', {name: 'june cluster'})).not.toBeChecked();
            expect(screen.getAllByText('aiAdjust.carryOver.question')).toHaveLength(1);
            await user.click(screen.getByRole('checkbox', {name: 'june fair off'}));
            await user.click(screen.getByRole('button', {name: 'aiAdjust.carryOver.skip'}));
            await screen.findByRole('region', {name: DECISION_TITLE});
            expect(mocks.carryOverScheduleMonthRequests).not.toHaveBeenCalled();
            expect(screen.getByRole('log').textContent).toContain('aiAdjust.carryOver.skip');
            unmount();
            window.sessionStorage.clear();
            mocks.getScheduleCarryOverCandidates.mockClear();
            render(<AiAutofill />);
            await user.click(screen.getByRole('button', {name: 'auto fill'}));
            await screen.findByRole('region', {name: DECISION_TITLE});
            expect(mocks.getScheduleCarryOverCandidates).not.toHaveBeenCalled();
        });

        it('waits for a slow candidate response instead of skipping it', async () => {
            let resolve!: (value: unknown) => void;

            mocks.getScheduleCarryOverCandidates.mockImplementation(
                () =>
                    new Promise((done) => {
                        resolve = done;
                    }),
            );

            const user = userEvent.setup();

            render(<AiAutofill />);
            await user.click(screen.getByRole('button', {name: 'auto fill'}));
            expect(await screen.findByRole('status', {name: 'aiAdjust.carryOver.loading'})).toBeInTheDocument();
            expect(screen.queryByRole('region', {name: DECISION_TITLE})).not.toBeInTheDocument();
            expect(mocks.requestAiSchedule).not.toHaveBeenCalled();
            await act(async () =>
                resolve({
                    sourceYear: 2026,
                    sourceMonth: 6,
                    requests: [
                        {
                            id: 95,
                            kind: 'KNOB',
                            lifetime: 'MONTH',
                            status: 'ACTIVE',
                            origin: 'TEXT',
                            displayLabel: 'slow request',
                            knob: 'OFF_BALANCE',
                            value: 1,
                        },
                    ],
                }),
            );
            expect(await screen.findByRole('checkbox', {name: 'slow request'})).toBeChecked();
        });

        it('keeps the selection after a failed save and retries without starting generation', async () => {
            mocks.carryOverScheduleMonthRequests.mockRejectedValueOnce(new Error('offline')).mockResolvedValue([]);

            const user = userEvent.setup();

            render(<AiAutofill />);
            await user.click(screen.getByRole('button', {name: 'auto fill'}));
            await screen.findByRole('region', {name: CARRY_OVER_TITLE});
            await user.click(screen.getByRole('checkbox', {name: 'june cluster'}));
            await user.click(screen.getByRole('button', {name: 'aiAdjust.carryOver.confirm'}));
            expect(await screen.findByRole('alert')).toHaveTextContent('aiAdjust.carryOver.failed');
            expect(screen.getByRole('checkbox', {name: 'june fair off'})).toBeChecked();
            expect(screen.getByRole('checkbox', {name: 'june cluster'})).not.toBeChecked();
            await user.click(screen.getByRole('button', {name: 'aiAdjust.carryOver.confirm'}));
            await screen.findByRole('region', {name: DECISION_TITLE});
            expect(mocks.carryOverScheduleMonthRequests).toHaveBeenCalledTimes(2);
            expect(mocks.requestAiSchedule).not.toHaveBeenCalled();
        });

        it('keeps a completed import paused if the sheet was closed while saving', async () => {
            let resolve!: (value: unknown[]) => void;

            mocks.carryOverScheduleMonthRequests.mockImplementation(
                () =>
                    new Promise((done) => {
                        resolve = done;
                    }),
            );

            const user = userEvent.setup();

            render(<AiAutofill />);
            await user.click(screen.getByRole('button', {name: 'auto fill'}));
            await screen.findByRole('region', {name: CARRY_OVER_TITLE});
            await user.click(screen.getByRole('button', {name: 'aiAdjust.carryOver.confirm'}));
            await user.click(screen.getByRole('button', {name: 'aiAdjust.close'}));
            await act(async () => resolve([]));
            expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
            expect(mocks.requestAiSchedule).not.toHaveBeenCalled();
            await user.click(screen.getByRole('button', {name: 'auto fill'}));
            await screen.findByRole('region', {name: DECISION_TITLE});
            expect(screen.getByRole('log').textContent).toContain('june fair off');
        });

        it('returns to entry while a confirmed import finishes without resuming the old preparation', async () => {
            let resolve!: (value: unknown[]) => void;
            mocks.carryOverScheduleMonthRequests.mockImplementation(() => new Promise((done) => { resolve = done; }));
            const user = userEvent.setup();
            render(<AiAutofill />);
            await user.click(screen.getByRole('button', {name: 'auto fill'}));
            await screen.findByRole('region', {name: CARRY_OVER_TITLE});
            await user.click(screen.getByRole('button', {name: 'aiAdjust.carryOver.confirm'}));
            await user.click(screen.getByRole('button', {name: 'aiAdjust.chat.restart'}));
            expect(screen.getByText(ADJUST_TITLE)).toBeVisible();
            expect(screen.queryByRole('region', {name: CARRY_OVER_TITLE})).not.toBeInTheDocument();
            expect(screen.getByRole('button', {name: 'aiAdjust.chat.regenerate'})).toBeDisabled();
            await act(async () => resolve([]));

            expect(screen.getByRole('button', {name: 'aiAdjust.chat.regenerate'})).toBeEnabled();
            expect(screen.queryByRole('region', {name: DECISION_TITLE})).not.toBeInTheDocument();
            expect(screen.queryByRole('log')).not.toBeInTheDocument();
            expect(mocks.requestAiSchedule).not.toHaveBeenCalled();
            await user.click(screen.getByRole('button', {name: 'aiAdjust.chat.regenerate'}));
            expect(await screen.findByRole('region', {name: CARRY_OVER_TITLE})).toBeVisible();
        });

        it('ignores an import response after leaving the page', async () => {
            let resolve!: (value: unknown[]) => void;
            mocks.carryOverScheduleMonthRequests.mockImplementation(() => new Promise((done) => { resolve = done; }));
            const user = userEvent.setup();
            const view = render(<AiAutofill />);
            await user.click(screen.getByRole('button', {name: 'auto fill'}));
            await screen.findByRole('region', {name: CARRY_OVER_TITLE});
            await user.click(screen.getByRole('button', {name: 'aiAdjust.carryOver.confirm'}));
            const reads = mocks.getScheduleMonthRequests.mock.calls.length;
            view.unmount();
            await act(async () => resolve([]));
            expect(mocks.getScheduleMonthRequests).toHaveBeenCalledTimes(reads);
            expect(mocks.requestAiSchedule).not.toHaveBeenCalled();
        });

        it('shows a retry and an explicit skip when loading candidates fails', async () => {
            mocks.getScheduleCarryOverCandidates.mockRejectedValue(new Error('offline'));

            const user = userEvent.setup();

            render(<AiAutofill />);
            await user.click(screen.getByRole('button', {name: 'auto fill'}));
            expect(await screen.findByRole('alert')).toHaveTextContent('aiAdjust.carryOver.loadFailed');
            expect(screen.getByRole('button', {name: 'aiAdjust.failure.retry'})).toBeEnabled();
            await user.click(screen.getByRole('button', {name: 'aiAdjust.carryOver.skip'}));
            await screen.findByRole('region', {name: DECISION_TITLE});
            expect(mocks.carryOverScheduleMonthRequests).not.toHaveBeenCalled();
        });
    });
});
