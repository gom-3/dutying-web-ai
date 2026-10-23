import {useState} from 'react';
import {useTypedTranslation} from '@/shared/hook/use-typed-translation';
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
    const {t} = useTypedTranslation();
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
            <section aria-label={t('aiAutofillUi.semanticReview.conditionsRemoved')} className="min-w-0 space-y-2">
                <header className="flex items-start gap-2.5">
                    <StateIcon kind="success" label={t('aiAutofillUi.semanticReview.removed')} />
                    <p className="min-w-0 text-base leading-6 font-semibold break-keep text-[#333D4B]">
                        {t('aiAutofillUi.semanticReview.yourRequestConditionsWereRemoved')}
                    </p>
                </header>
                <p className="text-[13px] leading-6 text-[#667085]">{t('aiAutofillUi.semanticReview.enterANewRequest')}</p>
            </section>
        );

    const selected = selection.planId === plan.planId ? selection.ids : [];
    const ready = plan.state === 'PREVIEW_READY' || plan.state === 'CONFIRMED';
    const reviewable = plan.conditions.every((condition) =>
        condition.action === 'CATALOG_RULE'
            ? Boolean(condition.displayText?.trim())
            : ['ASSIGN', 'FORBID', 'COUNT', 'MAX_CONSECUTIVE_WORK'].includes(condition.action),
    );
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
            ? t('aiAutofillUi.semanticReview.theCalculationForTheseConditionsIsComplete')
            : !current
              ? t('aiAutofillUi.semanticReview.previousRequest')
              : plan.state === 'CONFIRMED'
                ? t('aiAutofillUi.semanticReview.yourConfirmedConditions')
                : t('aiAutofillUi.semanticReview.shallWeAdjustItThisWay')
        : conflict
          ? t('aiAutofillUi.semanticReview.yourRequestConflictsWithFixedShifts')
          : retry
            ? t('aiAutofillUi.semanticReview.yourRequestCouldNotBeReviewed')
            : expired
              ? t('aiAutofillUi.semanticReview.reviewYourRequestAgain')
              : plan.state === 'UNSUPPORTED'
                ? t('aiAutofillUi.semanticReview.someConditionsAreNotSupportedYet')
                : plan.state === 'NEEDS_CLARIFICATION'
                  ? t('aiAutofillUi.semanticReview.aLittleMoreDetailIsNeeded')
                  : t('aiAutofillUi.semanticReview.reviewYourRequest');
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
        ? t('aiAutofillUi.semanticReview.fixedShiftConflict')
        : expired
          ? t('aiAutofillUi.semanticReview.reviewNeeded')
          : retry
            ? t('aiAutofillUi.semanticReview.requestReviewFailed')
            : complete
              ? t('aiAutofillUi.semanticReview.calculationCompleted')
              : !current
                ? t('aiAutofillUi.semanticReview.previousRequest2')
                : ready
                  ? t('aiAutofillUi.semanticReview.reviewRequestConditions')
                  : t('aiAutofillUi.semanticReview.moreDetailNeeded');
    const description =
        ready || conflict
            ? null
            : retry
              ? t('aiAutofillUi.semanticReview.yourRequestIsKeptYouCanTryItAgain')
              : expired
                ? t('aiAutofillUi.semanticReview.theScheduleOrRequestChangedSoTheEarlierConditionsCannotBeUsed')
                : plan.state === 'UNSUPPORTED'
                  ? canSelect
                      ? null
                      : t('aiAutofillUi.semanticReview.editYourRequestOrChangeTheScheduleDirectly')
                  : plan.summary || t('aiAutofillUi.semanticReview.addALittleMoreDetailAboutThePeopleOrConditions');
    const listLabel =
        conflict || !ready
            ? t('aiAutofillUi.semanticReview.requestToReview')
            : complete
              ? t('aiAutofillUi.semanticReview.conditionsUsedForThisCalculation')
              : plan.state === 'CONFIRMED'
                ? t('aiAutofillUi.semanticReview.confirmedRequest')
                : t('aiAutofillUi.semanticReview.requestedChanges');

    return (
        <section aria-label={t('aiAutofillUi.semanticReview.reviewRequestConditions')} className="min-w-0 space-y-4">
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
                                        <legend className="text-[13px] font-medium">{t('aiAutofillUi.semanticReview.priority')}</legend>
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
                                                    {value === 'HARD'
                                                        ? t('aiAutofillUi.semanticReview.required')
                                                        : t('aiAutofillUi.semanticReview.preferred')}
                                                </label>
                                            ))}
                                        </div>
                                        <p className="text-[13px] break-keep text-[#475467]">
                                            {(overrides[condition.intentId] ?? condition.modality) === 'HARD'
                                                ? t('aiAutofillUi.semanticReview.aResultThatMissesThisConditionCannotBeApplied')
                                                : t('aiAutofillUi.semanticReview.weTryToMeetThisPreferenceOtherConditionsMayPreventIt')}
                                        </p>
                                    </fieldset>
                                ) : (
                                    <p className="text-[13px] break-keep text-[#475467]">
                                        {condition.modality === 'HARD'
                                            ? t('aiAutofillUi.semanticReview.required')
                                            : t('aiAutofillUi.semanticReview.preferred')}
                                        {current && ready && condition.action !== 'COUNT' && (
                                            <> · {t('aiAutofillUi.semanticReview.explicitAssignmentsAndExclusionsAreRequired')}</>
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
                            {t('aiAutofillUi.semanticReview.chooseConditionsForThisRunUnselectedConditionsWillBeExcluded')}
                        </p>
                    )}
                    <ul aria-label={t('aiAutofillUi.semanticReview.selectRequestConditions')} className="space-y-2">
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
                                                            ? t('aiAutofillUi.semanticReview.selected')
                                                            : t('aiAutofillUi.semanticReview.availableToSelect')
                                                        : t('aiAutofillUi.semanticReview.supportedCondition')
                                                    : group.status === 'UNSUPPORTED'
                                                      ? t('aiAutofillUi.semanticReview.notSupportedYet')
                                                      : t('aiAutofillUi.semanticReview.needsMoreDetail')}
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
                    {t('aiAutofillUi.semanticReview.priorityChangesApplyToThisRunOnly')}
                </p>
            )}
            {priorityDirty && current && (
                <div className="space-y-2">
                    <p role="status" className="text-[13px]">
                        {t('aiAutofillUi.semanticReview.priorityChangedSaveAndReviewTheUpdatedConditionsBeforeRunning')}
                    </p>
                    <div className="flex flex-wrap gap-2">
                        <button
                            type="button"
                            className={primary}
                            disabled={disabled || stale || savingPriority}
                            onClick={() => void savePriorities()}
                        >
                            {t('aiAutofillUi.semanticReview.reviewPriorityChanges')}
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
                            {t('aiAutofillUi.semanticReview.cancelChanges')}
                        </button>
                    </div>
                    {priorityError && <p role="alert">{t('aiAutofillUi.semanticReview.couldNotSaveChangesPleaseTryAgain')}</p>}
                </div>
            )}
            {plan.selectionAudit && (
                <details className="group min-w-0">
                    <summary className="flex min-h-[44px] cursor-pointer list-none flex-wrap items-center justify-between gap-2 rounded-[10px] bg-white px-3 py-2 text-[13px] font-medium text-[#475467] focus-visible:bg-[#4620B8] focus-visible:text-[#FFF1D6] focus-visible:outline-none">
                        <span>{t('aiAutofillUi.semanticReview.selectionDetails')}</span>
                        <span className="flex items-center gap-2 text-xs">
                            <span>
                                {t('aiAutofillUi.semanticReview.includedExcluded', {
                                    selectedConditionCount: plan.selectionAudit.selectedConditionIds.length,
                                    excludedConditionCount: plan.selectionAudit.excludedConditionIds.length,
                                })}
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
                        aria-label={t('aiAutofillUi.semanticReview.includedAndExcludedConditions')}
                        className="mt-2 space-y-2 text-[13px] leading-5"
                    >
                        {plan.selectionAudit.conditionGroups.map((group) => {
                            const included = plan.selectionAudit!.selectedConditionIds.includes(group.conditionId);

                            return (
                                <li key={group.conditionId} className="rounded-[10px] bg-white p-3">
                                    <p className="break-keep whitespace-pre-wrap text-[#333D4B]">
                                        <strong>
                                            {included ? t('aiAutofillUi.semanticReview.include') : t('aiAutofillUi.semanticReview.exclude')}
                                        </strong>
                                        {group.sourceSpan.quote.trim()}
                                    </p>
                                    {!included && (
                                        <p className="mt-1 text-xs text-[#667085]">
                                            {group.selectable
                                                ? t('aiAutofillUi.semanticReview.notSelected')
                                                : group.status === 'UNSUPPORTED'
                                                  ? t('aiAutofillUi.semanticReview.unsupportedCondition')
                                                  : t('aiAutofillUi.semanticReview.needsClarification')}
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
                    {t('aiAutofillUi.semanticReview.reviewTheFixedShiftsOrEditYourRequest')}
                </p>
            )}
            {current && (
                <>
                    {stale && !expired && (
                        <p role="status" className="rounded-[10px] bg-[#FFF4DF] px-3 py-2 text-[13px] leading-5 text-[#8A4B08]">
                            {t('aiAutofillUi.semanticReview.theScheduleChangedReviewTheRequestAgain')}
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
                                    !reviewable ||
                                    priorityDirty ||
                                    savingPriority ||
                                    (plan.state !== 'CONFIRMED' && !plan.confirmationAllowed)
                                }
                                onClick={onApply}
                            >
                                {t('aiAutofillUi.semanticReview.adjustWithTheseConditions')}
                            </button>
                        )}
                        {retry && (
                            <button type="button" className={primary} disabled={disabled} onClick={onRetry}>
                                {t('aiAutofillUi.semanticReview.tryAgain')}
                            </button>
                        )}
                        {canSelect && (
                            <button
                                type="button"
                                className={primary}
                                disabled={disabled || stale || selected.length === 0}
                                onClick={() => onSelectConditions?.(selected)}
                            >
                                {t('aiAutofillUi.semanticReview.revalidateOnlySelectedConditions')}
                            </button>
                        )}
                        <button
                            type="button"
                            className={ready || retry || canSelect || plan.state === 'NEEDS_CLARIFICATION' ? secondary : primary}
                            disabled={disabled || savingPriority}
                            onClick={onEdit}
                        >
                            {t('aiAutofillUi.semanticReview.editRequest')}
                        </button>
                    </div>
                </>
            )}
            {processing && (
                <AiConversationLoading
                    label={
                        processing === 'adjust'
                            ? t('aiAutofillUi.semanticReview.adjustingYourSchedule')
                            : t('aiAutofillUi.semanticReview.reviewingYourRequest')
                    }
                />
            )}
        </section>
    );
}
