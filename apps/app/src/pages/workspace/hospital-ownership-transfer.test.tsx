import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import {cleanup, fireEvent, render, screen, waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import type * as CommercialApi from '@/features/commercial/api';
import type {Member, Scope} from '@/features/commercial/api';
import {HospitalOwnershipTransfer} from './hospital-ownership-transfer';

const mocks = vi.hoisted(() => ({post: vi.fn()}));

vi.mock('@/features/commercial/api', async (original) => ({...(await original<typeof CommercialApi>()), commercialPost: mocks.post}));
vi.mock('@/features/auth/model/store', () => ({default: (selector: (state: object) => unknown) => selector({accountId: 7})}));

const scope: Scope = {type: 'HOSPITAL', ref: 'h1', scopeId: 's1', name: '서울병원', role: 'OWNER'};
const members: Member[] = [
    {id: 'owner', accountId: 7, name: '김최고', role: 'OWNER'},
    {id: 'manager', accountId: 8, name: '이관리', role: 'MANAGER', email: 'manager@example.com'},
    {id: 'other-manager', adminAccountId: 9, name: '박관리', role: 'MANAGER'},
];

function mount(props: Partial<Parameters<typeof HospitalOwnershipTransfer>[0]> = {}) {
    return render(
        <QueryClientProvider client={new QueryClient({defaultOptions: {queries: {retry: false}}})}>
            <HospitalOwnershipTransfer scope={scope} members={members} {...props} />
        </QueryClientProvider>,
    );
}

async function open() {
    await userEvent.click(screen.getByText('최고 관리자 인계', {selector: 'summary'}));
    await screen.findByLabelText('새 최고 관리자');
}

async function verify() {
    await userEvent.click(screen.getByRole('button', {name: '인증번호 받기'}));
    await userEvent.type(await screen.findByLabelText('이메일 인증번호'), '123456');
    await userEvent.click(screen.getByRole('button', {name: '본인 확인'}));
    await screen.findByText('이메일 본인 확인 완료');
}

beforeEach(() => {
    vi.clearAllMocks();
    mocks.post.mockImplementation((path: string) =>
        Promise.resolve(
            path === '/reauthentication/confirm'
                ? {reauthenticationToken: 'proof', expiresAt: new Date(Date.now() + 600_000).toISOString()}
                : {},
        ),
    );
});
afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
});

describe('hospital ownership transfer under administrator management', () => {
    it('hides the action from managers and keeps verification closed by default for owners', () => {
        const {unmount} = mount({scope: {...scope, role: 'MANAGER'}});

        expect(screen.queryByText('최고 관리자 인계')).not.toBeInTheDocument();
        unmount();
        mount();
        expect(screen.getByText('최고 관리자 인계', {selector: 'summary'})).toBeInTheDocument();
        expect(screen.queryByLabelText('새 최고 관리자')).not.toBeInTheDocument();
        expect(screen.queryByRole('button', {name: '인증번호 받기'})).not.toBeInTheDocument();
        expect(mocks.post).not.toHaveBeenCalled();
    });
    it('offers only other active managers and reveals verification after selecting one', async () => {
        mount({
            members: [
                ...members,
                {id: 'self', accountId: 7, name: '내 계정 중복', role: 'MANAGER'},
                {id: 'removed', accountId: 10, name: '제거됨', role: 'MANAGER', status: 'REMOVED'} as Member,
            ],
        });
        await open();
        expect(screen.getAllByRole('option').map((node) => node.textContent)).toEqual([
            '관리자 선택',
            '이관리 · manager@example.com',
            '박관리',
        ]);
        expect(screen.queryByRole('button', {name: '인증번호 받기'})).not.toBeInTheDocument();
        expect(screen.getByRole('button', {name: '인계 요청 보내기'})).toBeDisabled();
        await userEvent.selectOptions(screen.getByLabelText('새 최고 관리자'), '8');
        expect(screen.getByRole('button', {name: '인증번호 받기'})).toBeInTheDocument();
        expect(mocks.post).not.toHaveBeenCalled();
    });
    it('submits the selected account, keeps current membership, and links to notifications', async () => {
        mount();
        await open();
        await userEvent.selectOptions(screen.getByLabelText('새 최고 관리자'), '9');
        expect(document.querySelector('form form')).toBeNull();
        await verify();
        await userEvent.click(screen.getByRole('button', {name: '인계 요청 보내기'}));
        await waitFor(() =>
            expect(mocks.post).toHaveBeenCalledWith('/scopes/HOSPITAL/h1/owner-transfers', {
                targetAccountId: 9,
                leaveAfter: false,
                reauthenticationToken: 'proof',
            }),
        );
        expect(await screen.findByRole('link', {name: '알림에서 요청 확인'})).toHaveAttribute('href', '/workspace/notices');
        expect(screen.queryByRole('button', {name: '인계 요청 보내기'})).not.toBeInTheDocument();
        expect(document.querySelector('form form')).toBeNull();
    });
    it('resets proof after selecting another administrator and after closing the action', async () => {
        mount();
        await open();
        await userEvent.selectOptions(screen.getByLabelText('새 최고 관리자'), '8');
        await verify();
        await userEvent.selectOptions(screen.getByLabelText('새 최고 관리자'), '9');
        expect(screen.getByRole('button', {name: '인계 요청 보내기'})).toBeDisabled();
        expect(screen.queryByText('이메일 본인 확인 완료')).not.toBeInTheDocument();
        await userEvent.click(screen.getByText('최고 관리자 인계', {selector: 'summary'}));
        await waitFor(() => expect(screen.queryByLabelText('새 최고 관리자')).not.toBeInTheDocument());
        await open();
        expect(screen.getByLabelText('새 최고 관리자')).toHaveValue('');
        expect(screen.queryByRole('button', {name: '인증번호 받기'})).not.toBeInTheDocument();
    });
    it('never submits a proof after its expiry even when a form submission bypasses disabled controls', async () => {
        mount();
        await open();
        await userEvent.selectOptions(screen.getByLabelText('새 최고 관리자'), '8');
        await verify();
        vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 700_000);
        fireEvent.submit(screen.getByRole('form', {name: '최고 관리자 인계 요청'}));
        expect(mocks.post).not.toHaveBeenCalledWith('/scopes/HOSPITAL/h1/owner-transfers', expect.anything());
        vi.restoreAllMocks();
    });
    it('keeps a failed request available to retry and re-verifies when proof is rejected', async () => {
        mount();
        await open();
        await userEvent.selectOptions(screen.getByLabelText('새 최고 관리자'), '8');
        await verify();
        mocks.post.mockRejectedValueOnce(Object.assign(new Error('본인 확인이 필요합니다.'), {serverCode: 'REAUTHENTICATION_REQUIRED'}));
        await userEvent.click(screen.getByRole('button', {name: '인계 요청 보내기'}));
        expect(await screen.findByRole('alert')).toHaveTextContent('본인 확인이 필요합니다.');
        expect(screen.getByRole('button', {name: '인증번호 받기'})).toBeEnabled();
        expect(screen.getByRole('button', {name: '인계 요청 보내기'})).toBeDisabled();
    });
    it('sends only one request while submission is already in flight', async () => {
        mount();
        await open();
        await userEvent.selectOptions(screen.getByLabelText('새 최고 관리자'), '8');
        await verify();

        let finish!: (value: object) => void;

        mocks.post.mockReturnValueOnce(
            new Promise((resolve) => {
                finish = resolve;
            }),
        );

        const form = screen.getByRole('form', {name: '최고 관리자 인계 요청'});

        fireEvent.submit(form);
        fireEvent.submit(form);
        expect(mocks.post.mock.calls.filter(([path]) => path === '/scopes/HOSPITAL/h1/owner-transfers')).toHaveLength(1);
        expect(screen.getByRole('button', {name: '요청 중…'})).toBeDisabled();
        finish({});
        await screen.findByRole('link', {name: '알림에서 요청 확인'});
    });
});
