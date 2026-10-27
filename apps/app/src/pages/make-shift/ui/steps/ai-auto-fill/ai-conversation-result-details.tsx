import type {TAutofillResponse, TScheduleViolationDto} from '@dutying/api/ward';
import {localizeScheduleValidationMessage} from '@/features/shift-editor/model/schedule-violations/format-validation-message';
import {useTypedTranslation} from '@/shared/hook/use-typed-translation';
import {isGenerateReviewDraft} from '../../../model/ai-execution-failure';
import {authoringOutcome} from '../../../model/intent-first-authoring';
import {AiScheduleWarningList} from './ai-schedule-warning-list';

export function AiConversationResultDetails({result, clauseText}: {result: TAutofillResponse; clauseText?: (clauseId: string) => string}) {
    const {t} = useTypedTranslation();
    const hard = result.validation?.summary?.hardCount ?? 0;
    const soft = result.validation?.summary?.softCount ?? 0;
    const rules = result.requestRuleResults?.filter((rule) => rule.violationCount > 0) ?? [];
    const outcome = authoringOutcome(result);
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

    if (outcome) {
        const labelFor = (id: string, fallback?: string) => [clauseText?.(id), fallback].find((label) => label?.trim())?.trim() ?? '';
        const clauses = outcome.clauses.filter((clause) => clause.kind !== 'REVIEW' && labelFor(clause.clauseId, clause.displayText));
        const uniqueIssues = (issues: TScheduleViolationDto[]) => [
            ...new Map(
                issues
                    .filter((issue) => {
                        const message = localizeScheduleValidationMessage(issue)?.trim();

                        return message && !/^[A-Z][A-Z_]+$/.test(message);
                    })
                    .map((issue) => [issue.violationId || JSON.stringify([issue.message, issue.affectedCells]), issue]),
            ).values(),
        ];
        // Candidate-specific conditions are already beside its before/after table.
        const important =
            candidate && result.candidate ? [] : uniqueIssues([...outcome.violationDelta.new, ...outcome.violationDelta.worsened]);
        const importantIds = new Set(important.map((issue) => issue.violationId));
        const otherIssues =
            candidate && result.candidate
                ? []
                : uniqueIssues([
                      ...(result.blockingViolations ?? []),
                      ...(result.validation?.violations ?? []),
                      ...outcome.violationDelta.unchanged,
                  ]).filter((issue) => !importantIds.has(issue.violationId));
        const measuredGoals = goals.filter(
            (goal) =>
                goal.goalType === 'MINIMIZE_SINGLE_NIGHT_RUNS' &&
                Number.isFinite(goal.beforeSingleNightRuns) &&
                Number.isFinite(goal.afterSingleNightRuns),
        );
        const namedRules = rules.filter((rule) => rule.displayLabel?.trim());
        const betterGroups = (['improved', 'resolved'] as const)
            .map((category) => ({category, issues: uniqueIssues(outcome.violationDelta[category])}))
            .filter((group) => group.issues.length > 0);
        const betterIds = new Set(betterGroups.flatMap((group) => group.issues.map((issue) => issue.violationId)));
        const remainingIssues = otherIssues.filter((issue) => !betterIds.has(issue.violationId));
        const hasDetails =
            betterGroups.length > 0 ||
            clauses.length > 0 ||
            remainingIssues.length > 0 ||
            namedRules.length > 0 ||
            measuredGoals.length > 0 ||
            outcome.appliedConcessionIds.length > 0;
        const issueList = (issues: TScheduleViolationDto[]) => <AiScheduleWarningList violations={issues} />;

        if (!hasDetails && important.length === 0) return null;

        return (
            <div className="mt-3 space-y-3 text-[13px] leading-6">
                {important.length > 0 && (
                    <div className="rounded-xl bg-white p-3">
                        <p className="font-medium">{t('aiConversationSidebar.authoring.warnings')}</p>
                        {issueList(important)}
                    </div>
                )}
                {hasDetails && (
                    <details className="rounded-xl bg-white p-3">
                        <summary className="min-h-11 cursor-pointer rounded-lg px-2 py-2 font-medium focus-visible:outline-2 focus-visible:outline-main-1">
                            {t('aiConversationSidebar.authoring.details')}
                        </summary>
                        {outcome.appliedConcessionIds.length > 0 && <p>{t('aiConversationSidebar.authoring.concessions')}</p>}
                        {clauses.map((clause) => (
                            <p key={clause.clauseId}>
                                {labelFor(clause.clauseId, clause.displayText)} ·{' '}
                                {t(`aiConversationSidebar.authoring.clause.${clause.status}`)}
                            </p>
                        ))}
                        {issueList(remainingIssues)}
                        {betterGroups.map((group) => (
                            <div key={group.category}>
                                <p>{t(`aiConversationSidebar.authoring.delta.${group.category}`)}</p>
                                {issueList(group.issues)}
                            </div>
                        ))}
                        {namedRules.map((rule) => (
                            <p key={rule.requestId}>
                                {t('aiAdjust.resultInfo.remaining', {
                                    label: rule.displayLabel?.trim() ?? '',
                                    count: rule.violationCount,
                                })}
                            </p>
                        ))}
                        {measuredGoals.map((goal, index) => (
                            <p key={index}>
                                {t('aiAdjust.resultInfo.singleNight', {
                                    before: goal.beforeSingleNightRuns,
                                    after: goal.afterSingleNightRuns,
                                })}
                            </p>
                        ))}
                    </details>
                )}
            </div>
        );
    }

    if (!outcome && !review && hard === 0 && soft === 0 && rules.length === 0 && goals.length === 0 && messages.length === 0) return null;

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
