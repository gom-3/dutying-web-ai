import {cn} from '@dutying/utils/style';
import {ProfileImage} from '@/entities/account/ui/profile-image';

type TWardChatPreviewBubblePosition = 'fixed' | 'inline';

type TWardChatPreviewBubbleProps = {
    senderName: string;
    senderProfileImgUrl?: string | null;
    text: string;
    ariaLabel: string;
    onClick: () => void;
    position?: TWardChatPreviewBubblePosition;
    className?: string;
};

export function WardChatPreviewBubble({
    senderName,
    senderProfileImgUrl,
    text,
    ariaLabel,
    onClick,
    position = 'inline',
    className,
}: TWardChatPreviewBubbleProps) {
    return (
        <button
            type="button"
            aria-label={ariaLabel}
            aria-live="polite"
            className={cn(
                'relative flex min-h-[76px] items-start gap-3 rounded-[12px] border border-[#E4E8F0] bg-white p-3 text-left shadow-[0_18px_48px_rgba(15,23,42,0.18)] ring-1 ring-black/[0.03] transition-[transform,box-shadow,border-color] duration-200 hover:-translate-y-0.5 hover:border-[#D6DCE8] hover:shadow-[0_22px_56px_rgba(15,23,42,0.2)] focus-visible:ring-2 focus-visible:ring-main-3 focus-visible:ring-offset-2 focus-visible:outline-none',
                position === 'fixed'
                    ? 'fixed right-4 bottom-[94px] z-[1301] w-[min(324px,calc(100vw-32px))] animate-in zoom-in-95 fade-in slide-in-from-bottom-2 sm:right-6 sm:bottom-[102px]'
                    : 'w-full max-w-[324px]',
                className,
            )}
            onClick={onClick}
        >
            <span className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-[10px]">
                <ProfileImage
                    name={senderName}
                    profileImg={senderProfileImgUrl ? {profileImgUrl: senderProfileImgUrl} : undefined}
                    className="size-full rounded-[10px]"
                    alt=""
                    aria-hidden="true"
                />
            </span>
            <span className="min-w-0 flex-1 pt-0.5">
                <span className="flex min-w-0 items-center gap-2">
                    <span className="truncate text-[13px] leading-4 font-bold text-[#17171C]">{senderName}</span>
                    <span className="size-1.5 shrink-0 rounded-full bg-main-1" aria-hidden="true" />
                </span>
                <span className="mt-1 [display:-webkit-box] block overflow-hidden text-[13px] leading-5 font-medium break-words text-[#3F4652] [-webkit-box-orient:vertical] [-webkit-line-clamp:2]">
                    {text}
                </span>
            </span>
            <span
                aria-hidden="true"
                className="absolute right-[25px] -bottom-1.5 size-3 rotate-45 border-r border-b border-[#E4E8F0] bg-white"
            />
        </button>
    );
}
