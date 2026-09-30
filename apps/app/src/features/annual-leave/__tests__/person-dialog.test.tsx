import type {TAnnualLeaveHistoryItem, TAnnualLeavePerson, TAnnualLeaveSettings} from '@dutying/api/ward';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import type {ReactNode} from 'react';
import {MemoryRouter} from 'react-router';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import i18n from '@/i18n';
import {WardAPI} from '@/shared/api';
import {render, screen, userEvent, waitFor} from '@/shared/util/test-utils';
import * as annualLeaveModel from '../model';
import {AnnualLeavePersonDialog} from '../person-dialog';
import type {useAnnualLeaveSchedule} from '../queries';
import {AnnualLeaveSchedulePanel} from '../schedule-panel';

const refresh = vi.fn().mockResolvedValue(undefined);

vi.mock('../queries', () => ({
    annualLeaveKey: (wardId: number) => ['annual-leave', wardId],
    useAnnualLeave: () => ({}),
    useRefreshAnnualLeave: () => refresh,
}));

const person: TAnnualLeavePerson = {
    nurseId: 20,
    name: '김간호',
    shiftTeamId: 1,
    active: true,
    version: 3,
    startedOn: '2026-01-01',
    openingDays: 15,
    balanceBasis: 'PAST_ONLY',
    reviewOn: null,
    reconciledOn: null,
    usedDays: 2,
    plannedDays: 1,
    currentDays: 13,
    remainingDays: 12,
    monthDays: 1,
    checks: ['MISSING_SCHEDULE'],
};
const settings: TAnnualLeaveSettings = {
    available: true,
    enabled: true,
    version: 1,
    startedOn: '2026-01-01',
    stoppedOn: null,
    reviewOn: null,
    unitRules: [],
};
const entry: TAnnualLeaveHistoryItem = {
    id: 42,
    kind: 'GRANT',
    effectiveOn: '2026-09-01',
    days: 2,
    voided: false,
    reason: '추가 부여 확인',
    actor: '관리자',
    createdAt: '2026-09-01T09:30:00.123456',
    sourceSnapshotId: null,
    shiftTypeId: null,
    referenceShiftTypeId: null,
    detailsJson: null,
};

function mount(node: ReactNode) {
    const client = new QueryClient({defaultOptions: {queries: {retry: false, gcTime: 0}}});

    return render(<QueryClientProvider client={client}>{node}</QueryClientProvider>);
}

beforeEach(async () => {
    vi.restoreAllMocks();
    refresh.mockClear();
    localStorage.clear();
    await i18n.changeLanguage('ko');
    vi.spyOn(WardAPI, 'getAnnualLeaveHistory').mockResolvedValue({entries: [entry], nextCursor: null});
    vi.spyOn(WardAPI, 'changeAnnualLeave').mockResolvedValue(undefined);
});

describe('annual leave edit and history views', () => {
    it('opens editing directly without view switching buttons', async () => {
        mount(<AnnualLeavePersonDialog wardId={1} person={person} settings={settings} onClose={vi.fn()} />);
        expect(WardAPI.getAnnualLeaveHistory).not.toHaveBeenCalled();
        expect(screen.getByRole('dialog', {name: '김간호 · 연차 수정'})).toBeVisible();
        expect(screen.queryByRole('button', {name: '연차 수정'})).not.toBeInTheDocument();
        expect(screen.queryByRole('button', {name: '변경 내역'})).not.toBeInTheDocument();
        expect(screen.getByRole('spinbutton', {name: '잔여 연차'})).toHaveValue(13);
    });

    it('opens history directly and reverses the chosen record in the same dialog', async () => {
        const onClose = vi.fn();

        mount(<AnnualLeavePersonDialog wardId={1} person={person} settings={settings} initialView="history" onClose={onClose} />);
        await userEvent.click(await screen.findByRole('button', {name: '이 기록 취소'}));
        expect(screen.getAllByRole('dialog')).toHaveLength(1);
        expect(screen.queryByRole('button', {name: '연차 수정'})).not.toBeInTheDocument();
        expect(screen.getByText('취소할 기록')).toBeInTheDocument();
        expect(screen.getByText(entry.reason)).toBeInTheDocument();
        expect(WardAPI.changeAnnualLeave).not.toHaveBeenCalled();
        await userEvent.type(screen.getByRole('textbox', {name: '취소 이유'}), '중복 입력');
        await userEvent.click(screen.getByRole('button', {name: '이 기록 취소'}));
        await waitFor(() => expect(onClose).toHaveBeenCalledOnce());
        expect(WardAPI.changeAnnualLeave).toHaveBeenCalledWith(
            1,
            20,
            expect.objectContaining({kind: 'REVERT', entryId: 42, reason: '중복 입력', effectiveOn: '2026-09-01'}),
        );
    });

    it('can abandon a reversal and return to history without saving', async () => {
        mount(<AnnualLeavePersonDialog wardId={1} person={person} settings={settings} initialView="history" onClose={vi.fn()} />);
        await userEvent.click(await screen.findByRole('button', {name: '이 기록 취소'}));
        await userEvent.click(screen.getByRole('button', {name: '내역으로'}));
        expect(await screen.findByText(entry.reason)).toBeInTheDocument();
        expect(screen.queryByRole('spinbutton', {name: '잔여 연차'})).not.toBeInTheDocument();
        expect(WardAPI.changeAnnualLeave).not.toHaveBeenCalled();
    });

    it.each([
        ['1일 늘리기', 14],
        ['1일 줄이기', 12],
    ])('saves the final balance after %s using the date at save time', async (button, days) => {
        const currentDate = vi.spyOn(annualLeaveModel, 'annualLeaveDate').mockReturnValue('2026-09-28');
        const onClose = vi.fn();

        mount(<AnnualLeavePersonDialog wardId={1} person={person} settings={settings} onClose={onClose} />);
        expect(screen.queryByLabelText('적용일 / 사용일')).not.toBeInTheDocument();
        expect(screen.getByRole('spinbutton', {name: '잔여 연차'})).toHaveValue(13);
        expect(screen.getByRole('button', {name: '13일로 저장'})).toBeDisabled();
        await userEvent.click(screen.getByRole('button', {name: String(button)}));
        expect(screen.getByRole('spinbutton', {name: '잔여 연차'})).toHaveValue(days);
        await userEvent.type(screen.getByRole('textbox', {name: '수정 이유 (선택)'}), '병원 자료 확인');
        currentDate.mockReturnValue('2026-09-29');
        await userEvent.click(screen.getByRole('button', {name: `${days}일로 저장`}));
        await waitFor(() => expect(onClose).toHaveBeenCalledOnce());
        expect(WardAPI.changeAnnualLeave).toHaveBeenCalledWith(
            1,
            20,
            expect.objectContaining({kind: 'SET_BALANCE', days, effectiveOn: '2026-09-29', reason: '병원 자료 확인'}),
        );
    });

    it('shows the original summary and changed balance without a date or method selector', async () => {
        mount(<AnnualLeavePersonDialog wardId={1} person={person} settings={settings} onClose={vi.fn()} />);
        expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
        expect(screen.queryByLabelText('적용일 / 사용일')).not.toBeInTheDocument();
        expect(screen.queryByText('날짜별 연차 처리')).not.toBeInTheDocument();
        expect(screen.queryByText('사용한 연차는 근무표에 연차로 표시해 주세요.')).not.toBeInTheDocument();
        expect(screen.getByText('현재 잔여 연차')).toHaveTextContent('13일');
        expect(screen.getByText('사용 예정')).toHaveTextContent('1일');
        await userEvent.click(screen.getByRole('button', {name: '1일 줄이기'}));
        expect(screen.getByRole('status')).toHaveTextContent('13일 → 12일');
        expect(screen.getByText('현재 잔여 연차')).toHaveTextContent('13일');
        expect(screen.getByText('사용 예정')).toHaveTextContent('1일');
        expect(WardAPI.changeAnnualLeave).not.toHaveBeenCalled();
    });

    it.each([
        {days: 10, reviewOn: '2026-10-15', expectedReview: null},
        {days: 0, reviewOn: '2026-09-01', expectedReview: null},
        {days: -2, reviewOn: '2026-09-28', expectedReview: null},
        {days: 0.125, reviewOn: null, expectedReview: null},
    ])('previews and saves $days as the final balance, without review reminders', async ({days, reviewOn, expectedReview}) => {
        vi.spyOn(annualLeaveModel, 'annualLeaveDate').mockReturnValue('2026-09-28');

        const onClose = vi.fn();

        mount(<AnnualLeavePersonDialog wardId={1} person={{...person, reviewOn}} settings={settings} onClose={onClose} />);
        expect(screen.queryByLabelText(/다음 확인일/)).not.toBeInTheDocument();
        expect(screen.queryByLabelText('적용일 / 사용일')).not.toBeInTheDocument();
        await userEvent.clear(screen.getByRole('spinbutton', {name: '잔여 연차'}));
        await userEvent.type(screen.getByRole('spinbutton', {name: '잔여 연차'}), String(days));
        expect(screen.getByRole('status')).toHaveTextContent(`13일 → ${days}일`);
        await userEvent.type(screen.getByRole('textbox', {name: '수정 이유 (선택)'}), '병원 확인');
        await userEvent.click(screen.getByRole('button', {name: `${days}일로 저장`}));
        await waitFor(() => expect(onClose).toHaveBeenCalledOnce());
        expect(WardAPI.changeAnnualLeave).toHaveBeenCalledWith(
            1,
            20,
            expect.objectContaining({
                kind: 'SET_BALANCE',
                days,
                effectiveOn: '2026-09-28',
                reviewOn: expectedReview,
                reason: '병원 확인',
            }),
        );
    });

    it.each(['', '   '])('saves without a user-entered reason (%j) using the action label for the audit record', async (reason) => {
        const onClose = vi.fn();

        mount(<AnnualLeavePersonDialog wardId={1} person={person} settings={settings} onClose={onClose} />);

        const input = screen.getByRole('textbox', {name: '수정 이유 (선택)'});

        expect(input).not.toBeRequired();
        await userEvent.click(screen.getByRole('button', {name: '1일 늘리기'}));

        if (reason) await userEvent.type(input, reason);

        await userEvent.click(screen.getByRole('button', {name: '14일로 저장'}));
        await waitFor(() => expect(onClose).toHaveBeenCalledOnce());
        expect(WardAPI.changeAnnualLeave).toHaveBeenCalledWith(
            1,
            20,
            expect.objectContaining({kind: 'SET_BALANCE', days: 14, reason: '연차 조절'}),
        );
    });

    it('keeps fractional days through button adjustments, allows negative leave, and avoids saving an unchanged value', async () => {
        mount(<AnnualLeavePersonDialog wardId={1} person={{...person, currentDays: 0.125}} settings={settings} onClose={vi.fn()} />);

        const input = screen.getByRole('spinbutton', {name: '잔여 연차'});

        await userEvent.click(screen.getByRole('button', {name: '1일 줄이기'}));
        expect(input).toHaveValue(-0.875);
        await userEvent.click(screen.getByRole('button', {name: '1일 늘리기'}));
        expect(input).toHaveValue(0.125);
        expect(screen.getByRole('button', {name: '0.125일로 저장'})).toBeDisabled();
        expect(WardAPI.changeAnnualLeave).not.toHaveBeenCalled();
    });

    it('requires opening registration instead of treating an unknown balance as zero', async () => {
        mount(
            <AnnualLeavePersonDialog
                wardId={1}
                person={{...person, openingDays: null, currentDays: null}}
                settings={settings}
                onClose={vi.fn()}
            />,
        );
        expect(screen.queryByRole('combobox', {name: '어떻게 변경할까요?'})).not.toBeInTheDocument();
        expect(screen.getByRole('spinbutton', {name: '현재 잔여 연차'})).toHaveValue(null);
        expect(screen.queryByRole('button', {name: '1일 늘리기'})).not.toBeInTheDocument();
    });

    it('only exposes read-only history while tracking is paused', async () => {
        mount(<AnnualLeavePersonDialog wardId={1} person={person} settings={{...settings, enabled: false}} onClose={vi.fn()} />);
        expect(await screen.findByText(entry.reason)).toBeInTheDocument();
        expect(screen.queryByRole('button', {name: '연차 수정'})).not.toBeInTheDocument();
        expect(screen.queryByRole('button', {name: '이 기록 취소'})).not.toBeInTheDocument();
    });

    it('opens each schedule action in the right view and removes table help while the dialog is open', async () => {
        const state = {
            overview: {data: {settings, people: [person]}},
            preview: {},
            managed: true,
            pending: false,
            counts: new Map([[20, 1]]),
            names: new Map([[20, person.name]]),
            request: {cells: [{nurseId: 20}]},
            data: {people: [person]},
        } as unknown as ReturnType<typeof useAnnualLeaveSchedule>;

        mount(
            <MemoryRouter>
                <AnnualLeaveSchedulePanel wardId={1} state={state} />
            </MemoryRouter>,
        );
        await userEvent.click(screen.getByRole('checkbox'));
        await userEvent.click(screen.getByRole('button', {name: '연차 계산 안내'}));
        expect(await screen.findByRole('tooltip')).toBeInTheDocument();
        await userEvent.click(screen.getByRole('button', {name: '김간호 연차 수정'}));
        expect(screen.queryByRole('tooltip', {hidden: true})).not.toBeInTheDocument();
        expect(screen.queryByRole('button', {name: '연차 수정'})).not.toBeInTheDocument();
        await userEvent.click(screen.getByRole('button', {name: '닫기'}));
        await userEvent.click(screen.getByRole('button', {name: '김간호 변경 내역'}));
        expect(await screen.findByText(entry.reason)).toBeInTheDocument();
        expect(screen.getByRole('dialog', {name: '김간호 · 변경 내역'})).toBeVisible();
        expect(screen.queryByRole('button', {name: '변경 내역'})).not.toBeInTheDocument();
        expect(screen.getAllByRole('dialog')).toHaveLength(1);
    });
});
