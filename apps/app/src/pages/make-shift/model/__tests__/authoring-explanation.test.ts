import {describe, expect, it} from 'vitest';
import {authoringExplanationKey} from '../intent-first-authoring';
import {outcome, response} from './fixtures/intent-first';

describe('evidence-based result explanation', () => {
    it('does not present an unsuccessful search as proof of infeasibility', () => {
        expect(authoringExplanationKey(response({authoringOutcome: outcome({draftState: 'NONE', requestState: 'NO_IMPROVEMENT'})}))).toBe(
            'searchNoImprovement',
        );
    });
    it('distinguishes unverified results from no improvement', () => {
        expect(authoringExplanationKey(response({authoringOutcome: outcome({draftState: 'NONE', solveState: 'UNKNOWN'})}))).toBe(
            'unverifiedResult',
        );
    });
    it.each([
        ['CHANGE_BUDGET_EXCEEDED', 'changeLimit'],
        ['LOCKED_CELL_CHANGED', 'protectedCandidate'],
        ['PROTECTION_VIOLATION', 'protectedCandidate'],
    ])('explains observed %s evidence', (reason, key) => {
        expect(authoringExplanationKey(response({authoringOutcome: outcome({draftState: 'NONE', reasonCodes: [reason]})}))).toBe(key);
    });
    it('does not label a successful or reviewable candidate as a failed search', () => {
        expect(authoringExplanationKey(response())).toBeUndefined();
        expect(authoringExplanationKey(response({authoringOutcome: outcome({draftState: 'PREVIEW_ONLY'})}))).toBeUndefined();
    });
    it('uses a timeout explanation only with observed deadline evidence', () => {
        const result = response({authoringOutcome: outcome({draftState: 'NONE'})});

        result.authoringOutcome!.timing.deadlineExceeded = true;
        expect(authoringExplanationKey(result)).toBe('searchTimedOut');
    });
});
