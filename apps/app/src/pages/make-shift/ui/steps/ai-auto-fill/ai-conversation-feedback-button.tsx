import {MessageSquare} from 'lucide-react';
import type {MouseEventHandler} from 'react';

export function AiConversationFeedbackButton({
    label,
    disabled,
    onClick,
}: {
    label: string;
    disabled?: boolean;
    onClick: MouseEventHandler<HTMLButtonElement>;
}) {
    return (
        <button
            type="button"
            aria-label={label}
            aria-haspopup="dialog"
            title={label}
            disabled={disabled}
            onClick={onClick}
            className="group relative grid size-[44px] shrink-0 place-items-center bg-transparent text-[#667085] transition-colors hover:text-[#5931B9] focus-visible:text-[#5931B9] focus-visible:outline-none disabled:opacity-40 motion-reduce:transition-none"
        >
            <MessageSquare aria-hidden="true" className="size-[18px]" />
            <span
                aria-hidden="true"
                className="absolute bottom-[4px] h-[3px] w-[12px] rounded-full bg-current opacity-0 group-focus-visible:opacity-100"
            />
        </button>
    );
}
