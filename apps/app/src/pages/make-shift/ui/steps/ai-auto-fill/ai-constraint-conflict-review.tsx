import {localizeScheduleValidationMessage} from '@/features/shift-editor/model/schedule-violations/format-validation-message';
import {useState} from 'react';
import type {TAutofillResponse} from '@dutying/api/ward';

type TProps = {
    review: NonNullable<TAutofillResponse['conflictReview']>;
    disabled: boolean;
    current: boolean;
    onProceed: () => Promise<void>;
    onRevise: () => void;
    copy: (ko: string, en: string) => string;
};

export function ConstraintConflictReview({review, disabled, current, onProceed, onRevise, copy}: TProps) {
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
                {copy(
                    '다음 조건을 지키지 못해요. 이번 수정에 한해 진행할까요?',
                    'These conditions cannot be met. Proceed with these exceptions for this change?',
                )}
            </p>
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
                    '진행하면 이 결과를 적용하고, 지키지 못한 조건은 빨간색으로 표시해요. 원래 조건 설정은 유지돼요.',
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
                    {copy('이번에는 진행', 'Proceed this time')}
                </button>
                <button
                    className="min-h-11 rounded-lg border px-4 py-2 disabled:opacity-40"
                    disabled={disabled || choice !== undefined}
                    onClick={() => {
                        setChoice('revise');
                        onRevise();
                    }}
                >
                    {copy('요청 수정', 'Edit request')}
                </button>
            </div>
        </section>
    );
}
