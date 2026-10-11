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
        await userEvent.click(screen.getByText(/이전 표와 비교/));
        expect(screen.getByText(/비교 2명 · 이전보다 불리해진 1명 · 비교할 정보가 없는 1명/)).toBeInTheDocument();
        expect(screen.getByText('가장 크게 불리해진 차이: 6일')).toBeInTheDocument();
        expect(screen.queryByText(/NEXT_MONTH_RECOVERY_UNKNOWN/)).not.toBeInTheDocument();
        expect(screen.getByText(/다음 달/)).toBeInTheDocument();
        expect(screen.getByText('좋아진 항목과 나빠진 항목이 함께 있어요.')).toBeInTheDocument();
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
        expect(screen.getByText(/개인별 변화는 아직 확인할 수 없어요/)).toBeInTheDocument();
        await userEvent.click(screen.getByRole('button', {name: '변경 제안 보기'}));
        expect(select).toHaveBeenCalledWith(candidate);
    });
    it.each(['expired', 'invalid date'])('blocks a suggestion with an unusable expiration: %s', expiresAt => {
        render(<ConversationEvidence result={response(undefined, [{...candidate, expiresAt}])} nurseName={id => id} suggestionsCurrent disabled={false} onSelect={vi.fn()} />);
        expect(screen.getByRole('button', {name: '변경 제안 보기'})).toBeDisabled();
    });
    it('shows percentage point differences and hides unknown reason codes', async () => {
        render(<ConversationEvidence result={response({...quality, unknownReasons: ['NEW_ENGINE_REASON'], harm: [{...quality.harm[0]!, metricId: 'fragmentationRate', maxWorsening: 0.125}]})} nurseName={id => id} suggestionsCurrent disabled={false} onSelect={vi.fn()} />);
        await userEvent.click(screen.getByText(/이전 표와 비교/));
        expect(screen.getByText('가장 크게 불리해진 차이: 12.5%p')).toBeInTheDocument();
        expect(screen.queryByText(/NEW_ENGINE_REASON/)).not.toBeInTheDocument();
    });
    it('explains supported suggestion changes without object strings or priority codes', () => {
        render(<ConversationEvidence result={response(undefined, [{...candidate, changes: [{kind: 'REQUEST_REMOVE', oldValue: {severity: 'SOFT'}, proposedValue: null}, {kind: 'REQUEST_PRIORITY', oldValue: 'NORMAL', proposedValue: 'LOW'}]}])} nurseName={id => id} suggestionsCurrent disabled={false} onSelect={vi.fn()} />);
        expect(screen.getByText('가능하면 맞추기로 한 요청을 이번 계산에서 제외해요.')).toBeInTheDocument();
        expect(screen.getByText('가능하면 맞추기로 한 요청의 우선순위를 보통에서 낮음으로 바꿔요.')).toBeInTheDocument();
        expect(screen.queryByText(/\[object Object\]|NORMAL|LOW|SOFT/)).not.toBeInTheDocument();
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
        expect(screen.getByRole('button', {name: '변경 제안 보기'})).toBeDisabled();
    });
});
