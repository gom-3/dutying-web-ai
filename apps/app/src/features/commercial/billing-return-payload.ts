const billingPath = '/workspace/billing-return';

let captured: URLSearchParams | undefined;

/** Keep single-use authorization in memory, never in storage or a login return URL. */
export function captureBillingReturnPayload() {
    if (window.location.pathname !== billingPath || !window.location.search) return;

    const params = new URLSearchParams(window.location.search);
    const hasCallback = ['authKey', 'customerKey', 'registration', 'code', 'message'].some((key) => params.has(key));

    if (!hasCallback) return;

    captured = params;

    const orderId = params.get('orderId');
    const safeQuery = orderId ? `?orderId=${encodeURIComponent(orderId)}` : '';

    window.history.replaceState(window.history.state, '', billingPath + safeQuery);
}

export function readBillingReturnPayload(search: string) {
    const current = new URLSearchParams(search);
    const directCallback = ['authKey', 'customerKey', 'registration', 'code'].some((key) => current.has(key));
    const sameOrder = current.get('orderId') === captured?.get('orderId');

    return new URLSearchParams(!directCallback && sameOrder ? captured : current);
}

export function clearBillingReturnPayload() {
    captured = undefined;
}
