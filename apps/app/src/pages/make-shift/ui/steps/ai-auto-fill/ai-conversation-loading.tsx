type TProps = {
    label: string;
    description?: string;
    className?: string;
};

/** A quiet, shared waiting state. Motion is decorative; the label carries the status. */
export function AiConversationLoading({label, description, className = ''}: TProps) {
    return (
        <div role="status" aria-atomic="true" className={`flex min-w-0 items-start gap-3 py-2 ${className}`}>
            <span aria-hidden="true" className="flex h-5 shrink-0 items-center gap-1">
                {[0, 1, 2].map((dot) => (
                    <span key={dot} className="ai-adjust-review-dot size-[5px] rounded-full bg-main-1" />
                ))}
            </span>
            <div className="min-w-0">
                <p className="text-[13px] leading-5 font-medium break-keep text-[#475467]">{label}</p>
                {description && <p className="mt-1 text-xs leading-5 break-keep text-[#667085]">{description}</p>}
            </div>
        </div>
    );
}

export function AiConversationLoadingPlaceholder({label}: Pick<TProps, 'label'>) {
    return (
        <div className="space-y-5 py-2">
            <AiConversationLoading label={label} className="rounded-[14px] bg-[#F5F2FC] px-4 py-4" />
            <div aria-hidden="true" className="space-y-4">
                <div className="w-[82%] space-y-2 rounded-2xl rounded-tl-sm bg-[#F2F4F6] p-4">
                    <div className="h-2 w-3/4 rounded-full bg-[#E3E7EC]" />
                    <div className="h-2 w-1/2 rounded-full bg-[#E3E7EC]" />
                </div>
                <div className="ml-auto w-[58%] rounded-2xl rounded-tr-sm bg-[#F2EDFC] p-4">
                    <div className="h-2 w-4/5 rounded-full bg-[#E5DDF6]" />
                </div>
                <div className="w-[72%] space-y-2 rounded-2xl rounded-tl-sm bg-[#F2F4F6] p-4">
                    <div className="h-2 w-4/5 rounded-full bg-[#E3E7EC]" />
                    <div className="h-2 w-2/5 rounded-full bg-[#E3E7EC]" />
                </div>
            </div>
        </div>
    );
}
