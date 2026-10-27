import {beforeEach, describe, expect, it} from 'vitest';
import i18n from '@/i18n';
import {AiConversationInputError, aiConversationFailure} from '../ai-conversation-failure';

describe.each(['ko', 'en'])('user-facing AI errors (%s)', (language) => {
    beforeEach(async () => {
        await i18n.changeLanguage(language);
    });
    it.each([
        {message: 'java.lang.IllegalStateException: SOLVER_RESULT_FAILED_FINAL_GATE', code: 500},
        {message: 'revision mismatch expectedRevision=4', code: 409},
        {message: 'CP-SAT INFEASIBLE traceback failed', serverCode: 'INTERNAL_SERVER_ERROR'},
        new Error('Request failed with status code 502'),
    ])('never exposes API or exception internals', (error) => {
        const failure = aiConversationFailure(error);

        expect(failure.message).not.toMatch(/java\.|IllegalState|SOLVER|CP-SAT|INFEASIBLE|traceback|expectedRevision|status code|502/);
        expect(failure.message.length).toBeGreaterThan(10);
    });
    it('keeps local translated explanations for a changed schedule', () => {
        const explanation = i18n.t('aiAdjust.stale');

        expect(aiConversationFailure(new Error(explanation)).message).toBe(explanation);
    });
    it.each(['loading', 'pendingExecution', 'staleRequest', 'requestTooLong', 'expiredSuggestion', 'draftChanged'] as const)(
        'preserves actionable local guidance: %s',
        (reason) => {
            expect(aiConversationFailure(new AiConversationInputError(reason))).toEqual({
                message: i18n.t(`aiAdjust.localError.${reason}`),
                blocked: false,
                checkOutcome: reason === 'pendingExecution' || reason === 'loading',
            });
        },
    );
    it('extracts only the wait duration from a rate limit response', () => {
        const failure = aiConversationFailure({code: 429, message: 'QuotaLimiter INTERNAL_TRACE: 약 25분 후 다시 시도해 주세요.'});

        expect(failure.message).toBe(i18n.t('aiAdjust.failure.waitMinutes', {count: 25}));
        expect(failure.message).not.toMatch(/QuotaLimiter|INTERNAL_TRACE/);
        expect(failure.blocked).toBe(true);
    });
    it('does not describe allowance limits as conflicting schedule edits', () => {
        const failure = aiConversationFailure({code: 409, serverCode: 'AI_QUOTA_EXHAUSTED', message: 'ledger exhausted'});

        expect(failure.message).toBe(i18n.t('aiAdjust.failure.quota'));
        expect(failure.blocked).toBe(true);
    });
});

it('offers new-operation recovery only for a trusted local unsent stale guard', () => {
    expect(aiConversationFailure(new AiConversationInputError('staleRequest', 'GENERATE'))).toMatchObject({
        unsentOperation: 'GENERATE',
        checkOutcome: false,
    });
    expect(aiConversationFailure(new AiConversationInputError('staleRequest', 'ADJUST'))).toMatchObject({unsentOperation: 'ADJUST'});
    expect(aiConversationFailure({code: 409, unsentOperation: 'GENERATE'})).not.toHaveProperty('unsentOperation');
    expect(aiConversationFailure(new AiConversationInputError('pendingExecution', 'GENERATE'))).not.toHaveProperty('unsentOperation');
});

it('distinguishes interpreter availability from invalid user input without showing raw server text', () => {
    const result = aiConversationFailure({serverCode: 'SCHEDULE_INTERPRET_UNAVAILABLE', code: 503, message: 'private upstream response'});

    expect(result.message).not.toContain('private');
    expect(result.message).toBe(i18n.t('aiAutofillUi.interpretUnavailable'));
    expect(result.checkOutcome).toBe(false);
});
