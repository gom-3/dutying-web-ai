import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import {cleanup, render, screen, waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {MemoryRouter} from 'react-router';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import type * as CommercialApi from '@/features/commercial/api';
import type {Organization, Scope} from '@/features/commercial/api';
import {HospitalOverview} from './hospital-overview';

const mocks = vi.hoisted(() => ({get: vi.fn(), post: vi.fn(), select: vi.fn()}));

vi.mock('@/features/commercial/api', async (original) => ({
    ...(await original<typeof CommercialApi>()),
    commercialGet: mocks.get,
    commercialPost: mocks.post,
}));
vi.mock('@/features/auth/model/store', () => ({default: (select: (state: object) => unknown) => select({accountId: 7})}));
vi.mock('@/features/commercial/hospital-entry', () => ({
    useWorkspaceNavigation: () => mocks.select,
    workspaceRoleLabel: (role: string) => (role === 'OWNER' ? '병원 최고 관리자' : '병원 관리자'),
}));

const scope: Scope = {type: 'HOSPITAL', ref: 'h1', scopeId: 'hospital-scope', name: '서울병원', role: 'OWNER', status: 'DRAFT'};
const emptyOrganization = {
    organization: {id: 'h1', name: '서울병원'},
    role: 'OWNER',
    wards: [],
    entitlement: {},
} as unknown as Organization;

function mount(role: Scope['role'] = 'OWNER') {
    return render(
        <QueryClientProvider client={new QueryClient({defaultOptions: {queries: {retry: false}}})}>
            <MemoryRouter>
                <HospitalOverview scope={{...scope, role}} />
            </MemoryRouter>
        </QueryClientProvider>,
    );
}

afterEach(cleanup);
beforeEach(() => {
    vi.clearAllMocks();
    mocks.get.mockResolvedValue(emptyOrganization);
    mocks.post.mockResolvedValue({status: 'DETACHED'});
});

describe('hospital overview recovery and empty state', () => {
    it('retries a failed read without leaving the hospital', async () => {
        mocks.get.mockRejectedValueOnce(new Error('병원 현황을 불러오지 못했습니다.'));
        mount();
        expect(await screen.findByRole('alert')).toHaveTextContent('병원 현황을 불러오지 못했습니다.');
        await userEvent.click(screen.getByRole('button', {name: '다시 불러오기'}));
        expect(await screen.findByText('아직 연결된 병동이 없습니다')).toBeInTheDocument();
        expect(mocks.get).toHaveBeenCalledTimes(2);
        expect(mocks.get).toHaveBeenLastCalledWith('/organizations/h1');
        expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });
    it('gives the owner creation and connection actions without an empty table', async () => {
        mount();
        await screen.findByText('아직 연결된 병동이 없습니다');
        expect(screen.getByRole('link', {name: '새 병동 만들기'})).toHaveAttribute('href', '/onboarding/ward-create?organizationId=h1');
        expect(screen.getByText('기존 병동 연결')).toBeInTheDocument();
        expect(screen.queryByRole('table')).not.toBeInTheDocument();
    });
    it('keeps owner creation and connection controls out of the manager empty state', async () => {
        mount('MANAGER');
        expect(await screen.findByText('병원 최고 관리자가 병동을 연결하면 여기에 표시됩니다.')).toBeInTheDocument();
        expect(screen.queryByRole('link', {name: '새 병동 만들기'})).not.toBeInTheDocument();
        expect(screen.queryByText('기존 병동 연결')).not.toBeInTheDocument();
    });
});

describe('hospital ward access', () => {
    const ward = {id: 'link1', wardId: 11, name: '중환자실', status: 'ACTIVE', operationallyConnected: true};

    it.each(['OWNER', 'MANAGER'] as const)('uses server permission to open a ward as %s', async (role) => {
        mocks.get.mockResolvedValue({...emptyOrganization, wards: [{...ward, canOpenWard: true}]});
        mount(role);
        await userEvent.click(await screen.findByRole('button', {name: '병동 근무표 열기'}));
        expect(mocks.select).toHaveBeenCalledExactlyOnceWith({type: 'WARD', ref: '11'}, true);
    });

    it.each(['OWNER', 'MANAGER'] as const)('does not override a server denial based on %s role', async (role) => {
        mocks.get.mockResolvedValue({...emptyOrganization, wards: [{...ward, canOpenWard: false}]});
        mount(role);
        expect(await screen.findByText('담당 권한 없음')).toBeInTheDocument();
        expect(screen.queryByRole('button', {name: '병동 근무표 열기'})).not.toBeInTheDocument();
        expect(mocks.select).not.toHaveBeenCalled();
    });

    it('does not open a pending affiliation even when a stale response includes access', async () => {
        mocks.get.mockResolvedValue({
            ...emptyOrganization,
            wards: [{...ward, status: 'SETUP', operationallyConnected: false, canOpenWard: true}],
        });
        mount();
        expect(await screen.findByText('연결 확인 중')).toBeInTheDocument();
        expect(screen.queryByRole('button', {name: '병동 근무표 열기'})).not.toBeInTheDocument();
    });

    it('explains the owner and manager access rules without permanent explanatory text', async () => {
        mount();
        await userEvent.click(await screen.findByRole('button', {name: '병동 연결·권한 안내'}));

        const tooltip = await screen.findByRole('tooltip');

        expect(tooltip).toHaveTextContent('최고 관리자는 운영 중인 모든 소속 병동');
        expect(tooltip).toHaveTextContent('일반 관리자는 지정된 병동');
        expect(tooltip).toHaveTextContent('기존 병동 권한은 유지');
    });
});

describe('hospital owner disconnection', () => {
    const ward = {id: 'link1', wardId: 11, name: '중환자실', status: 'ACTIVE', version: 4, staff: 20, operationallyConnected: true};
    const organization = {...emptyOrganization, wards: [ward]} as Organization;

    it('immediately disconnects after confirmation and refreshes the displayed link', async () => {
        const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);

        mocks.get
            .mockResolvedValueOnce(organization)
            .mockResolvedValue({...organization, wards: [{...ward, status: 'DETACHED', operationallyConnected: false}]});
        mount();
        await userEvent.click(await screen.findByText('병동 연결 관리'));
        await userEvent.click(screen.getByRole('button', {name: '병원 연결 해제'}));
        expect(confirm).toHaveBeenCalledWith(expect.stringContaining('병원 연결을 즉시 해제'));
        expect(confirm).toHaveBeenCalledWith(expect.stringContaining('병원에서 부여한 담당 권한만 해제'));
        expect(confirm).toHaveBeenCalledWith(expect.stringContaining('병동 자료와 기존 병동 권한은 유지'));
        await waitFor(() =>
            expect(mocks.post).toHaveBeenCalledExactlyOnceWith('/ward-links/link1/decision', {expectedVersion: 4, action: 'ORG_DETACH'}),
        );
        expect(await screen.findByRole('status')).toHaveTextContent('병원 연결을 해제했습니다.');
        await waitFor(() => expect(screen.queryByRole('button', {name: '병원 연결 해제'})).not.toBeInTheDocument());
        expect(screen.queryByRole('table', {name: '연결 병동 운영 현황'})).not.toBeInTheDocument();
        expect(screen.getByText('아직 연결된 병동이 없습니다')).toBeInTheDocument();
        expect(screen.getByText('연결 해제됨')).toBeInTheDocument();
        expect(screen.queryByText('연결 확인 중')).not.toBeInTheDocument();
        confirm.mockRestore();
    });

    it.each(['DETACHED', 'CANCELED', 'CANCELLED'])(
        'keeps terminal %s links in history without counting them as linked wards',
        async (status) => {
            mocks.get.mockResolvedValue({...organization, wards: [{...ward, status, operationallyConnected: false}]});
            mount();
            await screen.findByText('아직 연결된 병동이 없습니다');
            expect(screen.queryByRole('table', {name: '연결 병동 운영 현황'})).not.toBeInTheDocument();

            const heading = screen.getByRole('heading', {name: '연결 병동'}).parentElement!;

            expect(heading.querySelector('.hospital-overview-count')).toHaveTextContent('0');
            await userEvent.click(screen.getByText('병동 연결 관리'));
            expect(screen.getByText('중환자실')).toBeInTheDocument();
            expect(screen.getByText(status === 'DETACHED' ? '연결 해제됨' : '연결 요청 종료')).toBeInTheDocument();
            expect(screen.queryByText('연결 확인 중')).not.toBeInTheDocument();
        },
    );

    it.each(['REQUESTED', 'SHARED', 'QUOTED', 'CONSENTED', 'SETUP'])(
        'preserves nonterminal %s wards in the primary list',
        async (status) => {
            mocks.get.mockResolvedValue({...organization, wards: [{...ward, status, operationallyConnected: false}]});
            mount();

            const table = await screen.findByRole('table', {name: '연결 병동 운영 현황'});

            expect(table).toHaveTextContent('중환자실');

            const heading = screen.getByRole('heading', {name: '연결 병동'}).parentElement!;

            expect(heading.querySelector('.hospital-overview-count')).toHaveTextContent('1');
        },
    );

    it('does not submit or reload when disconnection is cancelled', async () => {
        const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);

        mocks.get.mockResolvedValue(organization);
        mount();
        await userEvent.click(await screen.findByText('병동 연결 관리'));
        await userEvent.click(screen.getByRole('button', {name: '병원 연결 해제'}));
        expect(mocks.post).not.toHaveBeenCalled();
        expect(mocks.get).toHaveBeenCalledTimes(1);
        confirm.mockRestore();
    });

    it('lets the owner finish legacy pending disconnection without a ward action', async () => {
        const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);

        mocks.get.mockResolvedValue({...organization, wards: [{...ward, status: 'DETACH_PENDING', organizationDetachConsent: true}]});
        mount();
        await userEvent.click(await screen.findByText('병동 연결 관리'));
        await userEvent.click(screen.getByRole('button', {name: '병원 연결 해제'}));
        await waitFor(() =>
            expect(mocks.post).toHaveBeenCalledWith('/ward-links/link1/decision', {expectedVersion: 4, action: 'ORG_DETACH'}),
        );
        confirm.mockRestore();
    });

    it('does not claim completion when an older server still returns a pending response', async () => {
        const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);

        mocks.get.mockResolvedValue(organization);
        mocks.post.mockResolvedValue({status: 'DETACH_PENDING'});
        mount();
        await userEvent.click(await screen.findByText('병동 연결 관리'));
        await userEvent.click(screen.getByRole('button', {name: '병원 연결 해제'}));
        expect(await screen.findByRole('status')).toHaveTextContent('연결 상태를 다시 확인해 주세요.');
        expect(screen.queryByText('병원 연결을 해제했습니다. 병동 자료는 유지됩니다.')).not.toBeInTheDocument();
        await waitFor(() => expect(mocks.get).toHaveBeenCalledTimes(2));
        confirm.mockRestore();
    });

    it.each(['MANAGED', 'MANAGED_DETACH_PENDING', 'SHARED', 'QUOTED', 'CONSENTED'])(
        'allows owner disconnection for an operational %s affiliation',
        async (status) => {
            mocks.get.mockResolvedValue({...organization, wards: [{...ward, status, operationallyConnected: true}]});
            mount();
            await userEvent.click(await screen.findByText('병동 연결 관리'));
            expect(screen.getByRole('button', {name: '병원 연결 해제'})).toBeInTheDocument();
        },
    );

    it('does not offer disconnection while a ward is still being set up', async () => {
        mocks.get.mockResolvedValue({...organization, wards: [{...ward, status: 'SETUP', operationallyConnected: false}]});
        mount();
        await screen.findByRole('heading', {name: '연결 병동'});
        expect(screen.queryByRole('button', {name: '병원 연결 해제'})).not.toBeInTheDocument();
    });

    it('does not expose disconnection to a hospital manager', async () => {
        mocks.get.mockResolvedValue(organization);
        mount('MANAGER');
        await screen.findByRole('heading', {name: '연결 병동'});
        expect(screen.queryByRole('button', {name: '병원 연결 해제'})).not.toBeInTheDocument();
        expect(mocks.post).not.toHaveBeenCalled();
    });
});
