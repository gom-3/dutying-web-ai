import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import {cleanup, render, screen, waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {MemoryRouter} from 'react-router';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import type * as CommercialApi from '@/features/commercial/api';
import type {Entitlement, Order, Policy, Quote, Scope} from '@/features/commercial/api';
import {clearBillingReturnPayload} from '@/features/commercial/billing-return-payload';
import type * as SubscriptionInfo from '@/pages/subscription-info';
import WorkspacePage from './index';

const mocks = vi.hoisted(() => ({
    get: vi.fn(),
    post: vi.fn(),
    open: vi.fn(),
    load: vi.fn(),
    offer: vi.fn(),
    cardRegistrationVersion: 2 as number | undefined,
}));

vi.mock('@/features/commercial/api', async (original) => ({
    ...(await original<typeof CommercialApi>()),
    commercialGet: mocks.get,
    commercialPost: mocks.post,
    useCommercialContext: () => ({
        data: {enabled: true, cardRegistrationVersion: mocks.cardRegistrationVersion, scopes: [scope]},
        refetch: vi.fn(),
        isPending: false,
        isError: false,
    }),
}));
vi.mock('@/features/commercial/toss-sdk', () => ({loadToss: mocks.load, openTossBilling: mocks.open}));
vi.mock('@/features/auth', () => ({
    default: () => ({state: {accountMe: {name: '검증용 관리자', wardId: 11}}, actions: {handleGetAccountMe: vi.fn()}}),
}));
vi.mock('@/features/auth/model/store', () => ({default: (selector: (state: object) => unknown) => selector({accountId: 7, wardId: 11})}));
vi.mock('@/pages/subscription-info', () => ({
    fetchPublicOffer: mocks.offer,
    RefundConditions: () => null,
    SubscriptionConditions: () => null,
}));
vi.mock('./reauthentication', () => ({
    Reauthenticate: ({onVerified}: {onVerified: (proof: string) => void}) => (
        <button onClick={() => onVerified('proof-fixture')}>이메일 본인 확인 완료</button>
    ),
}));

const scope: Scope = {type: 'WARD', ref: '11', scopeId: 'ward-scope', name: '검증용 병동', role: 'OWNER', status: 'ACTIVE'};
const policy: Policy = {
    plan: 'PLUS',
    baseGross: 19900,
    includedStaff: 50,
    extraStaffGross: 990,
    generate: 30,
    adjust: 10,
    adminSeats: 10,
    generatePackSize: 10,
    generatePackGross: 2900,
    adjustPackSize: 5,
    adjustPackGross: 4900,
    validityDays: 365,
    setupBase: 249000,
    setupExtra: 2000,
    features: {},
};
const entitlement = {
    billingScopeId: scope.scopeId,
    plan: 'FREE',
    entitlementSource: 'FREE',
    capacity: {used: 20, purchased: 30, overLimit: false},
    adminSeats: {active: 1, reserved: 0, limit: 10},
    policy,
    usage: [],
    allowedActions: [],
    canManageBilling: true,
    checkoutEnabled: true,
} as unknown as Entitlement;
const terms = {
    termsVersion: 'plus-monthly-2026-10-11',
    request: {purpose: 'SUBSCRIPTION', plan: 'PLUS', capacity: 50},
    totalAmount: 19900,
    supplyAmount: 18090,
    taxAmount: 1810,
    recurring: {monthlyGross: 19900},
    periodStart: '2026-10-23T03:00:00',
    periodEnd: '2026-11-23T03:00:00',
    fullUnits: 30,
    partialUnits: 10,
};
const quote: Quote = {
    id: 'quote-fixture',
    scopeId: scope.scopeId,
    purpose: 'SUBSCRIPTION',
    contentHash: 'quote-hash',
    expiresAt: '2099-10-23T03:00:00',
    snapshot: JSON.stringify(terms),
    status: 'DRAFT',
};
const publishedOffer: SubscriptionInfo.TPublicOffer = {
    plan: 'PLUS',
    currency: 'KRW',
    baseGross: 35000,
    includedStaff: 80,
    extraStaffGross: 1200,
    generate: 30,
    adjust: 10,
    adminSeats: 10,
    maxChargeGross: 1000000,
    termsVersion: terms.termsVersion,
    priceVersion: 'published-fixture',
    ready: true,
};
const publishedQuote: Quote = {
    ...quote,
    snapshot: JSON.stringify({
        ...terms,
        request: {...terms.request, capacity: 80},
        totalAmount: 35000,
        supplyAmount: 31818,
        taxAmount: 3182,
        recurring: {monthlyGross: 35000},
    }),
};
const order: Order = {
    id: 'order-fixture',
    scopeId: scope.scopeId,
    status: 'AWAITING_PAYMENT',
    gross: 19900,
    currency: 'KRW',
    invoiceId: 'invoice-fixture',
    subscriptionSummary: {
        scopeName: scope.name,
        periodStart: terms.periodStart,
        periodEnd: terms.periodEnd,
        monthlyGross: 19900,
        termsVersion: terms.termsVersion,
    },
};
const registration = {
    id: 'mandate-fixture',
    orderId: order.id,
    clientKey: 'test_ck_fixture',
    customerKey: 'customer-fixture',
    returnUrl: 'https://example.test/workspace/billing-return?registration=mandate-fixture&orderId=order-fixture',
};
const callback =
    '/workspace/billing-return?orderId=order-fixture&registration=mandate-fixture&authKey=authorization-fixture&customerKey=customer-fixture';

function mount(path = '/workspace/WARD/11/billing') {
    return render(
        <QueryClientProvider client={new QueryClient({defaultOptions: {queries: {retry: false}}})}>
            <MemoryRouter initialEntries={[path]}>
                <WorkspacePage />
            </MemoryRouter>
        </QueryClientProvider>,
    );
}

beforeEach(() => {
    vi.clearAllMocks();
    mocks.cardRegistrationVersion = 2;
    mocks.offer.mockResolvedValue({ready: true, maxChargeGross: 1000000});
    mocks.load.mockResolvedValue(vi.fn());
    mocks.open.mockResolvedValue(undefined);
    mocks.get.mockImplementation((path: string) => {
        if (path === '/plans') return Promise.resolve([{id: 'PLUS', config: policy, configured: true}]);

        if (path.includes('/entitlements')) return Promise.resolve(entitlement);

        if (path === '/billing-scopes/ward-scope')
            return Promise.resolve({scope: {version: 1, cancelAtPeriodEnd: false}, invoices: [], orders: [], requests: []});

        if (path === '/billing-scopes/ward-scope/payment-method')
            return Promise.resolve({registered: false, termsVersion: terms.termsVersion});

        if (path === '/orders/order-fixture') return Promise.resolve(order);

        return Promise.resolve([]);
    });
    mocks.post.mockImplementation((path: string) =>
        Promise.resolve(
            path.endsWith('/quotes') ? quote : path.endsWith('/subscription-checkout') ? registration : {...order, status: 'APPLIED'},
        ),
    );
});
afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    clearBillingReturnPayload();
    window.history.replaceState(null, '', '/');
    sessionStorage.clear();
});

describe('Plus checkout before card registration', () => {
    it('makes subscription entry clear and requests only a quote before consent', async () => {
        mount();

        const start = await screen.findByRole('button', {name: 'Plus 구독 시작'});

        expect(screen.getByRole('list', {name: 'Plus 구독 절차'})).toBeInTheDocument();
        expect(screen.getByRole('list', {name: 'Plus 구독 절차'})).not.toHaveTextContent('이메일');
        expect(screen.getByText(/지금은 결제되지 않습니다/)).toBeInTheDocument();
        expect(screen.queryByRole('combobox', {name: '이용할 상품'})).not.toBeInTheDocument();
        expect(screen.queryByRole('button', {name: '다음 주기 감원 예약'})).not.toBeInTheDocument();
        expect(screen.queryByRole('heading', {name: '환불·정산 문의'})).not.toBeInTheDocument();
        expect(mocks.post).not.toHaveBeenCalled();
        await userEvent.click(start);
        expect(await screen.findByRole('heading', {name: '검증용 병동 · 결제 전 확인'})).toHaveFocus();
        expect(screen.getByRole('button', {name: '결제 금액 다시 확인'})).toBeEnabled();
        expect(screen.getByRole('button', {name: '동의하고 정기결제 카드 등록'})).toBeDisabled();
        expect(mocks.post.mock.calls.every(([path]) => path.endsWith('/quotes'))).toBe(true);
        expect(mocks.open).not.toHaveBeenCalled();
    });

    it('requires explicit agreement without email reauthentication, then opens Toss using the approved server quote', async () => {
        mount();
        await userEvent.click(await screen.findByRole('button', {name: /^(Plus 구독 시작|정확한 금액 확인|결제 금액 다시 확인)$/}));
        expect(await screen.findByText(/다음 자동결제일/)).toBeInTheDocument();

        const start = screen.getByRole('button', {name: '동의하고 정기결제 카드 등록'});

        expect(start).toBeDisabled();
        await userEvent.click(screen.getByRole('checkbox', {name: /금액·대상·기간/}));
        expect(start).toBeEnabled();
        expect(screen.queryByRole('button', {name: '이메일 본인 확인 완료'})).not.toBeInTheDocument();
        await userEvent.click(start);
        await waitFor(() => expect(mocks.open).toHaveBeenCalledExactlyOnceWith(registration));
        expect(mocks.post).toHaveBeenCalledWith(
            '/v2/billing-scopes/ward-scope/subscription-checkout',
            {
                checkout: {quoteId: quote.id, contentHash: quote.contentHash, termsVersion: terms.termsVersion, trialLossAccepted: false},
            },
            expect.any(String),
        );
        expect(mocks.post).not.toHaveBeenCalledWith(expect.stringContaining('reauthentication'), expect.anything());
        expect(mocks.post).not.toHaveBeenCalledWith(expect.stringContaining('confirm-subscription'), expect.anything());
    });

    it('still requires the additional trial loss agreement before registering a card', async () => {
        const original = mocks.get.getMockImplementation()!;

        mocks.get.mockImplementation((path: string) =>
            path.includes('/entitlements') ? Promise.resolve({...entitlement, entitlementSource: 'EVENT'}) : original(path),
        );
        mount();
        await userEvent.click(await screen.findByRole('button', {name: 'Plus 구독 시작'}));
        await userEvent.click(screen.getByRole('checkbox', {name: /금액·대상·기간/}));

        const start = screen.getByRole('button', {name: '동의하고 정기결제 카드 등록'});

        expect(start).toBeDisabled();
        expect(mocks.open).not.toHaveBeenCalled();
        await userEvent.click(screen.getByRole('checkbox', {name: /남은 무료 이벤트 기간/}));
        await userEvent.click(start);
        await waitFor(() => expect(mocks.open).toHaveBeenCalledExactlyOnceWith(registration));
        expect(mocks.post).toHaveBeenCalledWith(
            '/v2/billing-scopes/ward-scope/subscription-checkout',
            {checkout: {quoteId: quote.id, contentHash: quote.contentHash, termsVersion: terms.termsVersion, trialLossAccepted: true}},
            expect.any(String),
        );
    });

    it('does not fall back to the legacy email flow when the new server endpoint is unavailable', async () => {
        mocks.post.mockImplementation((path: string) =>
            path.endsWith('/quotes') ? Promise.resolve(quote) : Promise.reject(Object.assign(new Error('카드 등록 준비 중'), {code: 404})),
        );
        mount();
        await userEvent.click(await screen.findByRole('button', {name: 'Plus 구독 시작'}));
        await userEvent.click(screen.getByRole('checkbox', {name: /금액·대상·기간/}));
        await userEvent.click(screen.getByRole('button', {name: '동의하고 정기결제 카드 등록'}));
        expect(await screen.findByRole('alert')).toHaveTextContent('카드 등록 준비 중');
        expect(mocks.post.mock.calls.map(([path]) => path)).toEqual([
            '/billing-scopes/ward-scope/quotes',
            '/v2/billing-scopes/ward-scope/subscription-checkout',
        ]);
        expect(mocks.open).not.toHaveBeenCalled();
        expect(screen.queryByRole('button', {name: '이메일 본인 확인 완료'})).not.toBeInTheDocument();
    });

    it.each([undefined, 1])('preserves legacy email verification and request for server version %s', async (version) => {
        mocks.cardRegistrationVersion = version;
        mount();
        await userEvent.click(await screen.findByRole('button', {name: 'Plus 구독 시작'}));
        expect(screen.getByRole('list', {name: 'Plus 구독 절차'})).toHaveTextContent('이메일 인증·카드 등록');
        await userEvent.click(screen.getByRole('checkbox', {name: /금액·대상·기간/}));

        const start = screen.getByRole('button', {name: '동의하고 정기결제 카드 등록'});

        expect(start).toBeDisabled();
        expect(mocks.open).not.toHaveBeenCalled();
        await userEvent.click(screen.getByRole('button', {name: '이메일 본인 확인 완료'}));
        await userEvent.click(start);
        await waitFor(() => expect(mocks.open).toHaveBeenCalledExactlyOnceWith(registration));
        expect(mocks.post).toHaveBeenCalledWith(
            '/billing-scopes/ward-scope/subscription-checkout',
            {
                checkout: {quoteId: quote.id, contentHash: quote.contentHash, termsVersion: terms.termsVersion, trialLossAccepted: false},
                reauthenticationToken: 'proof-fixture',
            },
            expect.any(String),
        );
        expect(mocks.post.mock.calls.some(([path]) => path.startsWith('/v2/'))).toBe(false);
    });

    it('keeps checkout intact when the server returns malformed quote JSON', async () => {
        mocks.post.mockResolvedValue({...quote, snapshot: '{invalid'});
        mount();
        await userEvent.click(await screen.findByRole('button', {name: /^(Plus 구독 시작|정확한 금액 확인|결제 금액 다시 확인)$/}));
        expect(await screen.findByRole('alert')).toHaveTextContent('견적 정보를 확인하지 못했습니다');
        expect(screen.queryByRole('button', {name: '동의하고 정기결제 카드 등록'})).not.toBeInTheDocument();
        expect(mocks.open).not.toHaveBeenCalled();
    });

    it('does not allow an expired quote to reach card registration', async () => {
        mocks.post.mockResolvedValue({...quote, expiresAt: '2000-01-01T00:00:00Z'});
        mount();
        await userEvent.click(await screen.findByRole('button', {name: /^(Plus 구독 시작|정확한 금액 확인|결제 금액 다시 확인)$/}));
        expect(await screen.findByRole('alert')).toHaveTextContent('유효시간이 지났습니다');
        await userEvent.click(screen.getByRole('checkbox', {name: /금액·대상·기간/}));
        expect(screen.getByRole('button', {name: '동의하고 정기결제 카드 등록'})).toBeDisabled();
        expect(mocks.open).not.toHaveBeenCalled();
    });

    it('creates no payment registration when the SDK cannot load', async () => {
        mocks.load.mockRejectedValue(new Error('결제창을 불러오지 못했습니다.'));
        mount();
        await userEvent.click(await screen.findByRole('button', {name: /^(Plus 구독 시작|정확한 금액 확인|결제 금액 다시 확인)$/}));
        await userEvent.click(screen.getByRole('checkbox', {name: /금액·대상·기간/}));
        await userEvent.click(screen.getByRole('button', {name: '동의하고 정기결제 카드 등록'}));
        expect(await screen.findByRole('alert')).toHaveTextContent('결제창을 불러오지 못했습니다');
        expect(mocks.post.mock.calls.filter(([path]) => path.endsWith('/subscription-checkout'))).toHaveLength(0);
    });
});

describe('card authorization callback and first charge', () => {
    it('shows the original service period and amount, scrubs authorization and only charges on explicit confirmation', async () => {
        mount(callback);

        const confirm = await screen.findByRole('button', {name: /첫 결제하고 구독 시작/});

        expect(screen.getByText('검증용 병동 · Plus')).toBeInTheDocument();
        expect(screen.getByText('월 자동결제 금액 · 부가세 포함')).toBeInTheDocument();
        expect(screen.getByText('이용기간')).toBeInTheDocument();
        expect(window.location.search).toBe('?orderId=order-fixture');
        expect(mocks.post).not.toHaveBeenCalled();
        await userEvent.click(confirm);
        await waitFor(() =>
            expect(mocks.post).toHaveBeenCalledExactlyOnceWith('/orders/order-fixture/confirm-subscription', {
                registrationId: 'mandate-fixture',
                authKey: 'authorization-fixture',
                customerKey: 'customer-fixture',
            }),
        );
        expect(await screen.findByText('결제와 Plus 적용이 완료되었습니다. 등록한 카드로 매월 자동 갱신합니다.')).toBeInTheDocument();
        expect(screen.queryByRole('button', {name: /첫 결제하고 구독 시작/})).not.toBeInTheDocument();
    });

    it.each(['PROCESSING', 'UNKNOWN', 'PAID_PENDING_APPLICATION', 'FAILED', 'APPLIED'])(
        'does not create another charge for an existing %s order',
        async (status) => {
            mocks.get.mockResolvedValue({...order, status, provider: 'TOSS'});
            mount(callback);
            await screen.findByText(/이번 결제금액/);
            expect(screen.queryByRole('button', {name: /첫 결제하고 구독 시작/})).not.toBeInTheDocument();
            expect(mocks.post).not.toHaveBeenCalled();
        },
    );

    it('submits a first-charge confirmation only once while a double click is pending', async () => {
        let finish!: (value: Order) => void;

        mocks.post.mockReturnValue(
            new Promise<Order>((resolve) => {
                finish = resolve;
            }),
        );
        mount(callback);
        await userEvent.dblClick(await screen.findByRole('button', {name: /첫 결제하고 구독 시작/}));
        expect(mocks.post).toHaveBeenCalledTimes(1);
        finish({...order, status: 'APPLIED'});
        expect(await screen.findByText('결제와 Plus 적용이 완료되었습니다. 등록한 카드로 매월 자동 갱신합니다.')).toBeInTheDocument();
    });

    it('does not charge with an incomplete authorization payload', async () => {
        mount(callback.replace('&customerKey=customer-fixture', ''));
        await screen.findByText(/이번 결제금액/);
        expect(screen.queryByRole('button', {name: /첫 결제하고 구독 시작/})).not.toBeInTheDocument();
        expect(screen.getByText(/인증 정보가 없으면 새로 청구하지 않습니다/)).toBeInTheDocument();
    });

    it('blocks the first charge and offers recovery for a malformed original service period', async () => {
        mocks.get.mockResolvedValue({...order, subscriptionSummary: {...order.subscriptionSummary, periodEnd: 'invalid'}});
        mount(callback);
        expect(await screen.findByRole('alert')).toHaveTextContent('구독 이용 조건을 확인하지 못했습니다');
        expect(screen.getByRole('button', {name: /첫 결제하고 구독 시작/})).toBeDisabled();
        expect(screen.getByRole('button', {name: '결제 상태 다시 확인'})).toBeInTheDocument();
        expect(screen.queryByText(/Invalid Date|NaN/)).not.toBeInTheDocument();
        expect(mocks.post).not.toHaveBeenCalled();
    });

    it('remains compatible with an existing order response without the additive summary', async () => {
        mocks.get.mockResolvedValue({...order, subscriptionSummary: undefined});
        mount(callback);
        expect(await screen.findByRole('button', {name: /첫 결제하고 구독 시작/})).toBeEnabled();
        expect(screen.queryByText('구독 이용 조건을 확인하지 못했습니다')).not.toBeInTheDocument();
    });

    it('explains invalid card numbers without exposing raw callback details or charging', async () => {
        mount(callback + '&code=INVALID_CARD_NUMBER&message=private-card-data');
        expect(await screen.findByRole('alert')).toHaveTextContent('카드번호가 올바르지 않거나 지원하지 않는 카드');
        expect(screen.getByRole('link', {name: '결제 결과 재조회·미결제 주문 취소'})).toHaveAttribute(
            'href',
            '/workspace/payment-return?orderId=order-fixture',
        );
        expect(screen.queryByText('private-card-data')).not.toBeInTheDocument();
        expect(screen.queryByRole('button', {name: /첫 결제하고 구독 시작/})).not.toBeInTheDocument();
        expect(mocks.post).not.toHaveBeenCalled();
    });

    it('handles cancellation even when malicious callback parameters include authorization', async () => {
        mount(callback + '&code=PAY_PROCESS_CANCELED&message=must-not-display-private-data');
        expect(await screen.findByRole('alert')).toHaveTextContent('카드 등록을 취소했습니다');
        expect(screen.queryByText('must-not-display-private-data')).not.toBeInTheDocument();
        expect(screen.queryByRole('button', {name: /첫 결제하고 구독 시작/})).not.toBeInTheDocument();
        expect(mocks.post).not.toHaveBeenCalled();
    });

    it('offers status recovery instead of another charge after an uncertain response and failed status fetch', async () => {
        mocks.post.mockRejectedValue(new Error('응답 연결 실패'));

        let reads = 0;

        mocks.get.mockImplementation(() => (++reads === 1 ? Promise.resolve(order) : Promise.reject(new Error('조회 연결 실패'))));
        mount(callback);
        await userEvent.click(await screen.findByRole('button', {name: /첫 결제하고 구독 시작/}));
        expect(await screen.findByRole('button', {name: '결제 상태 다시 확인'})).toBeInTheDocument();
        expect(screen.queryByRole('button', {name: /첫 결제하고 구독 시작/})).not.toBeInTheDocument();
        expect(mocks.post).toHaveBeenCalledTimes(1);
    });
});

describe('renewal card registration', () => {
    it.each([undefined, 1])('preserves legacy card replacement verification for server version %s', async (version) => {
        mocks.cardRegistrationVersion = version;

        const original = mocks.get.getMockImplementation()!;

        mocks.get.mockImplementation((path: string) =>
            path.endsWith('/entitlements')
                ? Promise.resolve({...entitlement, plan: 'PLUS', entitlementSource: 'SUBSCRIPTION'})
                : original(path),
        );
        mocks.post.mockResolvedValue(registration);
        mount();

        const start = await screen.findByRole('button', {name: '카드 등록·변경'});

        await userEvent.click(screen.getByRole('checkbox', {name: '현재 계약 조건의 매월 자동 갱신에 동의합니다.'}));
        expect(start).toBeDisabled();
        expect(mocks.post).not.toHaveBeenCalled();
        await userEvent.click(screen.getByRole('button', {name: '이메일 본인 확인 완료'}));
        await userEvent.click(start);
        await waitFor(() => expect(mocks.open).toHaveBeenCalledExactlyOnceWith(registration));
        expect(mocks.post).toHaveBeenCalledExactlyOnceWith('/billing-scopes/ward-scope/payment-method', {
            termsVersion: terms.termsVersion,
            reauthenticationToken: 'proof-fixture',
        });
    });

    it('cannot start registration when current contract terms could not be loaded', async () => {
        const original = mocks.get.getMockImplementation()!;

        mocks.get.mockImplementation((path: string) =>
            path.endsWith('/entitlements')
                ? Promise.resolve({...entitlement, plan: 'PLUS', entitlementSource: 'SUBSCRIPTION'})
                : path.endsWith('/payment-method')
                  ? Promise.reject(new Error('결제수단 조회 실패'))
                  : original(path),
        );
        mount();
        expect(await screen.findByText('결제수단 정보를 확인하지 못했습니다.')).toBeInTheDocument();
        await userEvent.click(screen.getByRole('checkbox', {name: '현재 계약 조건의 매월 자동 갱신에 동의합니다.'}));
        expect(screen.getByRole('button', {name: '카드 등록·변경'})).toBeDisabled();
        expect(mocks.open).not.toHaveBeenCalled();
    });

    it('uses current contract terms after explicit consent without email reauthentication', async () => {
        const original = mocks.get.getMockImplementation()!;

        mocks.get.mockImplementation((path: string) =>
            path.endsWith('/entitlements')
                ? Promise.resolve({...entitlement, plan: 'PLUS', entitlementSource: 'SUBSCRIPTION'})
                : original(path),
        );
        mocks.post.mockResolvedValue(registration);
        mount();

        const start = await screen.findByRole('button', {name: '카드 등록·변경'});

        expect(start).toBeDisabled();
        expect(screen.queryByRole('button', {name: '이메일 본인 확인 완료'})).not.toBeInTheDocument();
        expect(mocks.post).not.toHaveBeenCalled();
        await userEvent.click(screen.getByRole('checkbox', {name: '현재 계약 조건의 매월 자동 갱신에 동의합니다.'}));
        expect(start).toBeEnabled();
        await userEvent.click(screen.getByRole('button', {name: '카드 등록·변경'}));
        await waitFor(() => expect(mocks.open).toHaveBeenCalledExactlyOnceWith(registration));
        expect(mocks.post).toHaveBeenCalledExactlyOnceWith('/v2/billing-scopes/ward-scope/payment-method', {
            termsVersion: terms.termsVersion,
        });
    });
});

describe('published subscription policy', () => {
    it.each([null, {...policy}])('does not quote an unpublished or missing policy %j', async (config) => {
        const original = mocks.get.getMockImplementation()!;

        mocks.get.mockImplementation((path: string) =>
            path === '/plans' ? Promise.resolve([{id: 'PLUS', config, configured: false}]) : original(path),
        );
        mount();
        expect(await screen.findByText('요금제 설정이 완료되면 견적을 확인할 수 있습니다.')).toBeInTheDocument();
        expect(screen.getByRole('button', {name: /^(Plus 구독 시작|정확한 금액 확인|결제 금액 다시 확인)$/})).toBeDisabled();
        expect(mocks.post).not.toHaveBeenCalled();
    });

    it('starts a new subscription from the published included staff', async () => {
        const original = mocks.get.getMockImplementation()!;

        mocks.get.mockImplementation((path: string) =>
            path === '/plans' ? Promise.resolve([{id: 'PLUS', config: {...policy, includedStaff: 80}, configured: true}]) : original(path),
        );
        mount();

        const input = await screen.findByRole('spinbutton', {name: '변경 후 총 편성 인원'});

        await waitFor(() => expect(input).toHaveValue(80));
        expect(input).toHaveAttribute('min', '80');
        await userEvent.click(screen.getByRole('button', {name: /^(Plus 구독 시작|정확한 금액 확인|결제 금액 다시 확인)$/}));
        expect(mocks.post).toHaveBeenCalledWith('/billing-scopes/ward-scope/quotes', expect.objectContaining({capacity: 80}));
    });

    it('preserves the paid contract when the current catalogue changes', async () => {
        const original = mocks.get.getMockImplementation()!;

        mocks.offer.mockResolvedValue({...publishedOffer, includedStaff: 100, baseGross: 49900});
        mocks.get.mockImplementation((path: string) =>
            path.includes('/entitlements')
                ? Promise.resolve({
                      ...entitlement,
                      plan: 'PLUS',
                      entitlementSource: 'SUBSCRIPTION',
                      policy: {...policy, includedStaff: 40},
                      capacity: {used: 20, purchased: 50},
                  })
                : path === '/plans'
                  ? Promise.resolve([{id: 'PLUS', config: {...policy, includedStaff: 80}, configured: true}])
                  : original(path),
        );
        mount();
        await userEvent.selectOptions(await screen.findByRole('combobox', {name: '이용할 상품'}), 'CAPACITY');

        const input = screen.getByRole('spinbutton', {name: '변경 후 총 편성 인원'});

        expect(input).toHaveValue(50);
        expect(input).toHaveAttribute('min', '40');
        expect(screen.getByText(/기본.*19,900/)).toBeInTheDocument();
        await userEvent.click(screen.getByRole('button', {name: /^(Plus 구독 시작|정확한 금액 확인|결제 금액 다시 확인)$/}));
        expect(mocks.post).toHaveBeenCalledWith('/billing-scopes/ward-scope/quotes', expect.objectContaining({capacity: 50}));
    });
});

describe('published Plus offer when the full catalogue is unavailable', () => {
    const unavailableCatalogue = (source = 'FREE') => {
        const original = mocks.get.getMockImplementation()!;

        mocks.get.mockImplementation((path: string) =>
            path === '/plans'
                ? Promise.reject(Object.assign(new Error('Catalogue unavailable'), {code: 503}))
                : path.includes('/entitlements')
                  ? Promise.resolve({...entitlement, plan: source === 'EVENT' ? 'PLUS' : 'FREE', entitlementSource: source})
                  : original(path),
        );
    };

    it.each(['FREE', 'EVENT'])('uses confirmed public prices and minimum staff for a new %s subscription', async (source) => {
        unavailableCatalogue(source);
        mocks.offer.mockResolvedValue(publishedOffer);
        mocks.post.mockResolvedValue(publishedQuote);
        mount();

        const input = await screen.findByRole('spinbutton', {name: '변경 후 총 편성 인원'});

        await waitFor(() => expect(input).toHaveValue(80));
        expect(input).toHaveAttribute('min', '80');
        expect(screen.getByText('₩35,000')).toBeInTheDocument();
        expect(screen.getByText(/기본 인원 초과 시 1명당 월.*1,200/)).toBeInTheDocument();
        await userEvent.click(screen.getByRole('button', {name: /^(Plus 구독 시작|정확한 금액 확인|결제 금액 다시 확인)$/}));
        expect(mocks.post).toHaveBeenCalledWith('/billing-scopes/ward-scope/quotes', expect.objectContaining({capacity: 80}));
        expect(await screen.findByRole('button', {name: '동의하고 정기결제 카드 등록'})).toBeDisabled();
        expect(screen.getByRole('checkbox', {name: /금액·대상·기간/})).not.toBeChecked();
        expect(mocks.open).not.toHaveBeenCalled();
    });

    it.each([
        {...publishedOffer, baseGross: '35000'},
        {...publishedOffer, includedStaff: 0},
    ])('does not invent a fallback price for a malformed public response %j', async (invalidOffer) => {
        unavailableCatalogue();

        const actual = await vi.importActual<typeof SubscriptionInfo>('@/pages/subscription-info');

        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ok: true, json: async () => invalidOffer}));
        mocks.offer.mockImplementation(actual.fetchPublicOffer);
        mount();
        expect(await screen.findByText('요금제를 불러오지 못했습니다. 잠시 후 다시 확인해 주세요.')).toBeInTheDocument();
        expect(screen.getByRole('button', {name: /^(Plus 구독 시작|정확한 금액 확인|결제 금액 다시 확인)$/})).toBeDisabled();
        expect(screen.queryByText(/기본.*35,000/)).not.toBeInTheDocument();
        expect(mocks.post).not.toHaveBeenCalled();
        expect(mocks.open).not.toHaveBeenCalled();
    });

    it('allows an exact server quote while ready=false still blocks card registration after consent', async () => {
        unavailableCatalogue();
        mocks.offer.mockResolvedValue({...publishedOffer, ready: false});
        mocks.post.mockResolvedValue(publishedQuote);
        mount();
        await screen.findByText('₩35,000');
        await userEvent.click(screen.getByRole('button', {name: /^(Plus 구독 시작|정확한 금액 확인|결제 금액 다시 확인)$/}));
        expect(mocks.post).toHaveBeenCalledWith('/billing-scopes/ward-scope/quotes', expect.objectContaining({capacity: 80}));
        await userEvent.click(await screen.findByRole('checkbox', {name: /금액·대상·기간/}));
        expect(screen.getByRole('button', {name: '동의하고 정기결제 카드 등록'})).toBeDisabled();
        expect(screen.getByText('상품 안내 준비 상태 또는 1회 최대 100만 원의 결제 한도를 확인해 주세요.')).toBeInTheDocument();
        expect(mocks.post.mock.calls.filter(([path]) => path.endsWith('/subscription-checkout'))).toHaveLength(0);
        expect(mocks.open).not.toHaveBeenCalled();
    });
});
