import {useTypedTranslation} from '@/shared/hook/use-typed-translation';
import type {TAnnualLeaveScheduleChange} from './history-model';

export function AnnualLeaveScheduleHistoryRow({change}: {change: TAnnualLeaveScheduleChange}) {
    const {t} = useTypedTranslation();
    const {entry, kind, previousDays} = change;
    const days = t('annualLeave.days', {count: entry.days});

    return (
        <li>
            <details className="group">
                <summary className="grid min-h-8 cursor-pointer list-none grid-cols-[5rem_minmax(0,1fr)_auto_0.5rem] items-center gap-x-2 px-2 py-1 text-xs leading-5 text-slate-600 transition-colors duration-150 hover:text-slate-800 focus-visible:bg-slate-200 focus-visible:text-slate-900 focus-visible:outline-none motion-reduce:transition-none [&::-webkit-details-marker]:hidden [@media(pointer:coarse)]:min-h-11">
                    <time dateTime={entry.effectiveOn} className="whitespace-nowrap tabular-nums">
                        {entry.effectiveOn.replace(/-/g, '.')}
                    </time>
                    <span className={kind === 'removed' ? 'font-medium text-orange-800' : 'font-medium text-sub-2'}>
                        {t(`annualLeave.scheduleChange.${kind}`)}
                    </span>
                    <strong
                        className={`max-w-32 text-right [overflow-wrap:anywhere] tabular-nums ${kind === 'removed' ? 'text-orange-800' : 'text-blue-700'}`}
                    >
                        {kind === 'removed'
                            ? t('annualLeave.removedDays', {count: previousDays!})
                            : kind === 'changed'
                              ? `${t('annualLeave.days', {count: previousDays!})} → ${days}`
                              : days}
                    </strong>
                    <span aria-hidden="true" className="group-open:hidden">
                        ▾
                    </span>
                    <span aria-hidden="true" className="hidden group-open:inline">
                        ▴
                    </span>
                </summary>
                <div className="px-2 pt-1 pb-2 text-xs leading-5 [overflow-wrap:anywhere] text-slate-600">
                    {entry.reason && <p>{entry.reason}</p>}
                    <p>
                        {t('annualLeave.recordedAt')}: {entry.createdAt.slice(0, 16).replace('T', ' ')} · {t('annualLeave.recordedBy')}:{' '}
                        {entry.actor}
                    </p>
                    {entry.sourceSnapshotId != null && <p>{t('annualLeave.source', {id: entry.sourceSnapshotId})}</p>}
                </div>
            </details>
        </li>
    );
}
