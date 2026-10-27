import type {TAutofillResponse} from '@dutying/api/ward';
import {useEffect, useRef, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {useTypedTranslation} from '@/shared/hook/use-typed-translation';
import {AiConflictViolationList} from './ai-conflict-violation-list';

type TProps = {
    review: NonNullable<TAutofillResponse['conflictReview']>;
    disabled: boolean;
    current: boolean;
    onProceed: () => Promise<void>;
    onRevise: () => void;
    onEditSettings?: () => void;
    settingsHref?: string;
    settingsLabel?: string;
    requestSummary?: string;
    copy: (ko: string, en: string) => string;
};

export function ConstraintConflictReview({
    review,
    disabled,
    current,
    onProceed,
    onRevise,
    onEditSettings,
    settingsHref,
    settingsLabel,
    requestSummary,
}: TProps) {
    const {t} = useTypedTranslation();
    const {i18n} = useTranslation();
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

    return (
        <section
            className="mt-3 space-y-3 rounded-xl border border-red/30 bg-red/5 p-4"
            aria-label={t('aiAutofillUi.conflictReview.title')}
            aria-busy={submitting}
        >
            <p className="font-medium">{t('aiAutofillUi.conflictReview.question')}</p>
            {i18n.language.startsWith('ko') && review.explanation && (
                <div className="space-y-1 text-sm">
                    <h3 className="font-medium">{t('aiAutofillUi.conflictReview.cause')}</h3>
                    <p className="leading-relaxed whitespace-pre-wrap">{review.explanation}</p>
                </div>
            )}
            {requestSummary && (
                <div className="rounded-lg bg-white p-3 text-sm">
                    <p className="font-medium">{t('aiAutofillUi.conflictReview.understood')}</p>
                    <p className="mt-1 whitespace-pre-wrap">{requestSummary}</p>
                    <p className="mt-2">{t('aiAutofillUi.conflictReview.reviseHint')}</p>
                </div>
            )}
            <h3 className="text-sm font-medium">{t('aiAutofillUi.conflictReview.changes')}</h3>
            <p className="text-sm leading-relaxed">{t('aiAutofillUi.conflictReview.resultContext')}</p>
            <AiConflictViolationList review={review} />
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
                {settingsHref ? (
                    <a
                        className="flex min-h-11 items-center rounded-lg border px-4 py-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-main-1"
                        href={settingsHref}
                        target="_blank"
                        rel="noopener noreferrer"
                    >
                        {settingsLabel ?? t('aiAutofillUi.conflictReview.editSettings')}
                    </a>
                ) : (
                    <button
                        type="button"
                        className="min-h-11 rounded-lg border px-4 py-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-main-1 disabled:opacity-40"
                        disabled={disabled || submitting}
                        onClick={onEditSettings}
                    >
                        {settingsLabel ?? t('aiAutofillUi.conflictReview.editSettings')}
                    </button>
                )}
            </div>
        </section>
    );
}
