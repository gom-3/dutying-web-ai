import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import type {TWaitingNurse} from '@/entities/nurse';
import type {TShiftTeam} from '@/entities/ward';
import {render, screen, userEvent, waitFor} from '@/shared/util/test-utils';
import ConnectionManage from '../connection-manage';

const {approveWaitingNurses, connectWaitingNurses, cancelWaiting} = vi.hoisted(() => ({
    approveWaitingNurses: vi.fn(),
    connectWaitingNurses: vi.fn(),
    cancelWaiting: vi.fn(),
}));

const waitingNurse: TWaitingNurse = {
    waitingNurseId: 142,
    nurseId: 8681,
    name: '박신청',
    gender: '',
    phoneNum: null,
    employmentDate: '',
    profileImgUrl: '',
};
const shiftTeams: TShiftTeam[] = [{shiftTeamId: 20, name: 'A팀', nurseCnt: 0, nurses: []}];

vi.mock('@/features/edit-ward', () => ({
    default: () => ({
        state: {watingNurses: [waitingNurse]},
        actions: {approveWaitingNurses, connectWaitingNurses, cancelWaiting},
    }),
}));

vi.mock('@/features/edit-shift-team', () => ({
    default: () => ({state: {shiftTeams}}),
}));

describe('ConnectionManage with an omitted phone number', () => {
    let modalRoot: HTMLDivElement;

    beforeEach(() => {
        vi.clearAllMocks();
        approveWaitingNurses.mockResolvedValue(true);
        modalRoot = document.createElement('div');
        modalRoot.id = 'modal-root';
        document.body.appendChild(modalRoot);
    });

    afterEach(() => {
        modalRoot.remove();
    });

    it('renders the request and approves it through explicit team selection', async () => {
        const user = userEvent.setup();
        render(<ConnectionManage open setOpen={vi.fn()} />);

        expect(screen.getByRole('heading', {name: '간호사가 병동 연동을 요청했어요'})).toBeInTheDocument();
        expect(screen.getByText(waitingNurse.name)).toBeInTheDocument();
        expect(screen.getByText('-')).toBeInTheDocument();
        expect(approveWaitingNurses).not.toHaveBeenCalled();

        await user.click(screen.getByRole('button', {name: '수락'}));
        expect(screen.getByRole('heading', {name: '연동 방식을 선택해 주세요'})).toBeInTheDocument();
        expect(screen.getByText('-')).toBeInTheDocument();

        await user.click(screen.getByRole('button', {name: '팀에 새로 추가'}));
        const complete = screen.getByRole('button', {name: '완료'});
        expect(complete).toBeDisabled();

        await user.click(screen.getByRole('button', {name: /A팀/}));
        expect(complete).toBeEnabled();
        expect(approveWaitingNurses).not.toHaveBeenCalled();

        await user.click(complete);
        await waitFor(() => {
            expect(screen.getByRole('heading', {name: '박신청님을 A팀에 추가했어요'})).toBeInTheDocument();
        });

        expect(approveWaitingNurses).toHaveBeenCalledExactlyOnceWith(142, 20);
        expect(connectWaitingNurses).not.toHaveBeenCalled();
        expect(cancelWaiting).not.toHaveBeenCalled();
    });
});
