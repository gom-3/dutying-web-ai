import {focusManager, QueryClient, QueryClientProvider} from '@tanstack/react-query';
import {createRoot} from 'react-dom/client';
import {MemoryRouter, Route, Routes, useLocation} from 'react-router';
import type {TAccount} from '../../src/entities/account';
import useAuthStore from '../../src/features/auth/model/store';
import {
    commercialQueryKey,
    type Billing,
    type Entitlement,
    type Order,
    type Policy,
    type QuoteRequest,
    type Scope,
} from '../../src/features/commercial/api';
import i18n from '../../src/i18n';
import WardBillingPage, {LegacyWorkspaceRoute} from '../../src/pages/ward-billing';
import {MainLayout} from '../../src/widgets/layouts/main-layout';
import {wardQueryKeys} from '../../src/entities/ward/model/queries';
import axiosInstance, {adminAxiosInstance} from '../../src/shared/api/client';
import {SUBSCRIPTION_TERMS_VERSION} from '../../src/shared/business/profile';
import '../../src/index.css';

void i18n.changeLanguage('ko');
focusManager.setEventListener(() => () => {});
const subscribed = new URLSearchParams(location.search).get('plan') === 'plus';
let quoteSequence = 0;
const accountId = 990001;
const wardId = 990585;
const scope: Scope = {type: 'WARD', ref: String(wardId), scopeId: 'preview-ward-only', name: '3병동', role: 'OWNER', status: 'ACTIVE'};
const context = {enabled: true, configurationReady: true, enforcementEnabled: true, cardRegistrationVersion: 2, scopes: [scope]};

// Keep the sample account in this document's memory, preserving the browser's saved login.
useAuthStore.persist.setOptions({storage: {getItem: () => null, setItem: () => {}, removeItem: () => {}}});
useAuthStore.setState({
    accountId,
    wardId,
    accessToken: null,
    isAuth: false,
    accountMeStatus: 'success',
    _loaded: true,
    accountMe: {
        accountId,
        name: '김듀팅',
        wardId,
        status: 'LINKED',
        memberships: [{wardId, status: 'ACTIVE', role: 'OWNER'}],
    } as unknown as TAccount,
});

const plus: Policy = {
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
const free: Policy = {...plus, plan: 'FREE', baseGross: 0, includedStaff: 30, extraStaffGross: 0, generate: 3, adjust: 1, adminSeats: 2};
const billingScope = {
    id: scope.scopeId,
    scopeType: 'WARD',
    scopeRef: scope.ref,
    version: 1,
    cancelAtPeriodEnd: false,
    customerId: 'preview-customer',
};
const entitlement: Entitlement = {
    configurationReady: true,
    scope: billingScope,
    billingScopeId: scope.scopeId,
    role: 'OWNER',
    plan: 'FREE',
    entitlementSource: 'FREE',
    capacity: {used: 24, purchased: 30, overLimit: false},
    adminSeats: {active: 1, reserved: 0, limit: 2},
    usage: [
        {meter: 'FULL_GENERATE', enforced: true, granted: 3, used: 1, reserved: 0, remaining: 2, lots: []},
        {meter: 'PARTIAL_ADJUST', enforced: true, granted: 1, used: 0, reserved: 0, remaining: 1, lots: []},
    ],
    policy: free,
    allowedActions: [],
    promotion: null,
    canManageBilling: true,
    checkoutEnabled: true,
};
const billing: Billing = {
    scope: billingScope,
    customer: {name: scope.name, plan: 'FREE', paymentMode: 'PREPAID', capacity: 30},
    invoices: [],
    orders: [],
    requests: [],
};
const recoveryState = new URLSearchParams(location.search).get('state') ?? 'AWAITING_PAYMENT';
const recoveryOrder: Order = {
    id: 'preview-recovery-order',
    scopeId: scope.scopeId,
    status: recoveryState,
    gross: 39700,
    currency: 'KRW',
    invoiceId: 'preview-recovery-invoice',
    ...(recoveryState !== 'AWAITING_PAYMENT' ? {provider: 'TOSS'} : {}),
};
if (subscribed) {
    Object.assign(entitlement, {
        plan: 'PLUS',
        entitlementSource: 'SUBSCRIPTION',
        policy: plus,
        capacity: {used: 24, purchased: 50, overLimit: false},
        adminSeats: {active: 1, reserved: 0, limit: 10},
        scope: {...billingScope, periodStart: '2026-11-11T00:00:00Z', periodEnd: '2026-12-11T00:00:00Z'},
    });
    billing.scope = entitlement.scope;
    billing.customer.plan = 'PLUS';
    billing.customer.capacity = 50;
    billing.invoices = [
        {
            id: 'preview-paid-invoice',
            kind: 'SUBSCRIPTION',
            status: 'PAID',
            gross: 19900,
            vat: 1809,
            allocated: 19900,
            refundedGross: 0,
            dueAt: '2026-11-11T00:00:00Z',
            periodStart: '2026-11-11T00:00:00Z',
            periodEnd: '2026-12-11T00:00:00Z',
        },
    ];
    billing.orders = [
        {
            id: 'preview-paid-order',
            scopeId: scope.scopeId,
            status: 'APPLIED',
            gross: 19900,
            currency: 'KRW',
            invoiceId: 'preview-paid-invoice',
            appliedAt: '2026-11-11T00:00:00Z',
        },
    ];
    entitlement.usage = [
        {meter: 'FULL_GENERATE', enforced: true, granted: 30, used: 6, reserved: 0, remaining: 24, lots: []},
        {meter: 'PARTIAL_ADJUST', enforced: true, granted: 10, used: 2, reserved: 0, remaining: 8, lots: []},
    ];
}
// The current product exposes one shared AI fill balance, not two independent meters.
entitlement.usage = [
    {
        meter: 'AI_FILL',
        enforced: true,
        granted: subscribed ? 30 : 3,
        used: subscribed ? 8 : 1,
        reserved: 0,
        remaining: subscribed ? 22 : 2,
        lots: [],
    },
];
const previewHistory = new URLSearchParams(location.search).get('history');
if (previewHistory === 'drafts') {
    billing.invoices.push(
        ...['OPEN', 'VOID'].map((status, index) => ({
            id: `preview-unpaid-invoice-${index}`,
            kind: 'SUBSCRIPTION',
            status,
            gross: 39700,
            vat: 3609,
            allocated: 0,
            refundedGross: 0,
            dueAt: '2026-11-12T00:00:00Z',
            periodStart: '2026-11-12T00:00:00Z',
            periodEnd: '2026-12-12T00:00:00Z',
        })),
    );
    billing.orders.push(
        ...['AWAITING_PAYMENT', 'FAILED'].map((status, index) => ({
            id: `preview-unpaid-order-${index}`,
            scopeId: scope.scopeId,
            status,
            gross: 39700,
            currency: 'KRW',
            invoiceId: `preview-unpaid-invoice-${index}`,
        })),
    );
}
if (previewHistory === 'checking') {
    Object.assign(recoveryOrder, {status: 'UNKNOWN', provider: 'TOSS'});
    billing.orders.push(recoveryOrder);
}
if (previewHistory === 'refunded' && subscribed) {
    billing.invoices[0].refundedGross = 19900;
}
const plans = [
    {id: 'preview-free', configured: true, config: free},
    {id: 'preview-plus', configured: true, config: plus},
];
const client = new QueryClient({defaultOptions: {queries: {staleTime: Infinity, retry: false}}});
client.setQueryData(commercialQueryKey(accountId, 'order', recoveryOrder.id), recoveryOrder);
client.setQueryData(wardQueryKeys.id(wardId), {wardId, name: '3병동', hospitalName: '새봄병원', code: 'DEMO03', shiftTeams: []});
client.setQueryData(wardQueryKeys.waitingNurses(wardId), []);
client.setQueryData(['ward-chat', 'unread', wardId], {wardId, unreadCount: 0});
client.setQueryData(wardQueryKeys.requestPendingCount(wardId), {totalPendingCount: 0});
client.setQueryData(commercialQueryKey(accountId, 'WARD', wardId, 'entitlements').concat([null]), entitlement);
client.setQueryData(commercialQueryKey(accountId, 'context'), context);
client.setQueryData(commercialQueryKey(accountId, 'WARD', scope.ref, 'entitlements'), entitlement);
client.setQueryData(commercialQueryKey(accountId, 'WARD', scope.ref, 'billing'), billing);
client.setQueryData(commercialQueryKey(accountId, 'campaigns'), []);
client.setQueryData(commercialQueryKey(accountId, 'WARD', scope.ref, 'payment-method'), {
    registered: true,
    termsVersion: SUBSCRIPTION_TERMS_VERSION,
    maskedCard: '예시 카드 · **** 1234',
});
client.setQueryData(commercialQueryKey(accountId, 'plans'), plans);
client.setQueryData(['public-plus-offer'], {
    ...plus,
    currency: 'KRW',
    maxChargeGross: 1000000,
    termsVersion: SUBSCRIPTION_TERMS_VERSION,
    priceVersion: 'preview-only',
    ready: true,
});

// Requests from the real screen are answered locally. Financial mutations never reach a server.
adminAxiosInstance.defaults.adapter = async (config) => {
    let data: unknown;
    const readSamples: Record<string, unknown> = {
        '/admin/commercial/access-context': context,
        '/admin/commercial/plans': plans,
        '/admin/commercial/campaigns': [],
        [`/admin/commercial/orders/${recoveryOrder.id}`]: recoveryOrder,
        [`/admin/commercial/v2/scopes/WARD/${wardId}/entitlements`]: entitlement,
        [`/admin/commercial/billing-scopes/${scope.scopeId}`]: billing,
        [`/admin/commercial/billing-scopes/${scope.scopeId}/payment-method`]: {
            registered: true,
            termsVersion: SUBSCRIPTION_TERMS_VERSION,
            maskedCard: '예시 카드 · **** 1234',
        },
    };
    if (config.method === 'get' && config.url && Object.hasOwn(readSamples, config.url)) data = readSamples[config.url];
    else if (config.method === 'post' && config.url === `/admin/commercial/billing-scopes/${scope.scopeId}/quotes`) {
        const request = JSON.parse(config.data) as QuoteRequest;
        const monthlyGross = plus.baseGross + Math.max(0, request.capacity - plus.includedStaff) * plus.extraStaffGross;
        const currentGross = plus.baseGross + Math.max(0, billing.customer.capacity - plus.includedStaff) * plus.extraStaffGross;
        const periodStart = Date.parse('2026-11-11T00:00:00Z');
        const periodEnd = Date.parse('2026-12-11T00:00:00Z');
        const remaining = Math.max(0, Math.min(1, (periodEnd - Date.now()) / (periodEnd - periodStart)));
        const gross =
            request.purpose === 'CAPACITY'
                ? Math.round(Math.max(0, monthlyGross - currentGross) * remaining)
                : request.purpose === 'USAGE_PACK'
                  ? request.fullPacks * plus.generatePackGross + request.partialPacks * plus.adjustPackGross
                  : monthlyGross;
        const supply = Math.round(gross / 1.1);
        quoteSequence += 1;
        data = {
            id: `preview-quote-${quoteSequence}`,
            scopeId: scope.scopeId,
            purpose: request.purpose,
            contentHash: `preview-only-${quoteSequence}`,
            status: 'OPEN',
            expiresAt: new Date(Date.now() + 3600000).toISOString(),
            snapshot: JSON.stringify({
                request,
                termsVersion: SUBSCRIPTION_TERMS_VERSION,
                totalAmount: gross,
                supplyAmount: supply,
                taxAmount: gross - supply,
                periodStart: '2026-11-11T00:00:00Z',
                periodEnd: '2026-12-11T00:00:00Z',
                fullUnits:
                    request.purpose === 'USAGE_PACK'
                        ? request.fullPacks * plus.generatePackSize
                        : request.purpose === 'SUBSCRIPTION'
                          ? 30
                          : 0,
                partialUnits:
                    request.purpose === 'USAGE_PACK'
                        ? request.partialPacks * plus.adjustPackSize
                        : request.purpose === 'SUBSCRIPTION'
                          ? 10
                          : 0,
                recurring: {monthlyGross, generate: 30, adjust: 10},
            }),
        };
    } else if (config.method === 'post' && config.url === `/admin/commercial/billing-scopes/${scope.scopeId}/requests`) {
        const request = JSON.parse(config.data);
        const sample = {
            id: `preview-request-${billing.requests.length + 1}`,
            kind: request.kind,
            status: 'OPEN',
            createdAt: new Date().toISOString(),
        };
        billing.requests.push(sample);
        data = sample;
    } else if (config.method === 'post' && config.url === `/admin/commercial/billing-scopes/${scope.scopeId}/renewal`) {
        billing.scope.cancelAtPeriodEnd = JSON.parse(config.data).cancel;
        data = {scope: {...billing.scope}};
    } else throw new Error('로컬 예시 화면에서 지원하지 않는 동작입니다.');

    return {data, status: 200, statusText: 'OK', headers: {}, config};
};
axiosInstance.defaults.adapter = async (config) => {
    if (config.method !== 'get' || !config.url?.includes('/chat/unread-count')) throw new Error('로컬 예시에서 지원하지 않는 요청입니다.');
    return {data: {wardId, unreadCount: 0}, status: 200, statusText: 'OK', headers: {}, config};
};
document.addEventListener(
    'click',
    (event) => {
        if ((event.target as HTMLElement).closest('button')?.textContent?.match(/동의하고 진행하기|카드 등록·변경/)) {
            event.preventDefault();
            event.stopPropagation();
            alert('로컬 예시입니다. 카드 등록 단계의 위치를 확인할 수 있습니다.');
        }
    },
    true,
);

function Preview() {
    const location = useLocation();

    return (
        <>
            <div className="ward-only-preview-notice">
                로컬 예시 · 병원 관리 권한 없음 · 병동 최고 관리자 · 금액과 이용량은 샘플입니다.
                <output data-preview-route>{location.pathname}</output>
            </div>
            <Routes>
                <Route path="/workspace/*" element={<LegacyWorkspaceRoute />} />
                <Route element={<MainLayout />}>
                    <Route path="/billing/*" element={<WardBillingPage />} />
                </Route>
            </Routes>
        </>
    );
}

const previewView = new URLSearchParams(location.search).get('view');
const initial =
    previewView === 'recovery'
        ? `/billing/payment-return?orderId=${recoveryOrder.id}`
        : previewView === 'billing'
          ? `/billing/${wardId}/subscription`
          : '/workspace';
createRoot(document.getElementById('root')!).render(
    <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={[initial]}>
            <Preview />
        </MemoryRouter>
    </QueryClientProvider>,
);
