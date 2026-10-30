import {useState, type ReactNode} from 'react';
import assistantIcon from '@/shared/assets/images/ai-adjust/assistant.svg';
import {useTypedTranslation} from '@/shared/hook/use-typed-translation';
import {
    getReviewQuestions,
    isReviewComplete,
    type TReviewQuestion,
    type TReviewReply,
    type TReviewValue,
} from '../../../model/ai-adjust-review-flow';
import {canRetryInterpretation} from '../../../model/ai-interpret-issues';
import {AiAdjustInterpretCard, type TAdjustCard} from './ai-adjust-interpret-card';
import {AiConversationTimestamp} from './ai-conversation-timestamp';

const choiceClass =
    'min-h-11 max-w-full rounded-xl bg-main-light px-4 py-3 text-left leading-5 text-[13.5px] font-medium text-main-1 hover:bg-main-1 hover:text-white focus-visible:bg-main-1 focus-visible:text-white focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-40';

export function AssistantMessage({
    children,
    tone = 'default',
    fullWidth = false,
    plain = false,
    showTime = false,
}: {
    children: ReactNode;
    tone?: 'default' | 'error';
    fullWidth?: boolean;
    plain?: boolean;
    showTime?: boolean;
}) {
    const {t} = useTypedTranslation();
    const [displayedAt] = useState(() => new Date().toISOString());

    return (
        <div className={`flex min-w-0 flex-col items-start gap-2 ${fullWidth ? 'w-full' : ''} ${plain ? 'font-apple' : ''}`}>
            <span className="flex items-center gap-1.5 text-[13px] font-medium text-main-1">
                <img src={assistantIcon} width={16} height={16} alt="" />
                {t('aiAdjust.assistant')}
            </span>
            <div
                className={
                    plain
                        ? 'max-w-full min-w-0 text-[14.5px] leading-7 [overflow-wrap:anywhere] break-keep text-[#333D4B]'
                        : `max-w-full min-w-0 rounded-2xl rounded-tl-sm px-4 py-3 text-[14.5px] leading-7 break-words ${fullWidth ? 'w-full' : ''} ${tone === 'error' ? 'w-full bg-[#FFF5F5] text-[#333D4B]' : 'bg-[#F2F4F6] text-[#333D4B]'}`
                }
            >
                {children}
            </div>
            {showTime && <AiConversationTimestamp createdAt={displayedAt} />}
        </div>
    );
}

export function UserMessage({children, showTime = false}: {children: ReactNode; showTime?: boolean}) {
    const [displayedAt] = useState(() => new Date().toISOString());

    return (
        <div className="ml-auto w-fit max-w-full min-w-0 rounded-2xl rounded-tr-sm bg-main-light px-4 py-3 text-[14.5px] leading-7 break-words text-[#5931B9]">
            {children}
            {showTime && <AiConversationTimestamp createdAt={displayedAt} align="right" />}
        </div>
    );
}

type TProps = {
    card: TAdjustCard;
    replies: TReviewReply[];
    nurses: {nurseId: number; name: string; divisionName?: string | null}[];
    editable: boolean;
    accepted: boolean;
    historical?: boolean;
    disabled: boolean;
    applyDisabled: boolean;
    onReply: (question: TReviewQuestion, value: TReviewValue) => void;
    onEditReply: (index: number) => void;
    onApply: () => void;
    onRevise: () => void;
    onRetry?: () => void;
    beforeApply?: ReactNode;
    error?: string;
};

export function AiAdjustReviewConversation({
    card,
    replies,
    nurses,
    editable,
    accepted,
    historical = false,
    disabled,
    applyDisabled,
    onReply,
    onEditReply,
    onApply,
    onRevise,
    onRetry,
    beforeApply,
    error,
}: TProps) {
    const {t} = useTypedTranslation();
    const questions = getReviewQuestions(card);
    const complete = isReviewComplete(card, replies);
    const canApply = Boolean(card.items.length || card.llmPrompt);
    const partial = card.unmapped.length > 0;
    const showApply = canApply && complete && editable && !accepted && !historical;
    const inlineConfirmation = questions.length === 0;
    const state = historical || (!editable && !accepted) ? 'history' : accepted ? 'confirmed' : 'preview';
    const heading =
        state === 'history'
            ? t('aiAutofillUi.semanticReview.previousRequest')
            : state === 'confirmed'
              ? t('aiAutofillUi.legacyReview.confirmedConditions')
              : undefined;
    const confirmation = (
        <>
            {beforeApply}
            <div className="mt-3">
                <AiAdjustApplyChoices
                    disabled={disabled}
                    applyDisabled={applyDisabled}
                    onApply={onApply}
                    onRevise={onRevise}
                    partial={partial}
                />
            </div>
        </>
    );
    const answerLabel = (value: TReviewValue) =>
        Array.isArray(value)
            ? value.map((id) => nurses.find((n) => n.nurseId === id)?.name ?? t('aiAdjust.nurse', {id})).join(', ')
            : typeof value === 'number'
              ? t('aiAdjust.chat.withinDays', {count: value})
              : value === 'MONTH' || value === 'TEAM'
                ? t(`aiAdjust.savedRequests.lifetime.${value}`)
                : value === 'CONFIRM'
                  ? t(partial ? 'aiAdjust.issue.partialConfirm' : 'aiAdjust.chat.confirmProposal')
                  : t(value === 'HARD' ? 'aiAdjust.chat.required' : 'aiAdjust.chat.preferred');

    return (
        <div className="ai-adjust-review-conversation flex min-w-0 flex-col gap-4">
            <AssistantMessage fullWidth>
                <AiAdjustInterpretCard card={card} nurses={nurses} heading={heading} state={state} />
                {showApply && inlineConfirmation && confirmation}
            </AssistantMessage>
            {questions.slice(0, replies.length + (editable ? 1 : 0)).map((question, index) => {
                const entry = card.items[question.itemIndex]!;
                const reply = replies[index];
                const questionText =
                    question.kind === 'proposal'
                        ? t(partial ? 'aiAdjust.issue.partialTitle' : 'aiAdjust.understood')
                        : t(`aiAdjust.chat.question.${question.kind}`);

                return (
                    <div key={question.id} className="flex min-w-0 flex-col gap-3">
                        {question.kind !== 'proposal' && (
                            <AssistantMessage>
                                {card.items.length > 1 && (
                                    <p className="mb-1 text-[13px] text-[#475467]">
                                        {entry.item.displayLabel?.length ? entry.item.displayLabel : card.requestText}
                                    </p>
                                )}
                                <p>{questionText}</p>
                            </AssistantMessage>
                        )}
                        {reply ? (
                            <UserMessage>
                                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                                    <p>{answerLabel(reply.value)}</p>
                                    {editable && (
                                        <button
                                            type="button"
                                            disabled={disabled}
                                            onClick={() => onEditReply(index)}
                                            className="min-h-11 rounded-lg px-2 text-[13px] text-[#475467] hover:bg-white hover:text-main-1 focus-visible:bg-main-1 focus-visible:text-white focus-visible:outline-none disabled:opacity-40"
                                        >
                                            {t('aiAdjust.chat.changeAnswer')}
                                        </button>
                                    )}
                                </div>
                            </UserMessage>
                        ) : (
                            <div aria-label={questionText} role="group" className="ml-auto flex max-w-full flex-col items-end gap-2">
                                {question.kind === 'proposal' && (
                                    <>
                                        <button
                                            className={choiceClass}
                                            type="button"
                                            disabled={disabled}
                                            onClick={() => onReply(question, 'CONFIRM')}
                                        >
                                            {t(partial ? 'aiAdjust.issue.partialConfirm' : 'aiAdjust.chat.confirmProposal')}
                                        </button>
                                        <button className={choiceClass} type="button" disabled={disabled} onClick={onRevise}>
                                            {t('aiAdjust.chat.reviseProposal')}
                                        </button>
                                    </>
                                )}
                                {question.kind === 'lifetime' &&
                                    (['MONTH', 'TEAM'] as const).map((value) => (
                                        <button
                                            className={choiceClass}
                                            type="button"
                                            disabled={disabled}
                                            key={value}
                                            onClick={() => onReply(question, value)}
                                        >
                                            {t(`aiAdjust.savedRequests.lifetime.${value}`)}
                                        </button>
                                    ))}
                                {question.kind === 'severity' &&
                                    (['SOFT', 'HARD'] as const).map((value) => (
                                        <button
                                            className={choiceClass}
                                            type="button"
                                            disabled={disabled}
                                            key={value}
                                            onClick={() => onReply(question, value)}
                                        >
                                            {t(value === 'HARD' ? 'aiAdjust.chat.required' : 'aiAdjust.chat.preferred')}
                                        </button>
                                    ))}
                                {question.kind === 'offDifference' && (
                                    <>
                                        {[0, 1, 2].map((value) => (
                                            <button
                                                className={choiceClass}
                                                type="button"
                                                disabled={disabled}
                                                key={value}
                                                onClick={() => onReply(question, value)}
                                            >
                                                {t('aiAdjust.chat.withinDays', {count: value})}
                                            </button>
                                        ))}
                                        <p className="w-full text-[13px]">{t('aiAdjust.chat.typeDays')}</p>
                                    </>
                                )}
                                {(question.kind === 'targetNurses' || question.kind === 'comparisonNurses') && (
                                    <NurseReplyChoices
                                        key={question.id}
                                        nurses={nurses}
                                        disabled={disabled}
                                        initial={
                                            question.kind === 'targetNurses' ? entry.item.targetNurseIds : entry.item.comparisonNurseIds
                                        }
                                        minimum={question.kind === 'targetNurses' ? 1 : 2}
                                        onSubmit={(value) => onReply(question, value)}
                                    />
                                )}
                            </div>
                        )}
                    </div>
                );
            })}
            {showApply && !inlineConfirmation && <AssistantMessage fullWidth>{confirmation}</AssistantMessage>}
            {accepted && canApply && complete && (
                <UserMessage>{t(partial ? 'aiAdjust.issue.partialApply' : 'aiAdjust.chat.applyReply')}</UserMessage>
            )}
            {editable && !canApply && (
                <div className="ml-auto flex max-w-full flex-col items-end gap-2">
                    {onRetry && canRetryInterpretation(card.unmapped, card.requestText, nurses) && (
                        <button type="button" className={choiceClass} disabled={disabled} onClick={onRetry}>
                            {t('aiAdjust.failure.retry')}
                        </button>
                    )}
                    <button type="button" className={choiceClass} disabled={disabled} onClick={onRevise}>
                        {t('aiAdjust.issue.edit')}
                    </button>
                </div>
            )}
            {error && (
                <AssistantMessage>
                    <p role="alert" className="break-keep whitespace-pre-line">
                        {error}
                    </p>
                </AssistantMessage>
            )}
        </div>
    );
}

export function AiAdjustApplyChoices({
    disabled,
    applyDisabled,
    onApply,
    onRevise,
    partial = false,
}: {
    disabled: boolean;
    applyDisabled: boolean;
    onApply: () => void;
    onRevise: () => void;
    partial?: boolean;
}) {
    const {t} = useTypedTranslation();

    return (
        <div className="grid w-full gap-2">
            <button
                type="button"
                disabled={disabled || applyDisabled}
                onClick={onApply}
                className="min-h-[44px] w-full rounded-[10px] bg-main-1 px-4 py-3 text-center text-[13.5px] leading-5 font-medium text-white hover:bg-[#5931D9] focus-visible:bg-[#4620B8] focus-visible:text-[#FFF1D6] focus-visible:outline-none disabled:opacity-40"
            >
                {t(partial ? 'aiAdjust.issue.partialApply' : 'aiAdjust.chat.applyReply')}
            </button>
            <button
                type="button"
                disabled={disabled}
                onClick={onRevise}
                className="min-h-[44px] w-full rounded-[10px] bg-white px-4 py-3 text-center text-[13.5px] leading-5 font-medium text-[#475467] hover:bg-main-light hover:text-[#5931B9] focus-visible:bg-main-1 focus-visible:text-white focus-visible:outline-none disabled:opacity-40"
            >
                {t('aiAdjust.chat.reviseReply')}
            </button>
        </div>
    );
}

function NurseReplyChoices({
    nurses,
    initial = [],
    minimum,
    disabled,
    onSubmit,
}: {
    nurses: TProps['nurses'];
    initial?: number[];
    minimum: number;
    disabled: boolean;
    onSubmit: (value: number[]) => void;
}) {
    const {t} = useTypedTranslation();
    const [selected, setSelected] = useState(initial.filter((id) => nurses.some((n) => n.nurseId === id)));

    return (
        <div className="space-y-2">
            <div className="flex flex-wrap gap-2">
                {nurses.map((nurse) => (
                    <button
                        type="button"
                        aria-pressed={selected.includes(nurse.nurseId)}
                        disabled={disabled}
                        key={nurse.nurseId}
                        onClick={() =>
                            setSelected((current) =>
                                current.includes(nurse.nurseId)
                                    ? current.filter((id) => id !== nurse.nurseId)
                                    : [...current, nurse.nurseId],
                            )
                        }
                        className={`${choiceClass} ${selected.includes(nurse.nurseId) ? '!bg-main-1 !text-white' : ''}`}
                    >
                        {nurse.name}
                    </button>
                ))}
            </div>
            <p className="text-[13px]">{t('aiAdjust.chat.minimumNurses', {count: minimum})}</p>
            <button
                type="button"
                disabled={disabled || selected.length < minimum}
                className={choiceClass}
                onClick={() => onSubmit(selected)}
            >
                {t('aiAdjust.chat.confirmPeople')}
            </button>
        </div>
    );
}
