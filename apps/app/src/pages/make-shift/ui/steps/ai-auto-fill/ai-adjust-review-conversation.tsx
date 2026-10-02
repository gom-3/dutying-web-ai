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
import {AiAdjustInterpretCard, type TAdjustCard} from './ai-adjust-interpret-card';

const choiceClass =
    'min-h-11 rounded-xl bg-white px-3 py-2 text-[14px] font-medium text-main-1 hover:bg-main-1 hover:text-white focus-visible:bg-main-1 focus-visible:text-white focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-40';

export function AssistantMessage({children}: {children: ReactNode}) {
    const {t} = useTypedTranslation();
    return (
        <div className="flex min-w-0 flex-col items-start gap-2">
            <span className="flex items-center gap-1.5 text-[12px] font-medium text-main-1">
                <img src={assistantIcon} width={18} height={18} alt="" />
                {t('aiAdjust.assistant')}
            </span>
            <div className="max-w-full min-w-0 rounded-2xl rounded-tl-sm bg-[#F2F4F6] px-4 py-3 text-[14px] leading-6 break-words text-[#333D4B]">
                {children}
            </div>
        </div>
    );
}

export function UserMessage({children}: {children: ReactNode}) {
    return (
        <div className="ml-auto w-fit max-w-full min-w-0 rounded-2xl rounded-tr-sm bg-main-light px-4 py-3 text-[14px] leading-6 break-words text-[#5931B9]">
            {children}
        </div>
    );
}

type TProps = {
    card: TAdjustCard;
    replies: TReviewReply[];
    nurses: {nurseId: number; name: string}[];
    editable: boolean;
    accepted: boolean;
    disabled: boolean;
    applyDisabled: boolean;
    onReply: (question: TReviewQuestion, value: TReviewValue) => void;
    onEditReply: (index: number) => void;
    onApply: () => void;
    onRevise: () => void;
    beforeApply?: ReactNode;
    error?: string;
};

export function AiAdjustReviewConversation({
    card,
    replies,
    nurses,
    editable,
    accepted,
    disabled,
    applyDisabled,
    onReply,
    onEditReply,
    onApply,
    onRevise,
    beforeApply,
    error,
}: TProps) {
    const {t} = useTypedTranslation();
    const questions = getReviewQuestions(card);
    const complete = isReviewComplete(card, replies);
    const canApply = Boolean(card.items.length || card.llmPrompt);
    const answerLabel = (value: TReviewValue) =>
        Array.isArray(value)
            ? value.map((id) => nurses.find((n) => n.nurseId === id)?.name ?? t('aiAdjust.nurse', {id})).join(', ')
            : typeof value === 'number'
              ? t('aiAdjust.chat.withinDays', {count: value})
              : value === 'MONTH' || value === 'TEAM'
                ? t(`aiAdjust.savedRequests.lifetime.${value}`)
                : t(`page.makeShift.aiRefill.adjust.severity.${value}`);
    return (
        <div className="ai-adjust-review-conversation flex min-w-0 flex-col gap-4">
            <AssistantMessage>
                <AiAdjustInterpretCard card={card} nurses={nurses} />
            </AssistantMessage>
            {questions.slice(0, replies.length + (editable ? 1 : 0)).map((question, index) => {
                const entry = card.items[question.itemIndex]!;
                const reply = replies[index];
                const questionText = t(`aiAdjust.chat.question.${question.kind}`);
                return (
                    <div key={question.id} className="flex min-w-0 flex-col gap-3">
                        <AssistantMessage>
                            {card.items.length > 1 && (
                                <p className="mb-1 text-[12px] text-[#626D7A]">{entry.item.displayLabel || card.requestText}</p>
                            )}
                            <p>{questionText}</p>
                        </AssistantMessage>
                        <UserMessage>
                            {reply ? (
                                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                                    <p>{answerLabel(reply.value)}</p>
                                    {editable && (
                                        <button
                                            type="button"
                                            disabled={disabled}
                                            onClick={() => onEditReply(index)}
                                            className="min-h-11 rounded-lg px-2 text-[12px] text-[#626D7A] hover:bg-white hover:text-main-1 focus-visible:bg-main-1 focus-visible:text-white focus-visible:outline-none disabled:opacity-40"
                                        >
                                            {t('aiAdjust.chat.changeAnswer')}
                                        </button>
                                    )}
                                </div>
                            ) : (
                                <div aria-label={questionText} role="group" className="flex flex-wrap gap-2">
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
                                                {t(`page.makeShift.aiRefill.adjust.severity.${value}`)}
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
                                            <p className="w-full text-[12px]">{t('aiAdjust.chat.typeDays')}</p>
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
                        </UserMessage>
                    </div>
                );
            })}
            {canApply && complete && (editable || accepted) && (
                <>
                    <AssistantMessage>
                        {beforeApply}
                        <p>{t('aiAdjust.chat.applyQuestion')}</p>
                    </AssistantMessage>
                    <UserMessage>
                        {accepted ? (
                            <p>{t('aiAdjust.chat.applyReply')}</p>
                        ) : (
                            <div className="flex flex-col gap-2">
                                <button
                                    type="button"
                                    disabled={disabled || applyDisabled}
                                    onClick={onApply}
                                    className="min-h-11 rounded-xl bg-main-1 px-4 py-2 text-[14px] font-semibold text-white hover:bg-[#5931D9] focus-visible:bg-[#4620B8] focus-visible:text-[#FFF1D6] focus-visible:outline-none disabled:opacity-40"
                                >
                                    {t('aiAdjust.chat.applyReply')}
                                </button>
                                <button type="button" disabled={disabled} onClick={onRevise} className={choiceClass}>
                                    {t('aiAdjust.chat.reviseReply')}
                                </button>
                            </div>
                        )}
                    </UserMessage>
                </>
            )}
            {editable && !canApply && <AssistantMessage>{t('aiAdjust.chat.clarify')}</AssistantMessage>}
            {error && (
                <AssistantMessage>
                    <p role="alert" className="text-red">
                        {error}
                    </p>
                </AssistantMessage>
            )}
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
            <p className="text-[12px]">{t('aiAdjust.chat.minimumNurses', {count: minimum})}</p>
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
