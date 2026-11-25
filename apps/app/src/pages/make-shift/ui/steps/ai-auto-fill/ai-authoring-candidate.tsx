import type {TAutofillResponse, TSnapshotCellDTO} from '@dutying/api/ward';
import {useEffect, useState} from 'react';
import {useTypedTranslation} from '@/shared/hook/use-typed-translation';
import {nightRunConflictMessages} from '../../../model/ai-execution-failure';
import {authoringOutcome, canSelectAuthoringCandidate} from '../../../model/intent-first-authoring';
import {AiScheduleWarningList} from './ai-schedule-warning-list';

const action =
    'min-h-11 rounded-lg px-4 py-3 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-main-1 disabled:opacity-40';

/** Candidate cells stay in this review table; only a server application receipt changes the roster. */
export function AiAuthoringCandidate({
    result,
    sourceVersionId,
    baseline,
    nurseName,
    current,
    disabled,
    onApply,
    onKeep,
}: {
    result: TAutofillResponse;
    sourceVersionId: string;
    baseline: TSnapshotCellDTO[];
    nurseName: (id: number) => string;
    current: boolean;
    disabled: boolean;
    onApply: () => void;
    onKeep?: () => void;
}) {
    const {t} = useTypedTranslation();
    const candidate = result.candidate;
    const [kept, setKept] = useState(false);
    const [now, setNow] = useState(Date.now);

    useEffect(() => {
        const expires = Date.parse(candidate?.expiresAt ?? '');

        if (!Number.isFinite(expires)) return;

        const timer = window.setTimeout(() => setNow(Date.now()), Math.min(2147483647, Math.max(0, expires - Date.now() + 1)));

        return () => window.clearTimeout(timer);
    }, [candidate?.expiresAt]);

    if (!candidate) return null;

    const conflictMessages = nightRunConflictMessages(result);
    const priority = authoringOutcome(result)?.requestPriority;
    const settingsConsent = priority?.version === 'request-first-v2' && priority.settingChangesRequired === true;
    const advisory = candidate.selectionReason === 'INTERPRETATION_RECOVERY_UNVERIFIED';
    const available = current && canSelectAuthoringCandidate(result, sourceVersionId, now);
    const expired = !current || !Number.isFinite(Date.parse(candidate.expiresAt)) || Date.parse(candidate.expiresAt) <= now;
    const impacts = priority?.candidateImpacts ?? [];
    const displayNames = priority?.shiftDisplayNames ?? {};
    const before = new Map(baseline.map((cell) => [`${cell.shiftNurseId}:${cell.date}`, cell]));

    return (
        <section className="mt-3 space-y-3 rounded-xl bg-white p-3 text-sm" aria-label={t('aiConversationSidebar.authoring.changes')}>
            {authoringOutcome(result)?.validation.coverage === 'PARTIAL' && (
                <p role="status">{t('aiConversationSidebar.authoring.partialCoverage')}</p>
            )}
            {advisory ? (
                <p role="status">{t('aiConversationSidebar.authoring.recoveryPreviewOnly')}</p>
            ) : (
                (candidate.selectionReason === 'QUALITATIVE_REVIEW' ||
                    result.authoringOutcome?.clauses.some((clause) => clause.kind === 'REVIEW')) && (
                    <p>{t('aiConversationSidebar.authoring.qualitative')}</p>
                )
            )}
            {settingsConsent && (
                <div className="space-y-2" role="status">
                    <p className="font-semibold">{t('aiConversationSidebar.authoring.settingChangesTitle')}</p>
                    <p>{t('aiConversationSidebar.authoring.settingChangesScope')}</p>
                    <ul className="list-disc space-y-2 pl-4">
                        {(priority?.availabilityChanges ?? []).map((change) => (
                            <li key={`allowed:${change.shiftNurseId}:${change.wardShiftTypeId}`}>
                                {change.userMessage ??
                                    t('aiConversationSidebar.authoring.settingAvailability', {
                                        name: nurseName(Number(change.shiftNurseId)),
                                        code: change.shiftDisplayName ?? change.code,
                                    })}
                                {' · '}
                                {t('aiConversationSidebar.authoring.settingMonth', {year: change.year, month: change.month})}
                            </li>
                        ))}
                        {(priority?.settingChanges ?? []).map((change, index) => (
                            <li key={`setting:${change.ruleId ?? index}:${index}`}>
                                {change.userMessage ??
                                    (typeof change.currentValue === 'number' && typeof change.proposedValue === 'number'
                                        ? t('aiConversationSidebar.authoring.settingValues', {
                                              name:
                                                  (change.subjectScope ?? []).map(nurseName).join(', ') ||
                                                  t('aiConversationSidebar.authoring.warnings'),
                                              before: change.currentValue,
                                              after: change.proposedValue,
                                          })
                                        : t('aiConversationSidebar.authoring.warnings'))}
                                {' · '}
                                {t('aiConversationSidebar.authoring.settingMonth', {year: change.year, month: change.month})}
                            </li>
                        ))}
                    </ul>
                </div>
            )}
            <section className="space-y-2" aria-label={t('aiConversationSidebar.authoring.additionalImpacts')}>
                {impacts.length > 0 ? (
                    <>
                        <h4 className="font-semibold">{t('aiConversationSidebar.authoring.additionalImpacts')}</h4>
                        <ul className="space-y-2">
                            {impacts.slice(0, 3).map((impact, index) => (
                                <li key={index} className="leading-6">
                                    {impact.message}
                                </li>
                            ))}
                        </ul>
                        {(impacts.length > 3 || priority?.comparisonScope) && (
                            <details className="text-xs text-sub-2">
                                <summary className="cursor-pointer py-2 font-medium">
                                    {t('aiConversationSidebar.authoring.impactDetails')}
                                </summary>
                                {impacts.length > 3 && (
                                    <ul className="space-y-2 py-2">
                                        {impacts.slice(3).map((impact, index) => (
                                            <li key={index} className="leading-6">
                                                {impact.message}
                                            </li>
                                        ))}
                                    </ul>
                                )}
                                {priority?.comparisonScope && <p className="leading-6">{priority.comparisonScope}</p>}
                            </details>
                        )}
                    </>
                ) : (
                    priority?.candidateImpactsAvailable !== true && (
                        <p className="text-sub-2">{t('aiConversationSidebar.authoring.impactsUnavailable')}</p>
                    )
                )}
            </section>
            <details className="rounded-lg border border-gray-200" open={!priority?.requestedAssignments?.length}>
                <summary className="cursor-pointer px-3 py-2 font-medium">
                    {t('aiConversationSidebar.authoring.changeDetails', {count: candidate.changedCells.length})}
                </summary>
                <div className="max-h-64 overflow-auto">
                    <table className="w-full text-left text-xs">
                        <caption className="sr-only">{t('aiConversationSidebar.authoring.changes')}</caption>
                        <thead>
                            <tr>
                                {(['nurse', 'date', 'before', 'after'] as const).map((key) => (
                                    <th key={key} scope="col" className="p-2">
                                        {t(`aiConversationSidebar.authoring.${key}`)}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {candidate.changedCells.map((cell) => (
                                <tr key={`${cell.shiftNurseId}:${cell.date}`} className="border-t border-gray-100">
                                    <th scope="row" className="p-2 font-medium">
                                        {nurseName(cell.shiftNurseId)}
                                    </th>
                                    <td className="p-2 whitespace-nowrap">{cell.date}</td>
                                    <td className="p-2">
                                        {displayNames[String(before.get(`${cell.shiftNurseId}:${cell.date}`)?.wardShiftTypeId)] ??
                                            before.get(`${cell.shiftNurseId}:${cell.date}`)?.shiftCode ??
                                            '—'}
                                    </td>
                                    <td className="p-2 font-semibold">
                                        {displayNames[String(cell.wardShiftTypeId)] ?? cell.shiftCode ?? '—'}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </details>
            {(conflictMessages.length > 0 || candidate.violations.length > 0) && (
                <details open={!priority?.candidateImpactsAvailable}>
                    <summary className="cursor-pointer py-2 font-medium">{t('aiConversationSidebar.authoring.ruleDetails')}</summary>
                    <AiScheduleWarningList violations={candidate.violations} nurseName={nurseName} messages={conflictMessages} />
                </details>
            )}
            {!available && !advisory && (
                <p role="status">
                    {t(expired ? 'aiConversationSidebar.authoring.expired' : 'aiConversationSidebar.authoring.candidateUnavailable')}
                </p>
            )}
            {!advisory &&
                (kept ? (
                    <p role="status">{t('aiConversationSidebar.authoring.keep')}</p>
                ) : (
                    <div className="flex flex-wrap gap-2">
                        <button
                            type="button"
                            className={`${action} bg-main-1 text-white`}
                            disabled={disabled || !available}
                            onClick={onApply}
                        >
                            {t(
                                settingsConsent
                                    ? 'aiConversationSidebar.authoring.settingConsentApply'
                                    : 'aiConversationSidebar.authoring.apply',
                            )}
                        </button>
                        <button
                            type="button"
                            className={`${action} text-main-1`}
                            disabled={disabled}
                            onClick={() => {
                                setKept(true);
                                onKeep?.();
                            }}
                        >
                            {t('aiConversationSidebar.authoring.keep')}
                        </button>
                    </div>
                ))}
        </section>
    );
}
