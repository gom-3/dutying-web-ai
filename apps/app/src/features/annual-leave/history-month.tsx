import type {TAnnualLeaveHistoryItem, TAnnualLeavePerson, TAnnualLeaveSettings} from '@dutying/api/ward';
import {useId, useState} from 'react';
import {useTypedTranslation} from '@/shared/hook/use-typed-translation';
import {annualLeaveMonthUsage, annualLeaveScheduleChanges} from './history-model';
import {AnnualLeaveScheduleHistoryRow} from './history-schedule-row';
import {annualLeaveMonthRange} from './model';
import {useAnnualLeave} from './queries';

export function AnnualLeaveHistoryMonth({
    wardId,
    person,
    settings,
    month,
    entries,
    today,
}: {
    wardId: number;
    person: TAnnualLeavePerson;
    settings: TAnnualLeaveSettings;
    month: string;
    entries: TAnnualLeaveHistoryItem[];
    today: string;
}) {
    const {t} = useTypedTranslation();
    const [expanded, setExpanded] = useState(false);
    const detailsId = useId();
    const [year, monthNumber] = month.split('-').map(Number);
    const range = annualLeaveMonthRange(year!, monthNumber!);
    const startedOn = person.startedOn > (settings.startedOn ?? '') ? person.startedOn : (settings.startedOn ?? person.startedOn);
    const archived = range.to < startedOn;
    const query = useAnnualLeave(archived ? null : wardId, range.from, range.to);
    const cutoff = query.data?.settings.enabled ? query.data.today : (query.data?.settings.stoppedOn ?? today);
    const usage = query.data ? annualLeaveMonthUsage(query.data.days, person.nurseId, month, cutoff) : null;
    const changes = annualLeaveScheduleChanges(entries);
    const latestChanges = changes.filter(
        (change, index) => changes.findIndex((item) => item.entry.effectiveOn === change.entry.effectiveOn) === index,
    );
    const cancelled = latestChanges.filter(
        (change) =>
            change.kind === 'removed' &&
            change.entry.effectiveOn >= startedOn &&
            !usage?.dates.some((day) => day.date === change.entry.effectiveOn),
    );
    const rows = [
        ...(usage?.dates.map((day) => ({kind: 'usage' as const, date: day.date, day})) ?? []),
        ...cancelled.map((change) => ({kind: 'cancelled' as const, date: change.entry.effectiveOn, change})),
    ].sort((a, b) => a.date.localeCompare(b.date));
    const showUsed = usage && (usage.used > 0 || (usage.planned === 0 && month <= cutoff.slice(0, 7)));
    const showPlanned = usage && (usage.planned > 0 || month > cutoff.slice(0, 7));
    const amount = (label: string, count: number, planned = false) => (
        <div className="text-right">
            <span className={`block text-xs leading-4 ${planned ? 'text-amber-800' : 'text-slate-600'}`}>
                {label}
                {planned && ` · ${t('annualLeave.notDeducted')}`}
            </span>
            <strong
                className={`block text-lg leading-6 font-bold whitespace-nowrap tabular-nums ${planned ? 'text-amber-800' : 'text-blue-700'}`}
            >
                {t('annualLeave.days', {count})}
            </strong>
        </div>
    );

    return (
        <li className="rounded-xl bg-gray-7 px-3 py-3 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="rounded-md bg-blue-100 px-2 py-1 text-xs leading-4 font-semibold text-blue-800">
                    {t('annualLeave.historyKinds.SCHEDULE')}
                </span>
                <time dateTime={month} className="text-sm font-semibold text-sub-2">
                    {t('annualLeave.historyMonth', {year, month: monthNumber})}
                </time>
            </div>
            <div className="mt-1 flex flex-wrap items-end justify-between gap-x-3 gap-y-2">
                <button
                    type="button"
                    aria-expanded={expanded}
                    aria-controls={detailsId}
                    onClick={() => setExpanded((previous) => !previous)}
                    className="inline-flex min-h-8 min-w-11 items-center gap-1 rounded-md px-1 text-xs leading-5 text-slate-600 transition-colors duration-150 hover:text-slate-800 focus-visible:bg-slate-200 focus-visible:text-slate-900 focus-visible:outline-none motion-reduce:transition-none [@media(pointer:coarse)]:min-h-11"
                >
                    {t('annualLeave.monthDetails')} <span aria-hidden="true">{expanded ? '▴' : '▾'}</span>
                </button>
                <div className="ml-auto flex items-end gap-4 text-right" aria-live="polite">
                    {archived ? (
                        <span className="text-xs text-slate-600">{t('annualLeave.archivedMonth')}</span>
                    ) : query.isError ? (
                        <button
                            type="button"
                            onClick={() => void query.refetch()}
                            className="min-h-8 rounded-md px-2 text-xs text-red hover:bg-red-50 focus-visible:bg-red-100 focus-visible:text-red-900 focus-visible:outline-none"
                        >
                            {t('annualLeave.retry')}
                        </button>
                    ) : !usage ? (
                        <span className="text-xs text-slate-600">{t('annualLeave.calculating')}</span>
                    ) : (
                        <>
                            {showUsed && amount(t('annualLeave.monthUsed'), usage.used)}
                            {showPlanned && amount(t('annualLeave.planned'), usage.planned, true)}
                        </>
                    )}
                </div>
            </div>
            {expanded && (
                <div id={detailsId} className="mt-2">
                    {archived ? (
                        <ul className="rounded-lg bg-white py-1">
                            {changes.map((change) => (
                                <AnnualLeaveScheduleHistoryRow key={change.entry.id} change={change} />
                            ))}
                        </ul>
                    ) : (
                        <>
                            {query.isError ? (
                                <p role="alert" className="text-xs text-red">
                                    {t('annualLeave.error')}
                                </p>
                            ) : !usage ? (
                                <p className="text-xs text-slate-600">{t('annualLeave.loading')}</p>
                            ) : rows.length === 0 ? (
                                <p className="py-2 text-xs text-slate-600">{t('annualLeave.noMonthUsage')}</p>
                            ) : (
                                <ul className="rounded-lg bg-white px-2 py-1">
                                    {rows.map((row) =>
                                        row.kind === 'cancelled' ? (
                                            <AnnualLeaveScheduleHistoryRow key={row.date} change={row.change} />
                                        ) : (
                                            <li
                                                key={row.date}
                                                className="grid min-h-7 grid-cols-[5rem_minmax(0,1fr)_auto] items-center gap-x-2 gap-y-1 py-1 text-xs leading-5"
                                            >
                                                <time dateTime={row.date} className="text-slate-600 tabular-nums">
                                                    {row.date.replace(/-/g, '.')}
                                                </time>
                                                <span className="flex flex-wrap items-center gap-x-2 text-slate-600">
                                                    <span className={row.date > cutoff ? 'rounded bg-amber-100 px-1.5 text-amber-800' : ''}>
                                                        {t(row.date > cutoff ? 'annualLeave.planned' : 'annualLeave.monthUsed')}
                                                    </span>
                                                    {row.day.source === 'DAY_USAGE' && <span>{t('annualLeave.manualUsageShort')}</span>}
                                                </span>
                                                <strong
                                                    className={`text-right text-xs whitespace-nowrap tabular-nums ${row.date > cutoff ? 'text-amber-800' : 'text-blue-700'}`}
                                                >
                                                    {t('annualLeave.days', {count: row.day.days})}
                                                </strong>
                                            </li>
                                        ),
                                    )}
                                </ul>
                            )}
                        </>
                    )}
                </div>
            )}
        </li>
    );
}
