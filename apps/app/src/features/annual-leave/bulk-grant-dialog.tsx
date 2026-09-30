import type {TAnnualLeavePerson} from '@dutying/api/ward';
import {useEffect, useRef, useState, type FormEvent} from 'react';
import {WardAPI} from '@/shared/api';
import {useTypedTranslation} from '@/shared/hook/use-typed-translation';
import {canGrant, restoreGrantJob, runGrantJob, type TGrantJob, type TGrantMode} from './bulk-grant';
import {annualLeaveDate} from './model';
import {useRefreshAnnualLeave} from './queries';
import {AnnualLeaveDialog, AnnualLeaveField, annualButtonClass, annualInputClass, annualSecondaryClass} from './ui';

export function AnnualLeaveBulkGrantDialog({
    wardId,
    open,
    people,
    selectedIds,
    mode = 'GRANT',
    onClose,
    onComplete,
    onPendingChange,
}: {
    wardId: number;
    open: boolean;
    people: TAnnualLeavePerson[];
    selectedIds: number[];
    mode?: TGrantMode;
    onClose: () => void;
    onComplete: () => void;
    onPendingChange: (pending: boolean) => void;
}) {
    const {t} = useTypedTranslation();
    const refresh = useRefreshAnnualLeave(wardId);
    const [days, setDays] = useState('1');
    const [reason, setReason] = useState('');
    const storageKey = `annual-leave-bulk-grant:${wardId}`;
    const [job, setJob] = useState<TGrantJob | null>(() => {
        try {
            return restoreGrantJob(sessionStorage.getItem(storageKey));
        } catch {
            return null;
        }
    });
    const saveJob = (value: TGrantJob | null) => {
        setJob(value);

        try {
            if (value) sessionStorage.setItem(storageKey, JSON.stringify(value));
            else sessionStorage.removeItem(storageKey);
        } catch {
            /* The same mounted dialog still retains retry IDs if storage is unavailable. */
        }
    };

    useEffect(() => {
        onPendingChange(job !== null);
    }, [job, onPendingChange]);

    const [busy, setBusy] = useState(false);
    const lock = useRef(false);
    const targets = people.filter((person) => selectedIds.includes(person.nurseId) && canGrant(person));
    const amount = Number(days);
    const valid = days.trim() !== '' && Number.isFinite(amount) && amount > 0 && amount <= 99999 && /^\d+(\.\d{1,3})?$/.test(days);
    const decreasing = (job ? (job.kind ?? 'GRANT') : mode) === 'SETTLEMENT';
    const copy = (key: string) => t(`annualLeave.${decreasing ? 'bulkDeduct' : 'bulkGrant'}.${key}`);
    const complete = job?.people.every((person) => person.done) ?? false;
    const rows =
        job?.people ??
        targets.map((person) => ({
            nurseId: person.nurseId,
            name: person.name,
            before: person.currentDays!,
            version: person.version,
            done: false,
        }));
    const save = async (event: FormEvent) => {
        event.preventDefault();

        if (lock.current || complete || (!job && (!valid || !targets.length))) return;

        lock.current = true;
        setBusy(true);

        const task = job ?? {
            kind: mode,
            id: `bulk_${crypto.randomUUID().replace(/-/g, '')}`,
            date: annualLeaveDate(),
            days: amount,
            reason: reason.trim() || copy('title'),
            people: rows,
        };

        saveJob(task);

        try {
            const result = await runGrantJob(
                task,
                people,
                (nurseId, command) => WardAPI.changeAnnualLeave(wardId, nurseId, command),
                saveJob,
            );

            saveJob(result);
            await refresh();

            if (result.people.every((person) => person.done)) {
                onComplete();
            }
        } finally {
            lock.current = false;
            setBusy(false);
        }
    };
    const close = () => {
        if (complete) {
            saveJob(null);
            setDays('1');
            setReason('');
        }

        onClose();
    };

    if (!open) return null;

    return (
        <AnnualLeaveDialog title={copy('title')} onClose={close} busy={busy}>
            <form onSubmit={(event) => void save(event)} className="flex flex-col gap-4">
                {decreasing && <p className="text-sm leading-5 break-keep text-sub-2">{copy('hint')}</p>}
                {!job && (
                    <>
                        <AnnualLeaveField label={copy('days')}>
                            <input
                                type="number"
                                min="0.001"
                                max="99999"
                                step="0.001"
                                required
                                value={days}
                                onChange={(event) => setDays(event.target.value)}
                                className={`${annualInputClass} max-w-40`}
                            />
                        </AnnualLeaveField>
                        <AnnualLeaveField label={copy('reason')}>
                            <input
                                maxLength={500}
                                value={reason}
                                onChange={(event) => setReason(event.target.value)}
                                className={annualInputClass}
                            />
                        </AnnualLeaveField>
                    </>
                )}
                <div className="rounded-xl bg-gray-7 px-4 py-3">
                    <p className="text-sm font-semibold text-sub-1">
                        {t(`annualLeave.${decreasing ? 'bulkDeduct' : 'bulkGrant'}.confirm`, {
                            count: rows.length,
                            days: job?.days ?? (valid ? amount : 0),
                        })}
                    </p>
                    {job && <p className="mt-1 text-sm text-sub-2">{job.reason}</p>}
                    <ul className="mt-2 max-h-64 overflow-y-auto">
                        {rows.map((person) => (
                            <li key={person.nurseId} className="flex min-h-10 flex-wrap items-center justify-between gap-2 py-1 text-sm">
                                <span>{person.name}</span>
                                <span className="flex items-center gap-2 tabular-nums">
                                    {t('annualLeave.days', {count: person.before})}
                                    {(job !== null || valid) && (
                                        <span className="text-main-1">
                                            →{' '}
                                            {t('annualLeave.days', {
                                                count:
                                                    Math.round((person.before + (decreasing ? -1 : 1) * (job?.days ?? amount)) * 1000) /
                                                    1000,
                                            })}
                                        </span>
                                    )}
                                    {job && (
                                        <span
                                            className={`rounded px-2 py-1 text-xs ${person.done ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-900'}`}
                                        >
                                            {t(
                                                person.done
                                                    ? 'annualLeave.bulkGrant.done'
                                                    : busy
                                                      ? 'annualLeave.bulkGrant.waiting'
                                                      : 'annualLeave.bulkGrant.pending',
                                            )}
                                        </span>
                                    )}
                                </span>
                            </li>
                        ))}
                    </ul>
                </div>
                {decreasing && (job !== null || valid) && rows.some((person) => person.before - (job?.days ?? amount) < 0) && (
                    <p className="text-sm text-amber-800">{t('annualLeave.bulkDeduct.negative')}</p>
                )}
                {!rows.length && <p className="text-sm text-amber-800">{t('annualLeave.bulkGrant.choose')}</p>}
                {job && (!complete || decreasing) && (
                    <p role="status" className="text-sm leading-5 text-sub-2">
                        {complete ? copy('complete') : t(busy ? 'annualLeave.saving' : 'annualLeave.bulkGrant.retryHint')}
                    </p>
                )}
                {job && !complete && !busy && (
                    <button
                        type="button"
                        onClick={() => {
                            saveJob(null);
                            setDays('1');
                            setReason('');
                            onComplete();
                            onClose();
                        }}
                        className="self-start rounded-lg px-2 py-2 text-xs text-gray-3 hover:text-sub-1 focus-visible:bg-gray-7 focus-visible:text-sub-1 focus-visible:outline-none"
                    >
                        {t('annualLeave.bulkGrant.stop')}
                    </button>
                )}
                <div className="flex flex-wrap justify-end gap-2">
                    <button type="button" disabled={busy} onClick={close} className={annualSecondaryClass}>
                        {t('annualLeave.close')}
                    </button>
                    {!complete && (
                        <button type="submit" disabled={busy || (!job && (!valid || !rows.length))} className={annualButtonClass}>
                            {busy ? t('annualLeave.saving') : job ? t('annualLeave.bulkGrant.retry') : copy('submit')}
                        </button>
                    )}
                </div>
            </form>
        </AnnualLeaveDialog>
    );
}
