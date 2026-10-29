import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import type {TTossSdk} from './toss-sdk';

const setSdk = (sdk?: (key: string) => TTossSdk) => {
    const win = window as Window & {TossPayments?: (key: string) => TTossSdk};

    if (sdk) win.TossPayments = sdk;
    else delete win.TossPayments;
};
const script = () => document.querySelector<HTMLScriptElement>('#dutying-toss-billing-sdk')!;

beforeEach(() => {
    vi.resetModules();
    setSdk();
    document.querySelectorAll('#dutying-toss-billing-sdk').forEach((node) => node.remove());
});
afterEach(() => {
    vi.useRealTimers();
    setSdk();
    document.querySelectorAll('#dutying-toss-billing-sdk').forEach((node) => node.remove());
});

describe('Toss billing SDK loading', () => {
    it('shares one download between concurrent callers', async () => {
        const {loadToss} = await import('./toss-sdk');
        const first = loadToss();
        const second = loadToss();
        const sdk = vi.fn();

        expect(first).toBe(second);
        expect(document.querySelectorAll('#dutying-toss-billing-sdk')).toHaveLength(1);
        expect(script().src).toBe('https://js.tosspayments.com/v2/standard');
        setSdk(sdk);
        script().dispatchEvent(new Event('load'));
        expect(await first).toBe(sdk);
        expect(await loadToss()).toBe(sdk);
    });

    it('cleans up a failed download and permits a fresh attempt', async () => {
        const {loadToss} = await import('./toss-sdk');
        const first = loadToss();
        const rejected = expect(first).rejects.toThrow('네트워크 연결');

        script().dispatchEvent(new Event('error'));
        await rejected;
        expect(script()).toBeNull();

        const retry = loadToss();
        const sdk = vi.fn();

        setSdk(sdk);
        script().dispatchEvent(new Event('load'));
        expect(await retry).toBe(sdk);
    });

    it('does not leave a payment action permanently pending on a stalled download', async () => {
        vi.useFakeTimers();

        const {loadToss} = await import('./toss-sdk');
        const result = loadToss();
        const rejected = expect(result).rejects.toThrow('연결이 지연');

        await vi.advanceTimersByTimeAsync(15000);
        await rejected;
        expect(script()).toBeNull();
    });

    it('rejects a downloaded script that does not expose the expected SDK', async () => {
        const {loadToss} = await import('./toss-sdk');
        const result = loadToss();
        const rejected = expect(result).rejects.toThrow('결제창을 불러오지 못했습니다');

        script().dispatchEvent(new Event('load'));
        await rejected;
    });

    it('opens card registration with server-issued keys and the callback URLs', async () => {
        const requestBillingAuth = vi.fn().mockResolvedValue(undefined);
        const payment = vi.fn().mockReturnValue({requestBillingAuth});
        const sdk = vi.fn().mockReturnValue({payment});

        setSdk(sdk);

        const {openTossBilling} = await import('./toss-sdk');
        const registration = {
            clientKey: 'test_ck_fixture',
            customerKey: 'fixture-customer',
            returnUrl: 'https://example.test/workspace/billing-return?registration=fixture',
        };

        await openTossBilling(registration);
        expect(sdk).toHaveBeenCalledWith(registration.clientKey);
        expect(payment).toHaveBeenCalledWith({customerKey: registration.customerKey});
        expect(requestBillingAuth).toHaveBeenCalledWith({
            method: 'CARD',
            successUrl: registration.returnUrl,
            failUrl: registration.returnUrl,
        });
    });

    it('explains an SDK cancellation without treating it as a payment success', async () => {
        setSdk(() => ({payment: () => ({requestBillingAuth: vi.fn().mockRejectedValue({code: 'PAY_PROCESS_CANCELED'})})}));

        const {openTossBilling} = await import('./toss-sdk');

        await expect(openTossBilling({clientKey: 'fixture', customerKey: 'fixture', returnUrl: 'https://example.test'})).rejects.toThrow(
            '카드 등록을 취소했습니다',
        );
    });
});
