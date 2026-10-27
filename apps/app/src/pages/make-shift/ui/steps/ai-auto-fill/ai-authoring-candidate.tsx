import type {TAutofillResponse, TSnapshotCellDTO} from '@dutying/api/ward';
import {useEffect, useState} from 'react';
import {localizeScheduleValidationMessage} from '@/features/shift-editor/model/schedule-violations/format-validation-message';
import {useTypedTranslation} from '@/shared/hook/use-typed-translation';
import {authoringOutcome, canSelectAuthoringCandidate} from '../../../model/intent-first-authoring';

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
}: {
    result: TAutofillResponse;
    sourceVersionId: string;
    baseline: TSnapshotCellDTO[];
    nurseName: (id: number) => string;
    current: boolean;
    disabled: boolean;
    onApply: () => void;
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

    const available = current && canSelectAuthoringCandidate(result, sourceVersionId, now);
    const expired = !current || !Number.isFinite(Date.parse(candidate.expiresAt)) || Date.parse(candidate.expiresAt) <= now;
    const before = new Map(baseline.map((cell) => [`${cell.shiftNurseId}:${cell.date}`, cell]));

    return (
        <section className="mt-3 space-y-3 rounded-xl bg-white p-3 text-sm" aria-label={t('aiConversationSidebar.authoring.changes')}>
            {authoringOutcome(result)?.validation.coverage === 'PARTIAL' && (
                <p role="status">{t('aiConversationSidebar.authoring.partialCoverage')}</p>
            )}
            {(candidate.selectionReason === 'QUALITATIVE_REVIEW' ||
                result.authoringOutcome?.clauses.some((clause) => clause.kind === 'REVIEW')) && (
                <p>{t('aiConversationSidebar.authoring.qualitative')}</p>
            )}
            <div className="max-h-64 overflow-auto rounded-lg border border-gray-200">
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
                                <td className="p-2">{before.get(`${cell.shiftNurseId}:${cell.date}`)?.shiftCode ?? '—'}</td>
                                <td className="p-2 font-semibold">{cell.shiftCode ?? '—'}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            {candidate.violations.length > 0 && (
                <div>
                    <p className="font-medium">{t('aiConversationSidebar.authoring.warnings')}</p>
                    <ul className="list-disc space-y-1 pl-4">
                        {candidate.violations.map((issue, index) => (
                            <li key={`${issue.violationId}:${index}`}>
                                {localizeScheduleValidationMessage(issue)}
                                {issue.affectedCells?.length > 0 && (
                                    <span>
                                        {' '}
                                        ·{' '}
                                        {issue.affectedCells
                                            .map((cell) => `${nurseName(cell.shiftNurseId)} ${cell.date} ${cell.shiftCode ?? ''}`)
                                            .join(', ')}
                                    </span>
                                )}
                            </li>
                        ))}
                    </ul>
                </div>
            )}
            {!available && (
                <p role="status">
                    {t(expired ? 'aiConversationSidebar.authoring.expired' : 'aiConversationSidebar.authoring.candidateUnavailable')}
                </p>
            )}
            {kept ? (
                <p role="status">{t('aiConversationSidebar.authoring.keep')}</p>
            ) : (
                <div className="flex flex-wrap gap-2">
                    <button type="button" className={`${action} bg-main-1 text-white`} disabled={disabled || !available} onClick={onApply}>
                        {t('aiConversationSidebar.authoring.apply')}
                    </button>
                    <button type="button" className={`${action} text-main-1`} disabled={disabled} onClick={() => setKept(true)}>
                        {t('aiConversationSidebar.authoring.keep')}
                    </button>
                </div>
            )}
        </section>
    );
}
