import type {TAnnualLeaveHistoryItem} from '@dutying/api/ward';
import {useId, useState} from 'react';
import {useTypedTranslation} from '@/shared/hook/use-typed-translation';
import {grantGroup} from './bulk-grant';

const tones = {
    GRANT: {badge: 'bg-emerald-100 text-emerald-800', value: 'text-emerald-700'},
    SETTLEMENT: {badge: 'bg-orange-100 text-orange-800', value: 'text-orange-700'},
    CORRECTION: {badge: 'bg-violet-100 text-violet-800', value: 'text-violet-700'},
    SET_BALANCE: {badge: 'bg-violet-100 text-violet-800', value: 'text-violet-700'},
    OPENING: {badge: 'bg-violet-100 text-violet-800', value: 'text-violet-700'},
    SCHEDULE: {badge: 'bg-blue-100 text-blue-800', value: 'text-blue-700'},
    DAY_USAGE: {badge: 'bg-blue-100 text-blue-800', value: 'text-blue-700'},
};
const neutralTone = {badge: 'bg-slate-200 text-slate-700', value: 'text-slate-600'};

function isOpeningUnknown(entry: TAnnualLeaveHistoryItem) {
    if (entry.kind !== 'OPENING' || !entry.detailsJson) return false;

    try {
        return JSON.parse(entry.detailsJson)?.remainingDays === null;
    } catch {
        return false;
    }
}

export function AnnualLeaveHistoryEntry({entry, today, onUndo}: {entry: TAnnualLeaveHistoryItem; today: string; onUndo?: () => void}) {
    const {t} = useTypedTranslation();
    const [expanded, setExpanded] = useState(false);
    const infoId = useId();
    const planned = !entry.voided && ['SCHEDULE', 'DAY_USAGE'].includes(entry.kind) && entry.days > 0 && entry.effectiveOn > today;
    const tone = entry.voided
        ? neutralTone
        : planned
          ? {badge: 'bg-amber-100 text-amber-800', value: 'text-amber-800'}
          : (tones[entry.kind as keyof typeof tones] ?? neutralTone);
    const bulkGroup = ['GRANT', 'SETTLEMENT'].includes(entry.kind) ? grantGroup(entry.detailsJson) : null;
    const adjustment = ['GRANT', 'SETTLEMENT', 'CORRECTION', 'SET_BALANCE'].includes(entry.kind);
    const usage = entry.kind === 'SCHEDULE' || entry.kind === 'DAY_USAGE';
    const unknownOpening = isOpeningUnknown(entry);
    const kindLabel = t(`annualLeave.historyKinds.${entry.kind in tones ? entry.kind : entry.kind === 'CONTROL' ? 'CONTROL' : 'OTHER'}`);
    const valueLabel = adjustment
        ? t(entry.days > 0 ? 'annualLeave.increased' : entry.days < 0 ? 'annualLeave.decreased' : 'annualLeave.unchanged')
        : usage
          ? t(entry.days > 0 && entry.effectiveOn > today ? 'annualLeave.planned' : 'annualLeave.recordedUsage')
          : t('annualLeave.registeredDays');

    return (
        <li className="rounded-xl bg-gray-7 px-3 py-3 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5">
                <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                    <span className={`inline-flex rounded-md px-2 py-1 text-xs leading-4 font-semibold ${tone.badge}`}>
                        {bulkGroup
                            ? t(entry.kind === 'SETTLEMENT' ? 'annualLeave.bulkDeduct.group' : 'annualLeave.bulkGrant.group')
                            : kindLabel}
                    </span>
                    {entry.voided && (
                        <span className="rounded-md bg-slate-200 px-2 py-1 text-xs leading-4 font-semibold text-slate-700">
                            {t('annualLeave.voided')}
                        </span>
                    )}
                </div>
                <time dateTime={entry.effectiveOn} className="shrink-0 text-xs text-slate-600 tabular-nums">
                    <span className="sr-only">{t('annualLeave.effectiveDate')} </span>
                    {entry.effectiveOn.replace(/-/g, '.')}
                </time>
            </div>
            <div className="mt-1 flex flex-wrap items-end gap-x-3 gap-y-1">
                <div className="flex min-w-0 flex-1 basis-32 flex-wrap items-center gap-x-2">
                    {entry.reason && (
                        <p className="min-w-0 text-sm leading-5 [overflow-wrap:anywhere] break-keep text-sub-2">{entry.reason}</p>
                    )}
                    <div className="flex shrink-0 items-center gap-2">
                        <button
                            type="button"
                            aria-expanded={expanded}
                            aria-controls={infoId}
                            onClick={() => setExpanded((previous) => !previous)}
                            className="inline-flex min-h-8 min-w-11 items-center gap-1 rounded-md px-1 text-xs leading-5 text-slate-600 transition-colors duration-150 hover:text-slate-800 focus-visible:bg-slate-200 focus-visible:text-slate-900 focus-visible:outline-none motion-reduce:transition-none [@media(pointer:coarse)]:min-h-11"
                        >
                            {t('annualLeave.recordInfo')}
                            <span aria-hidden="true">{expanded ? '▴' : '▾'}</span>
                        </button>
                        {onUndo && (
                            <button
                                type="button"
                                onClick={onUndo}
                                className="min-h-8 rounded-md px-1 text-xs font-medium text-slate-600 hover:bg-slate-200 hover:text-slate-900 focus-visible:bg-slate-200 focus-visible:text-slate-900 focus-visible:outline-none [@media(pointer:coarse)]:min-h-11"
                            >
                                {t('annualLeave.undo')}
                            </button>
                        )}
                    </div>
                </div>
                <div className="ml-auto text-right">
                    {' '}
                    {entry.voided || entry.kind === 'REVERT' ? (
                        <span className="text-sm font-semibold text-slate-600">{t('annualLeave.reversedRecord')}</span>
                    ) : entry.kind === 'CONTROL' ? (
                        <span className="text-sm font-semibold text-slate-600">{t('annualLeave.CONTROL')}</span>
                    ) : (
                        <span className="inline-flex flex-col items-end">
                            <span className="text-xs leading-4 text-slate-600">
                                {valueLabel}
                                {planned && ` · ${t('annualLeave.notDeducted')}`}
                            </span>
                            <strong className={`text-lg leading-6 font-bold whitespace-nowrap tabular-nums ${tone.value}`}>
                                {unknownOpening
                                    ? t('annualLeave.notEntered')
                                    : `${adjustment && entry.days > 0 ? '+' : ''}${t('annualLeave.days', {count: entry.days})}`}
                            </strong>
                        </span>
                    )}
                </div>
            </div>
            <div id={infoId} hidden={!expanded} className="mt-2 rounded-lg bg-white px-3 py-2">
                <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1 text-xs leading-5 text-slate-600">
                    {bulkGroup && (
                        <>
                            <dt>{t('annualLeave.bulkGrant.groupId')}</dt>
                            <dd className="font-mono break-all">{bulkGroup}</dd>
                        </>
                    )}
                    <dt>{t('annualLeave.recordedAt')}</dt>
                    <dd className="tabular-nums">{entry.createdAt.slice(0, 16).replace('T', ' ')}</dd>
                    <dt>{t('annualLeave.recordedBy')}</dt>
                    <dd className="[overflow-wrap:anywhere]">{entry.actor}</dd>
                    {entry.sourceSnapshotId != null && (
                        <>
                            <dt>{t('annualLeave.recordSource')}</dt>
                            <dd>{t('annualLeave.source', {id: entry.sourceSnapshotId})}</dd>
                        </>
                    )}
                </dl>
            </div>
        </li>
    );
}
