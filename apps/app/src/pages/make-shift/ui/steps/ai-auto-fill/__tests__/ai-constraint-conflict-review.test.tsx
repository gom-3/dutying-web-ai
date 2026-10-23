import {fireEvent, render, screen, waitFor} from '@testing-library/react';
import {describe, expect, it, vi} from 'vitest';
import i18n from '@/i18n';
import {ConstraintConflictReview} from '../ai-constraint-conflict-review';

const copy = (ko: string) => ko;
const review = {
    token: 'opaque-token',
    expiresAt: new Date(Date.now() + 60000).toISOString(),
    violations: [
        {
            violationId: 'v1',
            ruleId: 9,
            templateCode: 'SHIFT_COUNT_PER_PERIOD',
            severity: 'HARD' as const,
            message: '가상간호사의 야간근무가 월 최대 2회보다 2회 많아요.',
            affectedCells: [],
            fixable: true,
        },
    ],
};

describe('conflicting condition consent', () => {
    it('shows the exact violation and never executes without Yes', () => {
        const proceed = vi.fn(async () => {});
        const revise = vi.fn();

        render(
            <ConstraintConflictReview
                review={review}
                current
                disabled={false}
                onProceed={proceed}
                onRevise={revise}
                onEditSettings={vi.fn()}
                copy={copy}
            />,
        );
        expect(screen.getByText(review.violations[0].message)).toBeInTheDocument();
        expect(proceed).not.toHaveBeenCalled();
        fireEvent.click(screen.getByRole('button', {name: '요청 바꾸기'}));
        expect(revise).toHaveBeenCalledOnce();
        expect(proceed).not.toHaveBeenCalled();
    });
    it('uses the condition label and familiar counts rather than operator codes', () => {
        render(
            <ConstraintConflictReview
                review={{
                    ...review,
                    ruleLabels: {'9': '가상간호 야간 횟수'},
                    violations: [{...review.violations[0], messageArgs: {operator: 'MAX', expected: 2, actual: 4}}],
                }}
                current
                disabled={false}
                onProceed={vi.fn(async () => {})}
                onRevise={vi.fn()}
                onEditSettings={vi.fn()}
                copy={copy}
            />,
        );
        expect(screen.getByText('가상간호 야간 횟수')).toBeInTheDocument();
        expect(screen.getByText('설정: 최대 2회 / 결과: 4회')).toBeInTheDocument();
        expect(screen.queryByText(/MAX/)).not.toBeInTheDocument();
    });
    it('proceeds on Yes and permits recovery after a failed send', async () => {
        const proceed = vi.fn(async () => {});

        render(
            <ConstraintConflictReview
                review={review}
                current
                disabled={false}
                onProceed={proceed}
                onRevise={vi.fn()}
                onEditSettings={vi.fn()}
                copy={copy}
            />,
        );
        fireEvent.click(screen.getByRole('button', {name: '제안대로 이번 표 수정'}));
        expect(proceed).toHaveBeenCalledOnce();
        await waitFor(() => expect(screen.getByRole('button', {name: '요청 바꾸기'})).toBeEnabled());
    });
    it.each([false, true])('blocks stale or expired candidates (expired=%s)', (expired) => {
        const proceed = vi.fn(async () => {});

        render(
            <ConstraintConflictReview
                review={{...review, expiresAt: expired ? '2000-01-01T00:00:00Z' : review.expiresAt}}
                current={expired}
                disabled={false}
                onProceed={proceed}
                onRevise={vi.fn()}
                onEditSettings={vi.fn()}
                copy={copy}
            />,
        );
        expect(screen.getByRole('button', {name: '제안대로 이번 표 수정'})).toBeDisabled();
        expect(screen.getByRole('button', {name: '요청 바꾸기'})).toBeEnabled();
        fireEvent.click(screen.getByRole('button', {name: '제안대로 이번 표 수정'}));
        expect(proceed).not.toHaveBeenCalled();
    });
    it('shows understood intent and opens settings without applying a proposal', () => {
        const settings = vi.fn();
        const proceed = vi.fn(async () => {});

        render(
            <ConstraintConflictReview
                review={review}
                current
                disabled={false}
                requestSummary="월요일은 3명, 나머지 평일은 4명"
                onProceed={proceed}
                onRevise={vi.fn()}
                onEditSettings={settings}
                copy={copy}
            />,
        );
        expect(screen.getByText('월요일은 3명, 나머지 평일은 4명')).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', {name: '설정 직접 수정'}));
        expect(settings).toHaveBeenCalledOnce();
        expect(proceed).not.toHaveBeenCalled();
    });

    it.each([
        ['proceed', 'この提案を今回の勤務表に反映'],
        ['revise', 'リクエストを変更'],
        ['settings', '設定を直接変更'],
    ] as const)('shows Japanese conflict details and keeps the %s choice explicit', async (choice, label) => {
        await i18n.changeLanguage('ja');

        const proceed = vi.fn(async () => {});
        const revise = vi.fn();
        const settings = vi.fn();

        render(
            <ConstraintConflictReview
                review={{
                    ...review,
                    expiresAt: new Date(Date.now() + 60000).toISOString(),
                    violations: [{...review.violations[0], messageArgs: {operator: 'MAX', expected: 2, actual: 4}}],
                }}
                current
                disabled={false}
                onProceed={proceed}
                onRevise={revise}
                onEditSettings={settings}
                copy={copy}
            />,
        );
        expect(screen.getByRole('region', {name: '条件の競合を確認'})).toBeVisible();
        expect(screen.getByText('設定：2回以下 / 結果：4回')).toBeVisible();
        expect(screen.getByRole('button', {name: 'この提案を今回の勤務表に反映'})).toBeEnabled();
        expect(proceed).not.toHaveBeenCalled();
        expect(revise).not.toHaveBeenCalled();
        expect(settings).not.toHaveBeenCalled();
        fireEvent.click(screen.getByRole('button', {name: label}));
        await waitFor(() => expect({proceed, revise, settings}[choice]).toHaveBeenCalledOnce());

        if (choice !== 'proceed') expect(proceed).not.toHaveBeenCalled();
    });
});
