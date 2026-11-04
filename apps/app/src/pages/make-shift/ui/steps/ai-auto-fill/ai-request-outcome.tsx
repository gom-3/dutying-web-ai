import type {TAutofillResponse} from '@dutying/api/ward';
import {useTypedTranslation} from '@/shared/hook/use-typed-translation';
import {authoringOutcome} from '../../../model/intent-first-authoring';

/** Explain verified observations; never turn a REVIEW into a success claim. */
export function AiRequestOutcome({result}: {result: TAutofillResponse}) {
    const {t} = useTypedTranslation();
    const outcome = authoringOutcome(result);

    if (outcome?.validation.spring !== 'VERIFIED') return null;

    const clauses = outcome.clauses.filter((clause) => clause.displayText?.trim());
    const changes = result.candidate?.changedCells ?? result.changedCells;

    if (!clauses.length) return null;

    return (
        <section className="mt-3 space-y-2 text-[13px] leading-6" aria-label={t('aiConversationSidebar.authoring.requestResults')}>
            <p className="font-medium">{t('aiConversationSidebar.authoring.requestResults')}</p>
            <ul className="space-y-2">
                {clauses.map((clause) => (
                    <li key={clause.clauseId}>
                        <p className="break-words">{clause.displayText}</p>
                        <p>
                            {t(`aiConversationSidebar.authoring.clause.${clause.status}`)}
                            {clause.kind === 'DIRECTIONAL' &&
                                clause.status !== 'UNVERIFIED' &&
                                ['SHIFT_COUNT', 'PATTERN_COUNT', 'MINIMIZE_SINGLE_OFF_RUNS', 'MINIMIZE_SINGLE_NIGHT_RUNS'].includes(
                                    clause.metricKey ?? '',
                                ) &&
                                typeof clause.before === 'number' &&
                                Number.isFinite(clause.before) &&
                                typeof clause.after === 'number' &&
                                Number.isFinite(clause.after) && (
                                    <span className="ml-2">
                                        {t('aiConversationSidebar.authoring.measuredCount', {before: clause.before, after: clause.after})}
                                    </span>
                                )}
                        </p>
                    </li>
                ))}
            </ul>
            {changes.length > 0 && (
                <p>
                    {t('aiAdjust.evidence.changedSummary', {
                        people: new Set(changes.map((cell) => cell.shiftNurseId)).size,
                        count: changes.length,
                    })}
                </p>
            )}
        </section>
    );
}
