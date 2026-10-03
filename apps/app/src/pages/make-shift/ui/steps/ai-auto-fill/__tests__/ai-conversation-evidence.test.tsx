import type {TAutofillResponse, TQualitySidebar, TFailureSuggestion} from '@dutying/api/ward';
import {describe, it, expect, vi} from 'vitest';
import {render, screen, userEvent} from '@/shared/util/test-utils';
import {ConversationEvidence} from '../ai-conversation-evidence';

const quality: TQualitySidebar = {
    contractVersion: 'quality-sidebar-v1',
    comparisonState: 'PARTIAL',
    observedRelation: 'TRADEOFF',
    unknownReasons: ['NEXT_MONTH_RECOVERY_UNKNOWN'],
    byNurse: [],
    harm: [
        {
            metricId: 'offTargetDeviation',
            comparableNurseCount: 2,
            unknownNurseIds: ['3'],
            worsenedNurseIds: ['2'],
            worsenedNurseCount: 1,
            maxWorsening: 6,
        },
    ],
};
const candidate: TFailureSuggestion = {
    suggestionId: 's',
    inputDigest: 'd',
    baseRevision: 0,
    expiresAt: '2099-01-01T00:00:00Z',
    verificationStatus: 'VERIFIED_FEASIBLE',
    applyEnabled: true,
    changes: [{kind: 'NUMERIC_GOAL', oldValue: 12, proposedValue: 11, reason: '휴무 목표 한 단계 조정'}],
    impact: {affectedNurseCount: 1, maxIndividualDeterioration: null},
};
const response = (q: TQualitySidebar | undefined, s: TFailureSuggestion[] = []): TAutofillResponse =>
    ({
        operationType: 'ADJUST',
        draftRevision: 0,
        resultType: 'PATCH',
        changedCells: [],
        validation: {draftRevision: 0, rulesHash: 'r', summary: {hardCount: 0, softCount: 0, valid: true, totalCount: 0}, violations: []},
        unmetInstructions: [],
        sameAsPrevious: true,
        engineResult: {status: 'ACCEPTED', qualitySidebar: q},
        failure: {reasonCode: 'TEST', message: 'test', suggestions: s},
    }) as TAutofillResponse;

describe('conversation result evidence', () => {
    it('shows individual harm and unknown coverage together', async () => {
        render(
            <ConversationEvidence
                result={response(quality)}
                nurseName={(id) => id}
                suggestionsCurrent
                disabled={false}
                onSelect={vi.fn()}
            />,
        );
        await userEvent.click(screen.getByText(/품질 전후 변화/));
        expect(screen.getByText(/비교 2명 · 악화 1명 · 최대 손해 6 · 평가 안 됨 1명/)).toBeInTheDocument();
        expect(screen.getByText('개선과 손해가 함께 있음')).toBeInTheDocument();
    });
    it('selects a verified candidate without executing and preserves unknown impact', async () => {
        const select = vi.fn();

        render(
            <ConversationEvidence
                result={response(undefined, [candidate])}
                nurseName={(id) => id}
                suggestionsCurrent
                disabled={false}
                onSelect={select}
            />,
        );
        expect(screen.getByText(/최대 개인 손해 평가 안 됨/)).toBeInTheDocument();
        await userEvent.click(screen.getByRole('button', {name: '후보 선택'}));
        expect(select).toHaveBeenCalledWith(candidate);
    });
    it('blocks stale or unauthorized candidates', () => {
        render(
            <ConversationEvidence
                result={response(undefined, [candidate])}
                nurseName={(id) => id}
                suggestionsCurrent={false}
                disabled={false}
                onSelect={vi.fn()}
            />,
        );
        expect(screen.getByRole('button', {name: '후보 선택'})).toBeDisabled();
    });
});
