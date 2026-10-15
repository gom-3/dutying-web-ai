import {type ReactNode, useState} from 'react';
import {InfoIcon} from '@/shared/assets/svg';
import {useTypedTranslation} from '@/shared/hook/use-typed-translation';
import {Tooltip, TooltipContent, TooltipProvider, TooltipTrigger} from '@/shared/ui/primitives/tooltip';

export function RequestSettingsHelp({label, children}: {label: string; children: ReactNode}) {
    const {t} = useTypedTranslation();
    const [open, setOpen] = useState(false);

    return (
        <TooltipProvider delayDuration={120}>
            <Tooltip open={open} onOpenChange={setOpen}>
                <TooltipTrigger asChild>
                    <button
                        type="button"
                        aria-label={t('requestCapacity.help', {label})}
                        onClick={(event) => {
                            event.preventDefault();
                            setOpen((value) => !value);
                        }}
                        className="inline-flex size-11 shrink-0 items-center justify-center rounded-lg text-[#777B89] hover:bg-[#ECE9F5] hover:text-[#5331B5] focus-visible:bg-[#E6DFFF] focus-visible:text-[#432091] focus-visible:outline-none forced-colors:focus-visible:outline forced-colors:focus-visible:outline-2"
                    >
                        <InfoIcon aria-hidden="true" className="size-4" />
                    </button>
                </TooltipTrigger>
                <TooltipContent
                    side="top"
                    align="start"
                    sideOffset={6}
                    className="z-[2147483647] max-w-[min(20rem,calc(100vw-2rem))] rounded-lg bg-[#25283B] px-3 py-2 text-sm leading-6 font-normal text-white motion-reduce:animate-none"
                >
                    {children}
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>
    );
}
