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

describe('AiAutofill adjust chips', () => {
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

    it('hides the adjust chips until the first autofill succeeds', async () => {
        const user = userEvent.setup();

        render(<AiAutofill />);

        expect(screen.queryByText(ADJUST_TITLE)).not.toBeInTheDocument();

        await completeFirstFill(user);

        expect(screen.getByText(ADJUST_TITLE)).toBeInTheDocument();
        expect(screen.getByRole('button', {name: OFF_BALANCE_CHIP})).toHaveAttribute('aria-pressed', 'false');
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

        mocks.requestAiSchedule.mockImplementation(adjustResultSavingRequests([]));

        await user.click(screen.getByRole('button', {name: OFF_BALANCE_CHIP}));

        await waitFor(() => expect(mocks.requestAiSchedule).toHaveBeenCalledTimes(2));

        const payload = mocks.requestAiSchedule.mock.calls[1]?.[0];

        // 칩은 이번 달 요청 한 건이 된다. 서버가 저장한 뒤 ACTIVE 전부를 합산한다.
        expect(payload.adjust).toEqual({
            strength: 'NORMAL',
            requests: [{kind: 'KNOB', knob: 'OFF_BALANCE', value: 1, lifetime: 'MONTH', origin: 'CHIP', displayLabel: OFF_BALANCE_CHIP}],
        });
        // 낙관적 상태가 걷힌 뒤에도 서버 목록이 칩을 켜 둔다.
        await waitFor(() => expect(mocks.getScheduleMonthRequests).toHaveBeenCalled());
        expect(screen.getByRole('button', {name: OFF_BALANCE_CHIP})).toHaveAttribute('aria-pressed', 'true');
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

        await user.click(screen.getByRole('button', {name: OFF_BALANCE_CHIP}));

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

    it('keeps the requests (and the chips) when the schedule is generated again', async () => {
        const user = userEvent.setup();

        render(<AiAutofill />);

        await completeFirstFill(user);

        mocks.requestAiSchedule.mockImplementation(adjustResultSavingRequests([cell(11, '2026-07-01', 'D')]));

        await user.click(screen.getByRole('button', {name: OFF_BALANCE_CHIP}));

        await waitFor(() => expect(screen.getByRole('button', {name: OFF_BALANCE_CHIP})).toHaveAttribute('aria-pressed', 'true'));
        expect(screen.getByText(`page.makeShift.aiRefill.adjust.applied {"count":1}`)).toBeInTheDocument();

        // 조절 직후에는 손으로 고친 칸이 없으므로 재생성은 확인 다이얼로그 없이 바로 돈다.
        mocks.requestAiSchedule.mockImplementation(async () => okResult(FIRST_FILL_CELLS, 'GENERATE'));

        await user.click(screen.getByRole('button', {name: 'auto fill'}));

        await waitFor(() => expect(mocks.requestAiSchedule).toHaveBeenCalledTimes(3));
        // 요청은 서버 상태라 재생성해도 남는다. 바뀐 칸 수만 지난 조절의 것이라 지운다.
        expect(screen.getByRole('button', {name: OFF_BALANCE_CHIP})).toHaveAttribute('aria-pressed', 'true');
        expect(screen.queryByText(/aiRefill\.adjust\.applied/)).not.toBeInTheDocument();
    });

    it('turns a chip off by disabling its request and re-adjusting without new requests', async () => {
        const user = userEvent.setup();

        render(<AiAutofill />);

        await completeFirstFill(user);

        mocks.requestAiSchedule.mockImplementation(adjustResultSavingRequests([cell(11, '2026-07-01', 'D')]));

        await user.click(screen.getByRole('button', {name: OFF_BALANCE_CHIP}));
        await waitFor(() => expect(screen.getByRole('button', {name: OFF_BALANCE_CHIP})).toHaveAttribute('aria-pressed', 'true'));
        await waitFor(() => expect(mocks.monthRequests).toHaveLength(1));

        mocks.requestAiSchedule.mockImplementation(adjustResultSavingRequests([cell(11, '2026-07-01', 'N')]));

        await user.click(screen.getByRole('button', {name: OFF_BALANCE_CHIP}));

        await waitFor(() => expect(mocks.updateScheduleMonthRequest).toHaveBeenCalledWith(1, 10, 1, {status: 'DISABLED'}));
        await waitFor(() => expect(mocks.requestAiSchedule).toHaveBeenCalledTimes(3));

        // 마지막 칩을 꺼도 다시 푼다 — 그래야 표가 조절된 채로 남지 않는다.
        const payload = mocks.requestAiSchedule.mock.calls[2]?.[0];

        expect(payload.adjust).toEqual({strength: 'NORMAL'});
        await waitFor(() => expect(screen.getByRole('button', {name: OFF_BALANCE_CHIP})).toHaveAttribute('aria-pressed', 'false'));
    });

    it('restores chip state from the server list on entry', async () => {
        storeRequest({kind: 'KNOB', knob: 'CLUSTERING', value: 1, origin: 'CHIP', displayLabel: 'cluster'});

        const user = userEvent.setup();

        render(<AiAutofill />);

        await completeFirstFill(user);

        await waitFor(() => expect(screen.getByRole('button', {name: CLUSTER_ON_CHIP})).toHaveAttribute('aria-pressed', 'true'));
        expect(screen.getByRole('button', {name: OFF_BALANCE_CHIP})).toHaveAttribute('aria-pressed', 'false');
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
                {kind: 'KNOB', knob: 'OFF_BALANCE', value: 1, displayLabel: 'fair off', lifetimeHint: 'TEAM'},
                {kind: 'RULE', nurseId: 5, displayLabel: 'Kim no nights'},
            ],
            unmapped: [{text: 'weekends please', hint: 'no weekend axis'}],
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
        expect(screen.getByText('weekends please')).toBeInTheDocument();
        expect(screen.getByText('no weekend axis', {exact: false})).toBeInTheDocument();
        expect(screen.getByText('page.makeShift.aiRefill.adjust.card.ruleNote')).toBeInTheDocument();

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
                    knob: 'OFF_BALANCE',
                    value: 1,
                    displayLabel: 'fair off',
                    lifetime: 'TEAM',
                    origin: 'TEXT',
                    requestText: 'fair off please',
                },
            ],
        });
        await waitFor(() => expect(screen.getByRole('button', {name: OFF_BALANCE_CHIP})).toHaveAttribute('aria-pressed', 'true'));
        expect(screen.queryByText('page.makeShift.aiRefill.adjust.card.title')).not.toBeInTheDocument();
    });

    it('shows the empty hint when nothing could be interpreted and does not allow applying', async () => {
        const user = userEvent.setup();

        render(<AiAutofill />);

        await completeFirstFill(user);

        mocks.interpretScheduleAdjust.mockResolvedValue({items: [], unmapped: [{text: 'hmm', hint: null}]});

        await user.type(screen.getByRole('textbox', {name: 'page.makeShift.aiRefill.adjust.textInput.label'}), 'hmm');
        await user.click(screen.getByRole('button', {name: 'page.makeShift.aiRefill.adjust.textInput.submit'}));

        expect(await screen.findByText('page.makeShift.aiRefill.adjust.card.empty')).toBeInTheDocument();
        expect(screen.getByRole('button', {name: 'page.makeShift.aiRefill.adjust.card.apply'})).toBeDisabled();

        await user.click(screen.getByRole('button', {name: 'page.makeShift.aiRefill.adjust.card.cancel'}));

        expect(screen.queryByText('page.makeShift.aiRefill.adjust.card.empty')).not.toBeInTheDocument();
        expect(mocks.requestAiSchedule).toHaveBeenCalledTimes(1);
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

            await waitFor(() => expect(mocks.getScheduleMonthRequests).not.toHaveBeenCalled());
            expect(mocks.getScheduleCarryOverCandidates).not.toHaveBeenCalled();
            expect(screen.queryByRole('region', {name: CARRY_OVER_TITLE})).not.toBeInTheDocument();
        });
    });
});
