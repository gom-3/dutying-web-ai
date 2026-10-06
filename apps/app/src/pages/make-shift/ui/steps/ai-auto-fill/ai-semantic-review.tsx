import {semanticRecovery} from '../../../model/conversation-presentation';
import type {TSemanticPlan} from '../../../model/schedule-conversation-api';

type TProps = {
    plan: TSemanticPlan;
    current: boolean;
    disabled: boolean;
    stale: boolean;
    applied: boolean;
    processing: 'adjust' | 'review' | null;
    nurseName: (id: number) => string;
    copy: (ko: string, en: string) => string;
    onApply: () => void;
    onEdit: () => void;
    onRetry: () => void;
};

const primary =
    'min-h-11 rounded-xl bg-main-1 px-4 py-3 text-[13.5px] font-medium text-white hover:bg-[#5931B9] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-main-1 disabled:cursor-not-allowed disabled:opacity-40';
const secondary =
    'min-h-11 rounded-xl px-3 py-3 text-[13.5px] font-medium text-main-1 hover:bg-main-light focus-visible:bg-main-light focus-visible:outline-none disabled:opacity-40';

function period(dates: string[], copy: TProps['copy']) {
    const sorted = [...dates].sort();
    const format = (date: string) => {
        const [, month, day] = date.split('-').map(Number);

        return copy(`${month}월 ${day}일`, `${month}/${day}`);
    };

    if (!sorted.length) return '';

    const consecutive = sorted.every((date, index) => index === 0 || Date.parse(date) - Date.parse(sorted[index - 1]) === 86400000);

    if (sorted.length > 1 && consecutive) {
        const first = sorted[0];
        const last = sorted[sorted.length - 1];
        const [, month, day] = first.split('-').map(Number);

        return first.slice(0, 7) === last.slice(0, 7)
            ? copy(`${month}월 ${day}~${Number(last.slice(-2))}일`, `${format(first)}–${format(last)}`)
            : `${format(first)} ~ ${format(last)}`;
    }

    return sorted.map(format).join(', ');
}

export function AiSemanticReview({plan, current, disabled, stale, applied, processing, nurseName, copy, onApply, onEdit, onRetry}: TProps) {
    const ready = plan.state === 'PREVIEW_READY' || plan.state === 'CONFIRMED';
    const retry = semanticRecovery(plan) === 'retry';
    const blockedMessage = retry
        ? copy(
              '요청을 확인하는 중 문제가 생겼어요. 같은 요청으로 다시 시도할 수 있어요.',
              'Something went wrong while reviewing your request. You can try the same request again.',
          )
        : plan.state === 'UNSUPPORTED'
          ? copy(
                '이 요청은 아직 자동으로 반영하기 어려워요. 요청을 수정하거나 표에서 직접 바꿔 주세요.',
                'This request is not supported yet. Edit the request or change the schedule directly.',
            )
          : plan.summary;

    return (
        <section aria-label={copy('요청 조건 확인', 'Review request conditions')} className="space-y-3">
            <p className="font-medium">
                {ready
                    ? applied
                        ? copy('이 조건으로 근무표를 조절했어요.', 'The schedule was adjusted with these conditions.')
                        : current
                          ? copy('이렇게 조절할까요?', 'Shall we adjust it this way?')
                          : copy('이전 요청 내용', 'Previous request')
                    : blockedMessage}
            </p>
            {!!plan.conditions.length && (
                <ul className="space-y-3">
                    {plan.conditions.map((condition) => (
                        <li key={condition.intentId} className="border-l-2 border-main-1/25 pl-3">
                            <p className="text-[13px] text-[#6B7280]">{period(condition.dates, copy)}</p>
                            <p>
                                <span className="font-medium">{condition.nurseIds.map(nurseName).join(', ')}</span>
                                {copy('의 ', ': ')}
                                {condition.shiftCodes.join(', ')}
                                {copy(' 근무', ' shifts')}{' '}
                                {condition.action === 'FORBID'
                                    ? copy('배정하지 않기', 'will be excluded')
                                    : condition.action === 'ASSIGN'
                                      ? copy('배정하기', 'will be assigned')
                                      : `${condition.quantifier === 'GROUP_TOTAL' ? copy('합계', 'combined') : copy('각자', 'each')} ${condition.operator === 'MIN' ? copy('최소', 'at least') : condition.operator === 'MAX' ? copy('최대', 'at most') : copy('정확히', 'exactly')} ${condition.count}${copy('회', ' times')}`}
                            </p>
                            <p className="text-[13px] text-[#6B7280]">
                                {condition.modality === 'HARD'
                                    ? copy('꼭 지킬 조건', 'Required')
                                    : copy('가능하면 맞출 조건', 'If possible')}
                            </p>
                        </li>
                    ))}
                </ul>
            )}
            {current && (
                <>
                    {stale && (
                        <p role="status" className="text-[13px] text-[#6B7280]">
                            {copy('표가 바뀌었어요. 요청을 다시 확인해 주세요.', 'The schedule changed. Review the request again.')}
                        </p>
                    )}
                    <div className="flex flex-wrap gap-1 pt-1">
                        {ready && (
                            <button
                                className={primary}
                                disabled={disabled || stale || (plan.state !== 'CONFIRMED' && !plan.confirmationAllowed)}
                                onClick={onApply}
                            >
                                {copy('이 조건으로 조절', 'Adjust with these conditions')}
                            </button>
                        )}
                        {!ready && retry && (
                            <button className={primary} disabled={disabled} onClick={onRetry}>
                                {copy('다시 시도하기', 'Try again')}
                            </button>
                        )}
                        <button
                            className={ready || retry || plan.state === 'NEEDS_CLARIFICATION' ? secondary : primary}
                            disabled={disabled}
                            onClick={onEdit}
                        >
                            {copy('요청 수정', 'Edit request')}
                        </button>
                    </div>
                </>
            )}
            {processing && (
                <p role="status" className="text-[13px] text-[#6B7280]">
                    {processing === 'adjust'
                        ? copy('요청한 조건으로 조절 중이에요.', 'Adjusting with your conditions.')
                        : copy('요청을 확인하고 있어요.', 'Reviewing your request.')}
                </p>
            )}
        </section>
    );
}
