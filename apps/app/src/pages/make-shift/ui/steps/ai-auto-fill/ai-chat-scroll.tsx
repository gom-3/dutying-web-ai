import {useLayoutEffect, useRef, useState, type ReactNode} from 'react';
import {useTypedTranslation} from '@/shared/hook/use-typed-translation';

type TProps = {
    children: ReactNode;
    open?: boolean;
    composerHidden: boolean;
    className: string;
    contentClassName?: string;
};

export function AiChatScroll({children, open = true, composerHidden, className, contentClassName = ''}: TProps) {
    const {t} = useTypedTranslation();
    const viewport = useRef<HTMLDivElement>(null);
    const content = useRef<HTMLDivElement>(null);
    const following = useRef(true);
    const [showLatest, setShowLatest] = useState(false);

    useLayoutEffect(() => {
        const element = viewport.current;
        const messages = content.current;

        if (!open || !element || !messages) return;

        let frame: number | undefined;

        const followLatestMessage = () => {
            if (!following.current) return;

            if (frame !== undefined) cancelAnimationFrame(frame);

            // Measure after messages and the composer have finished changing the layout.
            frame = requestAnimationFrame(() => {
                frame = undefined;

                if (following.current) element.scrollTo?.({top: element.scrollHeight, behavior: 'instant'});
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
        };
    }, [open]);

    return (
        <div className="ai-chat-scroll-frame relative flex min-h-0 min-w-0 flex-1 flex-col">
            <div
                ref={viewport}
                tabIndex={-1}
                data-composer-hidden={composerHidden}
                className={`ai-adjust-chat-scroll focus-visible:bg-[#FAF9FF] focus-visible:text-[#333D4B] focus-visible:outline-none ${className}`}
                onScroll={(event) => {
                    const element = event.currentTarget;

                    following.current = element.scrollHeight - element.scrollTop - element.clientHeight < 64;
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
