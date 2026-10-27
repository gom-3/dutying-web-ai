import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import {cleanup, render, screen, waitFor, within} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import type * as CommercialApi from '@/features/commercial/api';
import type {Entitlement, Members, Scope} from '@/features/commercial/api';
import i18n from '@/i18n';
import {HospitalMembersPanel} from './hospital-members';

const mocks = vi.hoisted(() => ({get: vi.fn(), post: vi.fn(), put: vi.fn()}));

vi.mock('@/features/commercial/api', async (original) => ({
    ...(await original<typeof CommercialApi>()),
    commercialGet: mocks.get,
    commercialPost: mocks.post,
    commercialPut: mocks.put,
}));
vi.mock('@/features/auth/model/store', () => ({default: (selector: (state: object) => unknown) => selector({accountId: 7})}));

const members: Members = {
    members: [
        {id: 'owner', accountId: 7, name: '김최고', email: 'owner@example.com', role: 'OWNER', version: 2, wardIds: [], wards: []},
        {
            id: 'manager',
            accountId: 8,
            name: '이관리',
            email: 'manager@example.com',
            role: 'MANAGER',
            version: 3,
            wardIds: [11],
            wards: [{wardId: 11, name: '중환자실', canEdit: true}],
        },
    ],
    invitations: [],
    availableWards: [
        {wardId: 11, name: '중환자실'},
        {wardId: 12, name: '응급실'},
    ],
};
const entitlement = {adminSeats: {active: 2, reserved: 0, limit: 5}} as Entitlement;
const scope: Scope = {type: 'HOSPITAL', ref: 'h1', scopeId: 'hospital-scope', name: '서울병원', role: 'OWNER'};

function mount(role: Scope['role'] = 'OWNER', e = entitlement) {
    const client = new QueryClient({defaultOptions: {queries: {retry: false}, mutations: {retry: false}}});

    render(
        <QueryClientProvider client={client}>
            <HospitalMembersPanel scope={{...scope, role}} entitlement={e} />
        </QueryClientProvider>,
    );

    return client;
}

afterEach(cleanup);
beforeEach(() => {
    vi.clearAllMocks();
    mocks.get.mockResolvedValue(members);
    mocks.post.mockResolvedValue({});
    mocks.put.mockResolvedValue({});
});

async function openAddForm() {
    await userEvent.click(await screen.findByRole('button', {name: '관리자 추가'}));
}

describe('hospital administrators', () => {
    it('offers a focused retry when administrators cannot be loaded', async () => {
        mocks.get.mockRejectedValueOnce(new Error('관리자 목록을 불러오지 못했습니다.'));
        mount();
        expect(await screen.findByRole('alert')).toHaveTextContent('관리자 목록을 불러오지 못했습니다.');
        expect(screen.getByRole('button', {name: '관리자 추가'})).toBeDisabled();
        await userEvent.click(screen.getByRole('button', {name: '다시 불러오기'}));
        expect(await screen.findByText('이관리')).toBeInTheDocument();
        expect(screen.getByRole('button', {name: '관리자 추가'})).toBeEnabled();
        expect(mocks.get).toHaveBeenCalledTimes(2);
    });
    it('keeps the list focused and reveals the add form only when requested', async () => {
        mount();
        await screen.findByText('이관리');
        expect(screen.queryByLabelText('가입된 계정 이메일')).not.toBeInTheDocument();

        const addButton = screen.getByRole('button', {name: '관리자 추가'});

        expect(addButton).toHaveAttribute('aria-expanded', 'false');
        await userEvent.click(addButton);
        expect(addButton).toHaveAttribute('aria-expanded', 'true');
        expect(screen.getByLabelText('가입된 계정 이메일')).toHaveFocus();
        await userEvent.click(screen.getByRole('button', {name: '취소'}));
        expect(screen.queryByLabelText('가입된 계정 이메일')).not.toBeInTheDocument();
        expect(addButton).toHaveFocus();
    });
    it('adds an existing account with selected wards using a single request', async () => {
        mount();
        await screen.findByText('이관리');
        await openAddForm();
        await userEvent.type(screen.getByLabelText('가입된 계정 이메일'), 'new@example.com');
        await userEvent.click(screen.getByRole('checkbox', {name: '응급실'}));
        await userEvent.click(screen.getByRole('button', {name: '관리자 등록'}));
        await waitFor(() =>
            expect(mocks.post).toHaveBeenCalledWith('/organizations/h1/members', {email: 'new@example.com', wardIds: [12]}),
        );
        expect(await screen.findByRole('status')).toHaveTextContent('관리자를 추가했습니다.');
        expect(screen.queryByLabelText('가입된 계정 이메일')).not.toBeInTheDocument();
        expect(screen.getByRole('button', {name: '관리자 추가'})).toHaveFocus();
    });
    it('allows hospital-summary-only access without assigned wards', async () => {
        mount();
        await screen.findByText('이관리');
        await openAddForm();
        await userEvent.type(screen.getByLabelText('가입된 계정 이메일'), 'summary@example.com');
        await userEvent.click(screen.getByRole('button', {name: '관리자 등록'}));
        await waitFor(() =>
            expect(mocks.post).toHaveBeenCalledWith('/organizations/h1/members', {email: 'summary@example.com', wardIds: []}),
        );
    });
    it('updates assigned wards with optimistic version and can remove all assignments', async () => {
        mount();

        const name = await screen.findByText('이관리');
        const row = name.closest('.workspace-member-row')! as HTMLElement;

        await userEvent.click(within(row).getByRole('button', {name: '담당 병동 변경'}));
        await userEvent.click(within(row).getByRole('checkbox', {name: '중환자실'}));
        await userEvent.click(within(row).getByRole('button', {name: '변경 저장'}));
        await waitFor(() =>
            expect(mocks.put).toHaveBeenCalledWith('/organizations/h1/members/manager/wards', {expectedVersion: 3, wardIds: []}),
        );
    });
    it('shows assigned wards but no administrator actions to a manager', async () => {
        mount('MANAGER');
        await screen.findByText('이관리');
        expect(screen.getByText('중환자실')).toBeInTheDocument();
        expect(screen.queryByLabelText('가입된 계정 이메일')).not.toBeInTheDocument();
        expect(screen.queryByRole('button', {name: '관리자 제거'})).not.toBeInTheDocument();
        expect(screen.queryByRole('button', {name: '담당 병동 변경'})).not.toBeInTheDocument();
    });
    it('shows all hospital wards for the owner without offering an assignment editor', async () => {
        mount();

        const name = await screen.findByText('김최고');
        const row = name.closest('.workspace-member-row')! as HTMLElement;

        expect(within(row).getByText('모든 소속 병동')).toBeInTheDocument();
        expect(within(row).queryByRole('button', {name: '담당 병동 변경'})).not.toBeInTheDocument();
        expect(within(row).queryByText('미지정')).not.toBeInTheDocument();
        expect(mocks.put).not.toHaveBeenCalled();
        expect(within(row).getByText('최고 관리자')).toBeInTheDocument();
        expect(within(row).getByText('owner@example.com')).toBeInTheDocument();
    });
    it('shows the owner access label in English to a manager without exposing administrator actions', async () => {
        await i18n.changeLanguage('en');
        mount('MANAGER');

        const name = await screen.findByText('김최고');
        const row = name.closest('.workspace-member-row')! as HTMLElement;

        expect(within(row).getByText('All hospital wards')).toBeInTheDocument();
        expect(within(row).queryByText('Unassigned')).not.toBeInTheDocument();
        expect(within(row).queryByRole('button', {name: 'Edit assigned wards'})).not.toBeInTheDocument();
    });
    it('closes a stale assignment editor if its member becomes the hospital owner', async () => {
        const client = mount();
        const name = await screen.findByText('이관리');
        const row = name.closest('.workspace-member-row')! as HTMLElement;

        await userEvent.click(within(row).getByRole('button', {name: '담당 병동 변경'}));
        expect(within(row).getByRole('button', {name: '변경 저장'})).toBeInTheDocument();
        mocks.get.mockResolvedValue({
            ...members,
            members: members.members.map((member) => ({...member, role: member.id === 'manager' ? 'OWNER' : 'MANAGER'})),
        });
        await client.invalidateQueries({queryKey: ['commercial', 7, 'HOSPITAL', 'h1', 'members']});
        await waitFor(() => expect(within(row).getByText('모든 소속 병동')).toBeInTheDocument());
        expect(within(row).queryByRole('button', {name: '변경 저장'})).not.toBeInTheDocument();
        expect(within(row).queryByRole('button', {name: '담당 병동 변경'})).not.toBeInTheDocument();
        expect(mocks.put).not.toHaveBeenCalled();
    });
    it('explains owner access and manager assignments in optional help', async () => {
        mount();
        await screen.findByText('이관리');
        await userEvent.click(screen.getByRole('button', {name: '병원 관리자 권한 안내'}));

        const tooltip = await screen.findByRole('tooltip');

        expect(tooltip).toHaveTextContent('최고 관리자는 운영 중인 모든 소속 병동');
        expect(tooltip).toHaveTextContent('일반 관리자는 병원 전체 요약과 지정된 병동');
        expect(tooltip).toHaveTextContent('기존 병동 권한은 유지');
    });
    it('preserves the email and selected wards when the account cannot be added', async () => {
        mocks.post.mockRejectedValue(new Error('가입된 관리자 계정을 찾을 수 없습니다.'));
        mount();
        await screen.findByText('이관리');
        await openAddForm();
        await userEvent.type(screen.getByLabelText('가입된 계정 이메일'), 'missing@example.com');
        await userEvent.click(screen.getByRole('checkbox', {name: '응급실'}));
        await userEvent.click(screen.getByRole('button', {name: '관리자 등록'}));
        expect(await screen.findByRole('alert')).toHaveTextContent('가입된 관리자 계정을 찾을 수 없습니다.');
        expect(screen.getByLabelText('가입된 계정 이메일')).toHaveValue('missing@example.com');
        expect(screen.getByRole('checkbox', {name: '응급실'})).toBeChecked();
    });
    it('reloads assignments after a concurrent update instead of reusing a stale version', async () => {
        mocks.put.mockRejectedValue(Object.assign(new Error('다른 관리자가 변경했습니다. 최신 내용을 확인해 주세요.'), {code: 409}));
        mount();

        const name = await screen.findByText('이관리');
        const row = name.closest('.workspace-member-row')! as HTMLElement;

        await userEvent.click(within(row).getByRole('button', {name: '담당 병동 변경'}));
        await userEvent.click(within(row).getByRole('button', {name: '변경 저장'}));
        expect(await screen.findByRole('alert')).toHaveTextContent('다른 관리자가 변경했습니다.');
        await waitFor(() => expect(mocks.get).toHaveBeenCalledTimes(2));
        expect(within(row).queryByRole('button', {name: '변경 저장'})).not.toBeInTheDocument();
    });
    it('prevents adding members when all administrator seats are reserved', async () => {
        mount('OWNER', {...entitlement, adminSeats: {active: 2, reserved: 3, limit: 5}});
        await screen.findByText('이관리');
        await openAddForm();
        expect(screen.getByRole('button', {name: '관리자 등록'})).toBeDisabled();
        expect(mocks.post).not.toHaveBeenCalled();
    });
    it('converts only the matching pending invitation when administrator seats are full', async () => {
        mocks.get.mockResolvedValue({
            ...members,
            invitations: [{id: 'pending', email: 'reserved@example.com', status: 'PENDING', expiresAt: '2099-12-01T00:00:00Z'}],
        });
        mount('OWNER', {...entitlement, adminSeats: {active: 2, reserved: 1, limit: 3}});
        await screen.findByText('이관리');
        await openAddForm();
        await userEvent.type(screen.getByLabelText('가입된 계정 이메일'), 'other@example.com');
        expect(screen.getByRole('button', {name: '관리자 등록'})).toBeDisabled();
        await userEvent.clear(screen.getByLabelText('가입된 계정 이메일'));
        await userEvent.type(screen.getByLabelText('가입된 계정 이메일'), 'Reserved@Example.com');
        expect(screen.getByRole('button', {name: '관리자 등록'})).toBeEnabled();
        await userEvent.click(screen.getByRole('button', {name: '관리자 등록'}));
        await waitFor(() =>
            expect(mocks.post).toHaveBeenCalledWith('/organizations/h1/members', {email: 'Reserved@Example.com', wardIds: []}),
        );
    });
    it('keeps adding blocked when active members already fill the limit despite a matching invitation', async () => {
        mocks.get.mockResolvedValue({
            ...members,
            invitations: [{id: 'pending', email: 'reserved@example.com', status: 'PENDING', expiresAt: '2099-12-01T00:00:00Z'}],
        });
        mount('OWNER', {...entitlement, adminSeats: {active: 3, reserved: 1, limit: 3}});
        await screen.findByText('이관리');
        await openAddForm();
        await userEvent.type(screen.getByLabelText('가입된 계정 이메일'), 'reserved@example.com');
        expect(screen.getByRole('button', {name: '관리자 등록'})).toBeDisabled();
    });
    it('refreshes members after stale removal and sends the displayed membership version', async () => {
        const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);

        mocks.post.mockRejectedValue(Object.assign(new Error('관리자 정보가 변경되었습니다. 새로고침해 주세요.'), {code: 409}));
        mount();
        await userEvent.click(await screen.findByRole('button', {name: '관리자 제거'}));
        expect(await screen.findByRole('alert')).toHaveTextContent('관리자 정보가 변경되었습니다.');
        expect(mocks.post).toHaveBeenCalledWith('/organizations/h1/members/manager/REMOVE', {expectedVersion: 3});
        await waitFor(() => expect(mocks.get).toHaveBeenCalledTimes(2));
        confirm.mockRestore();
    });
    it('confirms removal and refreshes hospital and context data', async () => {
        const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
        const client = mount();
        const invalidate = vi.spyOn(client, 'invalidateQueries');

        await userEvent.click(await screen.findByRole('button', {name: '관리자 제거'}));
        await waitFor(() => expect(mocks.post).toHaveBeenCalledWith('/organizations/h1/members/manager/REMOVE', {expectedVersion: 3}));
        await waitFor(() => expect(invalidate).toHaveBeenCalledWith({queryKey: ['commercial', 7, 'context']}));
        confirm.mockRestore();
    });
});
