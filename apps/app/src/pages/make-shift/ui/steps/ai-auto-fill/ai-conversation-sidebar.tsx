import {type ReactNode, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState} from 'react';
import {createPortal} from 'react-dom';
import type {TShift} from '@/entities/shift';
import useAuthStore from '@/features/auth/model/store';
import {snapshotDetailToDoc, useShiftEditorCommands, useShiftEditorStore} from '@/features/shift-editor';
import {buildAutofillDTO} from '@/features/shift-editor/model/schedule-authoring';
import i18n from '@/i18n';
import nextIcon from '@/shared/assets/images/ai-adjust/next.svg';
import sendIcon from '@/shared/assets/images/ai-adjust/send.svg';
import ROUTE from '@/shared/constant/path';
import {useTypedTranslation} from '@/shared/hook/use-typed-translation';
import {ConfirmationSpotlight} from '@/shared/ui/ConfirmActionDialog';
import {trackScheduleSignal} from '@/shared/util/growth-analytics';
import {describeAdjustChanges} from '../../../model/ai-adjust-conversation';
import {isScheduleFullyProtected} from '../../../model/ai-autofill-state';
import {AiConversationInputError, aiConversationFailure, type TAiConversationFailure} from '../../../model/ai-conversation-failure';
import {conversationOperationFailure as operationFailure} from '../../../model/ai-execution-failure';
import {conversationDraftSignature as signature} from '../../../model/conversation-draft-signature';
import {isExecutionFinished, readPendingExecution, isDefinitiveExecutionConflict} from '../../../model/conversation-pending-execution';
import {
    conversationTurnText,
    currentConversationTurns,
    operationAttempt,
    precedingCompletedOperation,
    requestTextForTurn,
} from '../../../model/conversation-presentation';
import {isConversationSuggestionCurrent, isFailureSuggestionAvailable} from '../../../model/conversation-suggestion';
import {INTENT_FIRST_CONTRACT, canApplyAuthoringResult, canSelectAuthoringCandidate} from '../../../model/intent-first-authoring';
import {loadMonthlyRestRequirement} from '../../../model/monthly-rest-requirement';
import {readScheduleChat, scheduleChatKey, scheduleChatOwner, writeScheduleChat} from '../../../model/schedule-chat-cache';
import {
    conversationApi,
    conversationEvents,
    isConversationConfirmationCurrent,
    isSemanticExecutionCurrent,
    hasCurrentIntentFirstExecutionWindow,
    type TConversation,
    type TConversationDetail,
    type TConversationExecute,
    type TConversationOperation,
    type TConversationTurn,
    type TResultVersion,
} from '../../../model/schedule-conversation-api';
import {lastAppliedScheduleObservation, reportScheduleJourney} from '../../../model/schedule-journey';
import {useAiActiveConditions} from '../../../model/use-ai-active-conditions';
import {useConversationPolling} from '../../../model/use-conversation-polling';
import {useScheduleChatComposer} from '../../../model/use-schedule-chat-composer';
import {AiActiveConditions, type TActiveConditionsHandle} from './ai-active-conditions';
import {AiAdjustInterpretCard} from './ai-adjust-interpret-card';
import type {TAdjustResultActions} from './ai-adjust-result';
import {AiAdjustApplyChoices, AssistantMessage, UserMessage} from './ai-adjust-review-conversation';
import {AiAutofillMessages, type TAutofillFlow, type TAutofillMessage} from './ai-autofill-preparation';
import {AiChatScroll} from './ai-chat-scroll';
import {ConstraintConflictReview} from './ai-constraint-conflict-review';
import {AiConversationChanges} from './ai-conversation-changes';
import {ConversationConfirmation} from './ai-conversation-confirmation';
import {AiConversationConfirmation, AiConversationEntry, type TConversationEntryChoice} from './ai-conversation-entry';
import {ConversationEvidence, ConversationSuggestionChanges, type TFailureSuggestion} from './ai-conversation-evidence';
import {AiConversationHeader} from './ai-conversation-header';
import {AiConversationHistory} from './ai-conversation-history';
import {AiConversationLoading, AiConversationLoadingPlaceholder} from './ai-conversation-loading';
import {AiConversationOperationStatus, isConversationOperationPending} from './ai-conversation-operation-status';
import {AiConversationResult} from './ai-conversation-result';
import AiConversationSnapshot from './ai-conversation-snapshot';
import {AiConversationTimestamp} from './ai-conversation-timestamp';
import {AiExecutionFailure} from './ai-execution-failure';
import {AiFailureMessage} from './ai-failure-message';
import {AiResultSatisfaction} from './ai-result-satisfaction';
import {AiSemanticReview} from './ai-semantic-review';
import {JourneyObserved} from './journey-observed';

type TProps = {
    open: boolean;
    loading?: boolean;
    preparation?: ReactNode;
    autofillFlow?: TAutofillFlow | null;
    onNewConversation?: () => void;
    spotlightSelector?: string;
    spotlightInteractive?: boolean;
    onPrepareGeneration?: () => void;
    getProtectedCellKeys?: () => string[];
    onEditSchedule?: () => void;
    onRecoverGeneration?: () => void;
    onPrepareAdjustment?: (kind?: 'generation' | 'adjustment') => Promise<void>;
    generationFillPolicy?: 'EMPTY_ONLY' | 'REBUILD_UNLOCKED';
    onClose: () => void;
    onOpenConstraints?: () => void;
    wardId: number;
    teamId: number;
    year: number;
    month: number;
    shift: TShift;
    adjustEnabled: boolean;
    generationRequest: number;
    generationText?: string;
    rebuildRequest: number;
    onApplied: () => void;
    onGenerated?: () => void;
    onBusyChange?: (busy: boolean, succeeded?: boolean) => void;
    resultActions?: TAdjustResultActions;
};
type TLocalEvent = {kind: 'local'; id: string; sequence: number; messages: TAutofillMessage[]};
type TComposerContext = {
    editingEventId?: number;
    previousId?: string;
    change: 'REPLACE' | 'ADD' | 'RESET';
};
type TLocalTranscript = {conversationId: number | null; events: TLocalEvent[]; recoveredFailures: string[]; composer?: TComposerContext};
type TPreview = {version: TResultVersion; sourceVersionId?: string; returnFocusTo: HTMLElement | null};
type TActivity = 'updating' | 'reviewing' | 'viewing' | 'recovering' | 'sending';

const buttonClass =
    'min-h-11 rounded-lg bg-gray-7 px-3 py-2 text-sm hover:bg-main-light hover:text-main-1 focus-visible:bg-main-1 focus-visible:text-white focus-visible:outline-none disabled:opacity-40';

export default function AiConversationSidebar({
    open,
    loading = false,
    preparation,
    autofillFlow,
    onNewConversation,
    spotlightSelector,
    spotlightInteractive,
    onPrepareGeneration,
    getProtectedCellKeys,
    onEditSchedule,
    onRecoverGeneration,
    onPrepareAdjustment,
    generationFillPolicy = 'EMPTY_ONLY',
    onClose,
    onOpenConstraints,
    wardId,
    teamId,
    year,
    month,
    shift,
    adjustEnabled,
    generationRequest,
    generationText = '',
    rebuildRequest,
    onApplied,
    onGenerated,
    onBusyChange,
    resultActions,
}: TProps) {
    const conditionsEditor = useRef<TActiveConditionsHandle>(null);
    const {t} = useTypedTranslation();
    const preparing = Boolean(preparation);
    const [awaitingAdjustment, setAwaitingAdjustment] = useState(false);
    const awaitingAdjustmentRef = useRef(false);
    const reviewedPreparation = useRef<string | null>(null);
    const [dismissedFailureId, setDismissedFailureId] = useState<string | null>(null);
    const chatOwner = useAuthStore((state) => scheduleChatOwner(state.accountId, state.accessToken));
    const chatKey = scheduleChatKey(chatOwner, wardId, teamId, year, month);
    const transcriptKey = chatKey ? `${chatKey}:server-transcript` : null;
    const {
        text,
        setText,
        entryChoice,
        setEntryChoice,
        saveFailed: composerSaveFailed,
    } = useScheduleChatComposer(chatKey ? `${chatKey}:composer` : null);
    const [storedTranscript] = useState(() =>
        readScheduleChat<TLocalTranscript>(transcriptKey, (value): value is TLocalTranscript => {
            const transcript = value as TLocalTranscript | null;

            return Boolean(
                transcript &&
                    (transcript.conversationId === null || Number.isSafeInteger(transcript.conversationId)) &&
                    Array.isArray(transcript.events) &&
                    transcript.events.every(
                        (event) =>
                            event?.kind === 'local' &&
                            typeof event.id === 'string' &&
                            Number.isFinite(event.sequence) &&
                            Array.isArray(event.messages) &&
                            event.messages.every(
                                (message) => message && ['user', 'assistant'].includes(message.role) && typeof message.text === 'string',
                            ),
                    ) &&
                    Array.isArray(transcript.recoveredFailures) &&
                    transcript.recoveredFailures.every((id) => typeof id === 'string') &&
                    (!transcript.composer ||
                        (['REPLACE', 'ADD', 'RESET'].includes(transcript.composer.change) &&
                            (transcript.composer.previousId == null || typeof transcript.composer.previousId === 'string') &&
                            (transcript.composer.editingEventId == null || Number.isSafeInteger(transcript.composer.editingEventId)))),
            );
        }),
    );
    const transcriptConversation = useRef(storedTranscript?.conversationId ?? null);
    const recoveredFailures = useRef(new Set(storedTranscript?.recoveredFailures ?? []));
    const [localEvents, setLocalEvents] = useState<TLocalEvent[]>(storedTranscript?.events ?? []);
    const [historySaveFailed, setHistorySaveFailed] = useState(false);
    const discardedPreparationId = useRef<number | null>(null);
    const localSequence = useRef(Math.max(0, ...localEvents.map((event) => Number(event.id.slice(event.id.lastIndexOf(':') + 1)) || 0)));
    const textarea = useRef<HTMLTextAreaElement>(null);
    const api = useMemo(() => conversationApi(wardId, teamId), [wardId, teamId]);
    const commands = useShiftEditorCommands();
    const doc = useShiftEditorStore((s) => s.doc);
    const intentFirstEnabled = useShiftEditorStore((s) => s.intentFirstAuthoringEnabled);
    const automaticAttempts = useRef(new Set<string>());
    const initialGenerationPending = useRef(false);
    const generationPlanIds = useRef(new Set<string>());
    const semanticExecutionEnabled = useShiftEditorStore((s) => s.semanticExecutionEnabled);
    const isAutofillBlocked = isScheduleFullyProtected(doc);
    const revision = useShiftEditorStore((s) => s.draftRevision);
    const [detail, setDetail] = useState<TConversationDetail | null>(null);
    const [conditionsContextInvalid, setConditionsContextInvalid] = useState(false);
    const detailRef = useRef<TConversationDetail | null>(null);
    const [earlierConversations, setEarlierConversations] = useState<TConversation[]>([]);
    const [operationBusy, setBusy] = useState(false);
    const [conditionEditorBusy, setConditionEditorBusy] = useState(false);
    const conditionEditorBusyRef = useRef(false);
    const busy = operationBusy || conditionEditorBusy;

    conditionEditorBusyRef.current = conditionEditorBusy;

    const [activity, setActivity] = useState<TActivity>('updating');
    const [executing, setExecuting] = useState(false);
    const busyRef = useRef(false);
    const [error, setError] = useState<TAiConversationFailure | null>(null);
    const [notice, setNotice] = useState<string | null>(null);
    const recordedFeedback = useRef<{notice: string | null; error: string | null}>({notice: null, error: null});
    const [editingRequest, setEditingRequest] = useState<TConversationTurn | null>(null);
    const [change, setChange] = useState<TComposerContext['change']>(storedTranscript?.composer?.change ?? 'ADD');
    const [previousId, setPreviousId] = useState<string | undefined>(storedTranscript?.composer?.previousId);
    const [preview, setPreview] = useState<TPreview | null>(null);
    const previewRequest = useRef(0);
    const sidebarOpen = useRef(open);
    const [pendingBranch, setPendingBranch] = useState<TConversationDetail | null>(null);
    const [rebuild, setRebuild] = useState(false);
    const [selectedSuggestion, setSelectedSuggestion] = useState<{op: TConversationOperation; suggestion: TFailureSuggestion}>();
    const mounted = useRef(true);
    const initialized = useRef(false);
    const syncTail = useRef<Promise<unknown>>(Promise.resolve());
    const preserveGenerationComposer = useRef(false);
    const lastGeneration = useRef(0);
    const lastRebuild = useRef(0);
    const pendingKey = `dutying.conversation:${chatOwner?.replace('ward-admin:', 'admin:') ?? 'anonymous'}:${wardId}:${teamId}:${year}:${month}`;
    const copy = (korean: string, english: string) => (i18n.language.startsWith('ko') ? korean : english);
    const install = (next: TConversationDetail) => {
        if (
            detailRef.current?.conversation.conversationId === next.conversation.conversationId &&
            next.conversation.revision < detailRef.current.conversation.revision
        )
            return;

        if (transcriptConversation.current !== null && transcriptConversation.current !== next.conversation.conversationId) {
            setLocalEvents([]);
            recoveredFailures.current.clear();
            setEditingRequest(null);
            setPreviousId(undefined);
            setChange('ADD');
        }

        transcriptConversation.current = next.conversation.conversationId;

        if (
            !detailRef.current &&
            storedTranscript?.conversationId === next.conversation.conversationId &&
            storedTranscript.composer?.editingEventId != null
        ) {
            const previousRequest = next.turns.find((turn) => turn.eventId === storedTranscript.composer?.editingEventId);

            setEditingRequest(previousRequest ?? null);

            if (previousRequest) {
                const execution = [...next.operations].reverse().find((op) => op.interpretationId === previousRequest.interpretationId);

                if (execution) setDismissedFailureId(execution.operationId);
            } else {
                setPreviousId(undefined);
                setChange('ADD');
            }
        }

        if (detailRef.current && detailRef.current.conversation.conversationId !== next.conversation.conversationId) {
            setLocalEvents([]);
            setEditingRequest(null);
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
        const draft = buildAutofillDTO({
            year,
            month,
            doc: state.doc,
            originalShift: shift,
            draftRevision: state.draftRevision,
            rulesHash: state.rulesHash ?? '',
        });
        const protectedKeys = new Set(getProtectedCellKeys?.());

        return {
            ...draft,
            cells: draft.cells.map((cell) => (protectedKeys.has(`${cell.shiftNurseId}:${cell.date}`) ? {...cell, fixed: true} : cell)),
        };
    };
    const localDraft = dto();
    const localDirty =
        conditionsContextInvalid ||
        (detail ? signature({...localDraft, carryOverCells: localDraft.carryOverCells ?? []}) !== signature(detail.draft) : false);
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
    const refresh = async (): Promise<void> => {
        if (!detailRef.current) return;

        const conversationId = detailRef.current.conversation.conversationId;
        const pending = readPendingExecution(sessionStorage, pendingKey);
        const next = await api.detail(conversationId);

        if (mounted.current && detailRef.current?.conversation.conversationId === conversationId) {
            install(next);
            setConditionsContextInvalid(false);

            const completed =
                pending?.conversationId === conversationId
                    ? next.operations.find((op) => op.operationId === pending.operationId && isExecutionFinished(op))
                    : undefined;

            if (completed?.result?.authoringOutcome && pending)
                await applyCompleted(completed, pending.uiRevision, pending.request.candidateDigest);
        }
    };
    const activeConditions = useAiActiveConditions({
        wardId,
        teamId,
        year,
        month,
        enabled: open,
        onChanged: async () => {
            setConditionsContextInvalid(true);
            reviewedPreparation.current = null;
            setSelectedSuggestion(undefined);
            await refresh();
        },
    });
    const run = async (action: () => Promise<void>, isExecution = false, nextActivity: TActivity = 'updating', propagateError = false) => {
        if (busyRef.current || conditionEditorBusyRef.current) {
            if (propagateError) throw new AiConversationInputError('loading');

            return;
        }

        busyRef.current = true;
        setBusy(true);
        setActivity(nextActivity);
        setExecuting(isExecution);
        setError(null);

        try {
            await action();
        } catch (e) {
            if (propagateError) throw e;

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
    const applyCompleted = async (
        operation: TConversationOperation,
        uiRevision: number,
        expectedCandidateDigest?: string,
    ): Promise<void> => {
        await syncTail.current.catch(() => undefined);

        if (!mounted.current) return;

        let appliedLocally = false;

        if (
            operation.executionStatus === 'SUCCEEDED' &&
            !operationFailure(operation) &&
            operation.applyStatus === 'APPLIED' &&
            (!operation.result?.authoringOutcome || intentFirstEnabled) &&
            (!operation.result || canApplyAuthoringResult(operation.result, operation.sourceVersionId, expectedCandidateDigest)) &&
            operation.resultVersionId &&
            useShiftEditorStore.getState().draftRevision === uiRevision
        ) {
            const version = await api.version(operation.resultVersionId);

            if (!mounted.current) return;

            if (useShiftEditorStore.getState().draftRevision === uiRevision) {
                const before = useShiftEditorStore.getState().doc;

                if (version.versionId !== operation.resultVersionId) throw new AiConversationInputError('staleRequest');

                restore(version);
                appliedLocally = true;

                if (operation.operationType === 'GENERATE') setEntryChoice(null);

                if (operation.result?.authoringOutcome && operation.result.validationTarget === 'RESULT')
                    commands.setScheduleValidationFromApi({
                        ...operation.result.validation,
                        draftRevision: useShiftEditorStore.getState().draftRevision,
                    });

                void reportScheduleJourney(operation.result?.observation, {
                    type: 'CLIENT_APPLIED',
                    changedCellCount: describeAdjustChanges(before, useShiftEditorStore.getState().doc).length,
                    draftRevision: useShiftEditorStore.getState().draftRevision,
                });
            } else setNotice(t('aiConversationSidebar.draftChangedResultSaved'));
        } else if (
            operation.executionStatus === 'SUCCEEDED' &&
            !operationFailure(operation) &&
            (!operation.result?.authoringOutcome || operation.applyStatus === 'APPLIED')
        ) {
            setNotice(t('aiConversationSidebar.draftChangedResultSaved'));
        }

        try {
            await refresh();
        } catch (cause) {
            // The result is already saved and visible in the editor. A delayed
            // conversation lookup must not turn that success into a failure card.
            if (!appliedLocally) throw cause;
        }
    };
    const sendExecution = async (id: number, request: TConversationExecute) => {
        const beforeRequest = detailRef.current;
        const savedBeforeRequest = readPendingExecution(sessionStorage, pendingKey);
        const knownOperationIds =
            savedBeforeRequest?.conversationId === id &&
            savedBeforeRequest.request.idempotencyKey === request.idempotencyKey &&
            Array.isArray(savedBeforeRequest.operationIdsBeforeRequest)
                ? new Set(savedBeforeRequest.operationIdsBeforeRequest)
                : null;

        try {
            const operation = await api.execute(id, request);
            const pending = readPendingExecution(sessionStorage, pendingKey);

            if (pending?.conversationId === id && pending.request.idempotencyKey === request.idempotencyKey) {
                if (isExecutionFinished(operation)) sessionStorage.removeItem(pendingKey);
                else sessionStorage.setItem(pendingKey, JSON.stringify({...pending, operationId: operation.operationId}));
            }

            return operation;
        } catch (e) {
            if (request.authoringContractVersion === INTENT_FIRST_CONTRACT && isDefinitiveExecutionConflict(e)) {
                // Reconcile once by reading current state. Never replay a stale operation here.
                // If a prior receipt or an ambiguous new operation exists, retain the original key.
                try {
                    const latest = await api.detail(id);

                    if (
                        latest.conversation.conversationId !== id ||
                        (beforeRequest && latest.conversation.revision < beforeRequest.conversation.revision)
                    )
                        throw new AiConversationInputError('staleRequest');

                    const saved = readPendingExecution(sessionStorage, pendingKey);
                    const matchingRequest = saved?.conversationId === id && saved.request.idempotencyKey === request.idempotencyKey;
                    const possibleReceipt = latest.operations.some(
                        (operation) =>
                            operation.operationId === saved?.operationId ||
                            (!knownOperationIds?.has(operation.operationId) &&
                                operation.baseRevision === request.expectedRevision &&
                                operation.operationType === request.operationType &&
                                (!request.sourceVersionId || operation.sourceVersionId === request.sourceVersionId) &&
                                operation.interpretationId === (request.interpretationId ?? null)),
                    );

                    if (mounted.current && detailRef.current?.conversation.conversationId === id) install(latest);

                    if (matchingRequest && knownOperationIds && !possibleReceipt) {
                        sessionStorage.removeItem(pendingKey);
                    }
                } catch {
                    /* An unavailable lookup leaves the original request available for reconciliation. */
                }
            }

            if (
                [400, 403, 422, 429].includes((e as {code?: number}).code ?? 0) ||
                (e as {serverCode?: string}).serverCode === 'CANDIDATE_EXPIRED' ||
                aiConversationFailure(e).blocked
            )
                sessionStorage.removeItem(pendingKey);

            throw e;
        }
    };
    const execute = async (
        operationType: 'GENERATE' | 'ADJUST',
        fillPolicy?: 'EMPTY_ONLY' | 'REBUILD_UNLOCKED',
        interpretationId?: string,
        selection?: {op: TConversationOperation; suggestion: TFailureSuggestion},
        conflict?: TConversationOperation,
        refreshBeforeExecution = false,
    ) => {
        await run(async () => {
            if (isScheduleFullyProtected(useShiftEditorStore.getState().doc)) throw new Error(t('aiAdjust.allFixed'));

            if (selection || conflict?.result?.candidate || refreshBeforeExecution) await refresh();

            const current = await sync();

            if (
                selection &&
                (!isConversationSuggestionCurrent(current, selection.op) || !isFailureSuggestionAvailable(selection.suggestion))
            ) {
                setSelectedSuggestion(undefined);
                throw new AiConversationInputError('expiredSuggestion');
            }

            if (
                conflict?.result?.candidate &&
                (!intentFirstEnabled ||
                    conflict.baseRevision !== current.conversation.revision ||
                    !canSelectAuthoringCandidate(conflict.result, current.conversation.currentVersionId))
            )
                throw new AiConversationInputError('expiredSuggestion');

            const uiRevision = useShiftEditorStore.getState().draftRevision;
            // Preserve the exact request on response loss; retry never creates a second action.
            const saved = readPendingExecution(sessionStorage, pendingKey);

            if (saved) throw new AiConversationInputError('pendingExecution');

            const request: TConversationExecute = {
                clientContext: {
                    surfaceVersion: 'conversation-minimal-v1',
                    entryChoice: operationType === 'GENERATE' ? 'regenerate' : 'modify',
                    inputMode: 'request',
                },
                ...(intentFirstEnabled ? {authoringContractVersion: INTENT_FIRST_CONTRACT} : {}),
                monthlyRestRequirement: await loadMonthlyRestRequirement(wardId, teamId, shift, year, month),
                expectedRevision: current.conversation.revision,
                idempotencyKey: crypto.randomUUID(),
                operationType,
                ...(conflict?.result?.candidate
                    ? {
                          conflictReviewToken: conflict.result.candidate.token,
                          conflictConfirmed: true,
                          candidateDigest: conflict.result.candidate.candidateDigest,
                          sourceOperationId: conflict.operationId,
                          sourceVersionId: conflict.result.candidate.sourceVersionId,
                      }
                    : {}),
                ...(conflict?.result?.conflictReview
                    ? {conflictReviewToken: conflict.result.conflictReview.token, conflictConfirmed: true}
                    : {}),
                ...(fillPolicy ? {fillPolicy, rebuildConfirmed: fillPolicy === 'REBUILD_UNLOCKED'} : {}),
                ...(interpretationId ? {interpretationId} : {}),
                ...(() => {
                    const turn = current.turns.find((entry) => entry.interpretationId === interpretationId);

                    if (!turn?.semanticPlan) return {};

                    if (
                        !conflict?.result?.candidate &&
                        (!isSemanticExecutionCurrent(current, turn, localDirty) ||
                            (turn.type !== 'SEMANTIC_PLAN_CONFIRMED' && !intentFirstEnabled))
                    )
                        throw new Error(t('aiAdjust.stale'));

                    return {
                        planHash: turn.semanticPlan.planHash,
                        sourceVersionId: turn.semanticPlan.sourceVersionId,
                        ...(intentFirstEnabled && turn.semanticPlan.interactionId ? {interactionId: turn.semanticPlan.interactionId} : {}),
                    };
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
            // Only an unsent plain empty-cell fill can restart as a new generation.
            // Rebuild, interpreted requests, failure suggestions and consent keep their review path.
            const canRetryGeneration =
                operationType === 'GENERATE' &&
                (fillPolicy === undefined || fillPolicy === 'EMPTY_ONLY') &&
                !interpretationId &&
                !selection &&
                !conflict;

            if (request.authoringContractVersion === INTENT_FIRST_CONTRACT) {
                const latest = detailRef.current;
                const draft = dto();

                if (
                    !latest ||
                    latest.conversation.conversationId !== current.conversation.conversationId ||
                    latest.conversation.revision !== current.conversation.revision ||
                    latest.contextHash !== current.contextHash ||
                    latest.conversation.currentVersionId !== current.conversation.currentVersionId ||
                    latest.conversation.latestInterpretationId !== current.conversation.latestInterpretationId ||
                    useShiftEditorStore.getState().draftRevision !== uiRevision ||
                    signature({...draft, carryOverCells: draft.carryOverCells ?? []}) !== signature(current.draft)
                )
                    throw new AiConversationInputError('staleRequest', operationType, canRetryGeneration);

                const selectedPlan = latest.turns.find((turn) => turn.interpretationId === interpretationId && turn.semanticPlan);

                if (!conflict?.result?.candidate && selectedPlan && !isSemanticExecutionCurrent(latest, selectedPlan, false))
                    throw new AiConversationInputError('staleRequest', operationType, canRetryGeneration);

                if (conflict?.result?.candidate && !canSelectAuthoringCandidate(conflict.result, latest.conversation.currentVersionId))
                    throw new AiConversationInputError('expiredSuggestion');
            }

            sessionStorage.setItem(
                pendingKey,
                JSON.stringify({
                    conversationId: current.conversation.conversationId,
                    request,
                    uiRevision,
                    operationIdsBeforeRequest: current.operations.map((operation) => operation.operationId),
                }),
            );

            const operation = await sendExecution(current.conversation.conversationId, request);

            if (isExecutionFinished(operation)) sessionStorage.removeItem(pendingKey);

            if (selection) setSelectedSuggestion(undefined);

            await applyCompleted(operation, uiRevision, request.candidateDigest);
            window.dispatchEvent(new Event('dutying:commercial-usage-changed'));
        }, true);
    };
    const changeModalities = async (turn: TConversationTurn, overrides: Record<string, 'HARD' | 'SOFT'>) => {
        // run() presents errors but deliberately consumes them. Track completion so the editor retains failed changes.
        let saved = false;

        await run(async () => {
            const current = detailRef.current;

            if (!current || !turn.semanticPlan || !turn.interpretationId || !isConversationConfirmationCurrent(current, turn, localDirty))
                throw new Error(t('aiAdjust.stale'));

            await api.changeModalities(
                current.conversation.conversationId,
                turn.interpretationId,
                current.conversation.revision,
                turn.semanticPlan.planHash,
                overrides,
            );
            await refresh();
            saved = true;
        });

        if (!saved) throw new Error('Priority update was not saved');
    };
    const confirmAndAdjust = async (turn: TConversationTurn) => {
        if (awaitingAdjustmentRef.current || busyRef.current || !turn.interpretationId || !turn.semanticPlan || !detailRef.current) return;

        const conversationId = detailRef.current.conversation.conversationId;
        const contextHash = detailRef.current.contextHash;
        const plan = turn.semanticPlan;
        const initialGeneration = initialGenerationPending.current && !plan.generationIntent;
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
        setError(null);

        let confirmedId: string | undefined;

        try {
            const initial = detailRef.current;
            const initialDraft = dto();

            if (
                !isConversationConfirmationCurrent(
                    initial,
                    turn,
                    signature({...initialDraft, carryOverCells: initialDraft.carryOverCells ?? []}) !== signature(initial.draft),
                ) ||
                (plan.state !== 'CONFIRMED' && !plan.confirmationAllowed) ||
                isScheduleFullyProtected(useShiftEditorStore.getState().doc)
            )
                throw new Error(t('aiAdjust.stale'));

            // Request review never opens schedule preparation. Ask about protected shifts
            // only after the user accepts the proposed conditions and is ready to calculate.
            if (onPrepareAdjustment && reviewedPreparation.current !== preparationKey()) {
                await onPrepareAdjustment(plan.generationIntent || initialGeneration ? 'generation' : 'adjustment');
            }

            if (!mounted.current || !sidebarOpen.current || detailRef.current?.conversation.conversationId !== conversationId) return;

            reviewedPreparation.current = preparationKey();

            await run(async () => {
                const latestInterpretationId = detailRef.current?.conversation.latestInterpretationId;

                if (latestInterpretationId && latestInterpretationId !== turn.interpretationId) throw new Error(t('aiAdjust.stale'));

                // Pinning or editing previous-month shifts changes the immutable source.
                // Rebind the stored plan on the server without interpreting the text again.
                const synced = await sync();

                if (
                    synced.conversation.conversationId !== conversationId ||
                    synced.contextHash !== contextHash ||
                    (synced.conversation.latestInterpretationId && synced.conversation.latestInterpretationId !== turn.interpretationId)
                )
                    throw new Error(t('aiAdjust.stale'));

                let reviewed = turn;

                if (
                    !isConversationConfirmationCurrent(synced, turn, false) ||
                    plan.sourceVersionId !== synced.conversation.currentVersionId ||
                    (plan.authoringContractVersion === INTENT_FIRST_CONTRACT && !hasCurrentIntentFirstExecutionWindow(plan))
                ) {
                    reviewed = await api.refreshPlan(conversationId, plan.planId, synced.conversation.revision, plan.planHash);
                    await refresh();
                }

                const current = detailRef.current;

                if (!mounted.current || !sidebarOpen.current || !current || !reviewed.semanticPlan || !reviewed.interpretationId) return;

                if (
                    current.conversation.conversationId !== conversationId ||
                    reviewed.semanticPlan.planHash !== plan.planHash ||
                    JSON.stringify(reviewed.semanticPlan.conditions) !== JSON.stringify(plan.conditions) ||
                    JSON.stringify(reviewed.semanticPlan.selectionAudit) !== JSON.stringify(plan.selectionAudit) ||
                    JSON.stringify(reviewed.semanticPlan.generationIntent) !== JSON.stringify(plan.generationIntent)
                )
                    throw new Error(t('aiAdjust.stale'));

                // A newly pinned shift may conflict with the approved request. Show the
                // server's conflict review instead of starting a calculation that cannot apply it.
                if (!['PREVIEW_READY', 'CONFIRMED'].includes(reviewed.semanticPlan.state)) return;

                const draft = dto();
                const dirty = signature({...draft, carryOverCells: draft.carryOverCells ?? []}) !== signature(current.draft);

                if (
                    !isConversationConfirmationCurrent(current, reviewed, dirty) ||
                    reviewed.semanticPlan.sourceVersionId !== current.conversation.currentVersionId ||
                    isScheduleFullyProtected(useShiftEditorStore.getState().doc)
                )
                    throw new Error(t('aiAdjust.stale'));

                const confirmed =
                    reviewed.semanticPlan.state === 'CONFIRMED'
                        ? reviewed
                        : await api.confirmPlan(
                              current.conversation.conversationId,
                              reviewed.interpretationId,
                              current.conversation.revision,
                              reviewed.semanticPlan.planHash,
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
                    confirmed.semanticPlan?.planHash !== plan.planHash ||
                    next.conversation.conversationId !== current.conversation.conversationId
                )
                    throw new Error(t('aiAdjust.stale'));

                confirmedId = confirmed.interpretationId ?? undefined;
            });

            if (confirmedId && mounted.current && sidebarOpen.current) {
                reviewedPreparation.current = null;

                if (initialGeneration) {
                    initialGenerationPending.current = false;
                    generationPlanIds.current.add(confirmedId);
                }

                await execute(
                    plan.generationIntent || initialGeneration ? 'GENERATE' : 'ADJUST',
                    plan.generationIntent || initialGeneration ? 'REBUILD_UNLOCKED' : undefined,
                    confirmedId,
                );
            }
        } catch (cause) {
            if (mounted.current && sidebarOpen.current) setError(aiConversationFailure(cause));
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

        setText(current.conversationState ? '' : original);

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
            if (onPrepareAdjustment && reviewedPreparation.current !== preparationKey())
                await onPrepareAdjustment(confirmed.generationIntent ? 'generation' : 'adjustment');

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
                    (refreshed.interpretation.strength ?? 'NORMAL') !== (confirmed.strength ?? 'NORMAL') ||
                    JSON.stringify(refreshed.interpretation.generationIntent) !== JSON.stringify(confirmed.generationIntent)
                ) {
                    reviewedPreparation.current = preparationKey();
                    setNotice(t('aiConversationSidebar.reviewUpdatedConditions'));

                    return;
                }

                interpretationId = rebound.interpretationId ?? undefined;
            });

            if (interpretationId && mounted.current) {
                reviewedPreparation.current = null;
                await execute(
                    confirmed.generationIntent ? 'GENERATE' : 'ADJUST',
                    confirmed.generationIntent ? 'REBUILD_UNLOCKED' : undefined,
                    interpretationId,
                );
            }
        } catch (cause) {
            if (mounted.current) setError(aiConversationFailure(cause));
        } finally {
            awaitingAdjustmentRef.current = false;

            if (mounted.current) setAwaitingAdjustment(false);
        }
    };
    const retryPending = async () =>
        run(
            async () => {
                trackScheduleSignal('outcome_recheck');

                const saved = readPendingExecution(sessionStorage, pendingKey);

                if (!saved) {
                    if (!detailRef.current) {
                        const list = await api.list(year, month);

                        setEarlierConversations(list.slice(1).reverse());

                        const conversation = list[0] ?? (await api.create(year, month));

                        install(await api.detail(conversation.conversationId));

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
            },
            false,
            'recovering',
        );
    const interpret = async (request = text, reference = previousId, initialGeneration = false) => {
        const message = request.trim();

        if (!message) return;

        const reviewedStateVersion = detailRef.current?.conversationState?.version;

        await run(
            async () => {
                reviewedPreparation.current = null;

                const current = await sync();

                if (!current.conversationState && reference && current.conversation.latestInterpretationId !== reference) {
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
                const state = current.conversationState;

                if (state && reviewedStateVersion !== undefined && state.version !== reviewedStateVersion)
                    throw new Error(t('aiConversationSidebar.requestChanged'));

                const original =
                    !state &&
                    priorPlan &&
                    !editingRequest &&
                    (!intentFirstEnabled || priorPlan.semanticPlan?.state === 'NEEDS_CLARIFICATION')
                        ? requestTextForTurn(current, priorPlan)
                        : '';
                const marker = priorPlan?.semanticPlan?.state === 'NEEDS_CLARIFICATION' ? '추가 답변' : '추가 요청';
                const interpretedText = original && message !== original ? `${original}\n${marker}: ${message}` : message;

                if (interpretedText.length > 500) throw new AiConversationInputError('requestTooLong');

                const interpreted = await api
                    .interpret(current.conversation.conversationId, {
                        expectedRevision: current.conversation.revision,
                        text: interpretedText,
                        clientContext: {
                            surfaceVersion: 'conversation-minimal-v1',
                            entryChoice: entryChoice ?? undefined,
                            inputMode: editingRequest ? 'revision' : state?.pendingQuestion ? 'clarification' : 'request',
                            typedText: message,
                        },
                        ...(intentFirstEnabled ? {authoringContractVersion: INTENT_FIRST_CONTRACT} : {}),
                        language: i18n.language,
                        ...(state
                            ? {
                                  expectedStateVersion: state.version,
                                  change: 'AUTO' as const,
                                  targetConditionIds: [],
                              }
                            : previous && current.conversation.latestInterpretationId === previous
                              ? {
                                    previousInterpretationId: previous,
                                    change: current.turns.some((turn) => turn.interpretationId === previous && turn.semanticPlan)
                                        ? 'REPLACE'
                                        : change,
                                }
                              : {}),
                    })
                    .catch(async (cause) => {
                        // The server reserves a request version before model work. Refresh it for retry.
                        if (state) await refresh().catch(() => undefined);

                        throw cause;
                    });

                if (initialGeneration) initialGenerationPending.current = true;

                setText('');

                setEditingRequest(null);
                setPreviousId(interpreted.interpretationId ?? undefined);
                setChange('ADD');
                setEntryChoice('modify');
                await refresh();
            },
            false,
            'reviewing',
        );
    };
    const view = async (op: TConversationOperation, trigger?: HTMLElement) => {
        const returnFocusTo = trigger ?? (document.activeElement instanceof HTMLElement ? document.activeElement : null);
        const requestId = ++previewRequest.current;

        return run(
            async () => {
                if (!op.resultVersionId) return;

                const version = await api.version(op.resultVersionId);

                if (!mounted.current || !sidebarOpen.current || requestId !== previewRequest.current) return;

                setPreview({
                    version,
                    sourceVersionId: op.sourceVersionId && op.sourceVersionId !== op.resultVersionId ? op.sourceVersionId : undefined,
                    returnFocusTo,
                });
            },
            false,
            'viewing',
        );
    };
    const previewSourceId = preview?.sourceVersionId;
    const loadPreviewSource = useCallback(async () => {
        if (!previewSourceId) throw new Error('No comparison source');

        trackScheduleSignal('comparison_open');

        return api.version(previewSourceId);
    }, [api, previewSourceId]);
    const resetSectionUi = () => {
        initialGenerationPending.current = false;
        discardedPreparationId.current = autofillFlow?.id ?? null;
        reviewedPreparation.current = null;
        previewRequest.current += 1;
        onNewConversation?.();
        setLocalEvents([]);
        setEarlierConversations([]);
        setDismissedFailureId(null);
        setEntryChoice(null);
        setPreviousId(undefined);
        setChange('ADD');
        setText('');
        setEditingRequest(null);
        setRebuild(false);
        setPreview(null);
        setNotice(null);
        setError(null);
        recordedFeedback.current = {notice: null, error: null};
        setPendingBranch(null);

        setSelectedSuggestion(undefined);
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
                setNotice(t('aiConversationSidebar.draftChangedBranchSaved'));

                return;
            }

            install(nextDetail);
            resetSectionUi();
            restore(nextDetail.draft);
        });
    const undoOperation = (operation: TConversationOperation) =>
        run(async () => {
            const current = detailRef.current;
            const uiRevision = useShiftEditorStore.getState().draftRevision;

            if (
                !current ||
                localDirty ||
                current.conversation.currentVersionId !== operation.resultVersionId ||
                sessionStorage.getItem(pendingKey)
            ) {
                setNotice(t('aiConversationSidebar.authoring.undoStale'));

                return;
            }

            const source = await api.version(operation.sourceVersionId);

            if (useShiftEditorStore.getState().draftRevision !== uiRevision) {
                setNotice(t('aiConversationSidebar.authoring.undoStale'));

                return;
            }

            const next = await api.sync(current.conversation.conversationId, {
                expectedRevision: current.conversation.revision,
                cells: source.cells,
                rowOrder: source.rowOrder,
                carryOverCells: source.carryOverCells,
            });

            install(next);

            if (useShiftEditorStore.getState().draftRevision === uiRevision) {
                restore(next.draft);
                void reportScheduleJourney(operation.result?.observation, {
                    type: 'CLIENT_UNDONE',
                    draftRevision: useShiftEditorStore.getState().draftRevision,
                });
            } else setNotice(t('aiConversationSidebar.authoring.undoStale'));
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
        sidebarOpen.current = open;

        if (!open) {
            previewRequest.current += 1;
            setPreview(null);
        }
    }, [open]);
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

            const pending = readPendingExecution(sessionStorage, pendingKey);
            const initial = await api.detail(conversation.conversationId);

            install(initial);

            // A remount may have a different local revision counter. Rebind only after comparing
            // the actual current input with the immutable source, never by trusting a cached counter.
            if (
                pending?.conversationId === conversation.conversationId &&
                pending.request.authoringContractVersion === INTENT_FIRST_CONTRACT
            ) {
                const operation = initial.operations.find((entry) => entry.operationId === pending.operationId);
                const sourceVersionId = pending.request.sourceVersionId ?? operation?.sourceVersionId;
                const uiRevision = useShiftEditorStore.getState().draftRevision;
                const source = sourceVersionId ? await api.version(sourceVersionId) : null;
                const local = dto();

                if (
                    source &&
                    mounted.current &&
                    useShiftEditorStore.getState().draftRevision === uiRevision &&
                    signature({...local, carryOverCells: local.carryOverCells ?? []}) === signature(source)
                ) {
                    if (operation && isExecutionFinished(operation))
                        await applyCompleted(operation, uiRevision, pending.request.candidateDigest);
                    else sessionStorage.setItem(pendingKey, JSON.stringify({...pending, uiRevision}));
                } else if (operation?.applyStatus === 'APPLIED') setNotice(t('aiConversationSidebar.draftChangedResultSaved'));
            }
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
    const conditionsDisabled = busy || running || awaitingAdjustment || preparing || loading || !detail;
    const aiConditions = [
        ...activeConditions.requests
            .filter((request) => request.promotedRuleId == null)
            .map((request) => ({
                id: `request:${request.id}`,
                label: request.displayLabel,
                description: t('aiConversationSidebar.savedForMonth'),
                onRemove: async () => {
                    if (conditionsDisabled || busyRef.current || awaitingAdjustmentRef.current)
                        throw new AiConversationInputError('loading');

                    await run(() => activeConditions.removeRequest(request.id), false, 'updating', true);
                },
            })),
    ];
    const executionBusy = executing || running;
    const segmentStart = Math.max(0, ...(detail?.turns.filter((turn) => turn.type === 'SEGMENT_START').map((turn) => turn.sequence) ?? []));
    const currentOperations = detail?.operations.filter((operation) => operation.sequence > segmentStart) ?? [];
    const latestOperation = currentOperations[currentOperations.length - 1];
    const executionSucceeded = !error && latestOperation?.executionStatus === 'SUCCEEDED' && !operationFailure(latestOperation);
    const polling = useConversationPolling(Boolean(detail) && (running || busy), detail?.conversation.conversationId, refresh);

    useEffect(() => {
        for (const [kind, text] of [
            ['notice', notice],
            ['error', error?.message ?? null],
        ] as const) {
            if (recordedFeedback.current[kind] === text) continue;

            recordedFeedback.current[kind] = text;

            if (!text || (kind === 'notice' && [t('aiAdjust.recovery.running'), t('aiAdjust.recovery.unknown')].includes(text))) continue;

            const id = `feedback:${kind}:${++localSequence.current}`;

            setLocalEvents((current) => [
                ...current,
                {
                    kind: 'local',
                    id,
                    sequence:
                        Math.max(
                            0,
                            ...(detail ? conversationEvents(detail).map((event) => event.sequence) : []),
                            ...current.map((event) => event.sequence),
                        ) + 0.001,
                    messages: [{role: 'assistant', text, createdAt: new Date().toISOString()}],
                },
            ]);
        }
    }, [notice, error, detail]);

    useEffect(() => {
        if (!detail && !localEvents.length) return;

        setHistorySaveFailed(
            !writeScheduleChat(transcriptKey, {
                conversationId: detail?.conversation.conversationId ?? transcriptConversation.current,
                events: localEvents,
                recoveredFailures: [...recoveredFailures.current],
                composer: {
                    editingEventId: editingRequest?.eventId ?? (!detail ? storedTranscript?.composer?.editingEventId : undefined),
                    previousId,
                    change,
                },
            }),
        );
    }, [transcriptKey, localEvents, detail, editingRequest, previousId, change]);

    useEffect(() => {
        if (!autofillFlow || !detail || autofillFlow.id === discardedPreparationId.current) return;

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
        if (
            !intentFirstEnabled ||
            !detail ||
            busy ||
            running ||
            !open ||
            preparing ||
            !adjustEnabled ||
            isAutofillBlocked ||
            localDirty ||
            editingRequest
        )
            return;

        const turn = detail.turns.find(
            (entry) => entry.interpretationId === detail.conversation.latestInterpretationId && entry.semanticPlan,
        );

        if (
            initialGenerationPending.current ||
            !turn?.interpretationId ||
            generationPlanIds.current.has(turn.interpretationId) ||
            !turn.semanticPlan?.autoExecutable ||
            Boolean(turn.semanticPlan.generationIntent) ||
            !isSemanticExecutionCurrent(detail, turn, false) ||
            detail.operations.some((operation) => operation.interpretationId === turn.interpretationId) ||
            sessionStorage.getItem(pendingKey)
        )
            return;

        const key = `${detail.conversation.conversationId}:${turn.semanticPlan.planHash}`;

        if (automaticAttempts.current.has(key)) return;

        automaticAttempts.current.add(key);
        void execute('ADJUST', undefined, turn.interpretationId);
    }, [intentFirstEnabled, detail, busy, running, open, preparing, adjustEnabled, isAutofillBlocked, localDirty, editingRequest]);

    useEffect(() => {
        if (!detail || busy || !open || preparing || generationRequest <= lastGeneration.current) return;

        lastGeneration.current = generationRequest;

        if (generationText.trim()) void interpret(generationText.trim(), undefined, true);
        else void execute('GENERATE', generationFillPolicy);
    }, [generationRequest, generationText, detail, busy, open, preparing, generationFillPolicy]);

    useEffect(() => {
        if (!initialGenerationPending.current || !detail || busy || !open || preparing || localDirty) return;

        const turn = detail.turns.find(
            (entry) => entry.interpretationId === detail.conversation.latestInterpretationId && entry.semanticPlan,
        );

        if (turn?.semanticPlan?.generationIntent) {
            initialGenerationPending.current = false;

            return;
        }

        if (
            !turn?.interpretationId ||
            !turn.semanticPlan?.autoExecutable ||
            !isSemanticExecutionCurrent(detail, turn, false) ||
            detail.operations.some((operation) => operation.interpretationId === turn.interpretationId)
        )
            return;

        generationPlanIds.current.add(turn.interpretationId);
        initialGenerationPending.current = false;
        void execute('GENERATE', generationFillPolicy, turn.interpretationId);
    }, [detail, busy, open, preparing, localDirty, generationFillPolicy]);

    useEffect(() => {
        if (rebuildRequest <= lastRebuild.current) return;

        lastRebuild.current = rebuildRequest;
        setRebuild(true);
    }, [rebuildRequest]);

    useEffect(() => {
        onBusyChange?.(executionBusy, executionSucceeded);
    }, [executionBusy, executionSucceeded, onBusyChange]);

    useEffect(() => {
        return () => onBusyChange?.(false);
    }, [onBusyChange]);

    useEffect(() => {
        if (autofillFlow?.kind === 'adjustment' || !preparing) return;

        setEntryChoice(null);
        setRebuild(false);
        setPreviousId(undefined);

        if (!preserveGenerationComposer.current) setText('');

        preserveGenerationComposer.current = false;
        setNotice(null);
        setPreview(null);
    }, [preparing, autofillFlow?.id]);

    const activeTurns = detail ? currentConversationTurns(detail) : [];
    const liveFeedbackIds = [
        ['notice', notice],
        ['error', error?.message],
    ].map(([kind, text]) =>
        text
            ? [...localEvents].reverse().find((event) => event.id.startsWith(`feedback:${kind}:`) && event.messages[0]?.text === text)?.id
            : undefined,
    );
    const visibleLocalEvents = localEvents.filter((event) => event.sequence > segmentStart && !liveFeedbackIds.includes(event.id));
    const canChooseNextAction = Boolean(
        detail &&
            ((executionSucceeded &&
                !activeTurns.some(
                    (turn) =>
                        turn.sequence > latestOperation.sequence &&
                        !!turn.interpretationId &&
                        !currentOperations.some((operation) => operation.interpretationId === turn.interpretationId),
                )) ||
                activeTurns.length === 0 ||
                visibleLocalEvents.some(
                    (event) =>
                        event.id.startsWith('preparation:') && event.sequence > Math.max(0, ...activeTurns.map((turn) => turn.sequence)),
                )),
    );
    const failureNeedsAction = Boolean(
        latestOperation &&
            operationFailure(latestOperation) &&
            dismissedFailureId !== latestOperation.operationId &&
            !detail?.turns.some((turn) => turn.sequence > latestOperation.sequence),
    );
    const failure = latestOperation ? operationFailure(latestOperation) : null;
    const canReviewFixedAfterFailure = Boolean(latestOperation?.operationType === 'GENERATE' && failure?.reviewFixed);

    useEffect(() => {
        if (
            !onRecoverGeneration ||
            !canReviewFixedAfterFailure ||
            !failureNeedsAction ||
            !latestOperation ||
            !open ||
            loading ||
            preparing ||
            busy ||
            running ||
            awaitingAdjustment ||
            error ||
            entryChoice ||
            text.trim() ||
            recoveredFailures.current.has(latestOperation.operationId)
        )
            return;

        // Open a review once, never a calculation. Refreshing the failed record
        // or closing its preparation must not start another attempt.
        recoveredFailures.current.add(latestOperation.operationId);
        writeScheduleChat(transcriptKey, {
            conversationId: detail!.conversation.conversationId,
            events: localEvents,
            recoveredFailures: [...recoveredFailures.current],
            composer: {editingEventId: editingRequest?.eventId, previousId, change},
        });
        onRecoverGeneration();
    }, [
        onRecoverGeneration,
        canReviewFixedAfterFailure,
        failureNeedsAction,
        latestOperation,
        open,
        loading,
        preparing,
        busy,
        running,
        awaitingAdjustment,
        error,
        entryChoice,
        text,
    ]);

    // Once a request has an execution record, its preview is history. Further
    // actions belong to that execution's result or recovery controls.
    const executedInterpretationIds = new Set(detail?.operations.flatMap((op) => (op.interpretationId ? [op.interpretationId] : [])));
    const active = detail?.turns.find((turn) => turn.interpretationId === detail.conversation.latestInterpretationId);
    const reviewingPlan = Boolean(
        active?.semanticPlan &&
            active.interpretationId &&
            !executedInterpretationIds.has(active.interpretationId) &&
            detail &&
            isConversationConfirmationCurrent(detail, active, localDirty),
    );
    const composerHidden =
        preparing ||
        !detail ||
        failureNeedsAction ||
        entryChoice === 'regenerate' ||
        (reviewingPlan && !editingRequest && active?.semanticPlan?.state !== 'NEEDS_CLARIFICATION');
    const recoveryComposerFocus = useRef(false);

    useEffect(() => {
        if (!recoveryComposerFocus.current || composerHidden) return;

        recoveryComposerFocus.current = false;
        textarea.current?.focus();
    }, [composerHidden, entryChoice, editingRequest, error]);

    const reviseUnsentRequest = () => {
        const current = detailRef.current;
        const turn = current?.turns.find((entry) => entry.interpretationId === current.conversation.latestInterpretationId);
        const preservedText = text;

        if (turn) editRequest(turn);
        else setEntryChoice('modify');

        setText(preservedText || (current && turn ? requestTextForTurn(current, turn) : ''));
        setDismissedFailureId(latestOperation?.operationId ?? null);
        setError(null);
        recoveryComposerFocus.current = true;
    };
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
    const examplePeriod =
        dayOf(0) === dayOf(4)
            ? t('aiConversationSidebar.exampleDay', {day: dayOf(0)})
            : t('aiConversationSidebar.exampleDayRange', {start: dayOf(0), end: dayOf(4)});
    const requestExamples =
        exampleFirst && doc.columns.length
            ? [
                  ...(exampleWork
                      ? [
                            t('aiConversationSidebar.exampleNoShifts', {
                                name: exampleFirst,
                                period: examplePeriod,
                                shift: exampleWork.shortName,
                            }),
                        ]
                      : []),
                  ...(exampleOff
                      ? [
                            t('aiConversationSidebar.exampleAssignShift', {
                                name: exampleSecond,
                                day: dayOf(11),
                                shift: exampleOff.shortName,
                            }),
                        ]
                      : []),
                  ...(exampleDayWork
                      ? [
                            t('aiConversationSidebar.exampleAssignShift', {
                                name: exampleFirst,
                                day: dayOf(14),
                                shift: exampleDayWork.shortName,
                            }),
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
            active.interpretationId &&
            !executedInterpretationIds.has(active.interpretationId) &&
            isConversationConfirmationCurrent(detail, active, localDirty) &&
            !incomplete,
    );
    const showNextActions = Boolean(
        detail &&
            canChooseNextAction &&
            !failureNeedsAction &&
            (autofillFlow?.id === discardedPreparationId.current || autofillFlow?.status !== 'paused') &&
            !preparing &&
            !entryChoice &&
            !awaitingAdjustment &&
            !running &&
            !busy &&
            !error,
    );
    const attachNextActions = showNextActions && executionSucceeded;
    const hasGeneratedAssignments = Boolean(
        detail?.operations.some((operation) => operation.applyStatus === 'APPLIED' && !operationFailure(operation)) &&
            doc.rows.some((row) =>
                row.cells.some(
                    (cell, column) =>
                        cell != null &&
                        !doc.fixedCells[`${row.workerId}|${doc.columns[column]}`] &&
                        !doc.requestCells[`${row.workerId}|${doc.columns[column]}`],
                ),
            ),
    );
    const chooseNextAction = (choice: TConversationEntryChoice) => {
        if (!detail || busy || running || awaitingAdjustment || preparing) return;

        if (choice === 'edit') {
            setEntryChoice(null);
            (onEditSchedule ?? onClose)();

            return;
        }

        if (isAutofillBlocked) return;

        if (choice === 'modify' && !adjustEnabled) return;

        if (choice === 'regenerate') preserveGenerationComposer.current = entryChoice === 'modify';

        setEntryChoice(choice);
        setLocalEvents((current) => [
            ...current,
            {
                kind: 'local',
                id: `choice:${++localSequence.current}`,
                sequence:
                    Math.max(0, ...conversationEvents(detail).map((event) => event.sequence), ...current.map((event) => event.sequence)) +
                    0.001,
                messages: [
                    {role: 'user', text: t(`aiAdjust.chat.${choice}`), createdAt: new Date().toISOString()},
                    ...(choice === 'modify'
                        ? [{role: 'assistant' as const, text: t('aiAdjust.chat.askChanges'), createdAt: new Date().toISOString()}]
                        : []),
                ],
            },
        ]);

        if (choice === 'regenerate') {
            trackScheduleSignal('regeneration_selected');

            if (onPrepareGeneration) onPrepareGeneration();
            else setRebuild(true);
        } else textarea.current?.focus();
    };
    const settingsHrefFor = (operation: TConversationOperation) => {
        const failure = operationFailure(operation);

        return failure?.recovery === 'settings' || failure?.settingsTarget === 'member'
            ? `${ROUTE.MEMBER}?shiftTeamId=${teamId}`
            : undefined;
    };
    const openConflictSettings = (_operation: TConversationOperation) => conditionsEditor.current?.openConditions();
    const renderAuthoringActions = (operation: TConversationOperation) => {
        if (!detail) return null;

        return (
            <>
                {operation.result?.authoringOutcome && operation.applyStatus === 'APPLIED' && operation.result.changedCells.length > 0 && (
                    <button
                        type="button"
                        className={buttonClass}
                        disabled={busy || running || localDirty || detail.conversation.currentVersionId !== operation.resultVersionId}
                        onClick={() => void undoOperation(operation)}
                    >
                        {t('aiConversationSidebar.authoring.undo')}
                    </button>
                )}
            </>
        );
    };
    const renderTurn = (turn: TConversationTurn) => {
        if (turn.type === 'SEGMENT_START')
            return (
                <div role="separator" className="my-5 flex items-center gap-3 text-xs text-[#667085]">
                    <span className="h-px flex-1 bg-gray-6" />
                    <span>
                        {turn.text === 'SAVED_RESULT'
                            ? t('aiConversationSidebar.newRequestsSelectedResult')
                            : t('aiConversationSidebar.newRequestsCurrentSchedule')}
                    </span>
                    <span className="h-px flex-1 bg-gray-6" />
                </div>
            );

        const previousRun = detail && precedingCompletedOperation(detail, turn);
        const Message = turn.actor === 'USER' ? UserMessage : AssistantMessage;
        const currentRequest = Boolean(
            turn.interpretationId &&
                turn.interpretationId === detail?.conversation.latestInterpretationId &&
                !executedInterpretationIds.has(turn.interpretationId),
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
                            {t('aiConversationSidebar.followupAfterRun', {
                                operation:
                                    previousRun.operationType === 'GENERATE'
                                        ? t('aiConversationSidebar.autofill')
                                        : t('aiConversationSidebar.adjustment'),
                                count: operationAttempt(detail, previousRun.operationId),
                            })}
                        </span>
                        <span className="h-px flex-1 bg-gray-6" />
                    </div>
                )}
                <Message {...(turn.actor !== 'USER' && turn.semanticPlan ? {fullWidth: true} : {})}>
                    {turn.text && detail && <p className="whitespace-pre-wrap">{conversationTurnText(detail, turn)}</p>}
                    {turn.semanticPlan && (
                        <AiSemanticReview
                            plan={turn.semanticPlan}
                            current={currentRequest}
                            disabled={
                                busy || running || awaitingAdjustment || Boolean(editingRequest) || !adjustEnabled || isAutofillBlocked
                            }
                            applied={Boolean(applied)}
                            stale={!detail || !isConversationConfirmationCurrent(detail, turn, localDirty)}
                            rosterNurseIds={Object.values(doc.workerMeta).flatMap((meta) =>
                                typeof meta.nurseId === 'number' ? [meta.nurseId] : [],
                            )}
                            nurseName={(id) =>
                                Object.values(doc.workerMeta).find((meta) => meta.nurseId === id)?.name ??
                                t('aiConversationSidebar.nurseUnavailable')
                            }
                            copy={copy}
                            onChangeModalities={(overrides) => changeModalities(turn, overrides)}
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
                                nurses={doc.rows
                                    .map(({workerId}) => doc.workerMeta[workerId])
                                    .filter((meta) => meta.nurseId !== undefined)
                                    .map((meta) => ({nurseId: meta.nurseId!, name: meta.name, divisionName: meta.divisionName}))}
                                showDetails={false}
                            />
                            {turn.interpretation.items?.some((item) => item.requiresConfirmation) && (
                                <p className="text-red">{t('aiConversationSidebar.clarifyTargetOrValue')}</p>
                            )}
                            {currentRequest && (
                                <ConversationConfirmation
                                    key={turn.interpretationId ?? turn.eventId}
                                    items={turn.interpretation.items ?? []}
                                    nurses={doc.rows
                                        .map(({workerId}) => doc.workerMeta[workerId])
                                        .filter((meta) => meta.nurseId !== undefined)
                                        .map((meta) => ({nurseId: meta.nurseId!, name: meta.name, divisionName: meta.divisionName}))}
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
                            {currentRequest ? (
                                <p className="mt-3">{t('aiAdjust.chat.applyQuestion')}</p>
                            ) : (
                                <p className="mt-2 text-xs text-[#475467]">{t('aiConversationSidebar.previousInterpretation')}</p>
                            )}
                            {localDirty && currentRequest && <p role="status">{t('aiConversationSidebar.draftChangedReview')}</p>}
                        </>
                    )}
                </Message>
                {turn.interpretation && currentRequest && (
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
                data-loading={loading}
                aria-label={t('aiAdjust.title')}
                aria-hidden={!open}
                inert={!open}
                onKeyDown={(event) => {
                    event.stopPropagation();

                    if (event.key === 'Escape') onClose();
                }}
                onPaste={(event) => event.stopPropagation()}
                className={`ai-adjust-sidebar fixed top-0 right-0 z-[1400] flex h-dvh w-[407px] max-w-full flex-col bg-white ${open ? '' : 'hidden'}`}
            >
                <AiConversationHeader
                    onNewRequest={() => void newConversation()}
                    onClose={onClose}
                    disabled={busy || running || awaitingAdjustment || !detail || preparing}
                />
                <div className="flex min-h-0 flex-1 flex-col px-[25px] pb-5">
                    <div className="mb-1 shrink-0">
                        <AiActiveConditions
                            hideTrigger
                            ref={conditionsEditor}
                            wardId={wardId}
                            teamId={teamId}
                            year={year}
                            month={month}
                            available={open && !loading && !preparing && !running}
                            wardRules={activeConditions.wardRules}
                            aiConditions={aiConditions}
                            loading={activeConditions.loading}
                            error={activeConditions.error}
                            onRetry={async () => {
                                await activeConditions.reload();

                                if (conditionsContextInvalid) await refresh();
                            }}
                            disabled={conditionsDisabled}
                            onWardRulesApplied={async () => {
                                await activeConditions.refreshAfterRuleChange();
                                setNotice(t('aiConversationSidebar.conditionsSaved'));
                            }}
                            onBusyChange={setConditionEditorBusy}
                        />
                    </div>
                    {polling.issue && (
                        <AiFailureMessage message={t(`aiAdjust.polling.${polling.issue}`)}>
                            <button className={buttonClass} onClick={polling.retry}>
                                {t('aiConversationSidebar.checkOutcomeAgain')}
                            </button>
                        </AiFailureMessage>
                    )}
                    {notice && (
                        <div role="status" className="mb-2 space-y-2 text-sm">
                            <p>{notice}</p>
                            {notice === t('aiConversationSidebar.conditionsSaved') &&
                                latestOperation?.operationType === 'GENERATE' &&
                                operationFailure(latestOperation) && (
                                    <button
                                        type="button"
                                        className={buttonClass}
                                        disabled={conditionsDisabled || isAutofillBlocked}
                                        onClick={() => {
                                            setNotice(null);

                                            if (onPrepareGeneration) onPrepareGeneration();
                                            else setRebuild(true);
                                        }}
                                    >
                                        {t('aiConversationSidebar.retryWithUpdatedConditions')}
                                    </button>
                                )}
                        </div>
                    )}
                    <AiChatScroll
                        key={`${detail?.conversation.conversationId ?? 'loading'}:${segmentStart}`}
                        historyKey={chatKey && detail ? `${chatKey}:scroll:${detail.conversation.conversationId}:${segmentStart}` : null}
                        ready={Boolean(detail)}
                        open={open}
                        composerHidden={composerHidden}
                        className="min-h-0 flex-1 overflow-y-auto overscroll-contain py-2"
                        contentClassName="space-y-3"
                    >
                        {!detail && !error && <AiConversationLoadingPlaceholder label={t('aiConversationSidebar.loadingConversation')} />}
                        {segmentStart === 0 &&
                            earlierConversations.map((conversation) => (
                                <AiConversationHistory
                                    key={conversation.conversationId}
                                    conversation={conversation}
                                    load={api.detail}
                                    onView={(op) => void view(op)}
                                    copy={copy}
                                />
                            ))}
                        {detail &&
                            [...conversationEvents({...detail, turns: activeTurns, operations: currentOperations}), ...visibleLocalEvents]
                                .sort((a, b) => a.sequence - b.sequence)
                                .filter(
                                    (event) =>
                                        event.kind !== 'turn' ||
                                        event.turn.actor !== 'ASSISTANT' ||
                                        !event.turn.interpretationId ||
                                        !executedInterpretationIds.has(event.turn.interpretationId),
                                )
                                .map((event) =>
                                    event.kind === 'local' ? (
                                        event.id.startsWith('feedback:error:') ? (
                                            <div key={event.id}>
                                                <AiFailureMessage message={event.messages[0]?.text ?? ''} announce={false} />
                                                <AiConversationTimestamp createdAt={event.messages[0]?.createdAt} />
                                            </div>
                                        ) : (
                                            <AiAutofillMessages key={event.id} messages={event.messages} />
                                        )
                                    ) : event.kind === 'turn' ? (
                                        <div key={event.id} inert={preparing}>
                                            {renderTurn(event.turn)}
                                            <AiConversationTimestamp
                                                createdAt={event.turn.createdAt}
                                                align={event.turn.actor === 'USER' ? 'right' : 'left'}
                                            />
                                        </div>
                                    ) : event.operation.executionStatus === 'SUCCEEDED' && !operationFailure(event.operation) ? (
                                        <JourneyObserved key={event.id} observation={event.operation.result?.observation} inert={preparing}>
                                            <AiConversationResult
                                                operation={event.operation}
                                                appliedLocally={
                                                    !localDirty && detail.conversation.currentVersionId === event.operation.resultVersionId
                                                }
                                                attempt={operationAttempt(detail, event.operation.operationId)}
                                                changeSummary={
                                                    event.operation.applyStatus === 'APPLIED' &&
                                                    !localDirty &&
                                                    detail.conversation.currentVersionId === event.operation.resultVersionId &&
                                                    event.operation.result?.changedCells.length ? (
                                                        <AiConversationChanges
                                                            key={`${event.operation.operationId}:${event.operation.resultVersionId}`}
                                                            changedCells={event.operation.result.changedCells}
                                                            sourceVersionId={event.operation.sourceVersionId}
                                                            loadVersion={api.version}
                                                            nurseName={(id) => doc.workerMeta[String(id)]?.name ?? String(id)}
                                                            label={t('aiConversationSidebar.actualChanges')}
                                                            locale={i18n.language}
                                                        />
                                                    ) : undefined
                                                }
                                                copy={copy}
                                                actions={
                                                    attachNextActions && event.operation.operationId === latestOperation?.operationId ? (
                                                        <AiConversationEntry
                                                            choice={null}
                                                            hideIntro
                                                            attached
                                                            disabled={busy || running}
                                                            modifyDisabled={!adjustEnabled || isAutofillBlocked}
                                                            onChoose={chooseNextAction}
                                                        />
                                                    ) : undefined
                                                }
                                            >
                                                {['GENERATE', 'ADJUST'].includes(event.operation.operationType) &&
                                                    !!event.operation.result?.changedCells.length &&
                                                    event.operation.operationId === latestOperation?.operationId &&
                                                    event.operation.result?.observation &&
                                                    event.operation.result.observation.serverEventId ===
                                                        lastAppliedScheduleObservation(wardId, teamId, year, month)?.serverEventId && (
                                                        <AiResultSatisfaction
                                                            key={event.operation.result.observation.serverEventId}
                                                            observation={event.operation.result.observation}
                                                            available={open && !preparing}
                                                            disabled={busy || running || preparing}
                                                        />
                                                    )}
                                                {renderAuthoringActions(event.operation)}
                                                {event.operation.result?.conflictReview && (
                                                    <ConstraintConflictReview
                                                        review={event.operation.result.conflictReview}
                                                        onEditSettings={
                                                            settingsHrefFor(event.operation)
                                                                ? undefined
                                                                : () => openConflictSettings(event.operation)
                                                        }
                                                        settingsHref={settingsHrefFor(event.operation)}
                                                        requestSummary={
                                                            detail.turns.find(
                                                                (turn) => turn.interpretationId === event.operation.interpretationId,
                                                            )?.semanticPlan?.summary
                                                        }
                                                        copy={copy}
                                                        disabled={busy || running}
                                                        current={
                                                            !localDirty &&
                                                            event.operation.baseRevision === detail.conversation.revision &&
                                                            event.operation.operationId === latestOperation?.operationId
                                                        }
                                                        onProceed={() =>
                                                            execute(
                                                                event.operation.operationType as 'GENERATE' | 'ADJUST',
                                                                event.operation.fillPolicy === 'REBUILD_UNLOCKED'
                                                                    ? 'REBUILD_UNLOCKED'
                                                                    : 'EMPTY_ONLY',
                                                                event.operation.interpretationId ?? undefined,
                                                                undefined,
                                                                event.operation,
                                                            )
                                                        }
                                                        onRevise={() => {
                                                            setDismissedFailureId(event.operation.operationId);
                                                            setEntryChoice('modify');

                                                            const turn = detail.turns.find(
                                                                (entry) => entry.interpretationId === event.operation.interpretationId,
                                                            );

                                                            if (turn) editRequest(turn);
                                                            else {
                                                                setText('');
                                                                textarea.current?.focus();
                                                            }
                                                        }}
                                                    />
                                                )}
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
                                            </AiConversationResult>
                                            <AiConversationTimestamp createdAt={event.operation.createdAt} />
                                        </JourneyObserved>
                                    ) : operationFailure(event.operation) ? (
                                        <div key={event.id} inert={preparing}>
                                            <AiExecutionFailure
                                                attemptLabel={t('aiConversationSidebar.runAttempt', {
                                                    count: operationAttempt(detail, event.operation.operationId),
                                                })}
                                                operationType={event.operation.operationType}
                                                failure={operationFailure(event.operation)!}
                                                detailsInChildren={Boolean(event.operation.result?.conflictReview)}
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
                                                    detail.turns.some((turn) => turn.interpretationId === event.operation.interpretationId)
                                                        ? () => {
                                                              if (event.operation.operationType === 'GENERATE') {
                                                                  if (onPrepareGeneration) onPrepareGeneration();
                                                                  else setRebuild(true);
                                                              } else {
                                                                  const turn = detail.turns.find(
                                                                      (turn) => turn.interpretationId === event.operation.interpretationId,
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
                                                                  (entry) => entry.interpretationId === event.operation.interpretationId,
                                                              );

                                                              if (turn?.semanticPlan) editRequest(turn);
                                                          }
                                                        : undefined
                                                }
                                                onReview={
                                                    event.operation === latestOperation && canReviewFixedAfterFailure && onRecoverGeneration
                                                        ? onRecoverGeneration
                                                        : (onOpenConstraints ?? onClose)
                                                }
                                                reviewLabel={
                                                    event.operation === latestOperation && canReviewFixedAfterFailure && onRecoverGeneration
                                                        ? t('aiAdjust.preparation.reviewFixed')
                                                        : undefined
                                                }
                                                onInspectSchedule={onClose}
                                                settingsHref={settingsHrefFor(event.operation)}
                                                onEditSettings={
                                                    settingsHrefFor(event.operation)
                                                        ? undefined
                                                        : () => openConflictSettings(event.operation)
                                                }
                                            >
                                                {event.operation.applyStatus === 'NOT_APPLIED_SOURCE_CHANGED' && (
                                                    <p>{t('aiConversationSidebar.sourceChangedNotApplied')}</p>
                                                )}
                                                {renderAuthoringActions(event.operation)}
                                                {event.operation.result?.conflictReview && (
                                                    <ConstraintConflictReview
                                                        review={event.operation.result.conflictReview}
                                                        onEditSettings={
                                                            settingsHrefFor(event.operation)
                                                                ? undefined
                                                                : () => openConflictSettings(event.operation)
                                                        }
                                                        settingsHref={settingsHrefFor(event.operation)}
                                                        requestSummary={
                                                            detail.turns.find(
                                                                (turn) => turn.interpretationId === event.operation.interpretationId,
                                                            )?.semanticPlan?.summary
                                                        }
                                                        copy={copy}
                                                        disabled={busy || running}
                                                        current={
                                                            !localDirty &&
                                                            event.operation.baseRevision === detail.conversation.revision &&
                                                            event.operation.operationId === latestOperation?.operationId
                                                        }
                                                        onProceed={() =>
                                                            execute(
                                                                event.operation.operationType as 'GENERATE' | 'ADJUST',
                                                                event.operation.fillPolicy === 'REBUILD_UNLOCKED'
                                                                    ? 'REBUILD_UNLOCKED'
                                                                    : 'EMPTY_ONLY',
                                                                event.operation.interpretationId ?? undefined,
                                                                undefined,
                                                                event.operation,
                                                            )
                                                        }
                                                        onRevise={() => {
                                                            setDismissedFailureId(event.operation.operationId);
                                                            setEntryChoice('modify');

                                                            const turn = detail.turns.find(
                                                                (entry) => entry.interpretationId === event.operation.interpretationId,
                                                            );

                                                            if (turn) editRequest(turn);
                                                            else {
                                                                setText('');
                                                                textarea.current?.focus();
                                                            }
                                                        }}
                                                    />
                                                )}
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
                                            </AiExecutionFailure>
                                            <AiConversationTimestamp createdAt={event.operation.createdAt} />
                                        </div>
                                    ) : (
                                        <div key={event.id} className="space-y-3">
                                            <JourneyObserved
                                                observation={event.operation.result?.observation}
                                                inert={preparing}
                                                className={
                                                    isConversationOperationPending(event.operation)
                                                        ? 'rounded-2xl bg-[#F7F5FF] p-4'
                                                        : 'rounded-xl bg-[#F7F8FA] p-3'
                                                }
                                            >
                                                <AiConversationOperationStatus
                                                    operation={event.operation}
                                                    attempt={operationAttempt(detail, event.operation.operationId)}
                                                    copy={copy}
                                                />
                                                {event.operation.executionStatus === 'UNKNOWN' && (
                                                    <div className="mt-3 space-y-2">
                                                        <p className="text-[13px] leading-6 text-[#475467]">
                                                            {t('aiConversationSidebar.outcomeUnconfirmed')}
                                                        </p>
                                                        <button className={buttonClass} onClick={() => void retryPending()}>
                                                            {t('aiConversationSidebar.checkOutcome')}
                                                        </button>
                                                    </div>
                                                )}
                                                {event.operation.applyStatus === 'NOT_APPLIED_SOURCE_CHANGED' && (
                                                    <p>{t('aiConversationSidebar.sourceChangedNotApplied')}</p>
                                                )}
                                                {renderAuthoringActions(event.operation)}
                                                {event.operation.result?.conflictReview && (
                                                    <ConstraintConflictReview
                                                        review={event.operation.result.conflictReview}
                                                        onEditSettings={
                                                            settingsHrefFor(event.operation)
                                                                ? undefined
                                                                : () => openConflictSettings(event.operation)
                                                        }
                                                        settingsHref={settingsHrefFor(event.operation)}
                                                        requestSummary={
                                                            detail.turns.find(
                                                                (turn) => turn.interpretationId === event.operation.interpretationId,
                                                            )?.semanticPlan?.summary
                                                        }
                                                        copy={copy}
                                                        disabled={busy || running}
                                                        current={
                                                            !localDirty &&
                                                            event.operation.baseRevision === detail.conversation.revision &&
                                                            event.operation.operationId === latestOperation?.operationId
                                                        }
                                                        onProceed={() =>
                                                            execute(
                                                                event.operation.operationType as 'GENERATE' | 'ADJUST',
                                                                event.operation.fillPolicy === 'REBUILD_UNLOCKED'
                                                                    ? 'REBUILD_UNLOCKED'
                                                                    : 'EMPTY_ONLY',
                                                                event.operation.interpretationId ?? undefined,
                                                                undefined,
                                                                event.operation,
                                                            )
                                                        }
                                                        onRevise={() => {
                                                            setDismissedFailureId(event.operation.operationId);
                                                            setEntryChoice('modify');

                                                            const turn = detail.turns.find(
                                                                (entry) => entry.interpretationId === event.operation.interpretationId,
                                                            );

                                                            if (turn) editRequest(turn);
                                                            else {
                                                                setText('');
                                                                textarea.current?.focus();
                                                            }
                                                        }}
                                                    />
                                                )}
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
                                            </JourneyObserved>
                                            <AiConversationTimestamp createdAt={event.operation.createdAt} />
                                        </div>
                                    ),
                                )}
                        {rebuild && (
                            <AssistantMessage showTime>
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
                                        {t('aiConversationSidebar.cancel')}
                                    </button>
                                </div>
                            </AssistantMessage>
                        )}
                        {(historySaveFailed || composerSaveFailed) && (
                            <p role="status" className="text-xs text-[#667085]">
                                {t('aiAdjust.preparation.historyUnavailable')}
                            </p>
                        )}
                        {preparation && <div aria-live="polite">{preparation}</div>}
                        {showNextActions &&
                            (attachNextActions ? (
                                resultActions &&
                                !failure && (
                                    <AiConversationConfirmation
                                        confirmation={{...resultActions, disabled: Boolean(resultActions.disabled) || busy || running}}
                                    />
                                )
                            ) : (
                                <AiConversationEntry
                                    choice={null}
                                    hasSchedule={hasGeneratedAssignments}
                                    hideIntro={Boolean(activeTurns.length || currentOperations.length || localEvents.length)}
                                    disabled={busy || running || isAutofillBlocked}
                                    modifyDisabled={!adjustEnabled}
                                    confirmation={
                                        !failure && resultActions
                                            ? {...resultActions, disabled: Boolean(resultActions.disabled) || busy || running}
                                            : undefined
                                    }
                                    onChoose={chooseNextAction}
                                />
                            ))}
                        {!composerHidden && !editingRequest && !activeTurns.length && !text.trim() && !!requestExamples.length && (
                            <section aria-label={t('aiAdjust.examples')} className="ai-adjust-examples flex min-w-0 flex-col gap-2 pt-3">
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
                        {detail && (busy || awaitingAdjustment) && !executionBusy && !preparing && (
                            <AiConversationLoading
                                className="rounded-[12px] bg-[#F5F2FC] px-4 py-3"
                                label={
                                    awaitingAdjustment
                                        ? t('aiConversationSidebar.preparingChanges')
                                        : activity === 'reviewing'
                                          ? t('aiConversationSidebar.reviewingRequest')
                                          : activity === 'viewing'
                                            ? t('aiConversationSidebar.loadingSchedule')
                                            : activity === 'recovering'
                                              ? t('aiConversationSidebar.checkingResult')
                                              : activity === 'sending'
                                                ? t('aiConversationSidebar.sendingFeedback')
                                                : t('aiConversationSidebar.updatingChanges')
                                }
                            />
                        )}
                        {error && (
                            <AiFailureMessage message={error.message}>
                                {error.unsentOperation && (
                                    <div className="flex flex-wrap gap-2">
                                        {error.canRetryGeneration && (
                                            <button
                                                type="button"
                                                className={buttonClass}
                                                disabled={conditionsDisabled || isAutofillBlocked}
                                                onClick={() =>
                                                    void execute('GENERATE', 'EMPTY_ONLY', undefined, undefined, undefined, true)
                                                }
                                            >
                                                {t('aiConversationSidebar.retryCurrentSchedule')}
                                            </button>
                                        )}
                                        <button
                                            type="button"
                                            className={buttonClass}
                                            disabled={conditionsDisabled}
                                            onClick={reviseUnsentRequest}
                                        >
                                            {t(
                                                error.unsentOperation === 'ADJUST'
                                                    ? 'aiConversationSidebar.adjustCurrentSchedule'
                                                    : 'aiConversationSidebar.reviseUnsentRequest',
                                            )}
                                        </button>
                                        <button type="button" className={buttonClass} disabled={busy || running} onClick={onClose}>
                                            {t('aiConversationSidebar.editScheduleDirectly')}
                                        </button>
                                    </div>
                                )}
                                {!error.blocked && error.checkOutcome !== false && (
                                    <button className={buttonClass} disabled={busy} onClick={() => void retryPending()}>
                                        {t('aiConversationSidebar.checkExecutionHistory')}
                                    </button>
                                )}
                            </AiFailureMessage>
                        )}
                    </AiChatScroll>
                    {selectedSuggestion && (
                        <section className="rounded-xl bg-gray-7 p-3" aria-label={t('aiConversationSidebar.reviewSuggestion')}>
                            <p>{t('aiAdjust.chat.applyQuestion')}</p>
                            <ConversationSuggestionChanges suggestion={selectedSuggestion.suggestion} />
                            <button className={buttonClass} disabled={busy} onClick={() => setSelectedSuggestion(undefined)}>
                                {t('aiConversationSidebar.cancel')}
                            </button>
                            <button
                                className={buttonClass}
                                disabled={busy || running || localDirty}
                                onClick={() => {
                                    const selected = selectedSuggestion;

                                    void execute('ADJUST', undefined, selected.op.interpretationId ?? undefined, selected);
                                }}
                            >
                                {t('aiConversationSidebar.applySuggestedChanges')}
                            </button>
                        </section>
                    )}
                    {open && preview && (
                        <AiConversationSnapshot
                            version={preview.version}
                            loadBefore={preview.sourceVersionId ? loadPreviewSource : undefined}
                            returnFocusTo={preview.returnFocusTo}
                            disabled={busy || running}
                            currentVersionId={localDirty ? undefined : detail?.conversation.currentVersionId}
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
                                {t('aiConversationSidebar.openSavedBranch')}
                            </button>
                        )}
                        <div className={composerHidden ? 'hidden' : 'space-y-2'} inert={composerHidden} aria-hidden={composerHidden}>
                            {detail?.conversationState?.pendingQuestion && (
                                <p className="text-sm" role="status">
                                    {detail.conversationState.pendingQuestion.question}
                                </p>
                            )}
                            {editingRequest && <p className="text-[13px] text-[#6B7280]">{t('aiConversationSidebar.editChangesHint')}</p>}
                            <div className="ai-adjust-composer flex flex-col rounded-[14px] border-[1.8px] border-[#DCE2EB] bg-gray-7 px-4 py-3 focus-within:border-main-1 focus-within:bg-main-light">
                                <label className="block text-sm">
                                    <span className="sr-only">{t('aiConversationSidebar.yourChanges')}</span>
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
                                                      ? t('aiConversationSidebar.examplePlaceholder', {example: requestExamples[0]})
                                                      : t('aiConversationSidebar.describeChanges')
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
                                            {t('aiConversationSidebar.cancel')}
                                        </button>
                                    )}
                                    <button
                                        type="button"
                                        aria-label={editingRequest ? t('aiConversationSidebar.reviewChanges') : t('aiAdjust.send')}
                                        className="ml-auto grid size-11 shrink-0 place-items-center rounded-[10px] bg-main-1 hover:bg-[#5931B9] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-main-1 disabled:bg-gray-3"
                                        disabled={busy || running || !text.trim() || !adjustEnabled}
                                        onClick={() => void interpret()}
                                    >
                                        <img src={sendIcon} alt="" width={22} height={22} className="rotate-90" />
                                    </button>
                                </div>
                            </div>
                        </div>
                    </footer>
                </div>
            </aside>
        </>,
        document.body,
    );
}
