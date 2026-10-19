export function AiConversationOutcomeIcon({status, label}: {status: 'success' | 'failure' | 'review'; label: string}) {
    return (
        <svg
            role="img"
            aria-label={label}
            viewBox="0 0 20 20"
            className={`mt-[2px] size-[18px] shrink-0 ${status === 'success' ? 'text-[#16835E]' : status === 'review' ? 'text-[#A15C00]' : 'text-[#D92D20]'}`}
        >
            <circle cx="10" cy="10" r="9" fill="currentColor" />
            <path
                d={
                    status === 'success'
                        ? 'm5.5 9.5 3 3 6-6L16 8l-7.5 7.5L4 11z'
                        : status === 'review'
                          ? 'M9 5h2v6H9zm0 8h2v2H9z'
                          : 'M6.4 5 10 8.6 13.6 5 15 6.4 11.4 10 15 13.6 13.6 15 10 11.4 6.4 15 5 13.6 8.6 10 5 6.4z'
                }
                fill="white"
            />
        </svg>
    );
}
