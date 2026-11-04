import {describe, expect, it, vi} from 'vitest';
import {render, screen, userEvent, waitFor} from '@/shared/util/test-utils';
import {candidate, outcome, response} from '../../../../model/__tests__/fixtures/intent-first';
import type {TResultVersion} from '../../../../model/schedule-conversation-api';
import {AiCandidateReview} from '../ai-candidate-review';
import {AiRequestOutcome} from '../ai-request-outcome';

const measured = {
    clauseId: 'off',
    kind: 'DIRECTIONAL' as const,
    status: 'IMPROVED' as const,
    before: 5,
    after: 2,
    affectedCells: [],
    displayText: '하루짜리 휴무 줄이기',
    metricKey: 'PATTERN_COUNT',
};

describe('nurse request outcomes', () => {
    it('shows each part of a compound request without claiming unverified fulfillment', () => {
        render(
            <AiRequestOutcome
                result={response({
                    authoringOutcome: outcome({
                        clauses: [
                            measured,
                            {...measured, clauseId: 'review', kind: 'REVIEW', status: 'UNVERIFIED', displayText: '덜 힘들게 배치'},
                        ],
                    }),
                })}
            />,
        );
        expect(screen.getByText('5회 → 2회')).toBeVisible();
        expect(screen.getByText('덜 힘들게 배치')).toBeVisible();
        expect(screen.getByText('원하신 배치인지 확인해 주세요')).toBeVisible();
        expect(screen.getAllByText('5회 → 2회')).toHaveLength(1);
    });
    it.each(['EXACT', 'REVIEW'] as const)('never formats a %s verification score as shift occurrences', (kind) => {
        render(<AiRequestOutcome result={response({authoringOutcome: outcome({clauses: [{...measured, kind}]})})} />);
        expect(screen.queryByText('5회 → 2회')).not.toBeInTheDocument();
    });
    it('does not expose unverified engine values as confirmed observations', () => {
        const value = outcome({clauses: [measured]});

        value.validation.spring = 'UNAVAILABLE';

        const {container} = render(<AiRequestOutcome result={response({authoringOutcome: value})} />);

        expect(container).toBeEmptyDOMElement();
    });
    it('keeps unknown measurements unknown', () => {
        render(
            <AiRequestOutcome
                result={response({authoringOutcome: outcome({clauses: [{...measured, before: null, status: 'UNVERIFIED'}]})})}
            />,
        );
        expect(screen.queryByText(/회 →/)).not.toBeInTheDocument();
    });
});

const source: TResultVersion = {
    versionId: 'source:1',
    parentVersionId: null,
    year: 2026,
    month: 11,
    cells: [],
    rowOrder: [],
    carryOverCells: [],
    constraintsJson: '{}',
    inputDigest: '',
    createdAt: '',
};

function props() {
    return {
        result: response({
            applicable: false,
            changedCells: [],
            validationTarget: 'CANDIDATE',
            candidate: candidate(),
            authoringOutcome: outcome({draftState: 'PREVIEW_ONLY', candidateDigest: 'digest:1'}),
        }),
        currentVersionId: 'source:1',
        current: true,
        disabled: false,
        loadVersion: vi.fn().mockResolvedValue(source),
        nurseName: () => '가상 간호사',
        onApply: vi.fn(),
    };
}

describe('candidate comparison admission', () => {
    it('allows retrying a failed source read before any application', async () => {
        const input = props();

        input.loadVersion.mockRejectedValueOnce(new Error('offline'));
        render(<AiCandidateReview {...input} />);
        expect(await screen.findByText(/이 변경안을 확인할 수 없어/)).toBeVisible();
        expect(screen.queryByRole('button', {name: '이 변경안 반영하기'})).not.toBeInTheDocument();
        await userEvent.click(screen.getByRole('button', {name: '계산 결과 다시 확인하기'}));
        await waitFor(() => expect(screen.getByRole('button', {name: '이 변경안 반영하기'})).toBeEnabled());
        expect(input.onApply).not.toHaveBeenCalled();
    });
    it('rejects a mismatched source version even if the fetch succeeds', async () => {
        const input = props();

        input.loadVersion.mockResolvedValue({...source, versionId: 'other'});
        render(<AiCandidateReview {...input} />);
        expect(await screen.findByText(/이 변경안을 확인할 수 없어/)).toBeVisible();
        expect(screen.queryByRole('button', {name: '이 변경안 반영하기'})).not.toBeInTheDocument();
    });
    it('never offers application of a historical candidate', async () => {
        const input = props();

        render(<AiCandidateReview {...input} current={false} />);
        await waitFor(() => expect(input.loadVersion).toHaveBeenCalled());
        expect(screen.queryByRole('button', {name: '이 변경안 반영하기'})).not.toBeInTheDocument();
        expect(input.onApply).not.toHaveBeenCalled();
    });
});
