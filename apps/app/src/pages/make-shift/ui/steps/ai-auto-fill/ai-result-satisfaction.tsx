import {useId, useRef, useState} from 'react';
import {useTranslation} from 'react-i18next';
import type {TScheduleObservation} from '@dutying/api/ward';
import {sendScheduleResultFeedback, type TScheduleSatisfaction} from '../../../model/schedule-result-feedback';

/** Render only for a generated result applied in this browser. A new result must get a new React key. */
export function AiResultSatisfaction({observation, disabled = false}: {observation: TScheduleObservation; disabled?: boolean}) {
    const {i18n} = useTranslation();
    const copy = (ko: string, en: string) => (i18n.language.startsWith('ko') ? ko : en);
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
                {copy('의견을 보냈어요. 더 나은 근무표를 만드는 데 참고할게요.', 'Feedback sent. We’ll use it to improve schedules.')}
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
                {copy('방금 만들어진 근무표, 마음에 드나요?', 'How do you like the schedule we just made?')}
            </h3>
            <p className="text-gray-60 text-sm">
                {copy('의견만 보내며, 근무표는 바뀌지 않아요.', 'This sends feedback only. Your schedule stays unchanged.')}
            </p>
            <div className="flex flex-wrap gap-2" role="group" aria-label={copy('근무표 만족도', 'Schedule satisfaction')}>
                {(
                    [
                        ['LIKED', '마음에 들어요', 'I like it'],
                        ['NEEDS_WORK', '아쉬워요', 'Needs improvement'],
                    ] as const
                ).map(([value, ko, en]) => (
                    <button
                        key={value}
                        type="button"
                        aria-pressed={rating === value}
                        disabled={locked}
                        onClick={() => setRating(value)}
                        className={`min-h-11 rounded-lg border px-3 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-main-1 disabled:opacity-50 ${rating === value ? 'border-main-1 bg-main-1 text-white' : 'border-gray-30 bg-white'}`}
                    >
                        {copy(ko, en)}
                    </button>
                ))}
                <button
                    type="button"
                    disabled={locked}
                    onClick={() => setState('dismissed')}
                    className="text-gray-60 min-h-11 rounded-lg px-3 text-sm focus-visible:outline-2 focus-visible:outline-main-1 disabled:opacity-50"
                >
                    {copy('나중에', 'Not now')}
                </button>
            </div>
            {rating && (
                <div className="space-y-2">
                    <label htmlFor={`${id}-note`} className="block text-sm">
                        {copy('어떤 점이 좋거나 아쉬웠나요? (선택)', 'What worked well or could be better? (Optional)')}
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
                        {copy('이름 등 개인정보 없이 적어 주세요.', 'Please leave out names and other personal information.')} {note.length}
                        /500
                    </p>
                    {error && (
                        <p role="alert" className="text-sm text-red">
                            {copy(
                                '의견을 보내지 못했어요. 입력한 내용은 그대로 있어요. 다시 보내 주세요.',
                                'Could not send feedback. Your input is preserved. Please try again.',
                            )}
                        </p>
                    )}
                    <button
                        type="button"
                        disabled={locked}
                        onClick={() => void submit()}
                        className="min-h-11 rounded-lg bg-main-1 px-4 text-sm text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-main-1 disabled:opacity-50"
                    >
                        {state === 'sending' ? copy('보내는 중…', 'Sending…') : copy('의견 보내기', 'Send feedback')}
                    </button>
                </div>
            )}
        </section>
    );
}
