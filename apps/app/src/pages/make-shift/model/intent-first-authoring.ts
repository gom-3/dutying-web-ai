import type {TAutofillResponse, TAuthoringOutcome} from '@dutying/api/ward';

function clausesAllowApplication(outcome: TAuthoringOutcome) {
    return (
        Array.isArray(outcome.clauses) &&
        outcome.clauses.every((clause) => {
            if (!['EXACT', 'DIRECTIONAL', 'REVIEW'].includes(clause.kind)) return false;

            if (clause.kind === 'EXACT') return ['SATISFIED', 'ALREADY_SATISFIED'].includes(clause.status);

            if (clause.status === 'UNSATISFIED') return clause.kind === 'DIRECTIONAL' && outcome.requestState === 'PARTIAL';

            if (clause.status === 'UNVERIFIED') return outcome.requestState === 'NEEDS_REVIEW';

            return ['SATISFIED', 'ALREADY_SATISFIED', 'IMPROVED', 'UNCHANGED'].includes(clause.status);
        })
    );
}

export const INTENT_FIRST_CONTRACT = 'intent-first-v1' as const;

/** Engine metadata alone cannot authorize a new application contract. */
export function authoringOutcome(response: TAutofillResponse): TAuthoringOutcome | undefined {
    const outcome = response.authoringOutcome;

    return outcome?.contractVersion === INTENT_FIRST_CONTRACT &&
        Array.isArray(outcome.clauses) &&
        outcome.validation &&
        outcome.violationDelta &&
        ['unchanged', 'improved', 'resolved', 'new', 'worsened'].every((key) =>
            Array.isArray(outcome.violationDelta[key as keyof typeof outcome.violationDelta]),
        ) &&
        Array.isArray(outcome.appliedConcessionIds)
        ? outcome
        : undefined;
}

export function canApplyAuthoringResult(response: TAutofillResponse, sourceVersionId?: string, expectedCandidateDigest?: string): boolean {
    const outcome = authoringOutcome(response);

    if (!outcome) return !response.authoringOutcome && !response.engineResult?.authoringOutcome;

    return (
        response.applicable === true &&
        response.validationTarget === 'RESULT' &&
        outcome.draftState === 'APPLICABLE' &&
        outcome.solveState === 'FEASIBLE' &&
        ['SATISFIED', 'IMPROVED', 'PARTIAL', 'NEEDS_REVIEW'].includes(outcome.requestState) &&
        outcome.validation?.python === 'VERIFIED' &&
        outcome.validation?.spring === 'VERIFIED' &&
        outcome.validation?.protection === 'PASS' &&
        outcome.validation?.completeTarget === true &&
        Boolean(outcome.baselineVersionId) &&
        (!sourceVersionId || outcome.baselineVersionId === sourceVersionId) &&
        (!expectedCandidateDigest || outcome.candidateDigest === expectedCandidateDigest) &&
        clausesAllowApplication(outcome)
    );
}

export function canSelectAuthoringCandidate(response: TAutofillResponse, sourceVersionId: string, now = Date.now()): boolean {
    const outcome = authoringOutcome(response);
    const candidate = response.candidate;

    return Boolean(
        outcome &&
            candidate &&
            ['CONSENT_REQUIRED', 'PREVIEW_ONLY'].includes(outcome.draftState) &&
            outcome.solveState === 'FEASIBLE' &&
            outcome.validation?.python === 'VERIFIED' &&
            outcome.validation?.spring === 'VERIFIED' &&
            outcome.validation?.protection === 'PASS' &&
            outcome.validation?.completeTarget === true &&
            response.validationTarget === 'CANDIDATE' &&
            response.applicable === false &&
            response.changedCells.length === 0 &&
            outcome.baselineVersionId === sourceVersionId &&
            candidate.sourceVersionId === sourceVersionId &&
            candidate.candidateDigest &&
            candidate.candidateDigest === outcome.candidateDigest &&
            candidate.token &&
            Date.parse(candidate.expiresAt) > now &&
            candidate.changedCells.length > 0 &&
            clausesAllowApplication(outcome),
    );
}

/** A finished search is distinct from whether the request succeeded. */
export function authoringMessageKey(response: TAutofillResponse) {
    const outcome = authoringOutcome(response);

    if (!outcome) return undefined;

    if (outcome.draftState === 'APPLICABLE' && !canApplyAuthoringResult(response)) return 'UNKNOWN';

    if (['BUSY', 'UNKNOWN', 'INFEASIBLE_PROVEN', 'INVALID_INPUT', 'ERROR'].includes(outcome.solveState))
        return outcome.solveState as 'BUSY' | 'UNKNOWN' | 'INFEASIBLE_PROVEN' | 'INVALID_INPUT' | 'ERROR';

    if (outcome.solveState === 'NOT_RUN' && outcome.requestState === 'NEEDS_REVIEW' && outcome.draftState === 'NONE')
        return 'STRATEGY_ONLY';

    if (outcome.requestState === 'NEEDS_REVIEW' && outcome.draftState === 'APPLICABLE') return 'NEEDS_REVIEW';

    if (outcome.draftState === 'CONSENT_REQUIRED') return 'CONSENT_REQUIRED';

    if (outcome.draftState === 'PREVIEW_ONLY') return 'NEEDS_REVIEW';

    return outcome.requestState;
}
