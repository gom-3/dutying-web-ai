import i18n from '@/i18n';

/** Offset-less Spring LocalDateTime values are recorded in Asia/Seoul. */
export function conversationMessageDate(createdAt?: string): Date | null {
    if (!createdAt) return null;

    const value = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(createdAt) ? createdAt : `${createdAt}+09:00`;
    const date = new Date(value);

    return Number.isNaN(date.getTime()) ? null : date;
}

export function AiConversationTimestamp({createdAt, align = 'left'}: {createdAt?: string; align?: 'left' | 'right'}) {
    const date = conversationMessageDate(createdAt);

    if (!date) return null;

    const label = new Intl.DateTimeFormat(i18n.language, {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
    }).format(date);

    return (
        <time
            dateTime={date.toISOString()}
            title={date.toLocaleString(i18n.language)}
            className={`mt-1 block text-xs leading-5 text-[#667085] ${align === 'right' ? 'text-right' : ''}`}
        >
            {label}
        </time>
    );
}
