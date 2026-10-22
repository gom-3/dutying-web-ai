import {fireEvent, render, screen, waitFor} from '@testing-library/react';
import {describe, expect, it, vi} from 'vitest';
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
        render(<ConstraintConflictReview review={review} current disabled={false} onProceed={proceed} onRevise={revise} copy={copy} />);
        expect(screen.getByText(review.violations[0].message)).toBeInTheDocument();
        expect(proceed).not.toHaveBeenCalled();
        fireEvent.click(screen.getByRole('button', {name: '요청 수정'}));
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
                copy={copy}
            />,
        );
        expect(screen.getByText('가상간호 야간 횟수')).toBeInTheDocument();
        expect(screen.getByText('설정: 최대 2회 / 결과: 4회')).toBeInTheDocument();
        expect(screen.queryByText(/MAX/)).not.toBeInTheDocument();
    });
    it('proceeds on Yes and permits recovery after a failed send', async () => {
        const proceed = vi.fn(async () => {});
        render(<ConstraintConflictReview review={review} current disabled={false} onProceed={proceed} onRevise={vi.fn()} copy={copy} />);
        fireEvent.click(screen.getByRole('button', {name: '이번에는 진행'}));
        expect(proceed).toHaveBeenCalledOnce();
        await waitFor(() => expect(screen.getByRole('button', {name: '요청 수정'})).toBeEnabled());
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
                copy={copy}
            />,
        );
        expect(screen.getByRole('button', {name: '이번에는 진행'})).toBeDisabled();
        expect(screen.getByRole('button', {name: '요청 수정'})).toBeEnabled();
        fireEvent.click(screen.getByRole('button', {name: '이번에는 진행'}));
        expect(proceed).not.toHaveBeenCalled();
    });
});
