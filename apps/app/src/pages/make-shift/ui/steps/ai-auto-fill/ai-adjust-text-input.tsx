import type {
    TAutofillAdjustStrength,
    TScheduleAdjustInterpretRes,
    TScheduleMonthRequestItem,
    TScheduleMonthRequestRes,
} from '@dutying/api/ward';
import {useEffect, useImperativeHandle, useRef, useState, type ReactNode, type Ref} from 'react';
import {v4 as uuid} from 'uuid';
import assistantIcon from '@/shared/assets/images/ai-adjust/assistant.svg';
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
import type {TInterpretCardItem} from '../../../model/schedule-month-requests';
import type {TAdjustCard} from './ai-adjust-interpret-card';
import {AiAdjustReviewConversation, AssistantMessage, UserMessage} from './ai-adjust-review-conversation';

const MAX_TEXT_LENGTH = 500;

export type TAdjustTextInputHandle = {fill: (sentence: string) => void};
export type TAdjustApply = (
    items: TInterpretCardItem[],
    requestText: string,
    strength: TAutofillAdjustStrength,
    llmPrompt?: string,
    actionKey?: string,
) => Promise<TAdjustApplyResult | void> | void;
type TProps = {
    disabled: boolean;
    interpret: (text: string) => Promise<TScheduleAdjustInterpretRes>;
    onApply: TAdjustApply;
    goalNurses: {nurseId: number; name: string}[];
    shiftCodes?: string[];
    requests?: TScheduleMonthRequestRes[];
    requestsLoading?: boolean;
    requestsError?: boolean;
    onRetryRequests?: () => void;
    onUndo?: (revision: number) => Promise<boolean> | boolean;
    currentRevision?: number;
    requestList?: ReactNode;
    conversationActions?: ReactNode;
    generationCompleted?: boolean;
    ref?: Ref<TAdjustTextInputHandle>;
};
type TTurn = {
    id: number;
    group: number;
    text: string;
    card?: TAdjustCard;
    status: 'interpreting' | 'confirm' | 'revising' | 'superseded' | 'applying' | 'applied' | 'undone' | 'error';
    result?: TAdjustApplyResult;
    error?: string;
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
    interpret,
    onApply,
    goalNurses,
    shiftCodes = [],
    requests = [],
    requestsLoading = false,
    requestsError = false,
    onRetryRequests,
    onUndo,
    currentRevision,
    requestList,
    conversationActions,
    generationCompleted = false,
    ref,
}: TProps) {
    const {t} = useTypedTranslation();
    const [text, setText] = useState('');
    const [turns, setTurns] = useState<TTurn[]>([]);
    const [group, setGroup] = useState(0);
    const [editing, setEditing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const sequence = useRef(0);
    const busy = useRef(false);
    const mounted = useRef(true);
    const textarea = useRef<HTMLTextAreaElement>(null);
    const scroll = useRef<HTMLDivElement>(null);
    const action = useRef<{fingerprint: string; key: string} | null>(null);
    const lastTurn = turns[turns.length - 1];
    const lastTurnId = lastTurn?.id;
    const lastTurnStatus = lastTurn?.status;
    const lastReplyCount = lastTurn?.replies?.length ?? 0;
    const lastFollowupCount = lastTurn?.followups?.length ?? 0;
    const active = lastTurn?.group === group ? lastTurn : undefined;
    const isBusy = active?.status === 'interpreting' || active?.status === 'applying';
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
        scroll.current?.scrollTo?.({top: lastTurnId === undefined ? 0 : scroll.current.scrollHeight, behavior: 'instant'});
    }, [lastTurnId, lastTurnStatus, lastReplyCount, lastFollowupCount, group]);
    useEffect(() => {
        if (editing && !isConfirming && !isBusy) textarea.current?.focus();
    }, [editing, isConfirming, isBusy]);

    const fill = (sentence: string) => {
        if (disabled || busy.current) return;

        sequence.current += 1;

        if (active?.status === 'confirm') {
            updateTurn(active.id, {status: 'revising'});
            setEditing(true);
        }

        setError(null);
        setText(sentence.slice(0, MAX_TEXT_LENGTH));
        textarea.current?.focus();
    };

    useImperativeHandle(ref, () => ({fill}));

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

    const handleSubmit = async () => {
        const requestText = text.trim();

        if (!requestText || disabled || busy.current) return;

        if (isConfirming && active?.card) {
            const question = getReviewQuestions(active.card)[active.replies?.length ?? 0];
            const reply = parseReviewReply(question, requestText);
            if (question && reply !== null) {
                replyToQuestion(question, reply);
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

        if ((editing || active?.card) && isIncompleteRevision(requestText)) {
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
            {id, group, text: requestText, status: 'interpreting'},
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

            updateTurn(id, {status: 'error', error: cause instanceof Error ? cause.message : t('aiAdjust.failed')});
            setText(requestText);
        } finally {
            if (sequence.current === id) busy.current = false;
        }
    };
    const handleApply = async () => {
        if (
            !active?.card ||
            active.status !== 'confirm' ||
            !isReviewComplete(active.card, active.replies ?? []) ||
            disabled ||
            busy.current ||
            requestsLoading ||
            requestsError
        )
            return;

        const {card, id} = active;

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

        const fingerprint = JSON.stringify(card);

        if (action.current?.fingerprint !== fingerprint) action.current = {fingerprint, key: uuid()};

        busy.current = true;
        updateTurn(id, {status: 'applying', error: undefined, reviewRequests: activeRequests});

        try {
            const result = await onApply(card.items, card.requestText, card.strength, card.llmPrompt, action.current.key);

            if (!mounted.current) return;

            updateTurn(id, {status: 'applied', result: result ?? undefined});
        } catch (cause) {
            if (!mounted.current) return;

            const needsReview = (cause as {requiresReinterpret?: boolean})?.requiresReinterpret;

            updateTurn(id, {
                status: needsReview ? 'revising' : 'confirm',
                error: cause instanceof Error ? cause.message : t('aiAdjust.failed'),
            });

            if (needsReview) {
                setText(card.requestText);
                setEditing(true);
                action.current = null;
            }
        } finally {
            busy.current = false;
        }
    };
    const revise = () => {
        if (!active?.card || busy.current || disabled) return;

        updateTurn(active.id, {status: 'revising', error: undefined});
        setEditing(true);
        setText(active.card.requestText);
        setError(null);
        textarea.current?.focus();
    };
    const newConversation = () => {
        if (disabled || busy.current) return;

        sequence.current += 1;
        setTurns([]);
        setGroup(0);
        setText('');
        setEditing(false);
        setError(null);
        action.current = null;
        textarea.current?.focus();
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
            <div ref={scroll} className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-[28px] pt-8 pb-6">
                {generationCompleted && (
                    <div className="mb-8 flex flex-col items-start gap-[10px]" role="status">
                        <div className="flex items-center gap-1 text-[14px] font-medium text-main-1">
                            <span className="grid size-5 place-items-center">
                                <img src={assistantIcon} alt="" />
                            </span>
                            {t('aiAdjust.assistant')}
                        </div>
                        <p className="text-gray-1 max-w-full rounded-t-[15px] rounded-br-[15px] bg-[#EFF2F5] p-4 text-[16px] leading-6 break-keep">
                            {t('aiAdjust.generationCompleted')}
                        </p>
                    </div>
                )}
                {turns.length === 0 && !generationCompleted && (
                    <div>
                        <h3 className="text-[28px] leading-[1.62] font-bold whitespace-pre-line text-black">{t('aiAdjust.welcome')}</h3>
                        <div className="mt-6 space-y-2 text-[14px] leading-6 break-keep text-gray-4">
                            <p>{t('aiAdjust.intro')}</p>
                            <p>{t('aiAdjust.introDetail')}</p>
                        </div>
                    </div>
                )}
                {turns.length > 0 && (
                    <div role="log" aria-label={t('aiAdjust.title')} aria-live="polite" className="flex min-w-0 flex-col gap-6">
                        {turns.map((turn, index) => (
                            <div key={turn.id} className="flex min-w-0 flex-col gap-4">
                                {index > 0 && turn.group !== turns[index - 1]?.group && (
                                    <p className="text-center text-[12px] text-[#626D7A]">{t('aiAdjust.newConversation')}</p>
                                )}
                                <UserMessage>
                                    <p className="whitespace-pre-wrap">{turn.text}</p>
                                </UserMessage>
                                {turn.card && (
                                    <AiAdjustReviewConversation
                                        card={turn.card}
                                        replies={turn.replies ?? []}
                                        nurses={goalNurses}
                                        editable={turn.status === 'confirm' && turn.id === active?.id}
                                        accepted={['applying', 'applied', 'undone'].includes(turn.status)}
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
                                        error={turn.status === 'confirm' ? turn.error : undefined}
                                        beforeApply={
                                            <>
                                                {(turn.status === 'confirm' ? activeRequests : (turn.reviewRequests ?? [])).length > 0 && (
                                                    <div className="mb-3 space-y-1 text-[12px] text-[#626D7A]">
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
                                {turn.status === 'interpreting' && (
                                    <AssistantMessage>
                                        <p role="status" className="flex items-center gap-2">
                                            <span aria-hidden="true" className="flex w-[23px] shrink-0 items-center gap-1">
                                                <span className="ai-adjust-review-dot size-[5px] rounded-full bg-main-1" />
                                                <span className="ai-adjust-review-dot size-[5px] rounded-full bg-main-1" />
                                                <span className="ai-adjust-review-dot size-[5px] rounded-full bg-main-1" />
                                            </span>
                                            <span>{t('aiAdjust.reviewing')}</span>
                                        </p>
                                    </AssistantMessage>
                                )}
                                {turn.status === 'applying' && (
                                    <AssistantMessage>
                                        <p role="status">{t('aiAdjust.applying')}</p>
                                    </AssistantMessage>
                                )}
                                {turn.status === 'error' && (
                                    <AssistantMessage>
                                        <p role="alert">{turn.error}</p>
                                    </AssistantMessage>
                                )}
                                {turn.status === 'revising' && (
                                    <AssistantMessage>
                                        <p>{t('aiAdjust.chat.clarify')}</p>
                                    </AssistantMessage>
                                )}
                                {turn.followups?.map((message, index) => (
                                    <div key={index} className="flex flex-col gap-4">
                                        <UserMessage>{message.text}</UserMessage>
                                        <AssistantMessage>{message.reply}</AssistantMessage>
                                    </div>
                                ))}
                                {turn.status === 'applied' && (
                                    <AssistantMessage>
                                        <AdjustResult result={turn.result} />
                                    </AssistantMessage>
                                )}
                                {turn.status === 'undone' && (
                                    <AssistantMessage>
                                        <p>{t('aiAdjust.undone')}</p>
                                        <p className="mt-2 text-[12px] text-[#626D7A]">{t('aiAdjust.undoNote')}</p>
                                    </AssistantMessage>
                                )}
                                {turn.error && turn.status !== 'error' && turn.status !== 'confirm' && (
                                    <AssistantMessage>
                                        <p role="alert" className="text-red">
                                            {turn.error}
                                        </p>
                                    </AssistantMessage>
                                )}
                                {turn.status === 'applied' && turn.result?.undoRevision !== undefined && (
                                    <button
                                        type="button"
                                        title={t('aiAdjust.undoNote')}
                                        disabled={disabled || currentRevision !== turn.result.undoRevision}
                                        onClick={async () => {
                                            if (await onUndo?.(turn.result!.undoRevision!)) updateTurn(turn.id, {status: 'undone'});
                                        }}
                                        className="min-h-11 self-start rounded-lg bg-[#F2F4F6] px-3 text-[13px] text-[#626D7A] hover:bg-main-light hover:text-main-1 focus-visible:bg-main-light focus-visible:text-main-1 focus-visible:outline-none disabled:opacity-40"
                                    >
                                        {t('aiAdjust.undo')}
                                    </button>
                                )}
                            </div>
                        ))}
                        {!active && <AssistantMessage>{t('aiAdjust.chat.restarted')}</AssistantMessage>}
                    </div>
                )}
                {turns.length > 0 && (
                    <div className="mt-5 flex justify-center">
                        <button
                            type="button"
                            disabled={disabled || isBusy}
                            onClick={newConversation}
                            className="min-h-11 rounded-lg px-3 text-[12px] text-[#626D7A] hover:bg-[#F2F4F6] hover:text-main-1 focus-visible:bg-main-light focus-visible:text-main-1 focus-visible:outline-none disabled:opacity-40"
                        >
                            {t('aiAdjust.chat.restart')}
                        </button>
                    </div>
                )}
                {conversationActions && <div className="mt-6">{conversationActions}</div>}
            </div>
            <div className="relative z-10 flex max-h-[60%] min-h-0 shrink-0 flex-col px-6 pt-3 pb-12">
                {turns.length === 0 && (
                    <div className="mb-10 flex min-h-0 flex-col gap-2 overflow-y-auto overscroll-contain">
                        <p className="px-1.5 text-[12px] font-medium text-main-1">{t('aiAdjust.examples')}</p>
                        {examples.map((sentence) => (
                            <button
                                key={sentence}
                                type="button"
                                disabled={disabled || isBusy}
                                onClick={() => fill(sentence)}
                                className="flex min-h-10 w-full items-center justify-between gap-2 rounded-[5px] bg-gray-7 px-3 py-2 text-left text-[13px] leading-5 break-keep text-gray-4 hover:bg-main-light hover:text-main-1 disabled:opacity-50"
                            >
                                <span>{sentence}</span>
                                <img src={nextIcon} alt="" width={24} height={24} className="shrink-0" />
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
                        className={`flex min-h-[99px] flex-col rounded-[14px] ${hasRequestList ? 'rounded-t-none' : ''} border border-[#DCE2EB] px-4 py-3 focus-within:border-main-1 focus-within:bg-main-light focus-within:text-main-1 ${text ? 'bg-main-light' : 'bg-gray-7'}`}
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
                            className="text-gray-1 w-full resize-none bg-transparent text-[14px] leading-5 outline-none placeholder:text-gray-4 disabled:opacity-50"
                        />
                        <div className="flex items-center justify-between gap-2">
                            <span className="text-[10px] text-gray-4">{text.length > 400 ? `${text.length}/${MAX_TEXT_LENGTH}` : ''}</span>
                            <button
                                type="button"
                                aria-label={t('aiAdjust.send')}
                                disabled={disabled || isBusy || !text.trim()}
                                onClick={() => void handleSubmit()}
                                className="grid size-11 shrink-0 place-items-center rounded-[10px] bg-main-1 focus-visible:bg-[#4620B8] focus-visible:outline-none disabled:bg-gray-3"
                            >
                                <img src={sendIcon} alt="" width={24} height={24} className="rotate-90" />
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

function AdjustResult({result}: {result?: TAdjustApplyResult}) {
    const {t} = useTypedTranslation();

    if (!result) return <p>{t('aiAdjust.result')}</p>;

    if (!result.applied) return <p>{t('aiAdjust.reviewCandidate')}</p>;

    const {response, changes} = result;
    const violations = response.validation?.violations ?? [];
    const blocking = response.blockingViolations ?? [];
    const unmet = response.requestRuleResults?.filter((entry) => entry.violationCount > 0) ?? [];

    return (
        <div className="flex flex-col gap-4">
            <p className="font-medium">{t(changes.length ? 'aiAdjust.result' : 'aiAdjust.noChange')}</p>
            {changes.length > 0 && (
                <details open={changes.length <= 8}>
                    <summary className="cursor-pointer text-[13px] text-gray-3">{t('aiAdjust.changes', {count: changes.length})}</summary>
                    <ul className="mt-2 space-y-1 text-[14px]">
                        {changes.map((change, index) => (
                            <li key={index}>
                                {change.name} · {change.date.slice(5)}
                                <br />
                                {change.before ?? '—'} → {change.after ?? '—'}
                            </li>
                        ))}
                    </ul>
                </details>
            )}
            <div className="text-[13px] leading-5">
                <p className="font-semibold">{t('aiAdjust.validation')}</p>
                <p>{t((response.approvable ?? response.validation?.summary.valid) ? 'aiAdjust.approvable' : 'aiAdjust.notApprovable')}</p>
                <ul>
                    {violations.map((entry) => (
                        <li key={entry.violationId}>{entry.message}</li>
                    ))}
                </ul>
            </div>
            {blocking.length > 0 && (
                <div className="text-[13px]">
                    <p className="font-semibold">{t('aiAdjust.blocked')}</p>
                    <ul>
                        {blocking.map((entry) => (
                            <li key={entry.violationId}>{entry.message}</li>
                        ))}
                    </ul>
                </div>
            )}
            {(unmet.length > 0 || response.unmetInstructions?.length > 0) && (
                <div className="text-[13px]">
                    <p className="font-semibold">{t('aiAdjust.unmet')}</p>
                    <ul>
                        {unmet.map((entry) => (
                            <li key={entry.requestId}>
                                {t('aiAdjust.remaining', {label: entry.displayLabel ?? '', count: entry.violationCount})}
                            </li>
                        ))}
                        {response.unmetInstructions?.map((message, index) => <li key={index}>{message}</li>)}
                    </ul>
                </div>
            )}
            {!!response.adjustmentNotices?.length && (
                <div className="text-[13px]">
                    <p className="font-semibold">{t('aiAdjust.notice')}</p>
                    <ul>
                        {response.adjustmentNotices.map((notice, index) => (
                            <li key={index}>{notice.message}</li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    );
}
