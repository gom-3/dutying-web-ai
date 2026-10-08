import type {
    TAutofillAdjustStrength,
    TScheduleAdjustInterpretRes,
    TScheduleMonthRequestItem,
    TScheduleMonthRequestRes,
} from '@dutying/api/ward';
import {useEffect, useImperativeHandle, useRef, useState, type ReactNode, type Ref} from 'react';
import {v4 as uuid} from 'uuid';
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
import type {TInterpretCardItem} from '../../../model/schedule-month-requests';
import type {TAdjustCard} from './ai-adjust-interpret-card';
import {AiAdjustResult, type TAdjustResultActions} from './ai-adjust-result';
import {AiAdjustReviewConversation, AssistantMessage, UserMessage} from './ai-adjust-review-conversation';
import {AiAutofillMessages, type TAutofillFlow, type TAutofillMessage} from './ai-autofill-preparation';
import {AiChatScroll} from './ai-chat-scroll';
import {AiConversationEntry, type TConversationEntryChoice} from './ai-conversation-entry';
import {AiExecutionFailure} from './ai-execution-failure';
import {AiFailureMessage} from './ai-failure-message';

const MAX_TEXT_LENGTH = 500;

export type TAdjustTextInputHandle = {fill: (sentence: string) => void; restart: () => void};
export type TAdjustApply = (
    items: TInterpretCardItem[],
    requestText: string,
    strength: TAutofillAdjustStrength,
    llmPrompt?: string,
    actionKey?: string,
) => Promise<TAdjustApplyResult | void> | void;
type TProps = {
    disabled: boolean;
    modifyDisabled?: boolean;
    open?: boolean;
    preparation?: ReactNode;
    autofillFlow?: TAutofillFlow | null;
    onNewConversation?: () => void;
    onReviewSchedule?: () => void;
    hideRestartButton?: boolean;
    onBusyChange?: (busy: boolean) => void;
    interpret: (text: string) => Promise<TScheduleAdjustInterpretRes>;
    onApply: TAdjustApply;
    goalNurses: {nurseId: number; name: string}[];
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
    generationFailure?: TAiConversationFailure | null;
    onDismissFailure?: () => void;
    onRegenerate?: () => void;
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
    error?: string;
    failure?: TAiConversationFailure;
    failedAttempts?: {messages: TAutofillMessage[]; failure: TAiConversationFailure; reply: string}[];
    replies?: TReviewReply[];
    followups?: {text: string; reply: string}[];
    reviewRequests?: TScheduleMonthRequestRes[];
};

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
    onNewConversation,
    onReviewSchedule,
    hideRestartButton = false,
    onBusyChange,
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
    generationFailure,
    onDismissFailure,
    onRegenerate,
    ref,
}: TProps) {
    const {t} = useTypedTranslation();
    const preparing = Boolean(preparation);
    const [text, setText] = useState('');
    const [noticeDismissed, setNoticeDismissed] = useState(false);
    const [entryChoice, setEntryChoice] = useState<TConversationEntryChoice | null>(null);
    const [turns, setTurns] = useState<TTurn[]>([]);
    const [group, setGroup] = useState(0);
    const [editing, setEditing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const sequence = useRef(0);
    // Message IDs do not invalidate in-flight interpretation requests.
    const messageSequence = useRef(0);
    const lastAutofillId = useRef<number | undefined>(undefined);
    const busy = useRef(false);
    const mounted = useRef(true);
    const textarea = useRef<HTMLTextAreaElement>(null);
    const action = useRef<{fingerprint: string; key: string} | null>(null);
    const lastTurn = turns[turns.length - 1];
    const active = lastTurn?.group === group ? lastTurn : undefined;
    const hasRequestTurns = turns.some((turn) => turn.status !== 'messages');
    const flowCompleted = Boolean(autofillFlow && generationCompleted && !noticeDismissed);
    const waitingForGeneration = Boolean(
        autofillFlow?.kind !== 'adjustment' && autofillFlow?.status === 'running' && !generationCompleted && !generationFailure,
    );
    const paused = autofillFlow?.status === 'paused';
    const completedMessage = t('aiAdjust.generationCompleted');
    const isBusy = active?.status === 'interpreting' || active?.status === 'applying';
    const composerHidden =
        preparing || active?.status === 'applyFailed' || Boolean(generationFailure) || Boolean(onRegenerate && entryChoice !== 'modify');
    useEffect(() => {
        if (!autofillFlow) return;

        const isNewAttempt = lastAutofillId.current !== autofillFlow.id;
        const messages: TAutofillMessage[] = [
            ...autofillFlow.messages,
            ...(generationCompleted ? [{role: 'assistant' as const, text: completedMessage}] : []),
        ];

        if (isNewAttempt && autofillFlow.kind !== 'adjustment') {
            lastAutofillId.current = autofillFlow.id;
            setEntryChoice(null);
            setNoticeDismissed(false);
            setEditing(false);
            setError(null);
            action.current = null;
        }

        setTurns((current) => {
            const existing = current.find((turn) => turn.autofillId === autofillFlow.id);

            if (autofillFlow.kind === 'adjustment') {
                const target = existing ?? current.find((turn) => turn.status === 'applying');

                if (!target || target.messages === autofillFlow.messages) return current;

                return current.map((turn) =>
                    turn.id === target.id ? {...turn, autofillId: autofillFlow.id, messages: autofillFlow.messages} : turn,
                );
            }

            if (existing && JSON.stringify(existing.messages) === JSON.stringify(messages) && existing.error === generationFailure?.message)
                return current;

            const event: TTurn = {
                id: existing?.id ?? --messageSequence.current,
                group: existing?.group ?? group,
                text: '',
                status: 'messages',
                autofillId: autofillFlow.id,
                messages,
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
    }, [autofillFlow, generationCompleted, generationFailure, completedMessage, group]);

    useEffect(() => {
        onBusyChange?.(isBusy);
        return () => onBusyChange?.(false);
    }, [isBusy, onBusyChange]);

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
                (issueCodes.includes('INVALID_DATE') && /^\d{1,2}일$/.test(enteredText)) ||
                (issueCodes.includes('INVALID_VALUE') && /^\d+\s*(회|번|일)?$/.test(enteredText)));
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
                /^(아니요|아니오|수정할게요|수정할 게 있어요|아니요 수정할게요|no|no thanks)$/i.test(
                    requestText.replace(/[,!.?]/g, '').trim(),
                )
            ) {
                revise();
                return;
            }
            if (question?.kind === 'offDifference' && /^[+-]?\d+(?:\.\d+)?\s*(일)?\s*(이내|이내로|로)?[.!?\s]*$/.test(requestText)) {
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
                ].includes(requestText.toLowerCase().replace(/[,!.?\s]/g, ''))
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
            updateTurn(id, {error: '목표 대상, 비교 집단, 오프 차이 허용치를 모두 확인해 주세요.'});

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

            updateTurn(id, {status: 'applied', result: result ?? undefined});
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
        lastAutofillId.current = undefined;
        onDismissFailure?.();
        onNewConversation?.();
        setTurns([]);
        setEntryChoice(null);
        setNoticeDismissed(true);
        setGroup(0);
        setText('');
        setEditing(false);
        setError(null);
        action.current = null;
        textarea.current?.focus();
    };

    useImperativeHandle(ref, () => ({fill, restart: newConversation}));

    const examples = [
        t('aiAdjust.offExample'),
        ...(goalNurses.length >= 2 && shiftCodes.includes('O')
            ? [t('aiAdjust.cellExample', {first: goalNurses[0]!.name, second: goalNurses[1]!.name})]
            : [t('aiAdjust.twoDayExample')]),
        t(shiftCodes.includes('D') && shiftCodes.includes('N') ? 'aiAdjust.patternExample' : 'aiAdjust.consecutiveExample'),
    ];

    return (
        <div className="ai-adjust-text-input flex min-h-0 flex-1 flex-col" data-preserve-duty-selection="true">
            <AiChatScroll
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
                                                    <p role="status">{t('aiAdjust.requestsLoading')}</p>
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
                                        <AiExecutionFailure operationType="ADJUST" failure={attempt.failure} />
                                        <UserMessage>{attempt.reply}</UserMessage>
                                    </div>
                                ))}
                                {turn.messages && <AiAutofillMessages messages={turn.messages} />}
                                {turn.status === 'applyFailed' && turn.failure && (
                                    <AiExecutionFailure
                                        operationType="ADJUST"
                                        failure={turn.failure}
                                        active={turn.id === active?.id}
                                        disabled={disabled || isBusy || requestsLoading || requestsError}
                                        onRetry={() => void handleApply()}
                                        onRevise={revise}
                                        onReview={onReviewSchedule}
                                    />
                                )}
                                {(turn.status === 'interpreting' || (turn.status === 'applying' && !preparing && !paused)) && (
                                    <AssistantMessage>
                                        <p
                                            role="status"
                                            aria-label={t(turn.status === 'applying' ? 'aiAdjust.applying' : 'aiAdjust.reviewing')}
                                            className="flex min-h-7 items-center"
                                        >
                                            <span aria-hidden="true" className="flex w-[23px] shrink-0 items-center gap-1">
                                                <span className="ai-adjust-review-dot size-[5px] rounded-full bg-main-1" />
                                                <span className="ai-adjust-review-dot size-[5px] rounded-full bg-main-1" />
                                                <span className="ai-adjust-review-dot size-[5px] rounded-full bg-main-1" />
                                            </span>
                                        </p>
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
                                            setEntryChoice('modify');
                                            setTurns((current) => [
                                                ...current,
                                                {
                                                    id: --messageSequence.current,
                                                    group,
                                                    text: '',
                                                    status: 'messages',
                                                    messages: [
                                                        {role: 'user', text: t('aiAdjust.modifyMore')},
                                                        {role: 'assistant', text: t('aiAdjust.chat.askChanges')},
                                                    ],
                                                },
                                            ]);
                                            textarea.current?.focus();
                                        }}
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
                                        failure={turn.failure ?? {message: turn.error, blocked: false}}
                                        active={turn.id === active?.id && Boolean(generationFailure)}
                                        disabled={disabled || isBusy}
                                        onRetry={onRegenerate}
                                        onReview={onReviewSchedule}
                                    />
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
                        {!active && <AssistantMessage>{t('aiAdjust.chat.restarted')}</AssistantMessage>}
                    </div>
                )}
                {preparation && (
                    <div className="mt-4" aria-live="polite">
                        {preparation}
                    </div>
                )}
                {!preparation &&
                    !paused &&
                    !waitingForGeneration &&
                    !generationFailure &&
                    !entryChoice &&
                    (onRegenerate ? (
                        <div className="mt-6">
                            <AiConversationEntry
                                choice={null}
                                disabled={disabled || isBusy}
                                modifyDisabled={modifyDisabled}
                                hideIntro={flowCompleted}
                                generationCompleted={generationCompleted && !noticeDismissed}
                                confirmation={resultActions && {...resultActions, disabled: resultActions.disabled || isBusy}}
                                onChoose={(choice) => {
                                    setEntryChoice(choice);
                                    setTurns((current) => [
                                        ...current,
                                        {
                                            id: --messageSequence.current,
                                            group,
                                            text: '',
                                            status: 'messages',
                                            messages: [
                                                ...(!flowCompleted
                                                    ? [
                                                          {
                                                              role: 'assistant' as const,
                                                              text: t(
                                                                  generationCompleted && !noticeDismissed
                                                                      ? 'aiAdjust.generationCompleted'
                                                                      : 'aiAdjust.chat.welcome',
                                                              ),
                                                          },
                                                      ]
                                                    : []),
                                                {role: 'user', text: t(`aiAdjust.chat.${choice}`)},
                                                ...(choice === 'modify'
                                                    ? [{role: 'assistant' as const, text: t('aiAdjust.chat.askChanges')}]
                                                    : []),
                                            ],
                                        },
                                    ]);

                                    if (choice === 'regenerate') onRegenerate();
                                    else textarea.current?.focus();
                                }}
                            />
                        </div>
                    ) : (
                        turns.length === 0 && (
                            <AssistantMessage>
                                <span className="whitespace-pre-line">
                                    {t(
                                        generationCompleted && !noticeDismissed
                                            ? 'aiAdjust.generationCompleted'
                                            : 'aiAdjust.chat.askChanges',
                                    )}
                                </span>
                            </AssistantMessage>
                        )
                    ))}
                {generationFailure && !autofillFlow && (
                    <AiExecutionFailure
                        operationType="GENERATE"
                        failure={generationFailure}
                        active
                        disabled={disabled || isBusy}
                        onRetry={onRegenerate}
                        onReview={onReviewSchedule}
                    />
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
