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

describe('clarification without condition selection', () => {
    it.each(['UNSUPPORTED', 'NEEDS_CLARIFICATION'])(
        'shows interpreted groups but asks for a natural-language correction: %s',
        async (state) => {
            const onEdit = vi.fn();
            const onApply = vi.fn();
            render(<AiSemanticReview {...props} plan={{...plan, state}} onEdit={onEdit} onApply={onApply} />);

            expect(screen.getByText('A 1일 D 배정')).toBeVisible();
            expect(screen.getByText('B 입사일부터 N 금지')).toBeVisible();
            expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
            expect(screen.queryByRole('button', {name: '선택한 조건만 다시 검증'})).not.toBeInTheDocument();
            await userEvent.click(screen.getByRole('button', {name: '요청 수정하기'}));
            expect(onEdit).toHaveBeenCalledOnce();
            expect(onApply).not.toHaveBeenCalled();
        },
    );
    it('keeps the group explanation read-only when a new plan arrives', () => {
        const {rerender} = render(<AiSemanticReview {...props} />);
        rerender(<AiSemanticReview {...props} plan={{...plan, planId: 'new'}} />);
        expect(screen.getByText('A 1일 D 배정')).toBeVisible();
        expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    });
    it('disables editing while another action is busy', async () => {
        const onEdit = vi.fn();
        render(<AiSemanticReview {...props} disabled onEdit={onEdit} />);
        const edit = screen.getByRole('button', {name: '요청 수정하기'});
        expect(edit).toBeDisabled();
        await userEvent.click(edit);
        expect(onEdit).not.toHaveBeenCalled();
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
        render(<AiSemanticReview {...props} current={false} />);

        expect(screen.queryByRole('button')).not.toBeInTheDocument();
        expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    });
});
