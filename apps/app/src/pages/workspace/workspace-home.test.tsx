import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import {act, cleanup, render, screen, waitFor, within} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type {ComponentProps} from 'react';
import {MemoryRouter, useLocation} from 'react-router';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import type * as CommercialApi from '@/features/commercial/api';
import type {Scope} from '@/features/commercial/api';
import {WorkspaceHome} from './workspace-home';

const mocks = vi.hoisted(() => ({post: vi.fn(), refresh: vi.fn()}));

vi.mock('@/features/commercial/api', async (original) => ({
    ...(await original<typeof CommercialApi>()),
    commercialPost: mocks.post,
}));
vi.mock('@/features/auth', () => ({default: () => ({actions: {handleGetAccountMe: mocks.refresh}})}));
vi.mock('@/features/auth/model/store', () => ({default: (select: (state: object) => unknown) => select({accountId: 7})}));

const hospital: Scope = {
    type: 'HOSPITAL',
    ref: 'hospital-1',
    scopeId: 'hospital-scope-1',
    name: '서울 병원',
    role: 'MANAGER',
    status: 'DRAFT',
};
const ward: Scope = {type: 'WARD', ref: '42', scopeId: 'ward-scope-42', name: '3병동', role: 'EDITOR'};

function Location() {
    const location = useLocation();

    return (
        <>
            <p aria-label="current route">{location.pathname}</p>
            <p aria-label="route state">{JSON.stringify(location.state)}</p>
        </>
    );
}

function mount(props: Partial<ComponentProps<typeof WorkspaceHome>> = {}) {
    const client = new QueryClient({defaultOptions: {queries: {retry: false}}});

    render(
        <QueryClientProvider client={client}>
            <MemoryRouter initialEntries={['/workspace']}>
                <WorkspaceHome scopes={[hospital, ward]} {...props} />
                <Location />
            </MemoryRouter>
        </QueryClientProvider>,
    );

    return client;
}

afterEach(cleanup);
beforeEach(() => {
    vi.clearAllMocks();
    mocks.post.mockResolvedValue({});
    mocks.refresh.mockResolvedValue(undefined);
});

describe('workspace home', () => {
    it('lists hospitals and wards with their roles without adding a second page title or a selector', () => {
        mount();

        const hospitals = screen.getByRole('region', {name: '병원'});
        const wards = screen.getByRole('region', {name: '병동'});

        expect(within(hospitals).getByText('서울 병원')).toBeInTheDocument();
        expect(within(hospitals).getByText('병원 관리자')).toBeInTheDocument();
        expect(within(wards).getByText('3병동')).toBeInTheDocument();
        expect(within(wards).getByText('병동 관리자')).toBeInTheDocument();
        expect(screen.queryByRole('heading', {level: 1})).not.toBeInTheDocument();
        expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
        expect(mocks.post).not.toHaveBeenCalled();
    });

    it('selects an assigned DRAFT hospital directly from its row before opening its overview', async () => {
        const client = mount();

        client.setQueryData(['commercial', 7, 'plans'], {cached: true});
        client.setQueryData(['ward', 11], {oldWard: true});
        await userEvent.click(screen.getByRole('button', {name: '서울 병원 병원 열기'}));
        await waitFor(() => expect(screen.getByLabelText('current route')).toHaveTextContent('/workspace/HOSPITAL/hospital-1/overview'));
        expect(mocks.post).toHaveBeenCalledExactlyOnceWith('/scopes/HOSPITAL/hospital-1/select');
        expect(mocks.refresh).toHaveBeenCalledOnce();
        expect(client.getQueryData(['ward', 11])).toBeUndefined();
        expect(client.getQueryData(['commercial', 7, 'plans'])).toEqual({cached: true});
    });

    it('posts the selected ward before opening the actual schedule', async () => {
        mount();
        await userEvent.click(screen.getByRole('button', {name: '3병동 근무표 열기'}));
        await waitFor(() => expect(screen.getByLabelText('current route').textContent).toBe('/home'));
        expect(mocks.post).toHaveBeenCalledExactlyOnceWith('/scopes/WARD/42/select');
        expect(mocks.refresh).toHaveBeenCalledOnce();
    });

    it('gives ward owners a direct subscription route while preserving schedule entry', async () => {
        mount({scopes: [{...ward, role: 'OWNER'}, hospital]});

        const billing = screen.getByRole('link', {name: '3병동 구독·결제 관리'});

        expect(billing).toHaveAttribute('href', '/workspace/WARD/42/billing');
        expect(screen.getByRole('button', {name: '3병동 근무표 열기'})).toBeInTheDocument();
        await userEvent.click(billing);
        expect(screen.getByLabelText('current route').textContent).toBe('/workspace/WARD/42/billing');
        expect(mocks.post).not.toHaveBeenCalled();
    });

    it('keeps the subscription shortcut limited to direct ward owners', () => {
        mount();
        expect(screen.queryByRole('link', {name: /구독·결제 관리/})).not.toBeInTheDocument();
        expect(screen.getByRole('button', {name: '3병동 근무표 열기'})).toBeInTheDocument();
        expect(screen.getByRole('button', {name: '서울 병원 병원 열기'})).toBeInTheDocument();
    });

    it('waits for scope selection and prevents duplicate or competing opens', async () => {
        let resolve: (value: object) => void = () => {};

        mocks.post.mockReturnValue(new Promise((done) => (resolve = done)));
        mount();
        await userEvent.click(screen.getByRole('button', {name: '3병동 근무표 열기'}));
        expect(screen.getByRole('status')).toHaveTextContent('관리 공간을 여는 중');
        expect(screen.getByRole('button', {name: '3병동 근무표 열기'})).toBeDisabled();
        expect(screen.getByRole('button', {name: '서울 병원 병원 열기'})).toBeDisabled();
        await userEvent.click(screen.getByRole('button', {name: '3병동 근무표 열기'}));
        expect(mocks.post).toHaveBeenCalledOnce();
        expect(mocks.refresh).not.toHaveBeenCalled();
        expect(screen.getByLabelText('current route').textContent).toBe('/workspace');
        await act(async () => resolve({}));
        await waitFor(() => expect(screen.getByLabelText('current route').textContent).toBe('/home'));
    });

    it('keeps the route and offers the same row again after a rejected selection', async () => {
        mocks.post.mockRejectedValueOnce(new Error('관리 권한을 확인해 주세요.'));
        mount();
        await userEvent.click(screen.getByRole('button', {name: '서울 병원 병원 열기'}));
        expect(await screen.findByRole('alert')).toHaveTextContent('관리 권한을 확인해 주세요.');
        expect(screen.getByLabelText('current route').textContent).toBe('/workspace');
        expect(mocks.refresh).not.toHaveBeenCalled();
        expect(screen.getByRole('button', {name: '서울 병원 병원 열기'})).toBeEnabled();
        await userEvent.click(screen.getByRole('button', {name: '서울 병원 병원 열기'}));
        await waitFor(() => expect(screen.getByLabelText('current route')).toHaveTextContent('/workspace/HOSPITAL/hospital-1/overview'));
        expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    it('preserves the current ward schedule link when commercial ward scopes are absent', async () => {
        mount({scopes: [hospital], currentWardId: 71});
        expect(screen.getByRole('link', {name: '현재 병동 근무표 열기'})).toHaveAttribute('href', '/home');
        expect(screen.queryByText('참여 중인 병동이 없습니다.')).not.toBeInTheDocument();
        await userEvent.click(screen.getByRole('link', {name: '현재 병동 근무표 열기'}));
        expect(screen.getByLabelText('current route').textContent).toBe('/home');
        expect(mocks.post).not.toHaveBeenCalled();
    });

    it('uses listed ward scopes instead of the legacy fallback when both are present', () => {
        mount({currentWardId: 71});
        expect(screen.queryByRole('link', {name: '현재 병동 근무표 열기'})).not.toBeInTheDocument();
        expect(screen.getByRole('button', {name: '3병동 근무표 열기'})).toBeInTheDocument();
    });

    it('starts a fresh ward wizard with the existing reset state', async () => {
        mount();
        await userEvent.click(screen.getByRole('link', {name: '새 병동 만들기'}));
        expect(screen.getByLabelText('current route').textContent).toBe('/onboarding/ward-create');
        expect(screen.getByLabelText('route state')).toHaveTextContent('{"resetOnboardingWardCreateStep":true}');
        expect(mocks.post).not.toHaveBeenCalled();
    });

    it('opens the existing invite code flow', async () => {
        mount();
        await userEvent.click(screen.getByRole('link', {name: '초대 코드로 병동 참여'}));
        expect(screen.getByLabelText('current route').textContent).toBe('/enter-ward');
        expect(mocks.post).not.toHaveBeenCalled();
    });

    it('shows short empty states only after loading succeeds', () => {
        mount({scopes: []});
        expect(screen.getByText('연결된 병원이 없습니다.')).toBeInTheDocument();
        expect(screen.getByText('참여 중인 병동이 없습니다.')).toBeInTheDocument();
        expect(screen.getByRole('link', {name: '새 병동 만들기'})).toBeInTheDocument();
        expect(screen.getByRole('link', {name: '초대 코드로 병동 참여'})).toBeInTheDocument();
    });

    it('does not flash empty states or stale scope actions during loading', () => {
        mount({loading: true});
        expect(screen.getByRole('status')).toHaveTextContent('관리 공간을 불러오는 중');
        expect(screen.queryByRole('region')).not.toBeInTheDocument();
        expect(screen.queryByRole('button')).not.toBeInTheDocument();
        expect(screen.queryByText('연결된 병원이 없습니다.')).not.toBeInTheDocument();
    });

    it('shows the read error with a retry instead of an empty or stale workspace list', async () => {
        const retry = vi.fn();

        mount({error: new Error('관리 공간 조회에 실패했습니다.'), onRetry: retry});
        expect(screen.getByRole('alert')).toHaveTextContent('관리 공간 조회에 실패했습니다.');
        expect(screen.queryByRole('region')).not.toBeInTheDocument();
        expect(screen.queryByText('연결된 병원이 없습니다.')).not.toBeInTheDocument();
        await userEvent.click(screen.getByRole('button', {name: '다시 불러오기'}));
        expect(retry).toHaveBeenCalledOnce();
        expect(mocks.post).not.toHaveBeenCalled();
    });
});
