import {useLayoutEffect, useRef, useState, type ReactNode} from 'react';

import i18n from '@/i18n';

type TProps = {
    children: ReactNode;
    open?: boolean;
    composerHidden: boolean;
    className: string;
    contentClassName?: string;
};

export function AiChatScroll({children, open = true, composerHidden, className, contentClassName = ''}: TProps) {
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
        <div
            ref={viewport}
            data-composer-hidden={composerHidden}
            className={`ai-adjust-chat-scroll ${className}`}
            onScroll={(event) => {
                const element = event.currentTarget;
                following.current = element.scrollHeight - element.scrollTop - element.clientHeight < 64;
                setShowLatest(!following.current);
            }}
        >
            <div ref={content} className={`flow-root min-w-0 ${contentClassName}`}>
                {children}
            </div>
            {showLatest && (
                <div className="pointer-events-none sticky bottom-2 flex justify-center">
                    <button
                        type="button"
                        className="pointer-events-auto rounded-full border border-gray-6 bg-white px-4 py-2 text-sm shadow-sm focus-visible:outline-2 focus-visible:outline-main-1"
                        onClick={() => {
                            following.current = true;
                            setShowLatest(false);
                            viewport.current?.scrollTo({top: viewport.current.scrollHeight, behavior: 'instant'});
                        }}
                    >
                        {i18n.language.startsWith('ko') ? '최근 대화로 이동' : 'Go to latest message'}
                    </button>
                </div>
            )}
        </div>
    );
}
