import {fireEvent, render, screen} from '@testing-library/react';
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

it('keeps the verified alternative visible with a review action and no automatic retry', () => {
    const revise = vi.fn();
    const message = i18n.t('aiAdjust.executionFailure.verifiedNightCap', {name: '테스트 간호사', current: 2, proposed: 4});
    render(
        <AiExecutionFailure
            failure={{message, blocked: false, recovery: 'revise'}}
            active
            operationType="GENERATE"
            onRevise={revise}
            onRetry={vi.fn()}
        />,
    );
    expect(screen.getByText(/2회에서 4회/)).toBeInTheDocument();
    expect(screen.getByText(/미리 정한 근무와 다른 설정/)).toBeInTheDocument();
    expect(screen.queryByRole('button', {name: i18n.t('aiAdjust.failure.retry')})).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', {name: i18n.t('aiAdjust.issue.edit')}));
    expect(revise).toHaveBeenCalledTimes(1);
});

it('explains the proven staffing conflict in Japanese and offers only unapplied choices', async () => {
    const {aiExecutionFailure} = await import('../../../../model/ai-execution-failure');
    const {default: translator} = await import('@/i18n');
    await translator.changeLanguage('ja');
    try {
        const failure = aiExecutionFailure({
            operationType: 'GENERATE',
            draftRevision: 1,
            resultType: 'PATCH',
            changedCells: [],
            applicable: false,
            unmetInstructions: [],
            sameAsPrevious: true,
            validation: {
                draftRevision: 1,
                rulesHash: 'test',
                summary: {valid: false, hardCount: 0, softCount: 0, totalCount: 0},
                violations: [],
            },
            engineResult: {
                status: 'INFEASIBLE',
                violations: [{type: 'STAFF_COUNT_BOUNDS_CONFLICT', date: '2026-11-02', shiftCode: 'N12', minimum: 4, maximum: 3}],
            },
        });
        expect(failure).not.toBeNull();
        expect(failure!.message).toContain('最低4名と最大3名');
        expect(failure!.message).not.toMatch(/INFEASIBLE|STAFF_COUNT|[가-힣]|could not/);
        const revise = vi.fn();
        const settings = vi.fn();
        const retry = vi.fn();
        const view = render(
            <AiExecutionFailure
                failure={failure!}
                active
                onRevise={revise}
                onEditSettings={settings}
                onRetry={retry}
                operationType="GENERATE"
            />,
        );
        expect(screen.getByText(/2026-11-02.*N12/)).toBeInTheDocument();
        expect(screen.queryByRole('button', {name: translator.t('aiAdjust.failure.retry')})).not.toBeInTheDocument();
        expect(screen.queryByRole('button', {name: translator.t('aiAutofillUi.conflictReview.proceed')})).not.toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', {name: translator.t('aiAdjust.issue.edit')}));
        fireEvent.click(screen.getByRole('button', {name: translator.t('aiAutofillUi.conflictReview.editSettings')}));
        expect(revise).toHaveBeenCalledTimes(1);
        expect(settings).toHaveBeenCalledTimes(1);
        expect(retry).not.toHaveBeenCalled();
        view.unmount();
    } finally {
        await translator.changeLanguage('ko');
    }
});

it('keeps settings available when request adjustment is unavailable', () => {
    const settings = vi.fn();
    render(
        <AiExecutionFailure
            failure={{message: '確認', blocked: false, recovery: 'revise', conditionConflict: true}}
            active
            onEditSettings={settings}
        />,
    );
    fireEvent.click(screen.getByRole('button', {name: i18n.t('aiAutofillUi.conflictReview.editSettings')}));
    expect(settings).toHaveBeenCalledTimes(1);
});

it('renders failure reasons as semantic bullet items', () => {
    render(<AiExecutionFailure failure={{message: '생성을 완료하지 못했어요.\n• 기존 표는 그대로예요.', blocked: false}} />);
    expect(screen.getAllByRole('listitem').map((item) => item.textContent)).toEqual([
        '생성을 완료하지 못했어요.', '기존 표는 그대로예요.',
    ]);
});
