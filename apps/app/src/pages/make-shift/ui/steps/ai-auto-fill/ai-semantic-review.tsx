import {useState} from 'react';
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
    rosterNurseIds?: number[];
    copy: (ko: string, en: string) => string;
    onApply: () => void;
    onEdit: () => void;
    onRetry: () => void;
    onChangeModalities?: (overrides: Record<string, 'HARD' | 'SOFT'>) => Promise<void>;
    onSelectConditions?: (ids: string[]) => void;
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

export function AiSemanticReview({
    plan,
    current,
    disabled,
    stale,
    applied,
    processing,
    nurseName,
    rosterNurseIds = [],
    copy,
    onApply,
    onEdit,
    onRetry,
    onSelectConditions,
    onChangeModalities,
}: TProps) {
    const [selection, setSelection] = useState<{planId: string; ids: string[]}>({planId: plan.planId, ids: []});
    const selected = selection.planId === plan.planId ? selection.ids : [];
    const canSelect =
        !plan.selectionAudit &&
        ['UNSUPPORTED', 'NEEDS_CLARIFICATION'].includes(plan.state) &&
        plan.conditionGroups?.some((group) => group.selectable) &&
        Boolean(onSelectConditions);
    const ready = plan.state === 'PREVIEW_READY' || plan.state === 'CONFIRMED';
    const [priorityEdits, setPriorityEdits] = useState<{hash: string; values: Record<string, 'HARD' | 'SOFT'>}>({
        hash: plan.planHash,
        values: {},
    });
    const [savingPriority, setSavingPriority] = useState(false);
    const [priorityError, setPriorityError] = useState(false);
    const overrides = priorityEdits.hash === plan.planHash ? priorityEdits.values : {};
    const priorityDirty = Object.keys(overrides).length > 0;
    const canEditPriority = current && plan.state === 'PREVIEW_READY' && Boolean(onChangeModalities);
    const savePriorities = async () => {
        if (!priorityDirty || savingPriority || disabled || stale) return;

        setSavingPriority(true);
        setPriorityError(false);

        try {
            await onChangeModalities?.(overrides);
        } catch {
            setPriorityError(true);
        } finally {
            setSavingPriority(false);
        }
    };
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
                        ? copy('이 요청으로 계산을 마쳤어요.', 'The calculation for these conditions is complete.')
                        : current
                          ? copy('이렇게 바꿀까요?', 'Shall we adjust it this way?')
                          : copy('이전 요청 내용', 'Previous request')
                    : blockedMessage}
            </p>
            {!!plan.conditions.length && (
                <ul className="space-y-3">
                    {plan.conditions.map((condition) => (
                        <li key={condition.intentId} className="border-l-2 border-main-1/25 pl-3">
                            <p className="text-[13px] text-[#6B7280]">{period(condition.dates, copy)}</p>
                            <p>
                                <span className="font-medium">
                                    {rosterNurseIds.length > 0 &&
                                    new Set(condition.nurseIds).size === new Set(rosterNurseIds).size &&
                                    rosterNurseIds.every((id) => condition.nurseIds.includes(id))
                                        ? copy('전체 간호사', 'All nurses')
                                        : condition.nurseIds.map((id) => copy(`${nurseName(id)}님`, nurseName(id))).join(', ')}
                                </span>
                                {copy(' · ', ': ')}
                                {condition.action === 'COUNT' && condition.quantifier === 'GROUP_TOTAL' && condition.dates.length === 1 ? (
                                    <>
                                        {condition.shiftCodes.map((code) => (code === 'O' ? copy('휴무', 'off-duty') : code)).join(', ')}
                                        {copy(' 인원을 ', ' headcount: ')}
                                        {condition.operator === 'MIN'
                                            ? copy('최소', 'at least')
                                            : condition.operator === 'MAX'
                                              ? copy('최대', 'at most')
                                              : copy('정확히', 'exactly')}{' '}
                                        {condition.count}
                                        {copy('명으로 맞춰요.', ' nurses.')}
                                    </>
                                ) : (
                                    <>
                                        {condition.shiftCodes.join(', ')}
                                        {copy(' 근무를', ' shifts')}{' '}
                                        {condition.action === 'FORBID'
                                            ? copy('배정하지 않아요.', 'will be excluded')
                                            : condition.action === 'ASSIGN'
                                              ? copy('배정해요.', 'will be assigned')
                                              : `${condition.quantifier === 'GROUP_TOTAL' ? copy('합계', 'combined') : copy('각각', 'each')} ${condition.operator === 'MIN' ? copy('최소', 'at least') : condition.operator === 'MAX' ? copy('최대', 'at most') : copy('정확히', 'exactly')} ${condition.count}${copy('회 배정해요.', ' times')}`}
                                    </>
                                )}
                            </p>
                            {canEditPriority && plan.modalityEditableIntentIds?.includes(condition.intentId) ? (
                                <fieldset className="mt-2 space-y-1" disabled={disabled || stale || savingPriority}>
                                    <legend className="text-[13px] font-medium">{copy('반영 방식', 'Priority')}</legend>
                                    <div className="flex flex-wrap gap-2">
                                        {(['SOFT', 'HARD'] as const).map((value) => (
                                            <label
                                                key={value}
                                                className="flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border border-gray-6 bg-white px-3 text-[13px] focus-within:outline-2 focus-within:outline-main-1"
                                            >
                                                <input
                                                    type="radio"
                                                    className="accent-main-1"
                                                    name={`priority-${plan.planId}-${condition.intentId}`}
                                                    value={value}
                                                    checked={(overrides[condition.intentId] ?? condition.modality) === value}
                                                    onChange={() => {
                                                        const values = {...overrides};

                                                        if (value === condition.modality) delete values[condition.intentId];
                                                        else values[condition.intentId] = value;

                                                        setPriorityEdits({hash: plan.planHash, values});
                                                        setPriorityError(false);
                                                    }}
                                                />
                                                {copy(value === 'HARD' ? '필수' : '권장', value === 'HARD' ? 'Required' : 'Preferred')}
                                            </label>
                                        ))}
                                    </div>
                                    <p className="text-[13px] break-keep text-[#475467]">
                                        {(overrides[condition.intentId] ?? condition.modality) === 'HARD'
                                            ? copy(
                                                  '충족하지 못한 결과는 적용하지 않아요.',
                                                  'A result that misses this condition cannot be applied.',
                                              )
                                            : copy(
                                                  '가능한 만큼 맞추며, 다른 조건 때문에 충족하지 못할 수 있어요.',
                                                  'We try to meet this preference; other conditions may prevent it.',
                                              )}
                                    </p>
                                </fieldset>
                            ) : (
                                <p className="text-[13px] break-keep text-[#475467]">
                                    {condition.modality === 'HARD' ? copy('필수', 'Required') : copy('권장', 'Preferred')}
                                    {current && ready && condition.action !== 'COUNT' && (
                                        <>
                                            {' '}
                                            ·{' '}
                                            {copy(
                                                '지정·금지한 배정은 필수로 적용해요.',
                                                'Explicit assignments and exclusions are required.',
                                            )}
                                        </>
                                    )}
                                </p>
                            )}
                        </li>
                    ))}
                </ul>
            )}
            {canEditPriority && Boolean(plan.modalityEditableIntentIds?.length) && (
                <p className="text-[13px] break-keep text-[#475467]">
                    {copy('반영 방식 변경은 이번 실행에만 적용돼요.', 'Priority changes apply to this run only.')}
                </p>
            )}
            {priorityDirty && current && (
                <div className="space-y-2">
                    <p role="status" className="text-[13px]">
                        {copy(
                            '반영 방식을 바꿨어요. 변경한 조건을 확인한 뒤 실행해 주세요.',
                            'Priority changed. Save and review the updated conditions before running.',
                        )}
                    </p>
                    <div className="flex flex-wrap gap-2">
                        <button
                            type="button"
                            className={primary}
                            disabled={disabled || stale || savingPriority}
                            onClick={() => void savePriorities()}
                        >
                            {copy('변경한 조건 확인하기', 'Review priority changes')}
                        </button>
                        <button
                            type="button"
                            className={secondary}
                            disabled={disabled || savingPriority}
                            onClick={() => {
                                setPriorityEdits({hash: plan.planHash, values: {}});
                                setPriorityError(false);
                            }}
                        >
                            {copy('변경 취소', 'Cancel changes')}
                        </button>
                    </div>
                    {priorityError && (
                        <p role="alert">
                            {copy('변경 내용을 저장하지 못했어요. 다시 시도해 주세요.', 'Could not save changes. Please try again.')}
                        </p>
                    )}
                </div>
            )}
            {plan.selectionAudit && (
                <ul aria-label={copy('적용 및 제외 조건', 'Applied and excluded conditions')} className="space-y-2 text-[13px]">
                    {plan.selectionAudit.conditionGroups.map((group) => {
                        const included = plan.selectionAudit!.selectedConditionIds.includes(group.conditionId);

                        return (
                            <li key={group.conditionId}>
                                <strong>{included ? copy('적용: ', 'Apply: ') : copy('제외: ', 'Exclude: ')}</strong>
                                <span className="whitespace-pre-wrap">{group.sourceSpan.quote.trim()}</span>
                                {!included && (
                                    <p>
                                        {group.selectable
                                            ? copy('사용자가 선택하지 않음', 'Not selected by you')
                                            : group.status === 'UNSUPPORTED'
                                              ? copy('지원하지 않는 조건', 'Unsupported condition')
                                              : copy(
                                                    '확인이 필요하거나 다른 조건과 연결됨',
                                                    'Needs clarification or depends on other conditions',
                                                )}
                                    </p>
                                )}
                            </li>
                        );
                    })}
                </ul>
            )}
            {!ready && !plan.selectionAudit && !!plan.conditionGroups?.length && (
                <div className="space-y-2">
                    <p className="text-[13px]">
                        {copy(
                            '독립 조건은 줄바꿈으로 구분해 주세요. 선택하지 않은 조건은 이번 실행에서 제외됩니다.',
                            'Put independent conditions on separate lines. Unselected conditions will be excluded from this run.',
                        )}
                    </p>
                    {plan.conditionGroups.map((group) => (
                        <label key={group.conditionId} className="block rounded-lg border border-gray-6 p-3 text-[13px]">
                            {canSelect && (
                                <input
                                    type="checkbox"
                                    checked={selected.includes(group.conditionId)}
                                    disabled={!group.selectable || !current || disabled || stale}
                                    onChange={(event) =>
                                        setSelection({
                                            planId: plan.planId,
                                            ids: event.target.checked
                                                ? [...selected, group.conditionId]
                                                : selected.filter((id) => id !== group.conditionId),
                                        })
                                    }
                                />
                            )}
                            <span className="ml-2 whitespace-pre-wrap">{group.sourceSpan.quote.trim()}</span>
                            <p>
                                {group.selectable
                                    ? selected.includes(group.conditionId)
                                        ? copy('적용 예정', 'Will apply')
                                        : copy('제외 예정 · 선택하지 않음', 'Will exclude · not selected')
                                    : group.status === 'UNSUPPORTED'
                                      ? copy('제외 예정 · 지원하지 않는 조건', 'Will exclude · unsupported condition')
                                      : copy(
                                            '제외 예정 · 확인이 필요하거나 다른 조건과 연결됨',
                                            'Will exclude · needs clarification or depends on other conditions',
                                        )}
                            </p>
                        </label>
                    ))}
                    {current && canSelect && (
                        <button
                            className={primary}
                            disabled={disabled || stale || selected.length === 0}
                            onClick={() => onSelectConditions?.(selected)}
                        >
                            {copy('선택한 조건만 다시 검증', 'Revalidate only selected conditions')}
                        </button>
                    )}
                </div>
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
                                disabled={
                                    disabled ||
                                    stale ||
                                    priorityDirty ||
                                    savingPriority ||
                                    (plan.state !== 'CONFIRMED' && !plan.confirmationAllowed)
                                }
                                onClick={onApply}
                            >
                                {copy('이대로 수정하기', 'Adjust with these conditions')}
                            </button>
                        )}
                        {!ready && retry && (
                            <button className={primary} disabled={disabled} onClick={onRetry}>
                                {copy('다시 시도하기', 'Try again')}
                            </button>
                        )}
                        <button
                            className={ready || retry || plan.state === 'NEEDS_CLARIFICATION' ? secondary : primary}
                            disabled={disabled || savingPriority}
                            onClick={onEdit}
                        >
                            {copy('요청 수정하기', 'Edit request')}
                        </button>
                    </div>
                </>
            )}
            {processing && (
                <p role="status" className="text-[13px] text-[#6B7280]">
                    {processing === 'adjust'
                        ? copy('요청한 내용으로 근무표를 수정하고 있어요.', 'Adjusting with your conditions.')
                        : copy('요청을 확인하고 있어요.', 'Reviewing your request.')}
                </p>
            )}
        </section>
    );
}
