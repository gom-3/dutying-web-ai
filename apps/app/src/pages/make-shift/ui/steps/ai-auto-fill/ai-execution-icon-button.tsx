import {cn} from '@dutying/utils/style';
import type {ReactNode} from 'react';
import {Tooltip, TooltipContent, TooltipProvider, TooltipTrigger} from '@/shared/ui/primitives/tooltip';

export function AiExecutionIconButton({
    label,
    hint,
    children,
    onClick,
    disabled = false,
    tone = 'neutral',
    className,
}: {
    label: string;
    hint?: string;
    children: ReactNode;
    onClick: () => void;
    disabled?: boolean;
    tone?: 'neutral' | 'cancel';
    className?: string;
}) {
    return (
        <TooltipProvider delayDuration={200}>
            <Tooltip>
                <TooltipTrigger asChild>
                    <button
                        type="button"
                        aria-label={label}
                        aria-busy={disabled || undefined}
                        disabled={disabled}
                        onClick={onClick}
                        className={cn(
                            'forced-colors:focus-visible:outline-auto inline-flex size-11 shrink-0 items-center justify-center rounded-[10px] transition-colors focus-visible:bg-sub-1 focus-visible:text-white focus-visible:outline-none disabled:cursor-wait disabled:opacity-50 motion-reduce:transition-none',
                            tone === 'cancel'
                                ? 'bg-[#F4F5F7] text-[#667085] hover:bg-[#FDE9EC] hover:text-[#B42318]'
                                : 'text-gray-3 hover:bg-gray-7 hover:text-sub-1',
                            className,
                        )}
                    >
                        {children}
                    </button>
                </TooltipTrigger>
                <TooltipContent
                    side="top"
                    sideOffset={6}
                    className="z-[1500] max-w-60 bg-sub-1 px-3 py-2 text-center font-apple text-xs leading-5 text-white"
                >
                    {label}
                    {hint && <span className="block">{hint}</span>}
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>
    );
}
