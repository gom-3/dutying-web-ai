import {useState} from 'react';
import {semanticRecovery} from '../../../model/conversation-presentation';
import type {TSemanticPlan} from '../../../model/schedule-conversation-api';
import {AiConversationLoading} from './ai-conversation-loading';
import {AiConversationOutcomeIcon} from './ai-conversation-outcome-icon';
import {AiSemanticCondition} from './ai-semantic-condition';

type TProps = {
    plan: TSemanticPlan;
    current: boolean;
    disabled: boolean;
    stale: boolean;
    applied: boolean;
    processing?: 'adjust' | 'review' | null;
    nurseName: (id: number) => string;
    rosterNurseIds?: number[];
    copy: (ko: string, en: string) => string;
    onApply: () => void;
    onEdit: () => void;
    onRetry: () => void;
    onChangeModalities?: (overrides: Record<string, 'HARD' | 'SOFT'>) => Promise<void>;
    onSelectConditions?: (ids: string[]) => void;
};

const action =
    'flex min-h-[44px] w-full items-center justify-center rounded-[10px] px-4 py-3 text-center text-[13px] leading-5 font-semibold transition-colors focus-visible:bg-[#4620B8] focus-visible:text-[#FFF1D6] focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-40 motion-reduce:transition-none';
const primary = `${action} bg-main-1 text-white hover:bg-[#5931B9]`;
const secondary = `${action} bg-white text-[#5931B9] hover:bg-[#EDE7FF]`;

type TIconKind = 'review' | 'confirmed' | 'clarify' | 'history' | 'warning' | 'failure' | 'success';

function StateIcon({kind, label}: {kind: TIconKind; label: string}) {
    if (kind === 'success' || kind === 'failure') return <AiConversationOutcomeIcon status={kind} label={label} />;

    return (
        <svg
            role="img"
            aria-label={label}
            viewBox="0 0 20 20"
            className={`mt-[2px] size-[18px] shrink-0 ${kind === 'warning' ? 'text-[#B45309]' : kind === 'history' ? 'text-[#667085]' : 'text-main-1'}`}
        >
            {kind === 'warning' ? (
                <>
                    <path d="M8.27 3a2 2 0 0 1 3.46 0l6.93 12a2 2 0 0 1-1.73 3H3.07a2 2 0 0 1-1.73-3L8.27 3Z" fill="currentColor" />
                    <rect x="9" y="6" width="2" height="6" rx="1" fill="white" />
                    <circle cx="10" cy="15" r="1" fill="white" />
                </>
            ) : kind === 'review' ? (
                <>
                    <rect x="3" y="1" width="14" height="18" rx="3" fill="currentColor" />
                    <path d="M6 6h8v2H6zm0 4h8v2H6zm0 4h5v2H6z" fill="white" />
                </>
            ) : (
                <>
                    <circle cx="10" cy="10" r="9" fill="currentColor" />
                    {kind === 'confirmed' ? (
                        <path d="m5.5 9.5 3 3 6-6L16 8l-7.5 7.5L4 11z" fill="white" />
                    ) : kind === 'history' ? (
                        <path d="M9 4h2v5.6l3.2 1.9-1 1.7L9 10.7Z" fill="white" />
                    ) : (
                        <text x="10" y="14.5" textAnchor="middle" fontSize="14" fontWeight="700" fill="white">
                            ?
                        </text>
                    )}
                </>
            )}
        </svg>
    );
}

export function AiSemanticReview({
    plan,
    current,
    disabled,
    stale,
    applied,
    processing = null,
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
    const cleared = plan.state === 'NEEDS_CLARIFICATION' && plan.reasonCodes.includes('EMPTY_CONDITIONS') && plan.conditions.length === 0;

    if (cleared)
        return (
            <section aria-label={copy('조건 삭제 완료', 'Conditions removed')} className="min-w-0 space-y-2">
                <header className="flex items-start gap-2.5">
                    <StateIcon kind="success" label={copy('삭제 완료', 'Removed')} />
                    <p className="min-w-0 text-base leading-6 font-semibold break-keep text-[#333D4B]">
                        {copy('요청 조건을 삭제했어요.', 'Your request conditions were removed.')}
                    </p>
                </header>
                <p className="text-[13px] leading-6 text-[#667085]">{copy('새 요청을 입력해 주세요.', 'Enter a new request.')}</p>
            </section>
        );

    const selected = selection.planId === plan.planId ? selection.ids : [];
    const ready = plan.state === 'PREVIEW_READY' || plan.state === 'CONFIRMED';
    const conflict = plan.state === 'LOCKED_CONFLICT';
    const expired = plan.state === 'EXPIRED';
    const complete = ready && applied;
    const retry = !ready && !conflict && !expired && semanticRecovery(plan) === 'retry';
    const showGroups =
        !plan.selectionAudit &&
        !retry &&
        ['UNSUPPORTED', 'NEEDS_CLARIFICATION'].includes(plan.state) &&
        Boolean(plan.conditionGroups?.length);
    const canSelect = showGroups && Boolean(plan.conditionGroups?.some((group) => group.selectable)) && Boolean(onSelectConditions);
    const title = ready
        ? complete
            ? copy('이 요청으로 계산을 마쳤어요.', 'The calculation for these conditions is complete.')
            : !current
              ? copy('이전 요청 내용', 'Previous request')
              : plan.state === 'CONFIRMED'
                ? copy('확인한 조건이에요', 'Your confirmed conditions')
                : copy('이렇게 바꿀까요?', 'Shall we adjust it this way?')
        : conflict
          ? copy('고정 근무와 요청이 충돌해요', 'Your request conflicts with fixed shifts')
          : retry
            ? copy('요청을 확인하지 못했어요', 'Your request could not be reviewed')
            : expired
              ? copy('요청을 다시 확인해 주세요', 'Review your request again')
              : plan.state === 'UNSUPPORTED'
                ? copy('반영하기 어려운 조건이 있어요', 'Some conditions are not supported yet')
                : plan.state === 'NEEDS_CLARIFICATION'
                  ? copy('요청을 조금 더 확인할게요', 'A little more detail is needed')
                  : copy('요청 내용을 확인해 주세요', 'Review your request');
    const kind: TIconKind =
        conflict || expired
            ? 'warning'
            : retry
              ? 'failure'
              : complete
                ? 'success'
                : !current
                  ? 'history'
                  : ready
                    ? plan.state === 'CONFIRMED'
                        ? 'confirmed'
                        : 'review'
                    : 'clarify';
    const iconLabel = conflict
        ? copy('고정 근무 충돌', 'Fixed shift conflict')
        : expired
          ? copy('다시 확인 필요', 'Review needed')
          : retry
            ? copy('요청 확인 오류', 'Request review failed')
            : complete
              ? copy('요청 계산 완료', 'Calculation completed')
              : !current
                ? copy('이전 요청', 'Previous request')
                : ready
                  ? copy('요청 조건 확인', 'Review request conditions')
                  : copy('추가 확인 필요', 'More detail needed');
    const description =
        ready || conflict
            ? null
            : retry
              ? copy('입력한 요청은 유지돼요. 같은 요청으로 다시 시도할 수 있어요.', 'Your request is kept. You can try it again.')
              : expired
                ? copy(
                      '표나 요청이 바뀌어 이전 조건으로 진행할 수 없어요.',
                      'The schedule or request changed, so the earlier conditions cannot be used.',
                  )
                : plan.state === 'UNSUPPORTED'
                  ? canSelect
                      ? null
                      : copy('요청을 수정하거나 근무표에서 직접 바꿔 주세요.', 'Edit your request or change the schedule directly.')
                  : plan.summary ||
                    copy('대상이나 조건을 조금 더 자세히 알려 주세요.', 'Add a little more detail about the people or conditions.');
    const listLabel =
        conflict || !ready
            ? copy('확인할 요청', 'Request to review')
            : complete
              ? copy('계산에 사용한 요청', 'Conditions used for this calculation')
              : plan.state === 'CONFIRMED'
                ? copy('확인한 요청', 'Confirmed request')
                : copy('반영할 요청', 'Requested changes');

    return (
        <section aria-label={copy('요청 조건 확인', 'Review request conditions')} className="min-w-0 space-y-4">
            <header className="flex items-start gap-2.5">
                <StateIcon kind={kind} label={iconLabel} />
                <p className="min-w-0 text-base leading-6 font-semibold break-keep text-[#333D4B]">{title}</p>
            </header>
            {description && <p className="text-[13px] leading-6 break-keep whitespace-pre-line text-[#667085]">{description}</p>}
            {!showGroups && !!plan.conditions.length && (
                <div className="space-y-2">
                    <p className="text-xs leading-5 font-medium text-[#667085]">{listLabel}</p>
                    <ul aria-label={listLabel} className="space-y-2">
                        {plan.conditions.map((condition) => (
                            <AiSemanticCondition
                                key={condition.intentId}
                                condition={condition}
                                nurseName={nurseName}
                                rosterNurseIds={rosterNurseIds}
                                copy={copy}
                            >
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
                            </AiSemanticCondition>
                        ))}
                    </ul>
                </div>
            )}
            {showGroups && (
                <div className="space-y-2">
                    {current && canSelect && (
                        <p className="text-xs leading-5 text-[#667085]">
                            {copy(
                                '이번에 반영할 조건을 선택해 주세요. 선택하지 않은 조건은 제외돼요.',
                                'Choose conditions for this run. Unselected conditions will be excluded.',
                            )}
                        </p>
                    )}
                    <ul aria-label={copy('요청 조건 선택', 'Select request conditions')} className="space-y-2">
                        {plan.conditionGroups!.map((group) => {
                            const checked = selected.includes(group.conditionId);
                            const Choice = current && canSelect ? 'label' : 'div';
                            const interactive = current && canSelect && group.selectable && !disabled && !stale;

                            return (
                                <li key={group.conditionId}>
                                    <Choice
                                        className={`group flex min-h-[44px] items-start gap-3 rounded-xl p-3 focus-within:bg-[#4620B8] focus-within:text-[#FFF1D6] ${interactive ? 'cursor-pointer' : 'cursor-default'} ${checked ? 'bg-[#EDE7FF]' : 'bg-white'}`}
                                    >
                                        {current && canSelect && (
                                            <>
                                                <input
                                                    type="checkbox"
                                                    className="peer sr-only"
                                                    checked={checked}
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
                                                <span
                                                    aria-hidden="true"
                                                    className="mt-[1px] grid size-5 shrink-0 place-items-center rounded-md bg-[#E9ECF2] text-transparent peer-checked:bg-main-1 peer-checked:text-white peer-disabled:opacity-50"
                                                >
                                                    <svg viewBox="0 0 20 20" className="size-4" fill="currentColor">
                                                        <path d="m5.5 9.5 3 3 6-6L16 8l-7.5 7.5L4 11z" />
                                                    </svg>
                                                </span>
                                            </>
                                        )}
                                        <span className="min-w-0 flex-1">
                                            <span className="block text-[13px] leading-5 font-medium whitespace-pre-wrap text-[#333D4B] group-focus-within:text-[#FFF1D6]">
                                                {group.sourceSpan.quote.trim()}
                                            </span>
                                            <span className="mt-1 block text-xs leading-5 text-[#667085] group-focus-within:text-[#FFF1D6]">
                                                {group.selectable
                                                    ? current && canSelect
                                                        ? checked
                                                            ? copy('선택됨', 'Selected')
                                                            : copy('선택 가능', 'Available to select')
                                                        : copy('지원하는 조건', 'Supported condition')
                                                    : group.status === 'UNSUPPORTED'
                                                      ? copy('아직 지원하지 않아요', 'Not supported yet')
                                                      : copy('추가 확인이 필요해요', 'Needs more detail')}
                                            </span>
                                        </span>
                                    </Choice>
                                </li>
                            );
                        })}
                    </ul>
                </div>
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
                <details className="group min-w-0">
                    <summary className="flex min-h-[44px] cursor-pointer list-none flex-wrap items-center justify-between gap-2 rounded-[10px] bg-white px-3 py-2 text-[13px] font-medium text-[#475467] focus-visible:bg-[#4620B8] focus-visible:text-[#FFF1D6] focus-visible:outline-none">
                        <span>{copy('선택 내역 보기', 'Selection details')}</span>
                        <span className="flex items-center gap-2 text-xs">
                            <span>
                                {copy(
                                    `포함 ${plan.selectionAudit.selectedConditionIds.length} · 제외 ${plan.selectionAudit.excludedConditionIds.length}`,
                                    `${plan.selectionAudit.selectedConditionIds.length} included · ${plan.selectionAudit.excludedConditionIds.length} excluded`,
                                )}
                            </span>
                            <svg
                                aria-hidden="true"
                                viewBox="0 0 20 20"
                                className="size-4 shrink-0 transition-transform group-open:rotate-180 motion-reduce:transition-none"
                                fill="currentColor"
                            >
                                <path d="m5 7 5 6 5-6z" />
                            </svg>
                        </span>
                    </summary>
                    <ul
                        aria-label={copy('적용 및 제외 조건', 'Included and excluded conditions')}
                        className="mt-2 space-y-2 text-[13px] leading-5"
                    >
                        {plan.selectionAudit.conditionGroups.map((group) => {
                            const included = plan.selectionAudit!.selectedConditionIds.includes(group.conditionId);

                            return (
                                <li key={group.conditionId} className="rounded-[10px] bg-white p-3">
                                    <p className="break-keep whitespace-pre-wrap text-[#333D4B]">
                                        <strong>{included ? copy('포함: ', 'Include: ') : copy('제외: ', 'Exclude: ')}</strong>
                                        {group.sourceSpan.quote.trim()}
                                    </p>
                                    {!included && (
                                        <p className="mt-1 text-xs text-[#667085]">
                                            {group.selectable
                                                ? copy('선택하지 않은 조건', 'Not selected')
                                                : group.status === 'UNSUPPORTED'
                                                  ? copy('지원하지 않는 조건', 'Unsupported condition')
                                                  : copy('확인이 필요한 조건', 'Needs clarification')}
                                        </p>
                                    )}
                                </li>
                            );
                        })}
                    </ul>
                </details>
            )}
            {conflict && (
                <p className="text-[13px] leading-6 break-keep text-[#667085]">
                    {copy('고정 근무를 확인하거나 요청을 수정해 주세요.', 'Review the fixed shifts or edit your request.')}
                </p>
            )}
            {current && (
                <>
                    {stale && !expired && (
                        <p role="status" className="rounded-[10px] bg-[#FFF4DF] px-3 py-2 text-[13px] leading-5 text-[#8A4B08]">
                            {copy('표가 바뀌었어요. 요청을 다시 확인해 주세요.', 'The schedule changed. Review the request again.')}
                        </p>
                    )}
                    <div className="grid gap-2">
                        {ready && !complete && (
                            <button
                                type="button"
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
                        {retry && (
                            <button type="button" className={primary} disabled={disabled} onClick={onRetry}>
                                {copy('다시 시도하기', 'Try again')}
                            </button>
                        )}
                        {canSelect && (
                            <button
                                type="button"
                                className={primary}
                                disabled={disabled || stale || selected.length === 0}
                                onClick={() => onSelectConditions?.(selected)}
                            >
                                {copy('선택한 조건만 다시 검증', 'Revalidate only selected conditions')}
                            </button>
                        )}
                        <button
                            type="button"
                            className={ready || retry || canSelect || plan.state === 'NEEDS_CLARIFICATION' ? secondary : primary}
                            disabled={disabled || savingPriority}
                            onClick={onEdit}
                        >
                            {copy('요청 수정하기', 'Edit request')}
                        </button>
                    </div>
                </>
            )}
            {processing && (
                <AiConversationLoading
                    label={
                        processing === 'adjust'
                            ? copy('근무표 수정 중', 'Adjusting your schedule')
                            : copy('요청 확인 중', 'Reviewing your request')
                    }
                />
            )}
        </section>
    );
}
