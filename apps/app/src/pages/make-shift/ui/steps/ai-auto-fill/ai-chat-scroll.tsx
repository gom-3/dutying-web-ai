import {useLayoutEffect, useRef, type ReactNode} from 'react';

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

    useLayoutEffect(() => {
        const element = viewport.current;
        const messages = content.current;

        if (!open || !element || !messages) return;

        let frame: number | undefined;

        const followLatestMessage = () => {
            if (frame !== undefined) cancelAnimationFrame(frame);

            // Measure after messages and the composer have finished changing the layout.
            frame = requestAnimationFrame(() => {
                frame = undefined;
                element.scrollTo?.({top: element.scrollHeight});
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
    }, [open, composerHidden]);

    return (
        <div ref={viewport} data-composer-hidden={composerHidden} className={`ai-adjust-chat-scroll ${className}`}>
            <div ref={content} className={`flow-root min-w-0 ${contentClassName}`}>
                {children}
            </div>
        </div>
    );
}
