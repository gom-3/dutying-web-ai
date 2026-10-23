import * as Dialog from '@radix-ui/react-dialog';
import {LoaderCircle, X} from 'lucide-react';
import {type CSSProperties, useId, useRef} from 'react';
import {useTypedTranslation} from '@/shared/hook/use-typed-translation';

type TProps = {
    open: boolean;
    target: string;
    value: string;
    disabled?: boolean;
    error?: string | null;
    retryHint?: string | null;
    returnFocusTo: HTMLButtonElement | null;
    onChange: (value: string) => void;
    onSubmit: () => void;
    onClose: () => void;
};

const canReturnFocus = (control: HTMLButtonElement | null): control is HTMLButtonElement => {
    if (!control?.isConnected || control.disabled || control.closest('[hidden], [inert], [aria-hidden="true"]')) return false;

    for (let element: HTMLElement | null = control; element; element = element.parentElement) {
        const style = window.getComputedStyle(element);

        if (style.display === 'none' || style.visibility === 'hidden') return false;
    }

    return true;
};

/** Feedback belongs to the selected result and stays separate from schedule requests. */
export function AiConversationFeedbackDialog({
    open,
    target,
    value,
    disabled = false,
    error,
    retryHint,
    returnFocusTo,
    onChange,
    onSubmit,
    onClose,
}: TProps) {
    const {t} = useTypedTranslation();
    const id = useId();
    const content = useRef<HTMLDivElement>(null);
    const input = useRef<HTMLTextAreaElement>(null);

    return (
        <Dialog.Root open={open} onOpenChange={(next) => !next && !disabled && onClose()}>
            <Dialog.Portal>
                <Dialog.Overlay
                    data-testid="ai-feedback-overlay"
                    className="fixed inset-0 z-[1600] flex items-center justify-center bg-[#121726]/55 p-4"
                >
                    <Dialog.Content
                        ref={content}
                        aria-modal="true"
                        data-preserve-duty-selection="true"
                        style={{'--spacing': '0.25rem'} as CSSProperties}
                        className="relative flex max-h-[calc(100dvh-32px)] w-full max-w-[520px] min-w-0 flex-col overflow-x-hidden overflow-y-auto rounded-[20px] bg-white text-[#333D4B] focus-visible:outline-none"
                        onOpenAutoFocus={(event) => {
                            event.preventDefault();

                            if (input.current?.disabled) content.current?.focus();
                            else input.current?.focus();
                        }}
                        onCloseAutoFocus={(event) => {
                            event.preventDefault();

                            if (canReturnFocus(returnFocusTo)) returnFocusTo.focus();
                        }}
                        onKeyDown={(event) => event.stopPropagation()}
                        onPaste={(event) => event.stopPropagation()}
                        onEscapeKeyDown={(event) => {
                            event.stopPropagation();

                            if (disabled) event.preventDefault();
                        }}
                        onPointerDownOutside={(event) => {
                            if (disabled) event.preventDefault();
                        }}
                        onInteractOutside={(event) => {
                            if (disabled) event.preventDefault();
                        }}
                    >
                        <header className="shrink-0 px-5 pt-5 sm:px-7 sm:pt-6">
                            <div className="flex items-start justify-between gap-2">
                                <Dialog.Title className="min-w-0 self-center text-[20px] leading-7 font-semibold [overflow-wrap:anywhere] break-keep">
                                    {t('aiAutofillUi.conversationFeedbackDialog.feedbackOnThisResult')}
                                </Dialog.Title>
                                <button
                                    type="button"
                                    aria-label={t('aiAutofillUi.conversationFeedbackDialog.closeFeedback')}
                                    disabled={disabled}
                                    onClick={onClose}
                                    className="group relative -mr-2 grid size-[44px] shrink-0 place-items-center bg-transparent text-[#667085] transition-colors hover:text-[#5931B9] focus-visible:text-[#5931B9] focus-visible:outline-none disabled:opacity-40 motion-reduce:transition-none"
                                >
                                    <X aria-hidden="true" className="size-5" />
                                    <span
                                        aria-hidden="true"
                                        className="absolute bottom-[4px] h-[3px] w-[12px] rounded-full bg-current opacity-0 group-focus-visible:opacity-100"
                                    />
                                </button>
                            </div>
                            <p className="mt-3 text-[13px] leading-5 font-medium [overflow-wrap:anywhere] break-keep text-[#5931B9]">
                                {target}
                            </p>
                            <Dialog.Description className="mt-2 text-[14px] leading-[22px] [overflow-wrap:anywhere] break-keep text-[#667085]">
                                {t('aiAutofillUi.conversationFeedbackDialog.tellUsWhatDifferedFromYourRequestOrCouldBeImproved')}
                            </Dialog.Description>
                        </header>
                        <form
                            className="flex min-h-0 flex-1 flex-col"
                            onSubmit={(event) => {
                                event.preventDefault();

                                if (!disabled && value.trim()) onSubmit();
                            }}
                        >
                            <div className="min-h-[min(160px,30dvh)] overflow-y-auto overscroll-contain px-5 pt-6 sm:px-7">
                                <label htmlFor={`${id}-note`} className="block text-[14px] leading-5 font-semibold">
                                    {t('aiAutofillUi.conversationFeedbackDialog.yourFeedback')}
                                </label>
                                <textarea
                                    id={`${id}-note`}
                                    ref={input}
                                    value={value}
                                    disabled={disabled}
                                    maxLength={500}
                                    rows={5}
                                    aria-invalid={Boolean(error)}
                                    aria-describedby={`${id}-count${error ? ` ${id}-error` : ''}${retryHint ? ` ${id}-retry` : ''}`}
                                    placeholder={t(
                                        'aiAutofillUi.conversationFeedbackDialog.forExampleThereAreFewerDaysOffAfterNightShiftsThanRequested',
                                    )}
                                    onChange={(event) => onChange(event.target.value)}
                                    className="mt-2 min-h-[148px] w-full resize-y rounded-[12px] bg-[#F2F4F6] px-4 py-3 text-[14px] leading-[24px] text-[#333D4B] placeholder:text-[#7C8798] focus:bg-[#F1EDFF] focus:text-[#3F2A69] focus:outline-none disabled:opacity-60"
                                />
                                <div id={`${id}-count`} className="mt-1 text-right text-[12px] leading-5 text-[#667085] tabular-nums">
                                    <span className="sr-only">{t('aiAutofillUi.conversationFeedbackDialog.characterCount')} </span>
                                    {value.length} / 500
                                </div>
                                {error && (
                                    <div id={`${id}-error`} role="alert" className="mt-3 rounded-[10px] bg-[#FFF1F1] px-3 py-3">
                                        <p className="text-[13px] leading-[21px] [overflow-wrap:anywhere] break-keep text-[#B42318]">
                                            {error}
                                        </p>
                                    </div>
                                )}
                                {retryHint && (
                                    <p
                                        id={`${id}-retry`}
                                        className="mt-2 text-[12px] leading-5 [overflow-wrap:anywhere] break-keep text-[#667085]"
                                    >
                                        {retryHint}
                                    </p>
                                )}
                            </div>
                            <footer className="flex shrink-0 flex-wrap gap-2 px-5 pt-5 pb-5 sm:px-7 sm:pb-6">
                                <button
                                    type="button"
                                    disabled={disabled}
                                    onClick={onClose}
                                    className="min-h-[44px] min-w-0 flex-1 rounded-[10px] bg-[#F2F4F6] px-4 py-3 text-[14px] leading-5 font-medium text-[#475467] hover:bg-[#E9E3FA] hover:text-[#5931B9] focus-visible:bg-[#DCCEFF] focus-visible:text-[#45238E] focus-visible:outline-none disabled:opacity-40"
                                >
                                    {t('aiAutofillUi.conversationFeedbackDialog.cancel')}
                                </button>
                                <button
                                    type="submit"
                                    disabled={disabled || !value.trim()}
                                    aria-busy={disabled}
                                    className="flex min-h-[44px] min-w-0 flex-[2] items-center justify-center gap-2 rounded-[10px] bg-main-1 px-4 py-3 text-[14px] leading-5 font-semibold text-white hover:bg-[#5931B9] focus-visible:bg-[#45238E] focus-visible:text-[#EFE9FF] focus-visible:outline-none disabled:opacity-40"
                                >
                                    {disabled && (
                                        <LoaderCircle
                                            aria-hidden="true"
                                            className="size-4 shrink-0 animate-spin motion-reduce:animate-none"
                                        />
                                    )}
                                    {t('aiAutofillUi.conversationFeedbackDialog.sendFeedback')}
                                </button>
                            </footer>
                        </form>
                    </Dialog.Content>
                </Dialog.Overlay>
            </Dialog.Portal>
        </Dialog.Root>
    );
}
