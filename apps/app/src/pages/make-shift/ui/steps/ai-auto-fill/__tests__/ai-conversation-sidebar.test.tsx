vi.mock('../../../../model/monthly-rest-requirement', () => ({loadMonthlyRestRequirement: vi.fn().mockResolvedValue(undefined)}));
vi.mock('../ai-conversation-image', () => ({
    AiConversationImage: ({onOpen, disabled}: {onOpen: (trigger: HTMLButtonElement) => void; disabled?: boolean}) => (
        <button
            type="button"
            data-testid="conversation-result-preview"
            disabled={disabled}
            onClick={(event) => onOpen(event.currentTarget)}
        >
            근무표 살펴보기
        </button>
    ),
}));
import {webcrypto} from 'node:crypto';
import type {TScheduleMonthRequestRes, TShiftConstraintRuleResponse} from '@dutying/api/ward';
import type {ComponentProps, Ref} from 'react';
import toast, {Toaster} from 'react-hot-toast';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import type {TShift} from '@/entities/shift';
import useAuthStore from '@/features/auth/model/store';
import type * as ShiftEditorModule from '@/features/shift-editor';
import {useShiftEditorStore} from '@/features/shift-editor/model/store';
import i18n from '@/i18n';
import {adminAxiosInstance} from '@/shared/api/client';
import type * as WardApiModule from '@/shared/api/ward';
import {act, render, screen, userEvent, waitFor, within} from '@/shared/util/test-utils';
import type * as ConversationApiModule from '../../../../model/schedule-conversation-api';
import type {
    TConversationDetail,
    TConversationOperation,
    TConversationTurn,
    TResultVersion,
} from '../../../../model/schedule-conversation-api';
import {REPORT_SESSION_PREFIX} from '../../../../model/schedule-report-attempt';
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
    refreshPlan: vi.fn(),
    selectConditions: vi.fn(),
    changeModalities: vi.fn(),
    report: vi.fn(),
    getShiftConstraintRules: vi.fn(),
    applyConstraints: vi.fn(),
    getScheduleMonthRequests: vi.fn(),
    updateScheduleMonthRequest: vi.fn(),
    draftFixed: false,
}));

vi.mock('../../constraints', async () => {
    const {useEffect, useImperativeHandle, useState} = await import('react');

    return {
        Constraints: ({
            editorRef,
            onEditorStateChange,
            onApplied,
            disabled,
            wardId,
            shiftTeamId,
            year,
            month,
        }: {
            editorRef?: Ref<{apply: () => Promise<boolean>}>;
            onEditorStateChange?: (state: {dirty: boolean; saving: boolean; ready: boolean; count: number}) => void;
            onApplied?: () => Promise<void> | void;
            disabled?: boolean;
            wardId: number;
            shiftTeamId: number;
            year: number;
            month: number;
        }) => {
            const [dirty, setDirty] = useState(false);
            const [saving, setSaving] = useState(false);

            useEffect(() => {
                onEditorStateChange?.({dirty, saving, ready: true, count: 1});
            }, [dirty, saving, onEditorStateChange]);
            useImperativeHandle(
                editorRef,
                () => ({
                    apply: async () => {
                        setSaving(true);

                        try {
                            if (!(await mocks.applyConstraints())) return false;

                            await onApplied?.();
                            setDirty(false);

                            return true;
                        } catch {
                            return false;
                        } finally {
                            setSaving(false);
                        }
                    },
                }),
                [onApplied],
            );

            return (
                <section aria-label="테스트 제약조건 편집기" data-context={`${wardId}:${shiftTeamId}:${year}-${month}`}>
                    <button type="button" disabled={disabled} onClick={() => setDirty(true)}>
                        제약조건 수정
                    </button>
                </section>
            );
        },
    };
});

vi.mock('@/shared/api/ward', async (original) => {
    const actual = await original<typeof WardApiModule>();

    return {
        ...actual,
        default: {
            ...actual.default,
            getShiftConstraintRules: mocks.getShiftConstraintRules,
            getScheduleMonthRequests: mocks.getScheduleMonthRequests,
            updateScheduleMonthRequest: mocks.updateScheduleMonthRequest,
        },
    };
});
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
const monthlyCondition: TScheduleMonthRequestRes = {
    id: 41,
    kind: 'RULE',
    lifetime: 'MONTH',
    status: 'ACTIVE',
    origin: 'TEXT',
    displayLabel: '김 간호사 야간은 연속 2일까지',
    promotedRuleId: null,
};
const wardCondition: TShiftConstraintRuleResponse = {
    shiftConstraintRuleId: 51,
    templateCode: 'MIN_REST_HOURS',
    category: 'WORK_REST',
    severity: 'HARD',
    sortOrder: 0,
    params: {},
    selected: true,
    displayText: '근무 사이 휴식은 11시간 이상',
};
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
const expectNoLocalApplicationClaim = () => {
    expect(screen.queryByText(/만들 당시의 결과예요/)).not.toBeInTheDocument();
    expect(screen.getByRole('complementary')).not.toHaveTextContent('현재 근무표를 확인한 뒤 확정해 주세요.');
    expect(screen.getByRole('complementary')).not.toHaveTextContent(/현재 (표|근무표)에 (반영|적용)(했|됐|되었)/);
};

let current: TConversationDetail;

const startFreshSection = () => {
    const sequence = Math.max(0, ...current.turns.map((turn) => turn.sequence), ...current.operations.map((op) => op.sequence)) + 1;

    current = {
        ...current,
        conversation: {...current.conversation, revision: current.conversation.revision + 1, latestInterpretationId: null},
        conversationState: current.conversationState
            ? {
                  ...current.conversationState,
                  version: current.conversationState.version + 1,
                  sourceVersionId: current.draft.versionId,
                  contextHash: null,
                  expiresAt: null,
                  conditions: [],
                  pendingQuestion: null,
              }
            : current.conversationState,
        turns: [
            ...current.turns,
            {
                eventId: Math.max(0, ...current.turns.map((turn) => turn.eventId)) + 1,
                sequence,
                actor: 'SYSTEM',
                type: 'SEGMENT_START',
                text: 'CURRENT_DRAFT',
                interpretationId: null,
                interpretation: null,
                baseRevision: current.conversation.revision + 1,
                contextHash: null,
                createdAt: source.createdAt,
            },
        ],
    };

    return current;
};
const sidebarElement = (overrides: Partial<ComponentProps<typeof AiConversationSidebar>> = {}) => (
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
    />
);
const renderSidebar = (overrides: Partial<ComponentProps<typeof AiConversationSidebar>> = {}) => render(sidebarElement(overrides));

beforeEach(() => {
    window.localStorage.clear();
    vi.clearAllMocks();
    vi.stubGlobal('crypto', webcrypto);
    vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({matches: false}));
    useAuthStore.setState({
        accountId: 4,
        accessToken: null,
        accountMe: {
            accountId: 4,
            nurseId: null,
            wardId: 1,
            shiftTeamId: 2,
            email: '',
            name: '합성 계정',
            profileImgUrl: '',
            isManager: true,
            status: 'LINKED',
        },
    });
    mocks.report.mockReset().mockResolvedValue({incidentId: 'accepted:1'});
    mocks.getShiftConstraintRules.mockReset().mockResolvedValue({schemaVersion: 1, wardId: 1, shiftTeamId: 2, rules: []});
    mocks.getScheduleMonthRequests.mockReset().mockResolvedValue({year: 2026, month: 11, requests: []});
    mocks.updateScheduleMonthRequest.mockReset();
    mocks.applyConstraints.mockReset().mockResolvedValue(true);
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
    act(() => toast.remove());
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    useAuthStore.getState().resetState();
    vi.clearAllTimers();
});

describe('persistent schedule sidebar', () => {
    it('opens personal rest conflict settings in the same sidebar and refreshes the condition context without executing', async () => {
        const get = vi.spyOn(adminAxiosInstance, 'get');
        const put = vi.spyOn(adminAxiosInstance, 'put');

        mocks.applyConstraints.mockImplementationOnce(async () => {
            current = {...current, contextHash: 'rest:updated'};

            return true;
        });

        current = {
            ...current,
            contextHash: 'rest:old',
            operations: [
                {
                    ...operation,
                    executionStatus: 'FAILED',
                    applyStatus: 'NOT_APPLIED',
                    result: {
                        ...successfulResult,
                        applicable: false,
                        changedCells: [],
                        engineResult: {
                            status: 'INFEASIBLE',
                            violations: [
                                {
                                    type: 'PERSONAL_MONTHLY_REST_CAPACITY_CONFLICT',
                                    nurseId: 1,
                                    nurseName: '김 간호사',
                                    shiftCodes: ['O'],
                                    expected: 9,
                                    minimumAssignments: 0,
                                    maximumAssignments: 8,
                                },
                            ],
                        },
                    },
                },
            ],
        };

        const external = vi.fn();
        const prepareGeneration = vi.fn();

        renderSidebar({onOpenConstraints: external, onPrepareGeneration: prepareGeneration});
        await userEvent.click(await screen.findByRole('button', {name: i18n.t('aiAutofillUi.conflictReview.editSettings')}));

        expect(await screen.findByRole('dialog', {name: '제약조건'})).toBeVisible();
        expect(screen.queryByRole('dialog', {name: '휴무 설정 충돌'})).not.toBeInTheDocument();
        await userEvent.click(screen.getByRole('button', {name: '제약조건 수정'}));

        const previousDoc = structuredClone(useShiftEditorStore.getState().doc);

        await userEvent.click(screen.getByRole('button', {name: '변경사항 적용'}));
        await waitFor(() => expect(screen.queryByRole('dialog', {name: '제약조건'})).not.toBeInTheDocument());
        expect(put).not.toHaveBeenCalled();
        expect(get.mock.calls.some(([url]) => String(url).includes('monthly-rest-policy'))).toBe(false);
        expect(mocks.detail).toHaveBeenCalledTimes(2);
        expect(current.contextHash).toBe('rest:updated');
        expect(useShiftEditorStore.getState().doc).toEqual(previousDoc);
        expect(external).not.toHaveBeenCalled();
        expect(mocks.execute).not.toHaveBeenCalled();
        expect(mocks.interpret).not.toHaveBeenCalled();
        expect(await screen.findByText(i18n.t('aiConversationSidebar.conditionsSaved'))).toBeVisible();
        expect(prepareGeneration).not.toHaveBeenCalled();
        await userEvent.click(screen.getByRole('button', {name: i18n.t('aiConversationSidebar.retryWithUpdatedConditions')}));
        expect(prepareGeneration).toHaveBeenCalledOnce();
        expect(mocks.execute).not.toHaveBeenCalled();
    });

    it.each(['unknown-rest', 'availability'] as const)(
        'links %s evidence to the existing member settings instead of guessing a nurse',
        async (kind) => {
            current.operations = [
                {
                    ...operation,
                    executionStatus: 'FAILED',
                    applyStatus: 'NOT_APPLIED',
                    result: {
                        ...successfulResult,
                        applicable: false,
                        changedCells: [],
                        engineResult: {
                            status: 'INFEASIBLE',
                            violations:
                                kind === 'unknown-rest'
                                    ? [
                                          {
                                              type: 'PERSONAL_MONTHLY_REST_CAPACITY_CONFLICT',
                                              nurseId: 999,
                                              nurseName: '김 간호사',
                                              shiftCodes: ['O'],
                                              expected: 9,
                                              minimumAssignments: 0,
                                              maximumAssignments: 8,
                                          },
                                      ]
                                    : [
                                          {
                                              type: 'WORK_REST_AVAILABILITY_CONFLICT',
                                              nurseName: '김 간호사',
                                              forcedWorkDays: 19,
                                              maximum: 5,
                                              startDate: '2026-11-01',
                                              endDate: '2026-11-19',
                                          },
                                      ],
                        },
                    },
                },
            ];

            const get = vi.spyOn(adminAxiosInstance, 'get');

            renderSidebar();

            if (kind === 'availability') {
                const link = await screen.findByRole('link', {name: i18n.t('aiAdjust.executionFailure.memberSettings')});

                expect(link).toHaveAttribute('href', '/member?shiftTeamId=2');
                expect(link).toHaveAttribute('target', '_blank');
            } else {
                await userEvent.click(await screen.findByRole('button', {name: i18n.t('aiAutofillUi.conflictReview.editSettings')}));
                expect(screen.getByRole('dialog', {name: '제약조건'})).toBeVisible();
                expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
            }

            expect(get.mock.calls.some(([url]) => String(url).includes('monthly-rest-policy'))).toBe(false);
            expect(mocks.execute).not.toHaveBeenCalled();
        },
    );

    it('restores the selected composer and unfinished text without adding another introduction or sending it', async () => {
        current.operations = [];
        current.turns = [];

        const props = {autofillFlow: {id: 99, status: 'completed' as const, messages: []}};
        const first = renderSidebar(props);

        await userEvent.click(await screen.findByRole('button', {name: i18n.t('aiAdjust.chat.modify')}));
        await userEvent.type(screen.getByRole('textbox'), '12일 휴무를 유지해줘');
        expect(screen.getAllByText(i18n.t('aiAdjust.chat.askChanges'))).toHaveLength(1);
        first.unmount();
        renderSidebar(props);
        expect(await screen.findByRole('textbox')).toHaveValue('12일 휴무를 유지해줘');
        await waitFor(() => expect(mocks.preferences).toHaveBeenCalledTimes(2));
        expect(screen.getAllByText(i18n.t('aiAdjust.chat.askChanges'))).toHaveLength(1);
        expect(screen.queryByText(i18n.t('aiAdjust.chat.welcome'))).not.toBeInTheDocument();
        expect(mocks.interpret).not.toHaveBeenCalled();
        expect(mocks.execute).not.toHaveBeenCalled();
    });

    it('replaces the conversation loading state with a usable retry after initialization fails', async () => {
        let rejectList!: (reason: Error) => void;

        mocks.list.mockImplementationOnce(
            () =>
                new Promise((_resolve, reject) => {
                    rejectList = reject;
                }),
        );
        renderSidebar();
        expect(await screen.findByText('대화 불러오는 중')).toBeVisible();
        await act(async () => rejectList(new Error('offline')));
        expect(await screen.findByRole('alert')).toBeVisible();
        expect(screen.queryByText('대화 불러오는 중')).not.toBeInTheDocument();

        const retry = screen.getByRole('button', {name: '결과 다시 확인하기'});

        expect(retry).toBeEnabled();
        await userEvent.click(retry);
        expect(await screen.findByRole('button', {name: '근무표 살펴보기'})).toBeVisible();
        expect(mocks.list).toHaveBeenCalledTimes(2);
        expect(screen.queryByRole('alert')).not.toBeInTheDocument();
        expect(screen.queryByText('대화 불러오는 중')).not.toBeInTheDocument();
    });

    it.each([false, true])('reports execution completion without transient idle notifications (success: %s)', async (succeeded) => {
        current.operations = [];

        const onBusyChange = vi.fn();

        let finish!: (operation: TConversationOperation) => void;

        mocks.execute.mockImplementation(
            () =>
                new Promise((resolve) => {
                    finish = resolve;
                }),
        );
        renderSidebar({generationRequest: 1, onBusyChange});
        await waitFor(() => expect(mocks.execute).toHaveBeenCalledOnce());
        await waitFor(() => expect(onBusyChange).toHaveBeenLastCalledWith(true, false));
        onBusyChange.mockClear();

        const result: TConversationOperation = {
            ...operation,
            executionStatus: succeeded ? 'SUCCEEDED' : 'FAILED',
            applyStatus: succeeded ? 'APPLIED' : 'NOT_APPLIED',
            resultVersionId: succeeded ? 'result:1' : null,
            result: succeeded ? successfulResult : null,
        };

        current = {...current, operations: [result]};
        await act(async () => finish(result));

        await waitFor(() => expect(onBusyChange).toHaveBeenLastCalledWith(false, succeeded));
        expect(onBusyChange.mock.calls.filter(([busy]) => !busy)).toEqual([[false, succeeded]]);
    });

    it('keeps execution busy when an accepted request continues through polling', async () => {
        current.operations = [];

        const onBusyChange = vi.fn();

        mocks.execute.mockImplementation(async () => {
            const pending: TConversationOperation = {
                ...operation,
                executionStatus: 'RUNNING',
                applyStatus: 'NOT_APPLIED',
                resultVersionId: null,
            };

            current = {...current, operations: [pending]};

            return pending;
        });

        const view = renderSidebar({generationRequest: 1, onBusyChange});

        await waitFor(() => expect(mocks.execute).toHaveBeenCalledOnce());
        await waitFor(() => expect(onBusyChange).toHaveBeenLastCalledWith(true, false));

        const firstBusy = onBusyChange.mock.calls.findIndex(([busy]) => busy);

        expect(onBusyChange.mock.calls.slice(firstBusy).every(([busy]) => busy)).toBe(true);
        view.unmount();
        expect(onBusyChange).toHaveBeenLastCalledWith(false);
    });

    it.each([
        {status: 'RUNNING', title: '근무표를 다시 채우고 있어요', animated: true},
        {status: 'RESULT_READY', title: '근무표를 마무리하고 있어요', animated: true},
        {status: 'UNKNOWN', title: '결과를 확인하고 있어요', animated: false},
    ] as const)('presents a quiet, readable pending status: $status', async ({status, title, animated}) => {
        current.operations = [
            operation,
            {
                ...operation,
                operationId: 'generate:2',
                sequence: 2,
                executionStatus: status,
                applyStatus: 'NOT_APPLIED',
                resultVersionId: null,
            },
        ];
        renderSidebar();

        const statusMessage = await screen.findByRole('status', {name: title});

        expect(statusMessage).toHaveTextContent('(2회차)');
        expect(statusMessage).not.toHaveTextContent(/2026|11월|번째/);
        expect(statusMessage).not.toHaveTextContent(/실행 중|대상:|오전|오후/);
        expect(statusMessage.querySelectorAll('.ai-adjust-review-dot')).toHaveLength(animated ? 3 : 0);
        expect(screen.queryByText(/^자동채우기 2회차 ·/)).not.toBeInTheDocument();

        if (status === 'RUNNING') expect(statusMessage).toHaveTextContent('신청·고정근무는 그대로 유지해요.');

        if (status === 'UNKNOWN') expect(screen.getByRole('button', {name: '결과 다시 확인하기'})).toBeVisible();

        expect(mocks.execute).not.toHaveBeenCalled();
    });

    it('describes an adjustment using its own attempt count', async () => {
        current.operations = [
            operation,
            {
                ...operation,
                operationId: 'adjust:1',
                sequence: 2,
                operationType: 'ADJUST',
                executionStatus: 'RUNNING',
                resultVersionId: null,
            },
        ];
        renderSidebar();

        expect(await screen.findByRole('status', {name: '요청에 맞게 조정하고 있어요'})).toHaveTextContent('(1회차)');
        expect(mocks.execute).not.toHaveBeenCalled();
    });

    it.each(['RUNNING', 'RESULT_READY', 'UNKNOWN'] as const)('keeps rejected results out of the pending treatment: %s', async (status) => {
        current.operations = [
            {
                ...operation,
                executionStatus: status,
                resultVersionId: null,
                result: {...successfulResult, applicable: false, engineResult: {status: 'REJECTED'}},
            },
        ];
        renderSidebar();

        expect(await screen.findByText('자동채우기를 마치지 못했어요. (1회차)')).toBeVisible();
        expect(screen.getAllByRole('alert')).toHaveLength(1);
        expect(screen.getByRole('img', {name: '자동채우기를 마치지 못했어요. (1회차)'})).toBeVisible();
        expect(screen.queryByText(/^자동채우기 1회차 ·/)).not.toBeInTheDocument();
        expect(screen.queryByRole('img', {name: '자동채우기 성공'})).not.toBeInTheDocument();
        expect(document.querySelector('.ai-conversation-operation-dots')).not.toBeInTheDocument();
        expect(screen.queryByRole('status', {name: /근무표를|결과를 확인/})).not.toBeInTheDocument();
        expect(screen.queryByRole('button', {name: '결과 다시 확인하기'})).not.toBeInTheDocument();
        expect(screen.queryByRole('button', {name: '이 결과에 의견 보내기'})).not.toBeInTheDocument();
        expect(mocks.execute).not.toHaveBeenCalled();
    });

    it('can recheck an unknown result without starting a new calculation', async () => {
        current.operations = [{...operation, executionStatus: 'UNKNOWN', resultVersionId: null}];
        renderSidebar();
        await screen.findByRole('status', {name: '결과를 확인하고 있어요'});
        mocks.detail.mockClear();
        await userEvent.click(screen.getByRole('button', {name: '결과 다시 확인하기'}));

        expect(mocks.detail).toHaveBeenCalledOnce();
        expect(mocks.execute).not.toHaveBeenCalled();
    });

    it('returns a generic infeasible generation to fixed review once while preserving its failure history', async () => {
        current.operations = [
            {
                ...operation,
                executionStatus: 'FAILED',
                resultVersionId: null,
                result: {...successfulResult, applicable: false, changedCells: [], engineResult: {status: 'INFEASIBLE'}},
            },
        ];

        const onRecoverGeneration = vi.fn();
        const sidebar = renderSidebar({onRecoverGeneration});

        expect(await screen.findByText('자동채우기를 마치지 못했어요. (1회차)')).toBeVisible();
        await waitFor(() => expect(onRecoverGeneration).toHaveBeenCalledOnce());
        expect(mocks.execute).not.toHaveBeenCalled();
        expect(mocks.applyAdjustedDoc).not.toHaveBeenCalled();
        sidebar.rerender(
            sidebarElement({
                onRecoverGeneration,
                preparation: <div>고정한 근무 재확인</div>,
                autofillFlow: {
                    id: 73,
                    status: 'preparing',
                    messages: [
                        {role: 'assistant', text: '이전 고정 질문'},
                        {role: 'user', text: '이전 준비 응답'},
                    ],
                },
            }),
        );
        expect(screen.getByText('고정한 근무 재확인')).toBeVisible();
        expect(screen.getByText('자동채우기를 마치지 못했어요. (1회차)')).toBeVisible();
        sidebar.rerender(sidebarElement({onRecoverGeneration, open: false}));
        sidebar.rerender(sidebarElement({onRecoverGeneration}));
        expect(onRecoverGeneration).toHaveBeenCalledOnce();
        expect(mocks.execute).not.toHaveBeenCalled();
        sidebar.unmount();
        renderSidebar({onRecoverGeneration});
        expect(await screen.findByRole('alert')).toBeVisible();
        expect(screen.getByText('이전 고정 질문')).toBeVisible();
        expect(screen.getByText('이전 준비 응답')).toBeVisible();
        expect(onRecoverGeneration).toHaveBeenCalledOnce();
        expect(mocks.execute).not.toHaveBeenCalled();
    });

    it('waits for the page to finish generation before consuming the recovery transition', async () => {
        current.operations = [
            {
                ...operation,
                executionStatus: 'FAILED',
                resultVersionId: null,
                result: {...successfulResult, applicable: false, changedCells: [], engineResult: {status: 'INFEASIBLE'}},
            },
        ];

        const onRecoverGeneration = vi.fn();
        const sidebar = renderSidebar({onRecoverGeneration, loading: true});

        await screen.findByRole('alert');
        expect(onRecoverGeneration).not.toHaveBeenCalled();
        sidebar.rerender(sidebarElement({onRecoverGeneration, loading: false}));
        await waitFor(() => expect(onRecoverGeneration).toHaveBeenCalledOnce());
        expect(mocks.execute).not.toHaveBeenCalled();
    });

    it.each(['adjustment', 'newer_request', 'settings', 'consent', 'specific_conflict', 'suggestion'])(
        'preserves the existing recovery route for %s',
        async (kind) => {
            const failed: TConversationOperation = {
                ...operation,
                executionStatus: 'FAILED',
                resultVersionId: null,
                result: {...successfulResult, applicable: false, changedCells: [], engineResult: {status: 'INFEASIBLE'}},
            };

            if (kind === 'adjustment') failed.operationType = 'ADJUST';

            if (kind === 'newer_request')
                current.turns = [
                    {
                        eventId: 2,
                        sequence: 2,
                        actor: 'USER',
                        type: 'REQUEST_SUBMITTED',
                        text: '새 요청',
                        baseRevision: 0,
                        interpretationId: null,
                        contextHash: null,
                        interpretation: null,
                        createdAt: source.createdAt,
                    },
                ];

            if (kind === 'settings') failed.result!.failure = {reasonCode: 'NURSE_OFF_NOT_ALLOWED', message: ''};

            if (kind === 'consent') failed.result!.conflictReview = {token: 'token', expiresAt: '2099-01-01T00:00:00Z', violations: []};

            if (kind === 'specific_conflict')
                failed.result!.engineResult!.violations = [
                    {
                        type: 'WORK_REST_AVAILABILITY_CONFLICT',
                        nurseName: '합성 간호사',
                        forcedWorkDays: 6,
                        maximum: 5,
                        startDate: '2026-11-01',
                        endDate: '2026-11-06',
                    },
                ];

            if (kind === 'suggestion')
                failed.result!.failure = {
                    reasonCode: 'INFEASIBLE',
                    message: '',
                    suggestions: [
                        {
                            suggestionId: 's',
                            verificationStatus: 'VERIFIED_FEASIBLE',
                            applyEnabled: true,
                            expiresAt: '2099-01-01T00:00:00Z',
                            baseRevision: 0,
                            inputDigest: 'digest',
                            changes: [],
                        },
                    ],
                };

            current.operations = [failed];

            const onRecoverGeneration = vi.fn();

            renderSidebar({onRecoverGeneration});
            await screen.findByRole('alert');
            expect(mocks.execute).not.toHaveBeenCalled();
            expect(onRecoverGeneration).not.toHaveBeenCalled();
        },
    );

    it('uses natural English while refilling', async () => {
        await i18n.changeLanguage('en');
        current.operations = [
            operation,
            {...operation, operationId: 'generate:2', sequence: 2, executionStatus: 'RUNNING', resultVersionId: null},
        ];
        renderSidebar();

        const statusMessage = await screen.findByRole('status', {name: 'Refilling your schedule'});

        expect(statusMessage).toHaveTextContent('Requested and fixed shifts stay in place.');
        expect(statusMessage).toHaveTextContent('(Run 2)');
        expect(statusMessage).not.toHaveTextContent('2026-11');
    });

    it('keeps completion, preview and result actions in one assistant message', async () => {
        current.operations = [{...operation, result: successfulResult}];
        renderSidebar();

        const result = await screen.findByRole('region', {name: '근무표 결과'});

        expect(within(result).getByText('근무표를 채웠어요!').closest('p')).toHaveTextContent('근무표를 채웠어요! (1회차)');
        expect(within(result).getByRole('img', {name: '자동채우기 성공'})).toBeVisible();
        expect(within(result).getByTestId('conversation-result-preview')).toBeVisible();
        expect(within(result).getByLabelText('변경된 근무 1칸')).toHaveTextContent(/^1칸 변경$/);
        expect(within(result).queryByText('1칸이 달라졌어요.')).not.toBeInTheDocument();
        expect(within(result).queryByText(/만들 당시의 결과예요/)).not.toBeInTheDocument();
        expect(within(result).getAllByRole('button', {name: '근무표 살펴보기'})).toHaveLength(1);
        expect(within(result).queryByRole('button', {name: /근무표 확인|변경 비교/})).not.toBeInTheDocument();
        expect(within(result).getByRole('button', {name: '이 결과에 의견 보내기'})).toBeVisible();
        expect(screen.getAllByText('듀팅 AI')).toHaveLength(1);
        expect(screen.queryByText('바꾸고 싶은 부분이 있나요?')).not.toBeInTheDocument();
        expect(within(result).getByRole('group', {name: i18n.t('aiAdjust.snapshot.nextAction')})).toBeVisible();
    });

    it('keeps the next choices inside the saved success result and confirms the schedule outside that result', async () => {
        const onConfirm = vi.fn();
        const onPrepareGeneration = vi.fn();

        current.operations = [{...operation, result: successfulResult}];
        renderSidebar({resultActions: {canConfirm: true, onConfirm}, onPrepareGeneration});

        const result = await screen.findByRole('region', {name: '근무표 결과'});
        const confirm = screen.getByRole('button', {name: i18n.t('aiAdjust.chat.confirmSchedule')});

        expect(within(result).getByTestId('conversation-result-preview')).toBeVisible();
        expect(within(result).getByRole('button', {name: i18n.t('aiAdjust.chat.regenerate')})).toBeEnabled();
        expect(within(result).getByRole('button', {name: i18n.t('aiAdjust.chat.modify')})).toBeEnabled();
        expect(screen.getAllByRole('button', {name: i18n.t('aiAdjust.chat.regenerate')})).toHaveLength(1);
        expect(screen.getAllByRole('button', {name: i18n.t('aiAdjust.chat.modify')})).toHaveLength(1);
        expect(result).not.toContainElement(confirm);
        await userEvent.click(confirm);
        expect(onConfirm).toHaveBeenCalledOnce();
        expect(onPrepareGeneration).not.toHaveBeenCalled();
        expect(mocks.execute).not.toHaveBeenCalled();
    });

    it('offers a fresh change from an executed semantic result while keeping its reviewed conditions read-only', async () => {
        const {proposal} = semanticRequest();

        proposal.type = 'SEMANTIC_PLAN_CONFIRMED';
        proposal.semanticPlan!.state = 'CONFIRMED';
        proposal.semanticPlan!.confirmationAllowed = false;
        current.operations = [
            {
                ...operation,
                sequence: 3,
                operationType: 'ADJUST',
                interpretationId: proposal.interpretationId,
                result: {...successfulResult, operationType: 'ADJUST'},
            },
        ];
        renderSidebar();

        const result = await screen.findByRole('region', {name: '근무표 결과'});
        const reviewed = screen.getByRole('region', {name: '요청 조건 확인'});

        expect(within(reviewed).queryByRole('button')).not.toBeInTheDocument();
        await userEvent.click(within(result).getByRole('button', {name: i18n.t('aiAdjust.chat.modify')}));
        expect(screen.getByRole('textbox')).toHaveFocus();
        expect(screen.getByRole('textbox')).toHaveValue('');
        expect(within(result).queryByRole('button', {name: i18n.t('aiAdjust.chat.modify')})).not.toBeInTheDocument();
        expect(within(result).queryByRole('button', {name: i18n.t('aiAdjust.chat.regenerate')})).not.toBeInTheDocument();
        expect(within(result).getByTestId('conversation-result-preview')).toBeVisible();
        expect(within(reviewed).queryByRole('button')).not.toBeInTheDocument();
        expect(mocks.confirmPlan).not.toHaveBeenCalled();
        expect(mocks.execute).not.toHaveBeenCalled();
    });

    it('offers next choices only on the latest saved result and consumes them when regeneration is chosen', async () => {
        const onPrepareGeneration = vi.fn();
        const onConfirm = vi.fn();

        current.operations = [
            {...operation, result: successfulResult},
            {...operation, operationId: 'generate:latest', sequence: 2, resultVersionId: 'result:latest', result: successfulResult},
        ];
        renderSidebar({onPrepareGeneration, resultActions: {canConfirm: true, onConfirm}});

        const results = await screen.findAllByRole('region', {name: '근무표 결과'});

        expect(results).toHaveLength(2);
        expect(within(results[0]).queryByRole('button', {name: i18n.t('aiAdjust.chat.regenerate')})).not.toBeInTheDocument();
        expect(within(results[0]).queryByRole('button', {name: i18n.t('aiAdjust.chat.modify')})).not.toBeInTheDocument();
        expect(within(results[1]).getByRole('button', {name: i18n.t('aiAdjust.chat.modify')})).toBeEnabled();
        await userEvent.click(within(results[1]).getByRole('button', {name: i18n.t('aiAdjust.chat.regenerate')}));
        expect(onPrepareGeneration).toHaveBeenCalledOnce();
        expect(onConfirm).not.toHaveBeenCalled();
        expect(mocks.execute).not.toHaveBeenCalled();
        expect(screen.queryByRole('button', {name: i18n.t('aiAdjust.chat.regenerate')})).not.toBeInTheDocument();
        expect(screen.queryByRole('button', {name: i18n.t('aiAdjust.chat.modify')})).not.toBeInTheDocument();
        expect(screen.getAllByTestId('conversation-result-preview')).toHaveLength(2);
    });

    it('shows historical rejected review drafts as failures', async () => {
        const docBefore = useShiftEditorStore.getState().doc;

        current.operations = [
            {
                ...operation,
                result: {
                    ...successfulResult,
                    approvable: false,
                    validationTarget: 'RESULT',
                    engineResult: {status: 'REJECTED', candidateVisible: true, reviewRequired: true},
                    validation: {...successfulResult.validation!, summary: {valid: false, hardCount: 1, softCount: 0, totalCount: 1}},
                },
            },
        ];
        renderSidebar();

        expect(
            await screen.findByText(/AI가 만든 근무표가 요청한 조건을 지켰는지 확인하는 단계에서 통과하지 못해 적용하지 않았어요/),
        ).toBeVisible();
        expect(screen.getByRole('alert')).toHaveTextContent('조건끼리 충돌하는지는 아직 확인되지 않았어요.');
        expect(screen.queryByRole('region', {name: '근무표 결과'})).not.toBeInTheDocument();
        expect(screen.queryByText('근무표를 채웠어요!')).not.toBeInTheDocument();
        expect(useShiftEditorStore.getState().doc).toBe(docBefore);
        expect(mocks.execute).not.toHaveBeenCalled();
    });

    it('does not claim local application after refreshing a saved APPLIED result', async () => {
        current.operations = [{...operation, result: successfulResult}];
        useShiftEditorStore.getState().setDoc({...useShiftEditorStore.getState().doc, rows: [{workerId: '1', cells: ['E']}]});

        const first = renderSidebar();

        await screen.findByLabelText('변경된 근무 1칸');
        expectNoLocalApplicationClaim();
        first.unmount();
        renderSidebar();
        await screen.findByLabelText('변경된 근무 1칸');
        expectNoLocalApplicationClaim();
        expect(useShiftEditorStore.getState().doc.rows[0]?.cells).toEqual(['E']);
        expect(mocks.applyAdjustedDoc).not.toHaveBeenCalled();
    });
    it('does not claim local application when opening an earlier APPLIED result', async () => {
        current.operations = [
            {...operation, result: successfulResult},
            {...operation, operationId: 'later:2', sequence: 2},
        ];
        renderSidebar();
        await userEvent.click((await screen.findAllByRole('button', {name: /근무표 살펴보기|Explore schedule/}))[0]);
        await screen.findByRole('dialog');
        await userEvent.click(screen.getByRole('button', {name: '닫기'}));
        expectNoLocalApplicationClaim();
        expect(mocks.applyAdjustedDoc).not.toHaveBeenCalled();
        expect(useShiftEditorStore.getState().doc.rows[0]?.cells).toEqual(['O']);
    });
    it('does not describe historical semantic APPLIED as current browser application after a saved manual edit', async () => {
        current.conversation.currentVersionId = 'manual-latest';
        current.conversation.latestInterpretationId = 'confirmed:1';
        current.draft = {...source, versionId: 'manual-latest'};
        current.operations = [{...operation, interpretationId: 'confirmed:1', result: successfulResult}];
        current.turns = [
            {
                eventId: 1,
                sequence: 1,
                actor: 'ASSISTANT',
                type: 'SEMANTIC_PLAN_CONFIRMED',
                text: null,
                interpretationId: 'confirmed:1',
                baseRevision: 0,
                contextHash: 'rules:1',
                interpretation: null,
                createdAt: source.createdAt,
                semanticPlan: {
                    planId: 'plan:1',
                    planHash: 'a'.repeat(64),
                    sourceVersionId: source.versionId,
                    state: 'CONFIRMED',
                    summary: 'D 배정',
                    confirmationAllowed: false,
                    reasonCodes: [],
                    conditions: [
                        {
                            intentId: 'intent:1',
                            action: 'ASSIGN',
                            nurseIds: [1],
                            dates: ['2026-11-01'],
                            shiftCodes: ['D'],
                            quantifier: 'EACH',
                            modality: 'HARD',
                            operator: null,
                            count: null,
                            sourceSpan: {quote: 'D 배정'},
                        },
                    ],
                },
            },
        ];
        renderSidebar();
        await screen.findByLabelText('변경된 근무 1칸');
        expect(screen.queryByText('이 요청을 반영했어요.')).not.toBeInTheDocument();
        expect(screen.getByText('이 요청으로 계산을 마쳤어요.')).toBeVisible();
        expect(useShiftEditorStore.getState().doc.rows[0]?.cells).toEqual(['O']);
        expect(mocks.applyAdjustedDoc).not.toHaveBeenCalled();
    });
    it('retains the previous receipt in history without claiming another report was sent', async () => {
        renderSidebar();
        await userEvent.click(await screen.findByRole('button', {name: '이 결과에 의견 보내기'}));
        await userEvent.type(screen.getByRole('textbox', {name: '의견'}), '첫 번째 합성 의견');
        await userEvent.click(screen.getByRole('button', {name: '의견 보내기'}));
        expect(await screen.findByText('의견을 보냈어요. 확인해서 개선할게요.')).toBeVisible();
        await userEvent.click(screen.getByRole('button', {name: '이 결과에 의견 보내기'}));
        expect(screen.getAllByText('의견을 보냈어요. 확인해서 개선할게요.')).toHaveLength(1);
        expect(within(screen.getByRole('dialog')).queryByText('의견을 보냈어요. 확인해서 개선할게요.')).not.toBeInTheDocument();
        expect(screen.getByRole('textbox', {name: '의견'})).toHaveValue('');
        expect(mocks.report).toHaveBeenCalledOnce();
    });
    it('opens feedback in a focused modal with a clear target and hides background actions', async () => {
        renderSidebar();

        const preview = await screen.findByRole('button', {name: '근무표 살펴보기'});

        await userEvent.click(screen.getByRole('button', {name: '이 결과에 의견 보내기'}));

        const dialog = screen.getByRole('dialog', {name: '결과에 의견 보내기'});
        const note = within(dialog).getByRole('textbox', {name: '의견'});

        expect(dialog).toHaveAttribute('aria-modal', 'true');
        expect(within(dialog).getByText('자동채우기 1회차 결과')).toBeVisible();
        expect(within(dialog).getByText('요청과 다른 점이나 개선할 점을 알려 주세요.')).toBeVisible();
        expect(screen.queryByText(/의견 대상:/)).not.toBeInTheDocument();
        expect(screen.queryByText(/새 신고|24시간|취소하면 이 신고/)).not.toBeInTheDocument();
        expect(note).toHaveFocus();
        expect(within(dialog).getByRole('button', {name: '의견 보내기'})).toBeDisabled();
        expect(screen.queryByRole('button', {name: '근무표 살펴보기'})).not.toBeInTheDocument();
        act(() => preview.focus());
        await waitFor(() => expect(dialog.contains(document.activeElement)).toBe(true));

        for (let i = 0; i < 6; i++) {
            await userEvent.tab();
            expect(dialog.contains(document.activeElement)).toBe(true);
        }

        expect(mocks.version).not.toHaveBeenCalled();
        expect(mocks.report).not.toHaveBeenCalled();
    });
    it('reports the selected earlier result and returns keyboard focus after cancel', async () => {
        current.operations = [operation, {...operation, operationId: 'later:2', sequence: 2}];
        renderSidebar();

        const buttons = await screen.findAllByRole('button', {name: '이 결과에 의견 보내기'});

        await userEvent.click(buttons[0]);
        expect(screen.getByText('자동채우기 1회차 결과')).toBeVisible();

        const note = screen.getByRole('textbox', {name: '의견'});

        expect(note).toHaveFocus();
        await userEvent.type(note, '요청과 달라요');
        await userEvent.click(screen.getByRole('button', {name: '취소'}));
        await waitFor(() => expect(buttons[0]).toHaveFocus());
        await userEvent.click(buttons[0]);
        expect(screen.getByRole('textbox', {name: '의견'})).toHaveValue('');
        await userEvent.type(screen.getByRole('textbox', {name: '의견'}), '조건을 다시 확인해 주세요');
        await userEvent.click(screen.getByRole('button', {name: '의견 보내기'}));
        await waitFor(() =>
            expect(mocks.report).toHaveBeenCalledWith(1, operation.operationId, '조건을 다시 확인해 주세요', expect.any(String)),
        );
        expect(mocks.report).toHaveBeenCalledOnce();
        await waitFor(() => expect(buttons[0]).toHaveFocus());
    });
    it.each(['cancel', 'close', 'escape', 'outside'] as const)(
        'cancels feedback through %s and starts the next report with a new key',
        async (dismissal) => {
            mocks.report.mockRejectedValue(new Error('lost acknowledgement'));

            const closeSidebar = vi.fn();

            renderSidebar({onClose: closeSidebar});

            const trigger = await screen.findByRole('button', {name: '이 결과에 의견 보내기'});

            await userEvent.click(trigger);
            await userEvent.type(screen.getByRole('textbox', {name: '의견'}), '같은 의견');
            await userEvent.click(screen.getByRole('button', {name: '의견 보내기'}));
            await waitFor(() => expect(screen.getByRole('button', {name: '의견 보내기'})).toBeEnabled());

            const firstKey = mocks.report.mock.calls[0][3];

            if (dismissal === 'escape') await userEvent.keyboard('{Escape}');
            else if (dismissal === 'outside') await userEvent.click(screen.getByTestId('ai-feedback-overlay'));
            else await userEvent.click(screen.getByRole('button', {name: dismissal === 'close' ? '의견 작성 닫기' : '취소'}));

            await waitFor(() => expect(screen.queryByRole('dialog', {name: '결과에 의견 보내기'})).not.toBeInTheDocument());
            await waitFor(() => expect(trigger).toHaveFocus());
            expect(closeSidebar).not.toHaveBeenCalled();
            expect(Object.keys(sessionStorage).filter((name) => name.startsWith(REPORT_SESSION_PREFIX))).toHaveLength(0);
            await userEvent.click(trigger);
            expect(screen.getByRole('textbox', {name: '의견'})).toHaveValue('');
            await userEvent.type(screen.getByRole('textbox', {name: '의견'}), '같은 의견');
            await userEvent.click(screen.getByRole('button', {name: '의견 보내기'}));
            await waitFor(() => expect(mocks.report).toHaveBeenCalledTimes(2));
            expect(mocks.report.mock.calls[1][3]).not.toBe(firstKey);
        },
    );
    it('hides the feedback modal with its sidebar and preserves the draft and recovery key when reopened', async () => {
        mocks.report.mockRejectedValueOnce(new Error('lost acknowledgement'));

        const sidebar = renderSidebar();

        await userEvent.click(await screen.findByRole('button', {name: '이 결과에 의견 보내기'}));
        await userEvent.type(screen.getByRole('textbox', {name: '의견'}), '다시 열어 이어 쓸 의견');
        await userEvent.click(screen.getByRole('button', {name: '의견 보내기'}));
        await waitFor(() => expect(screen.getByRole('button', {name: '의견 보내기'})).toBeEnabled());

        const firstKey = mocks.report.mock.calls[0][3];

        sidebar.rerender(sidebarElement({open: false}));
        expect(screen.queryByRole('dialog', {name: '결과에 의견 보내기', hidden: true})).not.toBeInTheDocument();
        expect(Object.keys(sessionStorage).filter((name) => name.startsWith(REPORT_SESSION_PREFIX))).toHaveLength(1);
        sidebar.rerender(sidebarElement());

        const dialog = await screen.findByRole('dialog', {name: '결과에 의견 보내기'});
        const note = within(dialog).getByRole('textbox', {name: '의견'});

        expect(note).toHaveValue('다시 열어 이어 쓸 의견');
        expect(note).toHaveFocus();
        await userEvent.click(within(dialog).getByRole('button', {name: '의견 보내기'}));
        await screen.findByText('의견을 보냈어요. 확인해서 개선할게요.');
        expect(mocks.report.mock.calls[1][3]).toBe(firstKey);
    });
    it('reuses a report key after a lost acknowledgement and creates a new key after success', async () => {
        mocks.report.mockRejectedValueOnce(new Error('response lost')).mockResolvedValue({incidentId: 'accepted:1'});
        renderSidebar();
        await userEvent.click(await screen.findByRole('button', {name: '이 결과에 의견 보내기'}));
        await userEvent.type(screen.getByRole('textbox', {name: '의견'}), '조건이 달라요');
        await userEvent.click(screen.getByRole('button', {name: '의견 보내기'}));
        await waitFor(() => expect(screen.getByRole('button', {name: '의견 보내기'})).toBeEnabled());

        const first = mocks.report.mock.calls[0];

        expect(first.slice(0, 3)).toEqual([1, operation.operationId, '조건이 달라요']);
        expect(first[3]).toMatch(/^[0-9a-f-]{36}$/i);
        expect(screen.queryByText('의견을 보냈어요. 확인해서 개선할게요.')).not.toBeInTheDocument();
        await userEvent.click(screen.getByRole('button', {name: '의견 보내기'}));
        await waitFor(() => expect(screen.queryByRole('dialog', {name: '결과에 의견 보내기'})).not.toBeInTheDocument());
        expect(mocks.report.mock.calls[1]).toEqual(first);
        await userEvent.click(screen.getByRole('button', {name: '이 결과에 의견 보내기'}));
        await userEvent.type(screen.getByRole('textbox', {name: '의견'}), '조건이 달라요');
        await userEvent.click(screen.getByRole('button', {name: '의견 보내기'}));
        await waitFor(() => expect(mocks.report).toHaveBeenCalledTimes(3));
        expect(mocks.report.mock.calls[2][3]).not.toBe(first[3]);
    });
    it('recovers a lost-acknowledgement report after remount and note re-entry without duplicating the synthetic receipt', async () => {
        const accepted = new Map<string, string>();

        let loseResponse = true;

        mocks.report.mockImplementation(async (_conversation, _operation, _note, key: string) => {
            if (!accepted.has(key)) accepted.set(key, `accepted:${accepted.size + 1}`);

            if (loseResponse) {
                loseResponse = false;
                throw new Error('lost acknowledgement after storing');
            }

            return {incidentId: accepted.get(key)};
        });

        const first = renderSidebar();

        await userEvent.click(await screen.findByRole('button', {name: '이 결과에 의견 보내기'}));
        await userEvent.type(screen.getByRole('textbox', {name: '의견'}), '새로고침 뒤 같은 신고');
        await userEvent.click(screen.getByRole('button', {name: '의견 보내기'}));
        await waitFor(() => expect(screen.getByRole('button', {name: '의견 보내기'})).toBeEnabled());

        const key = mocks.report.mock.calls[0][3];
        const receipts = () => Object.keys(sessionStorage).filter((name) => name.startsWith(REPORT_SESSION_PREFIX));

        expect(receipts()).toHaveLength(1);
        expect(sessionStorage.getItem(receipts()[0])).not.toContain('새로고침 뒤 같은 신고');
        first.unmount();
        renderSidebar();
        await userEvent.click(await screen.findByRole('button', {name: '이 결과에 의견 보내기'}));

        const note = screen.getByRole('textbox', {name: '의견'});

        expect(note).toHaveValue('');
        await userEvent.type(note, '새로고침 뒤 같은 신고');
        await userEvent.click(screen.getByRole('button', {name: '의견 보내기'}));
        await screen.findByText('의견을 보냈어요. 확인해서 개선할게요.');
        expect(mocks.report.mock.calls[1][3]).toBe(key);
        expect(accepted.size).toBe(1);
        expect(receipts()).toHaveLength(0);
    });
    it('keeps recovery metadata when an old request acknowledges success after the component unmounts', async () => {
        let acknowledge!: (value: {incidentId: string}) => void;

        mocks.report.mockImplementationOnce(
            () =>
                new Promise((resolve) => {
                    acknowledge = resolve;
                }),
        );

        const first = renderSidebar();

        await userEvent.click(await screen.findByRole('button', {name: '이 결과에 의견 보내기'}));
        await userEvent.type(screen.getByRole('textbox', {name: '의견'}), '늦은 응답 신고');
        await userEvent.click(screen.getByRole('button', {name: '의견 보내기'}));
        await waitFor(() => expect(mocks.report).toHaveBeenCalledOnce());

        const key = mocks.report.mock.calls[0][3];

        first.unmount();
        renderSidebar();
        await act(async () => acknowledge({incidentId: 'accepted:1'}));
        expect(Object.keys(sessionStorage).filter((name) => name.startsWith(REPORT_SESSION_PREFIX))).toHaveLength(1);
        await userEvent.click(await screen.findByRole('button', {name: '이 결과에 의견 보내기'}));
        await userEvent.type(screen.getByRole('textbox', {name: '의견'}), '늦은 응답 신고');
        await userEvent.click(screen.getByRole('button', {name: '의견 보내기'}));
        await screen.findByText('의견을 보냈어요. 확인해서 개선할게요.');
        expect(mocks.report.mock.calls[1][3]).toBe(key);
    });
    it('keeps sending and same-mount retry working when session metadata cannot be saved', async () => {
        const first = renderSidebar();

        await userEvent.click(await screen.findByRole('button', {name: '이 결과에 의견 보내기'}));
        mocks.report.mockRejectedValueOnce(new Error('lost acknowledgement'));
        vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
            throw new Error('storage blocked');
        });

        const note = screen.getByRole('textbox', {name: '의견'});

        await userEvent.type(note, '입력을 유지해 주세요');
        await userEvent.click(screen.getByRole('button', {name: '의견 보내기'}));
        await waitFor(() => expect(note).toBeEnabled());
        expect(note).toHaveValue('입력을 유지해 주세요');
        expect(await screen.findByText('작성한 내용은 유지돼요. 이 창에서 다시 보내 주세요.')).toBeVisible();
        await userEvent.click(screen.getByRole('button', {name: '의견 보내기'}));
        await screen.findByText('의견을 보냈어요. 확인해서 개선할게요.');
        expect(mocks.report.mock.calls[1][3]).toBe(mocks.report.mock.calls[0][3]);
        first.unmount();
    });
    it('changes the report key after editing the note or choosing another operation', async () => {
        mocks.report.mockRejectedValue(new Error('response lost'));
        current.operations = [operation, {...operation, operationId: 'later:2', sequence: 2}];
        renderSidebar();

        const reportButtons = await screen.findAllByRole('button', {name: '이 결과에 의견 보내기'});

        await userEvent.click(reportButtons[0]);

        const note = screen.getByRole('textbox', {name: '의견'});

        await userEvent.type(note, '첫 의견');
        await userEvent.click(screen.getByRole('button', {name: '의견 보내기'}));
        await waitFor(() => expect(note).toBeEnabled());
        await userEvent.clear(note);
        await userEvent.type(note, '다른 의견');
        await userEvent.click(screen.getByRole('button', {name: '의견 보내기'}));
        await waitFor(() => expect(note).toBeEnabled());
        await userEvent.click(screen.getByRole('button', {name: '취소'}));
        await userEvent.click(reportButtons[1]);
        await userEvent.type(screen.getByRole('textbox', {name: '의견'}), '다른 의견');
        await userEvent.click(screen.getByRole('button', {name: '의견 보내기'}));
        await waitFor(() => expect(mocks.report).toHaveBeenCalledTimes(3));
        expect(new Set(mocks.report.mock.calls.map((call) => call[3])).size).toBe(3);
        expect(mocks.report.mock.calls[2][1]).toBe('later:2');
    });
    it('clears an unfinished report when starting a new request section', async () => {
        mocks.startSegment.mockImplementationOnce(startFreshSection);
        renderSidebar();
        await userEvent.click(await screen.findByRole('button', {name: '이 결과에 의견 보내기'}));
        await userEvent.type(screen.getByRole('textbox', {name: '의견'}), '이전 결과 의견');
        await userEvent.click(screen.getByRole('button', {name: '취소'}));
        await waitFor(() => expect(screen.queryByRole('dialog', {name: '결과에 의견 보내기'})).not.toBeInTheDocument());
        await userEvent.click(screen.getByRole('button', {name: '초기화'}));
        await waitFor(() => expect(screen.queryByRole('dialog', {name: '결과에 의견 보내기'})).not.toBeInTheDocument());
        expect(screen.queryByRole('button', {name: '이 결과에 의견 보내기'})).not.toBeInTheDocument();
        expect(screen.queryByRole('textbox', {name: '의견'})).not.toBeInTheDocument();
        expect(mocks.report).not.toHaveBeenCalled();
    });
    it('opens a comparison after cancelling feedback and keeps focus in the comparison', async () => {
        renderSidebar();
        await userEvent.click(await screen.findByRole('button', {name: '이 결과에 의견 보내기'}));
        await userEvent.click(screen.getByRole('button', {name: '취소'}));
        await waitFor(() => expect(screen.queryByRole('dialog', {name: '결과에 의견 보내기'})).not.toBeInTheDocument());
        await userEvent.click(screen.getByRole('button', {name: '근무표 살펴보기'}));

        const dialog = await screen.findByRole('dialog');

        await userEvent.click(within(dialog).getByRole('button', {name: '변경 전'}));

        await waitFor(() => expect(dialog.contains(document.activeElement)).toBe(true));
        expect(screen.queryByRole('textbox', {name: '의견', hidden: true})).not.toBeInTheDocument();
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

        const note = screen.getByRole('textbox', {name: '의견'});

        await userEvent.type(note, '검토해 주세요');

        const send = screen.getByRole('button', {name: '의견 보내기'});

        await userEvent.click(send);
        expect(send).toBeDisabled();
        expect(send).toHaveAttribute('aria-busy', 'true');
        expect(screen.getByRole('button', {name: '취소'})).toBeDisabled();
        expect(screen.getByRole('button', {name: '의견 작성 닫기'})).toBeDisabled();
        await userEvent.keyboard('{Escape}');
        expect(screen.getByRole('dialog', {name: '결과에 의견 보내기'})).toBeVisible();
        await userEvent.click(screen.getByTestId('ai-feedback-overlay'));
        expect(screen.getByRole('dialog', {name: '결과에 의견 보내기'})).toBeVisible();
        await userEvent.click(send);
        expect(mocks.report).toHaveBeenCalledOnce();
        await act(async () => reject(new Error('offline')));
        expect(note).toHaveValue('검토해 주세요');
        expect(send).toBeEnabled();
        expect(screen.getByRole('alert')).toHaveTextContent('의견을 보내지 못했어요. 다시 시도해 주세요.');
        expect(screen.getByText('자동채우기 1회차 결과')).toBeVisible();
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

            await screen.findByLabelText('변경된 근무 1칸');

            const summary = screen.getByRole('region', {name: '근무표 결과'});

            if (applyStatus === 'APPLIED') expectNoLocalApplicationClaim();
            else expect(summary).toHaveTextContent('작성 중인 표가 바뀌어 자동으로 반영하지 않았어요.');

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
        await userEvent.click(await screen.findByRole('button', {name: /근무표 살펴보기|Explore schedule/}));
        await waitFor(() => expect(mocks.version).toHaveBeenCalledOnce());
        expect(screen.getAllByText('근무표 불러오는 중')).toHaveLength(1);
        expect(screen.queryByText('요청 확인 중')).not.toBeInTheDocument();
        expect(screen.queryByText('근무표를 채우고 있어요')).not.toBeInTheDocument();
        expect(onBusyChange.mock.calls.every(([value]) => value === false)).toBe(true);
        await act(async () => resolveVersion(source));
        expect(await screen.findByRole('dialog')).toBeVisible();
        expect(screen.queryByText('근무표 불러오는 중')).not.toBeInTheDocument();
    });

    it('loads comparison inside the shared viewer and returns focus to its entry', async () => {
        mocks.version.mockImplementation(async (id: string) => ({...source, versionId: id}));
        renderSidebar();

        const entry = await screen.findByRole('button', {name: '근무표 살펴보기'});

        await userEvent.click(entry);

        const dialog = await screen.findByRole('dialog');

        expect(mocks.version).toHaveBeenCalledExactlyOnceWith('result:1');
        expect(within(dialog).getByRole('button', {name: '변경 후'})).toHaveAttribute('aria-pressed', 'true');
        expect(within(dialog).queryByRole('button', {name: '결과 근무표'})).not.toBeInTheDocument();
        await userEvent.click(await within(dialog).findByRole('button', {name: '변경 전'}));
        expect(mocks.version).toHaveBeenNthCalledWith(2, 'source:1');
        expect(within(dialog).getByRole('button', {name: '변경 전 표로 이어서 작성하기'})).toBeEnabled();
        await userEvent.click(within(dialog).getByRole('button', {name: '변경 후'}));
        expect(within(dialog).getByRole('button', {name: '이 표로 이어서 작성하기'})).toBeEnabled();
        await userEvent.click(within(dialog).getByRole('button', {name: '닫기'}));
        await waitFor(() => expect(entry).toHaveFocus());
        expect(mocks.applyAdjustedDoc).not.toHaveBeenCalled();
        expect(mocks.branch).not.toHaveBeenCalled();
    });

    it('ignores a saved-result response after the sidebar closes', async () => {
        let resolveVersion!: (value: TResultVersion) => void;

        mocks.version.mockImplementationOnce(
            () =>
                new Promise<TResultVersion>((resolve) => {
                    resolveVersion = resolve;
                }),
        );

        const sidebar = renderSidebar();

        await userEvent.click(await screen.findByRole('button', {name: '근무표 살펴보기'}));
        await waitFor(() => expect(mocks.version).toHaveBeenCalledOnce());
        sidebar.rerender(sidebarElement({open: false}));
        await act(async () => resolveVersion({...source, versionId: 'result:1'}));
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        sidebar.rerender(sidebarElement());
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('keeps the completed result usable when loading the comparison fails', async () => {
        mocks.version.mockResolvedValueOnce({...source, versionId: 'result:1'}).mockRejectedValueOnce(new Error('offline'));
        renderSidebar();
        await userEvent.click(await screen.findByRole('button', {name: '근무표 살펴보기'}));

        const dialog = await screen.findByRole('dialog');

        await userEvent.click(within(dialog).getByRole('button', {name: '변경 전'}));
        expect(await within(dialog).findByRole('alert')).toHaveTextContent('변경 전 근무표를 불러오지 못했어요.');
        expect(within(dialog).getByRole('region', {name: '근무표 전체 보기'})).toBeVisible();
        expect(within(dialog).getByRole('button', {name: '이 표로 이어서 작성하기'})).toBeDisabled();
        await userEvent.click(within(dialog).getByRole('button', {name: '변경 후'}));
        expect(within(dialog).getByRole('button', {name: '이 표로 이어서 작성하기'})).toBeEnabled();
        expect(mocks.applyAdjustedDoc).not.toHaveBeenCalled();
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
        expect((await screen.findByText('근무표를 채웠어요!')).closest('p')).toHaveTextContent('근무표를 채웠어요! (1회차)');
        expect(screen.queryByText('2026년 11월 · 1번째 자동채우기')).not.toBeInTheDocument();
        expect(screen.getByText('근무표를 조정했어요!').closest('p')).toHaveTextContent('근무표를 조정했어요! (1회차)');
        expect(screen.getByText('자동채우기를 마치지 못했어요. (2회차)')).toBeVisible();
        expect(screen.queryByText(/^자동채우기 2회차 ·/)).not.toBeInTheDocument();
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

        const resultTitle = await screen.findByText(unchanged ? '이번에는 바뀐 근무가 없어요.' : '근무표를 조정했어요!');

        expect(resultTitle.closest('p')).toHaveTextContent('(1회차)');

        const message = screen.queryByText(/이번에는 바뀐 근무가 없어요|No shifts changed this time/);

        if (unchanged) expect(message).toBeVisible();
        else expect(message).not.toBeInTheDocument();

        expect(screen.getAllByText('듀팅 AI')).toHaveLength(1);
        expect(screen.queryByText('더 바꾸고 싶은 점이 있나요?')).not.toBeInTheDocument();

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
        expect(history.getByRole('img', {name: '자동채우기를 마치지 못했어요. (1회차)'})).toBeVisible();
        expect(history.queryByRole('button', {name: /다시 시도하기|Try again/})).not.toBeInTheDocument();
        expect(history.queryByRole('button', {name: /근무표 살펴보기|Explore schedule/})).not.toBeInTheDocument();
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

        await userEvent.click(history.getByRole('button', {name: /근무표 살펴보기|Explore schedule/}));

        const dialog = await screen.findByRole('dialog');

        expect(mocks.version).not.toHaveBeenCalledWith('source:1');
        await userEvent.click(within(dialog).getByRole('button', {name: '변경 전'}));
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
            const docBefore = useShiftEditorStore.getState().doc;

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
            expect(screen.getByRole('img', {name: '자동채우기를 마치지 못했어요. (1회차)'})).toBeVisible();
            expect(screen.queryByText(/근무표를 채웠어요.|Your schedule is ready/)).not.toBeInTheDocument();
            expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
            expect(onGenerated).not.toHaveBeenCalled();

            if (reason === 'solver_result_failed_final_gate')
                expect(screen.getByRole('alert')).toHaveTextContent('조건끼리 충돌하는지는 아직 확인되지 않았어요.');

            expect(screen.getByRole('button', {name: /요청 수정하기|Edit request/})).toBeEnabled();
            await userEvent.click(screen.getByRole('button', {name: /다시 시도하기|Try again/}));
            expect(onPrepareGeneration).toHaveBeenCalledOnce();
            expect(useShiftEditorStore.getState().doc).toBe(docBefore);
            expect(onGenerated).not.toHaveBeenCalled();

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
        expect(
            screen.queryByRole('button', {
                name: /^수정 요청하기$|^Request changes$|^수정하고 싶은 부분이 있어요$|^I have some changes in mind$/,
            }),
        ).not.toBeInTheDocument();
        expect(mocks.execute).not.toHaveBeenCalled();
    });

    it('returns whole-schedule requests to preparation instead of running immediately', async () => {
        const prepare = vi.fn();

        renderSidebar({onPrepareGeneration: prepare});
        await userEvent.click(
            await screen.findByRole('button', {
                name: /^다시 채우기$|^Refill$|^한 번 더 채워볼게요$|^Try filling it again$|^같은 조건으로 다시 채울게요$|^Refill with the same conditions$/,
            }),
        );
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

        await userEvent.click(
            screen.getByRole('button', {
                name: /^다시 채우기$|^Refill$|^한 번 더 채워볼게요$|^Try filling it again$|^같은 조건으로 다시 채울게요$|^Refill with the same conditions$/,
            }),
        );
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
        expect(
            screen.getByText(
                /^다시 채우기$|^Refill$|^한 번 더 채워볼게요$|^Try filling it again$|^같은 조건으로 다시 채울게요$|^Refill with the same conditions$/,
            ),
        ).toBeVisible();
        expect(panel.textContent).toMatch(
            /이대로 자동채우기[\s\S]*(근무표를 채웠어요.|Your schedule is ready)[\s\S]*(한 번 더 채워볼게요|Try filling it again|같은 조건으로 다시 채울게요|Refill with the same conditions)[\s\S]*두 번째 고정 확인/,
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

        const first = renderSidebar();

        await waitFor(() => expect(mocks.preferences).toHaveBeenCalled());
        await userEvent.click(
            screen.getByRole('button', {
                name: /^수정 요청하기$|^Request changes$|^수정하고 싶은 부분이 있어요$|^I have some changes in mind$/,
            }),
        );
        await userEvent.type(screen.getByRole('textbox'), '오프 균형을 맞춰줘');
        await userEvent.click(screen.getByRole('button', {name: /요청 보내기|Send request/}));
        expect(await screen.findByRole('alert')).toHaveTextContent(/권한|access/);
        expect(screen.getByRole('textbox')).toHaveValue('오프 균형을 맞춰줘');
        expect(mocks.execute).not.toHaveBeenCalled();

        const message = screen.getByRole('alert').textContent!;

        first.unmount();
        renderSidebar();
        await waitFor(() => expect(mocks.preferences).toHaveBeenCalledTimes(2));
        expect(screen.getByRole('textbox')).toHaveValue('오프 균형을 맞춰줘');
        expect(await screen.findByRole('region', {name: i18n.t('aiAdjust.failure.title')})).toHaveTextContent(message);
        expect(screen.queryByRole('alert')).not.toBeInTheDocument();
        expect(mocks.interpret).toHaveBeenCalledOnce();
        expect(mocks.execute).not.toHaveBeenCalled();
    });

    it('loads records without re-executing and previews a result without mutating the editor', async () => {
        renderSidebar();
        await userEvent.click(await screen.findByRole('button', {name: /근무표 살펴보기|Explore schedule/}));
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
        await userEvent.click(
            screen.getByRole('button', {
                name: /^수정 요청하기$|^Request changes$|^수정하고 싶은 부분이 있어요$|^I have some changes in mind$/,
            }),
        );
        await userEvent.type(screen.getByRole('textbox'), '연속 근무를 줄여줘');
        await userEvent.click(screen.getByRole('button', {name: /요청 보내기|Send request/}));
        await screen.findByText(i18n.t('aiAdjust.understood'));
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
        expectNoLocalApplicationClaim();
        await userEvent.click(screen.getByRole('button', {name: '이 결과에 의견 보내기'}));
        expect(screen.getByText('작성 중인 표가 바뀌어서 결과를 반영하지 않았어요. 결과를 비교해 주세요.')).toBeVisible();
    });
    it('selecting another saved request stops editing the previous saved request', async () => {
        mocks.preferences.mockResolvedValue([
            {id: 1, category: 'REQUEST_TEXT', value: '휴무 균형을 맞춰줘', provenance: 'USER', confirmedAt: source.createdAt},
            {id: 2, category: 'REQUEST_TEXT', value: '야간을 줄여줘', provenance: 'USER', confirmedAt: source.createdAt},
        ]);
        renderSidebar();
        await userEvent.click(await screen.findByRole('button', {name: /^수정 요청하기$|^수정하고 싶은 부분이 있어요$/}));
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
                expect(await screen.findByText('표나 조건이 바뀌었거나 제안의 유효 시간이 지났어요.')).toBeVisible();
                expect(screen.getByText('최신 요청으로 다시 수정해 주세요.')).toBeVisible();
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
        await userEvent.click(await screen.findByRole('button', {name: /^수정 요청하기$|^수정하고 싶은 부분이 있어요$/}));
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
        await userEvent.click(
            await screen.findByRole('button', {
                name: /^수정 요청하기$|^Request changes$|^수정하고 싶은 부분이 있어요$|^I have some changes in mind$/,
            }),
        );
        await userEvent.click(await screen.findByText('휴무 균형을 맞춰줘'));
        expect(screen.getByRole('textbox')).toHaveValue('휴무 균형을 맞춰줘');
        expect(mocks.interpret).not.toHaveBeenCalled();
        expect(mocks.execute).not.toHaveBeenCalled();
    });
    it('requires an explicit confirmation before rebuilding unlocked assignments', async () => {
        renderSidebar();
        await waitFor(() => expect(mocks.preferences).toHaveBeenCalled());
        await userEvent.click(
            screen.getByRole('button', {
                name: /^다시 채우기$|^Refill$|^한 번 더 채워볼게요$|^Try filling it again$|^같은 조건으로 다시 채울게요$|^Refill with the same conditions$/,
            }),
        );
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

        const modify = await screen.findByRole('button', {
            name: /수정 요청하기$|Request changes$|수정하고 싶은 부분이 있어요$|I have some changes in mind$/,
        });

        expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
        expect(document.querySelector('.ai-adjust-chat-scroll')).toHaveAttribute('data-composer-hidden', 'true');
        expect(screen.queryByRole('region', {name: /이렇게 요청해 보세요|Try a request/})).not.toBeInTheDocument();
        expect(screen.queryByText(/현재 조건으로 전체|Rebuild the whole schedule with/)).not.toBeInTheDocument();
        await userEvent.click(modify);
        await screen.findByText(/어떤 점을 바꾸고 싶나요|What would you like to change/);
        expect(
            screen.queryByRole('button', {
                name: /^다시 채우기$|^Refill$|^한 번 더 채워볼게요$|^Try filling it again$|^같은 조건으로 다시 채울게요$|^Refill with the same conditions$/,
            }),
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
        await userEvent.click(
            screen.getByRole('button', {
                name: /^수정 요청하기$|^Request changes$|^수정하고 싶은 부분이 있어요$|^I have some changes in mind$/,
            }),
        );
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

    it('starts with a clear conversation while preserving the current schedule and stored history', async () => {
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
        mocks.startSegment.mockImplementationOnce(startFreshSection);

        const draft = useShiftEditorStore.getState().doc;

        renderSidebar();
        await screen.findByText('이전 요청');
        expect(
            screen.queryByRole('button', {
                name: /^수정 요청하기$|^Request changes$|^수정하고 싶은 부분이 있어요$|^I have some changes in mind$/,
            }),
        ).toBeVisible();
        await userEvent.click(screen.getByRole('button', {name: /초기화|Reset/}));
        await screen.findByRole('button', {
            name: /^수정 요청하기$|^Request changes$|^수정하고 싶은 부분이 있어요$|^I have some changes in mind$/,
        });
        expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
        expect(screen.queryByText(/8cb64676/)).not.toBeInTheDocument();
        expect(screen.queryByRole('button', {name: '서버 작업표 불러오기'})).not.toBeInTheDocument();
        expect(mocks.startSegment).toHaveBeenCalledWith(1, 'source:1', 0);
        expect(screen.queryByText('이전 요청')).not.toBeInTheDocument();
        expect(screen.queryByText(/여기서부터 새 요청|New requests/)).not.toBeInTheDocument();
        expect(screen.queryByRole('button', {name: /근무표 살펴보기|Explore schedule/})).not.toBeInTheDocument();
        expect(screen.getByText(i18n.t('aiAdjust.chat.welcome'))).toBeVisible();
        expect(screen.queryByRole('group', {name: i18n.t('aiAdjust.snapshot.nextAction')})).not.toBeInTheDocument();
        expect(current.turns.some((turn) => turn.text === '이전 요청')).toBe(true);
        expect(current.operations).toEqual([operation]);
        expect(useShiftEditorStore.getState().doc).toEqual(draft);
        expect(mocks.branch).not.toHaveBeenCalled();
        expect(mocks.execute).not.toHaveBeenCalled();
        expect(mocks.applyAdjustedDoc).not.toHaveBeenCalled();
    });
    it('keeps a cleared conversation fresh after remount and ignores a late reply from before the reset', async () => {
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
        mocks.startSegment.mockImplementationOnce(startFreshSection);

        const first = renderSidebar();

        await screen.findByText('이전 요청');
        await userEvent.click(screen.getByRole('button', {name: '초기화'}));
        await screen.findByText(i18n.t('aiAdjust.chat.welcome'));
        first.unmount();

        const segment = current.turns[current.turns.length - 1];
        const expired: TConversationTurn = {
            ...segment,
            eventId: segment.eventId + 1,
            sequence: segment.sequence + 1,
            actor: 'ASSISTANT',
            type: 'SEMANTIC_PLAN_EXPIRED',
            text: '늦게 도착한 이전 요청',
            interpretationId: 'expired:before-reset',
            baseRevision: segment.baseRevision - 1,
            semanticPlan: {
                planId: 'expired:plan',
                planHash: 'a'.repeat(64),
                sourceVersionId: source.versionId,
                state: 'EXPIRED',
                summary: '이전 요청의 만료된 결과예요.',
                confirmationAllowed: false,
                reasonCodes: [],
                conditions: [],
            },
        };

        current = {...current, turns: [...current.turns, expired]};
        mocks.list.mockResolvedValue([current.conversation, {...current.conversation, conversationId: 2}]);
        mocks.interpret.mockImplementationOnce(async (_id: number, request: {text: string; expectedRevision: number}) => {
            const message: TConversationTurn = {
                ...segment,
                eventId: expired.eventId + 1,
                sequence: expired.sequence + 1,
                actor: 'USER',
                type: 'MESSAGE',
                text: request.text,
                baseRevision: request.expectedRevision,
            };
            const reply: TConversationTurn = {
                ...message,
                eventId: message.eventId + 1,
                sequence: message.sequence + 1,
                actor: 'ASSISTANT',
                text: '새 요청을 확인했어요.',
                interpretationId: 'new:1',
            };

            current = {
                ...current,
                turns: [...current.turns, message, reply],
                conversation: {...current.conversation, latestInterpretationId: reply.interpretationId},
            };

            return reply;
        });
        renderSidebar();

        await screen.findByText(i18n.t('aiAdjust.chat.welcome'));
        expect(screen.queryByText('이전 요청')).not.toBeInTheDocument();
        expect(screen.queryByText('늦게 도착한 이전 요청')).not.toBeInTheDocument();
        expect(screen.queryByRole('region', {name: '요청 조건 확인'})).not.toBeInTheDocument();
        expect(screen.queryByText(/이전 대화 기록/)).not.toBeInTheDocument();
        expect(screen.queryByTestId('conversation-result-preview')).not.toBeInTheDocument();
        await userEvent.click(screen.getByRole('button', {name: i18n.t('aiAdjust.chat.modify')}));
        await userEvent.type(screen.getByRole('textbox'), '이번에는 휴무를 고르게 배정해줘');
        await userEvent.click(screen.getByRole('button', {name: '요청 보내기'}));
        await waitFor(() => expect(mocks.interpret).toHaveBeenCalledOnce());
        expect(mocks.interpret.mock.calls[0][1]).toMatchObject({text: '이번에는 휴무를 고르게 배정해줘', expectedRevision: 1});
        expect(mocks.interpret.mock.calls[0][1]).not.toHaveProperty('previousInterpretationId');
        expect(await screen.findByText('새 요청을 확인했어요.')).toBeVisible();
        expect(screen.getByText('이번에는 휴무를 고르게 배정해줘')).toBeVisible();
        expect(mocks.execute).not.toHaveBeenCalled();
        expect(screen.queryByText('이전 요청')).not.toBeInTheDocument();
        expect(screen.queryByText('늦게 도착한 이전 요청')).not.toBeInTheDocument();
    });
    it.each(['running', 'paused'] as const)(
        'clears %s preparation, local choices and unsent input even before the parent removes the old flow',
        async (status) => {
            mocks.startSegment.mockImplementationOnce(startFreshSection).mockImplementationOnce(startFreshSection);

            const onNewConversation = vi.fn();
            const view = renderSidebar({
                onNewConversation,
                autofillFlow: {
                    id: 5,
                    status,
                    messages: [{role: 'assistant', text: '이전 준비 단계 안내'}],
                },
            });

            await screen.findByText('이전 준비 단계 안내');
            await userEvent.click(screen.getByRole('button', {name: '초기화'}));
            await screen.findByText(i18n.t('aiAdjust.chat.welcome'));
            expect(screen.queryByText('이전 준비 단계 안내')).not.toBeInTheDocument();
            expect(onNewConversation).toHaveBeenCalledOnce();
            view.rerender(sidebarElement({onNewConversation}));
            await userEvent.click(screen.getByRole('button', {name: i18n.t('aiAdjust.chat.modify')}));
            await userEvent.type(screen.getByRole('textbox'), '보내지 않은 요청');
            expect(screen.getByText(i18n.t('aiAdjust.chat.askChanges'))).toBeVisible();
            await userEvent.click(screen.getByRole('button', {name: '초기화'}));
            await screen.findByText(i18n.t('aiAdjust.chat.welcome'));
            expect(screen.queryByText(i18n.t('aiAdjust.chat.askChanges'))).not.toBeInTheDocument();
            expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
            await userEvent.click(screen.getByRole('button', {name: i18n.t('aiAdjust.chat.modify')}));
            expect(screen.getByRole('textbox')).toHaveValue('');
            expect(onNewConversation).toHaveBeenCalledTimes(2);
            expect(mocks.interpret).not.toHaveBeenCalled();
            expect(mocks.execute).not.toHaveBeenCalled();
        },
    );
    it('keeps the conversation and unsent input when starting a new request fails', async () => {
        current.turns = [
            {
                eventId: 1,
                sequence: 1,
                actor: 'USER',
                type: 'MESSAGE',
                text: '지금까지의 요청',
                interpretationId: null,
                baseRevision: 0,
                contextHash: 'rules:1',
                interpretation: null,
                createdAt: source.createdAt,
            },
        ];
        mocks.startSegment.mockRejectedValueOnce(new Error('offline'));

        const onNewConversation = vi.fn();
        const draft = useShiftEditorStore.getState().doc;

        renderSidebar({onNewConversation});
        await screen.findByText('지금까지의 요청');
        await userEvent.click(screen.getByRole('button', {name: i18n.t('aiAdjust.chat.modify')}));
        await userEvent.type(screen.getByRole('textbox'), '작성 중인 요청');
        await userEvent.click(screen.getByRole('button', {name: '초기화'}));
        await screen.findByRole('alert');
        expect(screen.getByText('지금까지의 요청')).toBeVisible();
        expect(screen.getByRole('textbox')).toHaveValue('작성 중인 요청');
        expect(screen.getByTestId('conversation-result-preview')).toBeVisible();
        expect(onNewConversation).not.toHaveBeenCalled();
        expect(useShiftEditorStore.getState().doc).toEqual(draft);
        expect(mocks.applyAdjustedDoc).not.toHaveBeenCalled();
    });
    it.each(['RUNNING', 'RESULT_READY', 'UNKNOWN'] as const)('cannot clear an unresolved execution: %s', async (executionStatus) => {
        current.operations = [{...operation, executionStatus, applyStatus: 'PENDING', resultVersionId: null}];
        renderSidebar();

        const reset = await screen.findByRole('button', {name: '초기화'});

        await waitFor(() => expect(reset).toBeDisabled());
        await userEvent.click(reset);
        expect(mocks.startSegment).not.toHaveBeenCalled();
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
        await userEvent.click(await screen.findByRole('button', {name: /근무표 살펴보기|Explore schedule/}));

        const continueResult = await screen.findByRole('button', {name: /이 표로 이어서 작성하기|Continue from this result/});

        await waitFor(() => expect(continueResult).toBeEnabled());
        await userEvent.click(continueResult);
        await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());

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
        await userEvent.click(await screen.findByRole('button', {name: /근무표 살펴보기|Explore schedule/}));

        const continueResult = await screen.findByRole('button', {name: /이 표로 이어서 작성하기|Continue from this result/});

        await waitFor(() => expect(continueResult).toBeEnabled());
        await userEvent.click(continueResult);
        await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());

        const pending = await screen.findByRole('button', {name: /이 표로 이어서 작성하기|Open the saved new branch/});

        expect(useShiftEditorStore.getState().doc.rows[0]?.cells).toEqual(['E']);
        expect(mocks.applyAdjustedDoc).not.toHaveBeenCalled();
        await userEvent.click(pending);
        await screen.findByText('표가 바뀌어서 이전 결과로 전환하지 않았어요.');
        expect(screen.getByText('작성 중인 내용을 확인한 뒤 다시 눌러 주세요.')).toBeVisible();
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
        await screen.findByText(i18n.t('aiAdjust.understood'));
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
        await userEvent.click(await screen.findByRole('button', {name: /^수정 요청하기$|^수정하고 싶은 부분이 있어요$/}));

        const example = screen.getByRole('button', {name: '첫 행 간호사 1~5일 N12 근무 없게 해줘'});
        const input = screen.getByRole('textbox');

        expect(input).toHaveAttribute('placeholder', '예: 첫 행 간호사 1~5일 N12 근무 없게 해줘');
        await userEvent.click(example);
        expect(input).toHaveValue('첫 행 간호사 1~5일 N12 근무 없게 해줘');
        expect(mocks.interpret).not.toHaveBeenCalled();
        expect(mocks.execute).not.toHaveBeenCalled();
    });

    it('shows Japanese request examples and sends the selected Japanese request with its locale', async () => {
        await i18n.changeLanguage('ja');
        current.operations = [];
        useShiftEditorStore.getState().setSemanticExecutionEnabled(true);
        useShiftEditorStore.getState().setDoc({
            columns: ['2026-11-01', '2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05'],
            rows: [{workerId: '1', cells: ['O', 'O', 'O', 'O', 'O']}],
            workerMeta: {'1': {name: '田中花子', nurseId: 1}},
            fixedCells: {},
            requestCells: {},
        });
        mocks.interpret.mockResolvedValueOnce({interpretationId: 'ja:1'});
        renderSidebar();

        expect(i18n.t('aiAdjust.title')).toMatch(/自動/);
        expect(screen.getByRole('complementary', {name: i18n.t('aiAdjust.title')})).toBeVisible();
        await userEvent.click(await screen.findByRole('button', {name: i18n.t('aiAdjust.chat.modify')}));

        const request = '1日～5日は田中花子さんにD勤務を入れないでください';
        const input = screen.getByRole('textbox', {name: '変更したい内容'});

        expect(input).toHaveAttribute('placeholder', `例：${request}`);
        await userEvent.click(screen.getByRole('button', {name: request}));
        expect(input).toHaveValue(request);
        await userEvent.click(screen.getByRole('button', {name: i18n.t('aiAdjust.send')}));
        await waitFor(() => expect(mocks.interpret).toHaveBeenCalledOnce());
        expect(mocks.interpret).toHaveBeenCalledWith(1, expect.objectContaining({text: request, language: 'ja'}));
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
    it('saves priority edits as a new review without interpreting or executing', async () => {
        const proposal: TConversationTurn = {
            eventId: 2,
            sequence: 2,
            actor: 'ASSISTANT',
            type: 'SEMANTIC_PLAN',
            text: null,
            interpretationId: 'priority:parent',
            baseRevision: 0,
            contextHash: 'rules:1',
            interpretation: null,
            createdAt: source.createdAt,
            semanticPlan: {
                planId: 'p1',
                planHash: 'a'.repeat(64),
                sourceVersionId: source.versionId,
                state: 'PREVIEW_READY',
                summary: '',
                confirmationAllowed: true,
                reasonCodes: [],
                modalityEditableIntentIds: ['count'],
                conditions: [
                    {
                        intentId: 'count',
                        action: 'COUNT',
                        nurseIds: [1],
                        dates: ['2026-11-01'],
                        shiftCodes: ['D'],
                        quantifier: 'EACH',
                        modality: 'HARD',
                        operator: 'MAX',
                        count: 1,
                        sourceSpan: {quote: '데이 최대 1회'},
                    },
                ],
            },
        };

        current = {
            ...current,
            turns: [proposal],
            conversation: {...current.conversation, latestInterpretationId: proposal.interpretationId},
        };
        mocks.changeModalities.mockImplementation(async () => {
            const child: TConversationTurn = {
                ...proposal,
                eventId: 3,
                sequence: 3,
                interpretationId: 'priority:child',
                semanticPlan: {
                    ...proposal.semanticPlan!,
                    planId: 'p2',
                    planHash: 'b'.repeat(64),
                    conditions: [{...proposal.semanticPlan!.conditions[0]!, modality: 'SOFT'}],
                },
            };

            current = {
                ...current,
                turns: [proposal, child],
                conversation: {...current.conversation, latestInterpretationId: child.interpretationId},
            };

            return child;
        });
        renderSidebar();
        await userEvent.click(await screen.findByRole('radio', {name: '권장'}));
        expect(screen.getByRole('button', {name: '이대로 수정하기'})).toBeDisabled();
        await userEvent.click(screen.getByRole('button', {name: '변경한 조건 확인하기'}));
        await waitFor(() =>
            expect(mocks.changeModalities).toHaveBeenCalledExactlyOnceWith(1, 'priority:parent', 0, 'a'.repeat(64), {count: 'SOFT'}),
        );
        await waitFor(() => expect(screen.getByRole('button', {name: '이대로 수정하기'})).toBeEnabled());
        expect(mocks.interpret).not.toHaveBeenCalled();
        expect(mocks.confirmPlan).not.toHaveBeenCalled();
        expect(mocks.execute).not.toHaveBeenCalled();
        expect(screen.getByRole('radio', {name: '권장'})).toBeChecked();
    });
    it('revalidates explicit partial selection and waits for confirmation of the new plan', async () => {
        const groups = [
            {
                conditionId: 'supported',
                sourceSpan: {start: 0, end: 8, quote: '김 1일 D 배정'},
                intentIds: ['i1'],
                status: 'SUPPORTED' as const,
                reasonCodes: [],
                selectable: true,
            },
            {
                conditionId: 'unsupported',
                sourceSpan: {start: 9, end: 20, quote: '김 입사일부터 N 금지'},
                intentIds: [],
                status: 'UNSUPPORTED' as const,
                reasonCodes: ['UNSUPPORTED_CAPABILITY'],
                selectable: false,
            },
        ];
        const proposal: TConversationTurn = {
            eventId: 2,
            sequence: 2,
            actor: 'ASSISTANT',
            type: 'SEMANTIC_PLAN',
            text: null,
            interpretationId: 'partial:parent',
            baseRevision: 0,
            contextHash: 'rules:1',
            interpretation: null,
            createdAt: source.createdAt,
            semanticPlan: {
                planId: 'parent',
                planHash: 'a'.repeat(64),
                sourceVersionId: source.versionId,
                state: 'UNSUPPORTED',
                summary: '지원하지 않는 조건',
                confirmationAllowed: false,
                reasonCodes: ['UNSUPPORTED_CAPABILITY'],
                conditions: [],
                conditionGroups: groups,
            },
        };

        current = {
            ...current,
            turns: [proposal],
            conversation: {...current.conversation, latestInterpretationId: proposal.interpretationId},
        };
        mocks.selectConditions.mockImplementation(async () => {
            const child = {
                ...proposal,
                eventId: 3,
                sequence: 3,
                interpretationId: 'partial:child',
                semanticPlan: {
                    ...proposal.semanticPlan!,
                    planId: 'child',
                    planHash: 'b'.repeat(64),
                    state: 'PREVIEW_READY',
                    confirmationAllowed: true,
                    selectionAudit: {
                        sourcePreviewId: 'preview',
                        originalText: 'original',
                        conditionGroups: groups,
                        selectedConditionIds: ['supported'],
                        excludedConditionIds: ['unsupported'],
                    },
                },
            };

            current = {
                ...current,
                turns: [proposal, child],
                conversation: {...current.conversation, latestInterpretationId: child.interpretationId},
            };

            return child;
        });
        renderSidebar();

        const check = (await screen.findAllByRole('checkbox'))[0];

        await userEvent.click(check);
        await userEvent.click(screen.getByRole('button', {name: /선택한 조건만 다시 검증|Revalidate only selected conditions/}));
        await waitFor(() => expect(mocks.selectConditions).toHaveBeenCalledWith(1, 'parent', 0, 'a'.repeat(64), ['supported']));
        expect(await screen.findByRole('button', {name: /이대로 수정하기|Adjust with these conditions/})).toBeInTheDocument();
        expect(mocks.confirmPlan).not.toHaveBeenCalled();
        expect(mocks.execute).not.toHaveBeenCalled();
        expect(screen.getByText('제외:')).toBeInTheDocument();
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
        expect(await screen.findByText(/반영하기 어려운 조건이 있어요|Some conditions are not supported yet/)).toBeInTheDocument();
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
    const confirmSemanticRequest = (proposal: TConversationTurn) => {
        const confirmed: TConversationTurn = {
            ...proposal,
            eventId: proposal.eventId + 1,
            sequence: proposal.sequence + 1,
            type: 'SEMANTIC_PLAN_CONFIRMED',
            interpretationId: `${proposal.interpretationId}:confirmed`,
            semanticPlan: {...proposal.semanticPlan!, state: 'CONFIRMED', confirmationAllowed: false},
        };

        mocks.confirmPlan.mockImplementation(async () => {
            current = {
                ...current,
                turns: [...current.turns, confirmed],
                conversation: {...current.conversation, latestInterpretationId: confirmed.interpretationId},
            };

            return confirmed;
        });

        return confirmed;
    };
    const executedSemanticRequest = (executionStatus: TConversationOperation['executionStatus']) => {
        const {raw, proposal} = semanticRequest();
        const confirmed = confirmSemanticRequest(proposal);
        const executed: TConversationOperation = {
            ...operation,
            operationId: 'adjust:1',
            sequence: confirmed.sequence + 1,
            operationType: 'ADJUST',
            interpretationId: confirmed.interpretationId,
            executionStatus,
            applyStatus: executionStatus === 'SUCCEEDED' ? 'APPLIED' : executionStatus === 'FAILED' ? 'NOT_APPLIED' : 'PENDING',
            resultVersionId: null,
        };

        current = {
            ...current,
            turns: [...current.turns, confirmed],
            conversation: {...current.conversation, latestInterpretationId: confirmed.interpretationId},
            operations: [executed],
        };

        return {raw, confirmed, executed};
    };

    it('restarts after an edited failed request without old recovery controls or condition targets', async () => {
        const {raw, executed} = executedSemanticRequest('FAILED');

        current = {
            ...current,
            operations: [{...operation, sequence: 0}, executed],
            conversationState: {
                version: 7,
                sourceVersionId: source.versionId,
                contextHash: current.contextHash,
                expiresAt: null,
                conditions: [{conditionId: 'old:condition', text: raw, preview: {status: 'PREVIEW_READY'}}],
                pendingQuestion: null,
            },
        };
        mocks.startSegment.mockImplementationOnce(startFreshSection);
        mocks.interpret.mockResolvedValueOnce({interpretationId: 'fresh:1'});
        renderSidebar();
        await userEvent.click(await screen.findByRole('button', {name: '요청 수정하기'}));
        expect(screen.getByRole('combobox', {name: '조건 수정 방식'})).toHaveValue('UPDATE');
        expect(screen.getByRole('checkbox', {name: raw})).toBeChecked();
        await userEvent.type(screen.getByRole('textbox'), '이전에 수정하던 요청');
        await userEvent.click(screen.getByRole('button', {name: '초기화'}));
        await screen.findByText(i18n.t('aiAdjust.chat.welcome'));
        expect(screen.queryByRole('region', {name: '요청 조건 확인'})).not.toBeInTheDocument();
        expect(screen.queryByRole('alert')).not.toBeInTheDocument();
        expect(screen.queryByRole('button', {name: '다시 시도하기'})).not.toBeInTheDocument();
        expect(screen.queryByRole('button', {name: '요청 수정하기'})).not.toBeInTheDocument();
        expect(screen.queryByTestId('conversation-result-preview')).not.toBeInTheDocument();
        expect(screen.queryByText(raw)).not.toBeInTheDocument();
        await userEvent.click(screen.getByRole('button', {name: i18n.t('aiAdjust.chat.modify')}));
        expect(screen.getByRole('textbox')).toHaveValue('');
        expect(screen.getByRole('combobox', {name: '조건 수정 방식'})).toHaveValue('ANSWER');
        expect(screen.queryByRole('checkbox', {name: raw})).not.toBeInTheDocument();
        await userEvent.type(screen.getByRole('textbox'), '새 요청으로 주말 휴무를 나눠줘');
        await userEvent.click(screen.getByRole('button', {name: '요청 보내기'}));
        await waitFor(() => expect(mocks.interpret).toHaveBeenCalledOnce());
        expect(mocks.interpret.mock.calls[0][1]).toMatchObject({
            text: '새 요청으로 주말 휴무를 나눠줘',
            expectedStateVersion: 8,
            change: 'ADD',
            targetConditionIds: [],
        });
        expect(mocks.interpret.mock.calls[0][1]).not.toHaveProperty('previousInterpretationId');
        expect(mocks.execute).not.toHaveBeenCalled();
        expect(mocks.applyAdjustedDoc).not.toHaveBeenCalled();
    });

    it('keeps a failed adjustment and its recovery actions in one result message', async () => {
        const {executed} = executedSemanticRequest('FAILED');

        current.turns = current.turns.map((turn) => ({...turn, sequence: turn.sequence + 1}));
        current.operations = [
            {
                ...executed,
                operationId: 'adjust:previous',
                sequence: 1,
                interpretationId: null,
                executionStatus: 'SUCCEEDED',
                applyStatus: 'APPLIED',
            },
            {...executed, sequence: executed.sequence + 1},
        ];
        renderSidebar();

        const failure = await screen.findByRole('region', {name: '근무표를 수정하지 못했어요. (2회차)'});
        const alert = within(failure).getByRole('alert');

        expect(within(failure).getByText('근무표를 수정하지 못했어요. (2회차)')).toBeVisible();
        expect(within(failure).getAllByRole('img')).toHaveLength(1);
        expect(within(failure).getByRole('button', {name: '다시 시도하기'})).toBeEnabled();
        expect(within(failure).getByRole('button', {name: '요청 수정하기'})).toBeEnabled();
        expect(within(alert).queryByRole('button')).not.toBeInTheDocument();
        expect(screen.getAllByRole('alert')).toHaveLength(1);
        expect(screen.queryByText(/^수정 2회차 · 실패/)).not.toBeInTheDocument();
        expect(within(screen.getByRole('region', {name: '요청 조건 확인'})).queryByRole('button')).not.toBeInTheDocument();

        await userEvent.click(within(failure).getByRole('button', {name: '이 결과에 의견 보내기'}));
        expect(screen.getByText('수정 2회차 결과')).toBeVisible();
        expect(mocks.execute).not.toHaveBeenCalled();
    });

    it.each(['RUNNING', 'RESULT_READY', 'UNKNOWN', 'SUCCEEDED', 'FAILED'] as const)(
        'retains executed semantic conditions as read-only history: %s',
        async (executionStatus) => {
            executedSemanticRequest(executionStatus);
            renderSidebar();

            const review = await screen.findByRole('region', {name: '요청 조건 확인'});

            expect(within(review).getByText('전체 간호사')).toBeVisible();
            expect(review).toHaveTextContent('11월 1~2일');
            expect(review).toHaveTextContent('N 근무 제외');
            expect(within(review).queryByRole('button')).not.toBeInTheDocument();
            expect(screen.queryByRole('button', {name: '이대로 수정하기'})).not.toBeInTheDocument();

            if (executionStatus === 'FAILED') {
                expect(screen.getAllByRole('button', {name: '다시 시도하기'})).toHaveLength(1);
                expect(screen.getAllByRole('button', {name: '요청 수정하기'})).toHaveLength(1);
                expect(screen.getByRole('alert')).toHaveTextContent('근무표를 수정하지 못했어요.');
            } else if (executionStatus === 'SUCCEEDED') {
                expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
                await userEvent.click(screen.getByRole('button', {name: i18n.t('aiAdjust.chat.modify')}));
                expect(screen.getByRole('textbox')).toBeVisible();
                expect(screen.queryByRole('button', {name: '요청 수정하기'})).not.toBeInTheDocument();
            }

            expect(mocks.confirmPlan).not.toHaveBeenCalled();
            expect(mocks.execute).not.toHaveBeenCalled();
        },
    );

    it('keeps a rejected successful execution and its preview, evidence and recovery in one failure message', async () => {
        const {executed} = executedSemanticRequest('SUCCEEDED');

        current.operations = [
            {
                ...executed,
                applyStatus: 'NOT_APPLIED',
                resultVersionId: 'result:1',
                result: {
                    ...successfulResult,
                    operationType: 'ADJUST',
                    applicable: false,
                    engineResult: {status: 'REJECTED', solver: {reason: 'SOLVER_RESULT_VALIDATION_UNAVAILABLE'}},
                    validation: {...successfulResult.validation!, summary: {valid: false, hardCount: 1, softCount: 0, totalCount: 1}},
                    failure: {
                        reasonCode: 'SOLVER_RESULT_VALIDATION_UNAVAILABLE',
                        message: '',
                        suggestions: [
                            {
                                suggestionId: 'suggestion:merged',
                                inputDigest: 'digest:1',
                                baseRevision: 0,
                                expiresAt: '2099-01-01T00:00:00Z',
                                verificationStatus: 'VERIFIED_FEASIBLE',
                                applyEnabled: true,
                                changes: [{kind: 'NUMERIC_GOAL', oldValue: 12, proposedValue: 11}],
                            },
                        ],
                    },
                },
            },
        ];
        renderSidebar();

        const review = await screen.findByRole('region', {name: '요청 조건 확인'});

        expect(within(review).queryByRole('button')).not.toBeInTheDocument();
        expect(screen.queryByRole('button', {name: '이대로 수정하기'})).not.toBeInTheDocument();
        expect(screen.getAllByRole('button', {name: '다시 시도하기'})).toHaveLength(1);
        expect(screen.getAllByRole('button', {name: '요청 수정하기'})).toHaveLength(1);

        const failure = screen.getByRole('region', {name: '근무표를 수정하지 못했어요. (1회차)'});

        expect(within(failure).getByRole('alert')).toHaveTextContent('근무표를 수정하지 못했어요.');
        expect(within(failure).getByTestId('conversation-result-preview')).toBeVisible();
        expect(within(failure).getByText(i18n.t('aiAdjust.resultInfo.title'))).toBeVisible();
        expect(within(failure).getByRole('button', {name: '변경 제안 보기'})).toBeVisible();
        expect(within(failure).getByRole('button', {name: '다시 시도하기'})).toBeEnabled();
        expect(within(failure).getByRole('button', {name: '요청 수정하기'})).toBeEnabled();
        expect(within(failure).getByRole('button', {name: '이 결과에 의견 보내기'})).toBeEnabled();
        expect(within(failure).getAllByRole('img')).toHaveLength(1);
        expect(within(within(failure).getByRole('alert')).queryByRole('button')).not.toBeInTheDocument();
        expect(screen.queryByText(/^수정 1회차 · 실패/)).not.toBeInTheDocument();
        expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    });

    it('retries a failed adjustment from its recovery action without restoring old plan buttons', async () => {
        const {confirmed, executed} = executedSemanticRequest('FAILED');
        const prepare = vi.fn().mockResolvedValue(undefined);

        mocks.execute.mockImplementationOnce(async (_id: number, request: {interpretationId?: string}) => {
            const retried = {
                ...executed,
                operationId: 'adjust:retry',
                sequence: executed.sequence + 1,
                interpretationId: request.interpretationId ?? null,
            };

            current = {...current, operations: [...current.operations, retried]};

            return retried;
        });
        renderSidebar({onPrepareAdjustment: prepare});
        await userEvent.dblClick(await screen.findByRole('button', {name: '다시 시도하기'}));
        await waitFor(() => expect(mocks.execute).toHaveBeenCalledOnce());
        await waitFor(() => expect(screen.getByRole('button', {name: '다시 시도하기'})).toBeEnabled());
        expect(prepare).toHaveBeenCalledOnce();
        expect(mocks.confirmPlan).not.toHaveBeenCalled();
        expect(mocks.execute.mock.calls[0]?.[1]).toMatchObject({
            operationType: 'ADJUST',
            interpretationId: confirmed.interpretationId,
            planHash: confirmed.semanticPlan!.planHash,
            sourceVersionId: source.versionId,
        });
        expect(within(screen.getByRole('region', {name: '요청 조건 확인'})).queryByRole('button')).not.toBeInTheDocument();
        expect(screen.getAllByRole('button', {name: '요청 수정하기'})).toHaveLength(1);
    });

    it('opens the original failed request for editing while the executed conditions remain read-only', async () => {
        const {raw} = executedSemanticRequest('FAILED');
        const first = renderSidebar();

        await userEvent.click(await screen.findByRole('button', {name: '요청 수정하기'}));

        const input = screen.getByRole('textbox', {name: '바꾸고 싶은 내용'});

        expect(input).toHaveValue(raw);
        expect(input).toHaveFocus();
        expect(screen.getByRole('button', {name: '수정한 요청 확인'})).toBeEnabled();
        expect(within(screen.getByRole('region', {name: '요청 조건 확인'})).queryByRole('button')).not.toBeInTheDocument();
        expect(screen.queryByRole('button', {name: '이대로 수정하기'})).not.toBeInTheDocument();
        expect(screen.queryByRole('button', {name: '다시 시도하기'})).not.toBeInTheDocument();
        expect(mocks.confirmPlan).not.toHaveBeenCalled();
        expect(mocks.execute).not.toHaveBeenCalled();
        first.unmount();
        renderSidebar();
        await waitFor(() => expect(mocks.preferences).toHaveBeenCalledTimes(2));
        expect(screen.getByRole('textbox', {name: '바꾸고 싶은 내용'})).toHaveValue(raw);
        expect(screen.getByRole('button', {name: '수정한 요청 확인'})).toBeEnabled();
        expect(mocks.interpret).not.toHaveBeenCalled();
        expect(mocks.execute).not.toHaveBeenCalled();
    });

    it('replaces plan actions with failure recovery after the accepted request finishes unsuccessfully', async () => {
        const {proposal} = semanticRequest();
        const confirmed = confirmSemanticRequest(proposal);

        mocks.execute.mockImplementationOnce(async () => {
            const failed: TConversationOperation = {
                ...operation,
                operationId: 'adjust:failed',
                sequence: confirmed.sequence + 1,
                operationType: 'ADJUST',
                interpretationId: confirmed.interpretationId,
                executionStatus: 'FAILED',
                applyStatus: 'NOT_APPLIED',
                resultVersionId: null,
            };

            current = {...current, operations: [...current.operations, failed]};

            return failed;
        });
        renderSidebar();
        await userEvent.click(await screen.findByRole('button', {name: '이대로 수정하기'}));
        await screen.findByRole('alert');
        await waitFor(() => expect(screen.getByRole('button', {name: '다시 시도하기'})).toBeEnabled());
        expect(within(screen.getByRole('region', {name: '요청 조건 확인'})).queryByRole('button')).not.toBeInTheDocument();
        expect(screen.queryByRole('button', {name: '이대로 수정하기'})).not.toBeInTheDocument();
        expect(screen.getAllByRole('button', {name: '요청 수정하기'})).toHaveLength(1);
        expect(mocks.confirmPlan).toHaveBeenCalledOnce();
        expect(mocks.execute).toHaveBeenCalledOnce();
    });

    it('does not leave legacy confirmation actions beside recovery for an executed interpretation', async () => {
        const confirmed: TConversationTurn = {
            eventId: 1,
            sequence: 1,
            actor: 'ASSISTANT',
            type: 'INTERPRETATION_CONFIRMED',
            text: null,
            interpretationId: 'legacy:confirmed',
            baseRevision: 0,
            contextHash: 'rules:1',
            interpretation: {items: [], llmPrompt: '연속 근무를 줄여줘', strength: 'NORMAL', unmapped: []},
            createdAt: source.createdAt,
        };

        current = {
            ...current,
            turns: [confirmed],
            conversation: {...current.conversation, latestInterpretationId: confirmed.interpretationId},
            operations: [
                {
                    ...operation,
                    sequence: 2,
                    operationType: 'ADJUST',
                    interpretationId: confirmed.interpretationId,
                    executionStatus: 'FAILED',
                    applyStatus: 'NOT_APPLIED',
                    resultVersionId: null,
                },
            ],
        };
        renderSidebar();
        await screen.findByRole('alert');
        expect(screen.queryByRole('button', {name: '이 내용으로 정하기'})).not.toBeInTheDocument();
        expect(screen.queryByText(i18n.t('aiAdjust.chat.applyQuestion'))).not.toBeInTheDocument();
        expect(screen.getAllByRole('button', {name: '다시 시도하기'})).toHaveLength(1);
        expect(screen.getAllByRole('button', {name: '요청 수정하기'})).toHaveLength(1);
        expect(mocks.confirm).not.toHaveBeenCalled();
        expect(mocks.execute).not.toHaveBeenCalled();
    });

    it('reviews a new semantic request before asking which shifts to protect', async () => {
        const {proposal} = semanticRequest();
        const prepare = vi.fn().mockResolvedValue(undefined);

        current = {...current, turns: [], conversation: {...current.conversation, latestInterpretationId: null}};
        mocks.interpret.mockImplementationOnce(async () => {
            current = {
                ...current,
                turns: [proposal],
                conversation: {...current.conversation, latestInterpretationId: proposal.interpretationId},
            };

            return proposal;
        });
        renderSidebar({onPrepareAdjustment: prepare});
        await userEvent.click(await screen.findByRole('button', {name: /^수정 요청하기$|^수정하고 싶은 부분이 있어요$/}));
        await userEvent.type(screen.getByRole('textbox'), '김 간호사 1~2일 N 금지');
        await userEvent.click(screen.getByRole('button', {name: '요청 보내기'}));
        expect(await screen.findByRole('button', {name: '이대로 수정하기'})).toBeEnabled();
        expect(prepare).not.toHaveBeenCalled();
        expect(mocks.confirmPlan).not.toHaveBeenCalled();
        expect(mocks.execute).not.toHaveBeenCalled();
    });

    it('waits for protection preparation and confirms the exact reviewed semantic plan once', async () => {
        const {proposal} = semanticRequest();
        const confirmed = confirmSemanticRequest(proposal);

        let finishPreparation!: () => void;

        const prepare = vi.fn(
            () =>
                new Promise<void>((resolve) => {
                    finishPreparation = resolve;
                }),
        );

        renderSidebar({onPrepareAdjustment: prepare});
        await userEvent.dblClick(await screen.findByRole('button', {name: '이대로 수정하기'}));
        expect(prepare).toHaveBeenCalledOnce();
        expect(screen.getByRole('button', {name: '요청 수정하기'})).toBeDisabled();
        expect(mocks.confirmPlan).not.toHaveBeenCalled();
        expect(mocks.execute).not.toHaveBeenCalled();
        await act(async () => finishPreparation());
        await waitFor(() => expect(mocks.execute).toHaveBeenCalledOnce());
        expect(mocks.confirmPlan).toHaveBeenCalledExactlyOnceWith(1, proposal.interpretationId, 0, proposal.semanticPlan!.planHash);
        expect(mocks.refreshPlan).not.toHaveBeenCalled();
        expect(mocks.interpret).not.toHaveBeenCalled();
        expect(mocks.execute.mock.calls[0]?.[1]).toMatchObject({
            operationType: 'ADJUST',
            interpretationId: confirmed.interpretationId,
            expectedRevision: 0,
            planHash: proposal.semanticPlan!.planHash,
            sourceVersionId: source.versionId,
        });
    });

    it('cancels preparation without confirming or calculating and allows another attempt', async () => {
        const {proposal} = semanticRequest();

        confirmSemanticRequest(proposal);

        let cancelPreparation!: (reason: Error) => void;

        const prepare = vi.fn().mockImplementationOnce(
            () =>
                new Promise<void>((_resolve, reject) => {
                    cancelPreparation = reject;
                }),
        );

        renderSidebar({onPrepareAdjustment: prepare});
        await userEvent.click(await screen.findByRole('button', {name: '이대로 수정하기'}));
        expect(prepare).toHaveBeenCalledOnce();
        await act(async () => cancelPreparation(new Error('준비를 취소했어요.')));
        await waitFor(() => expect(screen.getByRole('button', {name: '이대로 수정하기'})).toBeEnabled());
        expect(screen.getByRole('button', {name: '요청 수정하기'})).toBeEnabled();
        expect(mocks.confirmPlan).not.toHaveBeenCalled();
        expect(mocks.execute).not.toHaveBeenCalled();
        prepare.mockResolvedValueOnce(undefined);
        await userEvent.click(screen.getByRole('button', {name: '이대로 수정하기'}));
        await waitFor(() => expect(mocks.execute).toHaveBeenCalledOnce());
        expect(prepare).toHaveBeenCalledTimes(2);
        expect(mocks.confirmPlan).toHaveBeenCalledOnce();
    });

    it.each(['PREVIEW_READY', 'LOCKED_CONFLICT'])(
        'revalidates the same conditions against newly protected shifts before execution: %s',
        async (state) => {
            const {proposal} = semanticRequest();
            const refreshed: TConversationTurn = {
                ...proposal,
                eventId: 3,
                sequence: 3,
                interpretationId: 'proposal:prepared',
                baseRevision: 1,
                semanticPlan: {
                    ...proposal.semanticPlan!,
                    planId: 'p:prepared',
                    sourceVersionId: 'source:prepared',
                    state,
                    confirmationAllowed: state === 'PREVIEW_READY',
                },
            };
            const confirmed = confirmSemanticRequest(refreshed);
            const prepare = vi.fn(async () => {
                mocks.draftFixed = true;
            });

            mocks.sync.mockImplementationOnce(async () => {
                current = {
                    ...current,
                    draft: {...source, versionId: 'source:prepared', cells: [{...cell, fixed: true}]},
                    conversation: {
                        ...current.conversation,
                        revision: 1,
                        currentVersionId: 'source:prepared',
                        latestInterpretationId: null,
                    },
                };

                return current;
            });
            mocks.refreshPlan.mockImplementationOnce(async () => {
                current = {
                    ...current,
                    turns: [...current.turns, refreshed],
                    conversation: {...current.conversation, latestInterpretationId: refreshed.interpretationId},
                };

                return refreshed;
            });
            renderSidebar({onPrepareAdjustment: prepare});
            await userEvent.click(await screen.findByRole('button', {name: '이대로 수정하기'}));
            await waitFor(() =>
                expect(mocks.refreshPlan).toHaveBeenCalledExactlyOnceWith(
                    1,
                    proposal.semanticPlan!.planId,
                    1,
                    proposal.semanticPlan!.planHash,
                ),
            );
            expect(prepare).toHaveBeenCalledOnce();
            expect(mocks.interpret).not.toHaveBeenCalled();

            if (state === 'LOCKED_CONFLICT') {
                expect(await screen.findByText('고정 근무와 요청이 충돌해요')).toBeVisible();
                expect(mocks.confirmPlan).not.toHaveBeenCalled();
                expect(mocks.execute).not.toHaveBeenCalled();
            } else {
                await waitFor(() => expect(mocks.execute).toHaveBeenCalledOnce());
                expect(mocks.confirmPlan).toHaveBeenCalledExactlyOnceWith(
                    1,
                    refreshed.interpretationId,
                    1,
                    proposal.semanticPlan!.planHash,
                );
                expect(mocks.execute.mock.calls[0]?.[1]).toMatchObject({
                    operationType: 'ADJUST',
                    interpretationId: confirmed.interpretationId,
                    expectedRevision: 1,
                    planHash: proposal.semanticPlan!.planHash,
                    sourceVersionId: 'source:prepared',
                });
            }
        },
    );

    it.each(['context', 'newer-plan'])(
        'does not reuse the reviewed plan if the conversation changes during preparation: %s',
        async (changed) => {
            semanticRequest();

            let finishPreparation!: () => void;

            const prepare = vi.fn(
                () =>
                    new Promise<void>((resolve) => {
                        finishPreparation = resolve;
                    }),
            );

            mocks.sync.mockImplementationOnce(async () => {
                current = {
                    ...current,
                    contextHash: changed === 'context' ? 'rules:changed' : current.contextHash,
                    draft: {...source, versionId: 'source:prepared', cells: [{...cell, fixed: true}]},
                    conversation: {
                        ...current.conversation,
                        revision: 1,
                        currentVersionId: 'source:prepared',
                        latestInterpretationId: changed === 'newer-plan' ? 'proposal:newer' : null,
                    },
                };

                return current;
            });
            renderSidebar({onPrepareAdjustment: prepare});
            await userEvent.click(await screen.findByRole('button', {name: '이대로 수정하기'}));
            mocks.draftFixed = true;
            await act(async () => finishPreparation());
            await waitFor(() => expect(screen.getByRole('alert')).toBeVisible());
            expect(mocks.refreshPlan).not.toHaveBeenCalled();
            expect(mocks.confirmPlan).not.toHaveBeenCalled();
            expect(mocks.execute).not.toHaveBeenCalled();
        },
    );

    it.each(['PREVIEW_READY', 'NEEDS_CLARIFICATION'])(
        'shows one request-review status until interpretation finishes: %s',
        async (state) => {
            const {proposal} = semanticRequest(state);
            const prepare = vi.fn().mockResolvedValue(undefined);

            let finishInterpretation!: (value: TConversationTurn) => void;

            mocks.interpret.mockImplementationOnce(
                () =>
                    new Promise<TConversationTurn>((resolve) => {
                        finishInterpretation = resolve;
                    }),
            );
            renderSidebar({onPrepareAdjustment: prepare});
            await screen.findByRole('button', {name: '요청 수정하기'});

            if (state === 'PREVIEW_READY') {
                await userEvent.click(screen.getByRole('button', {name: '요청 수정하기'}));
            }

            const input = screen.getByRole('textbox', {name: '바꾸고 싶은 내용'});

            await userEvent.clear(input);
            await userEvent.type(input, '김 간호사 1~5일 N 금지');
            await userEvent.click(screen.getByRole('button', {name: state === 'PREVIEW_READY' ? '수정한 요청 확인' : '요청 보내기'}));
            await waitFor(() => expect(mocks.interpret).toHaveBeenCalledOnce());
            expect(prepare).not.toHaveBeenCalled();
            expect(screen.getAllByText('요청 확인 중')).toHaveLength(1);
            expect(screen.queryByText('요청을 확인하고 있어요.')).not.toBeInTheDocument();
            expect(screen.queryByText('대화 불러오는 중')).not.toBeInTheDocument();
            expect(input).toBeDisabled();
            expect(mocks.execute).not.toHaveBeenCalled();
            await act(async () => finishInterpretation(proposal));
            await waitFor(() => expect(screen.queryByText('요청 확인 중')).not.toBeInTheDocument());
            expect(mocks.execute).not.toHaveBeenCalled();
        },
    );

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
    it('groups current AI requests and saved monthly requests separately from selected ward constraints', async () => {
        const semanticLabel = '김 간호사 1일 N 금지';

        current.conversationState = {
            version: 7,
            sourceVersionId: source.versionId,
            contextHash: current.contextHash,
            expiresAt: null,
            conditions: [{conditionId: 'semantic:one', text: semanticLabel, preview: {status: 'PREVIEW_READY'}}],
            pendingQuestion: null,
        };
        mocks.getShiftConstraintRules.mockResolvedValue({
            schemaVersion: 1,
            wardId: 1,
            shiftTeamId: 2,
            rules: [wardCondition, {...wardCondition, shiftConstraintRuleId: 52, displayText: '선택하지 않은 제약조건', selected: false}],
        });
        mocks.getScheduleMonthRequests.mockResolvedValue({
            year: 2026,
            month: 11,
            requests: [
                monthlyCondition,
                {...monthlyCondition, id: 42, displayLabel: '이미 해제한 AI 요청', status: 'DISABLED'},
                {...monthlyCondition, id: 43, displayLabel: '제약조건으로 옮긴 AI 요청', promotedRuleId: 51},
            ],
        });
        renderSidebar();
        await userEvent.click(await screen.findByRole('button', {name: '현재 적용된 제약조건 보기'}));
        expect(await screen.findByRole('heading', {name: /^AI 요청\s*2$/})).toBeVisible();

        const aiGroup = screen.getByRole('region', {name: 'AI로 추가한 조건'});

        expect(within(aiGroup).getByText(semanticLabel)).toBeVisible();
        expect(within(aiGroup).getByText('현재 대화')).toBeVisible();
        expect(within(aiGroup).getByText(monthlyCondition.displayLabel)).toBeVisible();
        expect(within(aiGroup).getByText('이번 달에 저장됨')).toBeVisible();
        expect(within(aiGroup).queryByText(wardCondition.displayText!)).not.toBeInTheDocument();
        expect(screen.getByRole('region', {name: '제약조건 탭의 조건'})).toBeVisible();
        expect(screen.getByRole('region', {name: '테스트 제약조건 편집기'})).toHaveAttribute('data-context', '1:2:2026-11');
        expect(screen.queryByRole('tab')).not.toBeInTheDocument();
        expect(screen.queryByText('선택하지 않은 제약조건')).not.toBeInTheDocument();
        expect(screen.queryByText('이미 해제한 AI 요청')).not.toBeInTheDocument();
        expect(screen.queryByText('제약조건으로 옮긴 AI 요청')).not.toBeInTheDocument();
        expect(mocks.getShiftConstraintRules).toHaveBeenCalledWith(1, 2, 2026, 11);
        expect(mocks.getScheduleMonthRequests).toHaveBeenCalledWith(1, 2, 2026, 11);
        expect(mocks.execute).not.toHaveBeenCalled();
    });
    it('removes only the chosen semantic condition with the reviewed state version and keeps the schedule unchanged', async () => {
        const {proposal} = semanticRequest();
        const removedLabel = '김 간호사 1일 N 금지';
        const keptLabel = '김 간호사 12일 O 배정';

        current.conversationState = {
            version: 7,
            sourceVersionId: source.versionId,
            contextHash: current.contextHash,
            expiresAt: null,
            conditions: [
                {conditionId: 'condition:remove', text: removedLabel, preview: {status: 'PREVIEW_READY'}},
                {conditionId: 'condition:keep', text: keptLabel, preview: {status: 'PREVIEW_READY'}},
            ],
            pendingQuestion: null,
        };
        mocks.interpret.mockImplementationOnce(async () => {
            current = {
                ...current,
                conversationState: {...current.conversationState!, version: 8, conditions: [current.conversationState!.conditions[1]]},
            };

            return proposal;
        });

        const initialDoc = useShiftEditorStore.getState().doc;

        renderSidebar();
        await userEvent.click(await screen.findByRole('button', {name: '현재 적용된 제약조건 보기'}));
        await userEvent.click(screen.getByRole('button', {name: `${removedLabel} 삭제`}));
        await waitFor(() => expect(mocks.interpret).toHaveBeenCalledOnce());
        expect(mocks.interpret.mock.calls[0]).toEqual([
            1,
            expect.objectContaining({
                expectedRevision: 0,
                expectedStateVersion: 7,
                change: 'REMOVE',
                targetConditionIds: ['condition:remove'],
                text: expect.stringMatching(/\S/),
            }),
        ]);
        expect(await screen.findByRole('heading', {name: /^AI 요청\s*1$/})).toBeVisible();
        expect(screen.queryByRole('button', {name: `${removedLabel} 삭제`})).not.toBeInTheDocument();
        expect(screen.getByRole('button', {name: `${keptLabel} 삭제`})).toBeVisible();
        expect(mocks.updateScheduleMonthRequest).not.toHaveBeenCalled();
        expect(mocks.confirmPlan).not.toHaveBeenCalled();
        expect(mocks.execute).not.toHaveBeenCalled();
        expect(mocks.applyAdjustedDoc).not.toHaveBeenCalled();
        expect(useShiftEditorStore.getState().doc).toBe(initialDoc);
    });
    it('retires the old preview after saving a monthly rest target without regenerating or changing cells', async () => {
        semanticRequest();
        current = {
            ...current,
            operations: [
                {
                    ...operation,
                    sequence: 3,
                    executionStatus: 'FAILED',
                    applyStatus: 'NOT_APPLIED',
                    interpretationId: null,
                    result: {
                        ...successfulResult,
                        applicable: false,
                        changedCells: [],
                        engineResult: {
                            status: 'INFEASIBLE',
                            violations: [
                                {
                                    type: 'PERSONAL_MONTHLY_REST_CAPACITY_CONFLICT',
                                    nurseId: 1,
                                    shiftCodes: ['O'],
                                    expected: 9,
                                    minimumAssignments: 0,
                                    maximumAssignments: 8,
                                },
                            ],
                        },
                    },
                },
            ],
        };
        mocks.applyConstraints.mockImplementationOnce(async () => {
            current = {...current, contextHash: 'rules:after-rest-edit'};

            return true;
        });

        const initialDoc = useShiftEditorStore.getState().doc;

        renderSidebar();

        const oldPreview = await screen.findByRole('button', {name: '이대로 수정하기'});

        await waitFor(() => expect(oldPreview).toBeEnabled());
        await userEvent.click(screen.getByRole('button', {name: i18n.t('aiAutofillUi.conflictReview.editSettings')}));

        await userEvent.click(await screen.findByRole('button', {name: '제약조건 수정'}));
        await userEvent.click(screen.getByRole('button', {name: '변경사항 적용'}));
        await waitFor(() => expect(screen.queryByRole('dialog', {name: '제약조건'})).not.toBeInTheDocument());
        expect(oldPreview).toBeDisabled();
        await userEvent.click(oldPreview);
        expect(mocks.confirmPlan).not.toHaveBeenCalled();
        expect(mocks.execute).not.toHaveBeenCalled();
        expect(mocks.applyAdjustedDoc).not.toHaveBeenCalled();
        expect(useShiftEditorStore.getState().doc).toBe(initialDoc);
    });
    it('applies ward rules in the same modal, refreshes conversation context, and invalidates the old preview without changing the schedule', async () => {
        semanticRequest();
        mocks.getShiftConstraintRules.mockResolvedValue({schemaVersion: 1, wardId: 1, shiftTeamId: 2, rules: [wardCondition]});
        mocks.applyConstraints.mockImplementationOnce(async () => {
            current = {...current, contextHash: 'rules:after-ward-edit'};

            return true;
        });

        const initialDoc = useShiftEditorStore.getState().doc;
        const onOpenConstraints = vi.fn();

        renderSidebar({onOpenConstraints});

        const oldPreview = await screen.findByRole('button', {name: '이대로 수정하기'});

        await waitFor(() => expect(oldPreview).toBeEnabled());
        await userEvent.click(screen.getByRole('button', {name: '현재 적용된 제약조건 보기'}));

        const previousReads = mocks.getShiftConstraintRules.mock.calls.length;

        await userEvent.click(screen.getByRole('button', {name: '제약조건 수정'}));
        expect(mocks.applyConstraints).not.toHaveBeenCalled();
        await userEvent.click(screen.getByRole('button', {name: '변경사항 적용'}));
        await waitFor(() => expect(screen.queryByRole('dialog', {name: '제약조건'})).not.toBeInTheDocument());
        expect(mocks.applyConstraints).toHaveBeenCalledOnce();
        expect(mocks.getShiftConstraintRules.mock.calls.length).toBeGreaterThan(previousReads);
        expect(mocks.detail.mock.calls.length).toBeGreaterThanOrEqual(2);
        expect(oldPreview).toBeDisabled();
        await userEvent.click(oldPreview);
        expect(onOpenConstraints).not.toHaveBeenCalled();
        expect(mocks.confirmPlan).not.toHaveBeenCalled();
        expect(mocks.updateScheduleMonthRequest).not.toHaveBeenCalled();
        expect(mocks.execute).not.toHaveBeenCalled();
        expect(mocks.applyAdjustedDoc).not.toHaveBeenCalled();
        expect(useShiftEditorStore.getState().doc).toBe(initialDoc);
    });
    it('keeps the ward editor open and the old preview blocked when a saved rule change cannot refresh its conversation context', async () => {
        semanticRequest();

        const initialDoc = useShiftEditorStore.getState().doc;

        renderSidebar();

        const oldPreview = await screen.findByRole('button', {name: '이대로 수정하기'});

        await waitFor(() => expect(oldPreview).toBeEnabled());
        await userEvent.click(screen.getByRole('button', {name: '현재 적용된 제약조건 보기'}));
        await userEvent.click(screen.getByRole('button', {name: '제약조건 수정'}));
        mocks.detail.mockRejectedValueOnce(new Error('Saved rules could not refresh conversation context'));
        await userEvent.click(screen.getByRole('button', {name: '변경사항 적용'}));
        await waitFor(() => expect(screen.getByRole('button', {name: '변경사항 적용'})).toBeEnabled());
        expect(screen.getByRole('dialog', {name: '제약조건'})).toBeVisible();
        expect(oldPreview).toBeDisabled();
        expect(mocks.applyConstraints).toHaveBeenCalledOnce();
        expect(mocks.confirmPlan).not.toHaveBeenCalled();
        expect(mocks.execute).not.toHaveBeenCalled();
        expect(useShiftEditorStore.getState().doc).toBe(initialDoc);
    });
    it('finishes removing the final semantic condition without a clarification loop or discarding conversation history', async () => {
        const {raw, proposal} = semanticRequest();
        const label = '김 간호사 1일 N 금지';

        current.conversationState = {
            version: 7,
            sourceVersionId: source.versionId,
            contextHash: current.contextHash,
            expiresAt: null,
            conditions: [{conditionId: 'condition:last', text: label, preview: {status: 'PREVIEW_READY'}}],
            pendingQuestion: null,
        };
        mocks.interpret.mockImplementationOnce(async () => {
            const removed: TConversationTurn = {
                ...proposal,
                eventId: 3,
                sequence: 3,
                interpretationId: 'proposal:empty',
                semanticPlan: {
                    ...proposal.semanticPlan!,
                    planId: 'plan:empty',
                    state: 'NEEDS_CLARIFICATION',
                    conditions: [],
                    reasonCodes: ['EMPTY_CONDITIONS'],
                    confirmationAllowed: false,
                },
            };

            current = {
                ...current,
                conversation: {...current.conversation, latestInterpretationId: removed.interpretationId},
                conversationState: {...current.conversationState!, version: 8, conditions: [], pendingQuestion: null},
                turns: [...current.turns, removed],
            };

            return removed;
        });

        const initialDoc = useShiftEditorStore.getState().doc;

        renderSidebar();
        await userEvent.click(await screen.findByRole('button', {name: '현재 적용된 제약조건 보기'}));
        await userEvent.click(screen.getByRole('button', {name: `${label} 삭제`}));
        expect(await screen.findByRole('heading', {name: /^AI 요청\s*0$/})).toBeVisible();
        await userEvent.click(screen.getByRole('button', {name: '조건 목록 닫기'}));

        const completion = await screen.findByRole('region', {name: '조건 삭제 완료'});

        expect(completion).toHaveTextContent('요청 조건을 삭제했어요.');
        expect(completion).toHaveTextContent('새 요청을 입력해 주세요.');
        expect(within(completion).queryByRole('button')).not.toBeInTheDocument();
        expect(screen.getByRole('complementary')).toHaveTextContent(raw);
        expect(screen.getByRole('textbox', {name: '바꾸고 싶은 내용'})).toBeVisible();
        expect(screen.queryByRole('button', {name: '이대로 수정하기'})).not.toBeInTheDocument();
        expect(screen.queryByRole('button', {name: '요청 수정하기'})).not.toBeInTheDocument();
        expect(mocks.interpret).toHaveBeenCalledOnce();
        expect(mocks.interpret.mock.calls[0][1]).toMatchObject({
            expectedStateVersion: 7,
            change: 'REMOVE',
            targetConditionIds: ['condition:last'],
        });
        expect(mocks.confirmPlan).not.toHaveBeenCalled();
        expect(mocks.execute).not.toHaveBeenCalled();
        expect(mocks.applyAdjustedDoc).not.toHaveBeenCalled();
        expect(useShiftEditorStore.getState().doc).toBe(initialDoc);
    });
    it('keeps a successfully deleted monthly condition removed when detail refresh fails and blocks the old preview until rechecked', async () => {
        vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({matches: false}));
        semanticRequest();
        mocks.getScheduleMonthRequests.mockResolvedValue({year: 2026, month: 11, requests: [monthlyCondition]});
        mocks.updateScheduleMonthRequest.mockImplementationOnce(async () => {
            mocks.getScheduleMonthRequests.mockResolvedValue({year: 2026, month: 11, requests: []});

            return {...monthlyCondition, status: 'DISABLED'};
        });

        const initialDoc = useShiftEditorStore.getState().doc;

        render(
            <>
                {sidebarElement()}
                <Toaster />
            </>,
        );

        const apply = await screen.findByRole('button', {name: '이대로 수정하기'});

        await waitFor(() => expect(apply).toBeEnabled());
        await userEvent.click(await screen.findByRole('button', {name: '현재 적용된 제약조건 보기'}));
        mocks.detail.mockRejectedValueOnce(new Error('Lost refresh after a committed deletion'));
        await userEvent.click(screen.getByRole('button', {name: `${monthlyCondition.displayLabel} 삭제`}));
        expect(await screen.findByText('조건을 삭제했어요.')).toBeVisible();
        expect(await screen.findByText('조건을 불러오지 못했어요.')).toBeVisible();
        expect(screen.queryByRole('button', {name: `${monthlyCondition.displayLabel} 삭제`})).not.toBeInTheDocument();
        expect(screen.getByRole('heading', {name: /^AI 요청\s*0$/})).toBeVisible();
        expect(apply).toBeDisabled();
        await userEvent.click(screen.getByRole('button', {name: '조건 목록 닫기'}));
        await userEvent.click(apply);
        expect(mocks.confirmPlan).not.toHaveBeenCalled();
        expect(mocks.execute).not.toHaveBeenCalled();

        current = {...current, contextHash: 'rules:after-removal'};
        // Reopen the condition manager to refresh after checking the disabled stale action.
        await userEvent.click(screen.getByRole('button', {name: '현재 적용된 제약조건 보기'}));
        await userEvent.click(screen.getByRole('button', {name: '다시 불러오기'}));
        await waitFor(() => expect(screen.queryByText('조건을 불러오지 못했어요.')).not.toBeInTheDocument());
        expect(screen.queryByRole('button', {name: `${monthlyCondition.displayLabel} 삭제`})).not.toBeInTheDocument();
        expect(apply).toBeDisabled();
        expect(mocks.updateScheduleMonthRequest).toHaveBeenCalledExactlyOnceWith(1, 2, 41, {status: 'DISABLED'});
        expect(mocks.detail.mock.calls.length).toBeGreaterThanOrEqual(3);
        expect(mocks.interpret).not.toHaveBeenCalled();
        expect(mocks.confirmPlan).not.toHaveBeenCalled();
        expect(mocks.execute).not.toHaveBeenCalled();
        expect(mocks.applyAdjustedDoc).not.toHaveBeenCalled();
        expect(useShiftEditorStore.getState().doc).toBe(initialDoc);
    });
    it('disables only the selected monthly AI request once and preserves ward rules and the current schedule', async () => {
        mocks.getShiftConstraintRules.mockResolvedValue({schemaVersion: 1, wardId: 1, shiftTeamId: 2, rules: [wardCondition]});
        mocks.getScheduleMonthRequests.mockResolvedValue({year: 2026, month: 11, requests: [monthlyCondition]});

        let finishRemoval!: (value: TScheduleMonthRequestRes) => void;

        mocks.updateScheduleMonthRequest.mockImplementationOnce(
            () =>
                new Promise<TScheduleMonthRequestRes>((resolve) => {
                    finishRemoval = resolve;
                }),
        );

        const initialDoc = useShiftEditorStore.getState().doc;

        renderSidebar();
        await userEvent.click(await screen.findByRole('button', {name: '현재 적용된 제약조건 보기'}));

        const remove = screen.getByRole('button', {name: `${monthlyCondition.displayLabel} 삭제`});

        await userEvent.dblClick(remove);
        expect(mocks.updateScheduleMonthRequest).toHaveBeenCalledExactlyOnceWith(1, 2, 41, {status: 'DISABLED'});
        expect(remove).toBeDisabled();
        mocks.getScheduleMonthRequests.mockResolvedValue({year: 2026, month: 11, requests: [{...monthlyCondition, status: 'DISABLED'}]});
        await act(async () => finishRemoval({...monthlyCondition, status: 'DISABLED'}));
        expect(await screen.findByRole('heading', {name: /^AI 요청\s*0$/})).toBeVisible();
        expect(screen.queryByRole('button', {name: `${monthlyCondition.displayLabel} 삭제`})).not.toBeInTheDocument();
        expect(screen.getByRole('region', {name: '제약조건 탭의 조건'})).toBeVisible();
        expect(screen.getByRole('region', {name: '테스트 제약조건 편집기'})).toHaveAttribute('data-context', '1:2:2026-11');
        expect(mocks.applyConstraints).not.toHaveBeenCalled();
        expect(mocks.interpret).not.toHaveBeenCalled();
        expect(mocks.execute).not.toHaveBeenCalled();
        expect(mocks.applyAdjustedDoc).not.toHaveBeenCalled();
        expect(useShiftEditorStore.getState().doc).toBe(initialDoc);
    });
    it('retains a monthly AI condition after deletion fails and allows the same condition to be retried', async () => {
        mocks.getScheduleMonthRequests.mockResolvedValue({year: 2026, month: 11, requests: [monthlyCondition]});
        mocks.updateScheduleMonthRequest.mockRejectedValueOnce(new Error('Condition removal failed')).mockImplementationOnce(async () => {
            mocks.getScheduleMonthRequests.mockResolvedValue({year: 2026, month: 11, requests: []});

            return {...monthlyCondition, status: 'DISABLED'};
        });
        renderSidebar();
        await userEvent.click(await screen.findByRole('button', {name: '현재 적용된 제약조건 보기'}));
        await userEvent.click(screen.getByRole('button', {name: `${monthlyCondition.displayLabel} 삭제`}));
        await waitFor(() => expect(mocks.updateScheduleMonthRequest).toHaveBeenCalledOnce());
        await waitFor(() => expect(screen.getByRole('button', {name: `${monthlyCondition.displayLabel} 삭제`})).toBeEnabled());
        expect(screen.getByRole('heading', {name: /^AI 요청\s*1$/})).toBeVisible();
        await userEvent.click(screen.getByRole('button', {name: `${monthlyCondition.displayLabel} 삭제`}));
        await waitFor(() => expect(mocks.updateScheduleMonthRequest).toHaveBeenCalledTimes(2));
        await waitFor(() => expect(screen.queryByRole('button', {name: `${monthlyCondition.displayLabel} 삭제`})).not.toBeInTheDocument());
        expect(mocks.execute).not.toHaveBeenCalled();
        expect(mocks.applyAdjustedDoc).not.toHaveBeenCalled();
    });
    it('sends only a new answer with the server state version and waiting condition ID', async () => {
        const {raw, proposal} = semanticRequest();

        proposal.semanticPlan!.state = 'NEEDS_CLARIFICATION';
        proposal.semanticPlan!.confirmationAllowed = false;
        current.conversationState = {
            version: 7,
            sourceVersionId: current.conversation.currentVersionId,
            contextHash: current.contextHash,
            expiresAt: null,
            conditions: [{conditionId: 'condition:waiting', text: raw, preview: {status: 'NEEDS_CLARIFICATION'}}],
            pendingQuestion: {conditionId: 'condition:waiting', question: 'O로 배정할까요?'},
        };
        mocks.interpret.mockResolvedValue(proposal);
        renderSidebar();
        await screen.findByText('O로 배정할까요?');
        await userEvent.type(screen.getByRole('textbox'), 'O로 배정해줘.');
        await userEvent.click(screen.getByRole('button', {name: '요청 보내기'}));
        await waitFor(() => expect(mocks.interpret).toHaveBeenCalledOnce());
        expect(mocks.interpret.mock.calls[0][1]).toMatchObject({
            text: 'O로 배정해줘.',
            expectedStateVersion: 7,
            change: 'UPDATE',
            targetConditionIds: ['condition:waiting'],
        });
        expect(mocks.confirmPlan).not.toHaveBeenCalled();
        expect(mocks.execute).not.toHaveBeenCalled();
    });
    it('adds a separate condition while a question is waiting instead of treating it as an answer', async () => {
        const {raw, proposal} = semanticRequest();

        proposal.semanticPlan!.state = 'NEEDS_CLARIFICATION';
        proposal.semanticPlan!.confirmationAllowed = false;
        current.conversationState = {
            version: 7,
            sourceVersionId: current.conversation.currentVersionId,
            contextHash: current.contextHash,
            expiresAt: null,
            conditions: [{conditionId: 'condition:waiting', text: raw, preview: {status: 'NEEDS_CLARIFICATION'}}],
            pendingQuestion: {conditionId: 'condition:waiting', question: 'O로 배정할까요?'},
        };
        mocks.interpret.mockResolvedValue(proposal);
        renderSidebar();
        await userEvent.selectOptions(await screen.findByRole('combobox', {name: '조건 수정 방식'}), 'ADD');
        await userEvent.type(screen.getByRole('textbox'), '박 간호사 10일 N 금지');
        await userEvent.click(screen.getByRole('button', {name: '요청 보내기'}));
        await waitFor(() => expect(mocks.interpret).toHaveBeenCalledOnce());
        expect(mocks.interpret.mock.calls[0][1]).toMatchObject({
            text: '박 간호사 10일 N 금지',
            expectedStateVersion: 7,
            change: 'ADD',
            targetConditionIds: [],
        });
        expect(mocks.execute).not.toHaveBeenCalled();
    });
    it('uses explicitly selected condition IDs for removal and keeps the original clause visible', async () => {
        const {raw, proposal} = semanticRequest();

        proposal.semanticPlan!.state = 'NEEDS_CLARIFICATION';
        proposal.semanticPlan!.confirmationAllowed = false;
        current.conversationState = {
            version: 3,
            sourceVersionId: current.conversation.currentVersionId,
            contextHash: current.contextHash,
            expiresAt: null,
            conditions: [{conditionId: 'condition:1', text: raw, preview: {status: 'PREVIEW_READY'}}],
            pendingQuestion: null,
        };
        mocks.interpret.mockResolvedValue(proposal);
        renderSidebar();

        const mode = await screen.findByRole('combobox', {name: '조건 수정 방식'});

        await userEvent.selectOptions(mode, 'REMOVE');
        await userEvent.click(screen.getByRole('checkbox', {name: raw}));
        await userEvent.type(screen.getByRole('textbox'), '삭제해줘');
        await userEvent.click(screen.getByRole('button', {name: '요청 보내기'}));
        await waitFor(() => expect(mocks.interpret).toHaveBeenCalledOnce());
        expect(mocks.interpret.mock.calls[0][1]).toMatchObject({
            text: '삭제해줘',
            expectedStateVersion: 3,
            change: 'REMOVE',
            targetConditionIds: ['condition:1'],
        });
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
        await userEvent.click(await screen.findByRole('button', {name: i18n.t('aiAdjust.chat.modify')}));

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
        const prepare = vi.fn().mockResolvedValue(undefined);

        mocks.interpret.mockResolvedValue(proposal);
        renderSidebar({onPrepareAdjustment: prepare});
        await userEvent.click(await screen.findByRole('button', {name: '다시 시도하기'}));
        await waitFor(() =>
            expect(mocks.interpret).toHaveBeenCalledWith(
                1,
                expect.objectContaining({text: raw, previousInterpretationId: 'proposal:1', change: 'REPLACE'}),
            ),
        );
        expect(mocks.confirmPlan).not.toHaveBeenCalled();
        expect(prepare).not.toHaveBeenCalled();
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
            await waitFor(() => expect(screen.getByRole('button', {name: '초기화'})).toBeEnabled(), {timeout: 5000});
            expect(screen.queryByText('아직 근무표를 작성하고 있어요. 잠시만 기다려 주세요.')).not.toBeInTheDocument();

            if (executionStatus === 'SUCCEEDED') expectNoLocalApplicationClaim();

            await userEvent.click(screen.getByRole('button', {name: '초기화'}));
            await waitFor(() => expect(mocks.startSegment).toHaveBeenCalledOnce());
            expect(sessionStorage.getItem(key)).toBeNull();
        },
        12000,
    );
});
