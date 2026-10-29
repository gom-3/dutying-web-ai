import {focusManager, QueryClient, QueryClientProvider} from '@tanstack/react-query';
import {act, cleanup, render, screen, within} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type {ReactNode} from 'react';
import {MemoryRouter} from 'react-router';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import type * as CommercialApi from '@/features/commercial/api';
import type {Policy} from '@/features/commercial/api';
import {Plans} from './workspace-plans';

const mocks = vi.hoisted(() => ({get: vi.fn(), accountId: 7 as number | null, hospitalAccess: false}));

vi.mock('@/features/commercial/api', async (original) => ({...(await original<typeof CommercialApi>()), commercialGet: mocks.get}));
vi.mock('@/features/auth/model/store', () => ({default: (select: (state: object) => unknown) => select({accountId: mocks.accountId})}));
vi.mock('@/features/commercial/hospital-entry', () => ({
    HospitalEntry: () => (mocks.hospitalAccess ? <button type="button">병원으로 들어가기</button> : null),
}));
vi.mock('@/shared/ui/channel-talk-link', () => ({
    ChannelTalkLink: ({children, className}: {children: ReactNode; className?: string}) => (
        <a href="https://ye620.channel.io" className={className}>
            {children}
        </a>
    ),
}));

const policy = (plan: string, overrides: Partial<Policy> = {}): Policy => ({
    plan,
    baseGross: plan === 'FREE' ? 0 : plan === 'PLUS' ? 23700 : 56000,
    includedStaff: plan === 'FREE' ? 27 : 48,
    extraStaffGross: 970,
    generate: plan === 'FREE' ? 4 : 37,
    adjust: plan === 'FREE' ? 2 : 12,
    adminSeats: 8,
    generatePackSize: 10,
    generatePackGross: 3000,
    adjustPackSize: 5,
    adjustPackGross: 1500,
    validityDays: 365,
    setupBase: 250000,
    setupExtra: 2000,
    features: {REQUEST_CREATE: plan !== 'FREE', BOARD_CREATE: false, HOSPITAL_OVERVIEW: plan === 'HOSPITAL'},
    ...overrides,
});
const catalog = ['HOSPITAL', 'FREE', 'PLUS'].map((plan) => ({id: plan, config: policy(plan)}));

function mount(client = new QueryClient({defaultOptions: {queries: {retry: false}}})) {
    return {
        client,
        ...render(
            <QueryClientProvider client={client}>
                <MemoryRouter>
                    <Plans />
                </MemoryRouter>
            </QueryClientProvider>,
        ),
    };
}

afterEach(() => {
    cleanup();
    focusManager.setFocused(undefined);
});
beforeEach(() => {
    vi.clearAllMocks();
    mocks.accountId = 7;
    mocks.hospitalAccess = false;
    mocks.get.mockResolvedValue(catalog);
});

describe('workspace plans', () => {
    it('uses real server amounts and allowances in a consistent Free, Plus, Hospital order', async () => {
        const {client} = mount();

        expect(await screen.findByText('23,700원')).toBeInTheDocument();
        expect(screen.getByText('56,000원')).toBeInTheDocument();

        const articles = screen.getAllByRole('article');

        expect(articles.map((article) => article.querySelector('h3')?.textContent)).toEqual(['무료', 'Plus', '병원']);
        expect(within(articles[0]).getByText('27명')).toBeInTheDocument();
        expect(within(articles[0]).getByText('처음 한 번 제공')).toBeInTheDocument();
        expect(within(articles[1]).getByText('37회')).toBeInTheDocument();
        expect(within(articles[1]).getByText('12회')).toBeInTheDocument();
        expect(mocks.get).toHaveBeenCalledExactlyOnceWith('/plans');
        expect(client.getQueryData(['commercial', 7, 'plans'])).toEqual(catalog);
        expect(screen.getByRole('link', {name: 'Plus 사용할 병동 선택'})).toHaveAttribute('href', '/workspace');
    });
    it('does not invent zero prices while the catalogue is loading', () => {
        mocks.get.mockReturnValue(new Promise(() => {}));
        mount();
        expect(screen.getByRole('status')).toHaveTextContent('요금제를 불러오는 중');
        expect(screen.queryByRole('article')).not.toBeInTheDocument();
        expect(screen.queryByText('0원')).not.toBeInTheDocument();
    });
    it('shows the administrator’s custom plan name as text and localizes canonical names', async () => {
        const customName = '간호팀 Plus <img src=x onerror=alert(1)>';

        mocks.get.mockResolvedValue(
            catalog.map((entry) => ({...entry, displayName: entry.id === 'PLUS' ? customName : entry.id === 'FREE' ? 'Free' : 'Hospital'})),
        );
        mount();
        await screen.findByText('23,700원');

        const articles = screen.getAllByRole('article');

        expect(articles.map((article) => article.querySelector('h3')?.textContent)).toEqual(['무료', customName, '병원']);
        expect(articles[1].querySelector('img')).toBeNull();
        await userEvent.click(screen.getByText('세부 기능 비교'));
        expect(screen.getByRole('region', {name: `${customName} 세부 기능`})).toBeInTheDocument();
    });
    it('recovers a failed read through an explicit retry', async () => {
        mocks.get.mockRejectedValueOnce(new Error('정책 조회에 실패했습니다.'));
        mount();
        expect(await screen.findByRole('alert')).toHaveTextContent('정책 조회에 실패했습니다.');
        await userEvent.click(screen.getByRole('button', {name: '다시 불러오기'}));
        expect(await screen.findByText('23,700원')).toBeInTheDocument();
        expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });
    it('handles an empty catalogue without fabricated plan cards', async () => {
        mocks.get.mockResolvedValue([]);
        mount();
        expect(await screen.findByText('현재 안내할 요금제가 없습니다')).toBeInTheDocument();
        expect(screen.queryByRole('article')).not.toBeInTheDocument();
        expect(screen.getByRole('button', {name: '다시 확인하기'})).toBeEnabled();
    });
    it('shows published plans while an individual policy is still being configured', async () => {
        mocks.get.mockResolvedValue([
            {id: 'free-policy', plan: 'FREE', config: policy('FREE'), configured: true, source: 'POLICY'},
            {id: 'plus-policy', plan: 'PLUS', config: null, configured: false, source: 'UNCONFIGURED'},
            {id: 'hospital-policy', plan: 'HOSPITAL', config: policy('HOSPITAL'), configured: true, source: 'POLICY'},
        ]);
        mount();
        await screen.findByText('56,000원');

        const articles = screen.getAllByRole('article');
        const plus = within(articles[1]);

        expect(articles.map((article) => article.querySelector('h3')?.textContent)).toEqual(['무료', 'Plus', '병원']);
        expect(plus.getByText('요금제 설정 중')).toBeInTheDocument();
        expect(plus.queryByText(/원$/)).not.toBeInTheDocument();
        expect(plus.queryByRole('link')).not.toBeInTheDocument();
        expect(screen.getByRole('link', {name: '병원 도입 문의'})).toBeInTheDocument();
        await userEvent.click(screen.getByText('세부 기능 비교'));
        expect(screen.queryByRole('region', {name: 'Plus 세부 기능'})).not.toBeInTheDocument();
        expect(screen.getByRole('region', {name: '무료 세부 기능'})).toBeInTheDocument();
    });
    it('does not invent values or actions for missing catalogue entries', async () => {
        mocks.get.mockResolvedValue([{id: 'plus-policy', config: policy('PLUS')}]);
        mount();
        await screen.findByText('23,700원');
        expect(screen.getAllByText('요금제 설정 중')).toHaveLength(2);
        expect(screen.queryByText('0원')).not.toBeInTheDocument();
        expect(screen.queryByText('56,000원')).not.toBeInTheDocument();
        expect(screen.queryByRole('link', {name: '병원 도입 문의'})).not.toBeInTheDocument();
        expect(screen.getByRole('link', {name: 'Plus 사용할 병동 선택'})).toBeInTheDocument();
    });
    it('does not offer an unpublished configuration even when reference values are present', async () => {
        mocks.get.mockResolvedValue([
            {id: 'PLUS', plan: 'PLUS', config: policy('PLUS'), configured: false, source: 'LEGACY'},
            {id: 'HOSPITAL', plan: 'HOSPITAL', config: null, configured: false, source: 'UNCONFIGURED'},
        ]);
        mount();
        expect(await screen.findAllByText('요금제 설정 중')).toHaveLength(3);
        expect(screen.queryByText('23,700원')).not.toBeInTheDocument();
        expect(screen.queryByRole('link')).not.toBeInTheDocument();
        expect(screen.queryByText('세부 기능 비교')).not.toBeInTheDocument();
    });
    it('reloads policies when the user returns after an administrator updates them', async () => {
        mount();
        await screen.findByText('23,700원');
        mocks.get.mockResolvedValue(
            catalog.map((entry) => (entry.id === 'PLUS' ? {...entry, config: policy('PLUS', {baseGross: 29900})} : entry)),
        );

        await act(async () => {
            focusManager.setFocused(false);
            focusManager.setFocused(true);
        });

        expect(await screen.findByText('29,900원')).toBeInTheDocument();
        expect(screen.queryByText('23,700원')).not.toBeInTheDocument();
        expect(mocks.get).toHaveBeenCalledTimes(2);
    });
    it('keeps detailed comparisons collapsed and respects separate server feature flags', async () => {
        mount();
        await screen.findByText('23,700원');

        const summary = screen.getByText('세부 기능 비교');
        const details = summary.closest('details')!;

        expect(details).not.toHaveAttribute('open');
        await userEvent.click(summary);
        expect(details).toHaveAttribute('open');

        const plus = screen.getByRole('region', {name: 'Plus 세부 기능'});

        expect(within(plus).getByText('새 신청 작성').closest('div')).toHaveTextContent('포함');
        expect(within(plus).getByText('새 게시글 작성').closest('div')).toHaveTextContent('기존 자료 유지');
        expect(within(plus).getByText('추가 편성 인원 1명 / 월').closest('div')).toHaveTextContent('970원');
    });
    it('keeps hospital access separate from the adoption consultation action', async () => {
        mocks.hospitalAccess = true;
        mount();
        await screen.findByText('56,000원');
        expect(screen.queryByRole('button', {name: '병원으로 들어가기'})).not.toBeInTheDocument();
        expect(screen.getByRole('link', {name: '병원 도입 문의'})).toHaveAttribute('href', 'https://ye620.channel.io');
        expect(screen.queryByRole('link', {name: '병원 관리 공간 만들기'})).not.toBeInTheDocument();
    });
    it('does not request account-scoped data before the account is known', () => {
        mocks.accountId = null;
        mount();
        expect(screen.getByRole('status')).toHaveTextContent('로그인 정보를 확인');
        expect(mocks.get).not.toHaveBeenCalled();
    });
});
