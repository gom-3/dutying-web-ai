import {localizeScheduleValidationMessage} from '@/features/shift-editor/model/schedule-violations/format-validation-message';
import {useState} from 'react';
import type {TAutofillResponse} from '@dutying/api/ward';

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

export function ConstraintConflictReview({review, disabled, current, onProceed, onRevise, onEditSettings, requestSummary, copy}: TProps) {
    const [choice, setChoice] = useState<'proceed' | 'revise'>();
    const expiry = Date.parse(review.expiresAt);
    const available = current && Number.isFinite(expiry) && expiry > Date.now();
    const message = (violation: TProps['review']['violations'][number]) => {
        const args = violation.messageArgs;
        const operator = args?.operator;
        if (
            violation.templateCode === 'SHIFT_COUNT_PER_PERIOD' &&
            typeof args?.expected === 'number' &&
            typeof args.actual === 'number' &&
            ['MIN', 'MAX', 'EXACT'].includes(String(operator))
        ) {
            const bound =
                operator === 'MAX' ? copy('최대', 'at most') : operator === 'MIN' ? copy('최소', 'at least') : copy('정확히', 'exactly');
            const subject = typeof args.subject === 'string' ? `${args.subject} · ` : '';
            return copy(
                `${subject}설정: ${bound} ${args.expected}회 / 결과: ${args.actual}회`,
                `${subject}Setting: ${bound} ${args.expected} shifts / Result: ${args.actual} shifts`,
            );
        }
        return localizeScheduleValidationMessage(violation);
    };

    return (
        <section
            className="mt-3 space-y-3 rounded-xl border border-red/30 bg-red/5 p-4"
            aria-label={copy('조건 충돌 확인', 'Review conflicting conditions')}
        >
            <p className="font-medium">
                {copy('함께 맞추기 어려운 조건이 있어요. 어떻게 진행할까요?', 'Some conditions conflict. How would you like to proceed?')}
            </p>
            {review.explanation && <p className="text-sm leading-relaxed whitespace-pre-wrap">{review.explanation}</p>}
            {requestSummary && (
                <div className="rounded-lg bg-white p-3 text-sm">
                    <p className="font-medium">{copy('이렇게 이해했어요. 맞나요?', 'Is this what you meant?')}</p>
                    <p className="mt-1 whitespace-pre-wrap">{requestSummary}</p>
                    <p className="mt-2">
                        {copy('의도와 다르면 아래에서 요청을 바꿔 주세요.', 'If this is not what you meant, change your request below.')}
                    </p>
                </div>
            )}
            <p className="text-sm font-medium">{copy('제가 제안한 표에서는 이렇게 달라져요', 'What changes in the proposed schedule')}</p>
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
            <p className="text-sm">
                {copy(
                    '제안대로 수정하면 위 내용을 이번 표에만 반영해요. 맞추지 못한 조건은 빨간색으로 표시하고, 병동의 원래 설정은 바꾸지 않아요.',
                    'Proceeding applies this result and marks unmet conditions in red. Your original settings stay the same.',
                )}
            </p>
            {!available && (
                <p className="text-sm">
                    {copy(
                        '표나 조건이 바뀌었거나 확인 시간이 지났어요. 요청을 다시 확인해 주세요.',
                        'The input changed or this review expired. Review your request again.',
                    )}
                </p>
            )}
            <div className="flex flex-wrap gap-2">
                <button
                    className="min-h-11 rounded-lg bg-main-1 px-4 py-2 text-white disabled:opacity-40"
                    disabled={disabled || !available || choice !== undefined}
                    onClick={() => {
                        setChoice('proceed');
                        void onProceed().finally(() => setChoice(undefined));
                    }}
                >
                    {copy('제안대로 이번 표 수정', 'Apply this proposal to the schedule')}
                </button>
                <button
                    className="min-h-11 rounded-lg border px-4 py-2 disabled:opacity-40"
                    disabled={disabled || choice !== undefined}
                    onClick={() => {
                        setChoice('revise');
                        onRevise();
                    }}
                >
                    {copy('요청 바꾸기', 'Change my request')}
                </button>
                <button
                    type="button"
                    className="min-h-11 rounded-lg border px-4 py-2 disabled:opacity-40"
                    disabled={disabled || choice !== undefined}
                    onClick={onEditSettings}
                >
                    {copy('설정 직접 수정', 'Edit settings myself')}
                </button>
            </div>
        </section>
    );
}
