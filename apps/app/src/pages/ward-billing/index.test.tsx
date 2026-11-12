import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import {cleanup, render, screen, waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {MemoryRouter, Route, Routes, useLocation} from 'react-router';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import type * as CommercialApi from '@/features/commercial/api';
import type {AccessContext, Entitlement, Scope} from '@/features/commercial/api';
import WardBillingPage, {LegacyWorkspaceRoute} from './index';

const mocks = vi.hoisted(() => ({
    get: vi.fn(),
    select: vi.fn(),
    refetch: vi.fn(),
    context: {enabled: true, scopes: []} as AccessContext,
    contextError: false,
    contextPending: false,
    accountId: 7,
    wardId: 11 as number | null,
    callbackMount: 0,
}));

vi.mock('@/features/commercial/api', async (original) => ({
    ...(await original<typeof CommercialApi>()),
    commercialGet: mocks.get,
    useCommercialContext: () => ({
        data: mocks.context,
        error: mocks.contextError ? new Error('권한을 다시 확인해 주세요.') : null,
        isError: mocks.contextError,
        isPending: mocks.contextPending,
        refetch: mocks.refetch,
    }),
}));
vi.mock('@/features/auth/model/store', () => ({
    default: (selector: (state: object) => unknown) => selector({accountId: mocks.accountId, wardId: mocks.wardId}),
}));
vi.mock('@/features/commercial/hospital-entry', () => ({useWorkspaceNavigation: () => mocks.select}));
vi.mock('@/pages/workspace', async () => {
    const {useRef} = await import('react');

    return {
        default: () => <p>기존 병원 관리 화면</p>,
        UsagePanel: ({scope, billingPath}: {scope: Scope; billingPath: string}) => (
            <section aria-label="병동 이용량">
                <p>{scope.name}</p>
                <a href={billingPath}>구독 신청으로</a>
            </section>
        ),
        BillingPanel: ({scope, e, paymentReturnPath}: {scope: Scope; e: Entitlement; paymentReturnPath: string}) => (
            <section aria-label="병동 구독 패널">
                <span>{scope.name}</span>
                <output aria-label="청구 권한">{e.canManageBilling ? 'owner' : 'request'}</output>
                <output aria-label="결제 결과 주소">{paymentReturnPath}</output>
            </section>
        ),
        BillingReturn: ({backPath, paymentReturnPath}: {backPath: string; paymentReturnPath: string}) => {
            const mount = useRef(++mocks.callbackMount);

            return (
                <section aria-label="첫 결제 확인">
                    <output aria-label="복귀 화면 인스턴스">{mount.current}</output>
                    <a href={backPath}>요금제로</a>
                    <a href={paymentReturnPath}>결제 결과로</a>
                </section>
            );
        },
        PaymentReturn: ({backPath}: {backPath: string}) => (
            <section aria-label="결제 결과 확인">
                <a href={backPath}>요금제로</a>
            </section>
        ),
    };
});

const ward: Scope = {type: 'WARD', ref: '11', scopeId: 'ward-11', name: '3병동', role: 'OWNER'};
const other: Scope = {...ward, ref: '12', scopeId: 'ward-12', name: '중환자실'};
const hospital: Scope = {type: 'HOSPITAL', ref: 'h1', scopeId: 'hospital-h1', name: '서울병원', role: 'OWNER'};
const entitlement = {plan: 'FREE', canManageBilling: true, scope: {version: 1}} as Entitlement;

function LocationProbe() {
    const location = useLocation();

    return <output aria-label="현재 경로">{location.pathname + location.search}</output>;
}

function mount(path: string, seed = false) {
    const client = new QueryClient({defaultOptions: {queries: {retry: false}}});

    if (seed) client.setQueryData(['commercial', 7, 'WARD', '11', 'entitlements'], entitlement);

    const element = () => (
        <QueryClientProvider client={client}>
            <MemoryRouter initialEntries={[path]}>
                <Routes>
                    <Route path="/workspace/*" element={<LegacyWorkspaceRoute />} />
                    <Route path="/billing/*" element={<WardBillingPage />} />
                </Routes>
                <LocationProbe />
            </MemoryRouter>
        </QueryClientProvider>
    );
    const view = render(element());

    return {...view, refresh: () => view.rerender(element())};
}

beforeEach(() => {
    vi.clearAllMocks();
    mocks.accountId = 7;
    mocks.wardId = 11;
    mocks.contextError = false;
    mocks.contextPending = false;
    mocks.callbackMount = 0;
    mocks.context = {enabled: true, configurationReady: true, scopes: [ward], cardRegistrationVersion: 2};
    mocks.get.mockResolvedValue(entitlement);
    mocks.select.mockResolvedValue(undefined);
    mocks.refetch.mockResolvedValue({});
});
afterEach(cleanup);

describe('main-site ward billing routing', () => {
    it.each([
        ['/workspace/WARD/11/billing', '/billing/11/subscription'],
        ['/workspace/WARD/11/usage', '/billing/11/usage'],
        ['/workspace/WARD/11', '/billing/11/usage'],
        ['/workspace', '/billing/11/usage'],
    ])('moves the legacy ward entry %s into %s', async (from, to) => {
        mount(from);
        await waitFor(() => expect(screen.getByLabelText('현재 경로')).toHaveTextContent(to));
        expect(screen.queryByText('기존 병원 관리 화면')).not.toBeInTheDocument();
    });

    it.each(['billing-return', 'payment-return'] as const)('keeps the provider %s alias and its safe order reference', async (kind) => {
        mount(`/workspace/${kind}?orderId=order-1`);
        await waitFor(() => expect(screen.getByLabelText('현재 경로')).toHaveTextContent(`/billing/${kind}?orderId=order-1`));
        expect(screen.getByRole('link', {name: '요금제로'})).toHaveAttribute('href', '/billing');
    });

    it('preserves hospital management and the deliberate add-or-join chooser', () => {
        const view = mount('/workspace/HOSPITAL/h1/billing');

        expect(screen.getByText('기존 병원 관리 화면')).toBeInTheDocument();
        expect(screen.getByLabelText('현재 경로')).toHaveTextContent('/workspace/HOSPITAL/h1/billing');
        view.unmount();
        mount('/workspace?choose=1');
        expect(screen.getByText('기존 병원 관리 화면')).toBeInTheDocument();
        expect(screen.getByLabelText('현재 경로')).toHaveTextContent('/workspace?choose=1');
    });

    it('resolves the current ward and keeps usage and subscription links inside the main site', async () => {
        mocks.context.scopes = [hospital, other, ward];
        mount('/billing');
        expect(await screen.findByRole('region', {name: '병동 구독 패널'})).toBeInTheDocument();
        expect(screen.getByLabelText('현재 경로')).toHaveTextContent('/billing/11/subscription');
        expect(screen.getByRole('link', {name: '이용 현황'})).toHaveAttribute('href', '/billing/11/usage');
        expect(screen.getByLabelText('결제 결과 주소')).toHaveTextContent('/billing/payment-return');
        await userEvent.click(screen.getByRole('link', {name: '이용 현황'}));
        expect(await screen.findByRole('region', {name: '병동 이용량'})).toBeInTheDocument();
        expect(screen.getByRole('link', {name: '구독 신청으로'})).toHaveAttribute('href', '/billing/11/subscription');
        expect(screen.queryByText('기존 병원 관리 화면')).not.toBeInTheDocument();
    });

    it('requires a ward switch before reading another ward’s financial information', async () => {
        mocks.context.scopes = [ward, other];
        mount('/billing/12/subscription');
        expect(screen.getByRole('button', {name: '이 병동으로 전환'})).toBeInTheDocument();
        expect(screen.queryByRole('region', {name: '병동 구독 패널'})).not.toBeInTheDocument();
        expect(mocks.get).not.toHaveBeenCalled();
        await userEvent.click(screen.getByRole('button', {name: '이 병동으로 전환'}));
        expect(mocks.select).toHaveBeenCalledExactlyOnceWith(other, false, '/billing/12/subscription');
    });

    it('passes the server’s restricted billing entitlement through for a ward editor', async () => {
        mocks.context.scopes = [{...ward, role: 'EDITOR'}];
        mocks.get.mockResolvedValue({...entitlement, canManageBilling: false});
        mount('/billing/11/subscription');
        expect(await screen.findByLabelText('청구 권한')).toHaveTextContent('request');
    });

    it('hides cached financial details when access-context validation fails', () => {
        mocks.contextError = true;
        mount('/billing/11/subscription', true);
        expect(screen.queryByRole('region', {name: '병동 구독 패널'})).not.toBeInTheDocument();
        expect(screen.getByRole('button', {name: '다시 불러오기'})).toBeInTheDocument();
        expect(mocks.get).not.toHaveBeenCalled();
    });

    it('offers an in-site ward choice for an inaccessible requested ward', () => {
        mount('/billing/999/subscription');
        expect(screen.getByText('요청한 병동의 관리 권한을 확인할 수 없어요.')).toBeInTheDocument();
        expect(screen.getByRole('link', {name: '3병동'})).toHaveAttribute('href', '/billing/11/subscription');
        expect(screen.queryByRole('region', {name: '병동 구독 패널'})).not.toBeInTheDocument();
        expect(mocks.get).not.toHaveBeenCalled();
    });

    it('preserves order recovery without a current ward and remounts callback state on account changes', () => {
        mocks.wardId = null;
        mocks.context = {enabled: false, scopes: []};

        const view = mount('/billing/billing-return?orderId=order-1');
        const instance = screen.getByLabelText('복귀 화면 인스턴스').textContent;

        expect(screen.getByRole('region', {name: '첫 결제 확인'})).toBeInTheDocument();
        expect(screen.getByRole('link', {name: '결제 결과로'})).toHaveAttribute('href', '/billing/payment-return');
        mocks.accountId = 8;
        view.refresh();
        expect(screen.getByLabelText('복귀 화면 인스턴스').textContent).not.toBe(instance);
        expect(mocks.get).not.toHaveBeenCalled();
    });
});
