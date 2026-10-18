import {type ReactNode, useEffect, useLayoutEffect, useMemo, useRef, useState} from 'react';
import {createPortal} from 'react-dom';
import type {TShift} from '@/entities/shift';
import {getWardAdminAccountIdFromAccessToken, isWardAdminAccessToken} from '@/features/auth/model/admin-token';
import useAuthStore from '@/features/auth/model/store';
import {snapshotDetailToDoc, useShiftEditorCommands, useShiftEditorStore} from '@/features/shift-editor';
import {buildAutofillDTO} from '@/features/shift-editor/model/schedule-authoring';
import i18n from '@/i18n';
import nextIcon from '@/shared/assets/images/ai-adjust/next.svg';
import sendIcon from '@/shared/assets/images/ai-adjust/send.svg';
import {useTypedTranslation} from '@/shared/hook/use-typed-translation';
import {ConfirmationSpotlight} from '@/shared/ui/ConfirmActionDialog';
import {trackScheduleSignal} from '@/shared/util/growth-analytics';
import {describeAdjustChanges} from '../../../model/ai-adjust-conversation';
import {isScheduleFullyProtected} from '../../../model/ai-autofill-state';
import {AiConversationInputError, aiConversationFailure, type TAiConversationFailure} from '../../../model/ai-conversation-failure';
import {conversationOperationFailure as operationFailure, isGenerateReviewDraft} from '../../../model/ai-execution-failure';
import {isExecutionFinished, readPendingExecution} from '../../../model/conversation-pending-execution';
import {
    conversationTurnText,
    currentConversationTurns,
    operationAttempt,
    precedingCompletedOperation,
    requestTextForTurn,
    visibleConversationTurns,
} from '../../../model/conversation-presentation';
import {isConversationSuggestionCurrent, isFailureSuggestionAvailable} from '../../../model/conversation-suggestion';
import {loadMonthlyRestRequirement} from '../../../model/monthly-rest-requirement';
import {
    conversationApi,
    conversationEvents,
    isConversationConfirmationCurrent,
    isSemanticExecutionCurrent,
    type TConversation,
    type TConversationDetail,
    type TConversationExecute,
    type TConversationOperation,
    type TConversationPreference,
    type TConversationTurn,
    type TResultVersion,
} from '../../../model/schedule-conversation-api';
import {reportScheduleJourney} from '../../../model/schedule-journey';
import {ScheduleReportAttempt, scheduleReportScope} from '../../../model/schedule-report-attempt';
import {useConversationPolling} from '../../../model/use-conversation-polling';
import {AiAdjustInterpretCard} from './ai-adjust-interpret-card';
import type {TAdjustResultActions} from './ai-adjust-result';
import {AiAdjustApplyChoices, AssistantMessage, UserMessage} from './ai-adjust-review-conversation';
import {AiAutofillMessages, type TAutofillFlow, type TAutofillMessage} from './ai-autofill-preparation';
import {AiChatScroll} from './ai-chat-scroll';
import {ConversationConfirmation} from './ai-conversation-confirmation';
import {AiConversationEntry, AiInfoTip, type TConversationEntryChoice} from './ai-conversation-entry';
import {ConversationEvidence, ConversationSuggestionChanges, type TFailureSuggestion} from './ai-conversation-evidence';
import {AiConversationHistory} from './ai-conversation-history';
import {AiConversationImage} from './ai-conversation-image';
import {AiConversationResultDetails} from './ai-conversation-result-details';
import AiConversationSnapshot from './ai-conversation-snapshot';
import {AiExecutionFailure} from './ai-execution-failure';
import {AiFailureMessage} from './ai-failure-message';
import {AiSemanticReview} from './ai-semantic-review';
import {JourneyObserved} from './journey-observed';

type TProps = {
    open: boolean;
    preparation?: ReactNode;
    autofillFlow?: TAutofillFlow | null;
    onNewConversation?: () => void;
    spotlightSelector?: string;
    spotlightInteractive?: boolean;
    onPrepareGeneration?: () => void;
    onPrepareAdjustment?: () => Promise<void>;
    generationFillPolicy?: 'EMPTY_ONLY' | 'REBUILD_UNLOCKED';
    onClose: () => void;
    wardId: number;
    teamId: number;
    year: number;
    month: number;
    shift: TShift;
    adjustEnabled: boolean;
    generationRequest: number;
    rebuildRequest: number;
    onApplied: () => void;
    onGenerated?: () => void;
    onBusyChange?: (busy: boolean) => void;
    resultActions?: TAdjustResultActions;
};
type TLocalEvent = {kind: 'local'; id: string; sequence: number; messages: TAutofillMessage[]};
type TPreview = {version: TResultVersion; before?: TResultVersion};

const signature = (version: Pick<TResultVersion, 'cells' | 'rowOrder' | 'carryOverCells'>) =>
    JSON.stringify([
        version.cells
            .map((cell) => [cell.shiftNurseId, cell.date, cell.wardShiftTypeId ?? null, Boolean(cell.fixed)])
            .sort((a, b) => `${a[0]}:${a[1]}`.localeCompare(`${b[0]}:${b[1]}`)),
        version.rowOrder.map((row) => [row.shiftNurseId, row.displayOrder, row.priority, row.divisionNum]),
        (version.carryOverCells ?? [])
            .map((cell) => [cell.shiftNurseId, cell.date, cell.wardShiftTypeId ?? null])
            .sort((a, b) => `${a[0]}:${a[1]}`.localeCompare(`${b[0]}:${b[1]}`)),
    ]);
const buttonClass =
    'min-h-11 rounded-lg bg-gray-7 px-3 py-2 text-sm hover:bg-main-light hover:text-main-1 focus-visible:bg-main-1 focus-visible:text-white focus-visible:outline-none disabled:opacity-40';

export default function AiConversationSidebar({
    open,
    preparation,
    autofillFlow,
    onNewConversation,
    spotlightSelector,
    spotlightInteractive,
    onPrepareGeneration,
    onPrepareAdjustment,
    generationFillPolicy = 'EMPTY_ONLY',
    onClose,
    wardId,
    teamId,
    year,
    month,
    shift,
    adjustEnabled,
    generationRequest,
    rebuildRequest,
    onApplied,
    onGenerated,
    onBusyChange,
    resultActions,
}: TProps) {
    const {t} = useTypedTranslation();
    const preparing = Boolean(preparation);
    const [awaitingAdjustment, setAwaitingAdjustment] = useState(false);
    const awaitingAdjustmentRef = useRef(false);
    const reviewedPreparation = useRef<string | null>(null);
    const [entryChoice, setEntryChoice] = useState<TConversationEntryChoice | null>(null);
    const [dismissedFailureId, setDismissedFailureId] = useState<string | null>(null);
    const [localEvents, setLocalEvents] = useState<TLocalEvent[]>([]);
    const localSequence = useRef(0);
    const textarea = useRef<HTMLTextAreaElement>(null);
    const api = useMemo(() => conversationApi(wardId, teamId), [wardId, teamId]);
    const commands = useShiftEditorCommands();
    const doc = useShiftEditorStore((s) => s.doc);
    const semanticExecutionEnabled = useShiftEditorStore((s) => s.semanticExecutionEnabled);
    const isAutofillBlocked = isScheduleFullyProtected(doc);
    const revision = useShiftEditorStore((s) => s.draftRevision);
    const [detail, setDetail] = useState<TConversationDetail | null>(null);
    const detailRef = useRef<TConversationDetail | null>(null);
    const [earlierConversations, setEarlierConversations] = useState<TConversation[]>([]);
    const [busy, setBusy] = useState(false);
    const [executing, setExecuting] = useState(false);
    const busyRef = useRef(false);
    const [error, setError] = useState<TAiConversationFailure | null>(null);
    const [notice, setNotice] = useState<string | null>(null);
    const [text, setText] = useState('');
    const [editingRequest, setEditingRequest] = useState<TConversationTurn | null>(null);
    const [requestToolsOpen, setRequestToolsOpen] = useState(false);
    const [reportOperation, setReportOperation] = useState<string | null>(null);
    const [reportNote, setReportNote] = useState('');
    const [reportAttempt] = useState(() => new ScheduleReportAttempt());
    const [reportRecovery, setReportRecovery] = useState<boolean>();
    const reportScopeFor = (conversationId: number, operationId: string) => {
        const auth = useAuthStore.getState();
        const admin = isWardAdminAccessToken(auth.accessToken);

        return scheduleReportScope({
            mode: admin ? 'admin' : 'account',
            ownerId: admin ? getWardAdminAccountIdFromAccessToken(auth.accessToken) : auth.accountId,
            permission: auth.accountMe?.isManager ?? null,
            wardId,
            teamId,
            year,
            month,
            conversationId,
            operationId,
        });
    };
    const reportInput = useRef<HTMLTextAreaElement>(null);
    const reportTrigger = useRef<HTMLButtonElement | null>(null);
    const returnReportFocus = useRef(false);

    useEffect(() => {
        if (reportOperation && open) reportInput.current?.focus();
    }, [reportOperation, open]);

    useEffect(() => {
        if (returnReportFocus.current && !reportOperation && !busy && open) {
            returnReportFocus.current = false;
            reportTrigger.current?.focus();
        }
    }, [reportOperation, open, busy]);

    const closeReport = async (cancel = true) => {
        const conversationId = detailRef.current?.conversation.conversationId;

        if (cancel)
            await reportAttempt.cancel(conversationId && reportOperation ? reportScopeFor(conversationId, reportOperation) : undefined);
        else reportAttempt.complete();

        returnReportFocus.current = true;
        setReportOperation(null);
    };
    const [change, setChange] = useState<'REPLACE' | 'ADD' | 'RESET'>('ADD');
    const [previousId, setPreviousId] = useState<string>();
    const [preview, setPreview] = useState<TPreview | null>(null);
    const [pendingBranch, setPendingBranch] = useState<TConversationDetail | null>(null);
    const [preferences, setPreferences] = useState<TConversationPreference[]>([]);
    const [editingPreferenceId, setEditingPreferenceId] = useState<number>();
    const [rebuild, setRebuild] = useState(false);
    const [selectedSuggestion, setSelectedSuggestion] = useState<{op: TConversationOperation; suggestion: TFailureSuggestion}>();
    const mounted = useRef(true);
    const initialized = useRef(false);
    const syncTail = useRef<Promise<unknown>>(Promise.resolve());
    const lastGeneration = useRef(0);
    const lastRebuild = useRef(0);
    const pendingKey = `dutying.conversation:${isWardAdminAccessToken(useAuthStore.getState().accessToken) ? 'admin' : 'account'}:${useAuthStore.getState().accountId}:${wardId}:${teamId}:${year}:${month}`;
    const ko = i18n.language.startsWith('ko');
    const copy = (korean: string, english: string) => (ko ? korean : english);
    const preferenceSaveLabel =
        editingPreferenceId === undefined
            ? copy('자주 쓰는 요청으로 저장하기', 'Save request')
            : copy('저장한 요청 수정하기', 'Update saved request');
    const operationStatusLabel = (operation: TConversationOperation) => {
        if (operationFailure(operation)) return copy('실패', 'Not completed');

        if (operation.executionStatus === 'RUNNING') return copy('실행 중', 'Working');

        if (operation.executionStatus === 'RESULT_READY') return copy('결과 저장 중', 'Saving result');

        if (operation.executionStatus === 'SUCCEEDED')
            return t(
                operation.result && isGenerateReviewDraft(operation.result) ? 'aiAdjust.reviewDraft.status' : 'aiAdjust.recovery.succeeded',
            );

        return copy('결과 확인 필요', 'Check result');
    };
    const install = (next: TConversationDetail) => {
        if (
            detailRef.current?.conversation.conversationId === next.conversation.conversationId &&
            next.conversation.revision < detailRef.current.conversation.revision
        )
            return;

        if (detailRef.current && detailRef.current.conversation.conversationId !== next.conversation.conversationId) {
            reportAttempt.reset();
            setReportOperation(null);
            setReportNote('');
            reportTrigger.current = null;
            setLocalEvents([]);
            setEditingRequest(null);
            setRequestToolsOpen(false);
            onNewConversation?.();
        }

        const pending = readPendingExecution(sessionStorage, pendingKey);

        if (
            pending &&
            pending.conversationId === next.conversation.conversationId &&
            next.operations.some((op) => op.operationId === pending.operationId && isExecutionFinished(op))
        ) {
            sessionStorage.removeItem(pendingKey);
            setNotice((current) =>
                current === t('aiAdjust.recovery.running') || current === t('aiAdjust.recovery.unknown')
                    ? t('aiAdjust.recovery.complete')
                    : current,
            );
        }

        detailRef.current = next;

        if (mounted.current) {
            setDetail(next);

            if (
                next.operations.some(
                    (op) =>
                        op.operationType === 'GENERATE' &&
                        op.executionStatus === 'SUCCEEDED' &&
                        op.applyStatus === 'APPLIED' &&
                        !operationFailure(op),
                )
            )
                onGenerated?.();
        }
    };
    const dto = () => {
        const state = useShiftEditorStore.getState();

        return buildAutofillDTO({
            year,
            month,
            doc: state.doc,
            originalShift: shift,
            draftRevision: state.draftRevision,
            rulesHash: state.rulesHash ?? '',
        });
    };
    const localDraft = dto();
    const localDirty = detail
        ? signature({...localDraft, carryOverCells: localDraft.carryOverCells ?? []}) !== signature(detail.draft)
        : false;
    const sync = async () => {
        const work = syncTail.current
            .catch(() => undefined)
            .then(async () => {
                const current = detailRef.current;

                if (!current) throw new AiConversationInputError('loading');

                const draft = dto();

                if (signature({...draft, carryOverCells: draft.carryOverCells ?? []}) === signature(current.draft)) return current;

                const next = await api.sync(current.conversation.conversationId, {
                    expectedRevision: current.conversation.revision,
                    cells: draft.cells,
                    rowOrder: draft.rowOrder,
                    carryOverCells: draft.carryOverCells,
                });

                install(next);

                return next;
            });

        syncTail.current = work;

        return work;
    };
    const refresh = async () => {
        if (!detailRef.current) return;

        const conversationId = detailRef.current.conversation.conversationId;
        const next = await api.detail(conversationId);

        if (mounted.current && detailRef.current?.conversation.conversationId === conversationId) install(next);
    };
    const run = async (action: () => Promise<void>, isExecution = false) => {
        if (busyRef.current) return;

        busyRef.current = true;
        setBusy(true);
        setExecuting(isExecution);
        setError(null);

        try {
            await action();
        } catch (e) {
            if (mounted.current) setError(aiConversationFailure(e));
        } finally {
            busyRef.current = false;

            if (mounted.current) {
                setBusy(false);
                setExecuting(false);
            }
        }
    };
    const restore = (version: TResultVersion) => {
        if (!mounted.current) return;

        const current = useShiftEditorStore.getState().doc;
        const next = snapshotDetailToDoc(version, shift, year, month, {fixedCells: {}, requestCells: current.requestCells});

        // Previous-month cells are part of the immutable input, too.
        next.rows.forEach((row) => {
            const carry = version.carryOverCells
                .filter((cell) => String(cell.shiftNurseId) === row.workerId)
                .sort((a, b) => a.date.localeCompare(b.date));

            if (carry.length) row.lastCells = carry.map((cell) => cell.shiftCode ?? null);
        });
        commands.applyAdjustedDoc(next);
        commands.clearScheduleValidationFromApi();
        onApplied();
    };
    const applyCompleted = async (operation: TConversationOperation, uiRevision: number) => {
        await syncTail.current.catch(() => undefined);

        if (!mounted.current) return;

        if (
            operation.executionStatus === 'SUCCEEDED' &&
            !operationFailure(operation) &&
            operation.applyStatus === 'APPLIED' &&
            operation.resultVersionId &&
            useShiftEditorStore.getState().draftRevision === uiRevision
        ) {
            const version = await api.version(operation.resultVersionId);

            if (!mounted.current) return;

            if (useShiftEditorStore.getState().draftRevision === uiRevision) {
                const before = useShiftEditorStore.getState().doc;

                restore(version);
                void reportScheduleJourney(operation.result?.observation, {
                    type: 'CLIENT_APPLIED',
                    changedCellCount: describeAdjustChanges(before, useShiftEditorStore.getState().doc).length,
                    draftRevision: useShiftEditorStore.getState().draftRevision,
                });
            } else
                setNotice(
                    copy(
                        '작성 중인 표가 바뀌어서 결과를 반영하지 않았어요. 결과를 비교해 주세요.',
                        'Your draft changed. The result is saved for comparison.',
                    ),
                );
        } else if (operation.executionStatus === 'SUCCEEDED' && !operationFailure(operation)) {
            setNotice(
                copy(
                    '작성 중인 표가 바뀌어서 결과를 반영하지 않았어요. 결과를 비교해 주세요.',
                    'Your draft changed. The result is saved for comparison.',
                ),
            );
        }

        await refresh();
    };
    const sendExecution = async (id: number, request: TConversationExecute) => {
        try {
            const operation = await api.execute(id, request);
            const pending = readPendingExecution(sessionStorage, pendingKey);

            if (pending?.conversationId === id && pending.request.idempotencyKey === request.idempotencyKey) {
                if (isExecutionFinished(operation)) sessionStorage.removeItem(pendingKey);
                else sessionStorage.setItem(pendingKey, JSON.stringify({...pending, operationId: operation.operationId}));
            }

            return operation;
        } catch (e) {
            if ([400, 403, 422, 429].includes((e as {code?: number}).code ?? 0) || aiConversationFailure(e).blocked)
                sessionStorage.removeItem(pendingKey);

            throw e;
        }
    };
    const execute = async (
        operationType: 'GENERATE' | 'ADJUST',
        fillPolicy?: 'EMPTY_ONLY' | 'REBUILD_UNLOCKED',
        interpretationId?: string,
        selection?: {op: TConversationOperation; suggestion: TFailureSuggestion},
    ) => {
        await run(async () => {
            if (isScheduleFullyProtected(useShiftEditorStore.getState().doc)) throw new Error(t('aiAdjust.allFixed'));

            if (selection) await refresh();

            const current = await sync();

            if (
                selection &&
                (!isConversationSuggestionCurrent(current, selection.op) || !isFailureSuggestionAvailable(selection.suggestion))
            ) {
                setSelectedSuggestion(undefined);
                throw new AiConversationInputError('expiredSuggestion');
            }

            const uiRevision = useShiftEditorStore.getState().draftRevision;
            // Preserve the exact request on response loss; retry never creates a second action.
            const saved = readPendingExecution(sessionStorage, pendingKey);

            if (saved) throw new AiConversationInputError('pendingExecution');

            const request: TConversationExecute = {
                monthlyRestRequirement: await loadMonthlyRestRequirement(wardId, teamId, shift, year, month),
                expectedRevision: current.conversation.revision,
                idempotencyKey: crypto.randomUUID(),
                operationType,
                ...(fillPolicy ? {fillPolicy, rebuildConfirmed: fillPolicy === 'REBUILD_UNLOCKED'} : {}),
                ...(interpretationId ? {interpretationId} : {}),
                ...(() => {
                    const turn = current.turns.find((entry) => entry.interpretationId === interpretationId);

                    if (!turn?.semanticPlan) return {};

                    if (!isSemanticExecutionCurrent(current, turn, localDirty)) throw new Error(t('aiAdjust.stale'));

                    return {planHash: turn.semanticPlan.planHash, sourceVersionId: turn.semanticPlan.sourceVersionId};
                })(),
                ...(selection
                    ? {
                          failureSourceOperationId: selection.op.operationId,
                          failureSuggestionId: selection.suggestion.suggestionId,
                          failureSuggestionDigest: selection.suggestion.inputDigest,
                          suggestionConfirmed: true,
                      }
                    : {}),
            };

            sessionStorage.setItem(pendingKey, JSON.stringify({conversationId: current.conversation.conversationId, request, uiRevision}));

            const operation = await sendExecution(current.conversation.conversationId, request);

            if (isExecutionFinished(operation)) sessionStorage.removeItem(pendingKey);

            if (selection) setSelectedSuggestion(undefined);

            await applyCompleted(operation, uiRevision);
            window.dispatchEvent(new Event('dutying:commercial-usage-changed'));
        }, true);
    };
    const confirmAndAdjust = async (turn: TConversationTurn) => {
        if (awaitingAdjustmentRef.current || !turn.interpretationId || !turn.semanticPlan) return;

        awaitingAdjustmentRef.current = true;
        setAwaitingAdjustment(true);

        let confirmedId: string | undefined;

        try {
            await run(async () => {
                const current = detailRef.current;

                if (!current || !turn.semanticPlan || !turn.interpretationId) return;

                if (turn.semanticPlan.state !== 'CONFIRMED' && !turn.semanticPlan.confirmationAllowed) throw new Error(t('aiAdjust.stale'));

                const draft = dto();
                const dirty = signature({...draft, carryOverCells: draft.carryOverCells ?? []}) !== signature(current.draft);

                if (
                    !isConversationConfirmationCurrent(current, turn, dirty) ||
                    isScheduleFullyProtected(useShiftEditorStore.getState().doc)
                )
                    throw new Error(t('aiAdjust.stale'));

                const confirmed =
                    turn.semanticPlan.state === 'CONFIRMED'
                        ? turn
                        : await api.confirmPlan(
                              current.conversation.conversationId,
                              turn.interpretationId,
                              current.conversation.revision,
                              turn.semanticPlan.planHash,
                          );

                await refresh();

                const next = detailRef.current;
                const nextDraft = dto();

                if (
                    !next ||
                    !isSemanticExecutionCurrent(
                        next,
                        confirmed,
                        signature({...nextDraft, carryOverCells: nextDraft.carryOverCells ?? []}) !== signature(next.draft),
                    ) ||
                    confirmed.semanticPlan?.planHash !== turn.semanticPlan.planHash ||
                    next.conversation.conversationId !== current.conversation.conversationId
                )
                    throw new Error(t('aiAdjust.stale'));

                confirmedId = confirmed.interpretationId ?? undefined;
            });

            if (confirmedId) await execute('ADJUST', undefined, confirmedId);
        } finally {
            awaitingAdjustmentRef.current = false;

            if (mounted.current) setAwaitingAdjustment(false);
        }
    };
    const editRequest = (turn: TConversationTurn) => {
        const current = detailRef.current;

        if (!current) return;

        const original = requestTextForTurn(current, turn);

        setEditingRequest(turn);
        setEntryChoice('modify');
        setPreviousId(turn.interpretationId ?? undefined);
        setChange('REPLACE');
        setText(original);
        setRequestToolsOpen(false);
        textarea.current?.focus();
    };
    const prepareAndAdjust = async (turn: TConversationTurn) => {
        if (awaitingAdjustmentRef.current || !turn.interpretationId || !turn.interpretation || !detailRef.current) return;

        const conversationId = detailRef.current.conversation.conversationId;
        const confirmed = turn.interpretation;
        const preparationKey = () => {
            const draft = dto();

            return JSON.stringify([
                conversationId,
                signature({...draft, carryOverCells: draft.carryOverCells ?? []}),
                detailRef.current?.contextHash,
            ]);
        };

        awaitingAdjustmentRef.current = true;
        setAwaitingAdjustment(true);

        try {
            if (onPrepareAdjustment && reviewedPreparation.current !== preparationKey()) await onPrepareAdjustment();

            if (!mounted.current || detailRef.current?.conversation.conversationId !== conversationId) return;

            let interpretationId: string | undefined;

            await run(async () => {
                const current = await sync();

                if (current.conversation.latestInterpretationId !== turn.interpretationId || current.contextHash !== turn.contextHash)
                    throw new Error(t('aiAdjust.stale'));

                if (isConversationConfirmationCurrent(current, turn, false)) {
                    interpretationId = turn.interpretationId!;

                    return;
                }

                // The existing API binds interpretations to a draft revision. Refresh that binding
                // after previous-month/fixed-cell edits, retaining the user's confirmed items.
                const requestText =
                    [...current.turns].reverse().find((event) => event.actor === 'USER' && event.text)?.text ??
                    confirmed.llmPrompt ??
                    confirmed.items.map((item) => item.displayLabel).join(', ');
                const refreshed = await api.interpret(conversationId, {
                    expectedRevision: current.conversation.revision,
                    text: requestText,
                    language: i18n.language,
                    previousInterpretationId: turn.interpretationId!,
                    change: 'ADD',
                });

                if (!refreshed.interpretationId || !refreshed.interpretation) throw new Error(t('aiAdjust.stale'));

                const rebound = await api.confirm(
                    conversationId,
                    refreshed.interpretationId,
                    current.conversation.revision,
                    confirmed.items,
                );

                await refresh();

                if (
                    (refreshed.interpretation.llmPrompt ?? '') !== (confirmed.llmPrompt ?? '') ||
                    (refreshed.interpretation.strength ?? 'NORMAL') !== (confirmed.strength ?? 'NORMAL')
                ) {
                    reviewedPreparation.current = preparationKey();
                    setNotice(
                        copy(
                            '입력한 근무를 반영했어요. 수정 조건을 한 번 더 확인해 주세요.',
                            'Your shift changes are ready. Please review the updated conditions.',
                        ),
                    );

                    return;
                }

                interpretationId = rebound.interpretationId ?? undefined;
            });

            if (interpretationId && mounted.current) {
                reviewedPreparation.current = null;
                await execute('ADJUST', undefined, interpretationId);
            }
        } catch (cause) {
            if (mounted.current) setError(aiConversationFailure(cause));
        } finally {
            awaitingAdjustmentRef.current = false;

            if (mounted.current) setAwaitingAdjustment(false);
        }
    };
    const retryPending = async () =>
        run(async () => {
            trackScheduleSignal('outcome_recheck');

            const saved = readPendingExecution(sessionStorage, pendingKey);

            if (!saved) {
                if (!detailRef.current) {
                    const list = await api.list(year, month);

                    setEarlierConversations(list.slice(1).reverse());

                    const conversation = list[0] ?? (await api.create(year, month));

                    install(await api.detail(conversation.conversationId));
                    setPreferences(await api.preferences());

                    return;
                }

                await refresh();

                return;
            }

            const operation = await sendExecution(saved.conversationId, saved.request);

            // After reload, show the recovered result without automatically replacing local edits.
            if (isExecutionFinished(operation)) sessionStorage.removeItem(pendingKey);

            await refresh();

            const recovered = detailRef.current?.operations.find((op) => op.operationId === operation.operationId) ?? operation;

            setNotice(
                t(
                    isExecutionFinished(recovered)
                        ? 'aiAdjust.recovery.complete'
                        : recovered.executionStatus === 'UNKNOWN'
                          ? 'aiAdjust.recovery.unknown'
                          : 'aiAdjust.recovery.running',
                ),
            );
        });
    const interpret = async (request = text, reference = previousId) => {
        const message = request.trim();

        if (!message) return;

        await run(async () => {
            if (useShiftEditorStore.getState().semanticExecutionEnabled && onPrepareAdjustment) await onPrepareAdjustment();

            const current = await sync();

            if (reference && current.conversation.latestInterpretationId !== reference) {
                throw new AiConversationInputError('staleRequest');
            }

            const previous =
                reference ??
                current.turns.find(
                    (turn) =>
                        turn.interpretationId === current.conversation.latestInterpretationId &&
                        (Boolean(turn.semanticPlan) || isConversationConfirmationCurrent(current, turn, false)),
                )?.interpretationId;
            const priorPlan = current.turns.find((turn) => turn.interpretationId === previous && turn.semanticPlan);
            const original = priorPlan && !editingRequest ? requestTextForTurn(current, priorPlan) : '';
            const marker = priorPlan?.semanticPlan?.state === 'NEEDS_CLARIFICATION' ? '추가 답변' : '추가 요청';
            const interpretedText = original && message !== original ? `${original}\n${marker}: ${message}` : message;

            if (interpretedText.length > 500) throw new AiConversationInputError('requestTooLong');

            const interpreted = await api.interpret(current.conversation.conversationId, {
                expectedRevision: current.conversation.revision,
                text: interpretedText,
                language: i18n.language,
                ...(previous && current.conversation.latestInterpretationId === previous
                    ? {
                          previousInterpretationId: previous,
                          change: current.turns.some((turn) => turn.interpretationId === previous && turn.semanticPlan)
                              ? 'REPLACE'
                              : change,
                      }
                    : {}),
            });

            setText('');
            setEditingPreferenceId(undefined);
            setRequestToolsOpen(false);
            setEditingRequest(null);
            setPreviousId(interpreted.interpretationId ?? undefined);
            setChange('ADD');
            setEntryChoice('modify');
            await refresh();
        });
    };
    const view = async (op: TConversationOperation, compare = false) =>
        run(async () => {
            if (!op.resultVersionId) return;

            const [version, before] = await Promise.all([
                api.version(op.resultVersionId),
                compare && op.sourceVersionId !== op.resultVersionId ? api.version(op.sourceVersionId) : undefined,
            ]);

            setPreview({version, ...(before ? {before} : {})});
        });
    const resetSectionUi = () => {
        onNewConversation?.();
        setEntryChoice(null);
        setPreviousId(undefined);
        setChange('ADD');
        setText('');
        setEditingRequest(null);
        setRebuild(false);
        setPreview(null);
        setNotice(null);
        setPendingBranch(null);
        reportAttempt.reset();
        setReportOperation(null);
        setReportNote('');
        setSelectedSuggestion(undefined);
        setEditingPreferenceId(undefined);
        setRequestToolsOpen(false);
    };
    const branch = async (version: TResultVersion) =>
        run(async () => {
            if (sessionStorage.getItem(pendingKey)) throw new AiConversationInputError('pendingExecution');

            const current = await sync(); // Preserve every unsaved manual edit before branching.
            const uiRevision = useShiftEditorStore.getState().draftRevision;
            const nextDetail = await api.startSegment(
                current.conversation.conversationId,
                version.versionId,
                current.conversation.revision,
            );

            if (useShiftEditorStore.getState().draftRevision !== uiRevision) {
                install(nextDetail); // Keep the advanced server revision without overwriting manual edits.
                setPendingBranch(nextDetail);
                setPreview(null);
                setNotice(
                    copy(
                        '작성 중인 표가 바뀌어서 전환하지 않았어요. 선택한 표로 이어서 작성하려면 아래 버튼을 눌러 주세요.',
                        'The draft changed. The new branch is saved without replacing your edits.',
                    ),
                );

                return;
            }

            install(nextDetail);
            resetSectionUi();
            restore(nextDetail.draft);
        });
    const newConversation = () =>
        run(async () => {
            if (sessionStorage.getItem(pendingKey)) throw new AiConversationInputError('pendingExecution');

            const current = await sync();
            const next = await api.startSegment(
                current.conversation.conversationId,
                current.draft.versionId,
                current.conversation.revision,
            );

            install(next);
            resetSectionUi();
        });

    useEffect(() => {
        mounted.current = true;

        return () => {
            mounted.current = false;
        };
    }, []);
    useLayoutEffect(() => {
        if (!open) return;

        const root = document.documentElement;

        root.dataset.makeAiAdjustOpen = 'true';
        root.dataset.makeAiPreparing = String(preparing);
        root.style.setProperty('--make-ai-adjust-sidebar-width', '407px');

        return () => {
            delete root.dataset.makeAiAdjustOpen;
            delete root.dataset.makeAiPreparing;
            root.style.removeProperty('--make-ai-adjust-sidebar-width');
        };
    }, [open, preparing]);
    useEffect(() => {
        if (!open || initialized.current) return;

        initialized.current = true;
        void run(async () => {
            const list = await api.list(year, month);

            if (!mounted.current) return;

            setEarlierConversations(list.slice(1).reverse());

            const conversation = list[0] ?? (await api.create(year, month));

            if (!mounted.current) return;

            install(await api.detail(conversation.conversationId));

            const savedPreferences = await api.preferences();

            if (mounted.current) setPreferences(savedPreferences);
        });
    }, [open]);
    useEffect(() => {
        // Result application advances the server revision before changing the editor.
        // Wait for the action's refresh before saving the resulting local revision.
        if (!detailRef.current || busy) return;

        const timer = window.setTimeout(() => {
            if (busyRef.current) return;

            void sync().catch((e) => {
                if (mounted.current) setError(aiConversationFailure(e));
            });
        }, 400);

        return () => window.clearTimeout(timer);
    }, [revision, busy]);

    const running =
        detail?.operations.some(
            (op) => op.executionStatus === 'RUNNING' || op.executionStatus === 'RESULT_READY' || op.executionStatus === 'UNKNOWN',
        ) ?? false;
    const polling = useConversationPolling(Boolean(detail) && (running || busy), detail?.conversation.conversationId, refresh);

    useEffect(() => {
        if (!autofillFlow || !detail) return;

        setLocalEvents((current) => {
            const id = `preparation:${autofillFlow.id}`;
            const existing = current.find((event) => event.id === id);

            if (existing?.messages === autofillFlow.messages) return current;

            if (existing) return current.map((event) => (event.id === id ? {...event, messages: autofillFlow.messages} : event));

            const sequence =
                Math.max(0, ...conversationEvents(detail).map((event) => event.sequence), ...current.map((event) => event.sequence)) +
                0.001;

            return [...current, {kind: 'local', id, sequence, messages: autofillFlow.messages}];
        });
    }, [autofillFlow, detail]);

    useEffect(() => {
        if (!detail || busy || !open || preparing || generationRequest <= lastGeneration.current) return;

        lastGeneration.current = generationRequest;
        void execute('GENERATE', generationFillPolicy);
    }, [generationRequest, detail, busy, open, preparing, generationFillPolicy]);

    useEffect(() => {
        if (rebuildRequest <= lastRebuild.current) return;

        lastRebuild.current = rebuildRequest;
        setRebuild(true);
    }, [rebuildRequest]);

    useEffect(() => {
        onBusyChange?.(executing || running);

        return () => onBusyChange?.(false);
    }, [executing, running, onBusyChange]);

    useEffect(() => {
        if (autofillFlow?.kind === 'adjustment' || (!preparing && !autofillFlow)) return;

        setEntryChoice(null);
        setRebuild(false);
        setPreviousId(undefined);
        setText('');
        setNotice(null);
        setPreview(null);
    }, [preparing, autofillFlow?.id]);

    const visibleTurns = detail ? visibleConversationTurns(detail) : [];
    const activeTurns = detail ? currentConversationTurns(detail) : [];
    const canChooseNextAction = Boolean(
        detail &&
            (activeTurns.length === 0 ||
                localEvents.some(
                    (event) =>
                        event.id.startsWith('preparation:') && event.sequence > Math.max(0, ...activeTurns.map((turn) => turn.sequence)),
                )),
    );
    const latestOperation = detail?.operations[detail.operations.length - 1];
    const failureNeedsAction = Boolean(
        latestOperation &&
            operationFailure(latestOperation) &&
            dismissedFailureId !== latestOperation.operationId &&
            !detail?.turns.some((turn) => turn.sequence > latestOperation.sequence),
    );
    const active = detail?.turns.find((turn) => turn.interpretationId === detail.conversation.latestInterpretationId);
    const reviewingPlan = Boolean(active?.semanticPlan && detail && isConversationConfirmationCurrent(detail, active, localDirty));
    const composerHidden =
        preparing ||
        !detail ||
        failureNeedsAction ||
        entryChoice === 'regenerate' ||
        (!entryChoice && canChooseNextAction) ||
        (reviewingPlan && !editingRequest && active?.semanticPlan?.state !== 'NEEDS_CLARIFICATION');
    const exampleNurses = doc.rows
        .map((row) => doc.workerMeta[row.workerId])
        .filter((nurse) => nurse?.nurseId !== undefined && nurse.name.trim());
    const exampleShiftTypes = shift.wardShiftTypes ?? [];
    const exampleWork =
        exampleShiftTypes.find((type) => !type.isOff && type.classification === 'NIGHT') ?? exampleShiftTypes.find((type) => !type.isOff);
    const exampleOff = exampleShiftTypes.find((type) => type.isOff);
    const exampleDayWork = exampleShiftTypes.find((type) => !type.isOff && type !== exampleWork) ?? exampleWork;
    const exampleFirst = exampleNurses[0]?.name;
    const exampleSecond = exampleNurses[1]?.name ?? exampleFirst;
    const dayOf = (index: number) => Number(doc.columns[Math.min(index, doc.columns.length - 1)]?.slice(-2));
    const examplePeriod = dayOf(0) === dayOf(4) ? `${dayOf(0)}일` : `${dayOf(0)}~${dayOf(4)}일`;
    const requestExamples =
        exampleFirst && doc.columns.length
            ? [
                  ...(exampleWork
                      ? [
                            copy(
                                `${exampleFirst} ${examplePeriod} ${exampleWork.shortName} 근무 없게 해줘`,
                                `No ${exampleWork.shortName} shifts for ${exampleFirst} on days ${examplePeriod.replace('일', '')}`,
                            ),
                        ]
                      : []),
                  ...(exampleOff
                      ? [
                            copy(
                                `${exampleSecond} ${dayOf(11)}일 ${exampleOff.shortName} 근무 배정해줘`,
                                `Assign ${exampleOff.shortName} to ${exampleSecond} on day ${dayOf(11)}`,
                            ),
                        ]
                      : []),
                  ...(exampleDayWork
                      ? [
                            copy(
                                `${exampleFirst} ${dayOf(14)}일 ${exampleDayWork.shortName} 근무 배정해줘`,
                                `Assign ${exampleDayWork.shortName} to ${exampleFirst} on day ${dayOf(14)}`,
                            ),
                        ]
                      : []),
              ]
            : [];

    useEffect(() => {
        if (entryChoice === 'modify' && !composerHidden) textarea.current?.focus();
    }, [entryChoice, composerHidden]);

    const activeCard = active?.interpretation;
    const incomplete =
        Boolean(activeCard?.unmapped?.length) ||
        Boolean(activeCard?.items?.some((item) => Boolean(item.requiresConfirmation) || item.kind === 'CELL' || item.kind === 'CELL_SET'));
    const canConfirm = Boolean(
        !preparing &&
            active &&
            activeCard &&
            detail &&
            active.type === 'INTERPRETATION_CONFIRMED' &&
            isConversationConfirmationCurrent(detail, active, localDirty) &&
            !incomplete,
    );
    const stamp = (date: string) => new Date(date).toLocaleString(i18n.language, {dateStyle: 'short', timeStyle: 'short'});
    const renderTurn = (turn: TConversationTurn) => {
        if (turn.type === 'SEGMENT_START')
            return (
                <div role="separator" className="my-5 flex items-center gap-3 text-xs text-[#667085]">
                    <span className="h-px flex-1 bg-gray-6" />
                    <span>
                        {turn.text === 'SAVED_RESULT'
                            ? copy('여기서부터 새 요청 · 선택한 표 기준', 'New requests · selected result')
                            : copy('여기서부터 새 요청 · 현재 표 기준', 'New requests · current schedule')}
                    </span>
                    <span className="h-px flex-1 bg-gray-6" />
                </div>
            );

        const previousRun = detail && precedingCompletedOperation(detail, turn);
        const Message = turn.actor === 'USER' ? UserMessage : AssistantMessage;
        const completed = detail?.operations.some(
            (op) => op.interpretationId === turn.interpretationId && op.executionStatus === 'SUCCEEDED',
        );
        const applied =
            detail?.operations.some(
                (op) => op.interpretationId === turn.interpretationId && op.executionStatus === 'SUCCEEDED' && op.applyStatus === 'APPLIED',
            ) && !localDirty;

        return (
            <div key={turn.eventId}>
                {previousRun && detail && (
                    <div role="separator" className="my-5 flex items-center gap-3 text-xs text-[#667085]">
                        <span className="h-px flex-1 bg-gray-6" />
                        <span>
                            {previousRun.operationType === 'GENERATE' ? copy('자동채우기', 'Autofill') : copy('수정', 'Adjustment')}{' '}
                            {operationAttempt(detail, previousRun.operationId)}
                            {copy('회차 이후 · 추가 요청', ' · follow-up request')}
                        </span>
                        <span className="h-px flex-1 bg-gray-6" />
                    </div>
                )}
                <Message>
                    {turn.text && detail && <p className="whitespace-pre-wrap">{conversationTurnText(detail, turn)}</p>}
                    {turn.semanticPlan && (
                        <AiSemanticReview
                            plan={turn.semanticPlan}
                            current={turn.interpretationId === detail?.conversation.latestInterpretationId && !completed}
                            disabled={
                                busy || running || awaitingAdjustment || Boolean(editingRequest) || !adjustEnabled || isAutofillBlocked
                            }
                            applied={Boolean(applied)}
                            processing={
                                turn.interpretationId === detail?.conversation.latestInterpretationId
                                    ? awaitingAdjustment
                                        ? 'adjust'
                                        : busy
                                          ? 'review'
                                          : null
                                    : null
                            }
                            stale={!detail || !isConversationConfirmationCurrent(detail, turn, localDirty)}
                            rosterNurseIds={Object.values(doc.workerMeta).flatMap((meta) =>
                                typeof meta.nurseId === 'number' ? [meta.nurseId] : [],
                            )}
                            nurseName={(id) =>
                                Object.values(doc.workerMeta).find((meta) => meta.nurseId === id)?.name ??
                                copy('명단에서 확인되지 않은 간호사', 'Nurse unavailable in this roster')
                            }
                            copy={copy}
                            onApply={() => void confirmAndAdjust(turn)}
                            onEdit={() => editRequest(turn)}
                            onRetry={() => {
                                const current = detailRef.current;
                                const original = current ? requestTextForTurn(current, turn) : '';

                                if (original) void interpret(original, turn.interpretationId ?? undefined);
                                else editRequest(turn);
                            }}
                        />
                    )}
                    {turn.interpretation && (
                        <>
                            <AiAdjustInterpretCard
                                card={{
                                    requestText: turn.text ?? '',
                                    items: turn.interpretation.items.map((item) => ({
                                        item,
                                        lifetime: item.lifetime ?? 'MONTH',
                                        severity: item.severity ?? 'SOFT',
                                    })),
                                    llmPrompt: turn.interpretation.llmPrompt ?? undefined,
                                    strength: turn.interpretation.strength ?? 'NORMAL',
                                    unmapped: turn.interpretation.unmapped ?? [],
                                }}
                                nurses={Object.values(doc.workerMeta)
                                    .filter((meta) => meta.nurseId !== undefined)
                                    .map((meta) => ({nurseId: meta.nurseId!, name: meta.name}))}
                                showDetails={false}
                            />
                            {turn.interpretation.items?.some((item) => item.requiresConfirmation) && (
                                <p className="text-red">
                                    {copy(
                                        '대상 또는 수치를 명확히 적어 다시 확인해 주세요.',
                                        'Specify the missing group or value and request a new interpretation.',
                                    )}
                                </p>
                            )}
                            {turn.interpretationId === detail?.conversation.latestInterpretationId && (
                                <ConversationConfirmation
                                    key={turn.interpretationId ?? turn.eventId}
                                    items={turn.interpretation.items ?? []}
                                    nurses={Object.values(doc.workerMeta)
                                        .filter((meta) => meta.nurseId !== undefined)
                                        .map((meta) => ({nurseId: meta.nurseId!, name: meta.name}))}
                                    disabled={
                                        busy ||
                                        running ||
                                        awaitingAdjustment ||
                                        localDirty ||
                                        !adjustEnabled ||
                                        Boolean(turn.interpretation.unmapped?.length)
                                    }
                                    copy={copy}
                                    onConfirm={async (items) =>
                                        run(async () => {
                                            const current = detailRef.current;

                                            if (!current || !turn.interpretationId) return;

                                            await api.confirm(
                                                current.conversation.conversationId,
                                                turn.interpretationId,
                                                current.conversation.revision,
                                                items,
                                            );
                                            await refresh();
                                        })
                                    }
                                />
                            )}
                            {turn.interpretationId === detail?.conversation.latestInterpretationId ? (
                                <p className="mt-3">{t('aiAdjust.chat.applyQuestion')}</p>
                            ) : (
                                <p className="mt-2 text-xs text-[#475467]">
                                    {copy(
                                        '이전 요청이에요. 새 요청에서 내용을 확인해 주세요.',
                                        'Previous interpretation · unavailable for execution',
                                    )}
                                </p>
                            )}
                            {localDirty && turn.interpretationId === detail?.conversation.latestInterpretationId && (
                                <p role="status">
                                    {copy(
                                        '표가 바뀌었어요. 최신 표 기준으로 다시 확인해 주세요.',
                                        'The draft changed. Confirm a new interpretation.',
                                    )}
                                </p>
                            )}
                        </>
                    )}
                </Message>
                {turn.interpretation && turn.interpretationId === detail?.conversation.latestInterpretationId && (
                    <div className="mt-3">
                        <AiAdjustApplyChoices
                            disabled={busy || running || awaitingAdjustment || preparing}
                            applyDisabled={!canConfirm || !adjustEnabled || isAutofillBlocked}
                            onApply={() => void prepareAndAdjust(turn)}
                            onRevise={() => {
                                setEntryChoice('modify');
                                setPreviousId(turn.interpretationId ?? undefined);
                                setChange('ADD');
                                setText('');
                                textarea.current?.focus();
                            }}
                        />
                    </div>
                )}
            </div>
        );
    };

    return createPortal(
        <>
            {open && preparing && spotlightSelector && (
                <ConfirmationSpotlight spotlightSelector={spotlightSelector} interactive={spotlightInteractive} zIndex={1399} />
            )}
            <aside
                data-state={open ? 'open' : 'closed'}
                data-preparing={preparing}
                aria-label={t('aiAdjust.title')}
                aria-hidden={!open}
                inert={!open}
                onKeyDown={(event) => {
                    event.stopPropagation();

                    if (event.key === 'Escape') onClose();
                }}
                onPaste={(event) => event.stopPropagation()}
                className={`ai-adjust-sidebar fixed top-0 right-0 z-[1400] flex h-dvh w-[407px] max-w-full flex-col bg-white p-5 ${open ? '' : 'hidden'}`}
            >
                <header className="mb-3 flex items-center gap-2">
                    <h2 className="mr-auto text-xl font-semibold">{t('aiAdjust.title')}</h2>
                    <button
                        className={buttonClass}
                        disabled={busy || running || awaitingAdjustment || !detail || preparing}
                        onClick={() => void newConversation()}
                    >
                        {copy('새 요청 시작하기', 'New request')}
                    </button>
                    <button className={buttonClass} onClick={onClose}>
                        {copy('닫기', 'Close')}
                    </button>
                </header>
                <div className="flex min-h-0 flex-1 flex-col">
                    <div className="mb-3 flex items-center justify-between text-sm text-[#475467]">
                        <span>
                            {year}
                            {copy('년 ', ' / ')}
                            {month}
                            {copy('월', '')}
                        </span>
                        <AiInfoTip label={copy('적용 조건 보기', 'View conditions')}>
                            <p>{copy('설정한 조건과 고정한 근무를 유지해요.', 'Your conditions and fixed shifts are preserved.')}</p>
                            <ul className="mt-2 list-disc space-y-1 pl-4">
                                {detail?.activeConditionLabels.map((label, index) => <li key={index}>{label}</li>)}
                            </ul>
                        </AiInfoTip>
                    </div>
                    {polling.issue && (
                        <AiFailureMessage message={t(`aiAdjust.polling.${polling.issue}`)}>
                            <button className={buttonClass} onClick={polling.retry}>
                                {copy('결과 다시 확인하기', 'Check outcome again')}
                            </button>
                        </AiFailureMessage>
                    )}
                    {notice && (
                        <p role="status" className="mb-2 text-sm">
                            {notice}
                        </p>
                    )}
                    <AiChatScroll
                        open={open}
                        composerHidden={composerHidden}
                        className="min-h-0 flex-1 overflow-y-auto overscroll-contain py-2"
                        contentClassName="space-y-3"
                    >
                        {!detail && <p role="status">{copy('작성 대화를 불러오고 있어요.', 'Loading your conversation.')}</p>}
                        {earlierConversations.map((conversation) => (
                            <AiConversationHistory
                                key={conversation.conversationId}
                                conversation={conversation}
                                load={api.detail}
                                onView={(op, compare) => void view(op, compare)}
                                copy={copy}
                            />
                        ))}
                        {detail &&
                            [...conversationEvents({...detail, turns: visibleTurns}), ...localEvents]
                                .sort((a, b) => a.sequence - b.sequence)
                                .map((event) =>
                                    event.kind === 'local' ? (
                                        <AiAutofillMessages key={event.id} messages={event.messages} />
                                    ) : event.kind === 'turn' ? (
                                        <div key={event.id} inert={preparing}>
                                            {renderTurn(event.turn)}
                                        </div>
                                    ) : (
                                        <div key={event.id} className="space-y-3">
                                            <JourneyObserved
                                                observation={event.operation.result?.observation}
                                                inert={preparing}
                                                className="rounded-xl border border-gray-6 bg-white p-3"
                                            >
                                                <p className="font-semibold">
                                                    {copy(
                                                        event.operation.operationType === 'GENERATE' ? '자동채우기' : '수정',
                                                        event.operation.operationType === 'GENERATE' ? 'Autofill' : 'Adjustment',
                                                    )}{' '}
                                                    {operationAttempt(detail, event.operation.operationId)}
                                                    {copy('회차', ' attempt')} · {operationStatusLabel(event.operation)}
                                                </p>
                                                <p className="text-xs text-[#475467]">
                                                    {stamp(event.operation.createdAt)} · {copy('대상', 'Target')}: {year}-
                                                    {String(month).padStart(2, '0')}
                                                </p>
                                                {event.operation.executionStatus === 'UNKNOWN' && (
                                                    <p>
                                                        {copy(
                                                            '이전 요청의 결과를 아직 확인하지 못했어요. 새로 계산하지 않고 결과를 다시 확인할게요.',
                                                            'The server needs to confirm the outcome. This request will not run again.',
                                                        )}
                                                        <button className={buttonClass} onClick={() => void retryPending()}>
                                                            {copy('결과 다시 확인하기', 'Check outcome')}
                                                        </button>
                                                    </p>
                                                )}
                                                {event.operation.applyStatus === 'NOT_APPLIED_SOURCE_CHANGED' && (
                                                    <p>
                                                        {copy(
                                                            '현재 표가 바뀌어 반영하지 않았어요.',
                                                            'The source changed; result was not applied.',
                                                        )}
                                                    </p>
                                                )}
                                                {event.operation.resultVersionId && (
                                                    <AiConversationImage
                                                        key={event.operation.resultVersionId}
                                                        cacheKey={`${wardId}:${teamId}`}
                                                        versionId={event.operation.resultVersionId}
                                                        loadVersion={api.version}
                                                    />
                                                )}
                                                {event.operation.executionStatus === 'SUCCEEDED' &&
                                                    !operationFailure(event.operation) &&
                                                    event.operation.result && (
                                                        <p className="mt-2 text-sm break-keep">
                                                            {copy(
                                                                `계산 결과: ${event.operation.result.changedCells.length}칸 변경.`,
                                                                `Calculated result: ${event.operation.result.changedCells.length} changed cells.`,
                                                            )}{' '}
                                                            {event.operation.applyStatus === 'APPLIED'
                                                                ? copy(
                                                                      '실행 시점의 작성본 기준 결과예요. 현재 표를 확인한 뒤 별도로 확정해 주세요.',
                                                                      'This result is based on the draft at execution time. Review the current schedule and confirm it separately.',
                                                                  )
                                                                : copy(
                                                                      '현재 표에 반영되지 않은 결과예요.',
                                                                      'This result has not been applied to the current draft.',
                                                                  )}
                                                        </p>
                                                    )}
                                                {event.operation.result && <AiConversationResultDetails result={event.operation.result} />}
                                                {event.operation.result && (
                                                    <ConversationEvidence
                                                        result={event.operation.result}
                                                        nurseName={(id) => doc.workerMeta[id]?.name ?? id}
                                                        disabled={busy || running}
                                                        suggestionsCurrent={
                                                            !localDirty && isConversationSuggestionCurrent(detail, event.operation)
                                                        }
                                                        onSelect={(suggestion) => setSelectedSuggestion({op: event.operation, suggestion})}
                                                    />
                                                )}
                                                {event.operation.resultVersionId && (
                                                    <div className="mt-2 flex flex-wrap gap-2">
                                                        <button
                                                            className={buttonClass}
                                                            disabled={busy}
                                                            onClick={() => void view(event.operation)}
                                                        >
                                                            {copy('근무표 열기', 'Open schedule')}
                                                        </button>
                                                        {event.operation.sourceVersionId !== event.operation.resultVersionId && (
                                                            <button
                                                                className={buttonClass}
                                                                disabled={busy}
                                                                onClick={() => {
                                                                    trackScheduleSignal('comparison_open');
                                                                    void view(event.operation, true);
                                                                }}
                                                            >
                                                                {copy('변경 전후 비교', 'Compare before and after')}
                                                            </button>
                                                        )}
                                                    </div>
                                                )}
                                                {['FAILED', 'SUCCEEDED'].includes(event.operation.executionStatus) && (
                                                    <button
                                                        className={`${buttonClass} mt-2`}
                                                        disabled={busy || running || preparing || reportOperation !== null}
                                                        onClick={(click) => {
                                                            reportAttempt.reset();
                                                            setReportRecovery(undefined);
                                                            reportTrigger.current = click.currentTarget;
                                                            setReportNote('');
                                                            setReportOperation(event.operation.operationId);
                                                            trackScheduleSignal('feedback_open');
                                                        }}
                                                    >
                                                        {copy('이 결과에 의견 보내기', 'Send feedback on this result')}
                                                    </button>
                                                )}
                                            </JourneyObserved>
                                            {operationFailure(event.operation) && (
                                                <AiExecutionFailure
                                                    operationType={event.operation.operationType}
                                                    failure={operationFailure(event.operation)!}
                                                    active={
                                                        failureNeedsAction &&
                                                        event.operation === latestOperation &&
                                                        !rebuild &&
                                                        !preparing &&
                                                        !awaitingAdjustment &&
                                                        !busy &&
                                                        !running
                                                    }
                                                    onRetry={
                                                        event.operation.operationType === 'GENERATE' ||
                                                        detail.turns.some(
                                                            (turn) => turn.interpretationId === event.operation.interpretationId,
                                                        )
                                                            ? () => {
                                                                  if (event.operation.operationType === 'GENERATE') {
                                                                      if (onPrepareGeneration) onPrepareGeneration();
                                                                      else setRebuild(true);
                                                                  } else {
                                                                      const turn = detail.turns.find(
                                                                          (turn) =>
                                                                              turn.interpretationId === event.operation.interpretationId,
                                                                      );

                                                                      if (turn?.semanticPlan) void confirmAndAdjust(turn);
                                                                      else if (turn) void prepareAndAdjust(turn);
                                                                  }
                                                              }
                                                            : undefined
                                                    }
                                                    onRevise={
                                                        adjustEnabled
                                                            ? () => {
                                                                  setDismissedFailureId(event.operation.operationId);
                                                                  setEntryChoice('modify');
                                                                  setPreviousId(event.operation.interpretationId ?? undefined);
                                                                  setChange('REPLACE');
                                                                  setText('');

                                                                  const turn = detail.turns.find(
                                                                      (entry) =>
                                                                          entry.interpretationId === event.operation.interpretationId,
                                                                  );

                                                                  if (turn?.semanticPlan) editRequest(turn);
                                                              }
                                                            : undefined
                                                    }
                                                    onReview={onClose}
                                                />
                                            )}
                                            {event.operation.operationType === 'ADJUST' &&
                                                event.operation.executionStatus === 'SUCCEEDED' &&
                                                !operationFailure(event.operation) &&
                                                event.operation.applyStatus === 'APPLIED' &&
                                                event.operation.result?.changedCells.length === 0 && (
                                                    <AssistantMessage>{t('aiAdjust.noChange')}</AssistantMessage>
                                                )}
                                            {event.operation.operationType === 'GENERATE' &&
                                                event.operation.executionStatus === 'SUCCEEDED' &&
                                                !operationFailure(event.operation) &&
                                                event.operation.applyStatus === 'APPLIED' && (
                                                    <AssistantMessage>
                                                        <span className="whitespace-pre-line">
                                                            {t(
                                                                event.operation.result && isGenerateReviewDraft(event.operation.result)
                                                                    ? 'aiAdjust.reviewDraft.completed'
                                                                    : 'aiAdjust.generationCompleted',
                                                            )}
                                                        </span>
                                                    </AssistantMessage>
                                                )}
                                        </div>
                                    ),
                                )}
                        {rebuild && (
                            <AssistantMessage>
                                <p>{t('aiAdjust.regenerateTitle')}</p>
                                <p className="mt-2 text-sm text-[#475467]">{t('aiAdjust.regenerateDescription')}</p>
                                <div className="mt-3 flex gap-2">
                                    <button
                                        className={buttonClass}
                                        disabled={busy || running || !detail}
                                        onClick={() => {
                                            setRebuild(false);
                                            void execute('GENERATE', 'REBUILD_UNLOCKED');
                                        }}
                                    >
                                        {t('aiAdjust.regenerating')}
                                    </button>
                                    <button
                                        className={buttonClass}
                                        disabled={busy || running}
                                        onClick={() => {
                                            setRebuild(false);
                                            setEntryChoice(null);
                                        }}
                                    >
                                        {copy('취소', 'Cancel')}
                                    </button>
                                </div>
                            </AssistantMessage>
                        )}
                        {preparation && <div aria-live="polite">{preparation}</div>}
                        {detail &&
                            canChooseNextAction &&
                            !failureNeedsAction &&
                            autofillFlow?.status !== 'paused' &&
                            !preparing &&
                            !entryChoice &&
                            !awaitingAdjustment &&
                            !running &&
                            !busy &&
                            !error && (
                                <AiConversationEntry
                                    choice={null}
                                    hideIntro={
                                        detail.operations[detail.operations.length - 1]?.operationType === 'GENERATE' &&
                                        detail.operations[detail.operations.length - 1]?.executionStatus === 'SUCCEEDED' &&
                                        detail.operations[detail.operations.length - 1]?.applyStatus === 'APPLIED'
                                    }
                                    disabled={busy || running || isAutofillBlocked}
                                    modifyDisabled={!adjustEnabled}
                                    confirmation={
                                        resultActions && {...resultActions, disabled: Boolean(resultActions.disabled) || busy || running}
                                    }
                                    onChoose={(choice) => {
                                        setEntryChoice(choice);
                                        setLocalEvents((current) => [
                                            ...current,
                                            {
                                                kind: 'local',
                                                id: `choice:${++localSequence.current}`,
                                                sequence:
                                                    Math.max(
                                                        0,
                                                        ...conversationEvents(detail).map((event) => event.sequence),
                                                        ...current.map((event) => event.sequence),
                                                    ) + 0.001,
                                                messages: [
                                                    {role: 'user', text: t(`aiAdjust.chat.${choice}`)},
                                                    ...(choice === 'modify'
                                                        ? [{role: 'assistant' as const, text: t('aiAdjust.chat.askChanges')}]
                                                        : []),
                                                ],
                                            },
                                        ]);

                                        if (choice === 'regenerate') {
                                            trackScheduleSignal('regeneration_selected');

                                            if (onPrepareGeneration) onPrepareGeneration();
                                            else setRebuild(true);
                                        } else textarea.current?.focus();
                                    }}
                                />
                            )}
                        {!composerHidden &&
                            entryChoice === 'modify' &&
                            !editingRequest &&
                            !activeTurns.length &&
                            !text.trim() &&
                            !!requestExamples.length && (
                                <section
                                    aria-label={t('aiAdjust.examples')}
                                    className="ai-adjust-examples flex min-w-0 flex-col gap-2 pt-3"
                                >
                                    <p className="px-1.5 text-[13px] font-medium text-main-1">{t('aiAdjust.examples')}</p>
                                    {[...new Set(requestExamples)].map((sentence) => (
                                        <button
                                            key={sentence}
                                            type="button"
                                            disabled={busy || running || !adjustEnabled}
                                            onClick={() => {
                                                setText(sentence);
                                                textarea.current?.focus();
                                            }}
                                            className="flex min-h-11 w-full items-center justify-between gap-2 rounded-[5px] bg-gray-7 px-3 py-2 text-left text-[13px] leading-5 break-keep text-[#475467] hover:bg-main-light hover:text-main-1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-main-1 disabled:opacity-50"
                                        >
                                            <span>{sentence}</span>
                                            <img src={nextIcon} alt="" width={22} height={22} className="shrink-0" />
                                        </button>
                                    ))}
                                </section>
                            )}
                        {!preparing &&
                            !busy &&
                            !running &&
                            !isAutofillBlocked &&
                            adjustEnabled &&
                            latestOperation?.operationType === 'ADJUST' &&
                            latestOperation.executionStatus === 'SUCCEEDED' &&
                            latestOperation.applyStatus === 'APPLIED' &&
                            !operationFailure(latestOperation) &&
                            !visibleTurns.some((turn) => turn.sequence > latestOperation.sequence) && (
                                <AssistantMessage>
                                    {copy('더 바꾸고 싶은 점이 있나요?', 'Would you like to change anything else?')}
                                </AssistantMessage>
                            )}
                        {error && (
                            <AiFailureMessage message={error.message}>
                                {!error.blocked && error.checkOutcome !== false && (
                                    <button className={buttonClass} disabled={busy} onClick={() => void retryPending()}>
                                        {copy('결과 다시 확인하기', 'Check execution history')}
                                    </button>
                                )}
                            </AiFailureMessage>
                        )}
                    </AiChatScroll>
                    {reportOperation && (
                        <section
                            className="max-h-[50dvh] shrink-0 overflow-y-auto rounded-xl bg-gray-7 p-3"
                            aria-label={copy('결과 의견 보내기', 'Send feedback')}
                        >
                            <p className="mb-2 text-sm font-semibold">
                                {copy('의견 대상', 'Feedback for')}:{' '}
                                {copy(
                                    detail?.operations.find((op) => op.operationId === reportOperation)?.operationType === 'GENERATE'
                                        ? '자동채우기'
                                        : '수정',
                                    detail?.operations.find((op) => op.operationId === reportOperation)?.operationType === 'GENERATE'
                                        ? 'Autofill'
                                        : 'Adjustment',
                                )}{' '}
                                {detail && operationAttempt(detail, reportOperation)}
                                {copy('회차 결과', ' attempt result')}
                            </p>
                            <label htmlFor="ai-report-note">
                                {copy('예상한 조건과 다른 점을 적어 주세요.', 'Describe how the outcome differs from your request.')}
                            </label>
                            <textarea
                                id="ai-report-note"
                                ref={reportInput}
                                disabled={busy}
                                className="my-2 w-full rounded-lg border border-gray-5 bg-white p-3 text-sm focus:border-main-1 focus:outline-none"
                                value={reportNote}
                                maxLength={500}
                                onChange={(event) => {
                                    reportAttempt.noteChanged(event.target.value);
                                    setReportNote(event.target.value);
                                }}
                            />
                            <p className="mb-2 text-xs break-keep text-[#475467]">
                                {copy(
                                    '취소하면 이 신고를 끝내고, 다시 작성할 때 새 신고로 보내요.',
                                    'Cancel ends this report. Writing again starts a new report.',
                                )}
                            </p>
                            {reportRecovery !== undefined && !busy && (
                                <p role="status" className="mb-2 text-xs break-keep text-[#475467]">
                                    {reportRecovery
                                        ? copy(
                                              '이 탭에서 24시간 안에 같은 내용을 다시 입력하면 기존 신고로 재시도해요.',
                                              'Re-enter the same note in this tab within 24 hours to retry the same report.',
                                          )
                                        : copy(
                                              '재시도 정보를 저장하지 못했어요. 새로고침하지 않고 여기서 다시 보내 주세요.',
                                              'Retry metadata could not be saved. Retry here without refreshing.',
                                          )}
                                </p>
                            )}
                            <button
                                className={buttonClass}
                                disabled={busy || !reportNote.trim()}
                                onClick={() =>
                                    void run(async () => {
                                        const current = detailRef.current;

                                        if (!current) return;

                                        const note = reportNote.trim();
                                        const scope = reportScopeFor(current.conversation.conversationId, reportOperation);
                                        const key = await reportAttempt.keyFor(scope, note);

                                        if (!mounted.current) return;

                                        if (scope !== reportScopeFor(current.conversation.conversationId, reportOperation))
                                            throw new AiConversationInputError('staleRequest');

                                        setReportRecovery(reportAttempt.recoverable);

                                        await api.report(current.conversation.conversationId, reportOperation, note, key);

                                        if (!mounted.current) return;

                                        setNotice(copy('의견을 보냈어요. 확인해서 개선할게요.', 'Your feedback was sent. Thank you.'));
                                        trackScheduleSignal('feedback_sent');
                                        await closeReport(false);
                                        setReportNote('');
                                    })
                                }
                            >
                                {copy('의견 보내기', 'Send feedback')}
                            </button>
                            <button className={buttonClass} disabled={busy} onClick={() => void run(closeReport)}>
                                {copy('취소', 'Cancel')}
                            </button>
                        </section>
                    )}
                    {selectedSuggestion && (
                        <section className="rounded-xl bg-gray-7 p-3" aria-label={copy('제안 확인', 'Review suggestion')}>
                            <p>{t('aiAdjust.chat.applyQuestion')}</p>
                            <ConversationSuggestionChanges suggestion={selectedSuggestion.suggestion} />
                            <button className={buttonClass} disabled={busy} onClick={() => setSelectedSuggestion(undefined)}>
                                {copy('취소', 'Cancel')}
                            </button>
                            <button
                                className={buttonClass}
                                disabled={busy || running || localDirty}
                                onClick={() => {
                                    const selected = selectedSuggestion;

                                    void execute('ADJUST', undefined, selected.op.interpretationId ?? undefined, selected);
                                }}
                            >
                                {copy('이 변경으로 수정하기', 'Apply these changes')}
                            </button>
                        </section>
                    )}
                    {preview && (
                        <AiConversationSnapshot
                            version={preview.version}
                            before={preview.before}
                            disabled={busy || running}
                            onClose={() => setPreview(null)}
                            onContinue={(version) => void branch(version)}
                        />
                    )}
                    <footer className={preparing ? 'hidden' : 'shrink-0 space-y-2 pt-3'} inert={preparing}>
                        {pendingBranch && (
                            <button
                                className={buttonClass}
                                disabled={busy || running}
                                onClick={() =>
                                    void run(async () => {
                                        const uiRevision = useShiftEditorStore.getState().draftRevision;

                                        await sync();

                                        if (useShiftEditorStore.getState().draftRevision !== uiRevision) {
                                            throw new AiConversationInputError('draftChanged');
                                        }

                                        resetSectionUi(); // sync already installed the current revision of this same conversation.
                                        restore(pendingBranch.draft);
                                        setPendingBranch(null);
                                        setPreview(null);
                                    })
                                }
                            >
                                {copy('이 표로 이어서 작성하기', 'Open the saved new branch')}
                            </button>
                        )}
                        <div className={composerHidden ? 'hidden' : 'space-y-2'} inert={composerHidden} aria-hidden={composerHidden}>
                            {!!preferences.length && (
                                <details>
                                    <summary className="text-sm">{copy('자주 쓰는 요청', 'Saved requests')}</summary>
                                    {preferences.map((p) => (
                                        <div className="flex gap-2" key={p.id}>
                                            <button
                                                className="text-left text-sm underline"
                                                disabled={busy || running}
                                                onClick={() => {
                                                    setText(p.value);
                                                    setEditingPreferenceId(undefined);
                                                    setRequestToolsOpen(false);
                                                }}
                                            >
                                                {p.value}
                                            </button>
                                            <button
                                                className="text-sm underline"
                                                disabled={busy || running}
                                                onClick={() => {
                                                    setText(p.value);
                                                    setEditingPreferenceId(p.id);
                                                }}
                                            >
                                                {copy('수정', 'Edit')}
                                            </button>
                                            <button
                                                className="text-sm"
                                                disabled={busy || running}
                                                onClick={() =>
                                                    void run(async () => {
                                                        await api.deletePreference(p.id);

                                                        if (editingPreferenceId === p.id) setEditingPreferenceId(undefined);

                                                        setPreferences(await api.preferences());
                                                    })
                                                }
                                            >
                                                {copy('삭제', 'Delete')}
                                            </button>
                                        </div>
                                    ))}
                                </details>
                            )}
                            {previousId && !semanticExecutionEnabled && !active?.semanticPlan && (
                                <select
                                    aria-label={copy('조건 수정 방식', 'Revision mode')}
                                    value={change}
                                    onChange={(event) => setChange(event.target.value as typeof change)}
                                    className="w-full rounded border p-2 text-sm"
                                >
                                    <option value="REPLACE">{copy('이전 제안을 교체', 'Replace the previous proposal')}</option>
                                    <option value="ADD">{copy('이전 제안에 추가', 'Add to the previous proposal')}</option>
                                    <option value="RESET">{copy('새 요청으로 시작', 'Start a new request')}</option>
                                </select>
                            )}
                            {editingRequest && (
                                <p className="text-[13px] text-[#6B7280]">
                                    {copy('바꾸고 싶은 부분을 수정해 주세요.', 'Edit the part you want to change.')}
                                </p>
                            )}
                            <div className="ai-adjust-composer flex flex-col rounded-[14px] border-[1.8px] border-[#DCE2EB] bg-gray-7 px-4 py-3 focus-within:border-main-1 focus-within:bg-main-light">
                                <label className="block text-sm">
                                    <span className="sr-only">{copy('바꾸고 싶은 내용', 'Your changes')}</span>
                                    <textarea
                                        ref={textarea}
                                        className="text-gray-1 w-full resize-none bg-transparent text-[14.5px] leading-6 outline-none placeholder:text-[#475467] disabled:opacity-50"
                                        maxLength={500}
                                        rows={editingRequest ? 4 : 2}
                                        value={text}
                                        onChange={(event) => setText(event.target.value)}
                                        disabled={busy || running || !adjustEnabled}
                                        placeholder={
                                            active?.semanticPlan?.state === 'NEEDS_CLARIFICATION' && !editingRequest
                                                ? t('aiAdjust.chat.replyPlaceholder')
                                                : semanticExecutionEnabled
                                                  ? requestExamples[0]
                                                      ? copy(`예: ${requestExamples[0]}`, `E.g. ${requestExamples[0]}`)
                                                      : copy('바꾸고 싶은 내용을 적어 주세요.', 'Describe what you want to change.')
                                                  : t('aiAdjust.placeholder')
                                        }
                                    />
                                </label>
                                <div className="mt-2 flex items-center justify-between gap-2">
                                    {editingRequest && (
                                        <button
                                            className="min-h-11 px-3 text-sm text-[#6B7280] hover:text-main-1"
                                            disabled={busy || running}
                                            onClick={() => {
                                                setEditingRequest(null);
                                                setText('');
                                                setEntryChoice(null);
                                            }}
                                        >
                                            {copy('취소', 'Cancel')}
                                        </button>
                                    )}
                                    <button
                                        type="button"
                                        aria-label={editingRequest ? copy('수정한 요청 확인', 'Review changes') : t('aiAdjust.send')}
                                        className="ml-auto grid size-11 shrink-0 place-items-center rounded-[10px] bg-main-1 hover:bg-[#5931B9] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-main-1 disabled:bg-gray-3"
                                        disabled={busy || running || !text.trim() || !adjustEnabled}
                                        onClick={() => void interpret()}
                                    >
                                        <img src={sendIcon} alt="" width={22} height={22} className="rotate-90" />
                                    </button>
                                </div>
                            </div>
                            <div className="flex justify-end">
                                {!editingRequest && !!text.trim() && (
                                    <button
                                        className="ml-auto min-h-11 px-2 text-[13px] text-[#6B7280] hover:text-main-1"
                                        disabled={busy}
                                        onClick={() => setRequestToolsOpen((value) => !value)}
                                        aria-expanded={requestToolsOpen}
                                    >
                                        {preferenceSaveLabel}
                                    </button>
                                )}
                            </div>
                            {requestToolsOpen && !!text.trim() && (
                                <div className="rounded-xl bg-[#F7F8FA] p-3">
                                    <p className="mb-2 text-[13px] text-[#6B7280]">
                                        {copy('다음에도 쓰고 싶은 요청을 저장해 둘 수 있어요.', 'Save this request to use it again.')}
                                    </p>
                                    <button
                                        className={buttonClass}
                                        disabled={busy || !text.trim()}
                                        onClick={() =>
                                            void run(async () => {
                                                if (editingPreferenceId === undefined)
                                                    await api.savePreference(text.trim(), 'EXPLICIT_USER_CONFIRMATION');
                                                else await api.replacePreference(editingPreferenceId, text.trim());

                                                setEditingPreferenceId(undefined);
                                                setRequestToolsOpen(false);
                                                setPreferences(await api.preferences());
                                            })
                                        }
                                    >
                                        {preferenceSaveLabel}
                                    </button>
                                </div>
                            )}
                            {busy && (
                                <p role="status" className="text-sm">
                                    {awaitingAdjustment
                                        ? copy('근무표를 수정하고 있어요.', 'Adjusting your schedule.')
                                        : copy('요청을 확인하고 있어요.', 'Reviewing your request.')}
                                </p>
                            )}
                        </div>
                    </footer>
                </div>
            </aside>
        </>,
        document.body,
    );
}
