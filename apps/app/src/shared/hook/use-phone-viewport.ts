import {useEffect, useState} from 'react';

export const PHONE_VIEWPORT_QUERY = '(max-width: 767px)';

export function getIsPhoneViewport() {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
        return false;
    }

    return window.matchMedia(PHONE_VIEWPORT_QUERY).matches;
}

export function usePhoneViewport() {
    const [isPhoneViewport, setIsPhoneViewport] = useState(getIsPhoneViewport);

    useEffect(() => {
        if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
            return undefined;
        }

        const mediaQuery = window.matchMedia(PHONE_VIEWPORT_QUERY);
        const updatePhoneViewport = () => setIsPhoneViewport(mediaQuery.matches);

        updatePhoneViewport();

        if (typeof mediaQuery.addEventListener === 'function') {
            mediaQuery.addEventListener('change', updatePhoneViewport);

            return () => mediaQuery.removeEventListener('change', updatePhoneViewport);
        }

        mediaQuery.addListener(updatePhoneViewport);

        return () => mediaQuery.removeListener(updatePhoneViewport);
    }, []);

    return isPhoneViewport;
}
