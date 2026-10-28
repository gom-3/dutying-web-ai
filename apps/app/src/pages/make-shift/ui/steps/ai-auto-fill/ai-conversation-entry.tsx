import {ChevronRight, PencilLine, RotateCw, SlidersHorizontal} from 'lucide-react';
import {useState, type ReactNode} from 'react';
import {useTypedTranslation} from '@/shared/hook/use-typed-translation';
import {Tooltip, TooltipContent, TooltipProvider, TooltipTrigger} from '@/shared/ui/primitives/tooltip';
import type {TAdjustResultActions} from './ai-adjust-result';
import {AssistantMessage, UserMessage} from './ai-adjust-review-conversation';

export type TConversationEntryChoice = 'edit' | 'regenerate' | 'modify';

export function AiConversationConfirmation({confirmation}: {confirmation: TAdjustResultActions}) {
    const {t} = useTypedTranslation();

    return (
        <button
            type="button"
            disabled={!confirmation.canConfirm || confirmation.disabled}
            onClick={confirmation.onConfirm}
            className="col-span-2 mt-1 min-h-11 w-full rounded-[10px] bg-main-1 px-4 py-3 text-center text-[14px] leading-5 font-medium text-white hover:bg-[#5931B9] focus-visible:bg-[#E9E1FF] focus-visible:text-[#5931B9] focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-40"
        >
            {t('aiAdjust.chat.confirmSchedule')}
        </button>
    );
}

export function AiInfoTip({label, children}: {label: string; children: ReactNode}) {
    const [open, setOpen] = useState(false);

    return (
        <TooltipProvider delayDuration={200}>
            <Tooltip open={open} onOpenChange={setOpen}>
                <TooltipTrigger asChild>
                    <button
                        type="button"
                        aria-label={label}
                        onClick={() => setOpen((value) => !value)}
                        onKeyDown={(event) => {
                            if (event.key === 'Escape' && open) {
                                event.stopPropagation();
                                setOpen(false);
                            }
                        }}
                        className="group inline-flex size-11 shrink-0 items-center justify-center rounded-lg text-[#9CA3AF] focus-visible:bg-main-1 focus-visible:text-white focus-visible:outline-none"
                    >
                        <span aria-hidden className="grid size-4 place-items-center rounded-full bg-current">
                            <span className="font-serif text-[12px] leading-none font-bold text-white group-focus-visible:text-main-1">
                                i
                            </span>
                        </span>
                    </button>
                </TooltipTrigger>
                <TooltipContent
                    collisionPadding={12}
                    className="z-[1500] max-w-[min(320px,calc(100vw-24px))] bg-[#333D4B] px-3 py-2 text-left text-[13px] leading-5 [overflow-wrap:anywhere] break-keep whitespace-pre-line text-white"
                >
                    {children}
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>
    );
}

export function AiConversationEntry({
    choice,
    disabled,
    modifyDisabled,
    generationCompleted = false,
    hasSchedule = false,
    generationCompletedMessage,
    hideIntro = false,
    compact = false,
    attached = false,
    confirmation,
    onChoose,
}: {
    choice: TConversationEntryChoice | null;
    disabled: boolean;
    modifyDisabled?: boolean;
    generationCompleted?: boolean;
    hasSchedule?: boolean;
    generationCompletedMessage?: string;
    hideIntro?: boolean;
    compact?: boolean;
    attached?: boolean;
    confirmation?: TAdjustResultActions;
    onChoose: (choice: TConversationEntryChoice) => void;
}) {
    const {t} = useTypedTranslation();
    const primary: TConversationEntryChoice = hasSchedule || attached || generationCompleted ? 'edit' : 'regenerate';
    const choices: TConversationEntryChoice[] = compact ? ['modify', primary] : [primary, 'modify'];
    const compactLabels = {
        modify: t('aiAutofillUi.conversationEntry.requestChanges'),
        regenerate: t('aiAutofillUi.conversationEntry.refill'),
    };

    return (
        <div className="flex min-w-0 flex-col gap-4">
            {!hideIntro && (
                <AssistantMessage showTime>
                    <span className="whitespace-pre-line">
                        {generationCompleted
                            ? (generationCompletedMessage ?? t('aiAdjust.generationCompleted'))
                            : t('aiAdjust.chat.welcome')}
                    </span>
                </AssistantMessage>
            )}
            {choice ? (
                <>
                    <UserMessage key={choice} showTime>
                        {choice === 'edit' ? t('aiAutofillUi.conversationEntry.editSchedule') : t(`aiAdjust.chat.${choice}`)}
                    </UserMessage>
                    {choice === 'modify' && <AssistantMessage showTime>{t('aiAdjust.chat.askChanges')}</AssistantMessage>}
                </>
            ) : (
                <div
                    role="group"
                    aria-label={
                        attached
                            ? t('aiAdjust.snapshot.nextAction')
                            : compact
                              ? t('aiAutofillUi.conversationEntry.continueCurrentSchedule')
                              : t('aiAdjust.chat.welcome')
                    }
                    className={
                        attached
                            ? 'flex w-full min-w-0 flex-col gap-2'
                            : compact
                              ? 'grid w-full min-w-0 grid-cols-2 gap-2'
                              : 'flex w-full min-w-0 flex-col gap-2 pt-3'
                    }
                >
                    {compact && (
                        <p className="col-span-2 px-1 text-xs leading-5 text-[#667085]">
                            {t('aiAutofillUi.conversationEntry.continueCurrentSchedule')}
                        </p>
                    )}
                    {choices.map((value) => (
                        <button
                            key={value}
                            type="button"
                            disabled={disabled || (value === 'modify' && modifyDisabled)}
                            onClick={() => onChoose(value)}
                            className={`group flex w-full min-w-0 items-center rounded-[10px] py-3 text-left font-medium text-[#475467] transition-colors hover:bg-main-light hover:text-[#5931B9] focus-visible:bg-main-1 focus-visible:text-white focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-40 motion-reduce:transition-none ${attached ? 'min-h-11 gap-2.5 bg-white px-3 text-[13px] leading-5' : compact ? 'min-h-11 justify-center gap-2 bg-[#F2F4F6] px-3 text-[13px] leading-5' : 'min-h-14 gap-3 bg-[#F2F4F6] px-4 text-[14px]'}`}
                        >
                            {value === 'edit' ? (
                                <PencilLine aria-hidden className="size-4 shrink-0" />
                            ) : value === 'regenerate' ? (
                                <RotateCw aria-hidden className="size-4 shrink-0" />
                            ) : (
                                <SlidersHorizontal aria-hidden className="size-4 shrink-0" />
                            )}
                            <span className={compact ? 'min-w-0 break-keep' : 'min-w-0 flex-1 break-keep'}>
                                {value === 'edit'
                                    ? t('aiAutofillUi.conversationEntry.editSchedule')
                                    : compact
                                      ? compactLabels[value]
                                      : t(`aiAdjust.chat.${value}`)}
                            </span>
                            {!compact && <ChevronRight aria-hidden className="size-4 shrink-0" />}
                        </button>
                    ))}
                    {confirmation && <AiConversationConfirmation confirmation={confirmation} />}
                </div>
            )}
        </div>
    );
}
