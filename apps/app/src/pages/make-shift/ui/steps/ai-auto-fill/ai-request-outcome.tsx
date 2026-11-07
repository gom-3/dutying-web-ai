import type {TAuthoringClauseResult, TAutofillResponse} from '@dutying/api/ward';
import {Check, CircleHelp, History, MessageCircleMore, Minus, TrendingUp, X, type LucideIcon} from 'lucide-react';
import {useTypedTranslation} from '@/shared/hook/use-typed-translation';
import {authoringOutcome} from '../../../model/intent-first-authoring';

type TClauseStatus = TAuthoringClauseResult['status'];
type TOutcomeRow = {status: TClauseStatus; measurement: string | null; count: number};

const statusAppearance: Record<TClauseStatus, {Icon: LucideIcon; colors: string}> = {
    SATISFIED: {Icon: Check, colors: 'bg-[#E5F5ED] text-[#17634C]'},
    ALREADY_SATISFIED: {Icon: History, colors: 'bg-[#E8ECF2] text-[#475467]'},
    IMPROVED: {Icon: TrendingUp, colors: 'bg-[#E5F5ED] text-[#17634C]'},
    UNCHANGED: {Icon: Minus, colors: 'bg-[#E8ECF2] text-[#475467]'},
    UNSATISFIED: {Icon: X, colors: 'bg-[#FCEBE9] text-[#983D35]'},
    UNVERIFIED: {Icon: CircleHelp, colors: 'bg-[#FFF0D6] text-[#78500F]'},
};
const countMetrics = new Set(['SHIFT_COUNT', 'PATTERN_COUNT', 'MINIMIZE_SINGLE_OFF_RUNS', 'MINIMIZE_SINGLE_NIGHT_RUNS']);

/** Explain verified observations; never turn a REVIEW into a success claim. */
export function AiRequestOutcome({result, showChangedSummary = true}: {result: TAutofillResponse; showChangedSummary?: boolean}) {
    const {t} = useTypedTranslation();
    const outcome = authoringOutcome(result);

    if (outcome?.validation.spring !== 'VERIFIED') return null;

    const requests = new Map<string, Map<string, TOutcomeRow>>();

    for (const clause of outcome.clauses) {
        const label = clause.displayText?.trim();

        if (!label) continue;

        const measurement =
            clause.kind === 'DIRECTIONAL' &&
            clause.status !== 'UNVERIFIED' &&
            countMetrics.has(clause.metricKey ?? '') &&
            typeof clause.before === 'number' &&
            Number.isFinite(clause.before) &&
            typeof clause.after === 'number' &&
            Number.isFinite(clause.after)
                ? t('aiConversationSidebar.authoring.measuredCount', {before: clause.before, after: clause.after})
                : null;
        const rows = requests.get(label) ?? new Map<string, TOutcomeRow>();
        const key = JSON.stringify([clause.status, measurement]);
        const row = rows.get(key);

        rows.set(key, {status: clause.status, measurement, count: (row?.count ?? 0) + 1});
        requests.set(label, rows);
    }

    if (!requests.size) return null;

    const changes = result.candidate?.changedCells ?? result.changedCells;

    return (
        <section className="mt-5 space-y-2 text-[13px] leading-5" aria-label={t('aiConversationSidebar.authoring.requestResults')}>
            <h3 className="text-sm font-semibold text-sub-1">{t('aiConversationSidebar.authoring.requestResults')}</h3>
            <ul className="space-y-2">
                {Array.from(requests, ([label, rows]) => (
                    <li key={label} className="flex min-w-0 items-start gap-2.5 rounded-[10px] bg-[#F5F6F8] px-3 py-2.5">
                        <span className="grid size-6 shrink-0 place-items-center rounded-full bg-[#EEEAF8] text-[#6546A9]">
                            <MessageCircleMore aria-hidden className="size-4" />
                        </span>
                        <div className="min-w-0 flex-1 pt-0.5">
                            <p className="font-medium [overflow-wrap:anywhere] break-keep text-[#344054]">{label}</p>
                            <ul className="mt-2 flex flex-wrap gap-x-2 gap-y-1.5">
                                {Array.from(rows, ([key, {status, measurement, count}]) => {
                                    const {Icon, colors} = statusAppearance[status] ?? statusAppearance.UNVERIFIED;

                                    return (
                                        <li key={key} className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                                            <span
                                                className={`inline-flex min-w-0 items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-medium ${colors}`}
                                            >
                                                <Icon aria-hidden className="size-3.5 shrink-0" />
                                                <span className="min-w-0 [overflow-wrap:anywhere] break-keep">
                                                    {t(`aiConversationSidebar.authoring.clause.${status}`)}
                                                    {(rows.size > 1 || count > 1) && (
                                                        <>
                                                            {' '}
                                                            <span className="tabular-nums">
                                                                {t('aiConversationSidebar.authoring.clauseCount', {count})}
                                                            </span>
                                                        </>
                                                    )}
                                                </span>
                                            </span>
                                            {measurement && (
                                                <span className="text-xs font-medium text-[#475467] tabular-nums">{measurement}</span>
                                            )}
                                        </li>
                                    );
                                })}
                            </ul>
                        </div>
                    </li>
                ))}
            </ul>
            {showChangedSummary && changes.length > 0 && (
                <p className="text-xs text-[#596579]">
                    {t('aiAdjust.evidence.changedSummary', {
                        people: new Set(changes.map((cell) => cell.shiftNurseId)).size,
                        count: changes.length,
                    })}
                </p>
            )}
        </section>
    );
}
