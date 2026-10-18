import {expect, it} from 'vitest';
import {applyRestrictionStates, usageRemainingLabel} from './api';
import type {Entitlement, Usage} from './api';

it('marks only the selected AI meter unrestricted and preserves financial and action state', () => {
    const full = {meter: 'FULL_GENERATE', remaining: 0} as Usage;
    const partial = {meter: 'PARTIAL_ADJUST', remaining: 2} as Usage;
    const entitlement = {
        billingHold: true,
        capacity: {used: 30, purchased: 20, overLimit: true},
        allowedActions: ['EXPORT'],
        usage: [full, partial],
    } as Entitlement;
    const updated = applyRestrictionStates(entitlement, {AI_FULL: false, AI_PARTIAL: true});

    expect(updated.usage[0].enforced).toBe(false);
    expect(updated.usage[1].enforced).toBe(true);
    expect(updated.capacity.overLimit).toBe(true);
    expect(updated.billingHold).toBe(true);
    expect(updated.allowedActions).toEqual(['EXPORT']);
    expect(entitlement.usage[0].enforced).toBeUndefined();
    expect(usageRemainingLabel(updated.usage[0], true)).toBe('제한 해제');
    expect(usageRemainingLabel(updated.usage[1], true)).toBe('2');
    expect(usageRemainingLabel(full, true)).toBe('0');
});
