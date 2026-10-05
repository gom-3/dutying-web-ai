import i18n from '@/i18n';

export type TAiConversationFailure = {
    message: string;
    blocked: boolean;
    /** Present only for a completed execution that did not produce an applicable result. */
    recovery?: 'retry' | 'revise' | 'review';
};

/** Keep server wait times, but do not describe access/allowance limits as draft conflicts. */
export function aiConversationFailure(error: unknown, fallback = i18n.t('aiAdjust.failed')): TAiConversationFailure {
    const source = error as {message?: string; serverCode?: string; code?: number} | null;
    const code = source?.serverCode;
    const message = typeof source?.message === 'string' && source.message.trim().length > 0 ? source.message : undefined;

    if (code === 'SCHEDULE_AUTOFILL_ADJUST_NOT_ALLOWED') return {message: i18n.t('aiAdjust.failure.adjustAccess'), blocked: true};

    if (['AI_QUOTA_EXCEEDED', 'AI_QUOTA_EXHAUSTED'].includes(code ?? '')) return {message: i18n.t('aiAdjust.failure.quota'), blocked: true};

    if (code === 'SCHEDULE_AUTOFILL_RATE_LIMIT_EXCEEDED' || source?.code === 429)
        return {message: message ?? i18n.t('aiAdjust.failure.rateLimit'), blocked: true};

    if (source?.code === 403 || ['ACCESS_DENIED', 'SCOPE_ACCESS_DENIED', 'WARD_ADMIN_MEMBERSHIP_REQUIRED'].includes(code ?? ''))
        return {message: i18n.t('aiAdjust.failure.access'), blocked: true};

    return {message: message ?? fallback, blocked: false};
}
