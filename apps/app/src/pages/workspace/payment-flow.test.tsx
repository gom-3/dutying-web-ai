import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import {act, cleanup, render, screen, waitFor, within} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {MemoryRouter, Route, Routes} from 'react-router';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {commercialQueryKey} from '@/features/commercial/api';
import type * as CommercialApi from '@/features/commercial/api';
import type {Billing, Entitlement, Invoice, Order, Policy, Quote, Scope} from '@/features/commercial/api';
import {clearBillingReturnPayload} from '@/features/commercial/billing-return-payload';
import type * as SubscriptionInfo from '@/pages/subscription-info';
import WorkspacePage, {BillingPanel, PaymentReturn} from './index';

const mocks = vi.hoisted(() => ({
    get: vi.fn(),
    post: vi.fn(),
    delete: vi.fn(),
    open: vi.fn(),
    load: vi.fn(),
    offer: vi.fn(),
    cardRegistrationVersion: 2 as number | undefined,
    scopes: undefined as Scope[] | undefined,
}));

vi.mock('@/features/commercial/api', async (original) => ({
    ...(await original<typeof CommercialApi>()),
    commercialGet: mocks.get,
    commercialPost: mocks.post,
    commercialDelete: mocks.delete,
    useCommercialContext: () => ({
        data: {enabled: true, cardRegistrationVersion: mocks.cardRegistrationVersion, scopes: mocks.scopes ?? [scope]},
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
    termsVersion: 'plus-ai-fill-monthly-2026-11-12',
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
    mocks.scopes = undefined;
    mocks.offer.mockResolvedValue({ready: true, maxChargeGross: 1000000});
    mocks.load.mockResolvedValue(vi.fn());
    mocks.open.mockResolvedValue(undefined);
    mocks.delete.mockResolvedValue({});
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
    mocks.post.mockImplementation((path: string, request?: {capacity: number}) =>
        Promise.resolve(
            path.endsWith('/quotes')
                ? quoteForCapacity(request!.capacity)
                : path.endsWith('/subscription-checkout')
                  ? registration
                  : {...order, status: 'APPLIED'},
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

function quoteForCapacity(
    capacity: number,
    gross = policy.baseGross + Math.max(0, capacity - policy.includedStaff) * policy.extraStaffGross,
): Quote {
    if (capacity === 50 && gross === 19900) return quote;

    return {
        ...quote,
        id: capacity === 50 ? quote.id : `quote-${capacity}`,
        contentHash: capacity === 50 ? quote.contentHash : `hash-${capacity}`,
        snapshot: JSON.stringify({
            ...terms,
            request: {...terms.request, capacity},
            totalAmount: gross,
            supplyAmount: gross - Math.round(gross / 11),
            taxAmount: Math.round(gross / 11),
            recurring: {monthlyGross: gross},
        }),
    };
}

const financialCalls = () => mocks.post.mock.calls.filter(([path]) => !path.endsWith('/quotes'));
const proceed = () => screen.getByRole('button', {name: '동의하고 진행하기'});
const agreement = () => screen.getByRole('checkbox', {name: /금액·대상·기간/});

async function readyQuote() {
    const amount = await screen.findByText('이번 결제금액', {exact: true});

    await waitFor(() => expect(agreement()).toBeEnabled());

    return amount.closest('.workspace-review') as HTMLElement;
}

async function acceptAndProceed() {
    await readyQuote();
    await userEvent.click(agreement());
    await userEvent.click(proceed());
}

describe('combined Plus amount review and card registration', () => {
    it('shows one quote automatically in the combined step without creating a payment or moving focus', async () => {
        mount();

        const review = await readyQuote();
        const steps = screen.getByRole('list', {name: 'Plus 구독 절차'});

        expect(within(steps).getAllByRole('listitem')).toHaveLength(2);
        expect(steps).toHaveTextContent('요금 확인·카드 등록');
        expect(steps).toHaveTextContent('첫 결제·Plus 시작');
        expect(steps).not.toHaveTextContent('이메일');
        expect(screen.queryByRole('button', {name: /^결제 금액/})).not.toBeInTheDocument();
        expect(screen.queryByRole('heading', {name: /결제 전 확인/})).not.toBeInTheDocument();
        expect(screen.getByRole('heading', {name: 'Plus 요금제'})).toBeInTheDocument();
        expect(screen.queryByRole('combobox', {name: '이용할 상품'})).not.toBeInTheDocument();
        expect(screen.queryByRole('button', {name: '다음 주기 감원 예약'})).not.toBeInTheDocument();
        expect(screen.queryByRole('heading', {name: '환불·정산 문의'})).not.toBeInTheDocument();
        expect(proceed()).toBeDisabled();
        expect(financialCalls()).toEqual([]);
        expect(mocks.open).not.toHaveBeenCalled();
        expect(screen.getAllByText('₩19,900')).toHaveLength(1);
        expect(within(review).getByText('매월 같은 금액으로 자동결제돼요.')).toBeInTheDocument();
        expect(within(review).queryByText('변경 후 월 구독료')).not.toBeInTheDocument();
        expect(document.activeElement).not.toBe(review.querySelector('h3'));

        const detail = within(review).getByText('세금·결제 상세').closest('details')!;

        expect(detail).not.toHaveAttribute('open');
        await userEvent.click(within(detail).getByText('세금·결제 상세'));
        expect(detail).toHaveAttribute('open');
        expect(within(detail).getByText('₩18,090')).toBeInTheDocument();
    });

    it('shows a different recurring amount when the first charge differs from the monthly renewal', async () => {
        mocks.post.mockResolvedValue({...quote, snapshot: JSON.stringify({...terms, recurring: {monthlyGross: 29800}})});
        mount();

        const review = await readyQuote();

        expect(within(review).getByText('₩19,900')).toBeInTheDocument();
        expect(within(review).getByText('₩29,800')).toBeInTheDocument();
        expect(within(review).queryByText('매월 같은 금액으로 자동결제돼요.')).not.toBeInTheDocument();
    });

    it('requires explicit agreement before registration and never confirms the first charge here', async () => {
        mount();
        await readyQuote();
        expect(proceed()).toBeDisabled();
        expect(financialCalls()).toEqual([]);
        expect(screen.queryByRole('button', {name: '이메일 본인 확인 완료'})).not.toBeInTheDocument();
        await userEvent.click(agreement());
        expect(proceed()).toBeEnabled();
        await userEvent.click(proceed());
        await waitFor(() => expect(mocks.open).toHaveBeenCalledExactlyOnceWith(registration));
        expect(mocks.post).toHaveBeenCalledWith(
            '/v2/billing-scopes/ward-scope/subscription-checkout',
            {checkout: {quoteId: quote.id, contentHash: quote.contentHash, termsVersion: terms.termsVersion, trialLossAccepted: false}},
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
        await readyQuote();
        await userEvent.click(agreement());
        expect(proceed()).toBeDisabled();
        expect(mocks.open).not.toHaveBeenCalled();
        await userEvent.click(screen.getByRole('checkbox', {name: /남은 무료 이벤트 기간/}));
        await userEvent.click(proceed());
        await waitFor(() => expect(mocks.open).toHaveBeenCalledExactlyOnceWith(registration));
        expect(mocks.post).toHaveBeenCalledWith(
            '/v2/billing-scopes/ward-scope/subscription-checkout',
            {checkout: {quoteId: quote.id, contentHash: quote.contentHash, termsVersion: terms.termsVersion, trialLossAccepted: true}},
            expect.any(String),
        );
    });

    it('does not fall back to legacy email registration when the new endpoint is unavailable', async () => {
        mocks.post.mockImplementation((path: string) =>
            path.endsWith('/quotes') ? Promise.resolve(quote) : Promise.reject(Object.assign(new Error('카드 등록 준비 중'), {code: 404})),
        );
        mount();
        await acceptAndProceed();
        expect(await screen.findByRole('alert')).toHaveTextContent('카드 등록 준비 중');
        expect(financialCalls().map(([path]) => path)).toEqual(['/v2/billing-scopes/ward-scope/subscription-checkout']);
        expect(mocks.open).not.toHaveBeenCalled();
        expect(screen.queryByRole('button', {name: '이메일 본인 확인 완료'})).not.toBeInTheDocument();
    });

    it.each([undefined, 1])('preserves legacy email verification and request for server version %s', async (version) => {
        mocks.cardRegistrationVersion = version;
        mount();
        await readyQuote();
        expect(screen.getByRole('list', {name: 'Plus 구독 절차'})).toHaveTextContent('이메일');
        await userEvent.click(agreement());
        expect(proceed()).toBeDisabled();
        expect(mocks.open).not.toHaveBeenCalled();
        await userEvent.click(screen.getByRole('button', {name: '이메일 본인 확인 완료'}));
        await userEvent.click(proceed());
        await waitFor(() => expect(mocks.open).toHaveBeenCalledExactlyOnceWith(registration));
        expect(mocks.post).toHaveBeenCalledWith(
            '/billing-scopes/ward-scope/subscription-checkout',
            {
                checkout: {quoteId: quote.id, contentHash: quote.contentHash, termsVersion: terms.termsVersion, trialLossAccepted: false},
                reauthenticationToken: 'proof-fixture',
            },
            expect.any(String),
        );
        expect(financialCalls().some(([path]) => path.startsWith('/v2/'))).toBe(false);
    });

    it('blocks malformed quotes and offers a retry without creating a payment', async () => {
        mocks.post.mockResolvedValue({...quote, snapshot: '{invalid'});
        mount();
        expect(await screen.findByRole('alert')).toHaveTextContent('견적 정보를 확인하지 못했습니다');
        expect(proceed()).toBeDisabled();
        expect(agreement()).toBeDisabled();
        expect(screen.getByRole('button', {name: '다시 불러오기'})).toBeEnabled();
        expect(financialCalls()).toEqual([]);
        mocks.post.mockResolvedValue(quote);
        await userEvent.click(screen.getByRole('button', {name: '다시 불러오기'}));
        await readyQuote();
        expect(agreement()).not.toBeChecked();
        expect(proceed()).toBeDisabled();
    });

    it('cannot retry a failed quote while the current staff input is invalid', async () => {
        mocks.post.mockRejectedValue(new Error('견적 정보를 불러오지 못했습니다.'));
        mount();
        expect(await screen.findByRole('alert')).toHaveTextContent('견적 정보를 불러오지 못했습니다.');

        const retry = screen.getByRole('button', {name: '다시 불러오기'});
        const input = screen.getByRole('textbox', {name: '근무표에 포함할 인원을 입력하세요'});

        expect(retry).toBeEnabled();
        mocks.post.mockClear();
        await userEvent.clear(input);
        await userEvent.type(input, 'abc');
        expect(retry).toBeDisabled();
        await userEvent.click(retry);
        await act(async () => {
            await new Promise((resolve) => setTimeout(resolve, 350));
        });
        expect(mocks.post).not.toHaveBeenCalled();
        expect(proceed()).toBeDisabled();
        expect(agreement()).toBeDisabled();
    });

    it('does not allow an expired server quote to register a card', async () => {
        mocks.post.mockResolvedValue({...quote, expiresAt: '2000-01-01T00:00:00Z'});
        mount();
        expect(await screen.findByRole('alert')).toHaveTextContent(/유효시간|견적/);
        expect(proceed()).toBeDisabled();
        expect(financialCalls()).toEqual([]);
        expect(mocks.open).not.toHaveBeenCalled();
    });

    it('creates no payment registration when the SDK cannot load', async () => {
        mocks.load.mockRejectedValue(new Error('결제창을 불러오지 못했습니다.'));
        mount();
        await acceptAndProceed();
        expect(await screen.findByRole('alert')).toHaveTextContent('결제창을 불러오지 못했습니다');
        expect(financialCalls()).toEqual([]);
    });
});

describe('automatic Plus amount updates', () => {
    it.each(['0', '1', '30', '49'])('keeps raw %s staff while the server quotes the included 50 staff at the base price', async (value) => {
        mount();
        await readyQuote();

        const input = screen.getByRole('textbox', {name: '근무표에 포함할 인원을 입력하세요'});

        expect(input).toHaveAttribute('type', 'text');
        expect(input).toHaveAttribute('inputmode', 'numeric');
        expect(input).not.toHaveAttribute('min');
        expect(screen.queryByRole('spinbutton', {name: '근무표에 포함할 인원을 입력하세요'})).not.toBeInTheDocument();
        await userEvent.clear(input);
        expect(input).toHaveValue('');
        await userEvent.type(input, value);
        await readyQuote();
        expect(mocks.post).toHaveBeenLastCalledWith('/billing-scopes/ward-scope/quotes', expect.objectContaining({capacity: 50}));
        expect(screen.getByText('50명')).toBeInTheDocument();
        expect(screen.getByText('₩19,900')).toBeInTheDocument();
        expect(input).toHaveValue(value);
        expect(financialCalls()).toEqual([]);
        expect(mocks.open).not.toHaveBeenCalled();
    });

    it('automatically uses the server amount above included staff after typing settles', async () => {
        mount();
        await readyQuote();

        const input = screen.getByRole('textbox', {name: '근무표에 포함할 인원을 입력하세요'});

        mocks.post.mockClear();
        await userEvent.clear(input);
        await userEvent.type(input, '55', {delay: 20});
        await readyQuote();
        await waitFor(() => expect(screen.getByText('₩24,850')).toBeInTheDocument());
        expect(screen.getByText('55명')).toBeInTheDocument();
        expect(mocks.post).toHaveBeenCalledExactlyOnceWith('/billing-scopes/ward-scope/quotes', expect.objectContaining({capacity: 55}));
        expect(financialCalls()).toEqual([]);
        expect(input).toHaveFocus();
    });

    it.each(['', '-1', '1.5', 'abc', '1e2', '10001'])('does not request a quote or payment for invalid input %j', async (value) => {
        mount();
        await readyQuote();

        const input = screen.getByRole('textbox', {name: '근무표에 포함할 인원을 입력하세요'});

        mocks.post.mockClear();
        await userEvent.clear(input);

        if (value) await userEvent.type(input, value);

        await act(async () => {
            await new Promise((resolve) => setTimeout(resolve, 350));
        });
        expect(proceed()).toBeDisabled();
        expect(agreement()).toBeDisabled();
        expect(mocks.post).not.toHaveBeenCalled();
        expect(mocks.open).not.toHaveBeenCalled();
    });

    it('keeps enough purchased capacity for staff already scheduled above the base allowance', async () => {
        const original = mocks.get.getMockImplementation()!;

        mocks.get.mockImplementation((path: string) =>
            path.includes('/entitlements')
                ? Promise.resolve({...entitlement, capacity: {used: 75, purchased: 30, overLimit: true}})
                : original(path),
        );
        mount();
        await readyQuote();

        const input = screen.getByRole('textbox', {name: '근무표에 포함할 인원을 입력하세요'});

        await userEvent.clear(input);
        await userEvent.type(input, '30');
        await readyQuote();
        expect(mocks.post).toHaveBeenLastCalledWith('/billing-scopes/ward-scope/quotes', expect.objectContaining({capacity: 75}));
        expect(screen.getByText('75명')).toBeInTheDocument();
    });

    it('keeps input editable and ignores an older quote that resolves after the latest amount', async () => {
        let resolveOld!: (value: Quote) => void;

        mocks.post.mockImplementation((path: string, request: {capacity: number}) => {
            if (!path.endsWith('/quotes')) return Promise.resolve(registration);

            if (request.capacity === 50)
                return new Promise<Quote>((resolve) => {
                    resolveOld = resolve;
                });

            return Promise.resolve(quoteForCapacity(request.capacity));
        });
        mount();
        await waitFor(() =>
            expect(mocks.post).toHaveBeenCalledWith('/billing-scopes/ward-scope/quotes', expect.objectContaining({capacity: 50})),
        );

        const input = screen.getByRole('textbox', {name: '근무표에 포함할 인원을 입력하세요'});

        expect(input).toBeEnabled();
        await userEvent.clear(input);
        await userEvent.type(input, '55');
        await waitFor(() => expect(screen.getByText('₩24,850')).toBeInTheDocument());
        await act(async () => resolveOld(quote));
        expect(screen.getByText('55명')).toBeInTheDocument();
        expect(screen.getByText('₩24,850')).toBeInTheDocument();
        expect(screen.queryByText('₩19,900')).not.toBeInTheDocument();
        expect(input).toHaveValue('55');
        expect(input).toHaveFocus();
        expect(financialCalls()).toEqual([]);
    });

    it('clears consent immediately while the amount is updating and requires agreement to the new quote', async () => {
        mount();
        await readyQuote();
        await userEvent.click(agreement());
        expect(proceed()).toBeEnabled();

        const input = screen.getByRole('textbox', {name: '근무표에 포함할 인원을 입력하세요'});

        await userEvent.clear(input);
        expect(agreement()).not.toBeChecked();
        expect(proceed()).toBeDisabled();
        await userEvent.type(input, '55');
        await readyQuote();
        expect(agreement()).not.toBeChecked();
        expect(proceed()).toBeDisabled();
        expect(screen.getByText('₩24,850')).toBeInTheDocument();
        expect(mocks.open).not.toHaveBeenCalled();
    });

    it('renews an expiring quote automatically and requires fresh consent for the replacement', async () => {
        const expiring = {
            ...quote,
            id: 'expiring-quote',
            contentHash: 'expiring-hash',
            expiresAt: new Date(Date.now() + 1800).toISOString(),
        };

        mocks.post.mockResolvedValueOnce(expiring).mockResolvedValue(quote);
        mount();
        await readyQuote();
        await userEvent.click(agreement());
        expect(proceed()).toBeEnabled();
        await waitFor(() => expect(mocks.post).toHaveBeenCalledTimes(2), {timeout: 3500});
        await readyQuote();
        expect(agreement()).not.toBeChecked();
        expect(proceed()).toBeDisabled();
        expect(financialCalls()).toEqual([]);
        expect(mocks.open).not.toHaveBeenCalled();
    });

    it('rejects a server quote for a different requested capacity instead of accepting its price', async () => {
        mocks.post.mockResolvedValue({...quote, snapshot: JSON.stringify({...terms, request: {...terms.request, capacity: 80}})});
        mount();
        expect(await screen.findByRole('alert')).toHaveTextContent(/견적/);
        expect(proceed()).toBeDisabled();
        expect(financialCalls()).toEqual([]);
    });
});

describe('explicit proceed and pending payment recovery', () => {
    const billing = (orders: Order[] = []) => ({scope: {version: 1, cancelAtPeriodEnd: false}, invoices: [], orders, requests: []});

    function mountBilling() {
        return render(
            <QueryClientProvider client={new QueryClient({defaultOptions: {queries: {retry: false}}})}>
                <MemoryRouter initialEntries={['/billing/11/subscription']}>
                    <BillingPanel scope={scope} e={entitlement} cardRegistrationVersion={2} paymentReturnPath="/billing/payment-return" />
                </MemoryRouter>
            </QueryClientProvider>,
        );
    }

    it('only cleans up an unsubmitted order after quote review and explicit consent', async () => {
        const originalGet = mocks.get.getMockImplementation()!;

        let orders = [{...order, id: 'old-unsubmitted-order', gross: 24850}];

        mocks.get.mockImplementation((path: string) =>
            path === '/billing-scopes/ward-scope' ? Promise.resolve(billing(orders)) : originalGet(path),
        );
        mocks.post.mockImplementation((path: string, request: {capacity?: number}) => {
            if (path === '/orders/old-unsubmitted-order/abandon') {
                orders = [];

                return Promise.resolve({...order, status: 'FAILED'});
            }

            return Promise.resolve(path.endsWith('/quotes') ? quoteForCapacity(request.capacity!) : registration);
        });
        mountBilling();
        await readyQuote();
        expect(financialCalls()).toEqual([]);

        const input = screen.getByRole('textbox', {name: '근무표에 포함할 인원을 입력하세요'});

        await userEvent.clear(input);
        await userEvent.type(input, '55');
        await readyQuote();
        expect(financialCalls()).toEqual([]);
        await userEvent.click(agreement());
        await userEvent.click(proceed());
        await waitFor(() => expect(mocks.open).toHaveBeenCalledExactlyOnceWith(registration));
        expect(financialCalls().map(([path]) => path)).toEqual([
            '/orders/old-unsubmitted-order/abandon',
            '/v2/billing-scopes/ward-scope/subscription-checkout',
        ]);
        expect(mocks.post).toHaveBeenCalledWith(
            '/v2/billing-scopes/ward-scope/subscription-checkout',
            {checkout: {quoteId: 'quote-55', contentHash: 'hash-55', termsVersion: terms.termsVersion, trialLossAccepted: false}},
            expect.any(String),
        );
    });

    it('waits for each safe cancellation before registering the card and prevents duplicate clicks', async () => {
        const originalGet = mocks.get.getMockImplementation()!;

        let orders = [
            {...order, id: 'first-unsubmitted'},
            {...order, id: 'second-unsubmitted'},
        ];
        let finishFirst!: () => void;

        mocks.get.mockImplementation((path: string) =>
            path === '/billing-scopes/ward-scope' ? Promise.resolve(billing(orders)) : originalGet(path),
        );
        mocks.post.mockImplementation((path: string) => {
            if (path === '/orders/first-unsubmitted/abandon')
                return new Promise((resolve) => {
                    finishFirst = () => {
                        orders = orders.filter((pending) => pending.id !== 'first-unsubmitted');
                        resolve({...order, status: 'FAILED'});
                    };
                });

            if (path === '/orders/second-unsubmitted/abandon') {
                orders = [];

                return Promise.resolve({...order, status: 'FAILED'});
            }

            return Promise.resolve(path.endsWith('/quotes') ? quote : registration);
        });
        mountBilling();
        await readyQuote();
        await userEvent.click(agreement());
        await userEvent.dblClick(proceed());
        await waitFor(() => expect(financialCalls()).toHaveLength(1));
        expect(financialCalls()[0][0]).toBe('/orders/first-unsubmitted/abandon');
        expect(screen.getByRole('textbox', {name: '근무표에 포함할 인원을 입력하세요'})).toBeDisabled();
        finishFirst();
        await waitFor(() => expect(mocks.open).toHaveBeenCalledExactlyOnceWith(registration));
        expect(financialCalls().map(([path]) => path)).toEqual([
            '/orders/first-unsubmitted/abandon',
            '/orders/second-unsubmitted/abandon',
            '/v2/billing-scopes/ward-scope/subscription-checkout',
        ]);
    });

    it.each([
        ['processing', {status: 'PROCESSING', provider: 'TOSS'}],
        ['unknown', {status: 'UNKNOWN', provider: 'TOSS'}],
        ['paid but not applied', {status: 'PAID_PENDING_APPLICATION', provider: 'TOSS'}],
        ['provider-associated awaiting payment', {status: 'AWAITING_PAYMENT', provider: 'TOSS'}],
        ['provider reference awaiting payment', {status: 'AWAITING_PAYMENT', providerReference: 'payment-reference'}],
        ['verified awaiting payment', {status: 'AWAITING_PAYMENT', verifiedAt: terms.periodStart}],
    ])('shows recovery and creates no payment for a %s order found during proceed', async (_name, state) => {
        const originalGet = mocks.get.getMockImplementation()!;
        const blocked = {...order, ...state, id: 'reconciling-order'};

        let reads = 0;

        mocks.get.mockImplementation((path: string) => {
            if (path === '/billing-scopes/ward-scope') {
                reads += 1;

                return Promise.resolve(billing(reads === 1 ? [] : [{...order, id: 'unsubmitted-before-blocked'}, blocked]));
            }

            return originalGet(path);
        });
        mountBilling();
        await readyQuote();
        expect(financialCalls()).toEqual([]);
        await userEvent.click(agreement());
        await userEvent.click(proceed());

        const recovery = await screen.findByRole('link', {name: '결제 상태 확인'});

        expect(recovery).toHaveAttribute('href', '/billing/payment-return?orderId=reconciling-order');
        expect(screen.getAllByRole('link', {name: '결제 상태 확인'})).toHaveLength(1);
        expect(recovery.closest('[role="status"]')).toHaveTextContent(
            state.status === 'PAID_PENDING_APPLICATION' ? '결제는 완료됐고, 이용권을 적용하고 있어요.' : '결제 결과를 확인하고 있어요.',
        );
        expect(screen.queryByRole('alert')).not.toBeInTheDocument();
        expect(reads).toBeGreaterThanOrEqual(2);
        expect(financialCalls()).toEqual([]);
        expect(mocks.open).not.toHaveBeenCalled();
    });

    it('stops registration if an order starts processing before safe cancellation finishes', async () => {
        const originalGet = mocks.get.getMockImplementation()!;

        mocks.get.mockImplementation((path: string) =>
            path === '/billing-scopes/ward-scope' ? Promise.resolve(billing([order])) : originalGet(path),
        );
        mocks.post.mockImplementation((path: string) =>
            path.endsWith('/quotes') ? Promise.resolve(quote) : Promise.reject(new Error('결제 처리가 시작되어 취소할 수 없습니다.')),
        );
        mountBilling();
        await acceptAndProceed();
        expect(await screen.findByRole('alert')).toHaveTextContent('결제 처리가 시작되어 취소할 수 없습니다.');
        expect(financialCalls().map(([path]) => path)).toEqual(['/orders/order-fixture/abandon']);
        expect(mocks.open).not.toHaveBeenCalled();
    });

    it('requires a fresh billing read at proceed even if cached history had no pending order', async () => {
        const originalGet = mocks.get.getMockImplementation()!;

        let reads = 0;

        mocks.get.mockImplementation((path: string) => {
            if (path === '/billing-scopes/ward-scope') {
                reads += 1;

                return reads === 1 ? Promise.resolve(billing()) : Promise.reject(new Error('최신 결제 정보를 불러오지 못했습니다.'));
            }

            return originalGet(path);
        });
        mountBilling();
        await acceptAndProceed();
        await waitFor(() =>
            expect(screen.getAllByRole('alert').some((alert) => alert.textContent?.includes('최신 결제 정보를 불러오지 못했습니다.'))).toBe(
                true,
            ),
        );
        expect(reads).toBeGreaterThanOrEqual(2);
        expect(financialCalls()).toEqual([]);
        expect(mocks.open).not.toHaveBeenCalled();
    });

    it('refreshes newly created pending history after canceled card registration without canceling it automatically', async () => {
        const originalGet = mocks.get.getMockImplementation()!;

        let orders: Order[] = [];

        mocks.get.mockImplementation((path: string) =>
            path === '/billing-scopes/ward-scope' ? Promise.resolve(billing(orders)) : originalGet(path),
        );
        mocks.post.mockImplementation((path: string) => {
            if (path.endsWith('/subscription-checkout')) {
                orders = [order];

                return Promise.resolve(registration);
            }

            return Promise.resolve(quote);
        });
        mocks.open.mockRejectedValue(new Error('카드 등록을 취소했습니다. 결제는 진행되지 않았습니다.'));
        mountBilling();
        await acceptAndProceed();
        expect(await screen.findByRole('alert')).toHaveTextContent('카드 등록을 취소했습니다. 결제는 진행되지 않았습니다.');
        expect(screen.queryByRole('heading', {name: '결제 내역'})).not.toBeInTheDocument();
        expect(screen.queryByRole('link', {name: /₩19,900 · 결제 전/})).not.toBeInTheDocument();
        expect(screen.queryByRole('link', {name: '결제 상태 확인'})).not.toBeInTheDocument();
        expect(financialCalls().map(([path]) => path)).toEqual(['/v2/billing-scopes/ward-scope/subscription-checkout']);
        expect(mocks.open).toHaveBeenCalledExactlyOnceWith(registration);
    });
});

describe('concise payment recovery', () => {
    function mountRecovery(response: Order = order, backPath = '/billing') {
        const originalGet = mocks.get.getMockImplementation()!;

        mocks.get.mockImplementation((path: string) =>
            path === '/orders/order-fixture' ? Promise.resolve({...response}) : originalGet(path),
        );

        return render(
            <QueryClientProvider client={new QueryClient({defaultOptions: {queries: {retry: false}}})}>
                <MemoryRouter initialEntries={['/billing/payment-return?orderId=order-fixture']}>
                    <Routes>
                        <Route path="/billing/payment-return" element={<PaymentReturn backPath={backPath} />} />
                        <Route path="*" element={<p>돌아온 결제 화면</p>} />
                    </Routes>
                </MemoryRouter>
            </QueryClientProvider>,
        );
    }

    function expectNoInternalPaymentDetails() {
        expect(screen.queryByText(/PG 승인|PG 검증|서비스 적용:/)).not.toBeInTheDocument();
        expect(screen.queryByText('PRIVATE_GATEWAY_FAILURE')).not.toBeInTheDocument();
        expect(screen.queryByRole('button', {name: '결제 전 주문 취소'})).not.toBeInTheDocument();
        expect(screen.queryByRole('button', {name: 'PG 거래 재조회'})).not.toBeInTheDocument();
    }

    it('returns an uncharged order to its ward without a separate cancel step or financial mutation', async () => {
        mountRecovery({...order, failureCode: 'PRIVATE_GATEWAY_FAILURE'});

        expect(await screen.findByRole('heading', {name: '아직 결제되지 않았어요'})).toBeInTheDocument();
        expect(screen.getByText('새 금액을 확인하고 다시 진행해 주세요.')).toBeInTheDocument();
        expect(screen.queryByText('₩19,900')).not.toBeInTheDocument();

        const restart = screen.getByRole('link', {name: '다시 진행하기'});

        expect(restart).toHaveAttribute('href', '/billing/11/subscription');
        expect(screen.getAllByRole('link')).toHaveLength(1);
        expectNoInternalPaymentDetails();
        expect(mocks.post).not.toHaveBeenCalled();
        await userEvent.click(restart);
        expect(await screen.findByText('돌아온 결제 화면')).toBeInTheDocument();
        expect(mocks.post).not.toHaveBeenCalled();
        expect(mocks.open).not.toHaveBeenCalled();
    });

    it('does not claim a cached unpaid order is still uncharged after its latest status lookup fails', async () => {
        const client = new QueryClient({defaultOptions: {queries: {retry: false}}});
        const orderKey = commercialQueryKey(7, 'order', order.id);
        const originalGet = mocks.get.getMockImplementation()!;

        client.setQueryData(orderKey, order);
        mocks.get.mockImplementation((path: string) =>
            path === '/orders/order-fixture' ? Promise.reject(new Error('최신 결제 상태를 불러오지 못했습니다.')) : originalGet(path),
        );
        render(
            <QueryClientProvider client={client}>
                <MemoryRouter initialEntries={['/billing/payment-return?orderId=order-fixture']}>
                    <PaymentReturn backPath="/billing" />
                </MemoryRouter>
            </QueryClientProvider>,
        );

        expect(await screen.findByRole('alert')).toHaveTextContent('최신 결제 상태를 불러오지 못했습니다.');
        expect(client.getQueryData(orderKey)).toEqual(order);
        expect(screen.queryByRole('heading', {name: '아직 결제되지 않았어요'})).not.toBeInTheDocument();
        expect(screen.queryByRole('link', {name: '다시 진행하기'})).not.toBeInTheDocument();
        expect(screen.queryByText('₩19,900')).not.toBeInTheDocument();
        expect(screen.getByRole('link', {name: '요금제·결제로'})).toHaveAttribute('href', '/billing');
        expect(mocks.post).not.toHaveBeenCalled();
        expect(mocks.open).not.toHaveBeenCalled();
    });

    it.each([
        ['former membership', []],
        ['non-owner membership', [{...scope, role: 'MANAGER' as const}]],
    ])('keeps original-payer recovery available through the billing selector for a %s', async (_name, scopes) => {
        mocks.scopes = scopes;
        mountRecovery();

        expect(await screen.findByRole('link', {name: '요금제·결제로'})).toHaveAttribute('href', '/billing');
        expect(screen.queryByRole('link', {name: '다시 진행하기'})).not.toBeInTheDocument();
        expect(mocks.get).toHaveBeenCalledWith('/orders/order-fixture');
        expect(mocks.post).not.toHaveBeenCalled();
    });

    it('uses the caller back path when the original ward is no longer accessible', async () => {
        mountRecovery({...order, scopeId: 'former-ward-scope'}, '/workspace');

        expect(await screen.findByRole('link', {name: '관리 화면으로'})).toHaveAttribute('href', '/workspace');
        expect(screen.queryByRole('link', {name: '다시 진행하기'})).not.toBeInTheDocument();
        expect(mocks.post).not.toHaveBeenCalled();
    });

    it.each([
        ['provider reference', {providerReference: 'payment-reference'}],
        ['verified result', {verifiedAt: terms.periodStart}],
    ])('cannot start over from an awaiting order with a %s', async (_name, evidence) => {
        mountRecovery({...order, ...evidence});
        await screen.findByText('₩19,900');

        expect(screen.queryByRole('link', {name: '다시 진행하기'})).not.toBeInTheDocument();
        expectNoInternalPaymentDetails();
        expect(mocks.post).not.toHaveBeenCalled();

        const reads = mocks.get.mock.calls.filter(([path]) => path === '/orders/order-fixture').length;

        await userEvent.click(screen.getByRole('button', {name: '결제 상태 다시 확인'}));
        await waitFor(() =>
            expect(mocks.get.mock.calls.filter(([path]) => path === '/orders/order-fixture').length).toBeGreaterThan(reads),
        );
        expect(mocks.post).not.toHaveBeenCalled();
    });

    it.each(['PROCESSING', 'UNKNOWN', 'PAID_PENDING_APPLICATION'])('keeps a %s payment on explicit status recovery', async (status) => {
        mountRecovery({...order, provider: 'TOSS', status, failureCode: 'PRIVATE_GATEWAY_FAILURE'});

        expect(await screen.findByRole('button', {name: '결제 상태 다시 확인'})).toBeEnabled();
        expect(screen.getAllByText('₩19,900')).toHaveLength(1);
        expect(screen.queryByRole('link', {name: '다시 진행하기'})).not.toBeInTheDocument();
        expectNoInternalPaymentDetails();
        expect(mocks.post).not.toHaveBeenCalled();
    });

    it('queries the provider only on an explicit recheck and updates the completed result', async () => {
        const pending = {...order, provider: 'TOSS', status: 'UNKNOWN'};

        mocks.post.mockImplementation((path: string) => {
            if (path === '/orders/order-fixture/INQUIRE') {
                pending.status = 'APPLIED';

                return Promise.resolve({...pending});
            }

            throw new Error('Unexpected financial action');
        });
        mountRecovery(pending);

        const recheck = await screen.findByRole('button', {name: '결제 상태 다시 확인'});

        expect(mocks.post).not.toHaveBeenCalled();
        await userEvent.click(recheck);
        await waitFor(() => expect(screen.queryByRole('button', {name: '결제 상태 다시 확인'})).not.toBeInTheDocument());
        expect(screen.getByRole('heading', {name: '결제가 완료됐어요'})).toBeInTheDocument();
        expect(mocks.post).toHaveBeenCalledExactlyOnceWith('/orders/order-fixture/INQUIRE');
        expect(screen.getAllByText('₩19,900')).toHaveLength(1);
        expectNoInternalPaymentDetails();
        expect(mocks.open).not.toHaveBeenCalled();
    });

    it.each(['APPLIED', 'PAID'])('shows a completed %s payment without requery or restart actions', async (status) => {
        mountRecovery({...order, provider: 'TOSS', status, verifiedAt: terms.periodStart, appliedAt: terms.periodStart});
        await screen.findByText('₩19,900');

        expect(screen.queryByRole('button', {name: '결제 상태 다시 확인'})).not.toBeInTheDocument();
        expect(screen.queryByRole('link', {name: '다시 진행하기'})).not.toBeInTheDocument();
        expectNoInternalPaymentDetails();
        expect(mocks.post).not.toHaveBeenCalled();
    });

    it('allows a new attempt for a terminal failed payment without exposing raw provider failure codes', async () => {
        mountRecovery({...order, provider: 'TOSS', status: 'FAILED', failureCode: 'PRIVATE_GATEWAY_FAILURE'});

        expect(await screen.findByRole('heading', {name: '결제가 완료되지 않았어요'})).toBeInTheDocument();
        expect(screen.getByRole('link', {name: '다시 진행하기'})).toHaveAttribute('href', '/billing/11/subscription');
        expect(screen.queryByRole('button', {name: '결제 상태 다시 확인'})).not.toBeInTheDocument();
        expectNoInternalPaymentDetails();
        expect(mocks.post).not.toHaveBeenCalled();
    });

    it('does not offer a new payment or automated provider action for an unknown future state', async () => {
        mountRecovery({...order, provider: 'TOSS', status: 'FUTURE_FINANCIAL_STATE'});
        await screen.findByText('₩19,900');

        expect(screen.queryByRole('link', {name: '다시 진행하기'})).not.toBeInTheDocument();
        expect(screen.queryByRole('button', {name: '결제 상태 다시 확인'})).not.toBeInTheDocument();
        expectNoInternalPaymentDetails();
        expect(mocks.post).not.toHaveBeenCalled();
    });
});

describe('ward billing history and refund availability', () => {
    const invoice: Invoice = {
        id: 'invoice-paid',
        kind: 'SUBSCRIPTION',
        status: 'PAID',
        gross: 19900,
        vat: 1810,
        allocated: 19900,
        refundedGross: 0,
        dueAt: terms.periodStart,
        periodStart: terms.periodStart,
        periodEnd: terms.periodEnd,
    };

    function mockBilling(overrides: Partial<Pick<Billing, 'invoices' | 'orders' | 'requests'>> = {}) {
        const original = mocks.get.getMockImplementation()!;

        mocks.get.mockImplementation((path: string) =>
            path === '/billing-scopes/ward-scope'
                ? Promise.resolve({
                      scope: {version: 1, cancelAtPeriodEnd: false},
                      invoices: [],
                      orders: [],
                      requests: [],
                      ...overrides,
                  })
                : original(path),
        );
    }

    it('omits empty history and refund sections before the first payment', async () => {
        mount();
        await readyQuote();

        expect(screen.queryByRole('heading', {name: '결제 내역'})).not.toBeInTheDocument();
        expect(screen.queryByText(/첫 결제 후.*내역.*표시/)).not.toBeInTheDocument();
        expect(screen.queryByRole('heading', {name: '환불·정산 문의'})).not.toBeInTheDocument();
        expect(screen.queryByRole('combobox', {name: '환불을 요청할 청구서'})).not.toBeInTheDocument();
    });

    it('omits unpaid drafts, canceled invoices and failed payment attempts from payment history', async () => {
        mockBilling({
            invoices: [
                {...invoice, id: 'invoice-open', status: 'OPEN', allocated: 0},
                {...invoice, id: 'invoice-unpaid', status: 'VOID', allocated: 0},
            ],
            orders: [order, {...order, id: 'failed-order', status: 'FAILED'}],
        });
        mount();
        await readyQuote();

        expect(screen.queryByRole('heading', {name: '결제 내역'})).not.toBeInTheDocument();
        expect(screen.queryByRole('table')).not.toBeInTheDocument();
        expect(screen.queryByText(/납부 대기|청구 취소|결제 미완료|결제 전$/)).not.toBeInTheDocument();
        expect(screen.queryByRole('link', {name: '결제 상태 확인'})).not.toBeInTheDocument();
        expect(screen.queryByRole('heading', {name: '환불·정산 문의'})).not.toBeInTheDocument();
        expect(financialCalls()).toEqual([]);
    });

    it.each(['/workspace/payment-return', '/billing/payment-return'])(
        'keeps one unresolved payment recovery link at %s outside settled payment history',
        async (paymentReturnPath) => {
            mockBilling({
                orders: [
                    order,
                    {...order, id: 'failed-order', status: 'FAILED'},
                    {...order, id: 'uncertain-order', provider: 'TOSS', status: 'UNKNOWN'},
                    {...order, id: 'processing-order', provider: 'TOSS', status: 'PROCESSING'},
                ],
            });
            render(
                <QueryClientProvider client={new QueryClient({defaultOptions: {queries: {retry: false}}})}>
                    <MemoryRouter>
                        <BillingPanel scope={scope} e={entitlement} paymentReturnPath={paymentReturnPath} cardRegistrationVersion={2} />
                    </MemoryRouter>
                </QueryClientProvider>,
            );

            const recovery = await screen.findByRole('link', {name: '결제 상태 확인'});

            expect(screen.getAllByRole('link', {name: '결제 상태 확인'})).toHaveLength(1);
            expect(recovery).toHaveAttribute('href', `${paymentReturnPath}?orderId=uncertain-order`);
            expect(screen.queryByRole('heading', {name: '결제 내역'})).not.toBeInTheDocument();
            expect(screen.queryByRole('table')).not.toBeInTheDocument();
            expect(screen.queryByText(/결제 미완료|납부 대기|청구 취소/)).not.toBeInTheDocument();
            await readyQuote();
            await userEvent.click(agreement());
            expect(proceed()).toBeDisabled();
            await userEvent.click(proceed());
            expect(financialCalls()).toEqual([]);
        },
    );

    it('shows one conventional paid record rather than separate invoice and order entries', async () => {
        mockBilling({
            invoices: [invoice, {...invoice, id: 'invoice-draft', status: 'VOID', allocated: 0}],
            orders: [
                {...order, invoiceId: invoice.id, status: 'APPLIED', verifiedAt: terms.periodStart},
                {...order, id: 'failed-order', invoiceId: 'invoice-draft', status: 'FAILED'},
            ],
        });
        mount();

        const section = (await screen.findByRole('heading', {name: '결제 내역'})).closest('section')!;
        const table = within(section).getByRole('table');

        expect(within(table).getAllByRole('row')).toHaveLength(2);
        expect(within(table).getByRole('columnheader', {name: '결제일'})).toBeInTheDocument();
        expect(within(table).getByRole('columnheader', {name: '상품'})).toBeInTheDocument();
        expect(within(table).getByRole('columnheader', {name: '결제 금액'})).toBeInTheDocument();
        expect(within(table).getByRole('columnheader', {name: '상태'})).toBeInTheDocument();
        expect(within(table).getByText('₩19,900')).toBeInTheDocument();
        expect(within(table).getByText('결제 완료')).toBeInTheDocument();
        expect(within(section).queryByText(/청구 금액|수납|납부 대기|청구 취소/)).not.toBeInTheDocument();
        expect(within(section).getAllByRole('link')).toHaveLength(1);
        expect(within(section).getByRole('link', {name: /상세 보기/})).toHaveAttribute(
            'href',
            '/workspace/payment-return?orderId=order-fixture',
        );
        expect(financialCalls()).toEqual([]);
    });

    it('shows an applied payment even when invoice details have not arrived', async () => {
        mockBilling({orders: [{...order, status: 'APPLIED', verifiedAt: terms.periodStart}]});
        mount();

        const section = (await screen.findByRole('heading', {name: '결제 내역'})).closest('section')!;

        expect(within(section).getAllByRole('row')).toHaveLength(2);
        expect(within(section).getByText('결제 완료')).toBeInTheDocument();
        expect(within(section).getByRole('link', {name: /상세 보기/})).toHaveAttribute(
            'href',
            '/workspace/payment-return?orderId=order-fixture',
        );
        expect(financialCalls()).toEqual([]);
    });

    it('retains a confirmed payment when its invoice allocation was reversed', async () => {
        mockBilling({
            invoices: [{...invoice, status: 'VOID', allocated: 0}],
            orders: [{...order, invoiceId: invoice.id, status: 'APPLIED', verifiedAt: terms.periodStart}],
        });
        mount();

        const section = (await screen.findByRole('heading', {name: '결제 내역'})).closest('section')!;

        expect(within(section).getByText('₩19,900')).toBeInTheDocument();
        expect(within(section).getByText('결제 완료')).toBeInTheDocument();
        expect(within(section).getAllByRole('row')).toHaveLength(2);
        expect(screen.queryByRole('combobox', {name: '환불을 요청할 청구서'})).not.toBeInTheDocument();
        expect(financialCalls()).toEqual([]);
    });

    it('keeps partial and full refunds visible beside their original paid amounts', async () => {
        mockBilling({
            invoices: [
                {...invoice, id: 'invoice-partial', refundedGross: 5000},
                {...invoice, id: 'invoice-full', refundedGross: invoice.allocated},
            ],
            orders: [
                {...order, id: 'order-partial', invoiceId: 'invoice-partial', status: 'APPLIED', verifiedAt: terms.periodStart},
                {...order, id: 'order-full', invoiceId: 'invoice-full', status: 'APPLIED', verifiedAt: terms.periodStart},
            ],
        });
        mount();

        const section = (await screen.findByRole('heading', {name: '결제 내역'})).closest('section')!;
        const partial = within(section).getByText('일부 환불').closest('tr')!;
        const full = within(section).getByText('환불 완료').closest('tr')!;

        expect(within(partial).getByText('₩19,900')).toBeInTheDocument();
        expect(partial).toHaveTextContent('₩5,000');
        expect(full).toHaveTextContent('₩19,900');
        expect(within(section).getAllByRole('row')).toHaveLength(3);
        expect(within(section).queryByText('청구 취소')).not.toBeInTheDocument();
    });

    it('shows confirmed collection and one activation notice while paid access is being applied', async () => {
        mockBilling({
            invoices: [{...invoice, status: 'OPEN', allocated: 0}],
            orders: [
                {...order, invoiceId: invoice.id, provider: 'TOSS', status: 'PAID_PENDING_APPLICATION', verifiedAt: terms.periodStart},
            ],
        });
        mount();

        const section = (await screen.findByRole('heading', {name: '결제 내역'})).closest('section')!;

        expect(within(section).getByText('결제 완료')).toBeInTheDocument();
        expect(screen.getAllByRole('link', {name: '결제 상태 확인'})).toHaveLength(1);
        expect(within(section).getAllByRole('row')).toHaveLength(2);
        expect(screen.queryByText(/결제 미완료|납부 대기/)).not.toBeInTheDocument();
        await readyQuote();
        await userEvent.click(agreement());
        expect(proceed()).toBeDisabled();
        await userEvent.click(proceed());
        expect(financialCalls()).toEqual([]);
    });

    it('offers only invoices with a remaining collected balance for a refund request', async () => {
        mockBilling({
            invoices: [
                invoice,
                {...invoice, id: 'invoice-partial', refundedGross: 5000},
                {...invoice, id: 'invoice-refunded', refundedGross: 19900},
                {...invoice, id: 'invoice-unpaid', status: 'VOID', allocated: 0},
                {...invoice, id: 'invoice-void', status: 'VOID'},
            ],
        });
        mount();

        const select = await screen.findByRole('combobox', {name: '환불을 요청할 청구서'});

        expect(
            within(select)
                .getAllByRole('option')
                .map((option) => option.getAttribute('value')),
        ).toEqual(['', 'invoice-paid', 'invoice-partial']);
        expect(screen.getByRole('heading', {name: '결제 내역'})).toBeInTheDocument();

        await userEvent.selectOptions(select, 'invoice-partial');
        await userEvent.type(screen.getByRole('textbox', {name: '요청 내용'}), '부분 환불 후 남은 금액을 확인해 주세요.');
        await userEvent.click(screen.getByRole('button', {name: '요청 보내기'}));
        await waitFor(() =>
            expect(financialCalls()).toEqual([
                [
                    '/billing-scopes/ward-scope/requests',
                    {
                        kind: 'REFUND',
                        description: '부분 환불 후 남은 금액을 확인해 주세요.',
                        capacity: 50,
                        invoiceId: 'invoice-partial',
                    },
                    expect.any(String),
                ],
            ]),
        );
    });

    it('omits a new refund form after all collected funds have been refunded', async () => {
        mockBilling({invoices: [{...invoice, refundedGross: invoice.allocated}]});
        mount();
        await screen.findByRole('heading', {name: '결제 내역'});

        expect(screen.queryByRole('heading', {name: '환불·정산 문의'})).not.toBeInTheDocument();
        expect(screen.queryByRole('combobox', {name: '환불을 요청할 청구서'})).not.toBeInTheDocument();
    });

    it('preserves existing support requests after the refundable balance reaches zero', async () => {
        mockBilling({
            invoices: [{...invoice, refundedGross: invoice.allocated}],
            requests: [
                {
                    id: 'refund-request-complete',
                    kind: 'REFUND',
                    status: 'RESOLVED',
                    createdAt: terms.periodEnd,
                    resolution: '기존 환불 요청이 처리되었습니다.',
                },
            ],
        });
        mount();

        expect(await screen.findByText(/기존 환불 요청이 처리되었습니다/)).toBeInTheDocument();
        expect(screen.queryByRole('combobox', {name: '환불을 요청할 청구서'})).not.toBeInTheDocument();
        expect(screen.queryByRole('button', {name: '요청 보내기'})).not.toBeInTheDocument();
    });
});

describe('embedded active Plus subscription', () => {
    const active = {
        ...entitlement,
        plan: 'PLUS',
        entitlementSource: 'SUBSCRIPTION',
        capacity: {...entitlement.capacity, purchased: 50},
        policy,
    } as Entitlement;

    function mountActive({
        billingScope = {},
        capacity = 50,
        registered = true,
    }: {
        billingScope?: Partial<Billing['scope']>;
        capacity?: number;
        registered?: boolean;
    } = {}) {
        const original = mocks.get.getMockImplementation()!;

        mocks.get.mockImplementation((path: string) => {
            if (path === '/billing-scopes/ward-scope')
                return Promise.resolve({
                    scope: {
                        id: scope.scopeId,
                        scopeType: 'WARD',
                        scopeRef: scope.ref,
                        customerId: 'customer-fixture',
                        version: 4,
                        cancelAtPeriodEnd: false,
                        periodStart: terms.periodStart,
                        periodEnd: terms.periodEnd,
                        ...billingScope,
                    },
                    customer: {name: scope.name, plan: 'PLUS', paymentMode: 'CARD', capacity},
                    invoices: [],
                    orders: [{...order, status: 'APPLIED'}],
                    requests: [],
                });

            if (path === '/billing-scopes/ward-scope/payment-method')
                return Promise.resolve({
                    registered,
                    maskedCard: registered ? '신한카드 1234' : undefined,
                    termsVersion: terms.termsVersion,
                });

            return original(path);
        });

        return render(
            <QueryClientProvider client={new QueryClient({defaultOptions: {queries: {retry: false}}})}>
                <MemoryRouter initialEntries={['/billing/11/subscription']}>
                    <BillingPanel
                        scope={scope}
                        e={active}
                        embedded
                        cardRegistrationVersion={2}
                        paymentReturnPath="/billing/payment-return"
                    />
                </MemoryRouter>
            </QueryClientProvider>,
        );
    }

    it('summarizes the active plan and card without requiring renewed consent merely to view the page', async () => {
        mountActive();
        expect(await screen.findByText('신한카드 1234')).toBeInTheDocument();
        expect(screen.getByRole('heading', {name: 'Plus'})).toBeInTheDocument();
        expect(screen.getByText('다음 결제일')).toBeInTheDocument();
        expect(screen.queryByRole('heading', {name: '현재 Plus 구독'})).not.toBeInTheDocument();
        expect(screen.queryByRole('heading', {name: '자동 갱신 결제수단'})).not.toBeInTheDocument();
        expect(screen.getByRole('button', {name: '변경'})).toBeInTheDocument();
        expect(screen.queryByRole('checkbox', {name: '현재 계약 조건의 매월 자동 갱신에 동의합니다.'})).not.toBeInTheDocument();
        expect(screen.queryByRole('button', {name: '카드 등록·변경'})).not.toBeInTheDocument();
        expect(screen.queryByText('인원 줄이기')).not.toBeInTheDocument();
        expect(screen.queryByRole('textbox', {name: '다음 갱신 때 줄일 총 인원'})).not.toBeInTheDocument();
        expect(screen.getByText('추가 이용 문의').closest('details')).not.toHaveAttribute('open');
        expect(screen.queryByRole('button', {name: '동의하고 진행하기'})).not.toBeInTheDocument();
        expect(screen.getByRole('link', {name: /상세 보기/})).toHaveAttribute('href', '/billing/payment-return?orderId=order-fixture');
        expect(mocks.post).not.toHaveBeenCalled();
        expect(mocks.delete).not.toHaveBeenCalled();
    });

    it('uses the existing contract pricing and purchased capacity rather than the published offer or used staff', async () => {
        mocks.offer.mockResolvedValue(publishedOffer);
        mountActive({capacity: 55});
        await screen.findByText('신한카드 1234');

        const overview = within(screen.getByRole('heading', {name: 'Plus'}).closest('section')!);

        expect(overview.getByText('₩24,850')).toBeInTheDocument();
        expect(overview.queryByText('₩35,000')).not.toBeInTheDocument();
        expect(overview.queryByText('₩19,900')).not.toBeInTheDocument();
        expect(mocks.post).not.toHaveBeenCalled();
    });

    it('distinguishes the current monthly fee from a scheduled lower next renewal', async () => {
        mountActive({capacity: 55, billingScope: {nextCapacity: 50}});
        await screen.findByText('신한카드 1234');

        const overview = within(screen.getByRole('heading', {name: 'Plus'}).closest('section')!);

        expect(overview.getByText('₩24,850')).toBeInTheDocument();
        expect(overview.getByText('다음 결제 금액')).toBeInTheDocument();
        expect(overview.getByText(/₩19,900/)).toBeInTheDocument();
        expect(mocks.post).not.toHaveBeenCalled();
    });

    it('only schedules a capacity decrease below the current contract and within the included minimum', async () => {
        mountActive({capacity: 60});
        await screen.findByText('신한카드 1234');
        await userEvent.click(screen.getByText('인원 줄이기'));

        const staff = screen.getByRole('textbox', {name: '다음 갱신 때 줄일 총 인원'});
        const reserve = screen.getByRole('button', {name: '다음 주기 감원 예약'});

        expect(staff).toHaveValue('60');
        expect(reserve).toBeDisabled();
        expect(mocks.post).not.toHaveBeenCalled();
        await userEvent.clear(staff);
        await userEvent.type(staff, '49');
        expect(reserve).toBeDisabled();
        await userEvent.clear(staff);
        await userEvent.type(staff, '61');
        expect(reserve).toBeDisabled();
        await userEvent.clear(staff);
        await userEvent.type(staff, '50');
        expect(reserve).toBeEnabled();
        await userEvent.click(reserve);
        await waitFor(() =>
            expect(mocks.post).toHaveBeenCalledExactlyOnceWith('/billing-scopes/ward-scope/capacity-reservation', {
                capacity: 50,
                expectedVersion: 4,
            }),
        );
        expect(mocks.open).not.toHaveBeenCalled();
        expect(mocks.delete).not.toHaveBeenCalled();
    });

    it('keeps the subscription unchanged when cancellation is opened and then dismissed', async () => {
        mountActive();
        await screen.findByText('신한카드 1234');
        expect(screen.queryByRole('button', {name: '해지하기'})).not.toBeInTheDocument();

        const cancelTrigger = screen.getByRole('button', {name: '구독 해지'});

        await userEvent.click(cancelTrigger);
        expect(screen.getByText('구독을 해지할까요?')).toBeInTheDocument();
        expect(cancelTrigger).toHaveAttribute('aria-expanded', 'true');
        expect(cancelTrigger).toHaveFocus();
        expect(mocks.post).not.toHaveBeenCalled();
        await userEvent.click(screen.getByRole('button', {name: '유지하기'}));
        expect(screen.queryByText('구독을 해지할까요?')).not.toBeInTheDocument();
        expect(cancelTrigger).toHaveAttribute('aria-expanded', 'false');
        expect(cancelTrigger).toHaveFocus();
        expect(mocks.post).not.toHaveBeenCalled();
        expect(mocks.delete).not.toHaveBeenCalled();
    });

    it('only schedules cancellation after confirmation and preserves the latest scope version', async () => {
        mountActive();
        await screen.findByText('신한카드 1234');
        await userEvent.click(screen.getByRole('button', {name: '구독 해지'}));
        expect(mocks.post).not.toHaveBeenCalled();
        await userEvent.click(screen.getByRole('button', {name: '해지하기'}));
        await waitFor(() =>
            expect(mocks.post).toHaveBeenCalledExactlyOnceWith('/billing-scopes/ward-scope/renewal', {
                expectedVersion: 4,
                cancel: true,
            }),
        );
        expect(mocks.delete).not.toHaveBeenCalled();
        expect(mocks.open).not.toHaveBeenCalled();
    });

    it('retains the confirmation and reports a failed cancellation without claiming it succeeded', async () => {
        mocks.post.mockRejectedValue(new Error('해지 요청 실패'));
        mountActive();
        await screen.findByText('신한카드 1234');
        await userEvent.click(screen.getByRole('button', {name: '구독 해지'}));
        await userEvent.click(screen.getByRole('button', {name: '해지하기'}));
        expect(await screen.findByRole('alert')).toHaveTextContent('해지 요청 실패');
        expect(screen.getByText('구독을 해지할까요?')).toBeInTheDocument();
        expect(screen.getByRole('button', {name: '해지하기'})).toBeEnabled();
        expect(screen.queryByText('해지 예정')).not.toBeInTheDocument();
        expect(mocks.delete).not.toHaveBeenCalled();
    });

    it('requires a separate confirmation before removing the registered renewal card', async () => {
        mountActive();
        await screen.findByText('신한카드 1234');
        await userEvent.click(screen.getByRole('button', {name: '변경'}));
        await userEvent.click(screen.getByRole('checkbox', {name: '현재 계약 조건의 매월 자동 갱신에 동의합니다.'}));

        const removeTrigger = screen.getByRole('button', {name: '등록 카드 삭제'});

        await userEvent.click(removeTrigger);
        expect(screen.getByRole('button', {name: '돌아가기'})).toHaveFocus();
        expect(screen.queryByRole('button', {name: '등록 카드 삭제'})).not.toBeInTheDocument();
        expect(screen.queryByRole('button', {name: '카드 등록·변경'})).not.toBeInTheDocument();
        expect(screen.queryByRole('checkbox', {name: '현재 계약 조건의 매월 자동 갱신에 동의합니다.'})).not.toBeInTheDocument();
        expect(mocks.delete).not.toHaveBeenCalled();
        expect(mocks.post).not.toHaveBeenCalled();
        await userEvent.click(screen.getByRole('button', {name: '돌아가기'}));
        expect(screen.getByRole('button', {name: '등록 카드 삭제'})).toHaveFocus();
        expect(screen.getByRole('checkbox', {name: '현재 계약 조건의 매월 자동 갱신에 동의합니다.'})).not.toBeChecked();
        expect(screen.getByRole('button', {name: '카드 등록·변경'})).toBeDisabled();
        expect(mocks.delete).not.toHaveBeenCalled();
        await userEvent.click(screen.getByRole('button', {name: '등록 카드 삭제'}));
        await userEvent.click(screen.getByRole('button', {name: '카드 삭제'}));
        await waitFor(() => expect(mocks.delete).toHaveBeenCalledExactlyOnceWith('/billing-scopes/ward-scope/payment-method'));
        await waitFor(() => expect(screen.getByRole('button', {name: '변경'})).toHaveFocus());
        expect(mocks.post).not.toHaveBeenCalled();
        expect(mocks.open).not.toHaveBeenCalled();
    });

    it('can undo scheduled cancellation when the renewal card is still registered', async () => {
        mountActive({billingScope: {cancelAtPeriodEnd: true}});
        await screen.findByText('신한카드 1234');
        expect(screen.getByText('이용 종료일')).toBeInTheDocument();
        expect(screen.queryByText('다음 결제일')).not.toBeInTheDocument();
        await userEvent.click(screen.getByRole('button', {name: '해지 예약 취소'}));
        await waitFor(() =>
            expect(mocks.post).toHaveBeenCalledExactlyOnceWith('/billing-scopes/ward-scope/renewal', {
                expectedVersion: 4,
                cancel: false,
            }),
        );
        expect(mocks.open).not.toHaveBeenCalled();
    });

    it('requires new card consent to resume after the renewal card was removed', async () => {
        mountActive({registered: false, billingScope: {cancelAtPeriodEnd: true}});
        await screen.findByText('등록된 카드 없음');
        expect(await screen.findByRole('link', {name: '카드 등록 후 구독 유지'})).toHaveAttribute('href', '#plus-subscription-card');
        expect(screen.queryByRole('button', {name: '해지 예약 취소'})).not.toBeInTheDocument();
        await userEvent.click(screen.getByRole('button', {name: '카드 등록'}));
        expect(screen.getByText('카드 등록을 완료하면 해지 예약이 취소되고 매월 자동결제가 재개됩니다.')).toBeInTheDocument();
        expect(screen.getByRole('checkbox', {name: '현재 계약 조건의 매월 자동 갱신에 동의합니다.'})).not.toBeChecked();
        expect(screen.getByRole('button', {name: '카드 등록·변경'})).toBeDisabled();
        expect(mocks.post).not.toHaveBeenCalled();
        expect(mocks.open).not.toHaveBeenCalled();
    });
});

describe('card authorization callback and first charge', () => {
    it('shows the original service period and amount, scrubs authorization and only charges on explicit confirmation', async () => {
        mount(callback);

        const confirm = await screen.findByRole('button', {name: /결제하고 Plus 시작/});

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
        expect(screen.queryByRole('button', {name: /결제하고 Plus 시작/})).not.toBeInTheDocument();
    });

    it.each(['PROCESSING', 'UNKNOWN', 'PAID_PENDING_APPLICATION', 'FAILED', 'APPLIED'])(
        'does not create another charge for an existing %s order',
        async (status) => {
            mocks.get.mockResolvedValue({...order, status, provider: 'TOSS'});
            mount(callback);
            await screen.findByText(/이번 결제금액/);
            expect(screen.queryByRole('button', {name: /결제하고 Plus 시작/})).not.toBeInTheDocument();
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
        await userEvent.dblClick(await screen.findByRole('button', {name: /결제하고 Plus 시작/}));
        expect(mocks.post).toHaveBeenCalledTimes(1);
        finish({...order, status: 'APPLIED'});
        expect(await screen.findByText('결제와 Plus 적용이 완료되었습니다. 등록한 카드로 매월 자동 갱신합니다.')).toBeInTheDocument();
    });

    it('does not charge with an incomplete authorization payload', async () => {
        mount(callback.replace('&customerKey=customer-fixture', ''));
        await screen.findByText(/이번 결제금액/);
        expect(screen.queryByRole('button', {name: /결제하고 Plus 시작/})).not.toBeInTheDocument();
        expect(screen.getByText(/인증 정보가 없으면 새로 청구하지 않습니다/)).toBeInTheDocument();
    });

    it('blocks the first charge and offers recovery for a malformed original service period', async () => {
        mocks.get.mockResolvedValue({...order, subscriptionSummary: {...order.subscriptionSummary, periodEnd: 'invalid'}});
        mount(callback);
        expect(await screen.findByRole('alert')).toHaveTextContent('구독 이용 조건을 확인하지 못했습니다');
        expect(screen.getByRole('button', {name: /결제하고 Plus 시작/})).toBeDisabled();
        expect(screen.getByRole('button', {name: '결제 상태 다시 확인'})).toBeInTheDocument();
        expect(screen.queryByText(/Invalid Date|NaN/)).not.toBeInTheDocument();
        expect(mocks.post).not.toHaveBeenCalled();
    });

    it('remains compatible with an existing order response without the additive summary', async () => {
        mocks.get.mockResolvedValue({...order, subscriptionSummary: undefined});
        mount(callback);
        expect(await screen.findByRole('button', {name: /결제하고 Plus 시작/})).toBeEnabled();
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
        expect(screen.queryByRole('button', {name: /결제하고 Plus 시작/})).not.toBeInTheDocument();
        expect(mocks.post).not.toHaveBeenCalled();
    });

    it('handles cancellation even when malicious callback parameters include authorization', async () => {
        mount(callback + '&code=PAY_PROCESS_CANCELED&message=must-not-display-private-data');
        expect(await screen.findByRole('alert')).toHaveTextContent('카드 등록을 취소했습니다');
        expect(screen.queryByText('must-not-display-private-data')).not.toBeInTheDocument();
        expect(screen.queryByRole('button', {name: /결제하고 Plus 시작/})).not.toBeInTheDocument();
        expect(mocks.post).not.toHaveBeenCalled();
    });

    it('offers status recovery instead of another charge after an uncertain response and failed status fetch', async () => {
        mocks.post.mockRejectedValue(new Error('응답 연결 실패'));

        let reads = 0;

        mocks.get.mockImplementation(() => (++reads === 1 ? Promise.resolve(order) : Promise.reject(new Error('조회 연결 실패'))));
        mount(callback);
        await userEvent.click(await screen.findByRole('button', {name: /결제하고 Plus 시작/}));
        expect(await screen.findByRole('button', {name: '결제 상태 다시 확인'})).toBeInTheDocument();
        expect(screen.queryByRole('button', {name: /결제하고 Plus 시작/})).not.toBeInTheDocument();
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

        await userEvent.click(await screen.findByRole('button', {name: '카드 등록'}));

        const start = screen.getByRole('button', {name: '카드 등록·변경'});

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
        expect(await screen.findByText('결제수단을 불러오지 못했어요')).toBeInTheDocument();
        expect(screen.getByRole('button', {name: '카드 등록'})).toBeDisabled();
        expect(screen.queryByRole('checkbox', {name: '현재 계약 조건의 매월 자동 갱신에 동의합니다.'})).not.toBeInTheDocument();
        expect(mocks.post).not.toHaveBeenCalled();
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

        await userEvent.click(await screen.findByRole('button', {name: '카드 등록'}));

        const start = screen.getByRole('button', {name: '카드 등록·변경'});

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
        expect(proceed()).toBeDisabled();
        expect(mocks.post).not.toHaveBeenCalled();
    });

    it('starts a new subscription from the published included staff', async () => {
        const original = mocks.get.getMockImplementation()!;

        mocks.get.mockImplementation((path: string) =>
            path === '/plans' ? Promise.resolve([{id: 'PLUS', config: {...policy, includedStaff: 80}, configured: true}]) : original(path),
        );
        mocks.post.mockResolvedValue(quoteForCapacity(80, 19900));
        mount();

        const input = await screen.findByRole('textbox', {name: '근무표에 포함할 인원을 입력하세요'});

        await waitFor(() => expect(input).toHaveValue('80'));
        expect(input).not.toHaveAttribute('min');
        await userEvent.clear(input);
        await userEvent.type(input, '30');
        await readyQuote();
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
        await userEvent.click(await screen.findByText('추가 이용 문의'));
        await userEvent.click(screen.getByRole('radio', {name: '인원 추가'}));

        const input = screen.getByRole('textbox', {name: '늘린 뒤 총 근무 인원'});

        expect(input).toHaveValue('');
        expect(screen.getByText('₩29,800')).toBeInTheDocument();
        await userEvent.type(input, '60');
        await userEvent.click(screen.getByRole('button', {name: '증원 금액 확인'}));
        expect(mocks.post).toHaveBeenCalledWith('/billing-scopes/ward-scope/quotes', expect.objectContaining({capacity: 60}));
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

        const input = await screen.findByRole('textbox', {name: '근무표에 포함할 인원을 입력하세요'});

        await waitFor(() => expect(input).toHaveValue('80'));
        expect(input).not.toHaveAttribute('min');
        await userEvent.clear(input);
        await userEvent.type(input, '30');
        await readyQuote();
        expect(screen.getByText('₩35,000')).toBeInTheDocument();
        expect(screen.getByRole('note', {name: '추가 인원 요금'})).toHaveTextContent(/기본 인원 초과 시 1명당 월.*1,200/);
        await readyQuote();
        expect(mocks.post).toHaveBeenCalledWith('/billing-scopes/ward-scope/quotes', expect.objectContaining({capacity: 80}));
        expect(await screen.findByRole('button', {name: '동의하고 진행하기'})).toBeDisabled();
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
        expect(proceed()).toBeDisabled();
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
        await readyQuote();
        expect(mocks.post).toHaveBeenCalledWith('/billing-scopes/ward-scope/quotes', expect.objectContaining({capacity: 80}));
        await userEvent.click(await screen.findByRole('checkbox', {name: /금액·대상·기간/}));
        expect(screen.getByRole('button', {name: '동의하고 진행하기'})).toBeDisabled();
        expect(screen.getByText('상품 안내 준비 상태 또는 1회 최대 100만 원의 결제 한도를 확인해 주세요.')).toBeInTheDocument();
        expect(mocks.post.mock.calls.filter(([path]) => path.endsWith('/subscription-checkout'))).toHaveLength(0);
        expect(mocks.open).not.toHaveBeenCalled();
    });
});
