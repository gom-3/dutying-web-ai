import {describe, expect, it} from 'vitest';
import {aiFillUsage} from './ai-fill-usage';
import type {Usage, UsageLot} from './api';

const usage = (meter: Usage['meter'], used: number, reserved: number, granted: number, lots: UsageLot[] = []): Usage => ({
    meter,
    used,
    reserved,
    granted,
    remaining: granted - used - reserved,
    lots,
    enforced: true,
});

describe('unified AI fill allowance', () => {
    it('uses the v2 allowance directly without adding legacy or duplicate balances', () => {
        const shared = usage('AI_FILL', 8, 2, 30);

        expect(aiFillUsage({usage: [shared, usage('PARTIAL_ADJUST', 0, 0, 10)]})).toBe(shared);
    });
    it('counts historical adjustment uses and reservations within 30 rather than granting 40', () => {
        expect(aiFillUsage({usage: [usage('FULL_GENERATE', 6, 1, 30), usage('PARTIAL_ADJUST', 2, 1, 10)]})).toMatchObject({
            meter: 'AI_FILL',
            granted: 30,
            used: 8,
            reserved: 2,
            remaining: 20,
        });
    });
    it('preserves paid legacy adjustment credits without letting base debt swallow them', () => {
        const paid: UsageLot = {
            id: 'paid',
            source: 'PURCHASE',
            meter: 'PARTIAL_ADJUST',
            granted: 5,
            consumed: 0,
            reserved: 0,
            available: 5,
            expiresAt: null,
        };

        expect(aiFillUsage({usage: [usage('FULL_GENERATE', 30, 0, 30), usage('PARTIAL_ADJUST', 10, 0, 15, [paid])]})).toMatchObject({
            granted: 35,
            remaining: 5,
            lots: [{id: 'paid', available: 5}],
        });
    });
    it('keeps missing allowance unknown and inherits the unified restriction', () => {
        expect(aiFillUsage({usage: []})).toBeUndefined();
        expect(aiFillUsage({usage: [usage('FULL_GENERATE', 0, 0, 30)], restrictionStates: {AI_FILL: false}})?.enforced).toBe(false);
    });
});
