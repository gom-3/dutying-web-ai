const unexpectedRequests: string[] = [];
const rejectRequest = (transport: string): Error => {
    const message = `Unmocked ${transport} request blocked. Mock the API or transport in this test.`;

    unexpectedRequests.push(message);

    return new Error(message);
};

// Install directly so vi.unstubAllGlobals()/restoreAllMocks() restore this guard,
// never a transport that can contact production. Explicit test mocks still work.
export const installTestNetworkGuard = () => {
    globalThis.fetch = () => Promise.reject(rejectRequest('fetch'));

    if (typeof XMLHttpRequest !== 'undefined') {
        XMLHttpRequest.prototype.open = () => {
            throw rejectRequest('XMLHttpRequest');
        };
    }
};

export const assertNoUnexpectedNetworkRequests = () => {
    const requests = unexpectedRequests.splice(0);

    if (requests.length) throw new Error(requests.join('\n'));
};
