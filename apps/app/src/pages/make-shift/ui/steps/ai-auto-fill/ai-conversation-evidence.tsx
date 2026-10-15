import type {TAutofillResponse, TFailureSuggestion} from '@dutying/api/ward';
import {useTypedTranslation} from '@/shared/hook/use-typed-translation';
import {isFailureSuggestionAvailable} from '../../../model/conversation-suggestion';
export type {TFailureSuggestion} from '@dutying/api/ward';

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
    const suggestions = result.failure?.suggestions ?? [];

    return (
        <>
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
