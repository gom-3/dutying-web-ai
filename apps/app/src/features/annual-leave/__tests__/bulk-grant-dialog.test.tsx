import type {TAnnualLeavePerson} from '@dutying/api/ward';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import i18n from '@/i18n';
import {WardAPI} from '@/shared/api';
import {render, screen, userEvent, waitFor} from '@/shared/util/test-utils';
import {grantGroup} from '../bulk-grant';
import {AnnualLeaveBulkGrantDialog} from '../bulk-grant-dialog';

vi.mock('../queries', () => ({useRefreshAnnualLeave: () => async () => {}}));

const people = [1, 2, 3].map(
    (nurseId) =>
        ({
            nurseId,
            name: `간호사 ${nurseId}`,
            active: true,
            currentDays: nurseId * 7,
            openingDays: 15,
            version: 1,
            checks: [],
            shiftTeamId: 1,
            startedOn: '2026-01-01',
            balanceBasis: 'PAST_ONLY',
            reviewOn: null,
            reconciledOn: null,
            usedDays: 0,
            plannedDays: 0,
            remainingDays: nurseId * 7,
            monthDays: 0,
        }) as TAnnualLeavePerson,
);
const props = {wardId: 1, open: true, people, selectedIds: [1, 2], onClose: vi.fn(), onComplete: vi.fn(), onPendingChange: vi.fn()};

beforeEach(async () => {
    vi.restoreAllMocks();
    sessionStorage.clear();
    await i18n.changeLanguage('ko');
});
describe('bulk grant dialog', () => {
    it('previews and grants only selected people, then persists matching group IDs', async () => {
        const send = vi.spyOn(WardAPI, 'changeAnnualLeave').mockResolvedValue(undefined);

        render(<AnnualLeaveBulkGrantDialog {...props} />);
        expect(screen.getByText('2명에게 각각 1일 추가')).toBeVisible();
        expect(screen.queryByText('간호사 3')).not.toBeInTheDocument();
        await userEvent.type(screen.getByRole('textbox', {name: '추가 이유 (선택)'}), '창립기념일');
        await userEvent.click(screen.getByRole('button', {name: '연차 추가'}));
        await waitFor(() => expect(screen.queryByRole('button', {name: '미완료 대상 다시 처리'})).not.toBeInTheDocument());
        expect(screen.queryByText('모두 추가했어요. 개인별 변경 내역에 기록이 남았어요.')).not.toBeInTheDocument();
        expect(send).toHaveBeenCalledTimes(2);
        expect(send.mock.calls.map((call) => call[1])).toEqual([1, 2]);

        const groups = send.mock.calls.map((call) => grantGroup(JSON.stringify(call[2])));

        expect(groups[0]).not.toBeNull();
        expect(groups[1]).toBe(groups[0]);
        expect(send.mock.calls[0][2]).toMatchObject({kind: 'GRANT', days: 1, reason: '창립기념일'});
    });

    it('previews a deduction including negative results and submits a settlement rather than usage', async () => {
        const send = vi.spyOn(WardAPI, 'changeAnnualLeave').mockResolvedValue(undefined);

        render(<AnnualLeaveBulkGrantDialog {...props} mode="SETTLEMENT" selectedIds={[1]} />);
        await userEvent.clear(screen.getByRole('spinbutton', {name: '각자 뺄 일수'}));
        await userEvent.type(screen.getByRole('spinbutton', {name: '각자 뺄 일수'}), '10');
        expect(screen.getByText('1명에게 각각 10일 차감')).toBeVisible();
        expect(screen.getByText('→ -3일')).toBeVisible();
        expect(screen.getByText(/잔여 연차가 0일 미만/)).toBeVisible();
        await userEvent.click(screen.getByRole('button', {name: '연차 빼기'}));
        await screen.findByText('모두 차감했어요. 개인별 변경 내역에 기록이 남았어요.');
        expect(send).toHaveBeenCalledWith(1, 1, expect.objectContaining({kind: 'SETTLEMENT', days: 10, reason: '연차 일괄 빼기'}));
    });

    it('recovers an interrupted partial operation after remount and only retries the unconfirmed entry', async () => {
        const send = vi
            .spyOn(WardAPI, 'changeAnnualLeave')
            .mockResolvedValueOnce(undefined)
            .mockRejectedValueOnce(new Error('lost response'));
        const mounted = render(<AnnualLeaveBulkGrantDialog {...props} />);

        await userEvent.click(screen.getByRole('button', {name: '연차 추가'}));
        await screen.findByRole('button', {name: '미완료 대상 다시 처리'});

        const uncertainRequest = send.mock.calls[1][2];

        mounted.unmount();
        send.mockResolvedValue(undefined);
        render(<AnnualLeaveBulkGrantDialog {...props} people={people.map((person) => ({...person, version: 2}))} selectedIds={[]} />);
        await userEvent.click(screen.getByRole('button', {name: '미완료 대상 다시 처리'}));
        await waitFor(() => expect(send).toHaveBeenCalledTimes(3));
        await waitFor(() => expect(screen.queryByRole('button', {name: '미완료 대상 다시 처리'})).not.toBeInTheDocument());
        expect(screen.queryByText('모두 추가했어요. 개인별 변경 내역에 기록이 남았어요.')).not.toBeInTheDocument();
        expect(send.mock.calls[2]).toEqual([1, 2, {...uncertainRequest, version: 2}]);
    });
});
