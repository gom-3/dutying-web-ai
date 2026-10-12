import {useEffect, useRef, useState} from 'react';

/** One request at a time; a failed/paused lookup must never look like completed calculation. */
export function useConversationPolling(enabled: boolean, conversationId: number | undefined, refresh: () => Promise<void>) {
    const refreshRef = useRef(refresh);
    const inFlight = useRef<Promise<void> | null>(null);
    const [issue, setIssue] = useState<'connection' | 'timeout' | null>(null);
    const [attempt, setAttempt] = useState(0);

    useEffect(() => {
        refreshRef.current = refresh;
    }, [refresh]);
    useEffect(() => {
        setIssue(null);

        if (!enabled) return;

        let active = true;
        let count = 0;
        let timer: ReturnType<typeof setTimeout>;

        const poll = async () => {
            const request = inFlight.current ?? refreshRef.current();

            inFlight.current = request;

            try {
                await request;

                if (active) setIssue(null);
            } catch {
                if (active) setIssue('connection');
            } finally {
                if (inFlight.current === request) inFlight.current = null;
            }

            if (!active) return;

            if (++count >= 100) {
                setIssue('timeout');

                return;
            }

            timer = setTimeout(() => void poll(), 3000);
        };

        timer = setTimeout(() => void poll(), attempt > 0 ? 0 : 3000);

        return () => {
            active = false;
            clearTimeout(timer);
        };
    }, [enabled, conversationId, attempt]);

    return {issue, retry: () => setAttempt((value) => value + 1)};
}
