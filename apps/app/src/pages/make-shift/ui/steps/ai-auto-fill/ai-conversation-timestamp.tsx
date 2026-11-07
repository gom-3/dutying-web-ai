import {cn} from '@dutying/utils/style';
import {createContext, useContext, useEffect, useState, type HTMLAttributes, type ReactNode} from 'react';
import {useTranslation} from 'react-i18next';

/** Offset-less Spring LocalDateTime values are recorded in Asia/Seoul. */
export function conversationMessageDate(createdAt?: string): Date | null {
    if (!createdAt) return null;

    const value = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(createdAt) ? createdAt : `${createdAt}+09:00`;
    const date = new Date(value);

    return Number.isNaN(date.getTime()) ? null : date;
}

type TMessageTimestamp = {label: string; fullLabel: string; dateTime: string; side: 'left' | 'right'; isToday: boolean};

const MessageTimestampContext = createContext<TMessageTimestamp | null>(null);

function TimestampLabel({value, className = ''}: {value: TMessageTimestamp; className?: string}) {
    return (
        <time
            dateTime={value.dateTime}
            aria-label={value.fullLabel}
            className={`text-[0.6875rem] whitespace-nowrap text-[#596579] tabular-nums ${className}`}
        >
            {value.label}
        </time>
    );
}

/** The bubble owns the timestamp position, including short and nested messages. */
export function AiMessageTimestamp({side, inline = false}: {side?: 'left' | 'right'; inline?: boolean}) {
    const value = useContext(MessageTimestampContext);

    if (!value) return null;

    const edge = side ?? value.side;

    return (
        <TimestampLabel
            value={value}
            className={`pointer-events-none leading-3 opacity-0 group-hover/bubble:opacity-100 group-active/bubble:opacity-100 group-has-[:focus-visible]/bubble:opacity-100 ${inline ? `mt-0.5 block ${edge === 'left' ? 'text-left' : 'text-right'}` : `absolute top-full mt-1.5 ${edge === 'left' ? 'left-1' : 'right-1'}`}`}
        />
    );
}

export function AiMessageBubble({
    children,
    className,
    side,
    plain = false,
    ...props
}: HTMLAttributes<HTMLDivElement> & {side?: 'left' | 'right'; plain?: boolean}) {
    const value = useContext(MessageTimestampContext);

    return (
        <div
            {...props}
            className={cn('group/bubble relative', className, value && !plain && ['mb-1.5', value.isToday ? 'min-w-24' : 'min-w-16'])}
        >
            <MessageTimestampContext.Provider value={null}>{children}</MessageTimestampContext.Provider>
            <AiMessageTimestamp side={side} inline={plain} />
        </div>
    );
}

export function AiConversationTimestamp({
    createdAt,
    align = 'left',
    children,
}: {
    createdAt?: string;
    align?: 'left' | 'right';
    children?: ReactNode;
}) {
    const {i18n} = useTranslation();
    const [now, setNow] = useState(() => new Date());
    const date = conversationMessageDate(createdAt);
    const instant = date?.getTime();

    useEffect(() => {
        if (instant === undefined) return;

        const current = new Date();
        const midnight = new Date(current.getFullYear(), current.getMonth(), current.getDate() + 1);
        const timer = window.setTimeout(() => setNow(new Date()), Math.max(1, midnight.getTime() - current.getTime()));

        return () => window.clearTimeout(timer);
    }, [instant, now]);

    if (!date) return <>{children}</>;

    const isToday = date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth() && date.getDate() === now.getDate();
    const day = `${date.getMonth() + 1}/${date.getDate()}`;
    const label = isToday ? `${day} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}` : day;
    const fullLabel = new Intl.DateTimeFormat(i18n.language, {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
    }).format(date);
    const value: TMessageTimestamp = {label, fullLabel, dateTime: date.toISOString(), side: align === 'right' ? 'left' : 'right', isToday};

    if (children === undefined || children === null) return <TimestampLabel value={value} className="leading-5" />;

    return <MessageTimestampContext.Provider value={value}>{children}</MessageTimestampContext.Provider>;
}
