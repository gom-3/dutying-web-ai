import {useEffect, useLayoutEffect, useMemo, useRef, useState} from 'react';
import {createPortal} from 'react-dom';
import type {TShift} from '@/entities/shift';
import {isWardAdminAccessToken} from '@/features/auth/model/admin-token';
import useAuthStore from '@/features/auth/model/store';
import {snapshotDetailToDoc, useShiftEditorCommands, useShiftEditorStore} from '@/features/shift-editor';
import {buildAutofillDTO} from '@/features/shift-editor/model/schedule-authoring';
import i18n from '@/i18n';
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
import {ConversationConfirmation} from './ai-conversation-confirmation';
import {ConversationEvidence, type TFailureSuggestion} from './ai-conversation-evidence';

type TProps = {
    open: boolean;
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
};
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
const buttonClass = 'rounded-lg border border-gray-5 px-3 py-2 text-sm hover:bg-main-light disabled:opacity-40';

export default function AiConversationSidebar({
    open,
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
}: TProps) {
    const api = useMemo(() => conversationApi(wardId, teamId), [wardId, teamId]);
    const commands = useShiftEditorCommands();
    const doc = useShiftEditorStore((s) => s.doc);
    const revision = useShiftEditorStore((s) => s.draftRevision);
    const [detail, setDetail] = useState<TConversationDetail | null>(null);
    const detailRef = useRef<TConversationDetail | null>(null);
    const [busy, setBusy] = useState(false);
    const busyRef = useRef(false);
    const [error, setError] = useState<string | null>(null);
    const [notice, setNotice] = useState<string | null>(null);
    const [text, setText] = useState('');
    const [change, setChange] = useState<'REPLACE' | 'ADD' | 'RESET'>('REPLACE');
    const [previousId, setPreviousId] = useState<string>();
    const [preview, setPreview] = useState<TPreview | null>(null);
    const [pendingBranch, setPendingBranch] = useState<TConversationDetail | null>(null);
    const [preferences, setPreferences] = useState<TConversationPreference[]>([]);
    const [editingPreferenceId, setEditingPreferenceId] = useState<number>();
    const [rebuild, setRebuild] = useState(false);
    const [selectedSuggestion, setSelectedSuggestion] = useState<{op: TConversationOperation; suggestion: TFailureSuggestion}>();
    const [newEvents, setNewEvents] = useState(false);
    const scroll = useRef<HTMLDivElement>(null);
    const atBottom = useRef(true);
    const mounted = useRef(true);
    const initialized = useRef(false);
    const syncTail = useRef<Promise<unknown>>(Promise.resolve());
    const lastGeneration = useRef(generationRequest);
    const lastRebuild = useRef(rebuildRequest);
    const pendingKey = `dutying.conversation:${isWardAdminAccessToken(useAuthStore.getState().accessToken) ? 'admin' : 'account'}:${useAuthStore.getState().accountId}:${wardId}:${teamId}:${year}:${month}`;
    const ko = i18n.language.startsWith('ko');
    const copy = (korean: string, english: string) => (ko ? korean : english);
    const install = (next: TConversationDetail) => {
        detailRef.current = next;

        if (mounted.current) setDetail(next);
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
            if (mounted.current)
                setError(
                    e instanceof Error
                        ? e.message
                        : copy('요청을 완료하지 못했어요. 다시 확인해 주세요.', 'Request failed. Please try again.'),
                );
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
            operation.applyStatus === 'APPLIED' &&
            operation.resultVersionId &&
            useShiftEditorStore.getState().draftRevision === uiRevision
        ) {
            restore(await api.version(operation.resultVersionId));
        } else if (operation.executionStatus === 'SUCCEEDED') {
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
            if ([400, 403, 422].includes((e as {code?: number}).code ?? 0)) sessionStorage.removeItem(pendingKey);

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

            await api.interpret(current.conversation.conversationId, {
                expectedRevision: current.conversation.revision,
                text: message,
                language: i18n.language,
                ...(previousId && current.conversation.latestInterpretationId === previousId
                    ? {previousInterpretationId: previousId, change}
                    : {}),
            });
            setText('');
            setPreviousId(undefined);
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
        root.style.setProperty('--make-ai-adjust-sidebar-width', '407px');

        return () => {
            delete root.dataset.makeAiAdjustOpen;
            root.style.removeProperty('--make-ai-adjust-sidebar-width');
        };
    }, [open]);
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
                if (mounted.current) setError(e.message);
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
        if (!detail || busy || !open || generationRequest <= lastGeneration.current) return;

        lastGeneration.current = generationRequest;
        void execute('GENERATE', 'EMPTY_ONLY');
    }, [generationRequest, detail, busy, open]);

    useEffect(() => {
        if (rebuildRequest <= lastRebuild.current) return;

        lastRebuild.current = rebuildRequest;
        setRebuild(true);
    }, [rebuildRequest]);

    const eventCount = (detail?.turns.length ?? 0) + (detail?.operations.length ?? 0);

    useEffect(() => {
        if (atBottom.current) scroll.current?.scrollTo?.({top: scroll.current.scrollHeight});
        else setNewEvents(true);
    }, [eventCount]);

    const active = detail?.turns.find((turn) => turn.interpretationId === detail.conversation.latestInterpretationId);
    const activeCard = active?.interpretation;
    const incomplete =
        Boolean(activeCard?.unmapped?.length) ||
        Boolean(activeCard?.items?.some((item) => Boolean(item.requiresConfirmation) || item.kind === 'CELL' || item.kind === 'CELL_SET'));
    const canConfirm = Boolean(
        active && activeCard && detail && isConversationConfirmationCurrent(detail, active, localDirty) && !incomplete,
    );
    const emptyCount = doc.rows.reduce((total, row) => total + row.cells.filter((cell) => cell === null || cell === '').length, 0);
    const stamp = (date: string) => new Date(date).toLocaleString(i18n.language, {dateStyle: 'short', timeStyle: 'short'});
    const renderTurn = (turn: TConversationTurn) => (
        <article key={turn.eventId} className={`rounded-xl p-3 ${turn.actor === 'USER' ? 'bg-main-light' : 'bg-gray-7'}`}>
            {turn.text && <p className="whitespace-pre-wrap">{turn.text}</p>}
            {turn.interpretation && (
                <>
                    <p className="font-semibold">{copy('이렇게 이해했어요', 'Here is how I understood it')}</p>
                    <p className="text-xs text-gray-4">
                        {copy('이번 실행에 적용 · 고정 배치 유지', 'This execution only · fixed cells preserved')}
                    </p>
                    <ul className="mt-2 space-y-1">
                        {turn.interpretation.items?.map((item, index) => <li key={index}>{item.displayLabel}</li>)}
                    </ul>
                    {turn.interpretation.llmPrompt && <p>{turn.interpretation.llmPrompt}</p>}
                    {turn.interpretation.unmapped?.map((entry, index) => (
                        <p className="mt-2 text-red" key={index}>
                            {entry.hint}
                        </p>
                    ))}
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
                            disabled={busy || running || localDirty || !adjustEnabled}
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
                        <div className="mt-3 flex flex-wrap gap-2">
                            <button
                                className={buttonClass}
                                disabled={busy || running || !canConfirm || !adjustEnabled}
                                onClick={() => void execute('ADJUST', undefined, turn.interpretationId ?? undefined)}
                            >
                                {copy('이대로 조절하기', 'Adjust as confirmed')}
                            </button>
                            <button
                                className={buttonClass}
                                disabled={busy}
                                onClick={() => {
                                    setPreviousId(turn.interpretationId ?? undefined);
                                    setText('');
                                }}
                            >
                                {copy('수정하기', 'Revise')}
                            </button>
                        </div>
                    ) : (
                        <p className="mt-2 text-xs text-gray-4">
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
        </article>
    );

    return createPortal(
        <aside
            data-state={open ? 'open' : 'closed'}
            aria-label={copy('근무표 작성', 'Schedule authoring')}
            aria-hidden={!open}
            inert={!open}
            onKeyDown={(event) => {
                event.stopPropagation();

                if (event.key === 'Escape') onClose();
            }}
            onPaste={(event) => event.stopPropagation()}
            className={`ai-adjust-sidebar fixed top-0 right-0 z-[1400] flex h-dvh w-[407px] max-w-full flex-col border-l border-gray-5 bg-white p-4 shadow-xl ${open ? '' : 'hidden'}`}
        >
            <header className="mb-3 flex items-center justify-between">
                <h2 className="text-xl font-semibold">{copy('근무표 작성', 'Schedule authoring')}</h2>
                <button className={buttonClass} onClick={onClose}>
                    {copy('닫기', 'Close')}
                </button>
            </header>
            <p className="font-medium">
                {year}
                {copy('년 ', ' / ')}
                {month}
                {copy('월', '')} · {teamId}
            </p>
            <p className="mb-2 text-sm text-gray-4">
                {preview ? copy('과거 결과 미리보기', 'Historical preview') : copy('현재 작업표', 'Current draft')} ·{' '}
                {copy('작업 판본', 'Revision')} {detail?.conversation.revision ?? '—'}
            </p>
            <details className="mb-3 text-sm">
                <summary>
                    {copy('적용 조건과 기준 보기', 'View conditions and source')} ({detail?.activeConditionLabels.length ?? 0})
                </summary>
                <p>
                    {copy(
                        '현재 활성 병동·월 조건과 고정 배치를 유지합니다. 이전 조절 목표를 자동 상속하지 않습니다.',
                        'Current ward and month conditions and fixed assignments are preserved. Previous goals are not inherited.',
                    )}
                </p>
                <ul>{detail?.activeConditionLabels.map((label, index) => <li key={index}>{label}</li>)}</ul>
                <p>
                    {copy('빈칸', 'Empty cells')}: {emptyCount}
                </p>
            </details>
            {error && (
                <div role="alert" className="mb-2 text-sm text-red">
                    {error}
                    <button className={buttonClass} onClick={() => void retryPending()}>
                        {copy('실행 기록 다시 확인', 'Check execution history')}
                    </button>
                </div>
            )}
            {notice && (
                <p role="status" className="mb-2 text-sm">
                    {notice}
                </p>
            )}
            {newEvents && (
                <button
                    className={buttonClass}
                    onClick={() => {
                        scroll.current?.scrollTo?.({top: scroll.current.scrollHeight});
                        setNewEvents(false);
                    }}
                >
                    {copy('새 결과 보기', 'Show new results')}
                </button>
            )}
            <div
                ref={scroll}
                className="min-h-0 flex-1 space-y-3 overflow-y-auto py-2"
                onScroll={(event) => {
                    const el = event.currentTarget;

                    atBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
                }}
            >
                {!detail && <p role="status">{copy('작성 대화를 불러오고 있어요.', 'Loading your conversation.')}</p>}
                {detail &&
                    conversationEvents(detail).map((event) =>
                        event.kind === 'turn' ? (
                            renderTurn(event.turn)
                        ) : (
                            <article key={event.id} className="rounded-xl border border-gray-5 p-3">
                                <p className="font-semibold">
                                    {copy(
                                        event.operation.operationType === 'GENERATE' ? '자동완성' : '조절',
                                        event.operation.operationType === 'GENERATE' ? 'Autofill' : 'Adjustment',
                                    )}{' '}
                                    ·{' '}
                                    {copy(
                                        event.operation.executionStatus === 'RUNNING'
                                            ? '실행 중'
                                            : event.operation.executionStatus === 'FAILED'
                                              ? '실패'
                                              : event.operation.executionStatus === 'UNKNOWN'
                                                ? '결과 확인 필요'
                                                : event.operation.executionStatus === 'RESULT_READY'
                                                  ? '결과 저장 중'
                                                  : '완료',
                                        event.operation.executionStatus,
                                    )}
                                </p>
                                <p className="text-xs text-gray-4">
                                    {stamp(event.operation.createdAt)} · {copy('대상', 'Target')}: {year}-{String(month).padStart(2, '0')}
                                </p>
                                {event.operation.executionStatus === 'FAILED' && (
                                    <p>
                                        {copy(
                                            '유효한 결과를 찾지 못했어요. 현재 표는 유지돼요.',
                                            'No valid result was found. Your draft is preserved.',
                                        )}{' '}
                                        ({event.operation.failureReason})
                                    </p>
                                )}
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
                                {event.operation.result && (
                                    <p>
                                        {event.operation.result.sameAsPrevious
                                            ? copy('변화 없음', 'No changes')
                                            : `${event.operation.result.changedCells.length}${copy('칸 변경', ' changed cells')}`}
                                    </p>
                                )}
                                {event.operation.applyStatus === 'NOT_APPLIED_SOURCE_CHANGED' && (
                                    <p>{copy('현재 표가 바뀌어 반영하지 않았어요.', 'The source changed; result was not applied.')}</p>
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
                                            event.operation.interpretationId === detail.conversation.latestInterpretationId &&
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
                        ),
                    )}
            </div>
            {selectedSuggestion && (
                <section className="border-t p-3" aria-label="제안 확인">
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
                <section
                    className="max-h-[45vh] shrink-0 overflow-auto border-t border-gray-5 py-2"
                    aria-label={copy('읽기 전용 결과', 'Read-only result')}
                >
                    <div className="mb-2 flex flex-wrap gap-2">
                        <button className={buttonClass} onClick={() => setPreview(null)}>
                            {copy('미리보기 닫기', 'Close preview')}
                        </button>
                        <button className={buttonClass} disabled={busy || running} onClick={() => void branch(preview.version)}>
                            {copy('이 표에서 이어서 작성', 'Continue from this result')}
                        </button>
                    </div>
                    <table className="w-full text-xs">
                        <thead>
                            <tr>
                                <th>{copy('간호사', 'Nurse')}</th>
                                <th>{copy('날짜', 'Date')}</th>
                                {preview.before && <th>{copy('이전', 'Before')}</th>}
                                <th>{copy('근무', 'Shift')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {preview.version.cells
                                .filter(
                                    (cell) =>
                                        !preview.before ||
                                        preview.before.cells.find((old) => old.shiftNurseId === cell.shiftNurseId && old.date === cell.date)
                                            ?.wardShiftTypeId !== cell.wardShiftTypeId,
                                )
                                .map((cell) => (
                                    <tr key={`${cell.shiftNurseId}:${cell.date}`}>
                                        <td>{doc.workerMeta[String(cell.shiftNurseId)]?.name ?? cell.shiftNurseId}</td>
                                        <td>{cell.date.slice(5)}</td>
                                        {preview.before && (
                                            <td>
                                                {preview.before.cells.find(
                                                    (old) => old.shiftNurseId === cell.shiftNurseId && old.date === cell.date,
                                                )?.shiftCode ?? '—'}
                                            </td>
                                        )}
                                        <td>{cell.shiftCode ?? '—'}</td>
                                    </tr>
                                ))}
                        </tbody>
                    </table>
                </section>
            )}
            <footer className="shrink-0 space-y-2 border-t border-gray-5 pt-3">
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
                    {copy('조절 요청', 'Adjustment request')}
                    <textarea
                        className="mt-1 w-full resize-none rounded-lg border border-gray-5 p-2"
                        maxLength={500}
                        rows={2}
                        value={text}
                        onChange={(event) => setText(event.target.value)}
                        disabled={busy || running || !adjustEnabled}
                        placeholder={copy('바꾸고 싶은 점을 말해 주세요', 'Describe what you would like to change')}
                    />
                </label>
                <div className="flex gap-2">
                    <button
                        className={buttonClass}
                        disabled={busy || running || !text.trim() || !adjustEnabled}
                        onClick={() => void interpret()}
                    >
                        {copy('이해 확인', 'Review interpretation')}
                    </button>
                    <button
                        className={buttonClass}
                        disabled={busy || !text.trim()}
                        onClick={() =>
                            void run(async () => {
                                if (editingPreferenceId === undefined) await api.savePreference(text.trim(), 'EXPLICIT_USER_CONFIRMATION');
                                else await api.replacePreference(editingPreferenceId, text.trim());

                                setEditingPreferenceId(undefined);
                                setPreferences(await api.preferences());
                            })
                        }
                    >
                        {copy('이 요청을 다음에도 제안', 'Save this request')}
                    </button>
                </div>
                <button
                    className={`${buttonClass} w-full`}
                    disabled={busy || running || !detail || emptyCount === 0}
                    onClick={() => void execute('GENERATE', 'EMPTY_ONLY')}
                >
                    {copy('현재 표로 자동완성 · 빈칸만 채움', 'Autofill this draft · empty cells only')}
                </button>
                <button className="text-sm underline" disabled={busy || running || !detail} onClick={() => setRebuild(true)}>
                    {copy('배치를 다시 만들어 보기', 'Rebuild unlocked assignments')}
                </button>
                {rebuild && (
                    <div className="space-y-2 rounded border p-2 text-sm">
                        <p>{copy('고정되지 않은 기존 배치도 바뀔 수 있어요.', 'Existing unlocked assignments may change.')}</p>
                        <button
                            className={buttonClass}
                            onClick={() => {
                                setRebuild(false);
                                void execute('GENERATE', 'REBUILD_UNLOCKED');
                            }}
                        >
                            {copy('확인하고 다시 만들기', 'Confirm and rebuild')}
                        </button>
                        <button className={buttonClass} onClick={() => setRebuild(false)}>
                            {copy('닫기', 'Close')}
                        </button>
                    </div>
                )}
                {busy && (
                    <p role="status" className="text-sm">
                        {copy('요청을 처리하고 있어요. 닫아도 기록은 유지돼요.', 'Processing. You can close the panel and return later.')}
                    </p>
                )}
            </footer>
        </aside>,
        document.body,
    );
}
