import type {TAutofillResponse, TFailureSuggestion, TQualityMeasurement} from '@dutying/api/ward';
import {useTypedTranslation} from '@/shared/hook/use-typed-translation';
import {isFailureSuggestionAvailable} from '../../../model/conversation-suggestion';
export type {TFailureSuggestion} from '@dutying/api/ward';

const metricUnits: Record<string, string> = {
    offTargetDeviation: 'days',
    nightDeviation: 'shifts',
    fragmentationRate: 'ratio',
    minimumRecoveryHours: 'hours',
    preferenceSatisfactionRate: 'ratio',
    changedCells: 'cells',
};
const reasons = new Set([
    'BASELINE_INCOMPLETE',
    'BASELINE_CONTEXT_UNAVAILABLE',
    'CANDIDATE_UNAVAILABLE',
    'CANDIDATE_CONTEXT_UNAVAILABLE',
    'OFF_TARGET_UNAVAILABLE',
    'NO_COMPARABLE_NIGHT_GROUP',
    'NO_FRAGMENTATION_OPPORTUNITIES',
    'RECOVERY_TIMES_OR_TRANSITIONS_UNAVAILABLE',
    'NO_VALID_PREFERENCE_REQUESTS',
    'RULE_VALIDATION_INCOMPLETE',
    'NEXT_MONTH_RECOVERY_UNKNOWN',
    'PRIOR_MONTH_RECOVERY_UNKNOWN',
    'BASELINE_HARD_VIOLATIONS',
]);

export function ConversationEvidence({
    result,
    nurseName,
    suggestionsCurrent,
    disabled,
    onSelect,
}: {
    result: TAutofillResponse;
    nurseName: (id: string) => string;
    suggestionsCurrent: boolean;
    disabled: boolean;
    onSelect: (suggestion: TFailureSuggestion) => void;
}) {
    const {t} = useTypedTranslation();
    const quality = result.engineResult?.qualitySidebar;
    const suggestions = result.failure?.suggestions ?? [];
    const label = (id: string) => t(`aiAdjust.evidence.${metricUnits[id] ? `metrics.${id}` : 'metricUnknown'}`);
    const number = (id: string, value: number | null, difference = false) => {
        const unit = metricUnits[id];

        if (value === null || !Number.isFinite(value) || !unit) return t('aiAdjust.evidence.notMeasured');

        return t(`aiAdjust.evidence.units.${unit === 'ratio' && difference ? 'ratioDifference' : unit}`, {
            value: Math.round(value * (unit === 'ratio' ? 100 : 1) * 1000) / 1000,
        });
    };
    const measurement = (id: string, value: TQualityMeasurement) =>
        value.state === 'KNOWN' ? number(id, value.value) : t('aiAdjust.evidence.notMeasured');

    return (
        <>
            {quality?.contractVersion === 'quality-sidebar-v1' && (
                <details className="mt-2 rounded border p-2 break-keep">
                    <summary>
                        {t('aiAdjust.evidence.title')} ·{' '}
                        {t(
                            `aiAdjust.evidence.states.${['KNOWN', 'PARTIAL', 'UNKNOWN', 'BLOCKED'].includes(quality.comparisonState) ? quality.comparisonState : 'UNKNOWN'}`,
                        )}
                    </summary>
                    <p>
                        {t(
                            `aiAdjust.evidence.relations.${['CANDIDATE_BETTER', 'BASELINE_BETTER', 'TRADEOFF', 'TIE'].includes(quality.observedRelation) ? quality.observedRelation : 'UNKNOWN'}`,
                        )}
                    </p>
                    {quality.harm.map((h) => (
                        <div key={h.metricId} className="mt-2">
                            <p className="font-semibold">{label(h.metricId)}</p>
                            <p>
                                {t('aiAdjust.evidence.summary', {
                                    count: h.comparableNurseCount,
                                    worse: h.worsenedNurseCount,
                                    unknown: h.unknownNurseIds.length,
                                })}
                            </p>
                            {h.worsenedNurseCount > 0 && (
                                <p>{t('aiAdjust.evidence.maximum', {value: number(h.metricId, h.maxWorsening, true)})}</p>
                            )}
                        </div>
                    ))}
                    <p className="mt-2 text-xs">{t('aiAdjust.evidence.note')}</p>
                    <details className="mt-2">
                        <summary>{t('aiAdjust.evidence.people')}</summary>
                        {quality.byNurse.map((n) => (
                            <div key={n.shiftNurseId} className="mt-2">
                                <p className="font-semibold">{nurseName(n.shiftNurseId)}</p>
                                {n.metrics.map((m) => (
                                    <p key={m.metricId}>
                                        {label(m.metricId)}: {measurement(m.metricId, m.before)} → {measurement(m.metricId, m.after)} ·{' '}
                                        {t(
                                            `aiAdjust.evidence.change.${['IMPROVED', 'WORSENED', 'UNCHANGED'].includes(m.change) ? m.change : 'UNKNOWN'}`,
                                        )}
                                    </p>
                                ))}
                            </div>
                        ))}
                    </details>
                    {[...new Set(quality.unknownReasons.map((reason) => (reasons.has(reason) ? reason : 'UNKNOWN')))].map((reason) => (
                        <p key={reason} className="mt-1 text-xs">
                            {t(`aiAdjust.evidence.reasons.${reason}`)}
                        </p>
                    ))}
                </details>
            )}
            {suggestions.map((s) => {
                const expiresAt = Date.parse(s.expiresAt);
                const expired = !suggestionsCurrent || !Number.isFinite(expiresAt) || expiresAt <= Date.now();

                return (
                    <div key={s.suggestionId} className="mt-2 rounded border p-2 break-keep">
                        <ConversationSuggestionChanges suggestion={s} />
                        <p>
                            {typeof s.impact?.affectedNurseCount === 'number'
                                ? t('aiAdjust.evidence.changes', {count: s.impact.affectedNurseCount})
                                : t('aiAdjust.evidence.changesUnknown')}
                        </p>
                        {s.impact?.individualDeterioration ? (
                            Object.entries(s.impact.individualDeterioration)
                                .filter(([, h]) => h.total > 0)
                                .map(([id, h]) => (
                                    <p key={id}>
                                        {t('aiAdjust.evidence.individual', {
                                            name: nurseName(id),
                                            off: h.offDaysLost,
                                            night: h.nightDaysAdded,
                                            requests: h.newUnmetPreferences,
                                        })}
                                    </p>
                                ))
                        ) : (
                            <p>{t('aiAdjust.evidence.impactUnknown')}</p>
                        )}
                        <p className="text-xs">
                            {t(`aiAdjust.evidence.${s.verificationStatus === 'VERIFIED_FEASIBLE' ? 'verified' : 'unverified'}`)}
                        </p>
                        <button
                            className="mt-1 rounded border px-2 py-1"
                            disabled={disabled || expired || !isFailureSuggestionAvailable(s)}
                            onClick={() => onSelect(s)}
                        >
                            {t('aiAdjust.evidence.select')}
                        </button>
                        {expired && <p>{t('aiAdjust.evidence.expired')}</p>}
                    </div>
                );
            })}
        </>
    );
}

/** Share the same concrete change description in the suggestion and its confirmation. */
export function ConversationSuggestionChanges({suggestion}: {suggestion: TFailureSuggestion}) {
    const {t} = useTypedTranslation();

    return (
        <>
            {suggestion.changes.map((change, index) => {
                let message: string;

                if (change.kind === 'NUMERIC_GOAL' && typeof change.oldValue === 'number' && typeof change.proposedValue === 'number') {
                    message = t('aiAdjust.evidence.numericGoal', {before: change.oldValue, after: change.proposedValue});
                } else if (change.kind === 'REQUEST_REMOVE') {
                    message = t('aiAdjust.evidence.removeRequest');
                } else if (change.kind === 'REQUEST_PRIORITY' && change.oldValue === 'NORMAL' && change.proposedValue === 'LOW') {
                    message = t('aiAdjust.evidence.lowerPriority');
                } else {
                    message = t('aiAdjust.evidence.proposal');
                }

                return <p key={index}>{message}</p>;
            })}
        </>
    );
}
