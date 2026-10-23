import {AiResultSatisfaction} from './ai-result-satisfaction';
import {ConstraintConflictReview} from './ai-constraint-conflict-review';
import {type ReactNode, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState} from 'react';
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
import {conversationOperationFailure as operationFailure} from '../../../model/ai-execution-failure';
import {isExecutionFinished, readPendingExecution} from '../../../model/conversation-pending-execution';
import {
    conversationTurnText,
    currentConversationTurns,
    operationAttempt,
    precedingCompletedOperation,
    requestTextForTurn,
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
import {lastAppliedScheduleObservation, reportScheduleJourney} from '../../../model/schedule-journey';
import {ScheduleReportAttempt, scheduleReportScope} from '../../../model/schedule-report-attempt';
import {useAiActiveConditions} from '../../../model/use-ai-active-conditions';
import {useConversationPolling} from '../../../model/use-conversation-polling';
import {AiActiveConditions} from './ai-active-conditions';
import {AiAdjustInterpretCard} from './ai-adjust-interpret-card';
import type {TAdjustResultActions} from './ai-adjust-result';
import {AiAdjustApplyChoices, AssistantMessage, UserMessage} from './ai-adjust-review-conversation';
import {AiAutofillMessages, type TAutofillFlow, type TAutofillMessage} from './ai-autofill-preparation';
import {AiChatScroll} from './ai-chat-scroll';
import {ConversationConfirmation} from './ai-conversation-confirmation';
import {AiConversationConfirmation, AiConversationEntry, type TConversationEntryChoice} from './ai-conversation-entry';
import {ConversationEvidence, ConversationSuggestionChanges, type TFailureSuggestion} from './ai-conversation-evidence';
import {AiConversationFeedbackButton} from './ai-conversation-feedback-button';
import {AiConversationFeedbackDialog} from './ai-conversation-feedback-dialog';
import {AiConversationHeader} from './ai-conversation-header';
import {AiConversationHistory} from './ai-conversation-history';
import {AiConversationImage} from './ai-conversation-image';
import {AiConversationLoading, AiConversationLoadingPlaceholder} from './ai-conversation-loading';
import {AiConversationOperationStatus, isConversationOperationPending} from './ai-conversation-operation-status';
import {AiConversationResult} from './ai-conversation-result';
import {AiConversationResultDetails} from './ai-conversation-result-details';
import AiConversationSnapshot from './ai-conversation-snapshot';
import {AiExecutionFailure} from './ai-execution-failure';
import {AiFailureMessage} from './ai-failure-message';
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
    onPrepareAdjustment?: () => Promise<void>;
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
    rebuildRequest: number;
    onApplied: () => void;
    onGenerated?: () => void;
    onBusyChange?: (busy: boolean, succeeded?: boolean) => void;
    resultActions?: TAdjustResultActions;
};
type TLocalEvent = {kind: 'local'; id: string; sequence: number; messages: TAutofillMessage[]};
type TPreview = {version: TResultVersion; sourceVersionId?: string; returnFocusTo: HTMLElement | null};
type TActivity = 'updating' | 'reviewing' | 'viewing' | 'recovering' | 'sending';

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
    loading = false,
    preparation,
    autofillFlow,
    onNewConversation,
    spotlightSelector,
    spotlightInteractive,
    onPrepareGeneration,
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
    const discardedPreparationId = useRef<number | null>(null);
    const localSequence = useRef(0);
    const textarea = useRef<HTMLTextAreaElement>(null);
    const api = useMemo(() => conversationApi(wardId, teamId), [wardId, teamId]);
    const commands = useShiftEditorCommands();
    const doc = useShiftEditorStore((s) => s.doc);
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
    const [text, setText] = useState('');
    const [editingRequest, setEditingRequest] = useState<TConversationTurn | null>(null);
    const [requestToolsOpen, setRequestToolsOpen] = useState(false);
    const [reportOperation, setReportOperation] = useState<string | null>(null);
    const [reportNote, setReportNote] = useState('');
    const [reportAttempt] = useState(() => new ScheduleReportAttempt());
    const [reportRecovery, setReportRecovery] = useState<boolean>();
    const [reportError, setReportError] = useState<string | null>(null);
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
    const reportTrigger = useRef<HTMLButtonElement | null>(null);
    const returnReportFocus = useRef(false);

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
        setReportError(null);
    };
    const [change, setChange] = useState<'REPLACE' | 'ADD' | 'RESET'>('ADD');
    const [conditionEdit, setConditionEdit] = useState<'ANSWER' | 'ADD' | 'UPDATE' | 'REMOVE' | 'RESET'>('ANSWER');
    const [conditionTargets, setConditionTargets] = useState<string[]>([]);
    const [previousId, setPreviousId] = useState<string>();
    const [preview, setPreview] = useState<TPreview | null>(null);
    const previewRequest = useRef(0);
    const sidebarOpen = useRef(open);
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
    const openResultReport = (operationId: string, trigger: HTMLButtonElement) => {
        reportAttempt.reset();
        setNotice((currentNotice) =>
            ['의견을 보냈어요. 확인해서 개선할게요.', 'Your feedback was sent. Thank you.'].includes(currentNotice ?? '')
                ? null
                : currentNotice,
        );
        setReportRecovery(undefined);
        setReportError(null);
        reportTrigger.current = trigger;
        setReportNote('');
        setReportOperation(operationId);
        trackScheduleSignal('feedback_open');
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
            setReportError(null);
            reportTrigger.current = null;
            setLocalEvents([]);
            setEditingRequest(null);
            setConditionEdit('ANSWER');
            setConditionTargets([]);
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
    const refresh = async () => {
        if (!detailRef.current) return;

        const conversationId = detailRef.current.conversation.conversationId;
        const next = await api.detail(conversationId);

        if (mounted.current && detailRef.current?.conversation.conversationId === conversationId) {
            install(next);
            setConditionsContextInvalid(false);
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
    const sendReport = () => {
        if (!reportOperation || !reportNote.trim()) return;

        const operationId = reportOperation;
        const note = reportNote.trim();

        void run(
            async () => {
                const current = detailRef.current;

                if (!current) return;

                setReportError(null);

                try {
                    const scope = reportScopeFor(current.conversation.conversationId, operationId);
                    const key = await reportAttempt.keyFor(scope, note);

                    if (!mounted.current) return;

                    if (scope !== reportScopeFor(current.conversation.conversationId, operationId))
                        throw new AiConversationInputError('staleRequest');

                    setReportRecovery(reportAttempt.recoverable);
                    await api.report(current.conversation.conversationId, operationId, note, key);

                    if (!mounted.current) return;

                    setNotice(copy('의견을 보냈어요. 확인해서 개선할게요.', 'Your feedback was sent. Thank you.'));
                    trackScheduleSignal('feedback_sent');
                    await closeReport(false);
                    setReportNote('');
                } catch {
                    if (mounted.current)
                        setReportError(
                            copy('의견을 보내지 못했어요. 다시 시도해 주세요.', 'Could not send your feedback. Please try again.'),
                        );
                }
            },
            false,
            'sending',
        );
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
        conflict?: TConversationOperation,
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
                ...(conflict?.result?.conflictReview
                    ? {conflictReviewToken: conflict.result.conflictReview.token, conflictConfirmed: true}
                    : {}),
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
    const selectConditions = async (turn: TConversationTurn, ids: string[]) => {
        await run(
            async () => {
                const current = detailRef.current;

                if (!current || !turn.semanticPlan || !isConversationConfirmationCurrent(current, turn, localDirty))
                    throw new Error(t('aiAdjust.stale'));

                await api.selectConditions(
                    current.conversation.conversationId,
                    turn.semanticPlan.planId,
                    current.conversation.revision,
                    turn.semanticPlan.planHash,
                    ids,
                );
                await refresh();
            },
            false,
            'reviewing',
        );
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
                await onPrepareAdjustment();
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
                    plan.sourceVersionId !== synced.conversation.currentVersionId
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
                    JSON.stringify(reviewed.semanticPlan.selectionAudit) !== JSON.stringify(plan.selectionAudit)
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
                await execute('ADJUST', undefined, confirmedId);
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

        if (current.conversationState) {
            setConditionEdit('UPDATE');
            setConditionTargets(
                current.conversationState.conditions.length === 1 ? [current.conversationState.conditions[0].conditionId] : [],
            );
            setText('');
        } else setText(original);

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
            },
            false,
            'recovering',
        );
    const interpret = async (request = text, reference = previousId) => {
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
                    throw new Error(
                        copy(
                            '요청이 변경됐어요. 현재 조건을 확인한 뒤 다시 보내 주세요.',
                            'The request changed. Review current conditions before sending again.',
                        ),
                    );

                const original = !state && priorPlan && !editingRequest ? requestTextForTurn(current, priorPlan) : '';
                const marker = priorPlan?.semanticPlan?.state === 'NEEDS_CLARIFICATION' ? '추가 답변' : '추가 요청';
                const interpretedText = original && message !== original ? `${original}\n${marker}: ${message}` : message;

                if (interpretedText.length > 500) throw new AiConversationInputError('requestTooLong');

                const interpreted = await api
                    .interpret(current.conversation.conversationId, {
                        expectedRevision: current.conversation.revision,
                        text: interpretedText,
                        language: i18n.language,
                        ...(state
                            ? {
                                  expectedStateVersion: state.version,
                                  change:
                                      conditionEdit === 'ANSWER'
                                          ? state.pendingQuestion
                                              ? ('UPDATE' as const)
                                              : ('ADD' as const)
                                          : conditionEdit,
                                  targetConditionIds:
                                      conditionEdit === 'RESET' ||
                                      conditionEdit === 'ADD' ||
                                      (conditionEdit === 'ANSWER' && !state.pendingQuestion)
                                          ? []
                                          : state.pendingQuestion && conditionEdit === 'ANSWER'
                                            ? [state.pendingQuestion.conditionId]
                                            : conditionTargets,
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

                setText('');
                setEditingPreferenceId(undefined);
                setRequestToolsOpen(false);
                setEditingRequest(null);
                setPreviousId(interpreted.interpretationId ?? undefined);
                setChange('ADD');
                setConditionEdit('ANSWER');
                setConditionTargets([]);
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
        setConditionEdit('ANSWER');
        setConditionTargets([]);
        setText('');
        setEditingRequest(null);
        setRebuild(false);
        setPreview(null);
        setNotice(null);
        setPendingBranch(null);
        reportAttempt.reset();
        setReportOperation(null);
        setReportNote('');
        setReportRecovery(undefined);
        setReportError(null);
        reportTrigger.current = null;
        returnReportFocus.current = false;
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
    const conditionsDisabled = busy || running || awaitingAdjustment || preparing || loading || !detail;
    const removeCondition = async (conditionId: string) => {
        if (conditionsDisabled || busyRef.current || awaitingAdjustmentRef.current) throw new AiConversationInputError('loading');

        const reviewed = detailRef.current;
        const stateVersion = reviewed?.conversationState?.version;

        await run(
            async () => {
                reviewedPreparation.current = null;
                setSelectedSuggestion(undefined);

                const current = await sync();
                const state = current.conversationState;

                if (
                    !state ||
                    current.conversation.conversationId !== reviewed?.conversation.conversationId ||
                    state.version !== stateVersion ||
                    !state.conditions.some((condition) => condition.conditionId === conditionId)
                )
                    throw new AiConversationInputError('staleRequest');

                try {
                    const interpreted = await api.interpret(current.conversation.conversationId, {
                        expectedRevision: current.conversation.revision,
                        expectedStateVersion: state.version,
                        change: 'REMOVE',
                        targetConditionIds: [conditionId],
                        text: copy('이 조건을 삭제해 주세요.', 'Remove this condition.'),
                        language: i18n.language,
                    });

                    if (!mounted.current || detailRef.current?.conversation.conversationId !== current.conversation.conversationId) return;

                    setPreviousId(interpreted.interpretationId ?? undefined);
                    setConditionEdit('ANSWER');
                    setConditionTargets([]);
                    setEditingRequest(null);
                    await refresh();

                    if (detailRef.current?.conversationState?.conditions.some((condition) => condition.conditionId === conditionId))
                        throw new AiConversationInputError('staleRequest');

                    if (detailRef.current?.conversationState?.conditions.length === 0) setEntryChoice('modify');
                } catch (cause) {
                    // Interpretation reserves the next state version even when parsing fails.
                    await refresh().catch(() => undefined);
                    throw cause;
                }
            },
            false,
            'updating',
            true,
        );
    };
    const aiConditions = [
        ...(detail?.conversationState?.conditions.map((condition) => ({
            id: `semantic:${condition.conditionId}`,
            label: condition.text,
            description: copy('현재 대화', 'Current conversation'),
            onRemove: () => removeCondition(condition.conditionId),
        })) ?? []),
        ...activeConditions.requests
            .filter((request) => request.promotedRuleId == null)
            .map((request) => ({
                id: `request:${request.id}`,
                label: request.displayLabel,
                description: copy('이번 달에 저장됨', 'Saved for this month'),
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
        onBusyChange?.(executionBusy, executionSucceeded);
    }, [executionBusy, executionSucceeded, onBusyChange]);

    useEffect(() => {
        return () => onBusyChange?.(false);
    }, [onBusyChange]);

    useEffect(() => {
        if (autofillFlow?.kind === 'adjustment' || (!preparing && !autofillFlow)) return;

        setEntryChoice(null);
        setRebuild(false);
        setPreviousId(undefined);
        setText('');
        setNotice(null);
        setPreview(null);
    }, [preparing, autofillFlow?.id]);

    const activeTurns = detail ? currentConversationTurns(detail) : [];
    const visibleLocalEvents = localEvents.filter((event) => event.sequence > segmentStart);
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
    const chooseNextAction = (choice: TConversationEntryChoice) => {
        if (!detail || busy || running || awaitingAdjustment || preparing || isAutofillBlocked) return;

        if (choice === 'modify' && !adjustEnabled) return;

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
                    {role: 'user', text: t(`aiAdjust.chat.${choice}`)},
                    ...(choice === 'modify' ? [{role: 'assistant' as const, text: t('aiAdjust.chat.askChanges')}] : []),
                ],
            },
        ]);

        if (choice === 'regenerate') {
            trackScheduleSignal('regeneration_selected');

            if (onPrepareGeneration) onPrepareGeneration();
            else setRebuild(true);
        } else textarea.current?.focus();
    };
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
                            {previousRun.operationType === 'GENERATE' ? copy('자동채우기', 'Autofill') : copy('수정', 'Adjustment')}{' '}
                            {operationAttempt(detail, previousRun.operationId)}
                            {copy('회차 이후 · 추가 요청', ' · follow-up request')}
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
                                copy('명단에서 확인되지 않은 간호사', 'Nurse unavailable in this roster')
                            }
                            copy={copy}
                            onChangeModalities={(overrides) => changeModalities(turn, overrides)}
                            onSelectConditions={(ids) => void selectConditions(turn, ids)}
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
                            {currentRequest && (
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
                            {currentRequest ? (
                                <p className="mt-3">{t('aiAdjust.chat.applyQuestion')}</p>
                            ) : (
                                <p className="mt-2 text-xs text-[#475467]">
                                    {copy(
                                        '이전 요청이에요. 새 요청에서 내용을 확인해 주세요.',
                                        'Previous interpretation · unavailable for execution',
                                    )}
                                </p>
                            )}
                            {localDirty && currentRequest && (
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
                            onWardRulesApplied={activeConditions.refreshAfterRuleChange}
                            onBusyChange={setConditionEditorBusy}
                        />
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
                        key={`${detail?.conversation.conversationId ?? 'loading'}:${segmentStart}`}
                        open={open}
                        composerHidden={composerHidden}
                        className="min-h-0 flex-1 overflow-y-auto overscroll-contain py-2"
                        contentClassName="space-y-3"
                    >
                        {!detail && !error && (
                            <AiConversationLoadingPlaceholder label={copy('대화 불러오는 중', 'Loading your conversation')} />
                        )}
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
                                .map((event) =>
                                    event.kind === 'local' ? (
                                        <AiAutofillMessages key={event.id} messages={event.messages} />
                                    ) : event.kind === 'turn' ? (
                                        <div key={event.id} inert={preparing}>
                                            {renderTurn(event.turn)}
                                        </div>
                                    ) : event.operation.executionStatus === 'SUCCEEDED' && !operationFailure(event.operation) ? (
                                        <JourneyObserved key={event.id} observation={event.operation.result?.observation} inert={preparing}>
                                            <AiConversationResult
                                                operation={event.operation}
                                                attempt={operationAttempt(detail, event.operation.operationId)}
                                                feedbackDisabled={busy || running || preparing || reportOperation !== null}
                                                copy={copy}
                                                preview={
                                                    event.operation.resultVersionId ? (
                                                        <AiConversationImage
                                                            key={event.operation.resultVersionId}
                                                            cacheKey={`${wardId}:${teamId}`}
                                                            versionId={event.operation.resultVersionId}
                                                            loadVersion={api.version}
                                                            onOpen={(trigger) => void view(event.operation, trigger)}
                                                            disabled={busy}
                                                        />
                                                    ) : undefined
                                                }
                                                actions={
                                                    attachNextActions && event.operation.operationId === latestOperation?.operationId ? (
                                                        <AiConversationEntry
                                                            choice={null}
                                                            hideIntro
                                                            attached
                                                            disabled={busy || running || isAutofillBlocked}
                                                            modifyDisabled={!adjustEnabled}
                                                            onChoose={chooseNextAction}
                                                        />
                                                    ) : undefined
                                                }
                                                onReport={(click) => openResultReport(event.operation.operationId, click.currentTarget)}
                                            >
                                                {event.operation.operationType === 'GENERATE' &&
                                                    event.operation.operationId === latestOperation?.operationId &&
                                                    event.operation.result?.observation &&
                                                    event.operation.result.observation.serverEventId ===
                                                        lastAppliedScheduleObservation(wardId, teamId, year, month)?.serverEventId && (
                                                        <AiResultSatisfaction
                                                            key={event.operation.result.observation.serverEventId}
                                                            observation={event.operation.result.observation}
                                                            disabled={busy || running || preparing}
                                                        />
                                                    )}
                                                {event.operation.result && <AiConversationResultDetails result={event.operation.result} />}
                                                {event.operation.result?.conflictReview && (
                                                    <ConstraintConflictReview
                                                        review={event.operation.result.conflictReview}
                                                        onEditSettings={onOpenConstraints ?? onClose}
                                                        requestSummary={detail.turns.find((turn) => turn.interpretationId === event.operation.interpretationId)?.semanticPlan?.summary}
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
                                        </JourneyObserved>
                                    ) : operationFailure(event.operation) ? (
                                        <div key={event.id} inert={preparing}>
                                            <AiExecutionFailure
                                                attemptLabel={copy(
                                                    `${operationAttempt(detail, event.operation.operationId)}회차`,
                                                    `Run ${operationAttempt(detail, event.operation.operationId)}`,
                                                )}
                                                headerAction={
                                                    ['FAILED', 'SUCCEEDED'].includes(event.operation.executionStatus) ? (
                                                        <AiConversationFeedbackButton
                                                            label={copy('이 결과에 의견 보내기', 'Send feedback on this result')}
                                                            disabled={busy || running || preparing || reportOperation !== null}
                                                            onClick={(click) =>
                                                                openResultReport(event.operation.operationId, click.currentTarget)
                                                            }
                                                        />
                                                    ) : undefined
                                                }
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
                                                onReview={onOpenConstraints ?? onClose}
                                            >
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
                                                        onOpen={(trigger) => void view(event.operation, trigger)}
                                                        disabled={busy}
                                                    />
                                                )}
                                                {event.operation.result && <AiConversationResultDetails result={event.operation.result} />}
                                                {event.operation.result?.conflictReview && (
                                                    <ConstraintConflictReview
                                                        review={event.operation.result.conflictReview}
                                                        onEditSettings={onOpenConstraints ?? onClose}
                                                        requestSummary={detail.turns.find((turn) => turn.interpretationId === event.operation.interpretationId)?.semanticPlan?.summary}
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
                                                            {copy(
                                                                '이전 요청의 결과를 아직 확인하지 못했어요. 새로 계산하지 않고 결과를 다시 확인할게요.',
                                                                'The server needs to confirm the outcome. This request will not run again.',
                                                            )}
                                                        </p>
                                                        <button className={buttonClass} onClick={() => void retryPending()}>
                                                            {copy('결과 다시 확인하기', 'Check outcome')}
                                                        </button>
                                                    </div>
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
                                                        onOpen={(trigger) => void view(event.operation, trigger)}
                                                        disabled={busy}
                                                    />
                                                )}
                                                {event.operation.result && <AiConversationResultDetails result={event.operation.result} />}
                                                {event.operation.result?.conflictReview && (
                                                    <ConstraintConflictReview
                                                        review={event.operation.result.conflictReview}
                                                        onEditSettings={onOpenConstraints ?? onClose}
                                                        requestSummary={detail.turns.find((turn) => turn.interpretationId === event.operation.interpretationId)?.semanticPlan?.summary}
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
                        {showNextActions &&
                            (attachNextActions ? (
                                resultActions && (
                                    <AiConversationConfirmation
                                        confirmation={{...resultActions, disabled: Boolean(resultActions.disabled) || busy || running}}
                                    />
                                )
                            ) : (
                                <AiConversationEntry
                                    choice={null}
                                    disabled={busy || running || isAutofillBlocked}
                                    modifyDisabled={!adjustEnabled}
                                    confirmation={
                                        resultActions && {...resultActions, disabled: Boolean(resultActions.disabled) || busy || running}
                                    }
                                    onChoose={chooseNextAction}
                                />
                            ))}
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
                        {detail && (busy || awaitingAdjustment) && !executionBusy && !preparing && !reportOperation && (
                            <AiConversationLoading
                                className="rounded-[12px] bg-[#F5F2FC] px-4 py-3"
                                label={
                                    awaitingAdjustment
                                        ? copy('수정 준비 중', 'Preparing your changes')
                                        : activity === 'reviewing'
                                          ? copy('요청 확인 중', 'Reviewing your request')
                                          : activity === 'viewing'
                                            ? copy('근무표 불러오는 중', 'Loading the schedule')
                                            : activity === 'recovering'
                                              ? copy('결과 확인 중', 'Checking the result')
                                              : activity === 'sending'
                                                ? copy('의견 보내는 중', 'Sending your feedback')
                                                : copy('변경 사항 반영 중', 'Updating your changes')
                                }
                            />
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
                    <AiConversationFeedbackDialog
                        open={open && reportOperation !== null}
                        target={
                            detail && reportOperation
                                ? copy(
                                      `${detail.operations.find((op) => op.operationId === reportOperation)?.operationType === 'GENERATE' ? '자동채우기' : '수정'} ${operationAttempt(detail, reportOperation)}회차 결과`,
                                      `${detail.operations.find((op) => op.operationId === reportOperation)?.operationType === 'GENERATE' ? 'Autofill' : 'Adjustment'} ${operationAttempt(detail, reportOperation)} result`,
                                  )
                                : ''
                        }
                        value={reportNote}
                        disabled={busy}
                        error={reportError}
                        retryHint={
                            reportError && reportRecovery === false
                                ? copy(
                                      '작성한 내용은 유지돼요. 이 창에서 다시 보내 주세요.',
                                      'Your feedback is still here. Please try sending it again from this window.',
                                  )
                                : null
                        }
                        returnFocusTo={open ? reportTrigger.current : null}
                        onChange={(value) => {
                            reportAttempt.noteChanged(value);
                            setReportNote(value);
                            setReportError(null);
                        }}
                        onSubmit={sendReport}
                        onClose={() => void run(closeReport)}
                    />
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
                    {open && preview && (
                        <AiConversationSnapshot
                            version={preview.version}
                            loadBefore={preview.sourceVersionId ? loadPreviewSource : undefined}
                            returnFocusTo={preview.returnFocusTo}
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
                            {detail?.conversationState &&
                                !(
                                    detail.conversationState.conditions.length === 0 &&
                                    active?.semanticPlan?.reasonCodes.includes('EMPTY_CONDITIONS')
                                ) && (
                                    <fieldset className="space-y-2 rounded border p-2 text-sm" disabled={busy || running}>
                                        <legend>{copy('현재 요청 조건', 'Current request conditions')}</legend>
                                        {detail.conversationState.pendingQuestion && (
                                            <p>{detail.conversationState.pendingQuestion.question}</p>
                                        )}
                                        {detail.conversationState.conditions.map((condition) => (
                                            <label key={condition.conditionId} className="flex items-start gap-2">
                                                <input
                                                    type="checkbox"
                                                    checked={conditionTargets.includes(condition.conditionId)}
                                                    onChange={(event) =>
                                                        setConditionTargets((ids) =>
                                                            event.target.checked
                                                                ? [...ids, condition.conditionId]
                                                                : ids.filter((id) => id !== condition.conditionId),
                                                        )
                                                    }
                                                />
                                                <span>{condition.text}</span>
                                            </label>
                                        ))}
                                        <select
                                            aria-label={copy('조건 수정 방식', 'Condition edit mode')}
                                            value={conditionEdit}
                                            onChange={(event) => setConditionEdit(event.target.value as typeof conditionEdit)}
                                            className="w-full rounded border p-2"
                                        >
                                            <option value="ANSWER">
                                                {detail.conversationState.pendingQuestion
                                                    ? copy('질문에 답변', 'Answer question')
                                                    : copy('조건 추가', 'Add condition')}
                                            </option>
                                            {detail.conversationState.pendingQuestion && (
                                                <option value="ADD">{copy('별도 조건 추가', 'Add a separate condition')}</option>
                                            )}
                                            <option value="UPDATE">{copy('선택한 조건 수정', 'Update selected conditions')}</option>
                                            <option value="REMOVE">{copy('선택한 조건 삭제', 'Remove selected conditions')}</option>
                                            <option value="RESET">{copy('새 요청으로 시작', 'Start a new request')}</option>
                                        </select>
                                    </fieldset>
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
                        </div>
                    </footer>
                </div>
            </aside>
        </>,
        document.body,
    );
}
