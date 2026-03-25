import {sanitizeInternalPath} from '@/shared/config/runtime';
import ROUTE from '@/shared/constant/path';

export const DEMO_SESSION_DURATION_MS = 3540000;

const DEMO_SIGNUP_REASON = 'demo-expired';
const toTimestamp = (demoStartDate: string | null | undefined) => {
    if (!demoStartDate) return null;

    const timestamp = new Date(demoStartDate).getTime();

    return Number.isNaN(timestamp) ? null : timestamp;
};

export const getDemoSessionRemainingMs = (demoStartDate: string | null | undefined, now: number = Date.now()) => {
    const startedAt = toTimestamp(demoStartDate);

    if (startedAt === null) return 0;

    return Math.max(startedAt + DEMO_SESSION_DURATION_MS - now, 0);
};

export const isDemoSessionExpired = (demoStartDate: string | null | undefined, now: number = Date.now()) =>
    Boolean(demoStartDate) && getDemoSessionRemainingMs(demoStartDate, now) === 0;

export const formatDemoSessionRemainingLabel = (demoStartDate: string | null | undefined, now: number = Date.now()) => {
    const remainingMs = getDemoSessionRemainingMs(demoStartDate, now);

    if (remainingMs <= 0) return null;

    const totalSeconds = Math.ceil(remainingMs / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = `${totalSeconds % 60}`.padStart(2, '0');

    return `듀팅 체험중 ${minutes}:${seconds}`;
};

export const buildDemoSignupLoginPath = (nextPath: string = ROUTE.REGISTER) => {
    const params = new URLSearchParams({
        reason: DEMO_SIGNUP_REASON,
        next: sanitizeInternalPath(nextPath, ROUTE.REGISTER),
    });

    return `${ROUTE.LOGIN}?${params.toString()}`;
};

export const getIsDemoSignupLoginReason = (search: string) => new URLSearchParams(search).get('reason') === DEMO_SIGNUP_REASON;
