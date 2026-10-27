import type {TAutofillResponse} from '@dutying/api/ward';
import {describe, expect, it, vi} from 'vitest';
import i18n from '@/i18n';
import {render, screen} from '@/shared/util/test-utils';
import {candidate, response} from '../../../../model/__tests__/fixtures/intent-first';
import {authoringOutcome, canApplyAuthoringResult, canSelectAuthoringCandidate} from '../../../../model/intent-first-authoring';
import {AiAuthoringCandidate} from '../ai-authoring-candidate';
import {AiConversationResult} from '../ai-conversation-result';

function partialResult() {
    const result = response();

    result.authoringOutcome!.validation.coverage = 'PARTIAL';
    result.authoringOutcome!.validation.unknownCellKeys = ['1:2026-11-02'];

    return result;
}

function withheld(result: TAutofillResponse) {
    result.applicable = false;
    result.changedCells = [];
    result.validationTarget = 'CANDIDATE';
    result.candidate = candidate();
    result.authoringOutcome!.draftState = 'CONSENT_REQUIRED';
    result.authoringOutcome!.candidateDigest = result.candidate.candidateDigest;

    return result;
}

function candidateCard(result: TAutofillResponse) {
    return (
        <AiAuthoringCandidate
            result={result}
            sourceVersionId="source:1"
            baseline={[]}
            nurseName={() => '합성 간호사 A'}
            current
            disabled={false}
            onApply={vi.fn()}
        />
    );
}

function resultCard(result: TAutofillResponse, nestedCandidate = false) {
    return (
        <AiConversationResult
            operation={{
                operationId: 'partial:1',
                sequence: 1,
                operationType: 'ADJUST',
                fillPolicy: null,
                sourceVersionId: 'source:1',
                resultVersionId: result.candidate ? null : 'result:1',
                interpretationId: null,
                baseRevision: 0,
                executionStatus: 'SUCCEEDED',
                applyStatus: result.candidate ? 'NOT_APPLIED_REVIEW' : 'APPLIED',
                failureReason: null,
                result,
                createdAt: '',
            }}
            attempt={1}
            copy={(ko) => ko}
        >
            {nestedCandidate && candidateCard(result)}
        </AiConversationResult>
    );
}

describe('partial table validation notice', () => {
    it.each([
        {locale: 'ko', copy: '빈칸이 있어 일부 조건은 아직 확인하지 못했어요.'},
        {locale: 'ja', copy: '空欄があるため、まだ確認できていない条件があります。'},
    ])('shows the public partial coverage on applied results in $locale without blocking application', async ({locale, copy}) => {
        await i18n.changeLanguage(locale);

        try {
            const result = partialResult();

            expect(canApplyAuthoringResult(result, 'source:1')).toBe(true);
            render(resultCard(result));
            expect(screen.getByRole('status')).toHaveTextContent(copy);
            expect(screen.queryByText(/전체.*완료|위반 0|すべて.*確認済み/)).toBeNull();
        } finally {
            await i18n.changeLanguage('ko');
        }
    });
    it.each(['ko', 'ja'])('shows the public partial coverage on candidates in %s while preserving selection', async (locale) => {
        await i18n.changeLanguage(locale);

        try {
            const result = withheld(partialResult());

            expect(canSelectAuthoringCandidate(result, 'source:1')).toBe(true);
            render(candidateCard(result));
            expect(screen.getByRole('status')).toHaveTextContent(i18n.t('aiConversationSidebar.authoring.partialCoverage'));
            expect(screen.getByRole('button', {name: i18n.t('aiConversationSidebar.authoring.apply')})).toBeEnabled();
            expect(screen.getByRole('button', {name: i18n.t('aiConversationSidebar.authoring.keep')})).toBeEnabled();
        } finally {
            await i18n.changeLanguage('ko');
        }
    });
    it('preserves public coverage and unknown coordinates through JSON reading without replacing the final outcome', () => {
        const result = partialResult();
        const decoded = JSON.parse(JSON.stringify(result)) as TAutofillResponse;

        expect(authoringOutcome(decoded)).toBe(decoded.authoringOutcome);
        expect(authoringOutcome(decoded)?.validation).toMatchObject({coverage: 'PARTIAL', unknownCellKeys: ['1:2026-11-02']});
        expect(canApplyAuthoringResult(decoded, 'source:1')).toBe(true);
    });
    it('shows one notice when the result wraps a candidate', () => {
        const result = withheld(partialResult());

        render(resultCard(result, true));
        expect(screen.getAllByText(i18n.t('aiConversationSidebar.authoring.partialCoverage'))).toHaveLength(1);
    });
    it.each(['result', 'candidate'] as const)('keeps existing full %s cards unchanged when coverage is absent', (kind) => {
        const result = kind === 'candidate' ? withheld(response()) : response();

        render(kind === 'candidate' ? candidateCard(result) : resultCard(result));
        expect(screen.queryByText(i18n.t('aiConversationSidebar.authoring.partialCoverage'))).toBeNull();
    });
    it.each(['result', 'candidate'] as const)('does not derive public %s coverage from Python engine metadata', (kind) => {
        const result = kind === 'candidate' ? withheld(response()) : response();

        Object.assign(result.engineResult!, {
            partialValidation: {coverage: 'PARTIAL', unknownCellKeys: ['1:2026-11-02']},
            authoringOutcome: {...result.authoringOutcome, validation: {...result.authoringOutcome!.validation, coverage: 'PARTIAL'}},
        });
        render(kind === 'candidate' ? candidateCard(result) : resultCard(result));
        expect(screen.queryByText(i18n.t('aiConversationSidebar.authoring.partialCoverage'))).toBeNull();
    });
});
