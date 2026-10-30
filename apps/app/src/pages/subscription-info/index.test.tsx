import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import {cleanup, fireEvent, render, screen} from '@testing-library/react';
import {MemoryRouter} from 'react-router';
import {afterEach, describe, expect, it, vi} from 'vitest';
import SubscriptionInfoPage from './index';

const offer = {
    plan: 'PLUS',
    currency: 'KRW',
    baseGross: 19900,
    includedStaff: 50,
    extraStaffGross: 990,
    generate: 30,
    adjust: 10,
    adminSeats: 10,
    maxChargeGross: 1000000,
    termsVersion: 'plus-monthly-2026-10-11',
    priceVersion: 'test-policy',
    ready: true,
};

function page(path = '/pricing') {
    return render(
        <QueryClientProvider client={new QueryClient({defaultOptions: {queries: {retry: false}}})}>
            <MemoryRouter initialEntries={[path]}>
                <SubscriptionInfoPage />
            </MemoryRouter>
        </QueryClientProvider>,
    );
}

afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
});
describe('public Plus review pages', () => {
    it('uses server prices and enforces the tax-inclusive card limit', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ok: true, json: async () => offer}));
        page();
        expect(await screen.findByText('월 19,900원')).toBeInTheDocument();
        fireEvent.change(screen.getByRole('spinbutton'), {target: {value: '1040'}});
        expect(screen.getByText('예상 월 이용료 1,000,000원')).toBeInTheDocument();
        expect(screen.getByRole('link', {name: '로그인하고 Plus 신청'})).toBeInTheDocument();
        fireEvent.change(screen.getByRole('spinbutton'), {target: {value: '1041'}});
        expect(screen.queryByRole('link', {name: '로그인하고 Plus 신청'})).not.toBeInTheDocument();
        expect(screen.getByText('카드 결제 상한을 초과합니다. 고객센터로 문의해 주세요.')).toBeInTheDocument();
    });
    it('does not advertise a payable price when the server cannot confirm it', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ok: false}));
        page();
        expect(await screen.findByText('현재 요금 정보를 불러올 수 없습니다.')).toBeInTheDocument();
        expect(screen.queryByRole('link', {name: '로그인하고 Plus 신청'})).not.toBeInTheDocument();
    });
    it('keeps the page and seller information visible while the commercial feature is disabled', async () => {
        vi.stubGlobal(
            'fetch',
            vi.fn().mockResolvedValue({
                ok: true,
                json: async () => ({
                    ready: false,
                    code: 'COMMERCIAL_NOT_ENABLED',
                    message: '요금제 기능을 준비하고 있습니다.',
                }),
            }),
        );
        page();
        expect(await screen.findByText('요금제 기능을 준비하고 있습니다.')).toBeInTheDocument();
        expect(screen.getByText('사업자등록번호: 319-05-02789')).toBeInTheDocument();
        expect(screen.queryByRole('spinbutton')).not.toBeInTheDocument();
        expect(screen.queryByRole('link', {name: '로그인하고 Plus 신청'})).not.toBeInTheDocument();
    });
    it.each([{}, null, {...offer, baseGross: undefined}, {...offer, baseGross: '19900'}, {...offer, currency: 'USD'}])(
        'does not display a price or enable checkout for an invalid successful response: %j',
        async (body) => {
            vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ok: true, json: async () => body}));
            page();
            expect(await screen.findByText('현재 요금 정보를 불러올 수 없습니다.')).toBeInTheDocument();
            expect(screen.queryByRole('spinbutton')).not.toBeInTheDocument();
            expect(screen.queryByRole('link', {name: '로그인하고 Plus 신청'})).not.toBeInTheDocument();
        },
    );
    it('shows a valid unpublished offer without opening checkout', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ok: true, json: async () => ({...offer, ready: false})}));
        page();
        expect(await screen.findByText('월 19,900원')).toBeInTheDocument();
        expect(screen.getByText('온라인 구독 신청을 준비하고 있습니다.')).toBeInTheDocument();
        expect(screen.queryByRole('link', {name: '로그인하고 Plus 신청'})).not.toBeInTheDocument();
    });
    it('uses the published included staff as its starting capacity', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ok: true, json: async () => ({...offer, includedStaff: 100, baseGross: 35000})}));
        page();
        expect(await screen.findByText('월 35,000원')).toBeInTheDocument();
        expect(screen.getByRole('spinbutton')).toHaveValue(100);
        expect(screen.getByText('예상 월 이용료 35,000원')).toBeInTheDocument();
        expect(screen.getByRole('link', {name: '로그인하고 Plus 신청'})).toBeInTheDocument();
    });
    it.each(['', '0', '49', '50.5', '10001'])('does not permit an invalid scheduling capacity %s', async (capacity) => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ok: true, json: async () => offer}));
        page();
        await screen.findByText('월 19,900원');
        fireEvent.change(screen.getByRole('spinbutton'), {target: {value: capacity}});
        expect(screen.getByRole('spinbutton')).toHaveAttribute('aria-invalid', 'true');
        expect(screen.queryByRole('link', {name: '로그인하고 Plus 신청'})).not.toBeInTheDocument();
        expect(screen.getByText('50명 이상 10,000명 이하의 정수로 입력해 주세요.')).toBeInTheDocument();
    });
    it('treats an unset price policy as preparation without inventing a price', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ok: true, json: async () => ({ready: false, code: 'POLICY_NOT_CONFIGURED'})}));
        page();
        expect(await screen.findByText('요금제 기능을 준비하고 있습니다.')).toBeInTheDocument();
        expect(screen.queryByRole('spinbutton')).not.toBeInTheDocument();
        expect(screen.getByRole('img', {name: '듀팅의 AI 근무표 편성 서비스 소개 이미지'})).toBeInTheDocument();
    });
    it.each(['SALES_INFORMATION_NOT_READY', 'PAYMENT_NOT_CONFIGURED'])(
        'continues to disclose confirmed prices while checkout awaits %s',
        async (code) => {
            vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ok: true, json: async () => ({...offer, ready: false, code})}));
            page();
            expect(await screen.findByText('월 19,900원')).toBeInTheDocument();
            expect(screen.getByText('온라인 구독 신청을 준비하고 있습니다.')).toBeInTheDocument();
            expect(screen.queryByRole('link', {name: '로그인하고 Plus 신청'})).not.toBeInTheDocument();
        },
    );
    it('publishes the approved refund terms and seller identity without requiring login', () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ok: false}));
        page('/refund');
        expect(screen.getByText(/결제 후 7일 이내/)).toBeInTheDocument();
        expect(screen.getByText(/AI 사용분을 별도로 추가 공제하지/)).toBeInTheDocument();
        expect(screen.getByText('사업자등록번호: 319-05-02789')).toBeInTheDocument();
        expect(screen.getByText(/대전광역시 중구 태평로 55/)).toBeInTheDocument();
    });
});
