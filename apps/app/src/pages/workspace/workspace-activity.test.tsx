import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import {cleanup, render, screen, waitFor, within} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {MemoryRouter} from 'react-router';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import type * as CommercialApi from '@/features/commercial/api';
import type {AccessContext, Transfer} from '@/features/commercial/api';
import {countWorkspaceRequests, WorkspaceActivity} from './workspace-activity';

const mocks = vi.hoisted(() => ({get: vi.fn(), post: vi.fn()}));

vi.mock('@/features/commercial/api', async (original) => ({
    ...(await original<typeof CommercialApi>()),
    commercialGet: mocks.get,
    commercialPost: mocks.post,
}));
vi.mock('@/features/auth/model/store', () => ({default: (selector: (state: object) => unknown) => selector({accountId: 7})}));

const base: AccessContext = {
    enabled: true,
    scopes: [{type: 'HOSPITAL', ref: 'h1', scopeId: 's1', name: '서울병원', role: 'MANAGER'}],
    invitations: [],
    transfers: [],
};
const transfer = (extra: Partial<Transfer> = {}): Transfer => ({
    id: 'received',
    scopeType: 'HOSPITAL',
    scopeRef: 'h1',
    fromAccountId: 8,
    toAccountId: 7,
    version: 3,
    status: 'PENDING',
    expiresAt: '2099-01-01T00:00:00Z',
    ...extra,
});
const invite = {
    type: 'HOSPITAL' as const,
    name: '부산병원',
    invitation: {id: 'invite', status: 'PENDING', version: 2, expiresAt: '2099-01-01T00:00:00Z'},
};

function mount(context = base) {
    render(
        <QueryClientProvider client={new QueryClient({defaultOptions: {queries: {retry: false}}})}>
            <MemoryRouter>
                <WorkspaceActivity context={context} />
            </MemoryRouter>
        </QueryClientProvider>,
    );
}

beforeEach(() => {
    vi.clearAllMocks();
    mocks.get.mockResolvedValue([{id: 'n1', message: '병동 설정이 완료되었습니다.', targetPath: '/workspace'}]);
    mocks.post.mockResolvedValue({});
});
afterEach(cleanup);

describe('unified notifications', () => {
    it('shows notices without empty invitation and transfer sections', async () => {
        mount();
        await screen.findByText('병동 설정이 완료되었습니다.');
        expect(screen.queryByRole('heading', {name: '받은 초대'})).not.toBeInTheDocument();
        expect(screen.queryByRole('heading', {name: '최고 관리자 인계'})).not.toBeInTheDocument();
        expect(screen.queryByRole('button', {name: '인증번호 받기'})).not.toBeInTheDocument();
        expect(mocks.get).toHaveBeenCalledWith('/notices');
    });
    it('puts only actionable requests before ordinary notices and preserves invitation acceptance', async () => {
        mount({
            ...base,
            invitations: [invite, {...invite, name: '지난 초대', invitation: {...invite.invitation, id: 'closed', status: 'ACCEPTED'}}],
            transfers: [transfer(), transfer({id: 'expired', expiresAt: '2020-01-01T00:00:00Z'})],
        });
        await screen.findByText('병동 설정이 완료되었습니다.');

        const headings = screen.getAllByRole('heading', {level: 2}).map((node) => node.textContent);

        expect(headings).toEqual(['받은 초대', '최고 관리자 인계', '받은 알림']);
        expect(screen.queryByText('지난 초대')).not.toBeInTheDocument();
        expect(screen.queryByText('만료됨')).not.toBeInTheDocument();
        expect(screen.queryByRole('heading', {name: /보낸 인계 요청/})).not.toBeInTheDocument();
        await userEvent.click(screen.getByRole('button', {name: '수락하고 참여'}));
        await waitFor(() => expect(mocks.post).toHaveBeenCalledWith('/invitations/invite/ACCEPT', {expectedVersion: 2}));
        expect(screen.queryByRole('heading', {name: '받은 초대'})).not.toBeInTheDocument();
        expect(await screen.findByText('부산병원 초대를 수락했습니다.')).toBeInTheDocument();
    });
    it('retains cancellation of an outgoing pending request without asking for email verification', async () => {
        mount({...base, transfers: [transfer({id: 'sent', fromAccountId: 7, toAccountId: 9})]});

        const item = screen.getByRole('heading', {name: '서울병원'}).closest('li')!;

        expect(screen.queryByRole('heading', {name: /받은 인계 요청/})).not.toBeInTheDocument();
        expect(within(item).queryByRole('button', {name: '수락 절차 시작'})).not.toBeInTheDocument();
        await userEvent.click(within(item).getByRole('button', {name: '요청 취소'}));
        await waitFor(() =>
            expect(mocks.post).toHaveBeenCalledWith('/owner-transfers/sent/CANCEL', expect.objectContaining({expectedVersion: 3})),
        );
    });
    it('counts only incoming pending unexpired requests for the current account', () => {
        const context = {
            ...base,
            invitations: [invite, {...invite, invitation: {...invite.invitation, status: 'DECLINED'}}],
            transfers: [
                transfer(),
                transfer({id: 'sent', fromAccountId: 7, toAccountId: 9}),
                transfer({id: 'other', toAccountId: 99}),
                transfer({id: 'expired', expiresAt: '2020-01-01T00:00:00Z'}),
                transfer({id: 'accepted', status: 'ACCEPTED'}),
                transfer({id: 'malformed', expiresAt: 'bad date'}),
            ],
        };

        expect(countWorkspaceRequests(context, 7)).toBe(2);
        expect(countWorkspaceRequests(context, 9)).toBe(2);
        expect(countWorkspaceRequests(context)).toBe(0);
        expect(countWorkspaceRequests({...context, enabled: false}, 7)).toBe(0);
        expect(countWorkspaceRequests(undefined, 7)).toBe(0);
    });
});
