export const DEMO_SESSION_DURATION_MS = 3_540_000;
export const DEMO_SESSION_EXPIRING_SOON_MS = 10 * 60 * 1000;

export type TDemoSessionInfo = {
    isActive: boolean;
    isExpired: boolean;
    isExpiringSoon: boolean;
    remainingMs: number;
    remainingMinutes: number;
    remainingRoundedMinutes: number;
    remainingSeconds: number;
    countdownLabel: string;
};

const formatCountdown = (minutes: number, seconds: number) => `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

export const getDemoSessionInfo = (demoStartDate: string | null, now = Date.now()): TDemoSessionInfo | null => {
    if (!demoStartDate) {
        return null;
    }

    const startedAt = new Date(demoStartDate).getTime();

    if (Number.isNaN(startedAt)) {
        return null;
    }

    const remainingMs = startedAt + DEMO_SESSION_DURATION_MS - now;
    const safeRemainingMs = Math.max(remainingMs, 0);
    const remainingTotalSeconds = Math.ceil(safeRemainingMs / 1000);
    const remainingMinutes = Math.floor(remainingTotalSeconds / 60);
    const remainingSeconds = remainingTotalSeconds % 60;

    return {
        isActive: remainingMs > 0,
        isExpired: remainingMs <= 0,
        isExpiringSoon: safeRemainingMs > 0 && safeRemainingMs <= DEMO_SESSION_EXPIRING_SOON_MS,
        remainingMs: safeRemainingMs,
        remainingMinutes,
        remainingRoundedMinutes: remainingTotalSeconds > 0 ? Math.ceil(remainingTotalSeconds / 60) : 0,
        remainingSeconds,
        countdownLabel: formatCountdown(remainingMinutes, remainingSeconds),
    };
};

export const isDemoSessionExpired = (demoStartDate: string | null, now = Date.now()) =>
    demoStartDate ? (getDemoSessionInfo(demoStartDate, now)?.isExpired ?? true) : false;
