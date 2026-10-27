import {describe, expect, it} from 'vitest';
import {parseQuoteTerms, parseSubscriptionSummary, quoteTimestamp} from './quote-terms';

const terms = {
    request: {plan: 'PLUS'},
    totalAmount: 19900,
    supplyAmount: 18090,
    taxAmount: 1810,
    fullUnits: 30,
    partialUnits: 10,
    recurring: {monthlyGross: 19900},
    termsVersion: 'fixture',
    periodStart: '2026-10-23T03:00:00',
    periodEnd: '2026-11-23T03:00:00',
};

describe('server quote safety', () => {
    it('accepts a consistent server quote and interprets zone-less server timestamps as UTC', () => {
        expect(parseQuoteTerms(JSON.stringify(terms))).toEqual(terms);
        expect(quoteTimestamp(terms.periodStart)).toBe(Date.parse('2026-10-23T03:00:00Z'));
    });

    it.each([
        {...terms, totalAmount: '19900'},
        {...terms, taxAmount: 0},
        {...terms, totalAmount: -1},
        {...terms, fullUnits: NaN},
        {...terms, recurring: {}},
        {...terms, periodEnd: terms.periodStart},
        {...terms, periodStart: 'invalid'},
        {...terms, termsVersion: ''},
        {...terms, request: undefined},
    ])('rejects an incomplete or inconsistent quote %j', (value) => {
        expect(parseQuoteTerms(JSON.stringify(value))).toBeUndefined();
    });

    it.each(['invalid-json', 'null', '[]', '{}'])('does not crash checkout for malformed quote %s', (value) => {
        expect(parseQuoteTerms(value)).toBeUndefined();
    });
});

describe('original subscription summary', () => {
    const summary = {
        scopeName: '검증 병동',
        monthlyGross: 19900,
        periodStart: terms.periodStart,
        periodEnd: terms.periodEnd,
        termsVersion: terms.termsVersion,
    };

    it('accepts the original server payment terms', () => {
        expect(parseSubscriptionSummary(summary)).toEqual(summary);
    });

    it.each([
        undefined,
        null,
        {},
        {...summary, monthlyGross: '19900'},
        {...summary, monthlyGross: -1},
        {...summary, periodEnd: 'invalid'},
        {...summary, periodEnd: summary.periodStart},
    ])('never displays unverified amounts or dates from %j', (value) => {
        expect(parseSubscriptionSummary(value)).toBeUndefined();
    });
});
