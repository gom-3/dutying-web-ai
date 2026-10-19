import type {TAutofillResponse} from '@dutying/api/ward';
import {localizeScheduleValidationMessage} from '@/features/shift-editor/model/schedule-violations/format-validation-message';
import {useTypedTranslation} from '@/shared/hook/use-typed-translation';
import {isGenerateReviewDraft} from '../../../model/ai-execution-failure';

export function AiConversationResultDetails({result}: {result: TAutofillResponse}) {
    const {t} = useTypedTranslation();
    const hard = result.validation?.summary?.hardCount ?? 0;
    const soft = result.validation?.summary?.softCount ?? 0;
    const rules = result.requestRuleResults?.filter((rule) => rule.violationCount > 0) ?? [];
    const goals = result.goalResults ?? [];
    const messages = [
        ...new Set(
            [...(result.blockingViolations ?? []), ...(result.validation?.violations ?? [])]
                .map(localizeScheduleValidationMessage)
                .filter((message) => message && !/^[A-Z][A-Z_]+$/.test(message)),
        ),
    ];
    const review = isGenerateReviewDraft(result);
    const baseline = result.validationTarget === 'BASELINE';
    const candidate = result.validationTarget === 'CANDIDATE';

    if (!review && hard === 0 && soft === 0 && rules.length === 0 && goals.length === 0 && messages.length === 0) return null;

    return (
        <details
            className="mt-3 rounded-xl bg-white p-3 text-[13px] leading-6 break-keep"
            open={review || (hard > 0 && !baseline && !candidate)}
        >
            <summary className="min-h-11 cursor-pointer rounded-lg px-2 py-2 font-medium text-[#475467] hover:bg-main-light hover:text-[#5931B9] focus-visible:bg-main-1 focus-visible:text-white focus-visible:outline-none">
                {t(
                    baseline
                        ? 'aiAdjust.resultInfo.baselineTitle'
                        : candidate
                          ? 'aiAdjust.resultInfo.candidateTitle'
                          : 'aiAdjust.resultInfo.title',
                )}
            </summary>
            {baseline && <p className="mb-2 text-[#667085]">{t('aiAdjust.resultInfo.baselineNote')}</p>}
            {candidate && <p className="mb-2 text-[#667085]">{t('aiAdjust.resultInfo.candidateNote')}</p>}
            {review && <p>{t('aiAdjust.reviewDraft.notice')}</p>}
            {hard > 0 && <p>{t('aiAdjust.resultInfo.hard', {count: hard})}</p>}
            {soft > 0 && <p>{t('aiAdjust.resultInfo.soft', {count: soft})}</p>}
            {messages.length > 0 && (
                <ul className="mt-2 space-y-1">
                    {messages.map((message) => (
                        <li key={message}>{message}</li>
                    ))}
                </ul>
            )}
            {rules.map((rule) => (
                <p key={rule.requestId}>
                    {t('aiAdjust.resultInfo.remaining', {
                        label: rule.displayLabel?.trim() ? rule.displayLabel : t('aiAdjust.resultInfo.rule'),
                        count: rule.violationCount,
                    })}
                </p>
            ))}
            {goals.map((goal, index) => (
                <div key={`${goal.goalType}:${index}`} className="mt-2">
                    <p>
                        {t(
                            `aiAdjust.resultInfo.goal.${['SATISFIED', 'IMPROVED_UNMET', 'NOT_IMPROVED', 'NOT_EVALUABLE'].includes(goal.goalStatus) ? goal.goalStatus : 'NOT_EVALUABLE'}`,
                        )}
                    </p>
                    {goal.goalType === 'MINIMIZE_SINGLE_NIGHT_RUNS' &&
                        goal.beforeSingleNightRuns != null &&
                        goal.afterSingleNightRuns != null && (
                            <p>
                                {t('aiAdjust.resultInfo.singleNight', {
                                    before: goal.beforeSingleNightRuns,
                                    after: goal.afterSingleNightRuns,
                                })}
                            </p>
                        )}
                </div>
            ))}
        </details>
    );
}
