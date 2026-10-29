import {afterEach, describe, expect, it} from 'vitest';
import {captureBillingReturnPayload, clearBillingReturnPayload, readBillingReturnPayload} from './billing-return-payload';

afterEach(() => {
    clearBillingReturnPayload();
    window.history.replaceState(null, '', '/');
});

describe('billing callback secret handling', () => {
    it('removes authorization from the URL before application initialization and keeps only an order ID', () => {
        const state = {existing: 'router-state'};

        window.history.replaceState(
            state,
            '',
            '/workspace/billing-return?orderId=order-1&registration=mandate-1&authKey=single-use-fixture&customerKey=customer-fixture',
        );
        captureBillingReturnPayload();
        expect(window.location.pathname + window.location.search).toBe('/workspace/billing-return?orderId=order-1');
        expect(window.history.state).toEqual(state);

        const saved = readBillingReturnPayload(window.location.search);

        expect(saved.get('authKey')).toBe('single-use-fixture');
        expect(saved.get('registration')).toBe('mandate-1');
        expect(JSON.stringify({...localStorage, ...sessionStorage})).not.toContain('single-use-fixture');
    });

    it('never attaches authorization from one order to another', () => {
        window.history.replaceState(null, '', '/workspace/billing-return?orderId=order-1&authKey=fixture');
        captureBillingReturnPayload();
        expect(readBillingReturnPayload('?orderId=order-2').get('authKey')).toBeNull();
        clearBillingReturnPayload();
        expect(readBillingReturnPayload('?orderId=order-1').get('authKey')).toBeNull();
    });

    it('prefers a newly received failure callback over earlier authorization', () => {
        window.history.replaceState(null, '', '/workspace/billing-return?orderId=order-1&authKey=fixture');
        captureBillingReturnPayload();

        const fresh = readBillingReturnPayload('?orderId=order-1&code=PAY_PROCESS_CANCELED');

        expect(fresh.get('authKey')).toBeNull();
        expect(fresh.get('code')).toBe('PAY_PROCESS_CANCELED');
    });

    it('retains an in-memory card-change callback without an order', () => {
        window.history.replaceState(null, '', '/workspace/billing-return?registration=mandate-1&authKey=fixture&customerKey=customer');
        captureBillingReturnPayload();
        expect(window.location.search).toBe('');
        expect(readBillingReturnPayload('').get('registration')).toBe('mandate-1');
    });

    it('does not change unrelated routes', () => {
        window.history.replaceState(null, '', '/profile?code=normal-query');
        captureBillingReturnPayload();
        expect(window.location.pathname + window.location.search).toBe('/profile?code=normal-query');
    });
});
