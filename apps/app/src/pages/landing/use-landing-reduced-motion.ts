import {useSyncExternalStore} from 'react';

const reducedMotionQuery = '(prefers-reduced-motion: reduce)';

function subscribeToMotionPreference(onChange: () => void) {
    const query = window.matchMedia?.(reducedMotionQuery);

    query?.addEventListener?.('change', onChange);

    return () => query?.removeEventListener?.('change', onChange);
}

function getMotionPreference() {
    return window.matchMedia?.(reducedMotionQuery).matches ?? false;
}

function getServerMotionPreference() {
    return false;
}

export function useLandingReducedMotion() {
    return useSyncExternalStore(subscribeToMotionPreference, getMotionPreference, getServerMotionPreference);
}
