import {useRef, useState} from 'react';
import {InfoIcon} from '@/shared/assets/svg';
import {useTypedTranslation} from '@/shared/hook/use-typed-translation';
import {Tooltip, TooltipContent, TooltipTrigger} from '@/shared/ui/primitives/tooltip';

export function NurseShiftTypesHelp() {
    const {t} = useTypedTranslation();
    const [open, setOpen] = useState(false);
    const triggerRef = useRef<HTMLButtonElement>(null);
    const container = triggerRef.current?.closest<HTMLElement>('[role="dialog"]') ?? triggerRef.current?.closest('aside');

    return (
        <Tooltip open={open} onOpenChange={setOpen}>
            <TooltipTrigger asChild>
                <button
                    ref={triggerRef}
                    type="button"
                    aria-label={t('page.member.detail.shiftTypesHelpAria')}
                    aria-expanded={open}
                    onClick={(event) => {
                        event.preventDefault();
                        setOpen((previous) => !previous);
                    }}
                    onKeyDown={(event) => {
                        if (!open || event.key !== 'Escape') return;

                        event.preventDefault();
                        event.stopPropagation();
                        setOpen(false);
                    }}
                    className="grid size-8 shrink-0 place-items-center rounded-full text-[#8B95A7] transition-colors hover:bg-[#EEEAFE] hover:text-[#6555E8] focus-visible:bg-[#E5E0FF] focus-visible:text-[#4F3FD8] focus-visible:outline-none motion-reduce:transition-none [@media(pointer:coarse)]:size-11"
                >
                    <InfoIcon className="size-[17px]" aria-hidden="true" />
                </button>
            </TooltipTrigger>
            <TooltipContent
                container={container ?? undefined}
                side="top"
                align="start"
                sideOffset={8}
                collisionPadding={12}
                className="z-[1400] max-w-[calc(100vw-24px)] rounded-[10px] bg-[#252B36] px-3 py-2 text-left font-apple text-[13px] leading-[1.55] whitespace-normal text-[#F4F6F8] motion-reduce:animate-none"
            >
                {t('page.member.detail.shiftTypesHint')}
            </TooltipContent>
        </Tooltip>
    );
}
