import type {TScheduleMonthRequestItem, TScheduleMonthRequestRes, TSnapshotCellDTO} from '@dutying/api/ward';
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
    setStepNavigationBusy: vi.fn(),
    moveScheduleRow: vi.fn(),
    month: 7,
    shift: {
        days: [],
        wardShiftTypes: [],
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
}));

vi.mock('@/shared/api/ward', () => ({
    default: {
        getScheduleMonthRequests: mocks.getScheduleMonthRequests,
        updateScheduleMonthRequest: mocks.updateScheduleMonthRequest,
        getScheduleCarryOverCandidates: mocks.getScheduleCarryOverCandidates,
        carryOverScheduleMonthRequests: mocks.carryOverScheduleMonthRequests,
        interpretScheduleAdjust: mocks.interpretScheduleAdjust,
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
const CLUSTER_ON_EXAMPLE = 'page.makeShift.aiRefill.adjust.examples.clusterOn';
const TEXT_INPUT_LABEL = 'page.makeShift.aiRefill.adjust.textInput.label';
const TEXT_SUBMIT = 'page.makeShift.aiRefill.adjust.textInput.submit';
const CARD_APPLY = 'page.makeShift.aiRefill.adjust.card.apply';
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

/** 아직 아무것도 채우지 않은 표. 조절 패널이 닫혀 있어야 하는 유일한 상태다. */
function makeEmptyDoc(): TDutyDoc {
    return {
        columns: ['2026-07-01', '2026-07-02', '2026-07-03', '2026-07-04'],
        rows: [
            {workerId: '10', cells: [null, null, null, null]},
            {workerId: '11', cells: [null, null, null, null]},
        ],
        workerMeta: {'10': {name: 'Kim'}, '11': {name: 'Lee'}},
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
}

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

/**
 * 문장으로 조절을 건다. 칩(즉시 토글)이 사라진 뒤로 조절을 시작하는 경로는 이것 하나다 —
 * 예시를 누르면 입력창이 채워질 뿐이고, 실행은 사용자가 "조절"을 눌러야 일어난다.
 */
async function adjustBySentence(user: ReturnType<typeof userEvent.setup>, items: TScheduleMonthRequestItem[], sentence = '근무를 몰아서') {
    mocks.interpretScheduleAdjust.mockResolvedValue({items, unmapped: [], strength: 'NORMAL'});

    await user.type(screen.getByRole('textbox', {name: TEXT_INPUT_LABEL}), sentence);
    await user.click(screen.getByRole('button', {name: TEXT_SUBMIT}));
    await screen.findByText('page.makeShift.aiRefill.adjust.card.title');
    await user.click(screen.getByRole('button', {name: CARD_APPLY}));
}

const CLUSTER_ITEM: TScheduleMonthRequestItem = {
    kind: 'KNOB',
    knob: 'CLUSTERING',
    value: 1,
    displayLabel: 'cluster',
};

describe('AiAutofill adjust panel', () => {
    beforeEach(() => {
        mocks.requestAiSchedule.mockReset();
        mocks.setStepNavigationBusy.mockReset();
        mocks.moveScheduleRow.mockReset();
        mocks.month = 7;
        vi.stubEnv('VITE_AI_ADJUST_ENABLED', 'true');
        window.sessionStorage.clear();
        installRequestStore();
        seedEditor();
    });

    // 게이트 테스트가 override 와 서버 플래그를 비운 채 실패해도 다음 테스트로 번지지 않도록 여기서 되돌린다.
    afterEach(() => {
        vi.stubEnv('VITE_AI_ADJUST_ENABLED', 'true');
        useShiftEditorStore.getState().setAutofillAdjustEnabled(false);
    });

    it('hides the adjust panel while the table is empty and nothing is requested', async () => {
        seedEditor(makeEmptyDoc());

        const user = userEvent.setup();

        render(<AiAutofill />);

        expect(screen.queryByText(ADJUST_TITLE)).not.toBeInTheDocument();

        // 빈 표에서는 덮어쓸 것이 없어 확인 대화상자 없이 바로 채운다.
        mocks.requestAiSchedule.mockImplementation(async () => okResult(FIRST_FILL_CELLS, 'GENERATE'));
        await user.click(screen.getByRole('button', {name: 'auto fill'}));

        await screen.findByText(ADJUST_TITLE);
        expect(screen.getByRole('button', {name: CLUSTER_ON_EXAMPLE})).toBeInTheDocument();
    });

    it('keeps the adjust panel open when the user comes back to a filled table', async () => {
        // 회귀: 패널이 "이번 세션에서 자동 채우기를 했는지"에만 걸려 있어, 나갔다 들어오면 이미 걸어 둔
        // 요청이 화면에서 사라졌다. 서버는 그 요청을 다음 자동 채우기에 그대로 싣는데도.
        storeRequest({kind: 'KNOB', knob: 'CLUSTERING', value: 1, origin: 'CHIP', displayLabel: 'cluster'});

        render(<AiAutofill />);

        expect(screen.getByText(ADJUST_TITLE)).toBeInTheDocument();
        await waitFor(() => expect(screen.getByRole('button', {name: /adjust\.requests\.title \{"count":1\}/})).toBeInTheDocument());
        expect(mocks.requestAiSchedule).not.toHaveBeenCalled();
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
        await screen.findByRole('dialog', {name: DECISION_TITLE});
        await user.click(screen.getByRole('button', {name: DECISION_CONFIRM}));
        await waitFor(() => expect(mocks.requestAiSchedule).toHaveBeenCalledTimes(1));

        expect(screen.queryByText(ADJUST_TITLE)).not.toBeInTheDocument();
    });

    it('shows the chips on the server flag alone, with no local override', async () => {
        vi.stubEnv('VITE_AI_ADJUST_ENABLED', '');
        act(() => {
            useShiftEditorStore.getState().setAutofillAdjustEnabled(true);
        });

        const user = userEvent.setup();

        render(<AiAutofill />);

        await completeFirstFill(user);

        expect(screen.getByText(ADJUST_TITLE)).toBeInTheDocument();
    });

    it('sends the requested knob and locks fixed, requested and hand-edited cells together', async () => {
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
        expect(payload.lockedCellKeys).toEqual(expect.arrayContaining(['10:2026-07-01', '10:2026-07-02', '11:2026-07-04']));
        expect(payload.lockedCellKeys).not.toContain('11:2026-07-03');
    });

    it('reports the changed-cell count the server applied, and still skips fixed cells locally', async () => {
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

        expect(await screen.findByText(`page.makeShift.aiRefill.adjust.applied {"count":3}`)).toBeInTheDocument();
        expect(rowCells('10')).toEqual(['D', 'E', 'D', 'E']);
        expect(rowCells('11')).toEqual(['D', 'E', 'E', 'E']);
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

    it('leaves the table untouched when the adjust request is rejected', async () => {
        const user = userEvent.setup();

        render(<AiAutofill />);

        await completeFirstFill(user);

        mocks.requestAiSchedule.mockImplementation(async () => ({ok: false, message: 'rejected'}));

        await adjustBySentence(user, [CLUSTER_ITEM]);

        await waitFor(() => expect(mocks.requestAiSchedule).toHaveBeenCalledTimes(2));
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

        mocks.interpretScheduleAdjust.mockResolvedValue({items: [CLUSTER_ITEM], unmapped: [], strength: 'NORMAL'});
        await user.type(screen.getByRole('textbox', {name: TEXT_INPUT_LABEL}), '근무를 몰아서');
        await user.click(screen.getByRole('button', {name: TEXT_SUBMIT}));
        await screen.findByText('page.makeShift.aiRefill.adjust.card.title');
        await user.click(screen.getByRole('button', {name: CARD_APPLY}));
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

        // 조절 직후에는 손으로 고친 칸이 없으므로 재생성은 확인 다이얼로그 없이 바로 돈다.
        mocks.requestAiSchedule.mockImplementation(async () => okResult(FIRST_FILL_CELLS, 'GENERATE'));

        await user.click(screen.getByRole('button', {name: 'auto fill'}));

        await waitFor(() => expect(mocks.requestAiSchedule).toHaveBeenCalledTimes(3));
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

        await completeFirstFill(user);

        await user.click(await screen.findByRole('button', {name: /adjust\.requests\.title \{"count":1\}/}));

        expect(screen.getByText('fair off')).toBeInTheDocument();
    });

    it('removes a request from the month list and re-adjusts', async () => {
        storeRequest({kind: 'KNOB', knob: 'OFF_BALANCE', value: 1, origin: 'TEXT', displayLabel: 'fair off', requestText: 'x'});

        const user = userEvent.setup();

        render(<AiAutofill />);

        await completeFirstFill(user);

        await user.click(await screen.findByRole('button', {name: /adjust\.requests\.title \{"count":1\}/}));
        expect(screen.getByText('page.makeShift.aiRefill.adjust.requests.persistNote')).toBeInTheDocument();
        expect(screen.getByText('fair off')).toBeInTheDocument();

        mocks.requestAiSchedule.mockImplementation(adjustResultSavingRequests([]));

        await user.click(screen.getByRole('button', {name: 'page.makeShift.aiRefill.adjust.requests.remove {"label":"fair off"}'}));

        await waitFor(() => expect(mocks.updateScheduleMonthRequest).toHaveBeenCalledWith(1, 10, 1, {status: 'DISABLED'}));
        await waitFor(() => expect(mocks.requestAiSchedule).toHaveBeenCalledTimes(2));
        expect(mocks.requestAiSchedule.mock.calls[1]?.[0].adjust).toEqual({strength: 'NORMAL'});
        await waitFor(() => expect(screen.queryByText('fair off')).not.toBeInTheDocument());
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
            unmapped: [{text: 'weekends please', hint: '주말 공평은 아직 안 돼요. 이렇게 써 보세요: 주말 근무는 3번 이하로'}],
            strength: 'NORMAL',
        });

        await user.type(screen.getByRole('textbox', {name: 'page.makeShift.aiRefill.adjust.textInput.label'}), 'fair off please');
        await user.click(screen.getByRole('button', {name: 'page.makeShift.aiRefill.adjust.textInput.submit'}));

        expect(await screen.findByText('page.makeShift.aiRefill.adjust.card.title')).toBeInTheDocument();
        expect(mocks.interpretScheduleAdjust).toHaveBeenCalledWith(
            1,
            10,
            expect.objectContaining({text: 'fair off please', year: 2026, month: 7}),
        );
        // unmapped 는 취소선이 아니라 고쳐 쓸 문장이다. 사용자의 말이 틀린 것이 아니라 아직 못 하는 것이다.
        expect(screen.getByText('주말 공평은 아직 안 돼요. 이렇게 써 보세요: 주말 근무는 3번 이하로')).toBeInTheDocument();
        expect(screen.getByText('page.makeShift.aiRefill.adjust.monthRuleBadge')).toBeInTheDocument();

        // 기본 수명은 MONTH. 사용자가 "계속"으로 바꾼 것만 TEAM 으로 나간다.
        const lifetimeSelect = screen.getByRole('combobox', {
            name: 'page.makeShift.aiRefill.adjust.card.lifetimeLabel {"label":"fair off"}',
        });

        expect(lifetimeSelect).toHaveValue('MONTH');
        await user.selectOptions(lifetimeSelect, 'TEAM');

        mocks.requestAiSchedule.mockImplementation(adjustResultSavingRequests([cell(11, '2026-07-01', 'D')]));

        await user.click(screen.getByRole('button', {name: 'page.makeShift.aiRefill.adjust.card.apply'}));

        await waitFor(() => expect(mocks.requestAiSchedule).toHaveBeenCalledTimes(2));
        expect(mocks.requestAiSchedule.mock.calls[1]?.[0].adjust).toEqual({
            strength: 'NORMAL',
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
                    // RULE 도 함께 나간다(5단계). 이번 달에만 걸리는 제약조건이고 수명은 언제나 MONTH 다 —
                    // "계속"은 확정 시 승격으로만 간다.
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
        await waitFor(() => expect(mocks.monthRequests).toHaveLength(2));
        expect(screen.queryByText('page.makeShift.aiRefill.adjust.card.title')).not.toBeInTheDocument();
    });

    it('lets the sentence box be edited without the editor key bindings eating Backspace, arrows or shift keys', async () => {
        const user = userEvent.setup();

        render(<AiAutofill />);

        await completeFirstFill(user);

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

        await user.type(screen.getByRole('textbox', {name: TEXT_INPUT_LABEL}), 'hmm');
        await user.click(screen.getByRole('button', {name: TEXT_SUBMIT}));

        expect(await screen.findByText('숫자를 넣어 써 보세요: 데이는 4일 연속까지만')).toBeInTheDocument();
        expect(screen.getByRole('button', {name: CARD_APPLY})).toBeDisabled();

        // 대안 문장 버튼이 유일한 되묻기 경로다. 누르면 입력창이 그 문장으로 채워지고
        // 사용자는 고쳐서 다시 보낸다 — 질문에 답하는 UI 는 두지 않는다.
        await user.click(screen.getByRole('button', {name: 'page.makeShift.aiRefill.adjust.useSuggestion'}));

        expect(screen.getByRole('textbox', {name: TEXT_INPUT_LABEL})).toHaveValue('데이는 4일 연속까지만');
        expect(screen.queryByText('page.makeShift.aiRefill.adjust.card.title')).not.toBeInTheDocument();
        expect(mocks.requestAiSchedule).toHaveBeenCalledTimes(1);
    });

    it('fills the box from an example instead of running it', async () => {
        // 칩과의 결정적 차이다. 예시는 출발점이지 명령이 아니다.
        const user = userEvent.setup();

        render(<AiAutofill />);

        await completeFirstFill(user);

        await user.click(screen.getByRole('button', {name: CLUSTER_ON_EXAMPLE}));

        expect(screen.getByRole('textbox', {name: TEXT_INPUT_LABEL})).toHaveValue(CLUSTER_ON_EXAMPLE);
        expect(mocks.requestAiSchedule).toHaveBeenCalledTimes(1);
    });

    it('offers a stronger re-run when a month rule is still unmet', async () => {
        const user = userEvent.setup();

        render(<AiAutofill />);

        await completeFirstFill(user);

        mocks.requestAiSchedule.mockImplementation(async (payload: {adjust?: {requests?: unknown[]}}) => {
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

    describe('carry-over card', () => {
        const CARRY_OVER_TITLE = 'page.makeShift.aiRefill.adjust.carryOver.title';

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

        it('copies only the selected requests and then hides the card', async () => {
            const user = userEvent.setup();

            render(<AiAutofill />);

            const card = await screen.findByRole('region', {name: CARRY_OVER_TITLE});

            expect(mocks.getScheduleCarryOverCandidates).toHaveBeenCalledWith(1, 10, 2026, 7);
            // 전부 미선택으로 시작한다.
            expect(screen.getByRole('button', {name: 'page.makeShift.aiRefill.adjust.carryOver.apply'})).toBeDisabled();

            const group = screen.getByRole('group', {name: 'june fair off'});

            await user.click(group.querySelector('button')!);
            await user.click(screen.getByRole('button', {name: 'page.makeShift.aiRefill.adjust.carryOver.apply'}));

            await waitFor(() =>
                expect(mocks.carryOverScheduleMonthRequests).toHaveBeenCalledWith(1, 10, {year: 2026, month: 7, requestIds: [91]}),
            );
            await waitFor(() => expect(card).not.toBeInTheDocument());
            expect(window.sessionStorage.getItem('make-shift:adjust-carry-over-answered:1:10:2026:7')).toBe('1');
        });

        it('skips without calling the server and does not ask again this session', async () => {
            const user = userEvent.setup();
            const {unmount} = render(<AiAutofill />);

            await screen.findByRole('region', {name: CARRY_OVER_TITLE});
            await user.click(screen.getByRole('button', {name: 'page.makeShift.aiRefill.adjust.carryOver.skip'}));

            expect(screen.queryByRole('region', {name: CARRY_OVER_TITLE})).not.toBeInTheDocument();
            expect(mocks.carryOverScheduleMonthRequests).not.toHaveBeenCalled();

            unmount();
            mocks.getScheduleCarryOverCandidates.mockClear();
            render(<AiAutofill />);

            // 이번 달 요청 목록은 진입할 때마다 읽는다. 그 조회가 끝난 뒤에도 되묻기는 다시 묻지 않는다.
            await waitFor(() => expect(mocks.getScheduleMonthRequests).toHaveBeenCalled());
            expect(mocks.getScheduleCarryOverCandidates).not.toHaveBeenCalled();
            expect(screen.queryByRole('region', {name: CARRY_OVER_TITLE})).not.toBeInTheDocument();
        });
    });
});
