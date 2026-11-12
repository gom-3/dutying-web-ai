import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import {act, cleanup, render, screen, waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {MemoryRouter} from 'react-router';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import type * as CommercialApi from '@/features/commercial/api';
import type {Billing, Entitlement, Quote, QuoteRequest, Scope} from '@/features/commercial/api';
import {PlusAddons} from './plus-addons';

const mocks = vi.hoisted(() => ({get: vi.fn(), post: vi.fn(), load: vi.fn(), open: vi.fn()}));

vi.mock('@/features/commercial/api', async (original) => ({
    ...(await original<typeof CommercialApi>()),
    commercialGet: mocks.get,
    commercialPost: mocks.post,
}));
vi.mock('@/features/commercial/toss-sdk', () => ({loadToss: mocks.load, openTossBilling: mocks.open}));

const scope: Scope = {type: 'WARD', ref: '11', scopeId: 'ward-addon-scope', name: '추가 이용 검증 병동', role: 'OWNER'};
const entitlement: Entitlement = {
    scope: {
        id: scope.scopeId,
        scopeType: 'WARD',
        scopeRef: scope.ref,
        customerId: 'addon-customer',
        version: 4,
        periodStart: '2026-11-01T00:00:00',
        periodEnd: '2026-12-01T00:00:00',
        cancelAtPeriodEnd: false,
    },
    billingScopeId: scope.scopeId,
    role: 'OWNER',
    plan: 'PLUS',
    entitlementSource: 'SUBSCRIPTION',
    capacity: {used: 20, purchased: 50, overLimit: false},
    adminSeats: {active: 1, reserved: 0, limit: 10},
    usage: [],
    allowedActions: [],
    canManageBilling: true,
    checkoutEnabled: true,
    promotion: null,
    policy: {
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
    },
};
const billing: Billing = {
    scope: {
        id: scope.scopeId,
        scopeType: 'WARD',
        scopeRef: scope.ref,
        customerId: 'addon-customer',
        version: 4,
        periodStart: '2026-11-01T00:00:00',
        periodEnd: '2026-12-01T00:00:00',
        cancelAtPeriodEnd: false,
    },
    customer: {name: scope.name, plan: 'PLUS', paymentMode: 'CARD', capacity: 50},
    invoices: [],
    orders: [],
    requests: [],
};

function makeQuote(request: QuoteRequest, overrides: Partial<Quote> = {}): Quote {
    return {
        id: 'addon-quote',
        scopeId: scope.scopeId,
        purpose: request.purpose,
        status: 'DRAFT',
        contentHash: 'addon-quote-hash',
        expiresAt: '2099-12-01T00:00:00',
        snapshot: JSON.stringify({
            request,
            termsVersion: 'plus-ai-fill-monthly-2026-11-12',
            totalAmount: 9900,
            supplyAmount: 9000,
            taxAmount: 900,
            recurring: {monthlyGross: 29800},
            periodStart: '2026-11-12T00:00:00',
            periodEnd: '2026-12-01T00:00:00',
            fullUnits: request.fullPacks * entitlement.policy.generatePackSize,
            partialUnits: request.partialPacks * entitlement.policy.adjustPackSize,
        }),
        ...overrides,
    };
}

async function mount(currentBilling: Billing | undefined = billing, e = entitlement) {
    const client = new QueryClient({defaultOptions: {queries: {retry: false}}});
    const element = (updatedBilling = currentBilling) => (
        <QueryClientProvider client={client}>
            <MemoryRouter>
                <PlusAddons scope={scope} entitlement={e} billing={updatedBilling} />
            </MemoryRouter>
        </QueryClientProvider>
    );
    const view = render(element());

    await userEvent.click(screen.getByText('추가 이용 문의'));

    return {...view, rerenderBilling: (updatedBilling: Billing) => view.rerender(element(updatedBilling))};
}

async function capacityQuote(capacity = '60') {
    await userEvent.type(screen.getByRole('textbox', {name: '늘린 뒤 총 근무 인원'}), capacity);
    await userEvent.click(screen.getByRole('button', {name: '증원 금액 확인'}));
}

beforeEach(() => {
    vi.clearAllMocks();
    mocks.post.mockImplementation((path: string, request: QuoteRequest) =>
        Promise.resolve(path.endsWith('/quotes') ? makeQuote(request) : {id: 'addon-request', status: 'OPEN'}),
    );
});
afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
});

describe('Plus add-on quote and inquiry', () => {
    it('starts with an empty capacity field and never opens a payment or renews consent on view', async () => {
        await mount();
        expect(screen.getByRole('radio', {name: '인원 추가'})).toBeChecked();
        expect(screen.getByRole('textbox', {name: '늘린 뒤 총 근무 인원'})).toHaveValue('');
        expect(screen.getByRole('button', {name: '증원 금액 확인'})).toBeDisabled();
        expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
        expect(mocks.post).not.toHaveBeenCalled();
        expect(mocks.load).not.toHaveBeenCalled();
        expect(mocks.open).not.toHaveBeenCalled();
    });

    it.each(['49', '50', '-1', '1.5', '1e2', '10001'])('cannot request an invalid or non-increasing capacity %s', async (value) => {
        await mount();
        await userEvent.type(screen.getByRole('textbox', {name: '늘린 뒤 총 근무 인원'}), value);
        expect(screen.getByRole('button', {name: '증원 금액 확인'})).toBeDisabled();
        expect(mocks.post).not.toHaveBeenCalled();
    });

    it('uses the current billing contract capacity instead of a stale entitlement capacity', async () => {
        await mount({...billing, customer: {...billing.customer, capacity: 60}});

        const input = screen.getByRole('textbox', {name: '늘린 뒤 총 근무 인원'});

        await userEvent.type(input, '60');
        expect(screen.getByRole('button', {name: '증원 금액 확인'})).toBeDisabled();
        await userEvent.clear(input);
        await userEvent.type(input, '65');
        await userEvent.click(screen.getByRole('button', {name: '증원 금액 확인'}));
        await screen.findByRole('button', {name: '증원 문의하기'});
        expect(mocks.post).toHaveBeenCalledExactlyOnceWith(`/billing-scopes/${scope.scopeId}/quotes`, {
            purpose: 'CAPACITY',
            plan: 'PLUS',
            capacity: 65,
            setupStaff: 0,
            fullPacks: 0,
            partialPacks: 0,
        });
        expect(mocks.load).not.toHaveBeenCalled();
        expect(mocks.open).not.toHaveBeenCalled();
    });

    it('submits a capacity inquiry only after the owner explicitly chooses it', async () => {
        await mount();
        await capacityQuote();

        const inquiry = await screen.findByRole('button', {name: '증원 문의하기'});

        expect(mocks.post).toHaveBeenCalledTimes(1);
        expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
        await userEvent.click(inquiry);
        await waitFor(() =>
            expect(mocks.post).toHaveBeenLastCalledWith(
                `/billing-scopes/${scope.scopeId}/requests`,
                expect.objectContaining({kind: 'CAPACITY', capacity: 60, description: expect.any(String), invoiceId: null}),
                expect.any(String),
            ),
        );
        expect(await screen.findByRole('button', {name: '문의 접수 완료'})).toBeDisabled();
        expect(screen.getByText('문의가 접수됐어요.')).toBeInTheDocument();
        expect(mocks.post).toHaveBeenCalledTimes(2);
        expect(mocks.load).not.toHaveBeenCalled();
        expect(mocks.open).not.toHaveBeenCalled();
    });

    it('invalidates the reviewed quote when staff input changes instead of submitting the old amount', async () => {
        await mount();
        await capacityQuote();
        await screen.findByRole('button', {name: '증원 문의하기'});
        await userEvent.clear(screen.getByRole('textbox', {name: '늘린 뒤 총 근무 인원'}));
        await userEvent.type(screen.getByRole('textbox', {name: '늘린 뒤 총 근무 인원'}), '70');
        expect(screen.queryByRole('button', {name: '증원 문의하기'})).not.toBeInTheDocument();
        expect(mocks.post).toHaveBeenCalledTimes(1);
    });

    it('ignores an in-flight quote after the current billing contract changes', async () => {
        let finish!: (quote: Quote) => void;
        let requested!: QuoteRequest;

        mocks.post.mockImplementation((_path: string, request: QuoteRequest) => {
            requested = request;

            return new Promise<Quote>((resolve) => {
                finish = resolve;
            });
        });

        const view = await mount();

        await capacityQuote();
        view.rerenderBilling({...billing, customer: {...billing.customer, capacity: 61}});
        await act(async () => finish(makeQuote(requested)));
        expect(screen.queryByRole('button', {name: '증원 문의하기'})).not.toBeInTheDocument();
        expect(mocks.post).toHaveBeenCalledTimes(1);
    });

    it.each(['scope', 'purpose', 'capacity', 'plan', 'expired', 'malformed'])(
        'rejects an unchecked %s quote before showing an inquiry action',
        async (fault) => {
            mocks.post.mockImplementation((_path: string, request: QuoteRequest) => {
                const q = makeQuote(request);
                const snapshot = JSON.parse(q.snapshot);

                if (fault === 'scope') q.scopeId = 'another-ward';

                if (fault === 'purpose') q.purpose = 'SUBSCRIPTION';

                if (fault === 'capacity') snapshot.request.capacity += 1;

                if (fault === 'plan') snapshot.request.plan = 'HOSPITAL';

                if (fault === 'expired') q.expiresAt = '2020-01-01T00:00:00';

                q.snapshot = fault === 'malformed' ? '{invalid' : JSON.stringify(snapshot);

                return Promise.resolve(q);
            });
            await mount();
            await capacityQuote();
            expect(await screen.findByRole('alert')).toBeInTheDocument();
            expect(screen.queryByRole('button', {name: '증원 문의하기'})).not.toBeInTheDocument();
            expect(mocks.post).toHaveBeenCalledTimes(1);
            expect(mocks.open).not.toHaveBeenCalled();
        },
    );

    it('uses existing pack sizes and submits an AI support inquiry without a card charge', async () => {
        await mount({...billing, customer: {...billing.customer, capacity: 60}});
        await userEvent.click(screen.getByRole('radio', {name: 'AI 채우기 추가'}));
        expect(screen.getByRole('button', {name: '추가 금액 확인'})).toBeDisabled();
        expect(screen.getByText('10회 / 묶음 · ₩2,900')).toBeInTheDocument();
        expect(screen.queryByRole('textbox', {name: '부분 조정 묶음 수'})).not.toBeInTheDocument();

        const fullPacks = screen.getByRole('textbox', {name: 'AI 채우기 묶음 수'});

        await userEvent.clear(fullPacks);
        await userEvent.type(fullPacks, '2');
        await userEvent.click(screen.getByRole('button', {name: '추가 금액 확인'}));

        const inquiry = await screen.findByRole('button', {name: '추가 횟수 문의'});

        expect(mocks.post).toHaveBeenCalledExactlyOnceWith(`/billing-scopes/${scope.scopeId}/quotes`, {
            purpose: 'USAGE_PACK',
            plan: 'PLUS',
            capacity: 60,
            setupStaff: 0,
            fullPacks: 2,
            partialPacks: 0,
        });
        await userEvent.click(inquiry);
        await waitFor(() =>
            expect(mocks.post).toHaveBeenLastCalledWith(
                `/billing-scopes/${scope.scopeId}/requests`,
                expect.objectContaining({kind: 'SUPPORT', capacity: 60, description: expect.any(String), invoiceId: null}),
                expect.any(String),
            ),
        );
        expect(mocks.post).toHaveBeenCalledTimes(2);
        expect(mocks.open).not.toHaveBeenCalled();
        expect(mocks.load).not.toHaveBeenCalled();
    });

    it('clears a capacity quote when switching to AI packs', async () => {
        await mount();
        await capacityQuote();
        await screen.findByRole('button', {name: '증원 문의하기'});
        await userEvent.click(screen.getByRole('radio', {name: 'AI 채우기 추가'}));
        expect(screen.queryByRole('button', {name: '증원 문의하기'})).not.toBeInTheDocument();
        expect(screen.queryByRole('button', {name: '추가 횟수 문의'})).not.toBeInTheDocument();
        expect(mocks.post).toHaveBeenCalledTimes(1);
    });
});
