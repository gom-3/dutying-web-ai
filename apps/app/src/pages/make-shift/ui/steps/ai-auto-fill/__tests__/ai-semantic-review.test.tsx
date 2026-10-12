import {render, screen} from '@testing-library/react';
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
