import {render, screen} from '@testing-library/react';
import {describe, expect, it, vi} from 'vitest';
import {AiExecutionFailure} from '../ai-execution-failure';
import i18n from '@/i18n';

vi.mock('../../../../model/make-shift-store', () => ({
    useMakeShiftStore: (selector: (state: {currentShiftTeamId: number}) => unknown) => selector({currentShiftTeamId: 12}),
}));

describe('rest eligibility recovery', () => {
    it('opens member settings in a new tab without offering unrelated retry or request edits', () => {
        render(
            <AiExecutionFailure
                failure={{message: '휴무 확인', blocked: false, recovery: 'settings'}}
                active
                onRetry={vi.fn()}
                onRevise={vi.fn()}
                onReview={vi.fn()}
            />,
        );
        const link = screen.getByRole('link', {name: i18n.t('aiAdjust.executionFailure.memberSettings')});
        expect(link).toHaveAttribute('href', '/member?shiftTeamId=12');
        expect(link).toHaveAttribute('target', '_blank');
        expect(link).toHaveAttribute('rel', 'noopener noreferrer');
        expect(screen.queryByRole('button', {name: i18n.t('aiAdjust.failure.retry')})).not.toBeInTheDocument();
        expect(screen.queryByRole('button', {name: i18n.t('aiAdjust.issue.edit')})).not.toBeInTheDocument();
        expect(screen.getByRole('button', {name: i18n.t('aiAdjust.executionFailure.review')})).toBeInTheDocument();
    });
});
