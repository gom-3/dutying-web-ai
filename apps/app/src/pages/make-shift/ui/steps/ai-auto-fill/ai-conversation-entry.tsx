import {ChevronRight, RotateCw, SlidersHorizontal} from 'lucide-react';
import {useState, type ReactNode} from 'react';
import {useTypedTranslation} from '@/shared/hook/use-typed-translation';
import {Tooltip, TooltipContent, TooltipProvider, TooltipTrigger} from '@/shared/ui/primitives/tooltip';
import type {TAdjustResultActions} from './ai-adjust-result';
import {AssistantMessage, UserMessage} from './ai-adjust-review-conversation';

export type TConversationEntryChoice = 'regenerate' | 'modify';

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
    hideIntro = false,
    confirmation,
    onChoose,
}: {
    choice: TConversationEntryChoice | null;
    disabled: boolean;
    modifyDisabled?: boolean;
    generationCompleted?: boolean;
    hideIntro?: boolean;
    confirmation?: TAdjustResultActions;
    onChoose: (choice: TConversationEntryChoice) => void;
}) {
    const {t} = useTypedTranslation();

    return (
        <div className="flex min-w-0 flex-col gap-4">
            {!hideIntro && (
                <AssistantMessage>
                    <span className="whitespace-pre-line">
                        {t(generationCompleted ? 'aiAdjust.generationCompleted' : 'aiAdjust.chat.welcome')}
                    </span>
                </AssistantMessage>
            )}
            {choice ? (
                <>
                    <UserMessage>{t(`aiAdjust.chat.${choice}`)}</UserMessage>
                    {choice === 'modify' && <AssistantMessage>{t('aiAdjust.chat.askChanges')}</AssistantMessage>}
                </>
            ) : (
                <div
                    role="group"
                    aria-label={t('aiAdjust.chat.welcome')}
                    className="flex w-full min-w-0 flex-col gap-2 border-t border-gray-6 pt-4"
                >
                    {(['regenerate', 'modify'] as const).map((value) => (
                        <button
                            key={value}
                            type="button"
                            disabled={disabled || (value === 'modify' && modifyDisabled)}
                            onClick={() => onChoose(value)}
                            className="group flex min-h-14 w-full items-center gap-3 rounded-lg border border-gray-5 bg-white px-4 py-3 text-left text-[14px] font-medium text-[#333D4B] transition-colors hover:border-main-1 hover:bg-main-light focus-visible:border-main-1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-main-1 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                            {value === 'regenerate' ? (
                                <RotateCw aria-hidden className="size-5 shrink-0 text-main-1" />
                            ) : (
                                <SlidersHorizontal aria-hidden className="size-5 shrink-0 text-main-1" />
                            )}
                            <span className="flex-1">{t(`aiAdjust.chat.${value}`)}</span>
                            <ChevronRight aria-hidden className="size-4 shrink-0 text-gray-3 group-hover:text-main-1" />
                        </button>
                    ))}
                    {confirmation && (
                        <button
                            type="button"
                            disabled={!confirmation.canConfirm || confirmation.disabled}
                            onClick={confirmation.onConfirm}
                            className="mt-2 min-h-11 w-full rounded-lg bg-main-1 px-4 py-2 text-center text-[14px] font-medium text-white hover:bg-[#5931B9] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-main-1 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                            {t('aiAdjust.chat.confirmSchedule')}
                        </button>
                    )}
                </div>
            )}
        </div>
    );
}
