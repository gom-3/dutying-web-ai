import type {TAutofillResponse} from '@dutying/api/ward';
import {describe, expect, it} from 'vitest';
import {aiExecutionFailure} from '../ai-execution-failure';
import {authoringMessageKey, canApplyAuthoringResult, canSelectAuthoringCandidate} from '../intent-first-authoring';
import {candidate, outcome, response} from './fixtures/intent-first';
import fixture from './fixtures/intent-first-v1.json';

describe('intent-first application boundaries', () => {
    it('applies a validated editable draft independently of approvability, hard count and optimality', () => {
        expect(canApplyAuthoringResult(response(), 'source:1')).toBe(true);
        expect(aiExecutionFailure(response())).toBeNull();
    });
    it.each(['spring', 'python', 'protection', 'completeTarget'] as const)('requires actual final %s verification', (field) => {
        const result = response();

        Object.assign(result.authoringOutcome!.validation, {
            [field]: field === 'completeTarget' ? false : field === 'protection' ? 'UNKNOWN' : 'UNAVAILABLE',
        });
        expect(canApplyAuthoringResult(result, 'source:1')).toBe(false);
        expect(authoringMessageKey(result)).toBe('UNKNOWN');
    });
    it('rejects engine-only metadata and a mismatched source version', () => {
        const result = response();

        expect(canApplyAuthoringResult(result, 'other')).toBe(false);
        result.engineResult!.authoringOutcome = result.authoringOutcome;
        delete result.authoringOutcome;
        expect(canApplyAuthoringResult(result)).toBe(false);
        expect(aiExecutionFailure(result)).not.toBeNull();
    });
    it('blocks unsatisfied exact clauses even with an applicable label', () => {
        const result = response({
            authoringOutcome: outcome({
                requestState: 'PARTIAL',
                clauses: [{clauseId: 'exact:1', kind: 'EXACT', status: 'UNSATISFIED', before: 0, after: 0, affectedCells: []}],
            }),
        });

        expect(canApplyAuthoringResult(result)).toBe(false);
    });
    it('allows selected qualitative drafts without claiming qualitative fulfillment', () => {
        const result = response({
            authoringOutcome: outcome({
                requestState: 'NEEDS_REVIEW',
                clauses: [{clauseId: 'review:1', kind: 'REVIEW', status: 'UNVERIFIED', before: null, after: null, affectedCells: []}],
            }),
        });

        expect(canApplyAuthoringResult(result)).toBe(true);
        expect(authoringMessageKey(result)).toBe('NEEDS_REVIEW');
    });
    it.each(['PREVIEW_ONLY', 'CONSENT_REQUIRED'] as const)(
        'keeps %s cells separate and binds consent to digest/source/expiry',
        (draftState) => {
            const result = response({
                changedCells: [],
                applicable: false,
                validationTarget: 'CANDIDATE',
                candidate: candidate(),
                authoringOutcome: outcome({draftState, candidateDigest: 'digest:1'}),
            });

            expect(canApplyAuthoringResult(result)).toBe(false);
            expect(canSelectAuthoringCandidate(result, 'source:1')).toBe(true);
            expect(canSelectAuthoringCandidate(result, 'other')).toBe(false);
            expect(canSelectAuthoringCandidate(result, 'source:1', Date.now() + 400000)).toBe(false);
            result.candidate!.candidateDigest = 'different';
            expect(canSelectAuthoringCandidate(result, 'source:1')).toBe(false);
        },
    );
    it('never selects a candidate with missing token, withheld verification, or leaked top-level cells', () => {
        const result = response({
            candidate: candidate({token: ''}),
            authoringOutcome: outcome({draftState: 'CONSENT_REQUIRED', candidateDigest: 'digest:1'}),
        });

        expect(canSelectAuthoringCandidate(result, 'source:1')).toBe(false);
    });
    it.each(['ALREADY_SATISFIED', 'NO_IMPROVEMENT'] as const)('treats %s as a completed unchanged result', (requestState) => {
        const result = response({changedCells: [], applicable: false, authoringOutcome: outcome({requestState, draftState: 'NONE'})});

        expect(aiExecutionFailure(result)).toBeNull();
        expect(canApplyAuthoringResult(result)).toBe(false);
        expect(authoringMessageKey(result)).toBe(requestState);
    });
    it.each(['UNKNOWN', 'BUSY', 'INFEASIBLE_PROVEN'] as const)('distinguishes solve state %s', (solveState) => {
        const result = response({
            changedCells: [],
            applicable: false,
            authoringOutcome: outcome({solveState, requestState: 'UNSATISFIED', draftState: 'NONE'}),
        });

        expect(authoringMessageKey(result)).toBe(solveState);
        expect(aiExecutionFailure(result)).not.toBeNull();
    });
    it('pins shared wire examples without treating their synthetic timings as measurements', () => {
        expect(fixture.contractVersion).toBe('intent-first-v1');

        for (const [name, operation] of Object.entries(fixture.responses)) {
            const result = operation.result as unknown as TAutofillResponse;

            expect(authoringMessageKey(result), name).toBeTruthy();
            expect(canApplyAuthoringResult(result, fixture.fixtureContext.sourceVersionId), name).toBe(
                ['applicableClean', 'applicableDraft', 'mixedExactReviewSelected'].includes(name),
            );

            if ('candidate' in result && result.candidate)
                expect(
                    canSelectAuthoringCandidate(result, fixture.fixtureContext.sourceVersionId, Date.parse('2026-10-27T01:01:00Z')),
                    name,
                ).toBe(true);
        }
    });
});

it('allows an honest directional partial without relaxing an exact clause', () => {
    const result = response({
        authoringOutcome: outcome({
            requestState: 'PARTIAL',
            clauses: [
                {clauseId: 'exact:1', kind: 'EXACT', status: 'SATISFIED', before: 0, after: 1, affectedCells: []},
                {clauseId: 'direction:1', kind: 'DIRECTIONAL', status: 'UNSATISFIED', before: 3, after: 2, affectedCells: []},
            ],
        }),
    });

    expect(canApplyAuthoringResult(result)).toBe(true);
    result.authoringOutcome!.clauses[0]!.status = 'UNSATISFIED';
    expect(canApplyAuthoringResult(result)).toBe(false);
});

it('applies exactly the selected digest and refuses a different cached candidate receipt', () => {
    const result = response({authoringOutcome: outcome({candidateDigest: 'selected:1'})});

    expect(canApplyAuthoringResult(result, 'source:1', 'selected:1')).toBe(true);
    expect(canApplyAuthoringResult(result, 'source:1', 'different:2')).toBe(false);
});
