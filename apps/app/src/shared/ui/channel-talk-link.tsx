import {useEffect, useRef, useState, type MouseEvent, type ReactNode} from 'react';
import {useTranslation} from 'react-i18next';
import {CHANNEL_TALK_URL, openChannelTalk, setChannelTalkLanguage} from '@/shared/lib/channel-talk';

export function ChannelTalkLink({children, className}: {children: ReactNode; className?: string}) {
    const {i18n} = useTranslation();
    const language = i18n.resolvedLanguage ?? i18n.language;
    const opening = useRef(false);
    const [isOpening, setIsOpening] = useState(false);

    useEffect(() => {
        // A failed language update is retried when the visitor opens the messenger.
        void setChannelTalkLanguage(language).catch(() => {});
    }, [language]);

    const handleClick = async (event: MouseEvent<HTMLAnchorElement>) => {
        if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

        event.preventDefault();

        if (opening.current) return;

        opening.current = true;
        setIsOpening(true);

        try {
            await openChannelTalk(language);
        } catch {
            // Keep support reachable when the SDK is blocked or unavailable.
            window.location.assign(CHANNEL_TALK_URL);
        } finally {
            opening.current = false;
            setIsOpening(false);
        }
    };

    return (
        <a
            href={CHANNEL_TALK_URL}
            target="_blank"
            rel="noreferrer"
            className={className}
            aria-busy={isOpening || undefined}
            onClick={(event) => void handleClick(event)}
        >
            {children}
        </a>
    );
}
