import i18n from '@/i18n';

export type TAiConversationFailure = {
    message: string;
    blocked: boolean;
    /** Present only for a completed execution that did not produce an applicable result. */
    recovery?: 'retry' | 'revise' | 'review';
};

// Local, translated UI explanations may be shown; arbitrary API/exception text may not.
function isUiExplanation(message: string, value: unknown): boolean {
    if (typeof value === 'string') return value === message;

    return Boolean(value && typeof value === 'object' && Object.values(value).some((entry) => isUiExplanation(message, entry)));
}

function waitMessage(message?: string): string | undefined {
    const match = message?.match(/(\d{1,5})\s*(초|분|시간|seconds?|minutes?|hours?)\s*(?:후|뒤)?/i);

    if (!match || Number(match[1]) < 1) return undefined;

    const unit = match[2].toLowerCase();
    const key = /^(초|second)/.test(unit) ? 'waitSeconds' : /^(분|minute)/.test(unit) ? 'waitMinutes' : 'waitHours';

    return i18n.t(`aiAdjust.failure.${key}`, {count: Number(match[1])});
}

/** Keep server wait times, but do not describe access/allowance limits as draft conflicts. */
export function aiConversationFailure(error: unknown, fallback = i18n.t('aiAdjust.failed')): TAiConversationFailure {
    const source = error as {message?: string; serverCode?: string; code?: number} | null;
    const code = source?.serverCode;
    const message = typeof source?.message === 'string' && source.message.trim().length > 0 ? source.message : undefined;

    if (code === 'SCHEDULE_AUTOFILL_ADJUST_NOT_ALLOWED') return {message: i18n.t('aiAdjust.failure.adjustAccess'), blocked: true};

    if (['AI_QUOTA_EXCEEDED', 'AI_QUOTA_EXHAUSTED'].includes(code ?? '')) return {message: i18n.t('aiAdjust.failure.quota'), blocked: true};

    if (code === 'SCHEDULE_AUTOFILL_RATE_LIMIT_EXCEEDED' || source?.code === 429)
        return {message: waitMessage(message) ?? i18n.t('aiAdjust.failure.rateLimit'), blocked: true};

    if (source?.code === 403 || ['ACCESS_DENIED', 'SCOPE_ACCESS_DENIED', 'WARD_ADMIN_MEMBERSHIP_REQUIRED'].includes(code ?? ''))
        return {message: i18n.t('aiAdjust.failure.access'), blocked: true};

    if (source?.code === 409) return {message: i18n.t('aiAdjust.stale'), blocked: false};

    const localExplanation =
        !source?.serverCode &&
        !source?.code &&
        message &&
        (isUiExplanation(message, i18n.getResource(i18n.language, 'translation', 'aiAdjust')) ||
            isUiExplanation(message, i18n.getResource(i18n.language, 'translation', 'page.makeShift.aiRefill')));

    return {message: localExplanation ? message : fallback, blocked: false};
}
