import type {Order, QuoteTerms} from './api';

export function quoteTimestamp(value: string): number {
    return Date.parse(/[Z+-]\d*:?.*$/.test(value.slice(10)) ? value : `${value}Z`);
}

export function parseSubscriptionSummary(value: unknown): NonNullable<Order['subscriptionSummary']> | undefined {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return;

    const summary = value as NonNullable<Order['subscriptionSummary']>;

    if (typeof summary.scopeName !== 'string' || !summary.scopeName.trim()) return;

    if (typeof summary.termsVersion !== 'string' || !summary.termsVersion.trim()) return;

    if (!Number.isSafeInteger(summary.monthlyGross) || summary.monthlyGross <= 0) return;

    if (typeof summary.periodStart !== 'string' || typeof summary.periodEnd !== 'string') return;

    if (!(quoteTimestamp(summary.periodEnd) > quoteTimestamp(summary.periodStart))) return;

    return summary;
}

/** A broken quote must never crash checkout or display an unchecked payable amount. */
export function parseQuoteTerms(snapshot: string): QuoteTerms | undefined {
    try {
        const value: unknown = JSON.parse(snapshot);

        if (!value || typeof value !== 'object' || Array.isArray(value)) return;

        const q = value as QuoteTerms;
        const amounts = [q.totalAmount, q.supplyAmount, q.taxAmount, q.fullUnits, q.partialUnits, q.recurring?.monthlyGross];

        if (!amounts.every((n) => Number.isSafeInteger(n) && n >= 0)) return;

        if (q.supplyAmount + q.taxAmount !== q.totalAmount) return;

        if (typeof q.termsVersion !== 'string' || !q.termsVersion.trim()) return;

        if (typeof q.periodStart !== 'string' || typeof q.periodEnd !== 'string') return;

        if (!(quoteTimestamp(q.periodEnd) > quoteTimestamp(q.periodStart))) return;

        if (!q.request || typeof q.request !== 'object' || !['PLUS', 'HOSPITAL'].includes(q.request.plan)) return;

        return q;
    } catch {
        return undefined;
    }
}
