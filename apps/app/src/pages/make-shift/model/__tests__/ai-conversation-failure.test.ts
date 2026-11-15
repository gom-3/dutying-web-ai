import {beforeEach, describe, expect, it} from 'vitest';
import i18n from '@/i18n';
import {AiConversationInputError, aiConversationFailure} from '../ai-conversation-failure';

describe.each(['ko', 'en'])('user-facing AI errors (%s)', (language) => {
    beforeEach(async () => {
        await i18n.changeLanguage(language);
    });
    it('explains a full background queue as retryable load rather than invalid settings', () => {
        expect(aiConversationFailure({serverCode: 'BACKGROUND_QUEUE_FULL'})).toEqual({
            message: i18n.t('aiAdjust.executionFailure.busy'),
            blocked: false,
            checkOutcome: false,
            recovery: 'retry',
        });
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
    it('distinguishes the ward hourly limit and preserves its reset wait', () => {
        const failure = aiConversationFailure({
            serverCode: 'SCHEDULE_AUTOFILL_RATE_LIMIT_EXCEEDED',
            message: '이번 시간 AI 자동채우기 사용량(3회)을 모두 사용했어요. 약 12분 후 다시 시도해 주세요.',
        });

        expect(failure.message).toContain(i18n.t('aiAdjust.failure.hourlyLimit', {limit: 3}));
        expect(failure.message).toContain(i18n.t('aiAdjust.failure.waitMinutes', {count: 12}));
        expect(failure.blocked).toBe(true);
    });
    it('distinguishes the daily ward limit from a temporary cooldown', () => {
        const failure = aiConversationFailure({
            serverCode: 'SCHEDULE_AUTOFILL_RATE_LIMIT_EXCEEDED',
            message: '오늘 AI 자동채우기 사용량(10회)을 모두 사용했어요. 내일 다시 시도해 주세요.',
        });

        expect(failure.message).toBe(i18n.t('aiAdjust.failure.dailyLimit', {limit: 10}));
    });
    it('does not claim a quota was exhausted when usage storage is unavailable', () => {
        expect(
            aiConversationFailure({
                serverCode: 'SCHEDULE_AUTOFILL_RATE_LIMIT_EXCEEDED',
                message: '병동 사용량을 확인할 수 없습니다. 잠시 후 다시 시도해 주세요.',
            }),
        ).toEqual({
            message: i18n.t('aiAdjust.failure.usageUnavailable'),
            blocked: false,
            recovery: 'retry',
        });
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
    expect(result.recovery).toBe('revise');
});

it.each(['ko', 'en', 'ja'])(
    'offers request revision after rejected interpretation without promising same-request recovery (%s)',
    async (language) => {
        await i18n.changeLanguage(language);

        const result = aiConversationFailure({
            serverCode: 'SCHEDULE_INTERPRET_REJECTED',
            code: 502,
            message: 'private model validation body',
        });

        expect(result.title).toBe(i18n.t('aiAutofillUi.interpretFailureTitle'));
        expect(result.message).toBe(i18n.t('aiAutofillUi.interpretRejected'));
        expect(result.message).not.toMatch(/private|잠시 후|unavailable|接続できません/);
        expect(result.recovery).toBe('revise');
        expect(result.checkOutcome).toBe(false);
    },
);
