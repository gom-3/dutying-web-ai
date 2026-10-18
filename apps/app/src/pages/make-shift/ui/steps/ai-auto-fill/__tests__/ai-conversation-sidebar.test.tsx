vi.mock('../../../../model/monthly-rest-requirement', () => ({loadMonthlyRestRequirement: vi.fn().mockResolvedValue(undefined)}));
vi.mock('../ai-conversation-image', () => ({AiConversationImage: () => null}));
import type {ComponentProps} from 'react';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import type {TShift} from '@/entities/shift';
import type * as ShiftEditorModule from '@/features/shift-editor';
import {useShiftEditorStore} from '@/features/shift-editor/model/store';
import {act, render, screen, userEvent, waitFor, within} from '@/shared/util/test-utils';
import type * as ConversationApiModule from '../../../../model/schedule-conversation-api';
import type {
    TConversationDetail,
    TConversationOperation,
    TConversationTurn,
    TResultVersion,
} from '../../../../model/schedule-conversation-api';
import AiConversationSidebar from '../ai-conversation-sidebar';

const mocks = vi.hoisted(() => ({
    list: vi.fn(),
    create: vi.fn(),
    detail: vi.fn(),
    sync: vi.fn(),
    interpret: vi.fn(),
    execute: vi.fn(),
    version: vi.fn(),
    branch: vi.fn(),
    startSegment: vi.fn(),
    preferences: vi.fn(),
    savePreference: vi.fn(),
    replacePreference: vi.fn(),
    deletePreference: vi.fn(),
    applyAdjustedDoc: vi.fn(),
    clearScheduleValidationFromApi: vi.fn(),
    confirm: vi.fn(),
    confirmPlan: vi.fn(),
    report: vi.fn(),
    draftFixed: false,
}));

vi.mock('../../../../model/schedule-conversation-api', async (original) => ({
    ...(await original<typeof ConversationApiModule>()),
    conversationApi: () => mocks,
}));
vi.mock('@/features/shift-editor', async (original) => ({
    ...(await original<typeof ShiftEditorModule>()),
    useShiftEditorCommands: () => ({
        applyAdjustedDoc: mocks.applyAdjustedDoc,
        clearScheduleValidationFromApi: mocks.clearScheduleValidationFromApi,
    }),
}));
vi.mock('@/features/shift-editor/model/schedule-authoring', () => ({
    buildAutofillDTO: () => ({
        year: 2026,
        month: 11,
        cells: [{shiftNurseId: 1, date: '2026-11-01', wardShiftTypeId: 4, fixed: mocks.draftFixed}],
        rowOrder: [],
        carryOverCells: [],
    }),
}));

const cell = {shiftNurseId: 1, date: '2026-11-01', wardShiftTypeId: 4, shiftCode: 'O', fixed: false};
const source: TResultVersion = {
    versionId: 'source:1',
    parentVersionId: null,
    year: 2026,
    month: 11,
    cells: [cell],
    rowOrder: [],
    carryOverCells: [],
    constraintsJson: '{}',
    inputDigest: 'a',
    createdAt: '2026-10-03T10:00:00',
};
const operation: TConversationOperation = {
    operationId: 'operation:1',
    sequence: 1,
    operationType: 'GENERATE',
    fillPolicy: 'EMPTY_ONLY',
    sourceVersionId: source.versionId,
    resultVersionId: 'result:1',
    interpretationId: null,
    baseRevision: 0,
    executionStatus: 'SUCCEEDED',
    applyStatus: 'APPLIED',
    failureReason: null,
    result: null,
    createdAt: '2026-10-03T10:00:00',
};
const successfulResult: NonNullable<TConversationOperation['result']> = {
    operationType: 'GENERATE',
    applicable: true,
    draftRevision: 0,
    resultType: 'PATCH',
    changedCells: [cell],
    unmetInstructions: [],
    sameAsPrevious: false,
    validation: {draftRevision: 0, rulesHash: 'rules:1', summary: {valid: true, hardCount: 0, softCount: 0, totalCount: 0}, violations: []},
};
const expectExecutionTimeScope = () => {
    expect(screen.getAllByText(/실행 시점의 작성본 기준 결과예요/).length).toBeGreaterThan(0);
    expect(screen.getByRole('complementary')).toHaveTextContent('현재 표를 확인한 뒤 별도로 확정해 주세요.');
    expect(screen.getByRole('complementary')).not.toHaveTextContent(/현재 (표|근무표)에 (반영|적용)(했|됐|되었)/);
};

let current: TConversationDetail;

const renderSidebar = (overrides: Partial<ComponentProps<typeof AiConversationSidebar>> = {}) =>
    render(
        <AiConversationSidebar
            open
            onClose={vi.fn()}
            wardId={1}
            teamId={2}
            year={2026}
            month={11}
            shift={
                {
                    lastDays: [],
                    days: [{day: 1, dayType: 'workday'}],
                    wardShiftTypes: [
                        {
                            wardShiftTypeId: 1,
                            shortName: 'D',
                            name: 'Day',
                            color: '#44c4b0',
                            isDefault: true,
                            isOff: false,
                            isCounted: true,
                            startTime: '07:00',
                            endTime: '15:00',
                            classification: 'DAY',
                        },
                        {
                            wardShiftTypeId: 4,
                            shortName: 'O',
                            name: 'Off',
                            color: '#455a7a',
                            isDefault: true,
                            isOff: true,
                            isCounted: true,
                            startTime: '',
                            endTime: '',
                            classification: 'OFF',
                        },
                    ],
                    divisionShiftNurses: [
                        [
                            {
                                shiftNurse: {
                                    shiftNurseId: 1,
                                    name: '김 간호사',
                                    nurseId: 1,
                                    isWorker: true,
                                    divisionNum: 0,
                                    priority: 0,
                                    carried: 0,
                                },
                                lastWardShiftList: [],
                                lastWardReqShiftList: [],
                                wardShiftList: [4],
                                wardReqShiftList: [null],
                            },
                        ],
                    ],
                } as TShift
            }
            adjustEnabled
            generationRequest={0}
            rebuildRequest={0}
            onApplied={vi.fn()}
            {...overrides}
        />,
    );

beforeEach(() => {
    vi.clearAllMocks();
    mocks.report.mockReset().mockResolvedValue({incidentId: 'accepted:1'});
    mocks.draftFixed = false;
    sessionStorage.clear();
    current = {
        contextHash: 'rules:1',
        activeConditionLabels: [],
        conversation: {
            conversationId: 1,
            year: 2026,
            month: 11,
            revision: 0,
            currentVersionId: source.versionId,
            latestInterpretationId: null,
            createdAt: source.createdAt,
        },
        draft: source,
        turns: [],
        operations: [operation],
    };
    useShiftEditorStore.getState().reset();
    useShiftEditorStore.getState().setDoc({
        columns: ['2026-11-01'],
        rows: [{workerId: '1', cells: ['O']}],
        workerMeta: {'1': {name: '김 간호사', nurseId: 1}},
        fixedCells: {},
        requestCells: {},
    });
    mocks.list.mockResolvedValue([current.conversation]);
    mocks.detail.mockImplementation(async () => current);
    mocks.preferences.mockResolvedValue([]);
    mocks.version.mockResolvedValue({...source, versionId: 'result:1', cells: [{...cell, wardShiftTypeId: 1, shiftCode: 'D'}]});
    mocks.execute.mockResolvedValue({...operation, executionStatus: 'FAILED', resultVersionId: null});
});
afterEach(() => {
    vi.clearAllTimers();
});

describe('persistent schedule sidebar', () => {
    it('describes server APPLIED as historical after a page refresh without claiming local application', async () => {
        current.operations = [{...operation, result: successfulResult}];
        useShiftEditorStore.getState().setDoc({...useShiftEditorStore.getState().doc, rows: [{workerId: '1', cells: ['E']}]});

        const first = renderSidebar();

        await screen.findByText(/계산 결과: 1칸 변경/);
        expectExecutionTimeScope();
        first.unmount();
        renderSidebar();
        await screen.findByText(/계산 결과: 1칸 변경/);
        expectExecutionTimeScope();
        expect(useShiftEditorStore.getState().doc.rows[0]?.cells).toEqual(['E']);
        expect(mocks.applyAdjustedDoc).not.toHaveBeenCalled();
    });
    it('keeps historical result wording when opening an earlier APPLIED result', async () => {
        current.operations = [
            {...operation, result: successfulResult},
            {...operation, operationId: 'later:2', sequence: 2},
        ];
        renderSidebar();
        await userEvent.click((await screen.findAllByRole('button', {name: '근무표 열기'}))[0]);
        await screen.findByRole('dialog');
        await userEvent.click(screen.getByRole('button', {name: '미리보기 닫기'}));
        expectExecutionTimeScope();
        expect(mocks.applyAdjustedDoc).not.toHaveBeenCalled();
        expect(useShiftEditorStore.getState().doc.rows[0]?.cells).toEqual(['O']);
    });
    it('reports the selected earlier result and returns keyboard focus after cancel', async () => {
        current.operations = [operation, {...operation, operationId: 'later:2', sequence: 2}];
        renderSidebar();

        const buttons = await screen.findAllByRole('button', {name: '이 결과에 의견 보내기'});

        await userEvent.click(buttons[0]);
        expect(screen.getByText('의견 대상: 자동채우기 1회차 결과')).toBeVisible();

        const note = screen.getByRole('textbox', {name: '예상한 조건과 다른 점을 적어 주세요.'});

        expect(note).toHaveFocus();
        await userEvent.type(note, '요청과 달라요');
        await userEvent.click(screen.getByRole('button', {name: '취소'}));
        expect(buttons[0]).toHaveFocus();
        await userEvent.click(buttons[0]);
        expect(screen.getByRole('textbox', {name: '예상한 조건과 다른 점을 적어 주세요.'})).toHaveValue('');
        await userEvent.type(screen.getByRole('textbox', {name: '예상한 조건과 다른 점을 적어 주세요.'}), '조건을 다시 확인해 주세요');
        await userEvent.click(screen.getByRole('button', {name: '의견 보내기'}));
        await waitFor(() =>
            expect(mocks.report).toHaveBeenCalledWith(1, operation.operationId, '조건을 다시 확인해 주세요', expect.any(String)),
        );
        expect(mocks.report).toHaveBeenCalledOnce();
        expect(buttons[0]).toHaveFocus();
    });
    it('reuses a report key after a lost acknowledgement and creates a new key after success', async () => {
        mocks.report.mockRejectedValueOnce(new Error('response lost')).mockResolvedValue({incidentId: 'accepted:1'});
        renderSidebar();
        await userEvent.click(await screen.findByRole('button', {name: '이 결과에 의견 보내기'}));
        await userEvent.type(screen.getByRole('textbox', {name: '예상한 조건과 다른 점을 적어 주세요.'}), '조건이 달라요');
        await userEvent.click(screen.getByRole('button', {name: '의견 보내기'}));
        await waitFor(() => expect(screen.getByRole('button', {name: '의견 보내기'})).toBeEnabled());

        const first = mocks.report.mock.calls[0];

        expect(first.slice(0, 3)).toEqual([1, operation.operationId, '조건이 달라요']);
        expect(first[3]).toMatch(/^[0-9a-f-]{36}$/i);
        expect(screen.queryByText('의견을 보냈어요. 확인해서 개선할게요.')).not.toBeInTheDocument();
        await userEvent.click(screen.getByRole('button', {name: '의견 보내기'}));
        await waitFor(() => expect(screen.queryByRole('region', {name: '결과 의견 보내기'})).not.toBeInTheDocument());
        expect(mocks.report.mock.calls[1]).toEqual(first);
        await userEvent.click(screen.getByRole('button', {name: '이 결과에 의견 보내기'}));
        await userEvent.type(screen.getByRole('textbox', {name: '예상한 조건과 다른 점을 적어 주세요.'}), '조건이 달라요');
        await userEvent.click(screen.getByRole('button', {name: '의견 보내기'}));
        await waitFor(() => expect(mocks.report).toHaveBeenCalledTimes(3));
        expect(mocks.report.mock.calls[2][3]).not.toBe(first[3]);
    });
    it('changes the report key after editing the note or choosing another operation', async () => {
        mocks.report.mockRejectedValue(new Error('response lost'));
        current.operations = [operation, {...operation, operationId: 'later:2', sequence: 2}];
        renderSidebar();

        const reportButtons = await screen.findAllByRole('button', {name: '이 결과에 의견 보내기'});

        await userEvent.click(reportButtons[0]);

        const note = screen.getByRole('textbox', {name: '예상한 조건과 다른 점을 적어 주세요.'});

        await userEvent.type(note, '첫 의견');
        await userEvent.click(screen.getByRole('button', {name: '의견 보내기'}));
        await waitFor(() => expect(note).toBeEnabled());
        await userEvent.clear(note);
        await userEvent.type(note, '다른 의견');
        await userEvent.click(screen.getByRole('button', {name: '의견 보내기'}));
        await waitFor(() => expect(note).toBeEnabled());
        await userEvent.click(screen.getByRole('button', {name: '취소'}));
        await userEvent.click(reportButtons[1]);
        await userEvent.type(screen.getByRole('textbox', {name: '예상한 조건과 다른 점을 적어 주세요.'}), '다른 의견');
        await userEvent.click(screen.getByRole('button', {name: '의견 보내기'}));
        await waitFor(() => expect(mocks.report).toHaveBeenCalledTimes(3));
        expect(new Set(mocks.report.mock.calls.map((call) => call[3])).size).toBe(3);
        expect(mocks.report.mock.calls[2][1]).toBe('later:2');
    });
    it('clears an unfinished report when starting a new request section', async () => {
        mocks.startSegment.mockResolvedValueOnce({...current, conversation: {...current.conversation, revision: 1}});
        renderSidebar();
        await userEvent.click(await screen.findByRole('button', {name: '이 결과에 의견 보내기'}));
        await userEvent.type(screen.getByRole('textbox', {name: '예상한 조건과 다른 점을 적어 주세요.'}), '이전 결과 의견');
        await userEvent.click(screen.getByRole('button', {name: '새 요청 시작하기'}));
        await waitFor(() => expect(screen.queryByRole('region', {name: '결과 의견 보내기'})).not.toBeInTheDocument());
        await userEvent.click(screen.getByRole('button', {name: '이 결과에 의견 보내기'}));
        expect(screen.getByRole('textbox', {name: '예상한 조건과 다른 점을 적어 주세요.'})).toHaveValue('');
        expect(mocks.report).not.toHaveBeenCalled();
    });
    it('does not move focus out of a comparison opened while writing feedback', async () => {
        renderSidebar();
        await userEvent.click(await screen.findByRole('button', {name: '이 결과에 의견 보내기'}));
        await userEvent.click(screen.getByRole('button', {name: '변경 전후 비교'}));

        const dialog = await screen.findByRole('dialog');

        await waitFor(() => expect(dialog.contains(document.activeElement)).toBe(true));
        expect(screen.getByRole('textbox', {name: '예상한 조건과 다른 점을 적어 주세요.', hidden: true})).not.toHaveFocus();
    });
    it('retains feedback on failure and prevents duplicate submissions while sending', async () => {
        let reject!: (reason: Error) => void;

        mocks.report.mockImplementationOnce(
            () =>
                new Promise((_resolve, fail) => {
                    reject = fail;
                }),
        );
        renderSidebar();
        await userEvent.click(await screen.findByRole('button', {name: '이 결과에 의견 보내기'}));

        const note = screen.getByRole('textbox', {name: '예상한 조건과 다른 점을 적어 주세요.'});

        await userEvent.type(note, '검토해 주세요');

        const send = screen.getByRole('button', {name: '의견 보내기'});

        await userEvent.click(send);
        expect(send).toBeDisabled();
        expect(screen.getByRole('button', {name: '취소'})).toBeDisabled();
        await userEvent.click(send);
        expect(mocks.report).toHaveBeenCalledOnce();
        await act(async () => reject(new Error('offline')));
        expect(note).toHaveValue('검토해 주세요');
        expect(send).toBeEnabled();
        expect(screen.getByText('의견 대상: 자동채우기 1회차 결과')).toBeVisible();
    });
    it.each(['APPLIED', 'NOT_APPLIED_SOURCE_CHANGED'])(
        'explains calculated scope separately from current draft and confirmation: %s',
        async (applyStatus) => {
            current.operations = [
                {
                    ...operation,
                    applyStatus,
                    result: {
                        operationType: 'GENERATE',
                        applicable: true,
                        draftRevision: 0,
                        resultType: 'PATCH',
                        changedCells: [cell],
                        unmetInstructions: [],
                        sameAsPrevious: false,
                        validation: {
                            draftRevision: 0,
                            rulesHash: 'rules:1',
                            summary: {valid: true, hardCount: 0, softCount: 0, totalCount: 0},
                            violations: [],
                        },
                    },
                },
            ];
            renderSidebar();

            const summary = await screen.findByText(/계산 결과: 1칸 변경/);

            expect(summary).toHaveTextContent(
                applyStatus === 'APPLIED'
                    ? '실행 시점의 작성본 기준 결과예요. 현재 표를 확인한 뒤 별도로 확정해 주세요.'
                    : '현재 표에 반영되지 않은 결과예요.',
            );
            expect(mocks.applyAdjustedDoc).not.toHaveBeenCalled();
        },
    );
    it('does not show schedule generation progress when viewing a saved result', async () => {
        const onBusyChange = vi.fn();

        let resolveVersion!: (value: TResultVersion) => void;

        mocks.version.mockImplementationOnce(
            () =>
                new Promise<TResultVersion>((resolve) => {
                    resolveVersion = resolve;
                }),
        );
        renderSidebar({onBusyChange});
        await userEvent.click(await screen.findByRole('button', {name: '근무표 열기'}));
        await waitFor(() => expect(mocks.version).toHaveBeenCalledOnce());
        expect(onBusyChange.mock.calls.every(([value]) => value === false)).toBe(true);
        await act(async () => resolveVersion(source));
        expect(await screen.findByRole('dialog')).toBeVisible();
    });

    it('waits for the completed operation revision before autosaving its restored result', async () => {
        let finishRefresh!: (value: TConversationDetail) => void;

        const refreshed = new Promise<TConversationDetail>((resolve) => {
            finishRefresh = resolve;
        });

        mocks.detail.mockResolvedValueOnce(current).mockImplementation(() => refreshed);
        mocks.execute.mockResolvedValueOnce(operation);
        mocks.applyAdjustedDoc.mockImplementationOnce(() => {
            mocks.draftFixed = true;
            useShiftEditorStore.setState({draftRevision: useShiftEditorStore.getState().draftRevision + 1});
        });
        renderSidebar({generationRequest: 1});
        await waitFor(() => expect(mocks.applyAdjustedDoc).toHaveBeenCalledOnce());
        await act(async () => {
            await new Promise((resolve) => setTimeout(resolve, 500));
        });
        expect(mocks.sync).not.toHaveBeenCalled();
        await act(async () =>
            finishRefresh({
                ...current,
                conversation: {...current.conversation, revision: 1},
                draft: {...source, cells: [{...cell, fixed: true}]},
            }),
        );
        await act(async () => {
            await new Promise((resolve) => setTimeout(resolve, 500));
        });
        expect(mocks.sync).not.toHaveBeenCalled();
        expect(screen.queryByText('요청을 처리하지 못했어요.')).not.toBeInTheDocument();
    });

    it('distinguishes autofill and adjustment attempt boundaries without calling a solver', async () => {
        current.operations = [
            operation,
            {...operation, operationId: 'adjust:1', sequence: 2, operationType: 'ADJUST'},
            {...operation, operationId: 'generate:2', sequence: 3, executionStatus: 'FAILED', resultVersionId: null},
        ];
        renderSidebar();
        expect(await screen.findByText(/^(자동채우기 1회차|Autofill 1 attempt) ·/)).toBeVisible();
        expect(screen.getByText(/^(수정 1회차|Adjustment 1 attempt) ·/)).toBeVisible();
        expect(screen.getByText(/^(자동채우기 2회차|Autofill 2 attempt) ·/)).toHaveTextContent(/실패|FAILED/);
        expect(mocks.execute).not.toHaveBeenCalled();
    });
    it.each([true, false])('explains an applied unchanged adjustment without claiming optimality: %s', async (unchanged) => {
        current.operations = [
            {
                ...operation,
                operationType: 'ADJUST',
                result: {
                    operationType: 'ADJUST',
                    applicable: true,
                    draftRevision: 0,
                    resultType: 'PATCH',
                    changedCells: unchanged ? [] : [cell],
                    unmetInstructions: [],
                    sameAsPrevious: unchanged,
                    validation: {
                        draftRevision: 0,
                        rulesHash: 'rules:1',
                        summary: {valid: true, hardCount: 0, softCount: 0, totalCount: 0},
                        violations: [],
                    },
                    engineResult: {status: 'ACCEPTED'},
                },
            },
        ];
        renderSidebar();
        await screen.findByText(/^(수정 1회차|Adjustment 1 attempt) ·/);

        const message = screen.queryByText(/이번에는 바뀐 근무가 없어요|No shifts changed this time/);

        if (unchanged) expect(message).toBeVisible();
        else expect(message).not.toBeInTheDocument();

        expect(screen.queryByText(/최적|optimal/i)).not.toBeInTheDocument();
    });

    it('[HISTORY-FAILURE] keeps an earlier failure explanation in chat without offering another execution', async () => {
        const older: TConversationDetail = {
            ...current,
            conversation: {...current.conversation, conversationId: 9},
            operations: [
                {
                    ...operation,
                    executionStatus: 'FAILED',
                    applyStatus: 'NOT_APPLIED',
                    resultVersionId: null,
                    failureReason: 'TIME_LIMIT_NO_SOLUTION',
                    result: {
                        operationType: 'GENERATE',
                        applicable: false,
                        draftRevision: 0,
                        resultType: 'PATCH',
                        changedCells: [],
                        unmetInstructions: [],
                        sameAsPrevious: true,
                        validation: {
                            draftRevision: 0,
                            rulesHash: 'rules:1',
                            summary: {valid: false, hardCount: 0, softCount: 0, totalCount: 0},
                            violations: [],
                        },
                        engineResult: {status: 'TIME_LIMIT', solver: {reason: 'TIME_LIMIT_NO_SOLUTION'}},
                    },
                },
            ],
        };

        mocks.list.mockResolvedValue([current.conversation, older.conversation]);
        mocks.detail.mockImplementation(async (id: number) => (id === 9 ? older : current));

        const before = useShiftEditorStore.getState().doc;

        renderSidebar();

        const summary = await screen.findByText(/이전 대화 기록|Earlier conversation/);

        await userEvent.click(summary);

        const history = within(summary.closest('details')!);

        expect(await history.findByRole('alert')).toHaveTextContent(
            /정해진 시간 안에 조건에 맞는 근무표를 찾지 못했어요|within the time limit/,
        );
        expect(history.queryByRole('button', {name: /다시 시도하기|Try again/})).not.toBeInTheDocument();
        expect(history.queryByRole('button', {name: /근무표 열기|View this result/})).not.toBeInTheDocument();
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        expect(useShiftEditorStore.getState().doc).toEqual(before);
        expect(mocks.execute).not.toHaveBeenCalled();
    });

    it('keeps older monthly conversations reachable without changing the current plan or schedule', async () => {
        const older = {
            ...current,
            conversation: {...current.conversation, conversationId: 9},
            turns: [
                {
                    eventId: 91,
                    sequence: 1,
                    actor: 'USER',
                    type: 'MESSAGE',
                    text: '지난 대화 요청',
                    interpretationId: null,
                    baseRevision: 0,
                    contextHash: null,
                    interpretation: null,
                    createdAt: source.createdAt,
                },
            ],
            operations: [{...operation, operationId: 'older:result', sequence: 2}],
        };

        mocks.list.mockResolvedValue([current.conversation, older.conversation]);
        mocks.detail.mockImplementation(async (id: number) => (id === 9 ? older : current));

        const docBefore = useShiftEditorStore.getState().doc;

        renderSidebar();

        const summary = await screen.findByText(/이전 대화 기록|Earlier conversation/);

        await userEvent.click(summary);
        expect(await screen.findByText('지난 대화 요청')).toBeVisible();

        const history = within(summary.closest('details')!);

        await userEvent.click(history.getByRole('button', {name: /전후 비교|변경 전후 비교|Compare/}));
        await screen.findByRole('dialog');
        expect(mocks.version).toHaveBeenCalledWith('source:1');
        expect(useShiftEditorStore.getState().doc).toEqual(docBefore);
        expect(mocks.execute).not.toHaveBeenCalled();
        expect(mocks.create).not.toHaveBeenCalled();
    });
    it.each(['solver_result_failed_final_gate', 'solver_result_validation_unavailable'])(
        'shows a rejected result as a failure with recovery choices: %s',
        async (reason) => {
            const onGenerated = vi.fn();
            const onPrepareGeneration = vi.fn();

            current.operations = [
                {
                    ...operation,
                    applyStatus: 'NOT_APPLIED',
                    result: {
                        operationType: 'GENERATE',
                        applicable: false,
                        draftRevision: 0,
                        resultType: 'PATCH',
                        changedCells: [{shiftNurseId: 1, date: '2026-11-01', wardShiftTypeId: 2}],
                        validation: {
                            draftRevision: 0,
                            rulesHash: 'rules:1',
                            summary: {valid: false, hardCount: 1, softCount: 0, totalCount: 1},
                            violations: [],
                        },
                        unmetInstructions: ['승인 조건을 충족하지 못한 근무표 후보를 검토용으로 반환합니다.'],
                        sameAsPrevious: false,
                        engineResult: {status: 'REJECTED', solver: {reason}},
                    },
                },
            ];
            renderSidebar({onGenerated, onPrepareGeneration});
            expect(await screen.findByRole('alert')).toHaveTextContent(/기존 근무표는 그대로|previous schedule is unchanged/);
            expect(screen.queryByText(/근무표를 채웠어요.|Your schedule is ready/)).not.toBeInTheDocument();
            expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
            expect(onGenerated).not.toHaveBeenCalled();

            if (reason === 'solver_result_validation_unavailable') {
                await userEvent.click(screen.getByRole('button', {name: /다시 시도하기|Try again/}));
                expect(onPrepareGeneration).toHaveBeenCalledOnce();
            } else {
                expect(screen.queryByRole('button', {name: /다시 시도하기|Try again/})).not.toBeInTheDocument();
                await userEvent.click(screen.getByRole('button', {name: /요청 수정하기|Edit request/}));
                expect(screen.getByRole('textbox')).toHaveValue('');
                expect(screen.getByRole('textbox')).toHaveFocus();
            }

            expect(mocks.execute).not.toHaveBeenCalled();
        },
    );

    it.each([false, true])('uses schedule confirmation eligibility even when every shift is fixed: %s', async (canConfirm) => {
        const onConfirm = vi.fn();
        const doc = useShiftEditorStore.getState().doc;

        useShiftEditorStore.getState().setDoc({...doc, fixedCells: {'1|2026-11-01': true}});
        renderSidebar({resultActions: {canConfirm, onConfirm}});

        const confirm = await screen.findByRole('button', {name: /^근무표 확정$|^Confirm schedule$/});

        expect(confirm.parentElement?.lastElementChild).toBe(confirm);

        if (canConfirm) expect(confirm).toBeEnabled();
        else expect(confirm).toBeDisabled();

        await userEvent.click(confirm);
        expect(onConfirm).toHaveBeenCalledTimes(canConfirm ? 1 : 0);
        expect(mocks.execute).not.toHaveBeenCalled();
    });

    it('blocks an execution request when the schedule is fully protected', async () => {
        const doc = useShiftEditorStore.getState().doc;

        useShiftEditorStore.getState().setDoc({...doc, fixedCells: {'1|2026-11-01': true}});
        renderSidebar({generationRequest: 1});
        await screen.findByText(/모든 근무가 고정|All shifts are fixed/);
        expect(mocks.execute).not.toHaveBeenCalled();
    });

    it('keeps a paused previous-month conversation instead of showing the edit welcome', async () => {
        renderSidebar({
            autofillFlow: {
                id: 1,
                status: 'paused',
                resumeStep: 'previous',
                messages: [
                    {role: 'assistant', text: '전달 근무에 빈칸이 있어요.'},
                    {role: 'user', text: '전달 근무를 입력할게요'},
                ],
            },
        });
        await screen.findByText('전달 근무를 입력할게요');
        expect(screen.getByText('전달 근무에 빈칸이 있어요.')).toBeVisible();
        expect(screen.queryByRole('group', {name: /근무표를 어떻게 바꿀까요|How would you like to change/})).not.toBeInTheDocument();
        expect(screen.queryByRole('button', {name: /^수정하고 싶은 부분이 있어요$|^I have some changes in mind$/})).not.toBeInTheDocument();
        expect(mocks.execute).not.toHaveBeenCalled();
    });

    it('returns whole-schedule requests to preparation instead of running immediately', async () => {
        const prepare = vi.fn();

        renderSidebar({onPrepareGeneration: prepare});
        await userEvent.click(await screen.findByRole('button', {name: /^같은 조건으로 다시 채울게요$|^Refill with the same conditions$/}));
        expect(prepare).toHaveBeenCalledOnce();
        expect(mocks.execute).not.toHaveBeenCalled();
    });

    it('keeps local preparation and selected replies before server results without persisting extra turns', async () => {
        current = {...current, operations: []};
        mocks.execute.mockImplementation(async () => {
            current = {...current, operations: [operation]};

            return operation;
        });

        const props = {
            open: true,
            onClose: vi.fn(),
            wardId: 1,
            teamId: 2,
            year: 2026,
            month: 11,
            shift: {days: [], wardShiftTypes: [], divisionShiftNurses: []} as unknown as TShift,
            adjustEnabled: true,
            generationRequest: 0,
            rebuildRequest: 0,
            onApplied: vi.fn(),
            onPrepareGeneration: vi.fn(),
        };
        const firstFlow = {
            id: 1,
            status: 'preparing' as const,
            messages: [{role: 'assistant' as const, text: '전달 근무에 빈칸이 있어요.'}],
        };
        const view = render(<AiConversationSidebar {...props} autofillFlow={firstFlow} preparation={<p>준비 선택지</p>} />);

        await screen.findByText('전달 근무에 빈칸이 있어요.');

        const confirmedFlow = {
            ...firstFlow,
            status: 'running' as const,
            messages: [
                ...firstFlow.messages,
                {role: 'user' as const, text: '이대로 진행할게요'},
                {role: 'assistant' as const, text: 'AI가 바꾸면 안 되는 근무가 있나요?'},
                {role: 'user' as const, text: '이대로 자동채우기'},
            ],
        };

        view.rerender(<AiConversationSidebar {...props} generationRequest={1} autofillFlow={confirmedFlow} />);
        await screen.findByText(/근무표를 채웠어요.|Your schedule is ready/);
        expect(screen.getByText('전달 근무에 빈칸이 있어요.')).toBeVisible();
        expect(screen.getByText('이대로 진행할게요')).toBeVisible();
        expect(screen.getByText('이대로 자동채우기')).toBeVisible();

        const panel = screen.getByRole('complementary');

        expect(panel.textContent).toMatch(
            /전달 근무에 빈칸이 있어요.[\s\S]*이대로 진행할게요[\s\S]*이대로 자동채우기[\s\S]*(근무표를 채웠어요.|Your schedule is ready)/,
        );
        expect(mocks.interpret).not.toHaveBeenCalled();
        expect(mocks.confirm).not.toHaveBeenCalled();
        expect(mocks.create).not.toHaveBeenCalled();

        await userEvent.click(screen.getByRole('button', {name: /^같은 조건으로 다시 채울게요$|^Refill with the same conditions$/}));
        expect(props.onPrepareGeneration).toHaveBeenCalledOnce();
        view.rerender(
            <AiConversationSidebar
                {...props}
                generationRequest={1}
                autofillFlow={{id: 2, status: 'preparing', messages: [{role: 'assistant', text: '두 번째 고정 확인'}]}}
                preparation={<p>준비 선택지</p>}
            />,
        );
        expect(screen.getByText('이대로 자동채우기')).toBeVisible();
        expect(screen.getByText('두 번째 고정 확인')).toBeVisible();
        expect(screen.getByText(/^같은 조건으로 다시 채울게요$|^Refill with the same conditions$/)).toBeVisible();
        expect(panel.textContent).toMatch(
            /이대로 자동채우기[\s\S]*(근무표를 채웠어요.|Your schedule is ready)[\s\S]*(같은 조건으로 다시 채울게요|Refill with the same conditions)[\s\S]*두 번째 고정 확인/,
        );
        expect(mocks.execute).toHaveBeenCalledOnce();
    });

    it('waits for preparation before dispatching a confirmed rebuild only once', async () => {
        const props = {
            open: true,
            onClose: vi.fn(),
            wardId: 1,
            teamId: 2,
            year: 2026,
            month: 11,
            shift: {} as TShift,
            adjustEnabled: true,
            generationRequest: 1,
            rebuildRequest: 0,
            generationFillPolicy: 'REBUILD_UNLOCKED' as const,
            onApplied: vi.fn(),
        };
        const view = render(<AiConversationSidebar {...props} preparation={<p>Choose fixed shifts</p>} />);

        await waitFor(() => expect(mocks.preferences).toHaveBeenCalledOnce());
        expect(mocks.execute).not.toHaveBeenCalled();
        view.rerender(<AiConversationSidebar {...props} />);
        await waitFor(() => expect(mocks.execute).toHaveBeenCalledOnce());
        expect(mocks.execute.mock.calls[0]![1]).toMatchObject({
            operationType: 'GENERATE',
            fillPolicy: 'REBUILD_UNLOCKED',
            rebuildConfirmed: true,
        });
        view.rerender(<AiConversationSidebar {...props} preparation={<p>New attempt</p>} />);
        view.rerender(<AiConversationSidebar {...props} />);
        expect(mocks.execute).toHaveBeenCalledOnce();
    });

    it.each([
        [409, 'AI_QUOTA_EXHAUSTED'],
        [403, 'SCHEDULE_AUTOFILL_ADJUST_NOT_ALLOWED'],
        [429, 'SCHEDULE_AUTOFILL_RATE_LIMIT_EXCEEDED'],
    ])('shows blocked execution in chat without an unresolved pending request: %s / %s', async (code, serverCode) => {
        mocks.execute.mockRejectedValue(Object.assign(new Error('약 10분 후 다시 시도해 주세요.'), {code, serverCode}));
        renderSidebar({generationRequest: 1});

        const alert = await screen.findByRole('alert');

        expect(alert).toBeVisible();
        expect(screen.queryByRole('button', {name: /결과 다시 확인하기|Check execution history/})).not.toBeInTheDocument();
        expect(sessionStorage.length).toBe(0);
        expect(mocks.execute).toHaveBeenCalledOnce();
        expect(mocks.applyAdjustedDoc).not.toHaveBeenCalled();
    });

    it('explains a stored quota failure when the conversation is reopened', async () => {
        current = {
            ...current,
            operations: [{...operation, executionStatus: 'FAILED', failureReason: 'AI_QUOTA_EXHAUSTED', resultVersionId: null}],
        };
        renderSidebar();
        expect(await screen.findByRole('alert')).toHaveTextContent(/횟수를 모두|all your AI attempts/);
        expect(screen.queryByText('AI_QUOTA_EXHAUSTED')).not.toBeInTheDocument();
        expect(mocks.execute).not.toHaveBeenCalled();
    });

    it('retains the typed request and shows permission errors in the conversation', async () => {
        mocks.interpret.mockRejectedValue(Object.assign(new Error('forbidden'), {code: 403}));
        renderSidebar();
        await waitFor(() => expect(mocks.preferences).toHaveBeenCalled());
        await userEvent.click(screen.getByRole('button', {name: /^수정하고 싶은 부분이 있어요$|^I have some changes in mind$/}));
        await userEvent.type(screen.getByRole('textbox'), '오프 균형을 맞춰줘');
        await userEvent.click(screen.getByRole('button', {name: /요청 보내기|Send request/}));
        expect(await screen.findByRole('alert')).toHaveTextContent(/권한|access/);
        expect(screen.getByRole('textbox')).toHaveValue('오프 균형을 맞춰줘');
        expect(mocks.execute).not.toHaveBeenCalled();
    });

    it('loads records without re-executing and previews a result without mutating the editor', async () => {
        renderSidebar();
        await userEvent.click(await screen.findByRole('button', {name: /근무표 열기|View this result/}));
        await screen.findByRole('dialog');
        expect(document.querySelector('.make-shift-calendar')).toBeInTheDocument();
        expect(useShiftEditorStore.getState().doc.rows[0]?.cells).toEqual(['O']);
        expect(mocks.applyAdjustedDoc).not.toHaveBeenCalled();
        expect(mocks.execute).not.toHaveBeenCalled();
        expect(mocks.create).not.toHaveBeenCalled();
    });
    it('interprets a message without executing the solver before confirmation', async () => {
        mocks.interpret.mockImplementation(async () => {
            const turn = {
                eventId: 2,
                sequence: 2,
                actor: 'ASSISTANT',
                type: 'INTERPRETATION',
                text: null,
                interpretationId: 'i:1',
                baseRevision: 0,
                contextHash: 'rules:1',
                interpretation: {items: [], llmPrompt: '연속 근무를 줄여줘', strength: 'NORMAL' as const, unmapped: []},
                createdAt: source.createdAt,
            };

            current = {...current, turns: [turn], conversation: {...current.conversation, latestInterpretationId: 'i:1'}};

            return turn;
        });
        renderSidebar();
        await waitFor(() => expect(mocks.preferences).toHaveBeenCalled());
        await userEvent.click(screen.getByRole('button', {name: /^수정하고 싶은 부분이 있어요$|^I have some changes in mind$/}));
        await userEvent.type(screen.getByRole('textbox'), '연속 근무를 줄여줘');
        await userEvent.click(screen.getByRole('button', {name: /요청 보내기|Send request/}));
        await screen.findByText(/이렇게 반영할까요|Shall we use these changes/);
        expect(mocks.interpret).toHaveBeenCalledOnce();
        expect(mocks.execute).not.toHaveBeenCalled();
    });
    it('does not overwrite a manual edit made while downloading the calculated result', async () => {
        current.operations = [{...operation, result: successfulResult}];

        let finish!: (version: TResultVersion) => void;

        mocks.execute.mockResolvedValue({...operation, result: successfulResult});
        mocks.version.mockImplementationOnce(
            () =>
                new Promise<TResultVersion>((resolve) => {
                    finish = resolve;
                }),
        );
        renderSidebar({generationRequest: 1});
        await waitFor(() => expect(mocks.version).toHaveBeenCalledOnce());
        act(() => {
            useShiftEditorStore.getState().setDoc({...useShiftEditorStore.getState().doc, rows: [{workerId: '1', cells: ['E']}]});
        });
        await act(async () => {
            finish({...source, versionId: 'result:1', cells: [{...cell, wardShiftTypeId: 1, shiftCode: 'D'}]});
        });
        await screen.findByText('작성 중인 표가 바뀌어서 결과를 반영하지 않았어요. 결과를 비교해 주세요.');
        expect(mocks.applyAdjustedDoc).not.toHaveBeenCalled();
        expect(useShiftEditorStore.getState().doc.rows[0]?.cells).toEqual(['E']);
        expectExecutionTimeScope();
    });
    it('selecting another saved request stops editing the previous saved request', async () => {
        mocks.preferences.mockResolvedValue([
            {id: 1, category: 'REQUEST_TEXT', value: '휴무 균형을 맞춰줘', provenance: 'USER', confirmedAt: source.createdAt},
            {id: 2, category: 'REQUEST_TEXT', value: '야간을 줄여줘', provenance: 'USER', confirmedAt: source.createdAt},
        ]);
        renderSidebar();
        await userEvent.click(await screen.findByRole('button', {name: /^수정하고 싶은 부분이 있어요$/}));
        await userEvent.click(screen.getAllByRole('button', {name: /^수정$/})[0]!);
        await userEvent.click(screen.getByText('야간을 줄여줘'));
        await userEvent.click(screen.getByRole('button', {name: '자주 쓰는 요청으로 저장하기'}));
        await userEvent.click(screen.getAllByRole('button', {name: '자주 쓰는 요청으로 저장하기'})[1]!);
        await waitFor(() => expect(mocks.savePreference).toHaveBeenCalledWith('야간을 줄여줘', 'EXPLICIT_USER_CONFIRMATION'));
        expect(mocks.replacePreference).not.toHaveBeenCalled();
    });
    it.each(['expired', 'context', 'revision', 'current'] as const)(
        'rechecks a selected suggestion before execution: %s',
        async (change) => {
            const suggestion = {
                suggestionId: 'suggestion:1',
                inputDigest: 'digest:1',
                baseRevision: 0,
                expiresAt: '2099-01-01T00:00:00Z',
                verificationStatus: 'VERIFIED_FEASIBLE',
                applyEnabled: true,
                changes: [{kind: 'NUMERIC_GOAL', oldValue: 12, proposedValue: 11}],
            };

            current.conversation.latestInterpretationId = 'interpretation:1';
            current.turns = [
                {
                    eventId: 1,
                    sequence: 1,
                    actor: 'ASSISTANT',
                    type: 'INTERPRETATION',
                    text: null,
                    interpretationId: 'interpretation:1',
                    baseRevision: 0,
                    contextHash: current.contextHash,
                    interpretation: null,
                    createdAt: source.createdAt,
                },
            ];
            current.operations = [
                {
                    ...operation,
                    operationType: 'ADJUST',
                    sequence: 2,
                    executionStatus: 'FAILED',
                    applyStatus: 'NOT_APPLIED',
                    resultVersionId: null,
                    interpretationId: 'interpretation:1',
                    result: {
                        operationType: 'ADJUST',
                        applicable: false,
                        draftRevision: 0,
                        resultType: 'PATCH',
                        changedCells: [],
                        validation: {
                            draftRevision: 0,
                            rulesHash: 'rules:1',
                            summary: {valid: false, hardCount: 1, softCount: 0, totalCount: 1},
                            violations: [],
                        },
                        unmetInstructions: [],
                        sameAsPrevious: false,
                        engineResult: {status: 'REJECTED'},
                        failure: {reasonCode: 'HARD_RULE_CONFLICT', message: '', suggestions: [suggestion]},
                    },
                },
            ];
            renderSidebar();
            await userEvent.click(await screen.findByRole('button', {name: '변경 제안 보기'}));

            if (change === 'expired') suggestion.expiresAt = '2000-01-01T00:00:00Z';

            if (change === 'context') current = {...current, contextHash: 'rules:2'};

            if (change === 'revision') current = {...current, conversation: {...current.conversation, revision: 1}};

            await userEvent.click(screen.getByRole('button', {name: '이 변경으로 수정하기'}));

            if (change === 'current') {
                await waitFor(() => expect(mocks.execute).toHaveBeenCalledOnce());
                expect(mocks.execute.mock.calls[0]![1]).toMatchObject({failureSuggestionId: 'suggestion:1', suggestionConfirmed: true});
            } else {
                expect(
                    await screen.findByText('표나 조건이 바뀌었거나 제안의 유효 시간이 지났어요. 최신 요청으로 다시 수정해 주세요.'),
                ).toBeVisible();
                expect(mocks.execute).not.toHaveBeenCalled();
                expect(screen.queryByRole('button', {name: '결과 다시 확인하기'})).not.toBeInTheDocument();
            }
        },
    );
    it('explicitly updates a saved request with an update label', async () => {
        mocks.preferences.mockResolvedValue([
            {id: 1, category: 'REQUEST_TEXT', value: '휴무 균형을 맞춰줘', provenance: 'USER', confirmedAt: source.createdAt},
        ]);
        renderSidebar();
        await userEvent.click(await screen.findByRole('button', {name: /^수정하고 싶은 부분이 있어요$/}));
        await userEvent.click(screen.getByRole('button', {name: /^수정$/}));
        await userEvent.type(screen.getByRole('textbox'), ' 이번 달만');
        await userEvent.click(screen.getByRole('button', {name: '저장한 요청 수정하기'}));
        await userEvent.click(screen.getAllByRole('button', {name: '저장한 요청 수정하기'})[1]!);
        await waitFor(() => expect(mocks.replacePreference).toHaveBeenCalledWith(1, '휴무 균형을 맞춰줘 이번 달만'));
        expect(mocks.savePreference).not.toHaveBeenCalled();
    });
    it('saved request suggestions only fill the composer', async () => {
        mocks.preferences.mockResolvedValue([
            {id: 1, category: 'REQUEST_TEXT', value: '휴무 균형을 맞춰줘', provenance: 'USER', confirmedAt: source.createdAt},
        ]);
        renderSidebar();
        await userEvent.click(await screen.findByRole('button', {name: /^수정하고 싶은 부분이 있어요$|^I have some changes in mind$/}));
        await userEvent.click(await screen.findByText('휴무 균형을 맞춰줘'));
        expect(screen.getByRole('textbox')).toHaveValue('휴무 균형을 맞춰줘');
        expect(mocks.interpret).not.toHaveBeenCalled();
        expect(mocks.execute).not.toHaveBeenCalled();
    });
    it('requires an explicit confirmation before rebuilding unlocked assignments', async () => {
        renderSidebar();
        await waitFor(() => expect(mocks.preferences).toHaveBeenCalled());
        await userEvent.click(screen.getByRole('button', {name: /^같은 조건으로 다시 채울게요$|^Refill with the same conditions$/}));
        expect(mocks.execute).not.toHaveBeenCalled();
        await userEvent.click(screen.getByRole('button', {name: /^다시 자동채우기$|^Autofill again$/}));
        await waitFor(() => expect(mocks.execute).toHaveBeenCalledOnce());
        expect(mocks.execute.mock.calls[0]?.[1]).toMatchObject({
            operationType: 'GENERATE',
            fillPolicy: 'REBUILD_UNLOCKED',
            rebuildConfirmed: true,
        });
    });
    it('shows two choices only for a fresh chat and starts the change conversation without executing', async () => {
        renderSidebar();

        const modify = await screen.findByRole('button', {name: /수정하고 싶은 부분이 있어요$|I have some changes in mind$/});

        expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
        expect(document.querySelector('.ai-adjust-chat-scroll')).toHaveAttribute('data-composer-hidden', 'true');
        expect(screen.queryByRole('region', {name: /이렇게 요청해 보세요|Try a request/})).not.toBeInTheDocument();
        expect(screen.queryByText(/현재 조건으로 전체|Rebuild the whole schedule with/)).not.toBeInTheDocument();
        await userEvent.click(modify);
        await screen.findByText(/어떤 점을 바꾸고 싶나요|What would you like to change/);
        expect(
            screen.queryByRole('button', {name: /^같은 조건으로 다시 채울게요$|^Refill with the same conditions$/}),
        ).not.toBeInTheDocument();
        expect(screen.getByRole('textbox')).toHaveFocus();
        expect(document.querySelector('.ai-adjust-chat-scroll')).toHaveAttribute('data-composer-hidden', 'false');

        const examples = screen.getByRole('region', {name: /이렇게 요청해 보세요|Try a request/});

        expect(within(examples).getAllByRole('button')).toHaveLength(3);
        await userEvent.click(within(examples).getAllByRole('button')[0]);
        expect(screen.getByRole('textbox')).toHaveValue('김 간호사 1일 D 근무 없게 해줘');
        expect(screen.getByRole('textbox')).toHaveFocus();
        expect(mocks.interpret).not.toHaveBeenCalled();
        expect(mocks.execute).not.toHaveBeenCalled();
    });
    it('adjusts only after confirmation and carries the interpretation into the request', async () => {
        mocks.interpret.mockImplementation(async () => {
            const turn = {
                eventId: 2,
                sequence: 2,
                actor: 'ASSISTANT',
                type: 'INTERPRETATION',
                text: null,
                interpretationId: 'i:1',
                baseRevision: 0,
                contextHash: 'rules:1',
                interpretation: {items: [], llmPrompt: '연속 근무를 줄여줘', strength: 'NORMAL' as const, unmapped: []},
                createdAt: source.createdAt,
            };

            current = {...current, turns: [turn], conversation: {...current.conversation, latestInterpretationId: 'i:1'}};

            return turn;
        });

        mocks.confirm.mockImplementation(async () => {
            const confirmed = {
                ...current.turns[0]!,
                eventId: 3,
                sequence: 3,
                type: 'INTERPRETATION_CONFIRMED',
                interpretationId: 'confirmed:1',
            };

            current = {
                ...current,
                turns: [...current.turns, confirmed],
                conversation: {...current.conversation, latestInterpretationId: 'confirmed:1'},
            };

            return confirmed;
        });

        let finishPreparation!: () => void;

        const prepare = vi.fn(
            () =>
                new Promise<void>((resolve) => {
                    finishPreparation = resolve;
                }),
        );

        renderSidebar({onPrepareAdjustment: prepare});
        await waitFor(() => expect(mocks.preferences).toHaveBeenCalled());
        await userEvent.click(screen.getByRole('button', {name: /^수정하고 싶은 부분이 있어요$|^I have some changes in mind$/}));
        await userEvent.type(screen.getByRole('textbox'), '연속 근무를 줄여줘');
        await userEvent.click(screen.getByRole('button', {name: /요청 보내기|Send request/}));

        const apply = await screen.findByRole('button', {name: /수정 내용 반영하기|Apply changes/});

        expect(apply).toBeDisabled();
        await userEvent.click(screen.getByRole('button', {name: /이 내용으로 정하기|Confirm these details/}));
        await waitFor(() => expect(screen.getByRole('button', {name: /수정 내용 반영하기|Apply changes/})).toBeEnabled());
        expect(mocks.execute).not.toHaveBeenCalled();
        await userEvent.click(screen.getByRole('button', {name: /수정 내용 반영하기|Apply changes/}));
        expect(prepare).toHaveBeenCalledOnce();
        expect(mocks.execute).not.toHaveBeenCalled();
        await act(async () => finishPreparation());
        await waitFor(() => expect(mocks.execute).toHaveBeenCalledOnce());
        expect(mocks.execute.mock.calls[0]?.[1]).toMatchObject({
            operationType: 'ADJUST',
            interpretationId: 'confirmed:1',
        });
        expect(mocks.execute.mock.calls[0]?.[1]).not.toHaveProperty('fillPolicy');
        expect(mocks.execute.mock.calls[0]?.[1]).not.toHaveProperty('rebuildConfirmed');
    });
    it.each([false, true])(
        'retains reviewed items after preparation edits and requires review if free text changes: %s',
        async (changedPrompt) => {
            const items = [{kind: 'KNOB' as const, knob: 'CLUSTERING' as const, value: 1, displayLabel: '근무 모으기'}];
            const turn = {
                eventId: 2,
                sequence: 2,
                actor: 'ASSISTANT',
                type: 'INTERPRETATION_CONFIRMED',
                text: null,
                interpretationId: 'i:1',
                baseRevision: 0,
                contextHash: 'rules:1',
                interpretation: {items, llmPrompt: '연속 근무를 줄여줘', strength: 'NORMAL' as const, unmapped: []},
                createdAt: source.createdAt,
            };

            current = {...current, turns: [turn], conversation: {...current.conversation, latestInterpretationId: 'i:1'}};
            mocks.sync.mockImplementation(async () => {
                current = {
                    ...current,
                    draft: {...source, cells: [{...cell, fixed: true}]},
                    conversation: {...current.conversation, revision: 1},
                };

                return current;
            });
            mocks.interpret.mockImplementation(async () => {
                const refreshed = {
                    ...turn,
                    eventId: 3,
                    sequence: 3,
                    interpretationId: 'i:2',
                    baseRevision: 1,
                    interpretation: {
                        ...turn.interpretation,
                        items: [],
                        llmPrompt: changedPrompt ? '새로운 조건' : turn.interpretation.llmPrompt,
                    },
                };

                current = {
                    ...current,
                    turns: [...current.turns, refreshed],
                    conversation: {...current.conversation, latestInterpretationId: 'i:2'},
                };

                return refreshed;
            });
            mocks.confirm.mockImplementation(async (_id, _interpretationId, _revision, confirmedItems) => {
                const confirmed = {
                    ...current.turns[current.turns.length - 1]!,
                    eventId: 4,
                    sequence: 4,
                    interpretationId: 'i:3',
                    type: 'INTERPRETATION_CONFIRMED',
                    interpretation: {...current.turns[current.turns.length - 1]!.interpretation!, items: confirmedItems},
                };

                current = {
                    ...current,
                    turns: [...current.turns, confirmed],
                    conversation: {...current.conversation, latestInterpretationId: 'i:3'},
                };

                return confirmed;
            });

            const prepare = vi.fn(async () => {
                mocks.draftFixed = true;
            });

            renderSidebar({onPrepareAdjustment: prepare});
            await userEvent.click(await screen.findByRole('button', {name: /수정 내용 반영하기|Apply changes/}));
            await waitFor(() => expect(mocks.confirm).toHaveBeenCalledWith(1, 'i:2', 1, items));

            if (changedPrompt) {
                await screen.findByText(/수정 조건을 한 번 더 확인|review the updated conditions/);
                expect(mocks.execute).not.toHaveBeenCalled();
                await userEvent.click(screen.getByRole('button', {name: /수정 내용 반영하기|Apply changes/}));
            }

            await waitFor(() => expect(mocks.execute).toHaveBeenCalledOnce());
            expect(prepare).toHaveBeenCalledOnce();
            expect(mocks.execute.mock.calls[0]?.[1]).toMatchObject({
                expectedRevision: 1,
                interpretationId: 'i:3',
                operationType: 'ADJUST',
            });
        },
    );

    it('starts a new section while retaining the monthly request and execution history', async () => {
        current = {
            ...current,
            turns: [
                {
                    eventId: 1,
                    sequence: 1,
                    actor: 'USER',
                    type: 'MESSAGE',
                    text: '이전 요청',
                    interpretationId: null,
                    baseRevision: 0,
                    contextHash: 'rules:1',
                    interpretation: null,
                    createdAt: source.createdAt,
                },
            ],
        };
        mocks.startSegment.mockImplementation(async () => {
            current = {
                ...current,
                turns: [
                    ...current.turns,
                    {
                        eventId: 90,
                        sequence: 90,
                        actor: 'SYSTEM',
                        type: 'SEGMENT_START',
                        text: 'CURRENT_DRAFT',
                        interpretationId: null,
                        interpretation: null,
                        baseRevision: 1,
                        contextHash: null,
                        createdAt: source.createdAt,
                    },
                ],
                conversation: {...current.conversation, revision: 1, latestInterpretationId: null},
            };

            return current;
        });
        renderSidebar();
        await screen.findByText('이전 요청');
        expect(screen.queryByRole('button', {name: /^수정하고 싶은 부분이 있어요$|^I have some changes in mind$/})).not.toBeInTheDocument();
        await userEvent.click(screen.getByRole('button', {name: /새 요청|New request/}));
        await screen.findByRole('button', {name: /^수정하고 싶은 부분이 있어요$|^I have some changes in mind$/});
        expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
        expect(screen.queryByText(/8cb64676/)).not.toBeInTheDocument();
        expect(screen.queryByRole('button', {name: '서버 작업표 불러오기'})).not.toBeInTheDocument();
        expect(mocks.startSegment).toHaveBeenCalledWith(1, 'source:1', 0);
        expect(screen.getByText('이전 요청')).toBeVisible();
        expect(screen.getByText(/여기서부터 새 요청|New requests/)).toBeVisible();
        expect(screen.getByRole('button', {name: /전후 비교|변경 전후 비교|Compare/})).toBeVisible();
        expect(mocks.branch).not.toHaveBeenCalled();
        expect(mocks.execute).not.toHaveBeenCalled();
        expect(mocks.applyAdjustedDoc).not.toHaveBeenCalled();
    });
    it('retains manual edits during a saved-result transition and resumes with the current server revision', async () => {
        mocks.startSegment.mockImplementation(async () => {
            useShiftEditorStore.getState().setDoc({...useShiftEditorStore.getState().doc, rows: [{workerId: '1', cells: ['E']}]});
            mocks.draftFixed = true;
            current = {
                ...current,
                conversation: {...current.conversation, revision: 1, latestInterpretationId: null},
                draft: {...source, versionId: 'result:1', cells: [{...cell, wardShiftTypeId: 1, shiftCode: 'D'}]},
            };

            return current;
        });
        mocks.sync.mockImplementation(async (_id: number, request: {expectedRevision: number; cells: typeof source.cells}) => {
            expect(request.expectedRevision).toBe(1);
            current = {...current, conversation: {...current.conversation, revision: 2}, draft: {...current.draft, cells: request.cells}};

            return current;
        });
        renderSidebar();
        await userEvent.click(await screen.findByRole('button', {name: /근무표 열기|View this result/}));
        await userEvent.click(await screen.findByRole('button', {name: /이 표로 이어서 작성하기|Continue from this result/}));

        const pending = await screen.findByRole('button', {name: /이 표로 이어서 작성하기|Open the saved new branch/});

        expect(useShiftEditorStore.getState().doc.rows[0]?.cells).toEqual(['E']);
        expect(mocks.applyAdjustedDoc).not.toHaveBeenCalled();
        await userEvent.click(pending);
        await waitFor(() => expect(mocks.applyAdjustedDoc).toHaveBeenCalledOnce());
        expect(mocks.sync).toHaveBeenCalled();
        expect(current.conversation.revision).toBe(2);
        expect(mocks.execute).not.toHaveBeenCalled();
    });
    it('keeps newer manual edits when they occur while resuming a saved result', async () => {
        mocks.startSegment.mockImplementation(async () => {
            useShiftEditorStore.getState().setDoc({...useShiftEditorStore.getState().doc, rows: [{workerId: '1', cells: ['E']}]});
            mocks.draftFixed = true;
            current = {
                ...current,
                conversation: {...current.conversation, revision: 1, latestInterpretationId: null},
                draft: {...source, versionId: 'result:1', cells: [{...cell, wardShiftTypeId: 1, shiftCode: 'D'}]},
            };

            return current;
        });
        mocks.sync.mockImplementation(async (_id: number, request: {expectedRevision: number; cells: typeof source.cells}) => {
            useShiftEditorStore.getState().setDoc({...useShiftEditorStore.getState().doc, rows: [{workerId: '1', cells: ['N']}]});
            expect(request.expectedRevision).toBe(1);
            current = {...current, conversation: {...current.conversation, revision: 2}, draft: {...current.draft, cells: request.cells}};

            return current;
        });
        renderSidebar();
        await userEvent.click(await screen.findByRole('button', {name: /근무표 열기|View this result/}));
        await userEvent.click(await screen.findByRole('button', {name: /이 표로 이어서 작성하기|Continue from this result/}));

        const pending = await screen.findByRole('button', {name: /이 표로 이어서 작성하기|Open the saved new branch/});

        expect(useShiftEditorStore.getState().doc.rows[0]?.cells).toEqual(['E']);
        expect(mocks.applyAdjustedDoc).not.toHaveBeenCalled();
        await userEvent.click(pending);
        await screen.findByText('표가 바뀌어서 이전 결과로 전환하지 않았어요. 작성 중인 내용을 확인한 뒤 다시 눌러 주세요.');
        expect(mocks.applyAdjustedDoc).not.toHaveBeenCalled();
        expect(useShiftEditorStore.getState().doc.rows[0]?.cells).toEqual(['N']);
        expect(mocks.sync).toHaveBeenCalled();
        expect(current.conversation.revision).toBe(2);
        expect(mocks.execute).not.toHaveBeenCalled();
    });
    it('retains the latest interpretation when continuing an existing conversation', async () => {
        const turn = {
            eventId: 2,
            sequence: 2,
            actor: 'ASSISTANT',
            type: 'INTERPRETATION',
            text: null,
            interpretationId: 'i:1',
            baseRevision: 0,
            contextHash: 'rules:1',
            interpretation: {items: [], llmPrompt: '연속 근무를 줄여줘', unmapped: []},
            createdAt: source.createdAt,
        };

        current = {...current, turns: [turn], conversation: {...current.conversation, latestInterpretationId: 'i:1'}};
        mocks.interpret.mockResolvedValue({...turn, interpretationId: 'i:2'});
        renderSidebar();
        await screen.findByText(/이렇게 반영할까요|Shall we use these changes/);
        await userEvent.type(screen.getByRole('textbox'), '오프도 고르게 배치해줘');
        await userEvent.click(screen.getByRole('button', {name: /요청 보내기|Send request/}));
        await waitFor(() => expect(mocks.interpret).toHaveBeenCalledOnce());
        expect(mocks.interpret.mock.calls[0]?.[1]).toMatchObject({previousInterpretationId: 'i:1', change: 'ADD'});
        expect(mocks.execute).not.toHaveBeenCalled();
    });

    it('uses the first visible nurse and the ward night code in examples and the input hint', async () => {
        useShiftEditorStore.getState().setDoc({
            columns: ['2026-11-01', '2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05'],
            rows: [
                {workerId: '2', cells: ['O', 'O', 'O', 'O', 'O']},
                {workerId: '1', cells: ['O', 'O', 'O', 'O', 'O']},
            ],
            workerMeta: {'1': {name: '김 간호사', nurseId: 1}, '2': {name: '첫 행 간호사', nurseId: 2}},
            fixedCells: {},
            requestCells: {},
        });
        useShiftEditorStore.getState().setSemanticExecutionEnabled(true);
        renderSidebar({
            shift: {
                lastDays: [],
                days: [{day: 1, dayType: 'workday'}],
                divisionShiftNurses: [],
                wardShiftTypes: [
                    {
                        wardShiftTypeId: 13,
                        shortName: 'N12',
                        name: '2교대 야간',
                        color: '#397dff',
                        isDefault: true,
                        isOff: false,
                        isCounted: true,
                        startTime: '19:00',
                        endTime: '07:00',
                        classification: 'NIGHT',
                    },
                ],
            } as TShift,
        });
        await userEvent.click(await screen.findByRole('button', {name: '수정하고 싶은 부분이 있어요'}));

        const example = screen.getByRole('button', {name: '첫 행 간호사 1~5일 N12 근무 없게 해줘'});
        const input = screen.getByRole('textbox');

        expect(input).toHaveAttribute('placeholder', '예: 첫 행 간호사 1~5일 N12 근무 없게 해줘');
        await userEvent.click(example);
        expect(input).toHaveValue('첫 행 간호사 1~5일 N12 근무 없게 해줘');
        expect(mocks.interpret).not.toHaveBeenCalled();
        expect(mocks.execute).not.toHaveBeenCalled();
    });

    it('binds semantic confirmation and calculation to the reviewed plan without raw items', async () => {
        const proposal = {
            eventId: 2,
            sequence: 2,
            actor: 'ASSISTANT',
            type: 'SEMANTIC_PLAN',
            text: null,
            interpretationId: 'plan:proposal',
            baseRevision: 0,
            contextHash: 'rules:1',
            interpretation: null,
            createdAt: source.createdAt,
            semanticPlan: {
                planId: 'plan:1',
                planHash: 'a'.repeat(64),
                sourceVersionId: source.versionId,
                state: 'PREVIEW_READY',
                summary: '대상·기간·조건을 확인한 뒤 진행해 주세요.',
                confirmationAllowed: true,
                reasonCodes: [],
                conditions: [
                    {
                        intentId: 'i:1',
                        action: 'FORBID' as const,
                        nurseIds: [1],
                        dates: ['2026-11-01', '2026-11-02'],
                        shiftCodes: ['N'],
                        quantifier: 'EACH' as const,
                        modality: 'HARD' as const,
                        operator: null,
                        count: null,
                        sourceSpan: {quote: '김 간호사 1~2일 N 금지'},
                    },
                ],
            },
        };

        current = {
            ...current,
            turns: [proposal],
            conversation: {...current.conversation, latestInterpretationId: proposal.interpretationId},
        };
        mocks.confirmPlan.mockImplementation(async () => {
            const confirmed = {
                ...proposal,
                eventId: 3,
                sequence: 3,
                type: 'SEMANTIC_PLAN_CONFIRMED',
                interpretationId: 'plan:confirmed',
                semanticPlan: {...proposal.semanticPlan, state: 'CONFIRMED', confirmationAllowed: false},
            };

            current = {
                ...current,
                turns: [proposal, confirmed],
                conversation: {...current.conversation, latestInterpretationId: confirmed.interpretationId},
            };

            return confirmed;
        });
        renderSidebar();
        expect(await screen.findByText('11월 1~2일', {exact: false})).toBeInTheDocument();
        expect(mocks.execute).not.toHaveBeenCalled();
        await userEvent.click(screen.getByRole('button', {name: /이대로 수정하기|Adjust with these conditions/}));
        await waitFor(() => expect(mocks.confirmPlan).toHaveBeenCalledWith(1, 'plan:proposal', 0, 'a'.repeat(64)));
        await waitFor(() => expect(mocks.execute).toHaveBeenCalledOnce());
        expect(screen.getAllByRole('region', {name: /요청 조건 확인|Review request conditions/})).toHaveLength(1);
        expect(mocks.execute.mock.calls[0]?.[1]).toMatchObject({
            operationType: 'ADJUST',
            interpretationId: 'plan:confirmed',
            planHash: 'a'.repeat(64),
            sourceVersionId: source.versionId,
        });
    });
    it('keeps unsupported semantic conditions visible and disables confirmation', async () => {
        const proposal = {
            eventId: 2,
            sequence: 2,
            actor: 'ASSISTANT',
            type: 'SEMANTIC_PLAN',
            text: null,
            interpretationId: 'plan:unsupported',
            baseRevision: 0,
            contextHash: 'rules:1',
            interpretation: null,
            createdAt: source.createdAt,
            semanticPlan: {
                planId: 'p1',
                planHash: 'a'.repeat(64),
                sourceVersionId: source.versionId,
                state: 'UNSUPPORTED',
                summary: '요청에 아직 처리할 수 없는 조건이 있어요.',
                confirmationAllowed: false,
                reasonCodes: ['UNSUPPORTED_CAPABILITY'],
                conditions: [],
            },
        };

        current = {
            ...current,
            turns: [proposal],
            conversation: {...current.conversation, latestInterpretationId: proposal.interpretationId},
        };
        renderSidebar();
        expect(await screen.findByText(/이 요청은 아직 자동으로 반영하기 어려워요|This request is not supported yet/)).toBeInTheDocument();
        expect(screen.queryByRole('button', {name: /이대로 수정하기|Adjust with these conditions/})).not.toBeInTheDocument();
        expect(mocks.execute).not.toHaveBeenCalled();
    });

    const semanticRequest = (state = 'PREVIEW_READY', reasonCodes: string[] = []) => {
        const raw = '김 간호사 1~2일 N 금지. 12일 O 배정';
        const user: TConversationTurn = {
            eventId: 1,
            sequence: 1,
            actor: 'USER',
            type: 'MESSAGE',
            text: raw,
            interpretationId: null,
            interpretation: null,
            baseRevision: 0,
            contextHash: 'rules:1',
            createdAt: source.createdAt,
        };
        const proposal: TConversationTurn = {
            eventId: 2,
            sequence: 2,
            actor: 'ASSISTANT',
            type: 'SEMANTIC_PLAN',
            text: null,
            interpretationId: 'proposal:1',
            interpretation: null,
            baseRevision: 0,
            contextHash: 'rules:1',
            createdAt: source.createdAt,
            semanticPlan: {
                planId: 'p1',
                planHash: 'a'.repeat(64),
                sourceVersionId: source.versionId,
                state,
                summary: '요청을 더 확인해야 해요.',
                confirmationAllowed: state === 'PREVIEW_READY',
                reasonCodes,
                conditions: [
                    {
                        intentId: 'i1',
                        action: 'FORBID',
                        nurseIds: [1],
                        dates: ['2026-11-01', '2026-11-02'],
                        shiftCodes: ['N'],
                        quantifier: 'EACH',
                        modality: 'HARD',
                        operator: null,
                        count: null,
                        sourceSpan: {quote: raw},
                    },
                ],
            },
        };

        current = {
            ...current,
            turns: [user, proposal],
            conversation: {...current.conversation, latestInterpretationId: proposal.interpretationId},
        };
        useShiftEditorStore.getState().setSemanticExecutionEnabled(true);

        return {raw, proposal};
    };

    it('lets the user edit just the date while retaining every other original condition', async () => {
        const {raw, proposal} = semanticRequest();

        mocks.interpret.mockResolvedValue(proposal);
        renderSidebar();
        await screen.findByRole('button', {name: '요청 수정하기'});
        expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
        await userEvent.click(screen.getByRole('button', {name: '요청 수정하기'}));

        const input = screen.getByRole('textbox', {name: '바꾸고 싶은 내용'});

        expect(input).toHaveValue(raw);
        expect(screen.getByRole('button', {name: '이대로 수정하기'})).toBeDisabled();
        await userEvent.clear(input);
        await userEvent.type(input, raw.replace('1~2일', '1~5일'));
        await userEvent.click(screen.getByRole('button', {name: '수정한 요청 확인'}));
        await waitFor(() =>
            expect(mocks.interpret).toHaveBeenCalledWith(
                1,
                expect.objectContaining({
                    text: '김 간호사 1~5일 N 금지. 12일 O 배정',
                    previousInterpretationId: 'proposal:1',
                    change: 'REPLACE',
                }),
            ),
        );
        expect(mocks.execute).not.toHaveBeenCalled();
    });
    it('answers a clarification with the original request retained and without calculating', async () => {
        const {raw, proposal} = semanticRequest();

        proposal.semanticPlan!.state = 'NEEDS_CLARIFICATION';
        proposal.semanticPlan!.confirmationAllowed = false;
        proposal.semanticPlan!.summary = '빈칸으로 지울까요, O 근무를 배정할까요?';
        proposal.semanticPlan!.conditions = [];
        mocks.interpret.mockResolvedValue(proposal);
        renderSidebar();
        await screen.findByText('빈칸으로 지울까요, O 근무를 배정할까요?');
        await userEvent.type(screen.getByRole('textbox'), 'O로 배정해줘.');
        await userEvent.click(screen.getByRole('button', {name: '요청 보내기'}));
        await waitFor(() => expect(mocks.interpret).toHaveBeenCalledOnce());
        expect(mocks.interpret.mock.calls[0][1]).toMatchObject({
            text: `${raw}\n추가 답변: O로 배정해줘.`,
            previousInterpretationId: proposal.interpretationId,
            change: 'REPLACE',
        });
        expect(mocks.confirmPlan).not.toHaveBeenCalled();
        expect(mocks.execute).not.toHaveBeenCalled();
    });
    it('retains the applied plan when the user changes only one period in a follow-up', async () => {
        const {raw, proposal} = semanticRequest();

        proposal.semanticPlan!.state = 'APPLIED';
        proposal.semanticPlan!.confirmationAllowed = false;
        current = {
            ...current,
            conversation: {...current.conversation, revision: 1},
            operations: [{...operation, interpretationId: proposal.interpretationId, operationType: 'ADJUST', sequence: 3}],
        };
        mocks.interpret.mockResolvedValue({...proposal, semanticPlan: {...proposal.semanticPlan!, state: 'PREVIEW_READY'}});
        renderSidebar();

        const input = await screen.findByRole('textbox');

        await userEvent.type(input, '기간만 7일까지로 바꿔줘.');
        await userEvent.click(screen.getByRole('button', {name: '요청 보내기'}));
        await waitFor(() => expect(mocks.interpret).toHaveBeenCalledOnce());
        expect(mocks.interpret.mock.calls[0][1]).toMatchObject({
            text: `${raw}\n추가 요청: 기간만 7일까지로 바꿔줘.`,
            previousInterpretationId: proposal.interpretationId,
            change: 'REPLACE',
        });
        expect(mocks.execute).not.toHaveBeenCalled();
    });

    it('cancels an edit without changing the plan or executing', async () => {
        semanticRequest();
        renderSidebar();
        await userEvent.click(await screen.findByRole('button', {name: '요청 수정하기'}));
        await userEvent.clear(screen.getByRole('textbox', {name: '바꾸고 싶은 내용'}));
        await userEvent.click(screen.getByRole('button', {name: '취소'}));
        expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
        expect(screen.getByRole('button', {name: '이대로 수정하기'})).toBeEnabled();
        expect(mocks.interpret).not.toHaveBeenCalled();
        expect(mocks.execute).not.toHaveBeenCalled();
    });
    it('retries a technical extraction failure with the exact original request', async () => {
        const {raw, proposal} = semanticRequest('NEEDS_CLARIFICATION', ['INVALID_SOURCE_SPAN']);

        mocks.interpret.mockResolvedValue(proposal);
        renderSidebar();
        await userEvent.click(await screen.findByRole('button', {name: '다시 시도하기'}));
        await waitFor(() =>
            expect(mocks.interpret).toHaveBeenCalledWith(
                1,
                expect.objectContaining({text: raw, previousInterpretationId: 'proposal:1', change: 'REPLACE'}),
            ),
        );
        expect(mocks.confirmPlan).not.toHaveBeenCalled();
        expect(mocks.execute).not.toHaveBeenCalled();
    });
    it.each(['lost-confirmation', 'changed-revision'])('does not calculate when confirmation is unsafe: %s', async (failure) => {
        const {proposal} = semanticRequest();

        mocks.confirmPlan.mockImplementation(async () => {
            if (failure === 'lost-confirmation') throw new Error('응답이 지연됐어요.');

            const confirmed = {
                ...proposal,
                eventId: 3,
                sequence: 3,
                type: 'SEMANTIC_PLAN_CONFIRMED',
                interpretationId: 'confirmed:1',
                semanticPlan: {...proposal.semanticPlan!, state: 'CONFIRMED', confirmationAllowed: false},
            };

            current = {
                ...current,
                turns: [...current.turns, confirmed],
                conversation: {...current.conversation, revision: 1, latestInterpretationId: 'confirmed:1'},
            };

            return confirmed;
        });
        renderSidebar();
        await userEvent.click(await screen.findByRole('button', {name: '이대로 수정하기'}));
        await waitFor(() => expect(mocks.confirmPlan).toHaveBeenCalledOnce());
        await waitFor(() => expect(screen.getByRole('button', {name: '요청 수정하기'})).toBeEnabled());
        expect(mocks.execute).not.toHaveBeenCalled();
    });
    it('confirms and calculates only once when the action is double-clicked', async () => {
        const {proposal} = semanticRequest();

        let finish!: (turn: TConversationTurn) => void;

        mocks.confirmPlan.mockImplementation(
            () =>
                new Promise<TConversationTurn>((resolve) => {
                    finish = resolve;
                }),
        );
        renderSidebar();
        await userEvent.dblClick(await screen.findByRole('button', {name: '이대로 수정하기'}));
        expect(mocks.confirmPlan).toHaveBeenCalledOnce();
        expect(mocks.execute).not.toHaveBeenCalled();
        expect(screen.getByRole('button', {name: '요청 수정하기'})).toBeDisabled();
        await act(async () => {
            const confirmed = {
                ...proposal,
                eventId: 3,
                sequence: 3,
                type: 'SEMANTIC_PLAN_CONFIRMED',
                interpretationId: 'confirmed:1',
                semanticPlan: {...proposal.semanticPlan!, state: 'CONFIRMED', confirmationAllowed: false},
            };

            current = {
                ...current,
                turns: [...current.turns, confirmed],
                conversation: {...current.conversation, latestInterpretationId: 'confirmed:1'},
            };
            finish(confirmed);
        });
        await waitFor(() => expect(mocks.execute).toHaveBeenCalledOnce());
    });
});

describe('interrupted execution recovery', () => {
    it.each(['SUCCEEDED', 'FAILED'] as const)(
        'clears only the matching recovered operation when it finishes: %s',
        async (executionStatus) => {
            mocks.execute.mockRejectedValueOnce(new Error('Network error'));
            mocks.startSegment.mockImplementation(async () => current);
            renderSidebar({generationRequest: 1});
            await waitFor(() => expect(mocks.execute).toHaveBeenCalledOnce());

            const key = Object.keys(sessionStorage).find((k) => k.startsWith('dutying.conversation:'))!;

            expect(key).toBeTruthy();

            const pending: TConversationOperation = {
                ...operation,
                operationId: 'recover:2',
                sequence: 2,
                executionStatus: 'RUNNING',
                applyStatus: 'PENDING',
                resultVersionId: null,
            };

            mocks.execute.mockImplementationOnce(async () => {
                current = {...current, operations: [operation, pending]};

                return pending;
            });
            await userEvent.click(await screen.findByRole('button', {name: '결과 다시 확인하기'}));
            await waitFor(() => expect(mocks.execute).toHaveBeenCalledTimes(2));
            expect(sessionStorage.getItem(key)).not.toBeNull();
            expect(await screen.findByText('아직 근무표를 작성하고 있어요. 잠시만 기다려 주세요.')).toBeVisible();
            expect(mocks.execute.mock.calls[1]![1].idempotencyKey).toBe(mocks.execute.mock.calls[0]![1].idempotencyKey);
            current = {
                ...current,
                operations: [
                    operation,
                    {
                        ...pending,
                        executionStatus,
                        applyStatus: executionStatus === 'SUCCEEDED' ? 'APPLIED' : 'NOT_APPLIED',
                        resultVersionId: executionStatus === 'SUCCEEDED' ? 'result:2' : null,
                        result: executionStatus === 'SUCCEEDED' ? successfulResult : null,
                    },
                ],
            };
            await waitFor(() => expect(screen.getByRole('button', {name: '새 요청 시작하기'})).toBeEnabled(), {timeout: 5000});
            expect(screen.queryByText('아직 근무표를 작성하고 있어요. 잠시만 기다려 주세요.')).not.toBeInTheDocument();

            if (executionStatus === 'SUCCEEDED') expectExecutionTimeScope();

            await userEvent.click(screen.getByRole('button', {name: '새 요청 시작하기'}));
            await waitFor(() => expect(mocks.startSegment).toHaveBeenCalledOnce());
            expect(sessionStorage.getItem(key)).toBeNull();
        },
        12000,
    );
});
