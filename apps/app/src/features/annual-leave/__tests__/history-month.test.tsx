import type {
    TAnnualLeaveDay,
    TAnnualLeaveHistoryItem,
    TAnnualLeaveOverview,
    TAnnualLeavePerson,
    TAnnualLeaveSettings,
} from '@dutying/api/ward';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import i18n from '@/i18n';
import {WardAPI} from '@/shared/api';
import {render, screen, userEvent} from '@/shared/util/test-utils';
import {annualLeaveMonthUsage, annualLeaveScheduleChanges, groupAnnualLeaveHistory} from '../history-model';
import {AnnualLeaveHistoryMonth} from '../history-month';

const settings: TAnnualLeaveSettings = {
    available: true,
    enabled: true,
    version: 1,
    startedOn: '2026-09-01',
    stoppedOn: null,
    reviewOn: null,
    unitRules: [],
};
const person: TAnnualLeavePerson = {
    nurseId: 20,
    name: '김간호',
    shiftTeamId: 1,
    active: true,
    version: 1,
    startedOn: '2026-09-01',
    openingDays: 15,
    balanceBasis: 'PAST_ONLY',
    reviewOn: null,
    reconciledOn: null,
    usedDays: 0,
    plannedDays: 1,
    currentDays: 15,
    remainingDays: 14,
    monthDays: 1,
    checks: [],
};
const entry: TAnnualLeaveHistoryItem = {
    id: 1,
    kind: 'SCHEDULE',
    effectiveOn: '2026-10-09',
    days: 4,
    voided: false,
    reason: '이전 확정 기록',
    actor: '관리자',
    createdAt: '2026-09-28T09:00:00',
    sourceSnapshotId: 1,
    shiftTypeId: 1,
    referenceShiftTypeId: null,
    detailsJson: null,
};
const day = (date: string, days: number, nurseId = 20, source: TAnnualLeaveDay['source'] = 'SCHEDULE'): TAnnualLeaveDay => ({
    nurseId,
    date,
    days,
    source,
    shiftTypeId: 1,
    referenceShiftTypeId: null,
    entryId: null,
    needsReview: false,
    partialWork: false,
});
const overview = (days: TAnnualLeaveDay[]): TAnnualLeaveOverview => ({
    settings,
    today: '2026-09-28',
    from: '2026-10-01',
    to: '2026-10-31',
    people: [person],
    days,
    preview: false,
});

function mount(month = '2026-10', member = person, entries = [entry]) {
    const client = new QueryClient({defaultOptions: {queries: {retry: false, gcTime: 0}}});

    render(
        <QueryClientProvider client={client}>
            <ul>
                <AnnualLeaveHistoryMonth
                    wardId={1}
                    person={member}
                    settings={settings}
                    month={month}
                    entries={entries}
                    today="2026-09-28"
                />
            </ul>
        </QueryClientProvider>,
    );
}

beforeEach(async () => {
    vi.restoreAllMocks();
    await i18n.changeLanguage('ko');
    vi.spyOn(WardAPI, 'getAnnualLeave').mockResolvedValue(overview([day('2026-10-08', 1)]));
});

describe('monthly schedule history', () => {
    it('hides ordinary zero records and repeated quantities, retaining actual changes and cancellations', () => {
        const revisions = [
            {...entry, id: 1, days: 0},
            {...entry, id: 2, days: 1},
            {...entry, id: 3, days: 1, sourceSnapshotId: 2},
            {...entry, id: 4, days: 0.5},
            {...entry, id: 5, days: 0, voided: true},
            {...entry, id: 6, days: 0},
            {...entry, id: 7, days: 1},
            {...entry, id: 8, days: 0, effectiveOn: '2026-10-10'},
        ];

        expect(annualLeaveScheduleChanges(revisions)).toMatchObject([
            {entry: {id: 7}, kind: 'recorded'},
            {entry: {id: 5}, kind: 'removed', previousDays: 0.5},
            {entry: {id: 4}, kind: 'changed', previousDays: 1},
            {entry: {id: 2}, kind: 'recorded'},
        ]);
        expect(groupAnnualLeaveHistory([{...entry, days: 0}])).toEqual([]);
    });

    it('shows each used date once without an extra explanation or duplicate change list', async () => {
        const entries = Array.from({length: 31}, (_, index) => ({
            ...entry,
            id: index + 1,
            effectiveOn: `2026-10-${String(index + 1).padStart(2, '0')}`,
            days: index === 7 ? 1 : 0,
        }));

        mount('2026-10', person, entries);
        await screen.findByText('1일');
        await userEvent.click(screen.getByRole('button', {name: '날짜별 보기'}));
        expect(screen.getAllByText('2026.10.08')).toHaveLength(1);
        expect(screen.queryByText(/연차 변경 기록/)).not.toBeInTheDocument();
        expect(screen.queryByText('확정 근무표·직접 처리 기준')).not.toBeInTheDocument();
        expect(screen.queryByText(/31건/)).not.toBeInTheDocument();
        expect(screen.queryByText('0일')).not.toBeInTheDocument();
        expect(screen.queryByText('이전 확정 기록')).not.toBeInTheDocument();
        expect(screen.queryByRole('button', {name: '기록 정보'})).not.toBeInTheDocument();
    });

    it('keeps a real removal visible without a meaningless zero-day label', async () => {
        mount('2026-10', person, [{...entry, id: 2, days: 0, voided: true}, entry]);
        await userEvent.click(screen.getByRole('button', {name: '날짜별 보기'}));
        await screen.findByText('연차 취소');
        expect(screen.getByText('연차 취소')).toBeVisible();
        expect(screen.getByText('4일 취소')).toBeVisible();
        expect(screen.queryByText('0일')).not.toBeInTheDocument();
    });

    it('combines revisions across pages into one month while retaining manual entries and year boundaries', () => {
        const manual = {...entry, id: 4, kind: 'GRANT'};
        const groups = groupAnnualLeaveHistory([
            {...entry, id: 5},
            manual,
            {...entry, id: 3, effectiveOn: '2025-10-01'},
            {...entry, id: 2, days: 0, voided: true},
            {...entry, id: 2, days: 0, voided: true},
        ]);

        expect(groups).toHaveLength(3);
        expect(groups[0]).toMatchObject({kind: 'month', month: '2026-10', entries: [{id: 5}, {id: 2, days: 0, voided: true}]});
        expect(groups[1]).toEqual({kind: 'entry', entry: manual});
        expect(groups[2]).toMatchObject({kind: 'month', month: '2025-10'});
    });

    it('uses resolved monthly usage rather than showing superseded revisions again', async () => {
        mount();
        expect(await screen.findByText('1일')).toBeInTheDocument();
        expect(screen.getByText('사용 예정 · 차감 전')).toBeInTheDocument();
        expect(screen.queryByText('4일')).not.toBeInTheDocument();
        expect(WardAPI.getAnnualLeave).toHaveBeenCalledWith(1, '2026-10-01', '2026-10-31');
        await userEvent.click(screen.getByRole('button', {name: '날짜별 보기'}));
        expect(screen.getByText('2026.10.08')).toBeVisible();
        expect(screen.queryByText('4일')).not.toBeInTheDocument();
    });

    it('splits usage through today from future usage, including resolved overrides without double counting', async () => {
        const days = [
            day('2026-09-28', 0.125),
            day('2026-09-30', 0.5, 20, 'DAY_USAGE'),
            day('2026-09-27', 0),
            day('2026-09-30', 9, 99),
            day('2026-10-01', 5),
        ];

        expect(annualLeaveMonthUsage(days, 20, '2026-09', '2026-09-28')).toMatchObject({used: 0.125, planned: 0.5});
        vi.mocked(WardAPI.getAnnualLeave).mockResolvedValue(overview(days));
        mount('2026-09');
        expect(await screen.findByText('0.125일')).toBeInTheDocument();
        expect(screen.getByText('0.5일')).toBeInTheDocument();
        expect(screen.getByText('사용')).toBeInTheDocument();
        expect(screen.getByText('사용 예정 · 차감 전')).toBeInTheDocument();
    });

    it('does not fabricate a zero total on failure and supports retry', async () => {
        vi.mocked(WardAPI.getAnnualLeave).mockRejectedValueOnce(new Error('offline'));
        mount();

        const retry = await screen.findByRole('button', {name: '다시 불러오기'});

        expect(screen.queryByText('0일')).not.toBeInTheDocument();
        await userEvent.click(retry);
        expect(await screen.findByText('1일')).toBeInTheDocument();
    });

    it('keeps records from a previous tracking period without presenting current totals as historical totals', async () => {
        mount('2026-08', person, [{...entry, effectiveOn: '2026-08-09'}]);
        expect(screen.getByText('이전 집계 기간의 기록')).toBeInTheDocument();
        expect(WardAPI.getAnnualLeave).not.toHaveBeenCalled();
        expect(screen.queryByText('0일')).not.toBeInTheDocument();
        await userEvent.click(screen.getByRole('button', {name: '날짜별 보기'}));
        await userEvent.click(screen.getByText('연차 반영'));
        expect(screen.getByText('이전 확정 기록')).toBeVisible();
    });
});
