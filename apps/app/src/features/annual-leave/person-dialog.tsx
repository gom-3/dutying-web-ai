import type {TAnnualLeaveCommand, TAnnualLeaveHistoryItem, TAnnualLeavePerson, TAnnualLeaveSettings} from '@dutying/api/ward';
import {useInfiniteQuery} from '@tanstack/react-query';
import {useState, type FormEvent} from 'react';
import {WardAPI} from '@/shared/api';
import {useTypedTranslation} from '@/shared/hook/use-typed-translation';
import {showActionErrorFeedback} from '@/shared/util/feedback';
import {AnnualLeaveBalanceControl} from './balance-control';
import {AnnualLeaveHistoryEntry} from './history-entry';
import {groupAnnualLeaveHistory} from './history-model';
import {AnnualLeaveHistoryMonth} from './history-month';
import {annualLeaveDate} from './model';
import {annualLeaveKey, useRefreshAnnualLeave} from './queries';
import {
    AnnualLeaveDialog,
    AnnualLeaveField,
    annualButtonClass,
    annualInputClass,
    annualSecondaryClass,
    useAnnualLeaveRequestId,
} from './ui';

type TAction = 'INITIALIZE' | Extract<TAnnualLeaveCommand['kind'], 'SET_BALANCE' | 'REVERT'>;
export type TAnnualLeavePersonView = 'edit' | 'history';

export function AnnualLeavePersonDialog({
    wardId,
    person,
    settings,
    initialView = 'edit',
    onClose,
}: {
    wardId: number;
    person: TAnnualLeavePerson;
    settings: TAnnualLeaveSettings;
    initialView?: TAnnualLeavePersonView;
    onClose: () => void;
}) {
    const {t} = useTypedTranslation();
    const today = annualLeaveDate();
    const needsOpening = person.openingDays == null || person.checks.includes('RESTART_REQUIRED');
    const [view, setView] = useState<TAnnualLeavePersonView>(settings.enabled ? initialView : 'history');
    const [action, setAction] = useState<TAction>(needsOpening ? 'INITIALIZE' : 'SET_BALANCE');
    const [quantity, setQuantity] = useState(needsOpening || person.currentDays == null ? '' : String(person.currentDays));
    const [revertDate, setRevertDate] = useState(today);
    const [previousUsed, setPreviousUsed] = useState('');
    const [reason, setReason] = useState('');
    const [busy, setBusy] = useState(false);
    const [revertId, setRevertId] = useState<number | undefined>();
    const matchingBalance = action === 'SET_BALANCE';
    const balanceDays =
        matchingBalance && quantity.trim() !== '' && Number.isFinite(Number(quantity)) && Math.abs(Number(quantity)) <= 99999
            ? Number(quantity)
            : null;
    const balanceChanged = balanceDays !== null && balanceDays !== person.currentDays;
    const visibleChecks = person.checks.filter((check) => !['VALIDITY_UNKNOWN', 'REVIEW_REQUIRED'].includes(check));
    const refresh = useRefreshAnnualLeave(wardId);
    const requestId = useAnnualLeaveRequestId();
    const history = useInfiniteQuery({
        queryKey: [...annualLeaveKey(wardId), 'history', person.nurseId],
        queryFn: ({pageParam}) => WardAPI.getAnnualLeaveHistory(wardId, person.nurseId, pageParam),
        initialPageParam: undefined as number | undefined,
        getNextPageParam: (page) => page.nextCursor ?? undefined,
        retry: false,
        enabled: view === 'history',
    });
    const entries = history.data?.pages.flatMap((page) => page.entries) ?? [];
    const historyGroups = groupAnnualLeaveHistory(entries);
    const revertEntry = entries.find((entry) => entry.id === revertId);
    const save = async (event: FormEvent) => {
        event.preventDefault();

        if (busy || (matchingBalance && !balanceChanged)) return;

        setBusy(true);

        try {
            if (action === 'INITIALIZE') {
                const entries = [
                    {
                        nurseId: person.nurseId,
                        version: person.version,
                        startedOn: annualLeaveDate(),
                        remainingDays: quantity.trim() === '' ? null : Number(quantity),
                        balanceBasis: 'TODAY_INCLUDED' as const,
                        previousUsedDays: previousUsed.trim() === '' ? null : Number(previousUsed),
                        includedPlannedDates: [],
                        reviewOn: null,
                        reason: reason.trim() || t('annualLeave.registerSingle'),
                    },
                ];

                await WardAPI.initializeAnnualLeave(wardId, {requestId: requestId(entries), entries});
            } else {
                const savedOn = annualLeaveDate();
                const payload = {
                    version: person.version,
                    kind: action,
                    effectiveOn: matchingBalance ? savedOn : revertDate,
                    days: action === 'REVERT' ? 0 : Number(quantity),
                    reason: matchingBalance ? reason.trim() || t('annualLeave.historyKinds.SET_BALANCE') : reason,
                    entryId: revertId,
                    reviewOn: null,
                };

                await WardAPI.changeAnnualLeave(wardId, person.nurseId, {...payload, requestId: requestId(payload)});
            }

            await refresh();
            onClose();
        } catch (error) {
            showActionErrorFeedback(error, t('annualLeave.saveError'));
            await refresh();
        } finally {
            setBusy(false);
        }
    };
    const renderEntry = (entry: TAnnualLeaveHistoryItem) => (
        <AnnualLeaveHistoryEntry
            key={entry.id}
            entry={entry}
            today={today}
            onUndo={
                settings.enabled &&
                !busy &&
                !entry.voided &&
                ['GRANT', 'SETTLEMENT', 'CORRECTION', 'SET_BALANCE', 'DAY_USAGE'].includes(entry.kind)
                    ? () => {
                          setAction('REVERT');
                          setRevertId(entry.id);
                          setRevertDate(entry.effectiveOn);
                          setReason('');
                          setView('edit');
                      }
                    : undefined
            }
        />
    );

    return (
        <AnnualLeaveDialog
            title={`${person.name} · ${t(view === 'history' ? 'annualLeave.history' : action === 'REVERT' ? 'annualLeave.undo' : 'annualLeave.edit')}`}
            onClose={onClose}
            busy={busy}
            scrollKey={view}
        >
            {!settings.enabled && <p className="mb-4 text-sm text-gray-3">{t('annualLeave.paused')}</p>}
            {view === 'edit' && action === 'INITIALIZE' && (
                <p className="mb-4 text-sm leading-5 break-keep text-gray-3">{t('annualLeave.registerSingleHint')}</p>
            )}
            <div className="mb-4 grid grid-cols-2 gap-3 rounded-xl bg-gray-7 p-4 text-sm">
                <div>
                    {t('annualLeave.current')}
                    <strong role="status" aria-atomic="true" className="mt-1 block text-lg tabular-nums">
                        {person.currentDays == null ? t('annualLeave.notEntered') : t('annualLeave.days', {count: person.currentDays})}
                        {view === 'edit' && matchingBalance && balanceChanged && (
                            <span className="whitespace-nowrap text-main-1">
                                {' → '}
                                {t('annualLeave.days', {count: balanceDays})}
                            </span>
                        )}
                    </strong>
                </div>
                <div>
                    {t('annualLeave.planned')}
                    <strong className="mt-1 block text-lg">{t('annualLeave.days', {count: person.plannedDays})}</strong>
                </div>
            </div>
            {view === 'edit' && action !== 'REVERT' && visibleChecks.length > 0 && (
                <section className="mb-4 rounded-xl bg-amber-50 px-4 py-3" aria-labelledby="annual-leave-calculation-notice">
                    <div className="flex items-center gap-2">
                        <span
                            aria-hidden="true"
                            className="inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-amber-200 text-sm font-bold text-amber-900"
                        >
                            !
                        </span>
                        <h3 id="annual-leave-calculation-notice" className="text-sm leading-5 font-semibold text-amber-900">
                            {t('annualLeave.calculationInfo')}
                        </h3>
                    </div>
                    <div className="mt-1 space-y-1 pl-7 text-sm leading-5 text-pretty [overflow-wrap:anywhere] break-keep text-amber-800">
                        {visibleChecks.includes('MISSING_SCHEDULE') && (
                            <div>
                                <p>{t('annualLeave.missingScheduleNotice')}</p>
                                {settings.enabled && !needsOpening && !matchingBalance && (
                                    <p className="mt-0.5">{t('annualLeave.missingScheduleAction')}</p>
                                )}
                            </div>
                        )}
                        {visibleChecks
                            .filter((check) => check !== 'MISSING_SCHEDULE')
                            .map((check) => (
                                <p key={check}>{t(`annualLeave.checks.${check}`)}</p>
                            ))}
                    </div>
                </section>
            )}
            {view === 'edit' && settings.enabled && (
                <form onSubmit={(event) => void save(event)} className="flex flex-col gap-4">
                    {action === 'REVERT' && revertEntry && (
                        <section aria-label={t('annualLeave.undoTarget')} className="rounded-xl bg-gray-7 px-4 py-3">
                            <div className="flex items-center justify-between gap-3 text-xs text-gray-3">
                                <span>{t('annualLeave.undoTarget')}</span>
                                <time dateTime={revertEntry.effectiveOn} className="tabular-nums">
                                    {revertEntry.effectiveOn.replace(/-/g, '.')}
                                </time>
                            </div>
                            <div className="mt-2 flex items-baseline justify-between gap-3">
                                <span className="text-sm font-semibold text-sub-1">{t(`annualLeave.${revertEntry.kind}`)}</span>
                                <strong className="text-lg text-sub-1 tabular-nums">
                                    {revertEntry.days > 0 ? '+' : ''}
                                    {t('annualLeave.days', {count: revertEntry.days})}
                                </strong>
                            </div>
                            {revertEntry.reason &&
                                revertEntry.reason !== t(`annualLeave.historyKinds.${revertEntry.kind}`) &&
                                revertEntry.reason !== t(`annualLeave.${revertEntry.kind}`) && (
                                    <p className="mt-2 text-sm leading-5 [overflow-wrap:anywhere] break-keep text-sub-2">
                                        {revertEntry.reason}
                                    </p>
                                )}
                        </section>
                    )}
                    {action === 'INITIALIZE' && <p className="text-xs text-sub-2">{t('annualLeave.todayBasis', {date: today})}</p>}
                    {matchingBalance ? (
                        <AnnualLeaveBalanceControl
                            value={quantity}
                            currentDays={person.currentDays}
                            onChange={setQuantity}
                            disabled={busy}
                        />
                    ) : (
                        action !== 'REVERT' && (
                            <AnnualLeaveField label={t('annualLeave.current')}>
                                <input
                                    type="number"
                                    step="0.001"
                                    min={-99999}
                                    max={99999}
                                    required={action === 'INITIALIZE'}
                                    value={quantity}
                                    onChange={(e) => setQuantity(e.target.value)}
                                    className={annualInputClass}
                                />
                            </AnnualLeaveField>
                        )
                    )}
                    {action === 'INITIALIZE' && (
                        <AnnualLeaveField label={t('annualLeave.previousUsed')} hint={t('annualLeave.previousUsedHint')}>
                            <input
                                type="number"
                                min="0"
                                max="99999"
                                step="0.001"
                                aria-label={t('annualLeave.previousUsed')}
                                value={previousUsed}
                                onChange={(e) => setPreviousUsed(e.target.value)}
                                className={`${annualInputClass} [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none`}
                            />
                        </AnnualLeaveField>
                    )}
                    <AnnualLeaveField
                        label={t(
                            action === 'REVERT'
                                ? 'annualLeave.undoReason'
                                : matchingBalance
                                  ? 'annualLeave.balanceReason'
                                  : 'annualLeave.reason',
                        )}
                    >
                        <textarea
                            required={action === 'REVERT'}
                            maxLength={500}
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            className={annualInputClass}
                        />
                    </AnnualLeaveField>
                    {action === 'REVERT' && <p className="text-xs text-gray-3">{t('annualLeave.undoHint')}</p>}
                    <div className="flex items-center justify-end gap-2">
                        {action === 'REVERT' && (
                            <button
                                type="button"
                                onClick={() => {
                                    setAction(needsOpening ? 'INITIALIZE' : 'SET_BALANCE');
                                    setQuantity(needsOpening || person.currentDays == null ? '' : String(person.currentDays));
                                    setRevertId(undefined);
                                    setView('history');
                                }}
                                className={`${annualSecondaryClass} min-h-11 hover:bg-gray-6 focus-visible:bg-gray-6 focus-visible:text-sub-1 focus-visible:outline-none`}
                            >
                                {t('annualLeave.backToHistory')}
                            </button>
                        )}
                        <button
                            type="submit"
                            disabled={busy || (matchingBalance && !balanceChanged)}
                            className={`${annualButtonClass} self-end`}
                        >
                            {busy
                                ? t('annualLeave.saving')
                                : matchingBalance
                                  ? balanceDays === null
                                      ? t('annualLeave.SET_BALANCE')
                                      : t('annualLeave.balanceSave', {days: t('annualLeave.days', {count: balanceDays})})
                                  : t(action === 'REVERT' ? 'annualLeave.undo' : 'annualLeave.saveChanges')}
                        </button>
                    </div>
                </form>
            )}
            {view === 'history' && (
                <section aria-label={t('annualLeave.history')}>
                    {history.isPending && <p>{t('annualLeave.loading')}</p>}
                    {history.isError && (
                        <button className={annualSecondaryClass} onClick={() => void history.refetch()}>
                            {t('annualLeave.retry')}
                        </button>
                    )}
                    {history.data && historyGroups.length === 0 && (
                        <p className="text-sm text-gray-3">
                            {t(entries.length ? 'annualLeave.noMeaningfulHistory' : 'annualLeave.noHistory')}
                        </p>
                    )}
                    <ul className="flex flex-col gap-2">
                        {historyGroups.map((group) =>
                            group.kind === 'entry' ? (
                                renderEntry(group.entry)
                            ) : (
                                <AnnualLeaveHistoryMonth
                                    key={group.month}
                                    wardId={wardId}
                                    person={person}
                                    settings={settings}
                                    month={group.month}
                                    entries={group.entries}
                                    today={today}
                                />
                            ),
                        )}
                    </ul>
                    {history.hasNextPage && (
                        <button
                            className={`${annualSecondaryClass} mt-3`}
                            disabled={history.isFetchingNextPage}
                            onClick={() => void history.fetchNextPage()}
                        >
                            {t('annualLeave.more')}
                        </button>
                    )}
                </section>
            )}
        </AnnualLeaveDialog>
    );
}
