import {fireEvent, render, screen, waitFor, within} from '@testing-library/react';
import {describe, expect, it, vi} from 'vitest';
import type {TSemanticPlan} from '../../../../model/schedule-conversation-api';
import {AiSemanticReview} from '../ai-semantic-review';

describe('readable request scope', () => {
    it.each([true, false])('uses people for a single-day headcount and counts for a monthly total: %s', (singleDay) => {
        const plan: TSemanticPlan = {
            planId: 'p',
            planHash: 'h',
            sourceVersionId: 'v',
            state: 'PREVIEW_READY',
            summary: '',
            confirmationAllowed: true,
            reasonCodes: [],
            conditions: [
                {
                    intentId: 'i',
                    action: 'COUNT',
                    nurseIds: [1, 2],
                    dates: singleDay ? ['2026-10-05'] : ['2026-10-01', '2026-10-02'],
                    shiftCodes: ['O'],
                    quantifier: 'GROUP_TOTAL',
                    modality: 'HARD',
                    operator: 'EXACT',
                    count: 7,
                    sourceSpan: {quote: '휴무 인원 7명'},
                },
            ],
        };

        render(
            <AiSemanticReview
                plan={plan}
                current
                disabled={false}
                stale={false}
                applied={false}
                processing={null}
                rosterNurseIds={[2, 1]}
                nurseName={(id) => `간호사${id}`}
                copy={(ko) => ko}
                onApply={vi.fn()}
                onEdit={vi.fn()}
                onRetry={vi.fn()}
            />,
        );
        expect(screen.getByText('전체 간호사')).toBeVisible();
        expect(screen.getByRole('region')).toHaveTextContent(
            singleDay ? '휴무 인원을 정확히 7명으로 맞춰요.' : '합계 정확히 7회 배정해요.',
        );
    });
    it('does not label a selected subset as the whole roster', () => {
        const plan: TSemanticPlan = {
            planId: 'p',
            planHash: 'h',
            sourceVersionId: 'v',
            state: 'PREVIEW_READY',
            summary: '',
            confirmationAllowed: true,
            reasonCodes: [],
            conditions: [
                {
                    intentId: 'i',
                    action: 'ASSIGN',
                    nurseIds: [1],
                    dates: ['2026-10-05'],
                    shiftCodes: ['D'],
                    quantifier: 'EACH',
                    modality: 'HARD',
                    operator: null,
                    count: null,
                    sourceSpan: {quote: '간호사1 D'},
                },
            ],
        };

        render(
            <AiSemanticReview
                plan={plan}
                current
                disabled={false}
                stale={false}
                applied={false}
                processing={null}
                rosterNurseIds={[1, 2]}
                nurseName={(id) => `간호사${id}`}
                copy={(ko) => ko}
                onApply={vi.fn()}
                onEdit={vi.fn()}
                onRetry={vi.fn()}
            />,
        );
        expect(screen.getByText('간호사1님')).toBeVisible();
        expect(screen.queryByText('전체 간호사')).not.toBeInTheDocument();
    });
});

const priorityPlan: TSemanticPlan = {
    planId: 'priority',
    planHash: 'hash1',
    sourceVersionId: 'v',
    state: 'PREVIEW_READY',
    summary: '',
    confirmationAllowed: true,
    reasonCodes: [],
    modalityEditableIntentIds: ['count1', 'count2'],
    conditions: [1, 2].map((id) => ({
        intentId: `count${id}`,
        action: 'COUNT',
        nurseIds: [id],
        dates: ['2026-11-01'],
        shiftCodes: ['D'],
        quantifier: 'EACH',
        modality: 'HARD',
        operator: 'MAX',
        count: 1,
        sourceSpan: {quote: '데이 최대 1회'},
    })),
};

function priorityProps() {
    return {
        plan: priorityPlan,
        current: true,
        disabled: false,
        stale: false,
        applied: false,
        processing: null,
        nurseName: (id: number) => `간호사${id}`,
        copy: (ko: string) => ko,
        onApply: vi.fn(),
        onEdit: vi.fn(),
        onRetry: vi.fn(),
        onChangeModalities: vi.fn().mockResolvedValue(undefined),
    };
}

describe('request priority controls', () => {
    it('batches changes, blocks execution before saving and can cancel without a request', async () => {
        const props = priorityProps();

        render(<AiSemanticReview {...props} />);

        const groups = screen.getAllByRole('group', {name: '반영 방식'});

        fireEvent.click(within(groups[0]!).getByRole('radio', {name: '권장'}));
        fireEvent.click(within(groups[1]!).getByRole('radio', {name: '권장'}));
        expect(screen.getByRole('button', {name: '이대로 수정하기'})).toBeDisabled();
        expect(props.onChangeModalities).not.toHaveBeenCalled();
        expect(screen.getByText('반영 방식 변경은 이번 실행에만 적용돼요.')).toBeVisible();
        fireEvent.click(screen.getByRole('button', {name: '변경 취소'}));
        expect(screen.getByRole('button', {name: '이대로 수정하기'})).toBeEnabled();
        expect(screen.getAllByRole('radio', {name: '필수'}).every((input) => (input as HTMLInputElement).checked)).toBe(true);
        fireEvent.click(within(groups[0]!).getByRole('radio', {name: '권장'}));
        fireEvent.click(within(groups[1]!).getByRole('radio', {name: '권장'}));
        fireEvent.click(screen.getByRole('button', {name: '변경한 조건 확인하기'}));
        await waitFor(() => expect(props.onChangeModalities).toHaveBeenCalledExactlyOnceWith({count1: 'SOFT', count2: 'SOFT'}));
        expect(props.onApply).not.toHaveBeenCalled();
    });
    it('retains edits after a save failure and resets them for a new server hash', async () => {
        const props = priorityProps();

        props.onChangeModalities.mockRejectedValue(new Error('offline'));

        const {rerender} = render(<AiSemanticReview {...props} />);

        fireEvent.click(screen.getAllByRole('radio', {name: '권장'})[0]!);
        fireEvent.click(screen.getByRole('button', {name: '변경한 조건 확인하기'}));
        expect(await screen.findByRole('alert')).toHaveTextContent('변경 내용을 저장하지 못했어요');
        expect(screen.getAllByRole('radio', {name: '권장'})[0]).toBeChecked();
        expect(screen.getByRole('button', {name: '이대로 수정하기'})).toBeDisabled();
        rerender(<AiSemanticReview {...props} plan={{...priorityPlan, planId: 'new', planHash: 'hash2'}} />);
        expect(screen.queryByRole('button', {name: '변경한 조건 확인하기'})).not.toBeInTheDocument();
        expect(screen.getAllByRole('radio', {name: '필수'})[0]).toBeChecked();
    });
    it.each([{current: false}, {stale: true}, {disabled: true}, {plan: {...priorityPlan, modalityEditableIntentIds: undefined}}])(
        'prevents editing stale, historical, busy or old-server plans: %j',
        (override) => {
            render(<AiSemanticReview {...priorityProps()} {...override} />);

            for (const radio of screen.queryAllByRole('radio')) expect(radio).toBeDisabled();
        },
    );
    it('explains fixed assignment and exclusion semantics without offering unsupported soft controls', () => {
        render(
            <AiSemanticReview
                {...priorityProps()}
                plan={{...priorityPlan, conditions: [{...priorityPlan.conditions[0]!, action: 'FORBID'}], modalityEditableIntentIds: []}}
            />,
        );
        expect(screen.queryByRole('radio')).not.toBeInTheDocument();
        expect(screen.getByText(/지정·금지한 배정은 필수로 적용해요/)).toBeVisible();
    });
});
