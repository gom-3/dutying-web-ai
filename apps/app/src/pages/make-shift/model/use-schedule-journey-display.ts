import type {TScheduleObservation} from '@dutying/api/ward';
import {useEffect, useRef} from 'react';
import i18n from '@/i18n';
import {reportScheduleJourney} from './schedule-journey';

/** Reports committed, visible UI text. This is not evidence that a human read it. */
export function useScheduleJourneyDisplay<T extends HTMLElement = HTMLDivElement>(observation?: TScheduleObservation) {
    const ref = useRef<T>(null);

    useEffect(() => {
        if (!observation) return;

        const report = () => {
            const node = ref.current;

            if (!node || document.visibilityState === 'hidden' || !node.getClientRects().length) return;

            const style = getComputedStyle(node);
            const bounds = node.getBoundingClientRect();
            if (
                style.visibility === 'hidden' ||
                style.opacity === '0' ||
                bounds.bottom <= 0 ||
                bounds.top >= window.innerHeight ||
                bounds.right <= 0 ||
                bounds.left >= window.innerWidth
            )
                return;
            const displayedText = node.innerText?.trim();

            if (!displayedText) return;

            void reportScheduleJourney(observation, {
                type: 'CLIENT_DISPLAYED',
                displayedText: displayedText.slice(0, 8000),
                displayedTextTruncated: displayedText.length > 8000,
                language: i18n.language,
            });
        };
        const frame = requestAnimationFrame(report);

        const observer =
            typeof IntersectionObserver === 'undefined'
                ? undefined
                : new IntersectionObserver((entries) => {
                      if (entries.some((entry) => entry.isIntersecting)) report();
                  });
        if (ref.current) observer?.observe(ref.current);
        document.addEventListener('visibilitychange', report);
        return () => {
            observer?.disconnect();
            cancelAnimationFrame(frame);
            document.removeEventListener('visibilitychange', report);
        };
    });

    return ref;
}
