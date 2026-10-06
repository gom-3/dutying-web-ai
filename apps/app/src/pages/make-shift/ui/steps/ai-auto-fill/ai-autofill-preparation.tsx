import {Undo2} from 'lucide-react';
import {useTypedTranslation} from '@/shared/hook/use-typed-translation';
import {AssistantMessage, UserMessage} from './ai-adjust-review-conversation';
import {AiInfoTip} from './ai-conversation-entry';

export type TAutofillPreparationStep = 'carryOver' | 'previous' | 'fixed';
export type TAutofillMessage = {role: 'assistant' | 'user'; text: string; help?: string};
export type TAutofillFlow = {
    id: number;
    kind?: 'generation' | 'adjustment';
    messages: TAutofillMessage[];
    status: 'preparing' | 'running' | 'paused';
    resumeStep?: TAutofillPreparationStep;
    previousWarningKey?: string | null;
};

/** Display-only history: past replies cannot trigger another generation. */
export function AiAutofillMessages({messages}: {messages: TAutofillMessage[]}) {
    const {t} = useTypedTranslation();

    return (
        <div className="flex min-w-0 flex-col gap-4">
            {messages.map((message, index) => {
                const Message = message.role === 'user' ? UserMessage : AssistantMessage;

                return (
                    <Message key={index}>
                        <span className="whitespace-pre-line">{message.text}</span>
                        {message.help && <AiInfoTip label={t('aiAdjust.chat.help')}>{message.help}</AiInfoTip>}
                    </Message>
                );
            })}
        </div>
    );
}

export function AiAutofillPreparation({
    step,
    fixableCount,
    hasFilledCells = true,
    previousHasBlanks = true,
    disabled = false,
    canAutofill = true,
    onConfirm,
    onCancel,
    onFixAll,
    onUndoFixAll,
}: {
    step: Exclude<TAutofillPreparationStep, 'carryOver'>;
    fixableCount: number;
    hasFilledCells?: boolean;
    previousHasBlanks?: boolean;
    disabled?: boolean;
    canAutofill?: boolean;
    onConfirm: () => void;
    onCancel: () => void;
    onFixAll: () => void;
    onUndoFixAll?: () => void;
}) {
    const {t} = useTypedTranslation();
    const title =
        step === 'previous' ? 'page.makeShift.aiRefill.lastShiftBlankDialog.title' : 'page.makeShift.aiRefill.prefillDecision.title';
    const replyClass =
        'min-h-11 rounded-xl bg-main-light px-4 py-3 text-left text-[13.5px] font-medium text-[#5931B9] hover:bg-main-1 hover:text-white focus-visible:bg-main-1 focus-visible:text-white focus-visible:outline-none disabled:opacity-40';

    return (
        <section role="region" aria-label={t(title)} className="flex flex-col gap-5">
            {step === 'fixed' && onUndoFixAll && (
                <button
                    type="button"
                    disabled={disabled}
                    onClick={onUndoFixAll}
                    className="inline-flex min-h-11 items-center gap-1.5 self-start bg-transparent py-2 text-left text-[13px] text-[#6B7684] hover:text-main-1 focus-visible:bg-main-light focus-visible:text-main-1 focus-visible:outline-none disabled:opacity-40"
                >
                    <Undo2 aria-hidden="true" className="size-4 shrink-0" />
                    {t('aiAdjust.undo')}
                </button>
            )}
            <div className="ml-auto flex max-w-full flex-col gap-2">
                <button
                    type="button"
                    className={replyClass}
                    disabled={disabled || (step === 'fixed' && !canAutofill)}
                    title={step === 'fixed' && !canAutofill ? t('aiAdjust.allFixed') : undefined}
                    onClick={onConfirm}
                >
                    {t(
                        step === 'previous'
                            ? previousHasBlanks
                                ? 'aiAdjust.preparation.continue'
                                : 'aiAdjust.preparation.next'
                            : fixableCount === 0
                              ? 'aiAdjust.autofill'
                              : 'aiAdjust.preparation.fill',
                    )}
                </button>
                {step === 'fixed' && hasFilledCells && fixableCount > 0 && (
                    <button type="button" className={replyClass} disabled={disabled} onClick={onFixAll}>
                        {t('aiAdjust.preparation.fixAll')}
                    </button>
                )}
                {step === 'previous' && previousHasBlanks && (
                    <button type="button" className={replyClass} onClick={onCancel}>
                        {t('aiAdjust.preparation.editPrevious')}
                    </button>
                )}
            </div>
        </section>
    );
}
