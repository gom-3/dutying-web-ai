import {describe, expect, it, vi} from 'vitest';
import i18n from '@/i18n';
import {render, screen, userEvent} from '@/shared/util/test-utils';
import {candidate, outcome, response} from '../../../../model/__tests__/fixtures/intent-first';
import {AiAuthoringCandidate} from '../ai-authoring-candidate';
import {AiConversationResult} from '../ai-conversation-result';

const props = () => ({
    result: response({
        changedCells: [],
        applicable: false,
        validationTarget: 'CANDIDATE',
        candidate: candidate({selectionReason: 'QUALITATIVE_REVIEW'}),
        authoringOutcome: outcome({draftState: 'PREVIEW_ONLY', requestState: 'NEEDS_REVIEW', candidateDigest: 'digest:1'}),
    }),
    sourceVersionId: 'source:1',
    baseline: [{...candidate().changedCells[0]!, shiftCode: 'O'}],
    nurseName: () => '합성 간호사 A',
    current: true,
    disabled: false,
    onApply: vi.fn(),
});

describe('reviewable authoring candidate', () => {
    it('shows the actual before/after diff and waits for explicit selection', async () => {
        const input = props();

        render(<AiAuthoringCandidate {...input} />);
        expect(screen.getByRole('table')).toHaveTextContent('합성 간호사 A');
        expect(screen.getByRole('cell', {name: 'O'})).toBeVisible();
        expect(screen.getByRole('cell', {name: 'D'})).toBeVisible();
        expect(input.onApply).not.toHaveBeenCalled();
        await userEvent.click(screen.getByRole('button', {name: i18n.t('aiConversationSidebar.authoring.apply')}));
        expect(input.onApply).toHaveBeenCalledOnce();
    });
    it('retains an expired candidate diff but disables execution', () => {
        const input = props();

        input.result.candidate!.expiresAt = '2000-01-01T00:00:00Z';
        render(<AiAuthoringCandidate {...input} />);
        expect(screen.getByRole('table')).toBeVisible();
        expect(screen.getByRole('button', {name: i18n.t('aiConversationSidebar.authoring.apply')})).toBeDisabled();
        expect(screen.getByRole('status')).toHaveTextContent(i18n.t('aiConversationSidebar.authoring.expired'));
    });
    it('keeps the original table without sending consent', async () => {
        const input = props();

        render(<AiAuthoringCandidate {...input} />);
        await userEvent.click(screen.getByRole('button', {name: i18n.t('aiConversationSidebar.authoring.keep')}));
        expect(input.onApply).not.toHaveBeenCalled();
        expect(screen.getByRole('table')).toBeVisible();
        expect(screen.queryByRole('button', {name: i18n.t('aiConversationSidebar.authoring.apply')})).toBeNull();
    });
    it.each(['PARTIAL', 'NEEDS_REVIEW', 'NO_IMPROVEMENT', 'ALREADY_SATISFIED'] as const)(
        'does not show an adjustment-success icon for %s',
        (requestState) => {
            render(
                <AiConversationResult
                    operation={{
                        operationId: 'op:1',
                        sequence: 1,
                        operationType: 'ADJUST',
                        sourceVersionId: 'source:1',
                        resultVersionId: 'result:1',
                        interpretationId: null,
                        baseRevision: 0,
                        executionStatus: 'SUCCEEDED',
                        applyStatus: requestState === 'PARTIAL' || requestState === 'NEEDS_REVIEW' ? 'APPLIED' : 'NOT_APPLIED_NO_CHANGE',
                        fillPolicy: null,
                        failureReason: null,
                        createdAt: '',
                        result: response({
                            authoringOutcome: outcome({
                                requestState,
                                draftState:
                                    requestState === 'NO_IMPROVEMENT' || requestState === 'ALREADY_SATISFIED' ? 'NONE' : 'APPLICABLE',
                            }),
                        }),
                    }}
                    attempt={1}
                    feedbackDisabled={false}
                    onReport={vi.fn()}
                    copy={(ko) => ko}
                />,
            );
            expect(
                screen.getByText(
                    i18n.t(`aiConversationSidebar.authoring.${requestState === 'NEEDS_REVIEW' ? 'selectedReview' : requestState}`),
                ),
            ).toBeVisible();
            expect(screen.queryByRole('img', {name: /adjustmentSucceeded|수정 완료|수정 성공/})).toBeNull();
        },
    );
});
