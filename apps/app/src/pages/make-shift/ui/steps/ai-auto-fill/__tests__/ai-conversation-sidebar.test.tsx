import type {ComponentProps} from 'react';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import type {TShift} from '@/entities/shift';
import type * as ShiftEditorModule from '@/features/shift-editor';
import {useShiftEditorStore} from '@/features/shift-editor/model/store';
import {act, render, screen, userEvent, waitFor} from '@/shared/util/test-utils';
import type * as ConversationApiModule from '../../../../model/schedule-conversation-api';
import type {TConversationDetail, TConversationOperation, TResultVersion} from '../../../../model/schedule-conversation-api';
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
    preferences: vi.fn(),
    savePreference: vi.fn(),
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
                        {wardShiftTypeId: 1, shortName: 'D', name: 'Day', color: '#44c4b0', isDefault: true, isOff: false, isCounted: true, startTime: '07:00', endTime: '15:00', classification: 'DAY'},
                        {wardShiftTypeId: 4, shortName: 'O', name: 'Off', color: '#455a7a', isDefault: true, isOff: true, isCounted: true, startTime: '', endTime: '', classification: 'OFF'},
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
            expect(screen.queryByText(/근무표를 채웠어요!|Your schedule is ready/)).not.toBeInTheDocument();
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
        await userEvent.click(await screen.findByRole('button', {name: /^그대로 한 번 더 돌려볼래요$|^Refill with the same conditions$/}));
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
        await screen.findByText(/근무표를 채웠어요!|Your schedule is ready/);
        expect(screen.getByText('전달 근무에 빈칸이 있어요.')).toBeVisible();
        expect(screen.getByText('이대로 진행할게요')).toBeVisible();
        expect(screen.getByText('이대로 자동채우기')).toBeVisible();

        const panel = screen.getByRole('complementary');

        expect(panel.textContent).toMatch(
            /전달 근무에 빈칸이 있어요.[\s\S]*이대로 진행할게요[\s\S]*이대로 자동채우기[\s\S]*(근무표를 채웠어요!|Your schedule is ready)/,
        );
        expect(mocks.interpret).not.toHaveBeenCalled();
        expect(mocks.confirm).not.toHaveBeenCalled();
        expect(mocks.create).not.toHaveBeenCalled();

        await userEvent.click(screen.getByRole('button', {name: /^그대로 한 번 더 돌려볼래요$|^Refill with the same conditions$/}));
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
        expect(screen.getByText(/^그대로 한 번 더 돌려볼래요$|^Refill with the same conditions$/)).toBeVisible();
        expect(panel.textContent).toMatch(
            /이대로 자동채우기[\s\S]*(근무표를 채웠어요!|Your schedule is ready)[\s\S]*(그대로 한 번 더 돌려볼래요|Refill with the same conditions)[\s\S]*두 번째 고정 확인/,
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
        expect(screen.queryByRole('button', {name: /실행 기록 다시 확인|Check execution history/})).not.toBeInTheDocument();
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
        await userEvent.click(await screen.findByRole('button', {name: /그때 표 보기|View this result/}));
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
        await userEvent.click(screen.getByRole('button', {name: /^그대로 한 번 더 돌려볼래요$|^Refill with the same conditions$/}));
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
        expect(screen.queryByText(/현재 조건으로 전체|Rebuild the whole schedule with/)).not.toBeInTheDocument();
        await userEvent.click(modify);
        await screen.findByText(/어떤 점을 바꾸고 싶나요|What would you like to change/);
        expect(
            screen.queryByRole('button', {name: /^그대로 한 번 더 돌려볼래요$|^Refill with the same conditions$/}),
        ).not.toBeInTheDocument();
        expect(screen.getByRole('textbox')).toHaveFocus();
        expect(document.querySelector('.ai-adjust-chat-scroll')).toHaveAttribute('data-composer-hidden', 'false');
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

    it('starts a fresh chat from the current draft without regenerating or restoring the editor', async () => {
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
        mocks.branch.mockImplementation(async () => {
            current = {...current, turns: [], operations: [], conversation: {...current.conversation, conversationId: 2}};

            return current.conversation;
        });
        renderSidebar();
        await screen.findByText('이전 요청');
        expect(screen.queryByRole('button', {name: /^수정하고 싶은 부분이 있어요$|^I have some changes in mind$/})).not.toBeInTheDocument();
        await userEvent.click(screen.getByRole('button', {name: /새 채팅|New chat/}));
        await screen.findByRole('button', {name: /^수정하고 싶은 부분이 있어요$|^I have some changes in mind$/});
        expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
        expect(mocks.branch).toHaveBeenCalledWith(1, 'source:1', 0);
        expect(mocks.execute).not.toHaveBeenCalled();
        expect(mocks.applyAdjustedDoc).not.toHaveBeenCalled();
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
        expect(await screen.findByText('2026-11-01 ~ 2026-11-02', {exact: false})).toBeInTheDocument();
        expect(screen.queryByRole('button', {name: /확인한 조건으로 계산|Calculate confirmed conditions/})).not.toBeInTheDocument();
        await userEvent.click(screen.getByRole('button', {name: /이 조건으로 확인|Confirm these conditions/}));
        expect(mocks.confirmPlan).toHaveBeenCalledWith(1, 'plan:proposal', 0, 'a'.repeat(64));
        expect(mocks.confirm).not.toHaveBeenCalled();
        await userEvent.click(await screen.findByRole('button', {name: /확인한 조건으로 계산|Calculate confirmed conditions/}));
        await waitFor(() => expect(mocks.execute).toHaveBeenCalledOnce());
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
        expect(await screen.findByText(proposal.semanticPlan.summary)).toBeInTheDocument();
        expect(screen.queryByRole('button', {name: /이 조건으로 확인|Confirm these conditions/})).not.toBeInTheDocument();
        expect(mocks.execute).not.toHaveBeenCalled();
    });
});
