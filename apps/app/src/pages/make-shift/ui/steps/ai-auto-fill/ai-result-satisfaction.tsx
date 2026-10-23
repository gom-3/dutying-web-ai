import type {TScheduleObservation} from '@dutying/api/ward';
import {useId, useRef, useState} from 'react';
import {useTypedTranslation} from '@/shared/hook/use-typed-translation';
import {sendScheduleResultFeedback, type TScheduleSatisfaction} from '../../../model/schedule-result-feedback';

/** Render only for a generated result applied in this browser. A new result must get a new React key. */
export function AiResultSatisfaction({observation, disabled = false}: {observation: TScheduleObservation; disabled?: boolean}) {
    const {t} = useTypedTranslation();
    const id = useId();
    const [rating, setRating] = useState<TScheduleSatisfaction>();
    const [note, setNote] = useState('');
    const [state, setState] = useState<'ready' | 'sending' | 'sent' | 'dismissed'>('ready');
    const [error, setError] = useState(false);
    const attempt = useRef<{body: string; eventId: string} | undefined>(undefined);
    const sending = useRef(false);

    if (state === 'dismissed') return null;

    if (state === 'sent')
        return (
            <p role="status" className="my-3 text-sm text-main-1">
                {t('aiAutofillUi.resultSatisfaction.feedbackSent')}
            </p>
        );

    const locked = disabled || state === 'sending';
    const submit = async () => {
        if (!rating || locked || sending.current) return;

        sending.current = true;

        const feedbackNote = note.trim();
        const body = JSON.stringify([rating, feedbackNote]);

        if (attempt.current?.body !== body) attempt.current = {body, eventId: crypto.randomUUID()};

        setState('sending');
        setError(false);

        try {
            await sendScheduleResultFeedback(observation, {satisfaction: rating, feedbackNote, eventId: attempt.current.eventId});
            setState('sent');
        } catch {
            setState('ready');
            setError(true);
        } finally {
            sending.current = false;
        }
    };

    return (
        <section
            onKeyDown={(event) => event.stopPropagation()}
            onPaste={(event) => event.stopPropagation()}
            aria-busy={state === 'sending'}
            aria-labelledby={`${id}-title`}
            className="border-gray-20 my-3 space-y-3 rounded-xl border bg-white p-4"
        >
            <h3 id={`${id}-title`} className="text-base font-semibold">
                {t('aiAutofillUi.resultSatisfaction.title')}
            </h3>
            <p className="text-gray-60 text-sm">{t('aiAutofillUi.resultSatisfaction.feedbackOnly')}</p>
            <div className="flex flex-wrap gap-2" role="group" aria-label={t('aiAutofillUi.resultSatisfaction.rating')}>
                {(
                    [
                        ['LIKED', 'liked'],
                        ['NEEDS_WORK', 'needsWork'],
                    ] as const
                ).map(([value, label]) => (
                    <button
                        key={value}
                        type="button"
                        aria-pressed={rating === value}
                        disabled={locked}
                        onClick={() => setRating(value)}
                        className={`min-h-11 rounded-lg border px-3 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-main-1 disabled:opacity-50 ${rating === value ? 'border-main-1 bg-main-1 text-white' : 'border-gray-30 bg-white'}`}
                    >
                        {t(`aiAutofillUi.resultSatisfaction.${label}`)}
                    </button>
                ))}
                <button
                    type="button"
                    disabled={locked}
                    onClick={() => setState('dismissed')}
                    className="text-gray-60 min-h-11 rounded-lg px-3 text-sm focus-visible:outline-2 focus-visible:outline-main-1 disabled:opacity-50"
                >
                    {t('aiAutofillUi.resultSatisfaction.notNow')}
                </button>
            </div>
            {rating && (
                <div className="space-y-2">
                    <label htmlFor={`${id}-note`} className="block text-sm">
                        {t('aiAutofillUi.resultSatisfaction.note')}
                    </label>
                    <textarea
                        id={`${id}-note`}
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                        maxLength={500}
                        rows={3}
                        disabled={locked}
                        className="border-gray-30 w-full resize-y rounded-lg border p-3 text-base focus-visible:outline-2 focus-visible:outline-main-1"
                    />
                    <p className="text-gray-60 text-xs">
                        {t('aiAutofillUi.resultSatisfaction.noPersonalInformation')} {note.length}
                        /500
                    </p>
                    {error && (
                        <p role="alert" className="text-sm text-red">
                            {t('aiAutofillUi.resultSatisfaction.sendFailed')}
                        </p>
                    )}
                    <button
                        type="button"
                        disabled={locked}
                        onClick={() => void submit()}
                        className="min-h-11 rounded-lg bg-main-1 px-4 text-sm text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-main-1 disabled:opacity-50"
                    >
                        {state === 'sending' ? t('aiAutofillUi.resultSatisfaction.sending') : t('aiAutofillUi.resultSatisfaction.send')}
                    </button>
                </div>
            )}
        </section>
    );
}
