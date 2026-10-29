import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import {cleanup, render, screen, within} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {MemoryRouter} from 'react-router';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import type * as CommercialApi from '@/features/commercial/api';
import type {Order} from '@/features/commercial/api';
import {Receipts} from './workspace-receipts';

const mocks = vi.hoisted(() => ({get: vi.fn(), accountId: 7 as number | null}));

vi.mock('@/features/commercial/api', async (original) => ({...(await original<typeof CommercialApi>()), commercialGet: mocks.get}));
vi.mock('@/features/auth/model/store', () => ({default: (select: (state: object) => unknown) => select({accountId: mocks.accountId})}));

const order = (overrides: Partial<Order> & {createdAt?: string} = {}): Order & {createdAt?: string} => ({
    id: 'paid-order',
    scopeId: 'ward-scope',
    invoiceId: 'invoice',
    status: 'APPLIED',
    gross: 23700,
    currency: 'KRW',
    verifiedAt: '2026-10-22T00:30:00',
    ...overrides,
});

function tree(client: QueryClient) {
    return (
        <QueryClientProvider client={client}>
            <MemoryRouter>
                <Receipts />
            </MemoryRouter>
        </QueryClientProvider>
    );
}

function mount() {
    const client = new QueryClient({defaultOptions: {queries: {retry: false}}});

    return {client, ...render(tree(client))};
}

afterEach(cleanup);
beforeEach(() => {
    vi.clearAllMocks();
    mocks.accountId = 7;
    mocks.get.mockResolvedValue([order()]);
});

describe('workspace receipts', () => {
    it('shows the payer amount, Korean payment status, Seoul payment time and detail route', async () => {
        const {client} = mount();
        const list = await screen.findByRole('list', {name: '결제 목록'});

        expect(within(list).getByText('₩23,700')).toBeInTheDocument();
        expect(within(list).getByText('결제 완료')).toBeInTheDocument();
        expect(within(list).getByText(/09:30/)).toBeInTheDocument();
        expect(within(list).getByRole('link', {name: /결제 내역 상세 보기/})).toHaveAttribute(
            'href',
            '/workspace/payment-return?orderId=paid-order',
        );
        expect(client.getQueryData(['commercial', 7, 'receipts'])).toEqual([order()]);
        expect(mocks.get).toHaveBeenCalledExactlyOnceWith('/receipts');
    });
    it.each([
        ['AWAITING_PAYMENT', '결제 대기'],
        ['PROCESSING', '결제 처리 중'],
        ['UNKNOWN', '결제 확인 중'],
        ['PAID_PENDING_APPLICATION', '결제 완료 · 적용 대기'],
        ['FAILED', '결제 실패'],
        ['CANCELED', '결제 취소'],
        ['EXPIRED', '결제 기한 만료'],
    ])('translates server order status %s accurately', async (status, label) => {
        mocks.get.mockResolvedValue([order({status})]);
        mount();
        expect(await screen.findByText(label)).toBeInTheDocument();
        expect(screen.queryByText(status)).not.toBeInTheDocument();
    });
    it.each(['FUTURE_PROVIDER_STATE', 'constructor', 'toString'])(
        'uses a safe fallback for unknown status %s and malformed dates or amounts',
        async (status) => {
            mocks.get.mockResolvedValue([order({status, verifiedAt: 'invalid', gross: Number.NaN})]);
            mount();
            expect(await screen.findByText('상태 확인 필요')).toBeInTheDocument();
            expect(screen.getByText('일자 확인 중')).toBeInTheDocument();
            expect(screen.getByText('금액 확인 필요')).toBeInTheDocument();
            expect(screen.queryByText(status)).not.toBeInTheDocument();
            expect(screen.queryByText('₩0')).not.toBeInTheDocument();
        },
    );
    it('labels an unpaid order timestamp as a request date and respects its currency', async () => {
        mocks.get.mockResolvedValue([
            order({status: 'AWAITING_PAYMENT', verifiedAt: undefined, createdAt: '2026-10-21T15:10:00Z', currency: 'USD', gross: 19.9}),
        ]);
        mount();

        const list = await screen.findByRole('list', {name: '결제 목록'});

        expect(within(list).getByText('요청일')).toBeInTheDocument();
        expect(within(list).getByText('US$19.90')).toBeInTheDocument();
        expect(within(list).queryByText('결제일')).not.toBeInTheDocument();
    });
    it('shows loading and then a useful empty state without a blank ledger', async () => {
        let resolve!: (orders: Order[]) => void;

        mocks.get.mockReturnValue(
            new Promise<Order[]>((next) => {
                resolve = next;
            }),
        );
        mount();
        expect(screen.getByRole('status')).toHaveTextContent('결제 내역을 불러오는 중');
        expect(screen.queryByText('아직 결제 내역이 없습니다')).not.toBeInTheDocument();
        resolve([]);
        expect(await screen.findByText('아직 결제 내역이 없습니다')).toBeInTheDocument();
        expect(screen.getByRole('link', {name: '요금제 살펴보기'})).toHaveAttribute('href', '/workspace/plans');
    });
    it('retries a failed read and clears the error after success', async () => {
        mocks.get.mockRejectedValueOnce(new Error('결제 조회에 실패했습니다.'));
        mount();
        expect(await screen.findByRole('alert')).toHaveTextContent('결제 조회에 실패했습니다.');
        await userEvent.click(screen.getByRole('button', {name: '다시 불러오기'}));
        expect(await screen.findByText('결제 완료')).toBeInTheDocument();
        expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });
    it('does not expose a previous account’s receipts while the next account loads', async () => {
        const view = mount();

        await screen.findByText('₩23,700');
        mocks.accountId = 8;
        mocks.get.mockReturnValue(new Promise(() => {}));
        view.rerender(tree(view.client));
        expect(screen.queryByText('₩23,700')).not.toBeInTheDocument();
        expect(screen.getByRole('status')).toHaveTextContent('결제 내역을 불러오는 중');
        expect(view.client.getQueryState(['commercial', 8, 'receipts'])).toBeDefined();
    });
    it('does not fetch receipts before account authentication has resolved', () => {
        mocks.accountId = null;
        mount();
        expect(mocks.get).not.toHaveBeenCalled();
        expect(screen.getByRole('status')).toHaveTextContent('로그인 정보를 확인');
    });
});
