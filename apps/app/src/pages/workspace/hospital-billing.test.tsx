import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import {cleanup, render, screen, waitFor, within} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type {ReactNode} from 'react';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import type * as CommercialApi from '@/features/commercial/api';
import type {Billing, Entitlement, Organization, Scope} from '@/features/commercial/api';
import {HospitalBilling} from './hospital-billing';

const mocks = vi.hoisted(() => ({get: vi.fn(), post: vi.fn()}));

vi.mock('@/features/commercial/api', async (original) => ({
    ...(await original<typeof CommercialApi>()),
    commercialGet: mocks.get,
    commercialPost: mocks.post,
}));
vi.mock('@/features/auth/model/store', () => ({default: (selector: (state: object) => unknown) => selector({accountId: 7})}));
vi.mock('@/shared/ui/channel-talk-link', () => ({
    ChannelTalkLink: ({children, className}: {children: ReactNode; className?: string}) => (
        <a className={className} href="https://ye620.channel.io">
            {children}
        </a>
    ),
}));

const scope: Scope = {type: 'HOSPITAL', ref: 'h1', scopeId: 'scope-h1', name: '서울병원', role: 'OWNER'};
const entitlement = {
    configurationReady: true,
    canManageBilling: true,
    capacity: {used: 40, purchased: 100, overLimit: false},
    scope: {periodStart: '2026-10-01T00:00:00', periodEnd: '2026-11-01T00:00:00'},
    usage: [
        {meter: 'FULL_GENERATE', remaining: 23, used: 5, reserved: 2, enforced: true},
        {meter: 'PARTIAL_ADJUST', remaining: 15, used: 3, reserved: 0, enforced: false},
    ],
} as Entitlement;
const quote = {
    capacity: 100,
    setupStaff: 40,
    startsAt: '2026-10-01T00:00:00',
    endsAt: '2027-10-01T00:00:00',
    termsRef: '계약서-2026-1001',
    paymentMode: 'POSTPAID',
};
const organization = {
    organization: {id: 'h1', name: '서울병원', adoptionStage: 'QUOTED', quoteSnapshot: JSON.stringify(quote), contractHash: 'hash-v2'},
    contractEstimate: {monthlyGross: 149000, setupGross: 249000},
} as Organization;
const billing = {
    invoices: [
        {
            id: 'invoice1',
            gross: 149000,
            allocated: 100000,
            refundedGross: 10000,
            status: 'PARTIAL',
            periodStart: '2026-10-01T00:00:00',
            periodEnd: '2026-11-01T00:00:00',
            dueAt: '2026-11-10T00:00:00',
        },
    ],
    orders: [{id: 'order1', gross: 100000, status: 'APPLIED', currency: 'KRW', appliedAt: '2026-10-21T00:00:00'}],
} as Billing;

function mount(e: Entitlement = entitlement, s: Scope = scope, seed = false) {
    const client = new QueryClient({defaultOptions: {queries: {retry: false}, mutations: {retry: false}}});

    if (seed) {
        client.setQueryData(['commercial', 7, 'HOSPITAL', 'h1', 'overview'], organization);
        client.setQueryData(['commercial', 7, 'HOSPITAL', 'h1', 'billing'], billing);
    }

    const view = render(
        <QueryClientProvider client={client}>
            <HospitalBilling scope={s} e={e} />
        </QueryClientProvider>,
    );

    return {...view, client};
}

afterEach(cleanup);
beforeEach(() => {
    vi.clearAllMocks();
    mocks.get.mockImplementation((path: string) => Promise.resolve(path.startsWith('/organizations/') ? organization : billing));
    mocks.post.mockResolvedValue({});
});

describe('hospital usage and contract', () => {
    it('shows actual usage, contracted fees and bank transfer terms without purchase controls', async () => {
        mount();
        expect(await screen.findAllByText('149,000원')).toHaveLength(2);
        expect(screen.getByText('249,000원')).toBeInTheDocument();
        expect(screen.getByText('계좌이체 · 후불')).toBeInTheDocument();
        expect(screen.getByText('23')).toBeInTheDocument();
        expect(screen.getByText('제한 해제')).toBeInTheDocument();
        expect(screen.getByText('사용 5 · 처리 중 2')).toBeInTheDocument();
        expect(screen.getByText('일부 납부')).toBeInTheDocument();
        expect(screen.getByText('환불 10,000원')).toBeInTheDocument();
        expect(screen.getByRole('link', {name: '문의하기'})).toBeInTheDocument();
        expect(screen.queryByText(/추가 구매|예상 견적 계산|정기결제 카드 등록|해지 예약|감원 예약/)).not.toBeInTheDocument();
        expect(mocks.get.mock.calls.map(([path]) => path).sort()).toEqual(['/billing-scopes/scope-h1', '/organizations/h1']);
        expect(mocks.post).not.toHaveBeenCalled();
    });

    it('keeps managers on usage without fetching or leaking cached financial information', async () => {
        mount({...entitlement, canManageBilling: false}, {...scope, role: 'MANAGER'}, true);
        expect(screen.getByRole('heading', {name: '이용 현황'})).toBeInTheDocument();
        expect(screen.queryByRole('heading', {name: '계약 정보'})).not.toBeInTheDocument();
        expect(screen.queryByRole('heading', {name: '청구·납부 내역'})).not.toBeInTheDocument();
        expect(screen.queryByText('149,000원')).not.toBeInTheDocument();
        await waitFor(() => expect(mocks.get).not.toHaveBeenCalled());
    });

    it('does not trust a billing permission flag to expose money to a manager', () => {
        mount(entitlement, {...scope, role: 'MANAGER'}, true);
        expect(screen.queryByText('149,000원')).not.toBeInTheDocument();
        expect(mocks.get).not.toHaveBeenCalled();
    });

    it('does not query contracts or billing while policy configuration is incomplete', () => {
        mount({...entitlement, configurationReady: false}, scope, true);
        expect(screen.getByText(/이용 조건을 설정 중/)).toBeInTheDocument();
        expect(screen.queryByText('149,000원')).not.toBeInTheDocument();
        expect(screen.queryByText('23')).not.toBeInTheDocument();
        expect(mocks.get).not.toHaveBeenCalled();
    });

    it('does not fetch or expose contract acceptance when the owner cannot manage billing', () => {
        mount({...entitlement, canManageBilling: false}, scope, true);
        expect(screen.queryByRole('heading', {name: '계약 정보'})).not.toBeInTheDocument();
        expect(screen.queryByRole('button', {name: '계약 조건에 동의'})).not.toBeInTheDocument();
        expect(screen.queryByText('149,000원')).not.toBeInTheDocument();
        expect(mocks.get).not.toHaveBeenCalled();
    });

    it('submits the displayed contract hash once even if the accept button is double clicked', async () => {
        let resolve: () => void = () => {};

        mocks.post.mockReturnValue(
            new Promise<void>((done) => {
                resolve = done;
            }),
        );
        mount();

        const button = await screen.findByRole('button', {name: '계약 조건에 동의'});

        await waitFor(() => expect(button).toBeEnabled());
        await userEvent.dblClick(button);
        expect(mocks.post).toHaveBeenCalledTimes(1);
        expect(mocks.post).toHaveBeenCalledWith('/organizations/h1/accept/CONTRACT', {contractHash: 'hash-v2'});
        resolve();
        expect(await screen.findByText('계약에 동의했습니다.')).toBeInTheDocument();
    });

    it('retains setup acceptance only after contract acceptance and READY stage', async () => {
        mocks.get.mockImplementation((path: string) =>
            Promise.resolve(
                path.startsWith('/organizations/')
                    ? {
                          ...organization,
                          organization: {...organization.organization, adoptionStage: 'READY', contractAcceptedAt: '2026-10-02T00:00:00'},
                      }
                    : billing,
            ),
        );
        mount();

        const button = await screen.findByRole('button', {name: '초기 세팅 확인 완료'});

        await userEvent.click(button);
        expect(mocks.post).toHaveBeenCalledWith('/organizations/h1/accept/SETUP', {contractHash: 'hash-v2'});
        expect(screen.queryByRole('button', {name: '계약 조건에 동의'})).not.toBeInTheDocument();
    });

    it.each(['{broken', '[]', 'null'])('handles malformed contract snapshot %s without crashing', async (snapshot) => {
        mocks.get.mockImplementation((path: string) =>
            Promise.resolve(
                path.startsWith('/organizations/')
                    ? {...organization, organization: {...organization.organization, quoteSnapshot: snapshot}}
                    : billing,
            ),
        );
        mount();
        expect(await screen.findByText(/계약 정보를 읽을 수 없습니다/)).toBeInTheDocument();
        expect(screen.queryByRole('button', {name: '계약 조건에 동의'})).not.toBeInTheDocument();
    });

    it('does not allow acceptance when terms or authoritative contract prices are missing', async () => {
        mocks.get.mockImplementation((path: string) =>
            Promise.resolve(
                path.startsWith('/organizations/')
                    ? {
                          ...organization,
                          contractEstimate: {},
                          organization: {...organization.organization, quoteSnapshot: JSON.stringify({...quote, startsAt: 'invalid'})},
                      }
                    : billing,
            ),
        );
        mount();
        expect(await screen.findByRole('button', {name: '계약 조건에 동의'})).toBeDisabled();
        expect(screen.getByText(/누락된 내용은 담당자에게 문의/)).toBeInTheDocument();

        const contractSection = screen.getByRole('heading', {name: '계약 정보'}).closest('section')!;

        expect(within(contractSection).queryByText('149,000원')).not.toBeInTheDocument();
    });

    it('does not render missing AI metrics as zero or unlimited', () => {
        mount({...entitlement, usage: []}, {...scope, role: 'MANAGER'});
        expect(screen.getAllByText('제공량 확인 대기')).toHaveLength(2);
        expect(screen.queryByText('제한 해제')).not.toBeInTheDocument();
        expect(screen.queryByText('0회 남음')).not.toBeInTheDocument();
    });

    it('shows empty records and retries each failing query independently', async () => {
        mocks.get.mockRejectedValue(new Error('서버 연결 실패'));
        mount();
        expect(await screen.findAllByRole('button', {name: '다시 불러오기'})).toHaveLength(2);
        mocks.get.mockImplementation((path: string) =>
            Promise.resolve(
                path.startsWith('/organizations/')
                    ? {organization: {...organization.organization, quoteSnapshot: undefined}}
                    : {invoices: [], orders: []},
            ),
        );

        const contractSection = screen.getByRole('heading', {name: '계약 정보'}).closest('section')!;
        const invoiceSection = screen.getByRole('heading', {name: '청구·납부 내역'}).closest('section')!;

        await userEvent.click(within(contractSection).getByRole('button', {name: '다시 불러오기'}));
        expect(await screen.findByText('아직 등록된 계약이 없습니다.')).toBeInTheDocument();
        expect(within(invoiceSection).getByRole('button', {name: '다시 불러오기'})).toBeInTheDocument();
        await userEvent.click(within(invoiceSection).getByRole('button', {name: '다시 불러오기'}));
        expect(await screen.findByText('아직 청구 내역이 없습니다.')).toBeInTheDocument();
    });
});
