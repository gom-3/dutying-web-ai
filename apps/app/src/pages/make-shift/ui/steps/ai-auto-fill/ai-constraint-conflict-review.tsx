import type {TAutofillResponse} from '@dutying/api/ward';
import {useEffect, useRef, useState} from 'react';
import {localizeScheduleValidationMessage} from '@/features/shift-editor/model/schedule-violations/format-validation-message';
import {useTypedTranslation} from '@/shared/hook/use-typed-translation';

type TProps = {
    review: NonNullable<TAutofillResponse['conflictReview']>;
    disabled: boolean;
    current: boolean;
    onProceed: () => Promise<void>;
    onRevise: () => void;
    onEditSettings: () => void;
    requestSummary?: string;
    copy: (ko: string, en: string) => string;
};

export function ConstraintConflictReview({review, disabled, current, onProceed, onRevise, onEditSettings, requestSummary}: TProps) {
    const {t} = useTypedTranslation();
    const [submitting, setSubmitting] = useState(false);
    const inFlight = useRef(false);
    const [failed, setFailed] = useState(false);
    const [now, setNow] = useState(Date.now);
    const expiry = Date.parse(review.expiresAt);
    const available = current && Number.isFinite(expiry) && expiry > now;
    useEffect(() => {
        if (!Number.isFinite(expiry) || expiry <= now) return;
        const timer = window.setTimeout(() => setNow(Date.now()), Math.min(expiry - Date.now(), 2147483647));
        return () => window.clearTimeout(timer);
    }, [expiry, now]);
    const proceed = async () => {
        if (disabled || !current || inFlight.current) return;
        if (!Number.isFinite(expiry) || expiry <= Date.now()) {
            setNow(Date.now());
            return;
        }
        inFlight.current = true;
        setSubmitting(true);
        setFailed(false);
        try {
            await onProceed();
        } catch {
            setFailed(true);
        } finally {
            inFlight.current = false;
            setSubmitting(false);
        }
    };
    const message = (violation: TProps['review']['violations'][number]) => {
        const args = violation.messageArgs;
        const operator = args?.operator;

        if (
            violation.templateCode === 'SHIFT_COUNT_PER_PERIOD' &&
            typeof args?.expected === 'number' &&
            typeof args.actual === 'number' &&
            ['MIN', 'MAX', 'EXACT'].includes(String(operator))
        ) {
            const limit = t(
                operator === 'MAX'
                    ? 'aiAutofillUi.conflictReview.maximum'
                    : operator === 'MIN'
                      ? 'aiAutofillUi.conflictReview.minimum'
                      : 'aiAutofillUi.conflictReview.exact',
                {count: args.expected},
            );
            const subject = typeof args.subject === 'string' ? `${args.subject} · ` : '';

            return t('aiAutofillUi.conflictReview.countComparison', {subject, limit, actual: args.actual});
        }

        return localizeScheduleValidationMessage(violation);
    };

    return (
        <section
            className="mt-3 space-y-3 rounded-xl border border-red/30 bg-red/5 p-4"
            aria-label={t('aiAutofillUi.conflictReview.title')}
            aria-busy={submitting}
        >
            <p className="font-medium">{t('aiAutofillUi.conflictReview.question')}</p>
            {review.explanation && <p className="text-sm leading-relaxed whitespace-pre-wrap">{review.explanation}</p>}
            {requestSummary && (
                <div className="rounded-lg bg-white p-3 text-sm">
                    <p className="font-medium">{t('aiAutofillUi.conflictReview.understood')}</p>
                    <p className="mt-1 whitespace-pre-wrap">{requestSummary}</p>
                    <p className="mt-2">{t('aiAutofillUi.conflictReview.reviseHint')}</p>
                </div>
            )}
            <p className="text-sm font-medium">{t('aiAutofillUi.conflictReview.changes')}</p>
            <ul className="list-disc space-y-1 pl-5">
                {review.violations.map((violation, index) => (
                    <li key={violation.violationId ?? index}>
                        {review.ruleLabels?.[String(violation.ruleId)] && (
                            <strong className="block">{review.ruleLabels[String(violation.ruleId)]}</strong>
                        )}
                        {message(violation)}
                    </li>
                ))}
            </ul>
            <p className="text-sm">{t('aiAutofillUi.conflictReview.applyNotice')}</p>
            {!available && <p className="text-sm">{t('aiAutofillUi.conflictReview.expired')}</p>}
            {failed && (
                <p role="alert" className="text-sm">
                    {t('aiAutofillUi.conflictReview.applyFailed')}
                </p>
            )}
            <div className="flex flex-wrap gap-2">
                <button
                    type="button"
                    className="min-h-11 rounded-lg bg-main-1 px-4 py-2 text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-main-1 disabled:opacity-40"
                    disabled={disabled || !available || submitting}
                    onClick={() => void proceed()}
                >
                    {submitting ? t('aiAutofillUi.conflictReview.applying') : t('aiAutofillUi.conflictReview.proceed')}
                </button>
                <button
                    type="button"
                    className="min-h-11 rounded-lg border px-4 py-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-main-1 disabled:opacity-40"
                    disabled={disabled || submitting}
                    onClick={onRevise}
                >
                    {t('aiAutofillUi.conflictReview.revise')}
                </button>
                <button
                    type="button"
                    className="min-h-11 rounded-lg border px-4 py-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-main-1 disabled:opacity-40"
                    disabled={disabled || submitting}
                    onClick={onEditSettings}
                >
                    {t('aiAutofillUi.conflictReview.editSettings')}
                </button>
            </div>
        </section>
    );
}
