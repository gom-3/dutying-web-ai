import {beforeEach, expect, it, vi} from 'vitest';
import i18n from '@/i18n';
import {WardAPI} from '@/shared/api';
import * as feedback from '@/shared/util/feedback';
import {render, screen, userEvent, waitFor} from '@/shared/util/test-utils';
import {annualLeaveDate} from '../model';
import {AnnualLeaveSettingsSection} from '../settings-section';

vi.mock('../queries', () => ({
    useRefreshAnnualLeave: () => async () => {},
    useAnnualLeave: () => ({
        isPending: false,
        isError: false,
        data: {
            settings: {available: true, enabled: true, startedOn: '2026-01-01', unitRules: []},
            people: [1, 2, 3].map((id) => ({
                nurseId: id,
                name: `간호사 ${id}`,
                active: true,
                version: 0,
                openingDays: id === 3 ? 15 : null,
                currentDays: id === 3 ? 15 : null,
                checks: [],
                usedDays: 0,
                plannedDays: 0,
                remainingDays: null,
            })),
        },
    }),
}));

beforeEach(async () => {
    sessionStorage.clear();
    await i18n.changeLanguage('ko');
});
it('registers entered people using today including zero, leaving blank and registered people untouched', async () => {
    const save = vi.spyOn(WardAPI, 'initializeAnnualLeave').mockResolvedValue(undefined);

    render(<AnnualLeaveSettingsSection wardId={1} shiftTypes={[]} shiftTeams={[]} />);
    await userEvent.click(screen.getByRole('button', {name: '연차 관리 더보기'}));
    await userEvent.click(screen.getByRole('menuitem', {name: '잔여 연차 등록'}));
    expect(screen.queryByRole('spinbutton', {name: '간호사 3 현재 잔여 연차'})).not.toBeInTheDocument();
    expect(screen.queryByLabelText('집계 시작일')).not.toBeInTheDocument();
    await userEvent.type(screen.getByRole('spinbutton', {name: '간호사 1 현재 잔여 연차'}), '0');
    await userEvent.click(screen.getByRole('button', {name: '등록'}));
    await waitFor(() => expect(save).toHaveBeenCalledTimes(1));
    expect(save.mock.calls[0][1].entries).toEqual([
        expect.objectContaining({
            nurseId: 1,
            remainingDays: 0,
            startedOn: annualLeaveDate(),
            balanceBasis: 'TODAY_INCLUDED',
            reviewOn: null,
        }),
    ]);
});

it('shows selection feedback for both bulk actions and removes the static menu hint', async () => {
    const feedbackSpy = vi.spyOn(feedback, 'showValidationFeedback').mockImplementation(() => {});

    render(<AnnualLeaveSettingsSection wardId={1} shiftTypes={[]} shiftTeams={[]} />);

    for (const name of ['연차 일괄 추가', '연차 일괄 빼기']) {
        await userEvent.click(screen.getByRole('button', {name: '연차 관리 더보기'}));
        expect(screen.queryByText('일괄 처리할 사람을 먼저 선택하세요.')).not.toBeInTheDocument();
        await userEvent.click(screen.getByRole('menuitem', {name}));
        expect(feedbackSpy).toHaveBeenLastCalledWith('일괄 처리할 사람을 먼저 선택하세요.');
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    }

    expect(feedbackSpy).toHaveBeenCalledTimes(2);
    feedbackSpy.mockRestore();
});

it('opens registration for just the clicked person and submits only that person', async () => {
    const save = vi.spyOn(WardAPI, 'initializeAnnualLeave').mockResolvedValue(undefined);
    save.mockClear();
    render(<AnnualLeaveSettingsSection wardId={1} shiftTypes={[]} shiftTeams={[]} />);
    await userEvent.click(screen.getByRole('button', {name: '간호사 2 잔여 연차 입력'}));
    expect(screen.getByRole('dialog', {name: '간호사 2님의 연차 입력'})).toBeInTheDocument();
    expect(screen.queryByRole('spinbutton', {name: '간호사 1 현재 잔여 연차'})).not.toBeInTheDocument();
    await userEvent.type(screen.getByRole('spinbutton', {name: '간호사 2 현재 잔여 연차'}), '7.5');
    await userEvent.click(screen.getByRole('button', {name: '등록'}));
    await waitFor(() => expect(save).toHaveBeenCalledTimes(1));
    expect(save.mock.calls[0][1].entries).toEqual([expect.objectContaining({nurseId: 2, remainingDays: 7.5})]);
    await userEvent.click(screen.getByRole('button', {name: '연차 관리 더보기'}));
    await userEvent.click(screen.getByRole('menuitem', {name: '잔여 연차 등록'}));
    expect(screen.getByRole('spinbutton', {name: '간호사 1 현재 잔여 연차'})).toBeInTheDocument();
    expect(screen.getByRole('spinbutton', {name: '간호사 2 현재 잔여 연차'})).toHaveValue(null);
});

it('sends previous usage separately from remaining leave', async () => {
    const save = vi.spyOn(WardAPI, 'initializeAnnualLeave').mockResolvedValue(undefined);
    save.mockClear();
    render(<AnnualLeaveSettingsSection wardId={1} shiftTypes={[]} shiftTeams={[]} />);
    await userEvent.click(screen.getByRole('button', {name: '간호사 1 잔여 연차 입력'}));
    await userEvent.type(screen.getByRole('spinbutton', {name: '간호사 1 현재 잔여 연차'}), '12');
    await userEvent.type(screen.getByRole('spinbutton', {name: '간호사 1 (선택) 이전에 사용한 연차'}), '3');
    await userEvent.click(screen.getByRole('button', {name: '등록'}));
    await waitFor(() => expect(save).toHaveBeenCalledTimes(1));
    expect(save.mock.calls[0][1].entries).toEqual([
        expect.objectContaining({nurseId: 1, remainingDays: 12, previousUsedDays: 3, balanceBasis: 'TODAY_INCLUDED'}),
    ]);
});
