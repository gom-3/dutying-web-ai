import type {TAnnualLeaveHistoryItem} from '@dutying/api/ward';
import {beforeEach, describe, expect, it} from 'vitest';
import i18n from '@/i18n';
import {render, screen, userEvent} from '@/shared/util/test-utils';
import {AnnualLeaveHistoryEntry} from '../history-entry';

const base: TAnnualLeaveHistoryItem = {
    id: 1,
    kind: 'GRANT',
    effectiveOn: '2026-09-01',
    days: 2,
    voided: false,
    reason: '병원 자료 확인',
    actor: '관리자',
    createdAt: '2026-09-28T10:30:00.123456',
    sourceSnapshotId: null,
    shiftTypeId: null,
    referenceShiftTypeId: null,
    detailsJson: null,
};

beforeEach(async () => {
    await i18n.changeLanguage('ko');
});

describe('annual leave history values', () => {
    it.each([
        ['GRANT', '일괄 추가', 2, '+2일'],
        ['SETTLEMENT', '일괄 차감', -2, '-2일'],
    ])('shows a %s bulk badge and persisted operation ID', async (kind, label, days, amount) => {
        const group = '0123456789abcdef0123456789abcdef';

        render(
            <ul>
                <AnnualLeaveHistoryEntry
                    entry={{...base, kind: String(kind), days: Number(days), detailsJson: JSON.stringify({requestId: `bulk_${group}_20`})}}
                    today="2026-09-28"
                />
            </ul>,
        );
        expect(screen.getByText(String(label))).toBeVisible();
        expect(screen.getByText(String(amount))).toBeVisible();
        await userEvent.click(screen.getByRole('button', {name: /기록 정보/}));
        expect(screen.getByText(group)).toBeVisible();
    });

    it.each([
        ['GRANT', 2, '+2일', '증가'],
        ['SETTLEMENT', -3, '-3일', '감소'],
        ['CORRECTION', -0.125, '-0.125일', '감소'],
        ['SET_BALANCE', 2, '+2일', '증가'],
        ['SET_BALANCE', 0, '0일', '변동 없음'],
    ])('shows %s as a signed change, not a new remaining balance', (kind, days, value, label) => {
        render(
            <ul>
                <AnnualLeaveHistoryEntry entry={{...base, kind, days}} today="2026-09-28" />
            </ul>,
        );
        expect(screen.getByText(value)).toBeInTheDocument();
        expect(screen.getByText(label)).toBeInTheDocument();
    });

    it.each([
        ['2026-10-08', '사용 예정 · 차감 전'],
        ['2026-09-28', '등록된 사용량'],
    ])('shows a schedule quantity without suggesting an additional deduction (%s)', (effectiveOn, label) => {
        render(
            <ul>
                <AnnualLeaveHistoryEntry entry={{...base, kind: 'SCHEDULE', days: 1, effectiveOn}} today="2026-09-28" />
            </ul>,
        );
        expect(screen.getByText('1일')).toBeInTheDocument();
        expect(screen.getByText(label)).toBeInTheDocument();
        expect(screen.queryByText('-1일')).not.toBeInTheDocument();
    });

    it('shows cancellation as a state instead of a misleading zero-day change', () => {
        render(
            <ul>
                <AnnualLeaveHistoryEntry entry={{...base, days: 0, voided: true}} today="2026-09-28" />
            </ul>,
        );
        expect(screen.getByText('취소됨')).toBeInTheDocument();
        expect(screen.getByText('기록을 취소했어요')).toBeInTheDocument();
        expect(screen.queryByText('0일')).not.toBeInTheDocument();
    });

    it('keeps an unknown opening amount distinct from zero', () => {
        render(
            <ul>
                <AnnualLeaveHistoryEntry
                    entry={{...base, kind: 'OPENING', days: 0, detailsJson: '{"remainingDays":null}'}}
                    today="2026-09-28"
                />
            </ul>,
        );
        expect(screen.getByText('미입력')).toBeInTheDocument();
        expect(screen.queryByText('0일')).not.toBeInTheDocument();
    });

    it('keeps source and author available in an expandable record-details section', async () => {
        render(
            <ul>
                <AnnualLeaveHistoryEntry entry={{...base, sourceSnapshotId: 3}} today="2026-09-28" />
            </ul>,
        );
        expect(screen.getByText('관리자')).not.toBeVisible();
        await userEvent.click(screen.getByText('기록 정보'));
        expect(screen.getByText('관리자')).toBeVisible();
        expect(screen.getByText('2026-09-28 10:30')).toBeVisible();
        expect(screen.getByText('확정본 #3')).toBeVisible();
    });
});
