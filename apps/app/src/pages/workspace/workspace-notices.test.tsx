import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import {cleanup, render, screen, waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {MemoryRouter} from 'react-router';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import type * as CommercialApi from '@/features/commercial/api';
import {WorkspaceNotices, type TWorkspaceNotice} from './workspace-notices';

const mocks = vi.hoisted(() => ({get: vi.fn(), post: vi.fn()}));

vi.mock('@/features/commercial/api', async (original) => ({
    ...(await original<typeof CommercialApi>()),
    commercialGet: mocks.get,
    commercialPost: mocks.post,
}));
vi.mock('@/features/auth/model/store', () => ({default: (selector: (state: object) => unknown) => selector({accountId: 7})}));

const notices: TWorkspaceNotice[] = [
    {
        id: 'unread',
        message: '결제 예정 금액을 확인해 주세요.',
        targetPath: '/workspace/HOSPITAL/h1/billing',
        createdAt: '2026-10-22T01:00:00',
        readAt: null,
    },
    {id: 'read', message: '이벤트 이용 기간이 변경되었습니다.', targetPath: '/workspace/plans', readAt: '2026-10-22T01:00:00Z'},
];

function mount() {
    return render(
        <QueryClientProvider client={new QueryClient({defaultOptions: {queries: {retry: false}}})}>
            <MemoryRouter>
                <WorkspaceNotices />
            </MemoryRouter>
        </QueryClientProvider>,
    );
}

afterEach(cleanup);
beforeEach(() => {
    vi.clearAllMocks();
    mocks.get.mockResolvedValue(notices);
    mocks.post.mockResolvedValue(undefined);
});

describe('personal workspace notices', () => {
    it('uses actual readAt values for states, counts and filters', async () => {
        mount();
        await screen.findByText(notices[0].message);
        expect(screen.getByText('안 읽은 알림 1개')).toBeInTheDocument();
        await userEvent.click(screen.getByRole('button', {name: '안 읽음 1'}));
        expect(screen.getByText(notices[0].message)).toBeInTheDocument();
        expect(screen.queryByText(notices[1].message)).not.toBeInTheDocument();
        await userEvent.click(screen.getByRole('button', {name: '읽음 1'}));
        expect(screen.getByText(notices[1].message)).toBeInTheDocument();
        expect(screen.queryByText(notices[0].message)).not.toBeInTheDocument();
        expect(screen.queryByRole('button', {name: '읽음 표시'})).not.toBeInTheDocument();
    });
    it('marks an unread notice after server confirmation and refreshes its count', async () => {
        mocks.get.mockResolvedValueOnce(notices).mockResolvedValue(notices.map((notice) => ({...notice, readAt: '2026-10-22T02:00:00Z'})));
        mount();
        await userEvent.click(await screen.findByRole('button', {name: '읽음 표시'}));
        await waitFor(() => expect(mocks.post).toHaveBeenCalledWith('/notices/unread/read'));
        expect(await screen.findByText('안 읽은 알림 0개')).toBeInTheDocument();
        expect(screen.queryByRole('button', {name: '읽음 표시'})).not.toBeInTheDocument();
    });
    it('records a notice as read when opening its real target', async () => {
        mount();
        await screen.findByText(notices[0].message);

        const detail = screen.getAllByRole('link', {name: '자세히 보기'})[0];

        expect(detail).toHaveAttribute('href', '/workspace/HOSPITAL/h1/billing');
        await userEvent.click(detail);
        await waitFor(() => expect(mocks.post).toHaveBeenCalledWith('/notices/unread/read'));
    });
    it('does not change unread status if the read request fails', async () => {
        mocks.post.mockRejectedValue(new Error('읽음 상태를 저장하지 못했습니다.'));
        mount();
        await userEvent.click(await screen.findByRole('button', {name: '읽음 표시'}));
        expect(await screen.findByRole('alert')).toHaveTextContent('읽음 상태를 저장하지 못했습니다.');
        expect(screen.getByText('안 읽은 알림 1개')).toBeInTheDocument();
        expect(screen.getByRole('button', {name: '읽음 표시'})).toBeEnabled();
    });
    it('retries a loading failure and displays a useful empty state', async () => {
        mocks.get.mockRejectedValueOnce(new Error('알림을 불러오지 못했습니다.')).mockResolvedValue([]);
        mount();
        expect(await screen.findByRole('alert')).toHaveTextContent('알림을 불러오지 못했습니다.');
        await userEvent.click(screen.getByRole('button', {name: '다시 불러오기'}));
        expect(await screen.findByText('아직 받은 알림이 없습니다')).toBeInTheDocument();
        expect(mocks.get).toHaveBeenCalledTimes(2);
    });
    it('explains an empty unread filter and lets the user return to all notices', async () => {
        mocks.get.mockResolvedValue([notices[1]]);
        mount();
        await screen.findByText(notices[1].message);
        await userEvent.click(screen.getByRole('button', {name: '안 읽음 0'}));
        expect(screen.getByText('안 읽은 알림이 없습니다')).toBeInTheDocument();
        await userEvent.click(screen.getByRole('button', {name: '전체 알림 보기'}));
        expect(screen.getByText(notices[1].message)).toBeInTheDocument();
    });
    it('never sends the user to an external target supplied as a notice path', async () => {
        mocks.get.mockResolvedValue([{...notices[0], targetPath: 'https://example.com/unsafe'}]);
        mount();
        expect(await screen.findByRole('link', {name: '자세히 보기'})).toHaveAttribute('href', '/workspace');
    });
});
