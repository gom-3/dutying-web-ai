import type {TScheduleObservation} from '@dutying/api/ward';
import * as Dialog from '@radix-ui/react-dialog';
import {Check, ThumbsDown, ThumbsUp, X} from 'lucide-react';
import {useId, useRef, useState} from 'react';
import {useTypedTranslation} from '@/shared/hook/use-typed-translation';
import {sendScheduleResultFeedback, type TScheduleSatisfaction} from '../../../model/schedule-result-feedback';

/** Mount with the applied result's serverEventId as its React key. */
export function AiResultSatisfaction({
    observation,
    disabled = false,
    available = true,
}: {
    observation: TScheduleObservation;
    disabled?: boolean;
    available?: boolean;
}) {
    const {t} = useTypedTranslation();
    const id = useId();
    const [rating, setRating] = useState<TScheduleSatisfaction>();
    const [note, setNote] = useState('');
    const [savedNote, setSavedNote] = useState('');
    const [open, setOpen] = useState(false);
    const [pending, setPending] = useState(false);
    const [error, setError] = useState(false);
    const attempt = useRef<{body: string; eventId: string} | undefined>(undefined);
    const sending = useRef(false);
    const reasonTrigger = useRef<HTMLButtonElement>(null);
    const locked = disabled || pending;
    const submit = async (value: TScheduleSatisfaction, feedbackNote = savedNote, close = false) => {
        if (locked || sending.current) return;

        sending.current = true;

        const body = JSON.stringify([value, feedbackNote]);

        if (attempt.current?.body !== body) attempt.current = {body, eventId: crypto.randomUUID()};

        setPending(true);
        setError(false);

        try {
            await sendScheduleResultFeedback(observation, {satisfaction: value, feedbackNote, eventId: attempt.current.eventId});
            setRating(value);
            setSavedNote(feedbackNote);

            if (close) setOpen(false);
        } catch {
            setError(true);
        } finally {
            setPending(false);
            sending.current = false;
        }
    };

    return (
        <div className="mt-2" onKeyDown={(event) => event.stopPropagation()} onPaste={(event) => event.stopPropagation()}>
            <div
                className="flex items-center gap-1 text-[#6B7280]"
                role="group"
                aria-label={t('aiAutofillUi.resultSatisfaction.rating')}
                aria-busy={pending}
            >
                {(
                    [
                        ['LIKED', 'liked', ThumbsUp],
                        ['NEEDS_WORK', 'needsWork', ThumbsDown],
                    ] as const
                ).map(([value, label, Icon]) => (
                    <button
                        key={value}
                        type="button"
                        title={t(`aiAutofillUi.resultSatisfaction.${label}`)}
                        aria-label={t(`aiAutofillUi.resultSatisfaction.${label}`)}
                        aria-pressed={rating === value}
                        disabled={locked}
                        onClick={() => void submit(value)}
                        className={`grid size-11 place-items-center rounded-lg focus-visible:outline-2 focus-visible:outline-main-1 disabled:opacity-50 ${rating === value ? 'bg-[#F0EBFF] text-main-1' : 'hover:bg-gray-7'}`}
                    >
                        <Icon size={16} aria-hidden="true" />
                    </button>
                ))}
                {rating && (
                    <>
                        <Check size={13} aria-hidden="true" className="text-main-1" />
                        <span className="sr-only" role="status">
                            {t('aiAutofillUi.resultSatisfaction.feedbackSent')}
                        </span>
                        <button
                            type="button"
                            ref={reasonTrigger}
                            onClick={() => setOpen(true)}
                            disabled={locked}
                            className="min-h-11 rounded-lg px-2 text-xs hover:text-main-1 focus-visible:outline-2 focus-visible:outline-main-1"
                        >
                            {t('aiAutofillUi.resultSatisfaction.addReason')}
                        </button>
                    </>
                )}
            </div>
            {error && !open && (
                <p role="alert" className="text-xs text-red">
                    {t('aiAutofillUi.resultSatisfaction.sendFailed')}
                </p>
            )}
            <Dialog.Root
                open={open && available}
                onOpenChange={(value) => {
                    if (!pending) setOpen(value);
                }}
            >
                <Dialog.Portal>
                    <Dialog.Overlay className="fixed inset-0 z-[1500] bg-black/30" />
                    <Dialog.Content
                        onCloseAutoFocus={(event) => {
                            event.preventDefault();

                            if (available) reasonTrigger.current?.focus();
                        }}
                        className="fixed top-1/2 left-1/2 z-[1501] w-[min(400px,calc(100vw-32px))] -translate-x-1/2 -translate-y-1/2 space-y-4 rounded-2xl bg-white p-6 shadow-xl"
                        onKeyDown={(event) => event.stopPropagation()}
                        onPaste={(event) => event.stopPropagation()}
                    >
                        <Dialog.Title className="pr-8 text-base font-semibold">{t('aiAutofillUi.resultSatisfaction.note')}</Dialog.Title>
                        <Dialog.Description className="text-sm text-[#6B7280]">
                            {t('aiAutofillUi.resultSatisfaction.feedbackOnly')}
                        </Dialog.Description>
                        <label className="sr-only" htmlFor={id}>
                            {t('aiAutofillUi.resultSatisfaction.note')}
                        </label>
                        <textarea
                            id={id}
                            value={note}
                            onChange={(event) => setNote(event.target.value)}
                            maxLength={500}
                            rows={4}
                            disabled={locked}
                            className="border-gray-30 w-full resize-y rounded-lg border p-3 text-base focus-visible:outline-2 focus-visible:outline-main-1"
                        />
                        <p className="text-xs text-[#6B7280]">
                            {t('aiAutofillUi.resultSatisfaction.noPersonalInformation')} {note.length}/500
                        </p>
                        {error && (
                            <p role="alert" className="text-sm text-red">
                                {t('aiAutofillUi.resultSatisfaction.sendFailed')}
                            </p>
                        )}
                        <div className="flex justify-end gap-2">
                            <Dialog.Close disabled={pending} className="min-h-11 rounded-lg px-4 text-sm">
                                {t('aiAutofillUi.resultSatisfaction.close')}
                            </Dialog.Close>
                            <button
                                type="button"
                                disabled={locked || !rating}
                                onClick={() => rating && void submit(rating, note.trim(), true)}
                                className="min-h-11 rounded-lg bg-main-1 px-4 text-sm text-white disabled:opacity-50"
                            >
                                {t(pending ? 'aiAutofillUi.resultSatisfaction.sending' : 'aiAutofillUi.resultSatisfaction.send')}
                            </button>
                        </div>
                        <Dialog.Close
                            disabled={pending}
                            aria-label={t('aiAutofillUi.resultSatisfaction.close')}
                            className="absolute top-2 right-2 grid size-11 place-items-center rounded-lg"
                        >
                            <X size={16} />
                        </Dialog.Close>
                    </Dialog.Content>
                </Dialog.Portal>
            </Dialog.Root>
        </div>
    );
}
