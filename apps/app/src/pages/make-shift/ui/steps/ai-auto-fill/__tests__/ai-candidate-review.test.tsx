import {describe, expect, it, vi} from 'vitest';
import i18n from '@/i18n';
import {render, screen} from '@/shared/util/test-utils';
import {candidate, outcome, response} from '../../../../model/__tests__/fixtures/intent-first';
import {AiCandidateReview} from '../ai-candidate-review';

const input = () => ({
    result: response({candidate: candidate(), authoringOutcome: outcome({candidateDigest: 'digest:1'})}),
    currentVersionId: 'source:1',
    current: true,
    disabled: false,
    loadVersion: vi.fn(async () => ({
        versionId: 'source:1',
        parentVersionId: null,
        year: 2026,
        month: 11,
        cells: [],
        rowOrder: [],
        carryOverCells: [],
        constraintsJson: '{}',
        inputDigest: 'input',
        createdAt: '',
    })),
    nurseName: () => '합성 간호사',
    onApply: vi.fn(),
});

describe('unavailable candidate explanation', () => {
    it('explains a changed source revision without restoring selection', () => {
        const props = input();
        render(<AiCandidateReview {...props} current={false} sourceChanged />);
        expect(screen.getByRole('status')).toHaveTextContent(i18n.t('aiConversationSidebar.authoring.candidateSourceChanged'));
        expect(screen.queryByRole('button')).toBeNull();
        expect(props.onApply).not.toHaveBeenCalled();
    });
    it('keeps an explicitly declined or superseded candidate hidden', () => {
        render(<AiCandidateReview {...input()} current={false} />);
        expect(screen.queryByRole('status')).toBeNull();
        expect(screen.queryByRole('button')).toBeNull();
    });
    it('explains expiry instead of silently dropping the review', () => {
        const props = input();
        props.result.candidate!.expiresAt = '2000-01-01T00:00:00Z';
        render(<AiCandidateReview {...props} />);
        expect(screen.getByRole('status')).toHaveTextContent(i18n.t('aiConversationSidebar.authoring.candidateExpired'));
        expect(screen.queryByRole('button')).toBeNull();
        expect(props.onApply).not.toHaveBeenCalled();
    });
});
