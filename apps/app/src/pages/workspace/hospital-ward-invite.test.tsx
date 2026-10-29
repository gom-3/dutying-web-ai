import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import {cleanup, render, screen, waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import type * as CommercialApi from '@/features/commercial/api';
import {HospitalWardInvite} from './hospital-ward-invite';

const post = vi.hoisted(() => vi.fn());

vi.mock('@/features/commercial/api', async (original) => ({...(await original<typeof CommercialApi>()), legacyPost: post}));

function mount(canManageStaff = true) {
    return render(
        <QueryClientProvider client={new QueryClient({defaultOptions: {queries: {retry: false}}})}>
            <HospitalWardInvite
                ward={{id: 'l1', wardId: 11, name: '중환자실', status: 'MANAGED', version: 1, wardCode: 'WARD11', canManageStaff}}
                created
                onClose={vi.fn()}
            />
        </QueryClientProvider>,
    );
}

afterEach(cleanup);
beforeEach(() => {
    vi.clearAllMocks();
    post.mockResolvedValue({status: 'RESERVED'});
});

describe('hospital ward staff invitation', () => {
    it('invites the email as a ward editor and explains how to accept', async () => {
        mount();

        const user = userEvent.setup();

        await user.type(screen.getByLabelText('초대할 담당자 이메일'), 'Nurse@Example.com');
        await user.click(screen.getByRole('button', {name: '초대 메일 보내기'}));

        await waitFor(() =>
            expect(post).toHaveBeenCalledWith('/admin/wards/11/admin-emails', {email: 'nurse@example.com', role: 'EDITOR'}),
        );
        expect(screen.getByRole('status')).toHaveTextContent('같은 이메일 계정으로 수락');
        expect(screen.queryByText(/초대를 수락한 담당자는/)).not.toBeInTheDocument();
        await user.click(screen.getByRole('button', {name: '병동 담당자 권한 안내'}));
        expect(screen.getByRole('tooltip')).toHaveTextContent('병원 관리자 권한은 별도로 설정합니다.');
        expect(screen.getByLabelText('초대할 담당자 이메일')).toHaveValue('');
    });
    it('requires the matching email invitation before code entry', async () => {
        mount();
        await userEvent.click(screen.getByText('병동 코드로 안내하기'));
        expect(screen.getByText('WARD11')).toBeVisible();
        expect(screen.getByText('코드만으로는 참여할 수 없습니다.')).toBeVisible();
        await userEvent.click(screen.getByRole('button', {name: '병동 코드 사용 방법'}));
        expect(screen.getByRole('tooltip')).toHaveTextContent('이메일로 먼저 초대한 뒤 코드를 전달하세요.');
    });
    it('retains the entered email and shows an inline failure', async () => {
        post.mockRejectedValue(new Error('초대 실패'));
        mount();

        const user = userEvent.setup();

        await user.type(screen.getByLabelText('초대할 담당자 이메일'), 'nurse@example.com');
        await user.click(screen.getByRole('button', {name: '초대 메일 보내기'}));
        expect(await screen.findByRole('alert')).toBeInTheDocument();
        expect(screen.getByLabelText('초대할 담당자 이메일')).toHaveValue('nurse@example.com');
        expect(screen.queryByRole('status')).not.toBeInTheDocument();
    });
    it('does not expose invitation controls or the code without staff management permission', () => {
        mount(false);
        expect(screen.queryByRole('form')).not.toBeInTheDocument();
        expect(screen.queryByLabelText('초대할 담당자 이메일')).not.toBeInTheDocument();
        expect(screen.queryByText('WARD11')).not.toBeInTheDocument();
    });
});
