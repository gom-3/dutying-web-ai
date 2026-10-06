import {type ReactNode, useEffect, useLayoutEffect, useMemo, useRef, useState} from 'react';
import {createPortal} from 'react-dom';
import type {TShift} from '@/entities/shift';
import {isWardAdminAccessToken} from '@/features/auth/model/admin-token';
import useAuthStore from '@/features/auth/model/store';
import {snapshotDetailToDoc, useShiftEditorCommands, useShiftEditorStore} from '@/features/shift-editor';
import {buildAutofillDTO} from '@/features/shift-editor/model/schedule-authoring';
import i18n from '@/i18n';
import {useTypedTranslation} from '@/shared/hook/use-typed-translation';
import {ConfirmationSpotlight} from '@/shared/ui/ConfirmActionDialog';
import {isScheduleFullyProtected} from '../../../model/ai-autofill-state';
import {aiConversationFailure, type TAiConversationFailure} from '../../../model/ai-conversation-failure';
import {aiExecutionFailure} from '../../../model/ai-execution-failure';
import {
    conversationApi,
    conversationEvents,
    isConversationConfirmationCurrent,
    type TConversationDetail,
    type TConversationExecute,
    type TConversationOperation,
    type TConversationPreference,
    type TConversationTurn,
    type TResultVersion,
} from '../../../model/schedule-conversation-api';
import {AiAdjustInterpretCard} from './ai-adjust-interpret-card';
import type {TAdjustResultActions} from './ai-adjust-result';
import {AiAdjustApplyChoices, AssistantMessage, UserMessage} from './ai-adjust-review-conversation';
import {AiAutofillMessages, type TAutofillFlow, type TAutofillMessage} from './ai-autofill-preparation';
import {AiChatScroll} from './ai-chat-scroll';
import {ConversationConfirmation} from './ai-conversation-confirmation';
import {AiConversationEntry, AiInfoTip, type TConversationEntryChoice} from './ai-conversation-entry';
import {ConversationEvidence, type TFailureSuggestion} from './ai-conversation-evidence';
import AiConversationSnapshot from './ai-conversation-snapshot';
import {AiExecutionFailure} from './ai-execution-failure';
import {AiFailureMessage} from './ai-failure-message';

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
const operationFailure = (operation: TConversationOperation): TAiConversationFailure | null =>
    (operation.result && aiExecutionFailure(operation.result)) ??
    (operation.executionStatus === 'FAILED'
        ? aiConversationFailure({serverCode: operation.failureReason ?? undefined}, i18n.t('aiAdjust.executionFailure.unknown'))
        : null);

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
    const isAutofillBlocked = isScheduleFullyProtected(doc);
    const revision = useShiftEditorStore((s) => s.draftRevision);
    const [detail, setDetail] = useState<TConversationDetail | null>(null);
    const detailRef = useRef<TConversationDetail | null>(null);
    const [busy, setBusy] = useState(false);
    const busyRef = useRef(false);
    const [error, setError] = useState<TAiConversationFailure | null>(null);
    const [notice, setNotice] = useState<string | null>(null);
    const [text, setText] = useState('');
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
    const install = (next: TConversationDetail) => {
        if (detailRef.current && detailRef.current.conversation.conversationId !== next.conversation.conversationId) {
            setLocalEvents([]);
            onNewConversation?.();
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

                if (!current) throw new Error(copy('작성 대화를 불러오고 있어요.', 'Loading your conversation.'));

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

        const next = await api.detail(detailRef.current.conversation.conversationId);

        if (mounted.current) install(next);
    };
    const run = async (action: () => Promise<void>) => {
        if (busyRef.current) return;

        busyRef.current = true;
        setBusy(true);
        setError(null);

        try {
            await action();
        } catch (e) {
            if (mounted.current) setError(aiConversationFailure(e));
        } finally {
            busyRef.current = false;

            if (mounted.current) setBusy(false);
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
            restore(await api.version(operation.resultVersionId));
        } else if (operation.executionStatus === 'SUCCEEDED' && !operationFailure(operation)) {
            setNotice(
                copy(
                    '현재 표가 바뀌어 결과를 덮어쓰지 않았어요. 그때 표 보기로 비교해 주세요.',
                    'Your draft changed. The result is saved for comparison.',
                ),
            );
        }

        await refresh();
    };
    const sendExecution = async (id: number, request: TConversationExecute) => {
        try {
            return await api.execute(id, request);
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

            const current = await sync();
            const uiRevision = useShiftEditorStore.getState().draftRevision;
            // Preserve the exact request on response loss; retry never creates a second action.
            const saved = sessionStorage.getItem(pendingKey);

            if (saved)
                throw new Error(
                    copy('이전 실행의 결과를 먼저 다시 확인해 주세요.', 'Check the previous execution before starting another.'),
                );

            const request: TConversationExecute = {
                expectedRevision: current.conversation.revision,
                idempotencyKey: crypto.randomUUID(),
                operationType,
                ...(fillPolicy ? {fillPolicy, rebuildConfirmed: fillPolicy === 'REBUILD_UNLOCKED'} : {}),
                ...(interpretationId ? {interpretationId} : {}),
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

            if (operation.executionStatus !== 'RUNNING') sessionStorage.removeItem(pendingKey);

            await applyCompleted(operation, uiRevision);
            window.dispatchEvent(new Event('dutying:commercial-usage-changed'));
        });
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
            const saved = JSON.parse(sessionStorage.getItem(pendingKey) ?? 'null') as {
                conversationId: number;
                request: TConversationExecute;
            } | null;

            if (!saved) {
                if (!detailRef.current) {
                    const list = await api.list(year, month);
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
            if (operation.executionStatus !== 'RUNNING') sessionStorage.removeItem(pendingKey);

            await refresh();
            setNotice(
                copy(
                    '실행 기록을 복구했어요. 결과를 확인하고 이어서 작성할 수 있어요.',
                    'Execution recovered. Review its result to continue.',
                ),
            );
        });
    const interpret = async () => {
        const message = text.trim();

        if (!message) return;

        await run(async () => {
            const current = await sync();

            if (previousId && current.conversation.latestInterpretationId !== previousId) {
                throw new Error(
                    copy(
                        '표나 조건이 바뀌었어요. 바꾸고 싶은 내용을 완전한 문장으로 다시 적어 주세요.',
                        'The source changed. Please restate the full request.',
                    ),
                );
            }

            const previous =
                previousId ??
                current.turns.find(
                    (turn) =>
                        turn.interpretationId === current.conversation.latestInterpretationId &&
                        isConversationConfirmationCurrent(current, turn, false),
                )?.interpretationId;
            const interpreted = await api.interpret(current.conversation.conversationId, {
                expectedRevision: current.conversation.revision,
                text: message,
                language: i18n.language,
                ...(previous && current.conversation.latestInterpretationId === previous
                    ? {previousInterpretationId: previous, change}
                    : {}),
            });

            setText('');
            setPreviousId(interpreted.interpretationId ?? undefined);
            setChange('ADD');
            setEntryChoice('modify');
            await refresh();
        });
    };
    const view = async (op: TConversationOperation, compare = false) =>
        run(async () => {
            if (!op.resultVersionId) return;

            const version = await api.version(op.resultVersionId);

            setPreview({version, ...(compare ? {before: await api.version(op.sourceVersionId)} : {})});
        });
    const branch = async (version: TResultVersion) =>
        run(async () => {
            if (sessionStorage.getItem(pendingKey))
                throw new Error(copy('이전 실행 기록을 먼저 확인해 주세요.', 'Check the previous execution first.'));

            const current = await sync(); // Preserve every unsaved manual edit before branching.
            const uiRevision = useShiftEditorStore.getState().draftRevision;
            const next = await api.branch(current.conversation.conversationId, version.versionId, current.conversation.revision);
            const nextDetail = await api.detail(next.conversationId);

            if (useShiftEditorStore.getState().draftRevision !== uiRevision) {
                setPendingBranch(nextDetail);
                setNotice(
                    copy(
                        '작성 중인 표가 바뀌어 전환하지 않았어요. 새 작업은 저장되어 있어요.',
                        'The draft changed. The new branch is saved without replacing your edits.',
                    ),
                );

                return;
            }

            install(nextDetail);
            restore(nextDetail.draft);
            setPreview(null);
            setPreviousId(undefined);
        });
    const newConversation = () =>
        run(async () => {
            if (sessionStorage.getItem(pendingKey))
                throw new Error(copy('이전 결과를 먼저 확인해 주세요.', 'Check the previous result first.'));

            const current = await sync();
            const next = await api.branch(current.conversation.conversationId, current.draft.versionId, current.conversation.revision);

            install(await api.detail(next.conversationId));
            setEntryChoice(null);
            setPreviousId(undefined);
            setChange('ADD');
            setText('');
            setRebuild(false);
            setPreview(null);
            setNotice(null);
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
            const conversation = list[0] ?? (await api.create(year, month));

            if (!mounted.current) return;

            install(await api.detail(conversation.conversationId));

            const savedPreferences = await api.preferences();

            if (mounted.current) setPreferences(savedPreferences);
        });
    }, [open]);
    useEffect(() => {
        if (!detailRef.current) return;

        const timer = window.setTimeout(() => {
            void sync().catch((e) => {
                if (mounted.current) setError(aiConversationFailure(e));
            });
        }, 400);

        return () => window.clearTimeout(timer);
    }, [revision]);

    const running =
        detail?.operations.some(
            (op) => op.executionStatus === 'RUNNING' || op.executionStatus === 'RESULT_READY' || op.executionStatus === 'UNKNOWN',
        ) ?? false;

    useEffect(() => {
        if (!detail || !(running || busy)) return;

        let polls = 0;

        const timer = window.setInterval(() => {
            if (++polls > 100) {
                window.clearInterval(timer);

                return;
            }

            void refresh().catch(() => undefined);
        }, 3000);

        return () => window.clearInterval(timer);
    }, [running, busy, detail?.conversation.conversationId]);
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
        onBusyChange?.(busy || running);

        return () => onBusyChange?.(false);
    }, [busy, running, onBusyChange]);

    useEffect(() => {
        if (autofillFlow?.kind === 'adjustment' || (!preparing && !autofillFlow)) return;

        setEntryChoice(null);
        setRebuild(false);
        setPreviousId(undefined);
        setText('');
        setNotice(null);
        setPreview(null);
    }, [preparing, autofillFlow?.id]);

    const canChooseNextAction = Boolean(
        detail &&
            (detail.turns.length === 0 ||
                localEvents.some(
                    (event) =>
                        event.id.startsWith('preparation:') && event.sequence > Math.max(0, ...detail.turns.map((turn) => turn.sequence)),
                )),
    );
    const latestOperation = detail?.operations[detail.operations.length - 1];
    const failureNeedsAction = Boolean(
        latestOperation &&
            operationFailure(latestOperation) &&
            dismissedFailureId !== latestOperation.operationId &&
            !detail?.turns.some((turn) => turn.sequence > latestOperation.sequence),
    );
    const composerHidden =
        preparing || !detail || failureNeedsAction || entryChoice === 'regenerate' || (!entryChoice && canChooseNextAction);

    useEffect(() => {
        if (entryChoice === 'modify' && !composerHidden) textarea.current?.focus();
    }, [entryChoice, composerHidden]);

    const active = detail?.turns.find((turn) => turn.interpretationId === detail.conversation.latestInterpretationId);
    const activeCard = active?.interpretation;
    const incomplete =
        Boolean(activeCard?.unmapped?.length) ||
        Boolean(activeCard?.items?.some((item) => Boolean(item.requiresConfirmation) || item.kind === 'CELL' || item.kind === 'CELL_SET'));
    const canConfirm = Boolean(
        !preparing && active && activeCard && detail && isConversationConfirmationCurrent(detail, active, localDirty) && !incomplete,
    );
    const stamp = (date: string) => new Date(date).toLocaleString(i18n.language, {dateStyle: 'short', timeStyle: 'short'});
    const renderTurn = (turn: TConversationTurn) => {
        const Message = turn.actor === 'USER' ? UserMessage : AssistantMessage;

        return (
            <div key={turn.eventId}>
                <Message>
                    {turn.text && <p className="whitespace-pre-wrap">{turn.text}</p>}
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
                                    disabled={busy || running || awaitingAdjustment || localDirty || !adjustEnabled}
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
                                    {copy('이전 해석 · 실행할 수 없음', 'Previous interpretation · unavailable for execution')}
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
                        {t('aiAdjust.chat.restart')}
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
                            <ul>{detail?.activeConditionLabels.map((label, index) => <li key={index}>{label}</li>)}</ul>
                        </AiInfoTip>
                    </div>
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
                        {detail &&
                            [...conversationEvents(detail), ...localEvents]
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
                                            <article className="rounded-xl bg-gray-7 p-3" inert={preparing}>
                                                <p className="font-semibold">
                                                    {copy(
                                                        event.operation.operationType === 'GENERATE' ? '자동채우기' : '수정',
                                                        event.operation.operationType === 'GENERATE' ? 'Autofill' : 'Adjustment',
                                                    )}{' '}
                                                    ·{' '}
                                                    {copy(
                                                        event.operation.executionStatus === 'RUNNING'
                                                            ? '실행 중'
                                                            : operationFailure(event.operation)
                                                              ? '실패'
                                                              : event.operation.executionStatus === 'UNKNOWN'
                                                                ? '결과 확인 필요'
                                                                : event.operation.executionStatus === 'RESULT_READY'
                                                                  ? '결과 저장 중'
                                                                  : '완료',
                                                        event.operation.executionStatus,
                                                    )}
                                                </p>
                                                <p className="text-xs text-[#475467]">
                                                    {stamp(event.operation.createdAt)} · {copy('대상', 'Target')}: {year}-
                                                    {String(month).padStart(2, '0')}
                                                </p>
                                                {event.operation.executionStatus === 'UNKNOWN' && (
                                                    <p>
                                                        {copy(
                                                            '서버에서 실행 결과를 확인해야 해요. 같은 요청은 다시 계산하지 않습니다.',
                                                            'The server needs to confirm the outcome. This request will not run again.',
                                                        )}
                                                        <button className={buttonClass} onClick={() => void retryPending()}>
                                                            {copy('결과 다시 확인', 'Check outcome')}
                                                        </button>
                                                    </p>
                                                )}
                                                {event.operation.result &&
                                                    event.operation.applyStatus === 'APPLIED' &&
                                                    !operationFailure(event.operation) && (
                                                        <p>
                                                            {event.operation.result.sameAsPrevious
                                                                ? copy('변화 없음', 'No changes')
                                                                : `${event.operation.result.changedCells.length}${copy('칸 변경', ' changed cells')}`}
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
                                                {event.operation.result?.goalResults?.map((goal, index) => (
                                                    <p key={index}>
                                                        {goal.goalStatus}: {goal.beforeSingleNightRuns} → {goal.afterSingleNightRuns}
                                                    </p>
                                                ))}
                                                {event.operation.result && (
                                                    <ConversationEvidence
                                                        result={event.operation.result}
                                                        nurseName={(id) => doc.workerMeta[id]?.name ?? id}
                                                        disabled={busy || running}
                                                        suggestionsCurrent={
                                                            !localDirty &&
                                                            event.operation.baseRevision === detail.conversation.revision &&
                                                            event.operation.interpretationId ===
                                                                detail.conversation.latestInterpretationId &&
                                                            Boolean(
                                                                detail.turns.find(
                                                                    (turn) =>
                                                                        turn.interpretationId === event.operation.interpretationId &&
                                                                        turn.contextHash === detail.contextHash,
                                                                ),
                                                            )
                                                        }
                                                        onSelect={(suggestion) => setSelectedSuggestion({op: event.operation, suggestion})}
                                                    />
                                                )}
                                                {event.operation.resultVersionId && (
                                                    <div className="mt-2 flex flex-wrap gap-2">
                                                        <button className={buttonClass} onClick={() => void view(event.operation)}>
                                                            {copy('그때 표 보기', 'View this result')}
                                                        </button>
                                                        <button className={buttonClass} onClick={() => void view(event.operation, true)}>
                                                            {copy('전후 비교', 'Compare')}
                                                        </button>
                                                    </div>
                                                )}
                                            </article>
                                            {operationFailure(event.operation) && (
                                                <AiExecutionFailure
                                                    failure={operationFailure(event.operation)!}
                                                    active={
                                                        failureNeedsAction &&
                                                        event.operation === latestOperation &&
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

                                                                      if (turn) void prepareAndAdjust(turn);
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
                                                              }
                                                            : undefined
                                                    }
                                                    onReview={onClose}
                                                />
                                            )}
                                            {event.operation.operationType === 'GENERATE' &&
                                                event.operation.executionStatus === 'SUCCEEDED' &&
                                                !operationFailure(event.operation) &&
                                                event.operation.applyStatus === 'APPLIED' && (
                                                    <AssistantMessage>
                                                        <span className="whitespace-pre-line">{t('aiAdjust.generationCompleted')}</span>
                                                    </AssistantMessage>
                                                )}
                                        </div>
                                    ),
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
                                            if (onPrepareGeneration) onPrepareGeneration();
                                            else setRebuild(true);
                                        } else textarea.current?.focus();
                                    }}
                                />
                            )}
                        {error && (
                            <AiFailureMessage message={error.message}>
                                {!error.blocked && (
                                    <button className={buttonClass} disabled={busy || running} onClick={() => void retryPending()}>
                                        {copy('실행 기록 다시 확인', 'Check execution history')}
                                    </button>
                                )}
                            </AiFailureMessage>
                        )}
                    </AiChatScroll>
                    {selectedSuggestion && (
                        <section className="rounded-xl bg-gray-7 p-3" aria-label="제안 확인">
                            <p>이 변경 내용을 이번 실행에 적용할까요?</p>
                            {selectedSuggestion.suggestion.changes.map((c, i) => (
                                <p key={i}>
                                    {c.reason} · {String(c.oldValue)} → {String(c.proposedValue)}
                                </p>
                            ))}
                            <button className={buttonClass} onClick={() => setSelectedSuggestion(undefined)}>
                                취소
                            </button>
                            <button
                                className={buttonClass}
                                disabled={busy || running || localDirty}
                                onClick={() => {
                                    const selected = selectedSuggestion;

                                    setSelectedSuggestion(undefined);
                                    void execute('ADJUST', undefined, selected.op.interpretationId ?? undefined, selected);
                                }}
                            >
                                변경 확인하고 조절 실행
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
                        {detail && (
                            <button className={buttonClass} disabled={busy || running} onClick={() => void branch(detail.draft)}>
                                {copy('서버 작업표 불러오기', 'Load saved draft')}
                            </button>
                        )}
                        {pendingBranch && (
                            <button
                                className={buttonClass}
                                disabled={busy || running}
                                onClick={() =>
                                    void run(async () => {
                                        await sync();
                                        install(pendingBranch);
                                        restore(pendingBranch.draft);
                                        setPendingBranch(null);
                                        setPreview(null);
                                    })
                                }
                            >
                                {copy('저장된 새 작업 열기', 'Open the saved new branch')}
                            </button>
                        )}
                        <div className={composerHidden ? 'hidden' : 'space-y-2'} inert={composerHidden} aria-hidden={composerHidden}>
                            {!!preferences.length && (
                                <details>
                                    <summary className="text-sm">{copy('확인한 자주 쓰는 요청', 'Saved requests')}</summary>
                                    {preferences.map((p) => (
                                        <div className="flex gap-2" key={p.id}>
                                            <button className="text-left text-sm underline" onClick={() => setText(p.value)}>
                                                {p.value}
                                            </button>
                                            <button
                                                className="text-sm underline"
                                                onClick={() => {
                                                    setText(p.value);
                                                    setEditingPreferenceId(p.id);
                                                }}
                                            >
                                                {copy('수정', 'Edit')}
                                            </button>
                                            <button
                                                className="text-sm"
                                                onClick={() =>
                                                    void run(async () => {
                                                        await api.deletePreference(p.id);
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
                            {previousId && (
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
                            <label className="block text-sm">
                                {copy('수정할 내용', 'Your changes')}
                                <textarea
                                    ref={textarea}
                                    className="mt-1 w-full resize-none rounded-lg border-[1.8px] border-gray-5 bg-gray-7 p-3 focus:border-main-1 focus:bg-main-light focus:text-main-1 focus:outline-none"
                                    maxLength={500}
                                    rows={2}
                                    value={text}
                                    onChange={(event) => setText(event.target.value)}
                                    disabled={busy || running || !adjustEnabled}
                                    placeholder={t('aiAdjust.placeholder')}
                                />
                            </label>
                            <div className="flex gap-2">
                                <button
                                    className={buttonClass}
                                    disabled={busy || running || !text.trim() || !adjustEnabled}
                                    onClick={() => void interpret()}
                                >
                                    {t('aiAdjust.send')}
                                </button>
                                <button
                                    className={buttonClass}
                                    disabled={busy || !text.trim()}
                                    onClick={() =>
                                        void run(async () => {
                                            if (editingPreferenceId === undefined)
                                                await api.savePreference(text.trim(), 'EXPLICIT_USER_CONFIRMATION');
                                            else await api.replacePreference(editingPreferenceId, text.trim());

                                            setEditingPreferenceId(undefined);
                                            setPreferences(await api.preferences());
                                        })
                                    }
                                >
                                    {copy('요청 저장', 'Save request')}
                                </button>
                            </div>
                            {busy && (
                                <p role="status" className="text-sm">
                                    {copy('요청을 확인하고 있어요.', 'Working on your request.')}
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
