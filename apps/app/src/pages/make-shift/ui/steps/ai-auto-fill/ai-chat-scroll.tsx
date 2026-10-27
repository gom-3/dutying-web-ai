import {useLayoutEffect, useRef, useState, type ReactNode} from 'react';
import {useTypedTranslation} from '@/shared/hook/use-typed-translation';
import {readScheduleChat, writeScheduleChat} from '../../../model/schedule-chat-cache';

type TProps = {
    children: ReactNode;
    open?: boolean;
    composerHidden: boolean;
    className: string;
    contentClassName?: string;
    historyKey?: string | null;
    resetKey?: number | string;
    ready?: boolean;
};

type TReadingPosition = {top: number; following: boolean};

const readPosition = (key: string | null) =>
    readScheduleChat<TReadingPosition>(key, (value): value is TReadingPosition => {
        const position = value as TReadingPosition | null;

        return Boolean(position && Number.isFinite(position.top) && position.top >= 0 && typeof position.following === 'boolean');
    }) ?? {top: 0, following: true};

export function AiChatScroll({
    children,
    open = true,
    composerHidden,
    className,
    contentClassName = '',
    historyKey = null,
    resetKey = 0,
    ready = true,
}: TProps) {
    const {t} = useTypedTranslation();
    const viewport = useRef<HTMLDivElement>(null);
    const content = useRef<HTMLDivElement>(null);
    const position = useRef(readPosition(historyKey));
    const scope = useRef({historyKey, resetKey});
    const following = useRef(position.current.following);
    const restoring = useRef(true);
    const [showLatest, setShowLatest] = useState(!position.current.following);

    useLayoutEffect(() => {
        if (scope.current.historyKey === historyKey && scope.current.resetKey === resetKey) return;

        position.current = scope.current.historyKey !== historyKey ? readPosition(historyKey) : {top: 0, following: true};
        scope.current = {historyKey, resetKey};
        following.current = position.current.following;
        restoring.current = true;
        setShowLatest(!following.current);
        writeScheduleChat(historyKey, position.current);
    }, [historyKey, resetKey]);

    useLayoutEffect(() => {
        const element = viewport.current;
        const messages = content.current;

        if (!open || !ready || !element || !messages) return;

        let frame: number | undefined;

        restoring.current = true;

        const followLatestMessage = () => {
            if (!following.current && !restoring.current) return;

            if (frame !== undefined) cancelAnimationFrame(frame);

            // Measure after messages and the composer have finished changing the layout.
            frame = requestAnimationFrame(() => {
                frame = undefined;

                if (following.current) element.scrollTo?.({top: element.scrollHeight, behavior: 'instant'});
                else if (restoring.current) {
                    const top = Math.min(position.current.top, Math.max(0, element.scrollHeight - element.clientHeight));

                    element.scrollTo?.({top, behavior: 'instant'});
                }

                restoring.current = false;
            });
        };
        const mutations = new MutationObserver(followLatestMessage);
        const resize = typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(followLatestMessage);

        mutations.observe(messages, {childList: true, characterData: true, subtree: true});
        resize?.observe(messages);
        resize?.observe(element);
        followLatestMessage();

        return () => {
            mutations.disconnect();
            resize?.disconnect();

            if (frame !== undefined) cancelAnimationFrame(frame);

            writeScheduleChat(historyKey, position.current);
        };
    }, [open, ready, historyKey, resetKey]);

    return (
        <div className="ai-chat-scroll-frame relative flex min-h-0 min-w-0 flex-1 flex-col">
            <div
                ref={viewport}
                tabIndex={-1}
                data-composer-hidden={composerHidden}
                className={`ai-adjust-chat-scroll focus-visible:bg-[#FAF9FF] focus-visible:text-[#333D4B] focus-visible:outline-none ${className}`}
                onScroll={(event) => {
                    const element = event.currentTarget;

                    if (!open || !ready || restoring.current || element.clientHeight === 0) return;

                    following.current = element.scrollHeight - element.scrollTop - element.clientHeight < 64;
                    position.current = {top: element.scrollTop, following: following.current};
                    writeScheduleChat(historyKey, position.current);
                    setShowLatest(!following.current);
                }}
            >
                <div ref={content} className={`flow-root min-w-0 ${contentClassName}`}>
                    {children}
                </div>
            </div>
            {open && showLatest && (
                <div className="pointer-events-none absolute inset-x-0 bottom-3 flex justify-center">
                    <button
                        type="button"
                        aria-label={t('aiAutofillUi.chatScroll.latestMessage')}
                        title={t('aiAutofillUi.chatScroll.latestMessage')}
                        className="pointer-events-auto grid size-[44px] shrink-0 place-items-center rounded-full bg-[#F0EBFF] text-[#5931B9] transition-colors hover:bg-[#E6DEFF] focus-visible:bg-main-1 focus-visible:text-white focus-visible:outline-none motion-reduce:transition-none"
                        onClick={() => {
                            following.current = true;
                            position.current = {top: viewport.current?.scrollTop ?? 0, following: true};
                            writeScheduleChat(historyKey, position.current);
                            setShowLatest(false);
                            viewport.current?.focus({preventScroll: true});
                            viewport.current?.scrollTo({top: viewport.current.scrollHeight, behavior: 'instant'});
                        }}
                    >
                        <svg aria-hidden="true" viewBox="0 0 20 20" fill="currentColor" className="size-[20px]">
                            <path d="M9 3h2v10.2l3.6-3.6L16 11l-6 6-6-6 1.4-1.4L9 13.2z" />
                        </svg>
                    </button>
                </div>
            )}
        </div>
    );
}
