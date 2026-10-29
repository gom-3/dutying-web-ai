import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import {cleanup, render, screen, waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import type {WardLink} from '@/features/commercial/api';
import {WardLinksPanel} from './ward-links-panel';

const mocks = vi.hoisted(() => ({get: vi.fn(), post: vi.fn(), links: [] as WardLink[], canReview: true}));

vi.mock('@/features/commercial/api', async (original) => ({...(await original()), commercialGet: mocks.get, commercialPost: mocks.post}));
vi.mock('@/features/commercial/ward-links', async (original) => ({
    ...(await original()),
    useWardHospitalLinks: () => ({data: mocks.links, canReview: mocks.canReview, isPending: false, refetch: vi.fn()}),
}));
vi.mock('@/features/auth/model/store', () => ({default: (selector: (s: object) => unknown) => selector({accountId: 7})}));

const link: WardLink = {
    id: 'link-1',
    organizationId: 'h1',
    hospitalName: '서울병원',
    wardId: 11,
    status: 'REQUESTED',
    version: 3,
    canDecline: true,
};
const mount = () =>
    render(
        <QueryClientProvider client={new QueryClient({defaultOptions: {queries: {retry: false}}})}>
            <WardLinksPanel scope={{type: 'WARD', ref: '11', scopeId: 's1', name: '중환자실', role: 'OWNER'}} />
        </QueryClientProvider>,
    );

afterEach(cleanup);
beforeEach(() => {
    vi.clearAllMocks();
    mocks.links = [{...link}];
    mocks.canReview = true;
    mocks.post.mockResolvedValue({});
    mocks.get.mockResolvedValue({
        hospitalName: '서울병원',
        ready: true,
        contractHash: 'hash-v2',
        capacity: 100,
        monthlyGross: 49000,
        setupGross: 10000,
        startsAt: '2026-10-01',
        endsAt: '2027-10-01',
        termsRef: 'terms-v1',
    });
});
describe('ward hospital link review', () => {
    it.each(['ACTIVE', 'MANAGED', 'DETACH_PENDING', 'MANAGED_DETACH_PENDING'])(
        'does not expose a ward disconnection action for %s',
        (status) => {
            mocks.links = [{...link, status, operationallyConnected: true, wardDetachConsent: false}];
            mount();
            expect(screen.queryByRole('button', {name: /해제|disconn/i})).not.toBeInTheDocument();
            expect(screen.queryByRole('button', {name: '연결 요청 거절'})).not.toBeInTheDocument();
            expect(mocks.post).not.toHaveBeenCalled();
        },
    );
    it.each(['DETACH_PENDING', 'MANAGED_DETACH_PENDING'])(
        'keeps a legacy %s state informational even without an operational projection',
        (status) => {
            mocks.links = [{...link, status, operationallyConnected: false, canDecline: true}];
            mount();
            expect(screen.getByText('연결 해제는 병원 최고 관리자가 처리합니다.')).toBeInTheDocument();
            expect(screen.queryByRole('button')).not.toBeInTheDocument();
            expect(screen.queryByText(/양쪽|해제 동의/)).not.toBeInTheDocument();
        },
    );
    it('keeps hospital-created wards operational while presenting separate billing terms', async () => {
        mocks.links = [{...link, status: 'QUOTED', operationallyConnected: true, canDecline: false, contractHash: 'hash-v2'}];
        mount();
        expect(screen.getByText(/이 병동은 병원 소속으로 운영 중입니다/)).toBeInTheDocument();
        expect(screen.getByText(/병원 최고 관리자는 명단·근무표를 관리할 수 있으며, 일반 관리자는 담당 병동 권한/)).toBeInTheDocument();
        expect(screen.queryByRole('button', {name: '병원 연결 해제 요청'})).not.toBeInTheDocument();
        expect(screen.queryByRole('button', {name: '연결 요청 거절'})).not.toBeInTheDocument();
        await userEvent.click(screen.getByText('계약 연결 조건 확인'));
        expect(await screen.findByText('₩49,000')).toBeInTheDocument();
    });
    it('explains current sharing and requires explicit consent without loading contract per row', async () => {
        mount();
        expect(screen.getByText('지금 공유할 정보')).toBeInTheDocument();
        expect(screen.getByText('병동 이름, 활성 편성 인원 수')).toBeInTheDocument();
        expect(screen.getByText(/이 동의로 수정 권한이 생기지/)).toBeInTheDocument();
        expect(screen.queryByText('견적용 정보 공유 동의')).not.toBeInTheDocument();

        const button = screen.getByRole('button', {name: '동의하고 연결 진행'});

        expect(button).toBeDisabled();
        await userEvent.click(screen.getByRole('checkbox'));
        await userEvent.click(button);
        await waitFor(() => expect(mocks.post).toHaveBeenCalledWith('/ward-links/link-1/decision', {expectedVersion: 3, action: 'SHARE'}));
        expect(await screen.findByRole('status')).toHaveTextContent('병원 연결은 준비 중');
        expect(mocks.get).not.toHaveBeenCalled();
    });
    it('confirms a decline and sends the current version', async () => {
        mount();
        await userEvent.click(screen.getByRole('button', {name: '연결 요청 거절'}));
        expect(mocks.post).not.toHaveBeenCalled();
        await userEvent.click(screen.getByRole('button', {name: '거절 확인'}));
        await waitFor(() =>
            expect(mocks.post).toHaveBeenCalledWith('/ward-links/link-1/decision', {expectedVersion: 3, action: 'DECLINE'}),
        );
    });
    it('hides decline on older servers and keeps already-shared information distinct from active connection', () => {
        mocks.links = [{...link, canDecline: undefined, status: 'SHARED'}];
        mount();
        expect(screen.queryByRole('button', {name: '연결 요청 거절'})).not.toBeInTheDocument();
        expect(screen.getByText(/아직 연결 완료 상태는 아닙니다/)).toBeInTheDocument();
        expect(screen.queryByRole('button', {name: '동의하고 연결 진행'})).not.toBeInTheDocument();
    });
    it('loads actual contract terms only after the user expands them and accepts separately', async () => {
        mocks.links = [{...link, status: 'QUOTED', contractHash: 'hash-v2'}];
        mount();
        expect(mocks.get).not.toHaveBeenCalled();
        await userEvent.click(screen.getByText('계약 연결 조건 확인'));
        expect(await screen.findByText('₩49,000')).toBeInTheDocument();

        const button = screen.getByRole('button', {name: '계약 조건 확인 후 연결 동의'});

        expect(button).toBeDisabled();
        await userEvent.click(screen.getByRole('checkbox'));
        await userEvent.click(button);
        await waitFor(() =>
            expect(mocks.post).toHaveBeenCalledWith('/ward-links/link-1/decision', {
                expectedVersion: 3,
                action: 'WARD_ACCEPT',
                contractHash: 'hash-v2',
            }),
        );
    });
    it('does not offer contract acceptance again after the ward owner consented', async () => {
        mocks.links = [{...link, status: 'CONSENTED', wardConsent: true, contractHash: 'hash-v2'}];
        mount();
        await userEvent.click(screen.getByText('계약 연결 조건 확인'));
        expect(await screen.findByText('₩49,000')).toBeInTheDocument();
        expect(screen.queryByRole('button', {name: '계약 조건 확인 후 연결 동의'})).not.toBeInTheDocument();
    });
    it('never offers consent when the displayed contract belongs to an older hash', async () => {
        mocks.links = [{...link, status: 'QUOTED', contractHash: 'hash-new'}];
        mount();
        await userEvent.click(screen.getByText('계약 연결 조건 확인'));
        await waitFor(() => expect(mocks.get).toHaveBeenCalledWith('/ward-links/link-1/contract'));
        expect(screen.queryByRole('button', {name: '계약 조건 확인 후 연결 동의'})).not.toBeInTheDocument();
        expect(await screen.findByRole('alert')).toHaveTextContent('연결 조건이 변경되었습니다.');
        expect(screen.getByRole('button', {name: '요청 새로고침'})).toBeInTheDocument();
        expect(mocks.post).not.toHaveBeenCalled();
    });
    it('shows action errors without reporting a successful connection', async () => {
        mocks.post.mockRejectedValue(new Error('연결 요청이 변경되었습니다.'));
        mount();
        await userEvent.click(screen.getByRole('checkbox'));
        await userEvent.click(screen.getByRole('button', {name: '동의하고 연결 진행'}));
        expect(await screen.findByRole('alert')).toHaveTextContent('연결 요청이 변경되었습니다.');
        expect(screen.queryByRole('status')).not.toBeInTheDocument();
    });
    it('preserves a clear empty state and owner-only review boundary', () => {
        mocks.links = [];
        mocks.canReview = false;
        mount();
        expect(screen.getByRole('alert')).toHaveTextContent('최고 관리자만');
        expect(mocks.get).not.toHaveBeenCalled();
    });
});
