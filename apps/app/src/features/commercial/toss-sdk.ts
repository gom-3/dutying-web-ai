export type TTossSdk = {
    payment: (options: {customerKey: string}) => {
        requestBillingAuth: (options: {method: 'CARD'; successUrl: string; failUrl: string}) => Promise<void>;
    };
};
type TTossFactory = (key: string) => TTossSdk;

const scriptId = 'dutying-toss-billing-sdk';

let pending: Promise<TTossFactory> | undefined;

/** Share one SDK download and allow retry after a network failure or timeout. */
export function loadToss(): Promise<TTossFactory> {
    const win = window as Window & {TossPayments?: TTossFactory};

    if (win.TossPayments) return Promise.resolve(win.TossPayments);

    if (pending) return pending;

    pending = new Promise<TTossFactory>((resolve, reject) => {
        document.getElementById(scriptId)?.remove();

        const script = document.createElement('script');
        const finish = (error?: Error) => {
            clearTimeout(timer);
            script.onload = null;
            script.onerror = null;

            if (error || !win.TossPayments) {
                script.remove();
                reject(error ?? new Error('결제창을 불러오지 못했습니다. 다시 시도해 주세요.'));
            } else resolve(win.TossPayments);
        };

        script.id = scriptId;
        script.src = 'https://js.tosspayments.com/v2/standard';
        script.async = true;
        script.onload = () => finish();
        script.onerror = () => finish(new Error('결제창을 불러오지 못했습니다. 네트워크 연결을 확인하고 다시 시도해 주세요.'));

        const timer = setTimeout(() => finish(new Error('결제창 연결이 지연되고 있습니다. 잠시 후 다시 시도해 주세요.')), 15000);

        document.head.append(script);
    }).finally(() => {
        pending = undefined;
    });

    return pending;
}

export async function openTossBilling(registration: {clientKey: string; customerKey: string; returnUrl: string}) {
    const sdk = await loadToss();

    try {
        await sdk(registration.clientKey)
            .payment({customerKey: registration.customerKey})
            .requestBillingAuth({method: 'CARD', successUrl: registration.returnUrl, failUrl: registration.returnUrl});
    } catch (error) {
        if (error && typeof error === 'object' && 'code' in error && error.code === 'PAY_PROCESS_CANCELED') {
            throw new Error('카드 등록을 취소했습니다. 결제는 진행되지 않았습니다.');
        }

        throw error;
    }
}
