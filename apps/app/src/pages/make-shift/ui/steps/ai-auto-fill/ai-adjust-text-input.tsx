import type {
    TAutofillAdjustStrength,
    TScheduleAdjustInterpretRes,
    TScheduleMonthRequestItem,
    TScheduleMonthRequestRes,
} from '@dutying/api/ward';
import {useEffect, useImperativeHandle, useRef, useState, type ReactNode, type Ref} from 'react';
import {v4 as uuid} from 'uuid';
import type {TShift} from '@/entities/shift';
import {useShiftEditorStore} from '@/features/shift-editor';
import type {TDutyDoc} from '@/features/shift-editor/model/types';
import nextIcon from '@/shared/assets/images/ai-adjust/next.svg';
import sendIcon from '@/shared/assets/images/ai-adjust/send.svg';
import {useTypedTranslation} from '@/shared/hook/use-typed-translation';
import {isIncompleteRevision, type TAdjustApplyResult} from '../../../model/ai-adjust-conversation';
import {
    answerReviewQuestion,
    getReviewQuestions,
    isReviewComplete,
    parseReviewReply,
    type TReviewQuestion,
    type TReviewReply,
    type TReviewValue,
} from '../../../model/ai-adjust-review-flow';
import {aiConversationFailure, type TAiConversationFailure} from '../../../model/ai-conversation-failure';
import {interpretIssueCode} from '../../../model/ai-interpret-issues';
import {readScheduleChat, writeScheduleChat} from '../../../model/schedule-chat-cache';
import type {TInterpretCardItem} from '../../../model/schedule-month-requests';
import {useScheduleChatComposer} from '../../../model/use-schedule-chat-composer';
import type {TAdjustCard} from './ai-adjust-interpret-card';
import {AiAdjustResult, type TAdjustResultActions} from './ai-adjust-result';
import {AiAdjustReviewConversation, AssistantMessage, UserMessage} from './ai-adjust-review-conversation';
import {AiAutofillMessages, type TAutofillFlow, type TAutofillMessage} from './ai-autofill-preparation';
import {AiChatScroll} from './ai-chat-scroll';
import {AiConversationConfirmation, AiConversationEntry, type TConversationEntryChoice} from './ai-conversation-entry';
import {AiConversationLoading} from './ai-conversation-loading';
import {AiExecutionFailure} from './ai-execution-failure';
import {AiFailureMessage} from './ai-failure-message';
import {AiResultSnapshot} from './ai-result-snapshot';

const MAX_TEXT_LENGTH = 500;

export type TAdjustTextInputHandle = {fill: (sentence: string) => void; restart: () => void};
export type TAdjustApply = (
    items: TInterpretCardItem[],
    requestText: string,
    strength: TAutofillAdjustStrength,
    llmPrompt?: string,
    actionKey?: string,
) => Promise<TAdjustApplyResult | void> | void;
export type TConflictReviewRenderer = (onRevise: () => void, onEditSettings?: () => void) => ReactNode;

type TProps = {
    disabled: boolean;
    modifyDisabled?: boolean;
    open?: boolean;
    preparation?: ReactNode;
    autofillFlow?: TAutofillFlow | null;
    historyKey?: string | null;
    onNewConversation?: () => void;
    onReviewSchedule?: () => void;
    onEditFailureSettings?: (failure: TAiConversationFailure) => void;
    settingsHref?: string;
    hideRestartButton?: boolean;
    onBusyChange?: (busy: boolean) => void;
    conditionsVersion?: number;
    interpret: (text: string) => Promise<TScheduleAdjustInterpretRes>;
    onApply: TAdjustApply;
    goalNurses: {nurseId: number; name: string; divisionName?: string | null}[];
    shiftCodes?: string[];
    requests?: TScheduleMonthRequestRes[];
    requestsLoading?: boolean;
    requestsError?: boolean;
    onRetryRequests?: () => void;
    resultActions?: TAdjustResultActions;
    onUndo?: (revision: number) => Promise<boolean> | boolean;
    currentRevision?: number;
    requestList?: ReactNode;
    conversationActions?: ReactNode;
    generationCompleted?: boolean;
    hasGeneratedSchedule?: boolean;
    generationCompletedMessage?: string;
    generationReviewRequired?: boolean;
    snapshotShift?: TShift;
    generationFailure?: TAiConversationFailure | null;
    renderConflictReview?: TConflictReviewRenderer;
    onDismissFailure?: () => void;
    onRegenerate?: (requestText?: string) => void;
    onRecoverGeneration?: () => void;
    ref?: Ref<TAdjustTextInputHandle>;
};
type TTurn = {
    id: number;
    group: number;
    text: string;
    card?: TAdjustCard;
    autofillId?: number;
    messages?: TAutofillMessage[];
    status:
        | 'messages'
        | 'interpreting'
        | 'confirm'
        | 'revising'
        | 'superseded'
        | 'applying'
        | 'applyFailed'
        | 'applied'
        | 'undone'
        | 'error';
    result?: TAdjustApplyResult;
    snapshot?: TDutyDoc;
    snapshotShift?: TShift;
    snapshotBefore?: TDutyDoc;
    snapshotBeforeShift?: TShift;
    attempt?: number;
    completion?: {message: string; reviewRequired: boolean};
    error?: string;
    failure?: TAiConversationFailure;
    failedAttempts?: {messages: TAutofillMessage[]; failure: TAiConversationFailure; reply: string; attempt?: number}[];
    replies?: TReviewReply[];
    followups?: {text: string; reply: string}[];
    reviewRequests?: TScheduleMonthRequestRes[];
};

function snapshotChangedCount(before: TDutyDoc | undefined, after: TDutyDoc): number | undefined {
    if (!before) return undefined;

    const previous = new Map(
        before.rows.flatMap((row) => before.columns.map((date, index) => [`${row.workerId}|${date}`, row.cells[index] ?? null] as const)),
    );

    return after.rows.reduce(
        (count, row) =>
            count +
            after.columns.filter((date, index) => (previous.get(`${row.workerId}|${date}`) ?? null) !== (row.cells[index] ?? null)).length,
        0,
    );
}

export function toCardItems(items: TScheduleMonthRequestItem[], goalNurseIds: number[]): TInterpretCardItem[] {
    return items.map((item) => ({
        item:
            item.kind === 'GOAL'
                ? {
                      ...item,
                      targetNurseIds: item.targetNurseIds?.length ? item.targetNurseIds : goalNurseIds,
                      comparisonNurseIds: item.comparisonNurseIds?.length ? item.comparisonNurseIds : goalNurseIds,
                  }
                : item,
        lifetime: 'MONTH',
        severity: item.severity ?? 'SOFT',
    }));
}

export default function AiAdjustTextInput({
    disabled,
    modifyDisabled,
    open = true,
    preparation,
    autofillFlow,
    historyKey = null,
    onNewConversation,
    onReviewSchedule,
    onEditFailureSettings,
    settingsHref,
    hideRestartButton = false,
    onBusyChange,
    conditionsVersion = 0,
    interpret,
    onApply,
    goalNurses,
    shiftCodes = [],
    requests = [],
    requestsLoading = false,
    requestsError = false,
    onRetryRequests,
    onUndo,
    resultActions,
    currentRevision,
    requestList,
    conversationActions,
    generationCompleted = false,
    hasGeneratedSchedule = false,
    generationCompletedMessage,
    generationReviewRequired = false,
    snapshotShift,
    generationFailure,
    renderConflictReview,
    onDismissFailure,
    onRegenerate,
    onRecoverGeneration,
    ref,
}: TProps) {
    const {t} = useTypedTranslation();
    const recoveredFailure = useRef<TAiConversationFailure | null>(null);
    const settingsAction = (failure: TAiConversationFailure | undefined) =>
        failure && onEditFailureSettings ? () => onEditFailureSettings(failure) : undefined;
    const attemptLabel = (attempt: number) => t('aiAutofillUi.conversationEntry.attemptLabel', {attempt});
    const preparing = Boolean(preparation);
    const {
        text,
        setText,
        entryChoice,
        setEntryChoice,
        saveFailed: composerSaveFailed,
    } = useScheduleChatComposer(historyKey ? `${historyKey}:composer` : null);
    const [noticeDismissed, setNoticeDismissed] = useState(false);
    const [restoredTurns] = useState(
        () =>
            readScheduleChat<TTurn[]>(
                historyKey,
                (value): value is TTurn[] =>
                    Array.isArray(value) &&
                    value.every(
                        (turn) =>
                            turn &&
                            Number.isSafeInteger(turn.id) &&
                            Number.isSafeInteger(turn.group) &&
                            typeof turn.text === 'string' &&
                            typeof turn.status === 'string',
                    ),
            ) ?? [],
    );
    const [turns, setTurns] = useState<TTurn[]>(() =>
        restoredTurns.map((turn) =>
            ['interpreting', 'applying'].includes(turn.status)
                ? {...turn, status: 'error', error: t('aiAdjust.preparation.interruptedHistory')}
                : ['confirm', 'revising', 'applyFailed'].includes(turn.status)
                  ? {...turn, status: 'superseded'}
                  : turn,
        ),
    );
    const [group, setGroup] = useState(() => (restoredTurns.length ? Math.max(...restoredTurns.map((turn) => turn.group)) + 1 : 0));
    const [historySaveFailed, setHistorySaveFailed] = useState(false);
    const [scrollReset, setScrollReset] = useState(0);
    const [editing, setEditing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const sequence = useRef(Math.max(0, ...restoredTurns.map((turn) => turn.id)));
    // Message IDs do not invalidate in-flight interpretation requests.
    const messageSequence = useRef(Math.min(0, ...restoredTurns.map((turn) => turn.id)));
    const lastAutofillId = useRef<number | undefined>(undefined);
    const dismissedAutofillIds = useRef(new Set<number>());
    const generationBefore = useRef(new Map<number, {doc: TDutyDoc; shift?: TShift}>());
    const adjustmentAttempt = useRef(Math.max(0, ...restoredTurns.map((turn) => turn.attempt ?? 0)));
    const busy = useRef(false);
    const mounted = useRef(true);
    const textarea = useRef<HTMLTextAreaElement>(null);
    const action = useRef<{fingerprint: string; key: string} | null>(null);
    const previousConditionsVersion = useRef(conditionsVersion);
    const lastTurn = turns[turns.length - 1];
    const active = lastTurn?.group === group ? lastTurn : undefined;

    useEffect(() => {
        setHistorySaveFailed(!writeScheduleChat(historyKey, turns.length ? turns : null));
    }, [historyKey, turns]);

    const hasRequestTurns = turns.some((turn) => turn.status !== 'messages');
    const flowCompleted = Boolean(generationCompleted && !noticeDismissed && !generationFailure);
    const waitingForGeneration = Boolean(
        autofillFlow?.kind !== 'adjustment' && autofillFlow?.status === 'running' && !generationCompleted && !generationFailure,
    );
    const paused = autofillFlow?.status === 'paused';
    const completedMessage = generationCompletedMessage ?? t('aiAdjust.generationCompleted');
    const isBusy = active?.status === 'interpreting' || active?.status === 'applying';
    const composerHidden =
        preparing || active?.status === 'applyFailed' || Boolean(generationFailure) || Boolean(onRegenerate && entryChoice !== 'modify');

    useEffect(() => {
        if (previousConditionsVersion.current === conditionsVersion) return;

        previousConditionsVersion.current = conditionsVersion;
        action.current = null;
        setTurns((current) =>
            current.map((turn) =>
                ['confirm', 'revising', 'applyFailed'].includes(turn.status) ? {...turn, status: 'superseded' as const} : turn,
            ),
        );
        setEditing(false);
    }, [conditionsVersion]);

    useEffect(() => {
        // A completed result can also be opened without an in-memory preparation history.
        const flow =
            autofillFlow ??
            (generationCompleted && !noticeDismissed && !generationFailure ? {id: -1, status: 'running' as const, messages: []} : null);

        if (!flow || dismissedAutofillIds.current.has(flow.id)) return;

        if (flow.status === 'completed') {
            // Restore display-only messages without erasing a recorded failure or
            // treating an interrupted request as a new executable action.
            setTurns((current) => {
                const existing = current.find((turn) => turn.autofillId === flow.id);

                if (existing && JSON.stringify(existing.messages) === JSON.stringify(flow.messages)) return current;

                if (existing) return current.map((turn) => (turn.id === existing.id ? {...turn, messages: flow.messages} : turn));

                return [
                    ...current,
                    {id: --messageSequence.current, group, text: '', status: 'messages', autofillId: flow.id, messages: flow.messages},
                ];
            });

            return;
        }

        if (flow.kind !== 'adjustment' && !generationCompleted && !generationFailure && !generationBefore.current.has(flow.id)) {
            generationBefore.current.set(flow.id, {
                doc: structuredClone(useShiftEditorStore.getState().doc),
                shift: snapshotShift ? structuredClone(snapshotShift) : undefined,
            });
        }

        const isNewAttempt = lastAutofillId.current !== flow.id;
        const messages = flow.messages;
        const completion =
            generationCompleted && !generationFailure ? {message: completedMessage, reviewRequired: generationReviewRequired} : undefined;

        if (isNewAttempt && flow.kind !== 'adjustment') {
            lastAutofillId.current = flow.id;
            setEntryChoice(null);
            setNoticeDismissed(false);
            setEditing(false);
            setError(null);
            action.current = null;
        }

        setTurns((current) => {
            const existing = current.find((turn) => turn.autofillId === flow.id);

            if (flow.kind === 'adjustment') {
                const target = existing ?? current.find((turn) => turn.status === 'applying');

                if (!target || target.messages === flow.messages) return current;

                return current.map((turn) => (turn.id === target.id ? {...turn, autofillId: flow.id, messages: flow.messages} : turn));
            }

            if (
                existing &&
                JSON.stringify(existing.messages) === JSON.stringify(messages) &&
                JSON.stringify(existing.completion) === JSON.stringify(completion) &&
                existing.error === generationFailure?.message &&
                (!generationCompleted || !!existing.snapshot)
            )
                return current;

            const event: TTurn = {
                id: existing?.id ?? --messageSequence.current,
                group: existing?.group ?? group,
                text: '',
                status: 'messages',
                autofillId: flow.id,
                messages,
                completion,
                snapshot:
                    existing?.snapshot ??
                    (generationCompleted && !generationFailure ? structuredClone(useShiftEditorStore.getState().doc) : undefined),
                snapshotShift: existing?.snapshotShift ?? (completion && snapshotShift ? structuredClone(snapshotShift) : undefined),
                snapshotBefore: existing?.snapshotBefore ?? generationBefore.current.get(flow.id)?.doc,
                snapshotBeforeShift: existing?.snapshotBeforeShift ?? generationBefore.current.get(flow.id)?.shift,
                error: generationFailure?.message,
                failure: generationFailure ?? undefined,
            };

            if (existing) return current.map((turn) => (turn.id === existing.id ? event : turn));

            return [
                ...current.map((turn) =>
                    turn.status === 'confirm' || turn.status === 'revising' ? {...turn, status: 'superseded' as const} : turn,
                ),
                event,
            ];
        });
    }, [
        autofillFlow,
        generationCompleted,
        generationFailure,
        noticeDismissed,
        completedMessage,
        generationReviewRequired,
        snapshotShift,
        group,
    ]);

    useEffect(() => {
        onBusyChange?.(isBusy);

        return () => onBusyChange?.(false);
    }, [isBusy, onBusyChange]);

    useEffect(() => {
        if (
            !generationFailure?.reviewFixed ||
            !onRecoverGeneration ||
            !open ||
            disabled ||
            isBusy ||
            preparing ||
            recoveredFailure.current === generationFailure
        )
            return;

        recoveredFailure.current = generationFailure;
        onRecoverGeneration();
    }, [generationFailure, onRecoverGeneration, open, disabled, isBusy, preparing]);

    const isConfirming = active?.status === 'confirm';
    const activeRequests = requests.filter((request) => request.status === 'ACTIVE');
    const hasRequestList = Boolean(requestList && (activeRequests.length || requestsLoading || requestsError));
    const updateTurn = (id: number, update: Partial<TTurn>) =>
        setTurns((current) => current.map((turn) => (turn.id === id ? {...turn, ...update} : turn)));

    useEffect(() => {
        mounted.current = true;

        return () => {
            mounted.current = false;
            sequence.current += 1;
        };
    }, []);
    useEffect(() => {
        if (editing && !isConfirming && !isBusy) textarea.current?.focus();
    }, [editing, isConfirming, isBusy]);

    useEffect(() => {
        if (entryChoice === 'modify' && !composerHidden) textarea.current?.focus();
    }, [entryChoice, composerHidden]);

    const fill = (sentence: string) => {
        if (disabled || busy.current) return;

        sequence.current += 1;
        setEntryChoice('modify');

        if (active?.status === 'confirm') {
            updateTurn(active.id, {status: 'revising'});
            setEditing(true);
        }

        setError(null);
        setText(sentence.slice(0, MAX_TEXT_LENGTH));
        textarea.current?.focus();
    };
    const replyToQuestion = (question: TReviewQuestion, value: TReviewValue) => {
        if (!active?.card || active.status !== 'confirm' || busy.current || disabled) return;

        const replies = active.replies ?? [];

        if (getReviewQuestions(active.card)[replies.length]?.id !== question.id) return;

        if (Array.isArray(value) && value.some((id) => !goalNurses.some((nurse) => nurse.nurseId === id))) return;

        const card = answerReviewQuestion(active.card, question, value);

        if (!card) return;

        action.current = null;
        updateTurn(active.id, {card, replies: [...replies, {questionId: question.id, value}], error: undefined});
        setText('');
        setError(null);
        textarea.current?.focus();
    };
    const handleSubmit = async (retryText?: string) => {
        const enteredText = (retryText ?? text).trim();
        const failedCard = active?.status === 'confirm' && !active.card?.items.length && !active.card?.llmPrompt ? active.card : undefined;
        const issueCodes = failedCard?.unmapped.map(interpretIssueCode) ?? [];
        const shortClarification =
            !editing &&
            !retryText &&
            failedCard &&
            ((issueCodes.includes('NURSE_NOT_RESOLVED') &&
                goalNurses.some(({name}) => name.replace(/\s/g, '') === enteredText.replace(/\s/g, ''))) ||
                (issueCodes.includes('SHIFT_NOT_RESOLVED') && shiftCodes?.includes(enteredText)) ||
                (issueCodes.includes('INVALID_DATE') && /^\d{1,2}(일|日)$/.test(enteredText)) ||
                (issueCodes.includes('INVALID_VALUE') && /^\d+\s*(회|번|일|回|日)?$/.test(enteredText)));
        const requestText = shortClarification ? `${failedCard.requestText}\n추가 설명: ${enteredText}` : enteredText;

        if (!requestText || disabled || busy.current) return;

        if (requestText.length > MAX_TEXT_LENGTH) {
            setError(t('aiAdjust.issue.tooLong'));

            return;
        }

        if (onRegenerate) setEntryChoice('modify');

        if (!retryText && !failedCard && isConfirming && active?.card) {
            const question = getReviewQuestions(active.card)[active.replies?.length ?? 0];
            const reply = parseReviewReply(question, requestText);

            if (question && reply !== null) {
                replyToQuestion(question, reply);

                return;
            }

            if (
                question?.kind === 'proposal' &&
                /^(아니요|아니오|수정할게요|수정할 게 있어요|아니요 수정할게요|no|no thanks|いいえ|修正します|変更します|いいえ修正します|いいえ変更します)$/i.test(
                    requestText.replace(/[,、，!.?。！？]/g, '').trim(),
                )
            ) {
                revise();

                return;
            }

            if (
                question?.kind === 'offDifference' &&
                /^[+-]?\d+(?:\.\d+)?\s*(일|日)?\s*(이내|이내로|로|以内|以内で|で)?[.!?。！？\s]*$/.test(requestText)
            ) {
                updateTurn(active.id, {followups: [...(active.followups ?? []), {text: requestText, reply: t('aiAdjust.chat.typeDays')}]});
                setText('');

                return;
            }

            if (
                [
                    '네',
                    '좋아요',
                    '반영해줘',
                    '반영해주세요',
                    '적용해줘',
                    '적용해주세요',
                    '좋아요반영해주세요',
                    '네반영해주세요',
                    'yes',
                    'apply',
                    'yesapplyit',
                    'はい',
                    'この内容で大丈夫です',
                    'はいこの内容で大丈夫です',
                    'この内容でお願いします',
                    'はいこの内容でお願いします',
                    'この内容だけ反映します',
                    'はいこの内容だけ反映します',
                    '反映してください',
                    '適用してください',
                    'はい反映してください',
                    'はい適用してください',
                    '変更内容を反映',
                ].includes(requestText.toLowerCase().replace(/[,、，!.?。！？\s]/g, ''))
            ) {
                if (isReviewComplete(active.card, active.replies ?? []) && (active.card.items.length || active.card.llmPrompt)) {
                    setText('');
                    await handleApply();
                } else {
                    updateTurn(active.id, {
                        followups: [...(active.followups ?? []), {text: requestText, reply: t('aiAdjust.chat.chooseAnswer')}],
                    });
                    setText('');
                }

                return;
            }
        }

        if (!retryText && !shortClarification && (editing || active?.card) && isIncompleteRevision(requestText)) {
            if (active)
                updateTurn(active.id, {followups: [...(active.followups ?? []), {text: requestText, reply: t('aiAdjust.chat.clarify')}]});

            setText('');

            return;
        }

        const id = ++sequence.current;

        busy.current = true;
        action.current = null;
        setError(null);
        setTurns((current) => [
            ...current.map((turn) =>
                turn.status === 'revising' || turn.status === 'confirm' ? {...turn, status: 'superseded' as const} : turn,
            ),
            {id, group, text: retryText ? t('aiAdjust.failure.retry') : enteredText, status: 'interpreting'},
        ]);
        setText('');

        try {
            const result = await interpret(requestText);

            if (!mounted.current || sequence.current !== id) return;

            const rewrite = result.generationIntent;
            if (
                rewrite &&
                onRegenerate &&
                !result.items?.length &&
                !result.unmapped?.length &&
                result.llmPrompt?.trim() &&
                Array.from(requestText).slice(rewrite.start, rewrite.end).join('') === rewrite.quote
            ) {
                updateTurn(id, {status: 'messages'});
                setText(requestText);
                onRegenerate(requestText);

                return;
            }

            updateTurn(id, {
                status: 'confirm',
                replies: [],
                card: {
                    requestText,
                    items: toCardItems(
                        result.items ?? [],
                        goalNurses.map((nurse) => nurse.nurseId),
                    ),
                    llmPrompt: result.llmPrompt?.trim() ? result.llmPrompt.trim() : undefined,
                    unmapped: result.unmapped ?? [],
                    strength: result.strength ?? 'NORMAL',
                    ...(result.observation ? {observation: result.observation} : {}),
                },
            });
            setEditing(false);
        } catch (cause) {
            if (!mounted.current || sequence.current !== id) return;

            const failure = aiConversationFailure(cause, t('aiAdjust.failed'));

            updateTurn(id, {status: 'error', error: failure.message});
            setText(requestText);
        } finally {
            if (sequence.current === id) busy.current = false;
        }
    };
    const handleApply = async () => {
        if (
            !active?.card ||
            !['confirm', 'applyFailed'].includes(active.status) ||
            !isReviewComplete(active.card, active.replies ?? []) ||
            disabled ||
            busy.current ||
            requestsLoading ||
            requestsError
        )
            return;

        const {card, id} = active;
        const requestSequence = sequence.current;

        if (!card.items.length && !card.llmPrompt) return;

        if (
            card.items.some(
                ({item}) =>
                    item.kind === 'GOAL' &&
                    (!item.goalType ||
                        !Number.isInteger(item.maxOffDifference) ||
                        (item.maxOffDifference ?? -1) < 0 ||
                        (item.maxOffDifference ?? 32) > 31 ||
                        !item.targetNurseIds?.length ||
                        (item.comparisonNurseIds?.length ?? 0) < 2),
            )
        ) {
            updateTurn(id, {error: t('aiAutofillUi.conversationConfirmation.confirmGoalDetails')});

            return;
        }

        const retrying = active.status === 'applyFailed';

        // A rejected candidate is a completed attempt. A new solve needs a fresh key;
        // transport failures retain their key to avoid a duplicate execution.
        if (retrying && active.failure?.recovery) action.current = null;

        const fingerprint = JSON.stringify(card);

        if (action.current?.fingerprint !== fingerprint) action.current = {fingerprint, key: uuid()};

        busy.current = true;
        updateTurn(id, {
            status: 'applying',
            attempt: ++adjustmentAttempt.current,
            snapshotBefore: structuredClone(useShiftEditorStore.getState().doc),
            snapshotBeforeShift: snapshotShift ? structuredClone(snapshotShift) : undefined,
            error: undefined,
            failure: undefined,
            reviewRequests: activeRequests,
            ...(retrying
                ? {
                      failedAttempts: [
                          ...(active.failedAttempts ?? []),
                          {
                              messages: active.messages ?? [],
                              failure: active.failure ?? {message: active.error ?? t('aiAdjust.failed'), blocked: false},
                              reply: t('aiAdjust.failure.retry'),
                              attempt: active.attempt,
                          },
                      ],
                      messages: undefined,
                      autofillId: undefined,
                  }
                : {}),
        });

        try {
            const result = await onApply(card.items, card.requestText, card.strength, card.llmPrompt, action.current.key);

            if (!mounted.current || sequence.current !== requestSequence) return;

            updateTurn(id, {
                status: 'applied',
                result: result ?? undefined,
                snapshot: structuredClone(useShiftEditorStore.getState().doc),
                snapshotShift: snapshotShift ? structuredClone(snapshotShift) : undefined,
            });
        } catch (cause) {
            if (!mounted.current || sequence.current !== requestSequence) return;

            const needsReview = (cause as {requiresReinterpret?: boolean})?.requiresReinterpret;
            const needsConfirmation = (cause as {requiresConfirmation?: boolean})?.requiresConfirmation;
            const failure = (cause as {failure?: TAiConversationFailure})?.failure ?? aiConversationFailure(cause, t('aiAdjust.failed'));

            updateTurn(id, {
                status: needsReview ? 'revising' : needsConfirmation ? 'confirm' : 'applyFailed',
                error: failure.message,
                failure,
            });

            if (needsReview) {
                setText(card.requestText);
                setEditing(true);
                action.current = null;
            }
        } finally {
            if (sequence.current === requestSequence) busy.current = false;
        }
    };
    const revise = () => {
        if (!active?.card || busy.current || disabled) return;

        if (active.status === 'applyFailed') {
            updateTurn(active.id, {
                status: 'revising',
                error: undefined,
                failure: undefined,
                autofillId: undefined,
                messages: undefined,
                failedAttempts: [
                    ...(active.failedAttempts ?? []),
                    {
                        messages: active.messages ?? [],
                        failure: active.failure ?? {message: active.error ?? t('aiAdjust.failed'), blocked: false},
                        reply: t('aiAdjust.issue.edit'),
                        attempt: active.attempt,
                    },
                ],
            });
            action.current = null;
            setEditing(true);
            setEntryChoice('modify');
            setText('');
            setError(null);

            return;
        }

        const question = getReviewQuestions(active.card)[active.replies?.length ?? 0];
        const failed = !active.card.items.length && !active.card.llmPrompt;

        updateTurn(active.id, {
            status: 'revising',
            error: undefined,
            messages: [
                ...(active.messages ?? []),
                {
                    role: 'user',
                    text: t(
                        failed
                            ? 'aiAdjust.issue.edit'
                            : question?.kind === 'proposal'
                              ? 'aiAdjust.chat.reviseProposal'
                              : 'aiAdjust.chat.reviseReply',
                    ),
                },
            ],
        });
        setEditing(true);
        setText('');
        setError(null);
        textarea.current?.focus();
    };
    const newConversation = () => {
        sequence.current += 1;
        busy.current = false;

        if (autofillFlow) dismissedAutofillIds.current.add(autofillFlow.id);
        else dismissedAutofillIds.current.add(-1);

        adjustmentAttempt.current = 0;
        generationBefore.current.clear();
        lastAutofillId.current = undefined;
        onDismissFailure?.();
        onNewConversation?.();
        setTurns([]);
        setEntryChoice(null);
        setNoticeDismissed(true);
        setGroup(0);
        setScrollReset((value) => value + 1);
        setText('');
        setEditing(false);
        setError(null);
        action.current = null;
        textarea.current?.focus();
    };

    useImperativeHandle(ref, () => ({fill, restart: newConversation}));

    const latestOutcome = [...turns]
        .reverse()
        .find((turn) => Boolean(turn.failure) || Boolean(turn.completion) || ['applied', 'applyFailed', 'error'].includes(turn.status));
    const latestFailed = Boolean(
        Boolean(generationFailure) ||
            Boolean(latestOutcome?.failure) ||
            Boolean(latestOutcome?.error) ||
            latestOutcome?.status === 'applyFailed' ||
            latestOutcome?.status === 'error',
    );
    const confirmation =
        !latestFailed && resultActions ? {...resultActions, disabled: Boolean(resultActions.disabled) || isBusy} : undefined;
    const reviseGeneration = () => {
        onDismissFailure?.();
        chooseNextAction('modify');
    };
    const canShowNextEntry = !preparation && !paused && !waitingForGeneration && !generationFailure && !entryChoice;
    const attachEntryToResult = Boolean(
        canShowNextEntry && onRegenerate && active?.status === 'messages' && active.snapshot && active.completion,
    );
    const chooseNextAction = (choice: TConversationEntryChoice) => {
        if (choice === 'edit') {
            setEntryChoice(null);
            onReviewSchedule?.();

            return;
        }

        setEntryChoice(choice);
        setTurns((current) => [
            ...current,
            {
                id: --messageSequence.current,
                group,
                text: '',
                status: 'messages',
                messages: [
                    ...(!flowCompleted && turns.length === 0
                        ? [
                              {
                                  role: 'assistant' as const,
                                  text: generationCompleted && !noticeDismissed ? completedMessage : t('aiAdjust.chat.welcome'),
                              },
                          ]
                        : []),
                    {role: 'user', text: t(`aiAdjust.chat.${choice}`)},
                    ...(choice === 'modify' ? [{role: 'assistant' as const, text: t('aiAdjust.chat.askChanges')}] : []),
                ],
            },
        ]);

        if (choice === 'regenerate') onRegenerate?.();
        else textarea.current?.focus();
    };
    const examples = [
        t('aiAdjust.offExample'),
        ...(goalNurses.length >= 2 && shiftCodes.includes('O')
            ? [t('aiAdjust.cellExample', {first: goalNurses[0]!.name, second: goalNurses[1]!.name})]
            : [t('aiAdjust.twoDayExample')]),
        t(shiftCodes.includes('D') && shiftCodes.includes('N') ? 'aiAdjust.patternExample' : 'aiAdjust.consecutiveExample'),
    ];

    return (
        <div className="ai-adjust-text-input flex min-h-0 flex-1 flex-col" data-preserve-duty-selection="true">
            {(historySaveFailed || composerSaveFailed) && (
                <p role="status" className="px-6 py-2 text-xs text-[#667085]">
                    {t('aiAdjust.preparation.historyUnavailable')}
                </p>
            )}
            <AiChatScroll
                historyKey={historyKey ? `${historyKey}:scroll` : null}
                resetKey={scrollReset}
                open={open}
                composerHidden={composerHidden}
                className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-[25px] pt-8 pb-6"
            >
                {turns.length > 0 && (
                    <div role="log" aria-label={t('aiAdjust.title')} aria-live="polite" className="flex min-w-0 flex-col gap-6">
                        {turns.map((turn, index) => (
                            <div key={turn.id} className="flex min-w-0 flex-col gap-4">
                                {index > 0 && turn.group !== turns[index - 1]?.group && (
                                    <p className="text-center text-[13px] text-[#475467]">{t('aiAdjust.newConversation')}</p>
                                )}

                                {turn.text && (
                                    <UserMessage>
                                        <p className="whitespace-pre-wrap">{turn.text}</p>
                                    </UserMessage>
                                )}
                                {turn.card && (
                                    <AiAdjustReviewConversation
                                        card={turn.card}
                                        replies={turn.replies ?? []}
                                        nurses={goalNurses}
                                        editable={turn.status === 'confirm' && turn.id === active?.id}
                                        historical={turn.id !== active?.id || ['revising', 'superseded', 'undone'].includes(turn.status)}
                                        accepted={
                                            ['applying', 'applyFailed', 'applied', 'undone'].includes(turn.status) ||
                                            Boolean(turn.failedAttempts?.length)
                                        }
                                        disabled={disabled || isBusy}
                                        applyDisabled={requestsLoading || requestsError}
                                        onReply={replyToQuestion}
                                        onEditReply={(index) => {
                                            if (disabled || busy.current || turn.id !== active?.id) return;

                                            action.current = null;
                                            updateTurn(turn.id, {replies: (turn.replies ?? []).slice(0, index), error: undefined});
                                        }}
                                        onApply={() => void handleApply()}
                                        onRevise={revise}
                                        onRetry={() => void handleSubmit(turn.card!.requestText)}
                                        beforeApply={
                                            <>
                                                {(turn.status === 'confirm' ? activeRequests : (turn.reviewRequests ?? [])).length > 0 && (
                                                    <div className="mb-3 space-y-1 text-[13px] text-[#475467]">
                                                        <p>
                                                            {t('aiAdjust.existing', {
                                                                count: (turn.status === 'confirm'
                                                                    ? activeRequests
                                                                    : (turn.reviewRequests ?? [])
                                                                ).length,
                                                            })}
                                                        </p>
                                                        {(turn.status === 'confirm' ? activeRequests : (turn.reviewRequests ?? [])).map(
                                                            (request) => (
                                                                <p key={request.id}>
                                                                    {request.displayLabel} ·{' '}
                                                                    {t(`page.makeShift.aiRefill.adjust.lifetime.${request.lifetime}`)}
                                                                </p>
                                                            ),
                                                        )}
                                                    </div>
                                                )}
                                                {turn.status === 'confirm' && requestsLoading && (
                                                    <AiConversationLoading label={t('aiAdjust.requestsLoading')} className="mb-3" />
                                                )}
                                                {turn.status === 'confirm' && requestsError && (
                                                    <div className="mb-3">
                                                        <p role="alert">{t('aiAdjust.requestsFailed')}</p>
                                                        <button
                                                            type="button"
                                                            onClick={onRetryRequests}
                                                            className="mt-2 min-h-11 rounded-lg bg-white px-3 text-main-1 focus-visible:bg-main-1 focus-visible:text-white focus-visible:outline-none"
                                                        >
                                                            {t('aiAdjust.requestsRetry')}
                                                        </button>
                                                    </div>
                                                )}
                                            </>
                                        }
                                    />
                                )}
                                {turn.failedAttempts?.map((attempt, index) => (
                                    <div key={index} className="flex min-w-0 flex-col gap-4">
                                        <AiAutofillMessages messages={attempt.messages} />
                                        <AiExecutionFailure
                                            operationType="ADJUST"
                                            failure={attempt.failure}
                                            attemptLabel={attemptLabel(attempt.attempt ?? index + 1)}
                                        />
                                        <UserMessage>{attempt.reply}</UserMessage>
                                    </div>
                                ))}
                                {turn.messages && <AiAutofillMessages messages={turn.messages} />}
                                {turn.snapshot && turn.status === 'messages' && (
                                    <AiResultSnapshot
                                        doc={turn.snapshot}
                                        shift={turn.snapshotShift}
                                        before={turn.snapshotBefore}
                                        beforeShift={turn.snapshotBeforeShift}
                                        changedCount={snapshotChangedCount(turn.snapshotBefore, turn.snapshot)}
                                        title={
                                            turn.completion?.reviewRequired ? t('aiAdjust.reviewDraft.completed') : turn.completion?.message
                                        }
                                        reviewRequired={turn.completion?.reviewRequired}
                                        description={
                                            turn.completion?.reviewRequired
                                                ? turn.completion.message === t('aiAdjust.reviewDraft.completed')
                                                    ? t('aiAdjust.reviewDraft.next')
                                                    : turn.completion.message
                                                : undefined
                                        }
                                        attempt={
                                            turns
                                                .slice(0, index + 1)
                                                .filter((entry) => entry.status === 'messages' && (entry.completion ?? entry.failure))
                                                .length
                                        }
                                    >
                                        {attachEntryToResult && turn.id === active?.id && (
                                            <AiConversationEntry
                                                choice={null}
                                                attached
                                                hideIntro
                                                disabled={disabled || isBusy}
                                                modifyDisabled={modifyDisabled}
                                                onChoose={chooseNextAction}
                                            />
                                        )}
                                    </AiResultSnapshot>
                                )}
                                {turn.status === 'applyFailed' && turn.failure && (
                                    <AiExecutionFailure
                                        operationType="ADJUST"
                                        attemptLabel={attemptLabel(turn.attempt ?? 1)}
                                        failure={turn.failure}
                                        detailsInChildren={Boolean(renderConflictReview) && turn.id === active?.id}
                                        settingsHref={settingsHref}
                                        onEditSettings={settingsAction(turn.failure)}
                                        active={turn.id === active?.id}
                                        disabled={disabled || isBusy || requestsLoading || requestsError}
                                        onRetry={() => void handleApply()}
                                        onRevise={revise}
                                        onReview={onReviewSchedule}
                                        onInspectSchedule={onReviewSchedule}
                                    >
                                        {turn.id === active?.id && renderConflictReview?.(revise, settingsAction(turn.failure))}
                                    </AiExecutionFailure>
                                )}
                                {(turn.status === 'interpreting' || (turn.status === 'applying' && !preparing && !paused)) && (
                                    <AssistantMessage>
                                        <AiConversationLoading
                                            label={t(turn.status === 'applying' ? 'aiAdjust.applying' : 'aiAdjust.reviewing')}
                                        />
                                    </AssistantMessage>
                                )}
                                {turn.status === 'error' && turn.error && <AiFailureMessage message={turn.error} />}
                                {turn.status === 'revising' && (
                                    <AssistantMessage>
                                        <p>{t('aiAdjust.issue.editHint')}</p>
                                    </AssistantMessage>
                                )}
                                {turn.followups?.map((message, index) => (
                                    <div key={index} className="flex flex-col gap-4">
                                        <UserMessage>{message.text}</UserMessage>
                                        <AssistantMessage>{message.reply}</AssistantMessage>
                                    </div>
                                ))}
                                {turn.status === 'applied' && (
                                    <AiAdjustResult
                                        result={turn.result}
                                        attempt={turn.attempt}
                                        preview={
                                            turn.snapshot && (
                                                <AiResultSnapshot
                                                    doc={turn.snapshot}
                                                    shift={turn.snapshotShift}
                                                    before={turn.snapshotBefore}
                                                    beforeShift={turn.snapshotBeforeShift}
                                                />
                                            )
                                        }
                                        active={turn.id === active?.id}
                                        disabled={(resultActions?.disabled ?? disabled) || isBusy || preparing || paused}
                                        modifyDisabled={disabled}
                                        actions={resultActions}
                                        canUndo={Boolean(onUndo) && currentRevision === turn.result?.undoRevision}
                                        onUndo={async () => {
                                            if (turn.result?.undoRevision !== undefined && (await onUndo?.(turn.result.undoRevision)))
                                                updateTurn(turn.id, {status: 'undone'});
                                        }}
                                        onModify={() => {
                                            setEditing(false);
                                            chooseNextAction('modify');
                                        }}
                                        onEditSchedule={onReviewSchedule}
                                    />
                                )}
                                {turn.status === 'undone' && (
                                    <AssistantMessage>
                                        <p>{t('aiAdjust.undone')}</p>
                                        <p className="mt-2 text-[13px] text-[#475467]">{t('aiAdjust.undoNote')}</p>
                                    </AssistantMessage>
                                )}
                                {turn.error && turn.status === 'messages' && (
                                    <AiExecutionFailure
                                        operationType="GENERATE"
                                        attemptLabel={attemptLabel(
                                            turns
                                                .slice(0, index + 1)
                                                .filter((entry) => entry.status === 'messages' && (entry.completion ?? entry.failure))
                                                .length,
                                        )}
                                        failure={turn.failure ?? {message: turn.error, blocked: false}}
                                        detailsInChildren={Boolean(renderConflictReview) && turn.id === active?.id}
                                        settingsHref={settingsHref}
                                        onEditSettings={settingsAction(turn.failure)}
                                        active={turn.id === active?.id && Boolean(generationFailure)}
                                        disabled={disabled || isBusy}
                                        onRetry={onRegenerate}
                                        onRevise={modifyDisabled ? undefined : reviseGeneration}
                                        onReview={turn.failure?.reviewFixed && onRecoverGeneration ? onRecoverGeneration : onReviewSchedule}
                                        reviewLabel={
                                            turn.failure?.reviewFixed && onRecoverGeneration
                                                ? t('aiAdjust.preparation.reviewFixed')
                                                : undefined
                                        }
                                        onInspectSchedule={onReviewSchedule}
                                    >
                                        {turn.id === active?.id && renderConflictReview?.(reviseGeneration, settingsAction(turn.failure))}
                                    </AiExecutionFailure>
                                )}
                                {turn.error && turn.status !== 'messages' && turn.status !== 'error' && turn.status !== 'applyFailed' && (
                                    <AssistantMessage>
                                        <p role="alert" className="text-red">
                                            {turn.error}
                                        </p>
                                    </AssistantMessage>
                                )}
                            </div>
                        ))}
                        {!active && !restoredTurns.length && <AssistantMessage>{t('aiAdjust.chat.restarted')}</AssistantMessage>}
                    </div>
                )}
                {preparation && (
                    <div className="mt-4" aria-live="polite">
                        {preparation}
                    </div>
                )}
                {attachEntryToResult && confirmation && (
                    <div className="mt-3">
                        <AiConversationConfirmation confirmation={confirmation} />
                    </div>
                )}
                {canShowNextEntry &&
                    !attachEntryToResult &&
                    (onRegenerate ? (
                        <div className="mt-6">
                            <AiConversationEntry
                                choice={null}
                                disabled={disabled || isBusy}
                                modifyDisabled={modifyDisabled}
                                hideIntro={flowCompleted || turns.length > 0}
                                hasSchedule={hasGeneratedSchedule}
                                generationCompleted={generationCompleted && !noticeDismissed}
                                generationCompletedMessage={completedMessage}
                                confirmation={confirmation}
                                onChoose={chooseNextAction}
                            />
                        </div>
                    ) : (
                        turns.length === 0 && (
                            <AssistantMessage>
                                <span className="whitespace-pre-line">
                                    {generationCompleted && !noticeDismissed ? completedMessage : t('aiAdjust.chat.askChanges')}
                                </span>
                            </AssistantMessage>
                        )
                    ))}
                {generationFailure && !autofillFlow && (
                    <AiExecutionFailure
                        operationType="GENERATE"
                        attemptLabel={attemptLabel(1)}
                        failure={generationFailure}
                        detailsInChildren={Boolean(renderConflictReview)}
                        settingsHref={settingsHref}
                        onEditSettings={settingsAction(generationFailure)}
                        reviewLabel={
                            generationFailure.reviewFixed && onRecoverGeneration ? t('aiAdjust.preparation.reviewFixed') : undefined
                        }
                        active
                        disabled={disabled || isBusy}
                        onRetry={onRegenerate}
                        onRevise={modifyDisabled ? undefined : reviseGeneration}
                        onReview={generationFailure.reviewFixed && onRecoverGeneration ? onRecoverGeneration : onReviewSchedule}
                        onInspectSchedule={onReviewSchedule}
                    >
                        {renderConflictReview?.(reviseGeneration, settingsAction(generationFailure))}
                    </AiExecutionFailure>
                )}
                {!hideRestartButton &&
                    !preparation &&
                    !waitingForGeneration &&
                    (turns.length > 0 || Boolean(entryChoice) || Boolean(generationFailure)) && (
                        <div className="mt-5 flex justify-center">
                            <button
                                type="button"
                                onClick={newConversation}
                                className="min-h-11 rounded-lg px-3 text-[13px] text-[#475467] hover:bg-[#F2F4F6] hover:text-main-1 focus-visible:bg-main-light focus-visible:text-main-1 focus-visible:outline-none disabled:opacity-40"
                            >
                                {t('aiAdjust.chat.restart')}
                            </button>
                        </div>
                    )}
                {conversationActions && <div className="mt-6">{conversationActions}</div>}
            </AiChatScroll>
            <div
                className={composerHidden ? 'hidden' : 'relative z-10 flex max-h-[60%] min-h-0 shrink-0 flex-col px-6 pt-3 pb-12'}
                inert={composerHidden}
                aria-hidden={composerHidden}
            >
                {!generationFailure && !hasRequestTurns && (!onRegenerate || entryChoice === 'modify') && (
                    <div className="ai-adjust-examples mb-4 flex shrink-0 flex-col gap-2">
                        <p className="px-1.5 text-[13px] font-medium text-main-1">{t('aiAdjust.examples')}</p>
                        {examples.map((sentence) => (
                            <button
                                key={sentence}
                                type="button"
                                disabled={disabled || isBusy}
                                onClick={() => fill(sentence)}
                                className="flex min-h-10 w-full items-center justify-between gap-2 rounded-[5px] bg-gray-7 px-3 py-2 text-left text-[13px] leading-5 break-keep text-[#475467] hover:bg-main-light hover:text-main-1 disabled:opacity-50"
                            >
                                <span>{sentence}</span>
                                <img src={nextIcon} alt="" width={22} height={22} className="shrink-0" />
                            </button>
                        ))}
                    </div>
                )}

                {error && (
                    <p role="alert" className="mb-2 text-[13px] text-red">
                        {error}
                    </p>
                )}
                <div className="ai-adjust-composer shrink-0">
                    {requestList}
                    <div
                        className={`flex min-h-[90px] flex-col rounded-[14px] ${hasRequestList ? 'rounded-t-none' : ''} border-[1.8px] border-[#DCE2EB] px-4 py-3 focus-within:border-main-1 focus-within:bg-main-light focus-within:text-main-1 ${text ? 'bg-main-light' : 'bg-gray-7'}`}
                    >
                        <textarea
                            ref={textarea}
                            value={text}
                            onChange={(event) => setText(event.target.value.slice(0, MAX_TEXT_LENGTH))}
                            onKeyDown={(event) => {
                                event.stopPropagation();

                                if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
                                    event.preventDefault();
                                    void handleSubmit();
                                }
                            }}
                            onPaste={(event) => event.stopPropagation()}
                            disabled={disabled || isBusy}
                            rows={2}
                            maxLength={MAX_TEXT_LENGTH}
                            aria-label={t('page.makeShift.aiRefill.adjust.textInput.label')}
                            placeholder={t(turns.length ? 'aiAdjust.chat.replyPlaceholder' : 'aiAdjust.placeholder')}
                            className="text-gray-1 w-full resize-none bg-transparent text-[14.5px] leading-6 outline-none placeholder:text-[#475467] disabled:opacity-50"
                        />
                        <div className="flex items-center justify-between gap-2">
                            <span className="text-[10px] text-[#475467]">
                                {text.length > 400 ? `${text.length}/${MAX_TEXT_LENGTH}` : ''}
                            </span>
                            <button
                                type="button"
                                aria-label={t('aiAdjust.send')}
                                disabled={disabled || isBusy || !text.trim()}
                                onClick={() => void handleSubmit()}
                                className="grid size-11 shrink-0 place-items-center rounded-[10px] bg-main-1 focus-visible:bg-[#4620B8] focus-visible:outline-none disabled:bg-gray-3"
                            >
                                <img src={sendIcon} alt="" width={22} height={22} className="rotate-90" />
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
