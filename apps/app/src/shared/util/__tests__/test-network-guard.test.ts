import {describe, expect, it, vi} from 'vitest';
import {assertNoUnexpectedNetworkRequests} from '../test-network-guard';

describe('test network isolation', () => {
    it('blocks fetch and reports caught requests at test completion', async () => {
        await expect(fetch('https://api.dutying.ai/hospitals')).rejects.toThrow('Unmocked fetch request blocked');
        expect(assertNoUnexpectedNetworkRequests).toThrow('Mock the API or transport');
        expect(assertNoUnexpectedNetworkRequests).not.toThrow();
    });

    it('blocks the XMLHttpRequest transport used by Axios before sending', () => {
        const request = new XMLHttpRequest();

        expect(() => request.open('GET', 'https://api.dutying.ai/hospitals')).toThrow('Unmocked XMLHttpRequest');
        expect(assertNoUnexpectedNetworkRequests).toThrow('XMLHttpRequest');
    });

    it('allows explicit mocks and restores the guard after unstubbing', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}')));
        await expect(fetch('https://api.dutying.ai/hospitals')).resolves.toBeInstanceOf(Response);
        expect(assertNoUnexpectedNetworkRequests).not.toThrow();
        vi.unstubAllGlobals();
        await expect(fetch('https://api.dutying.ai/hospitals')).rejects.toThrow('Unmocked fetch');
        expect(assertNoUnexpectedNetworkRequests).toThrow('fetch');
    });
});
