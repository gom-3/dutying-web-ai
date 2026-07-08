export const ANNUAL_LEAVE_STEP_DAYS = 1;

export function normalizeAnnualLeaveDays(value: unknown) {
    const numeric = typeof value === 'number' ? value : Number(value);

    if (!Number.isFinite(numeric)) {
        return 0;
    }

    return Math.round(numeric * 10) / 10;
}

export function formatAnnualLeaveDays(value: unknown) {
    const normalized = normalizeAnnualLeaveDays(value);

    return Number.isInteger(normalized) ? String(normalized) : normalized.toFixed(1);
}
