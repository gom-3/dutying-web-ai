import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import {cleanup, render, screen, waitFor, within} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import type * as CommercialApi from '@/features/commercial/api';
import type {AccessContext, Transfer} from '@/features/commercial/api';
import {WorkspaceInbox} from './workspace-inbox';

const mocks = vi.hoisted(() => ({post: vi.fn()}));

vi.mock('@/features/commercial/api', async (original) => ({...(await original<typeof CommercialApi>()), commercialPost: mocks.post}));
vi.mock('@/features/auth/model/store', () => ({default: (selector: (state: object) => unknown) => selector({accountId: 7})}));

const context: AccessContext = {
    enabled: true,
    scopes: [
        {type: 'HOSPITAL', ref: 'h1', scopeId: 's1', name: '서울병원', role: 'MANAGER'},
        {type: 'WARD', ref: '11', scopeId: 's2', name: '중환자실', role: 'EDITOR'},
    ],
    invitations: [],
    transfers: [],
};
const transfer = (id = 'transfer-1', extra: Partial<Transfer> = {}): Transfer => ({
    id,
    scopeType: 'HOSPITAL',
    scopeRef: 'h1',
    fromAccountId: 8,
    toAccountId: 7,
    version: 4,
    status: 'PENDING',
    expiresAt: '2099-12-01T00:00:00Z',
    ...extra,
});

function mount(props: Partial<Parameters<typeof WorkspaceInbox>[0]> = {}) {
    return render(
        <QueryClientProvider client={new QueryClient({defaultOptions: {queries: {retry: false}}})}>
            <WorkspaceInbox context={context} {...props} />
        </QueryClientProvider>,
    );
}

const row = (name: string) => screen.getByRole('heading', {name}).closest('li')!;

async function verify(target: HTMLElement) {
    await userEvent.click(within(target).getByRole('button', {name: '인증번호 받기'}));
    await userEvent.type(await within(target).findByLabelText('이메일 인증번호'), '123456');
    await userEvent.click(within(target).getByRole('button', {name: '본인 확인'}));
    await within(target).findByRole('checkbox');
}

afterEach(cleanup);
beforeEach(() => {
    vi.clearAllMocks();
    mocks.post.mockImplementation((path: string) =>
        Promise.resolve(
            path === '/reauthentication/confirm'
                ? {reauthenticationToken: 'proof-1', expiresAt: new Date(Date.now() + 600_000).toISOString()}
                : {},
        ),
    );
});

describe('personal invitation and transfer inbox', () => {
    it('never shows verification or responsibility controls when no transfers exist', () => {
        mount();
        expect(screen.getByText('받은 초대가 없습니다.')).toBeInTheDocument();
        expect(screen.getByText('받은 인계 요청이 없습니다.')).toBeInTheDocument();
        expect(screen.getByText('보낸 인계 요청이 없습니다.')).toBeInTheDocument();
        expect(screen.queryByRole('button', {name: '인증번호 받기'})).not.toBeInTheDocument();
        expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
        expect(mocks.post).not.toHaveBeenCalled();
    });
    it('opens verification only for a selected received request, then requires responsibility consent', async () => {
        mount({context: {...context, transfers: [transfer()]}});
        expect(screen.queryByLabelText('이메일 인증번호')).not.toBeInTheDocument();
        expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
        await userEvent.click(screen.getByRole('button', {name: '수락 절차 시작'}));
        expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
        await verify(row('서울병원'));

        const accept = screen.getByRole('button', {name: '동의하고 인계 수락'});

        expect(accept).toBeDisabled();
        await userEvent.click(screen.getByRole('checkbox'));
        await userEvent.click(accept);
        await waitFor(() =>
            expect(mocks.post).toHaveBeenCalledWith('/owner-transfers/transfer-1/ACCEPT', {
                expectedVersion: 4,
                reauthenticationToken: 'proof-1',
                stopRenewal: true,
                acceptContractResponsibility: true,
            }),
        );
        expect(screen.getByRole('status')).toHaveTextContent('서울병원의 최고 관리자 인계를 수락했습니다.');
        expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    });
    it('does not reuse a verified request’s proof or consent for another request', async () => {
        mount({context: {...context, transfers: [transfer(), transfer('transfer-2', {scopeType: 'WARD', scopeRef: '11'})]}});
        await userEvent.click(within(row('서울병원')).getByRole('button', {name: '수락 절차 시작'}));
        await verify(row('서울병원'));
        await userEvent.click(within(row('서울병원')).getByRole('checkbox'));
        await userEvent.click(within(row('중환자실')).getByRole('button', {name: '수락 절차 시작'}));
        expect(within(row('서울병원')).queryByRole('checkbox')).not.toBeInTheDocument();
        expect(within(row('중환자실')).getByRole('button', {name: '인증번호 받기'})).toBeInTheDocument();
        expect(within(row('중환자실')).queryByRole('checkbox')).not.toBeInTheDocument();
        expect(within(row('중환자실')).queryByRole('button', {name: '동의하고 인계 수락'})).not.toBeInTheDocument();
        expect(mocks.post).not.toHaveBeenCalledWith('/owner-transfers/transfer-2/ACCEPT', expect.anything());
    });
    it('shows sent transfers separately and cancels with their version without verification', async () => {
        mount({context: {...context, transfers: [transfer('sent', {fromAccountId: 7, toAccountId: 9})]}});
        expect(screen.getByText('상대 관리자의 수락 대기')).toBeInTheDocument();
        expect(screen.queryByRole('button', {name: '수락 절차 시작'})).not.toBeInTheDocument();
        expect(screen.queryByRole('button', {name: '인증번호 받기'})).not.toBeInTheDocument();
        await userEvent.click(screen.getByRole('button', {name: '요청 취소'}));
        await waitFor(() =>
            expect(mocks.post).toHaveBeenCalledWith('/owner-transfers/sent/CANCEL', {
                expectedVersion: 4,
                reauthenticationToken: 'not-required',
                stopRenewal: false,
                acceptContractResponsibility: false,
            }),
        );
    });
    it('declines a received transfer without requiring acceptance consent', async () => {
        mount({context: {...context, transfers: [transfer()]}});
        await userEvent.click(screen.getByRole('button', {name: '거절'}));
        await waitFor(() =>
            expect(mocks.post).toHaveBeenCalledWith('/owner-transfers/transfer-1/DECLINE', {
                expectedVersion: 4,
                reauthenticationToken: 'not-required',
                stopRenewal: false,
                acceptContractResponsibility: false,
            }),
        );
    });
    it('accepts hospital and ward invitations through their original endpoints', async () => {
        mount({
            context: {
                ...context,
                invitations: [
                    {
                        type: 'HOSPITAL',
                        name: '서울병원',
                        invitation: {
                            id: 'hospital-invite',
                            status: 'PENDING',
                            role: 'MANAGER',
                            version: 3,
                            expiresAt: '2099-12-01T00:00:00Z',
                        },
                    },
                    {type: 'WARD', name: '중환자실', invitation: {id: 31, status: 'PENDING', expiresAt: '2099-12-01T00:00:00Z'}},
                ],
            },
        });
        await userEvent.click(within(row('서울병원')).getByRole('button', {name: '수락하고 참여'}));
        await waitFor(() => expect(mocks.post).toHaveBeenCalledWith('/invitations/hospital-invite/ACCEPT', {expectedVersion: 3}));
        await userEvent.click(within(row('중환자실')).getByRole('button', {name: '수락하고 참여'}));
        await waitFor(() => expect(mocks.post).toHaveBeenCalledWith('/ward-invitations/31/ACCEPT', {expectedVersion: undefined}));
    });
    it('blocks expired requests and resolves a missing scope to a human label', () => {
        mount({context: {...context, transfers: [transfer('expired', {scopeRef: '12345678-abcd', expiresAt: '2020-01-01T00:00:00Z'})]}});
        expect(screen.getByRole('heading', {name: '병원 · 12345678'})).toBeInTheDocument();
        expect(screen.getByText('만료됨')).toBeInTheDocument();
        expect(screen.queryByRole('button', {name: '수락 절차 시작'})).not.toBeInTheDocument();
        expect(screen.queryByRole('button', {name: '인증번호 받기'})).not.toBeInTheDocument();
    });
    it('shows a request error and keeps it available for retry', async () => {
        mocks.post.mockRejectedValueOnce(new Error('인계 요청이 변경되었습니다.'));
        mount({context: {...context, transfers: [transfer()]}});
        await userEvent.click(screen.getByRole('button', {name: '거절'}));
        expect(await screen.findByRole('alert')).toHaveTextContent('인계 요청이 변경되었습니다.');
        expect(screen.getByRole('button', {name: '거절'})).toBeEnabled();
    });
    it('supports loading and retry states without displaying protected forms', async () => {
        const retry = vi.fn();
        const view = mount({loading: true});

        expect(screen.getByRole('status')).toHaveTextContent('받은 요청을 불러오는 중입니다.');
        view.unmount();
        mount({error: new Error('연결을 확인해 주세요.'), onRetry: retry});
        await userEvent.click(screen.getByRole('button', {name: '다시 불러오기'}));
        expect(retry).toHaveBeenCalledTimes(1);
        expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    });
});
