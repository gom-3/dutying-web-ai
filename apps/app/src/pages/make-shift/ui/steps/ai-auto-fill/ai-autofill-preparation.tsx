import {Undo2} from 'lucide-react';
import {useEffect, useRef} from 'react';
import {useTypedTranslation} from '@/shared/hook/use-typed-translation';
import type {TAutofillCellSummary} from '../../../model/ai-autofill-state';
import {AssistantMessage, UserMessage} from './ai-adjust-review-conversation';
import {AiInfoTip} from './ai-conversation-entry';
import {AiConversationTimestamp} from './ai-conversation-timestamp';

export type TAutofillPreparationStep = 'carryOver' | 'previous' | 'fixed';
export type TAutofillMessage = {role: 'assistant' | 'user'; text: string; help?: string; createdAt?: string};
export type TAutofillFlow = {
    id: number;
    kind?: 'generation' | 'adjustment';
    recovery?: boolean;
    messages: TAutofillMessage[];
    status: 'preparing' | 'running' | 'paused' | 'completed';
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
                    <div key={index}>
                        <Message>
                            <span className="whitespace-pre-line">{message.text}</span>
                            {message.help && <AiInfoTip label={t('aiAdjust.chat.help')}>{message.help}</AiInfoTip>}
                        </Message>
                        <AiConversationTimestamp createdAt={message.createdAt} align={message.role === 'user' ? 'right' : 'left'} />
                    </div>
                );
            })}
        </div>
    );
}

export function AiAutofillPreparation({
    step,
    kind = 'generation',
    recovery = false,
    fixableCount,
    hasFilledCells = true,
    previousHasBlanks = true,
    disabled = false,
    canAutofill = true,
    onConfirm,
    onCancel,
    onFixAll,
    onUndoFixAll,
    onEditConditions,
    onEditSchedule,
    requestText = '',
    onRequestTextChange,
    summary,
    active = true,
}: {
    step: Exclude<TAutofillPreparationStep, 'carryOver'>;
    kind?: 'generation' | 'adjustment';
    recovery?: boolean;
    fixableCount: number;
    hasFilledCells?: boolean;
    previousHasBlanks?: boolean;
    disabled?: boolean;
    canAutofill?: boolean;
    onConfirm: () => void;
    onCancel: () => void;
    onFixAll: () => void;
    onUndoFixAll?: () => void;
    onEditConditions?: () => void;
    onEditSchedule?: () => void;
    requestText?: string;
    onRequestTextChange?: (text: string) => void;
    summary?: TAutofillCellSummary;
    active?: boolean;
}) {
    const {t} = useTypedTranslation();
    const sectionRef = useRef<HTMLElement>(null);

    useEffect(() => {
        if (active) sectionRef.current?.focus();
    }, [active, step]);

    const title =
        step === 'previous' ? 'page.makeShift.aiRefill.lastShiftBlankDialog.title' : 'page.makeShift.aiRefill.prefillDecision.title';
    const replyClass =
        'min-h-11 rounded-xl bg-main-light px-4 py-3 text-left text-[13.5px] font-medium text-[#5931B9] hover:bg-main-1 hover:text-white focus-visible:bg-main-1 focus-visible:text-white focus-visible:outline-none disabled:opacity-40';

    return (
        <section
            ref={sectionRef}
            tabIndex={-1}
            role="region"
            aria-label={t(title)}
            data-fixed-selection={step === 'fixed' || undefined}
            className="flex flex-col gap-5 outline-none"
        >
            {step === 'fixed' && summary && <AutofillSelectionSummary summary={summary} />}
            {step === 'fixed' && onRequestTextChange && (
                <label className="flex flex-col gap-2 text-[13px] font-medium text-[#344054]">
                    {t('aiAdjust.preparation.initialRequestLabel')}
                    <textarea
                        value={requestText}
                        onChange={(event) => onRequestTextChange(event.target.value)}
                        maxLength={500}
                        rows={2}
                        disabled={disabled}
                        placeholder={t('aiAdjust.preparation.initialRequestExample')}
                        className="w-full resize-none rounded-xl border border-[#DCE2EB] bg-white px-3 py-2 text-sm leading-6 font-normal text-[#333D4B] placeholder:text-[#667085] focus-visible:outline-2 focus-visible:outline-main-1 disabled:opacity-40"
                    />
                </label>
            )}
            {step === 'fixed' && onUndoFixAll && (
                <button
                    type="button"
                    disabled={disabled}
                    onClick={() => {
                        onUndoFixAll();
                        sectionRef.current?.focus();
                    }}
                    className="inline-flex min-h-11 items-center gap-1.5 self-start bg-transparent py-2 text-left text-[13px] text-[#6B7684] hover:text-main-1 focus-visible:bg-main-light focus-visible:text-main-1 focus-visible:outline-none disabled:opacity-40"
                >
                    <Undo2 aria-hidden="true" className="size-4 shrink-0" />
                    {t('aiAdjust.undo')}
                </button>
            )}
            <div className="ml-auto flex max-w-full flex-col gap-2">
                {step === 'fixed' && !canAutofill && (
                    <p role="status" className="text-[13px] leading-5 text-[#667085]">
                        {t('aiAdjust.preparation.noEditableCells')}
                    </p>
                )}
                {step === 'fixed' && hasFilledCells && onEditSchedule && (
                    <button type="button" className={replyClass} disabled={disabled} onClick={onEditSchedule}>
                        {t('aiAdjust.preparation.editSchedule')}
                    </button>
                )}
                {step === 'fixed' && hasFilledCells && fixableCount > 0 && (
                    <button
                        type="button"
                        className={replyClass}
                        disabled={disabled}
                        onClick={() => {
                            onFixAll();
                            sectionRef.current?.focus();
                        }}
                    >
                        {t('aiAdjust.preparation.fixAll')}
                    </button>
                )}
                {step === 'fixed' && recovery && onEditConditions && (
                    <button type="button" className={replyClass} disabled={disabled} onClick={onEditConditions}>
                        {t('aiAdjust.preparation.editConditions')}
                    </button>
                )}
                {step === 'previous' && previousHasBlanks && (
                    <button type="button" className={replyClass} onClick={onCancel}>
                        {t('aiAdjust.preparation.editPrevious')}
                    </button>
                )}
                <button
                    type="button"
                    className="min-h-11 rounded-xl bg-main-1 px-4 py-3 text-left text-[13.5px] font-medium text-white hover:bg-[#5931B9] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-main-1 disabled:opacity-40"
                    disabled={disabled || (step === 'fixed' && !canAutofill)}
                    title={step === 'fixed' && !canAutofill ? t('aiAdjust.preparation.noEditableCells') : undefined}
                    onClick={onConfirm}
                >
                    {t(
                        step === 'previous'
                            ? previousHasBlanks
                                ? 'aiAdjust.preparation.continue'
                                : 'aiAdjust.preparation.next'
                            : kind === 'adjustment'
                              ? 'aiAdjust.preparation.next'
                              : recovery
                                ? 'aiAdjust.preparation.retryFill'
                                : fixableCount === 0
                                  ? 'aiAdjust.autofill'
                                  : 'aiAdjust.preparation.fill',
                    )}
                </button>
            </div>
        </section>
    );
}

function AutofillSelectionSummary({summary}: {summary: TAutofillCellSummary}) {
    const {t} = useTypedTranslation();

    return (
        <div className="rounded-xl bg-gray-50 px-4 py-3 text-[13px] leading-6 text-[#475467]">
            <p role="status" aria-atomic="true">
                {t('aiAdjust.preparation.selectionSummary', summary)}
            </p>
            <p className="text-xs text-[#667085]">{t('aiAdjust.preparation.selectionHelp')}</p>
        </div>
    );
}

export function AiAutofillFixedSelectionBar({
    summary,
    onContinue,
    onCancel,
}: {
    summary: TAutofillCellSummary;
    onContinue: () => void;
    onCancel: () => void;
}) {
    const {t} = useTypedTranslation();
    const sectionRef = useRef<HTMLElement>(null);

    useEffect(() => sectionRef.current?.focus(), []);

    return (
        <section
            ref={sectionRef}
            tabIndex={-1}
            role="region"
            aria-label={t('aiAdjust.preparation.editSchedule')}
            className="sticky top-0 z-[100] flex flex-col items-stretch gap-3 rounded-xl border border-purple-100 bg-white p-3 shadow-sm outline-none sm:flex-row sm:items-center"
        >
            <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-[#344054]">{t('aiAdjust.preparation.editingFixed')}</p>
                <AutofillSelectionSummary summary={summary} />
            </div>
            <div className="flex flex-wrap justify-end gap-2">
                <button
                    type="button"
                    onClick={onCancel}
                    className="min-h-11 rounded-lg px-3 text-sm text-[#475467] hover:bg-gray-50 focus-visible:outline-2 focus-visible:outline-main-1"
                >
                    {t('aiAdjust.preparation.cancelSelection')}
                </button>
                <button
                    type="button"
                    onClick={onContinue}
                    className="min-h-11 rounded-lg bg-main-1 px-4 text-sm font-medium text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-main-1"
                >
                    {t('aiAdjust.preparation.finishSelection')}
                </button>
            </div>
        </section>
    );
}
