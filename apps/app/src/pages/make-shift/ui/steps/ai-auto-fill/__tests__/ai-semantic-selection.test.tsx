import {describe, expect, it, vi} from 'vitest';
import {render, screen, userEvent} from '@/shared/util/test-utils';
import type {TSemanticPlan} from '../../../../model/schedule-conversation-api';
import {AiSemanticReview} from '../ai-semantic-review';

const groups = [
    {
        conditionId: 'supported',
        sourceSpan: {start: 0, end: 8, quote: 'A 1일 D 배정'},
        intentIds: ['i1'],
        status: 'SUPPORTED' as const,
        reasonCodes: [],
        selectable: true,
    },
    {
        conditionId: 'unsupported',
        sourceSpan: {start: 9, end: 20, quote: 'B 입사일부터 N 금지'},
        intentIds: [],
        status: 'UNSUPPORTED' as const,
        reasonCodes: ['UNSUPPORTED_CAPABILITY'],
        selectable: false,
    },
];
const plan: TSemanticPlan = {
    planId: 'parent',
    planHash: 'a'.repeat(64),
    sourceVersionId: 'v1',
    state: 'UNSUPPORTED',
    summary: '지원하지 않는 조건',
    confirmationAllowed: false,
    reasonCodes: ['UNSUPPORTED_CAPABILITY'],
    conditions: [],
    conditionGroups: groups,
};
const props = {
    plan,
    current: true,
    disabled: false,
    stale: false,
    applied: false,
    processing: null,
    nurseName: String,
    copy: (ko: string) => ko,
    onApply: vi.fn(),
    onEdit: vi.fn(),
    onRetry: vi.fn(),
};

describe('explicit partial selection', () => {
    it.each(['UNSUPPORTED', 'NEEDS_CLARIFICATION'])(
        'starts empty and sends only explicitly checked supported IDs without executing: %s',
        async (state) => {
            const onSelectConditions = vi.fn();

            render(<AiSemanticReview {...props} plan={{...plan, state}} onSelectConditions={onSelectConditions} />);

            const action = screen.getByRole('button', {name: '선택한 조건만 다시 검증'});
            const checks = screen.getAllByRole('checkbox');

            expect(action).toBeDisabled();
            expect(checks[0]).not.toBeChecked();
            expect(checks[1]).toBeDisabled();
            expect(onSelectConditions).not.toHaveBeenCalled();
            await userEvent.click(checks[1]);
            expect(checks[1]).not.toBeChecked();
            expect(action).toBeDisabled();
            await userEvent.click(checks[0]);
            await userEvent.click(action);
            expect(onSelectConditions).toHaveBeenCalledWith(['supported']);
            expect(onSelectConditions).toHaveBeenCalledOnce();
            expect(props.onApply).not.toHaveBeenCalled();
            expect(props.onRetry).not.toHaveBeenCalled();
        },
    );
    it('blocks stale selection and clears selection when a new plan arrives', async () => {
        const onSelectConditions = vi.fn();
        const {rerender} = render(<AiSemanticReview {...props} onSelectConditions={onSelectConditions} />);

        await userEvent.click(screen.getAllByRole('checkbox')[0]);
        rerender(<AiSemanticReview {...props} stale onSelectConditions={onSelectConditions} />);
        expect(screen.getAllByRole('checkbox')[0]).toBeDisabled();
        expect(screen.getByRole('button', {name: '선택한 조건만 다시 검증'})).toBeDisabled();
        await userEvent.click(screen.getByRole('button', {name: '선택한 조건만 다시 검증'}));
        expect(onSelectConditions).not.toHaveBeenCalled();
        rerender(<AiSemanticReview {...props} plan={{...plan, planId: 'new'}} onSelectConditions={onSelectConditions} />);
        expect(screen.getAllByRole('checkbox')[0]).not.toBeChecked();
        expect(screen.getByRole('button', {name: '선택한 조건만 다시 검증'})).toBeDisabled();
    });
    it('prevents selecting or revalidating conditions while another action is busy', async () => {
        const onSelectConditions = vi.fn();
        const {rerender} = render(<AiSemanticReview {...props} onSelectConditions={onSelectConditions} />);

        await userEvent.click(screen.getAllByRole('checkbox')[0]);
        rerender(<AiSemanticReview {...props} disabled onSelectConditions={onSelectConditions} />);
        expect(screen.getAllByRole('checkbox')[0]).toBeDisabled();
        expect(screen.getByRole('button', {name: '선택한 조건만 다시 검증'})).toBeDisabled();
        await userEvent.click(screen.getByRole('button', {name: '선택한 조건만 다시 검증'}));
        expect(onSelectConditions).not.toHaveBeenCalled();
    });
    it.each([true, false])('keeps applied and excluded source records without making another selection: current=%s', async (current) => {
        render(
            <AiSemanticReview
                {...props}
                current={current}
                plan={{
                    ...plan,
                    state: 'PREVIEW_READY',
                    confirmationAllowed: true,
                    selectionAudit: {
                        sourcePreviewId: 'p1',
                        originalText: 'original',
                        conditionGroups: groups,
                        selectedConditionIds: ['supported'],
                        excludedConditionIds: ['unsupported'],
                    },
                }}
            />,
        );
        expect(screen.getByText('제외:')).not.toBeVisible();
        await userEvent.click(screen.getByText('선택 내역 보기'));
        expect(screen.getByText('포함:')).toBeInTheDocument();
        expect(screen.getByText('제외:')).toBeInTheDocument();
        expect(screen.getByText('B 입사일부터 N 금지')).toBeInTheDocument();
        expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
        expect(screen.queryByRole('button', {name: '선택한 조건만 다시 검증'})).not.toBeInTheDocument();

        if (!current) expect(screen.queryByRole('button')).not.toBeInTheDocument();
    });
    it('shows historical unsupported requests without interactive selection controls', () => {
        render(<AiSemanticReview {...props} current={false} onSelectConditions={vi.fn()} />);

        expect(screen.queryByRole('button')).not.toBeInTheDocument();
        expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    });
});
