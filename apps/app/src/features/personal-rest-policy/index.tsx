import {useEffect, useState} from 'react';
import type {TWardShiftType} from '@/entities';
import {usePersonalRestText} from './copy';
import {usePersonalRestForm} from './use-personal-rest-form';

export {usePersonalRestText} from './copy';

export function PersonalRestPolicy({
    nurseId,
    nurseName,
    shiftTypes,
    year,
    month,
    onDirtyChange,
}: {
    nurseId: number;
    nurseName: string;
    shiftTypes: TWardShiftType[];
    year?: number;
    month?: number;
    onDirtyChange?: (dirty: boolean) => void;
}) {
    const text = usePersonalRestText();
    const now = new Date();
    const [period, setPeriod] = useState(`${year ?? now.getFullYear()}-${String(month ?? now.getMonth() + 1).padStart(2, '0')}`);
    const [open, setOpen] = useState(false);
    const [y, m] = period.split('-').map(Number);
    const {query, off, setOff, annual, setAnnual, dirty, setDirty, saving, error, errorRef, saved, setSaved, annualTypes, reset, save} =
        usePersonalRestForm({nurseId, y, m, shiftTypes, enabled: open});

    useEffect(() => {
        onDirtyChange?.(dirty);
    }, [dirty, onDirtyChange]);

    return (
        <details onToggle={(event) => setOpen(event.currentTarget.open)} className="my-3 rounded-xl border border-gray-6 p-3">
            <summary className="cursor-pointer py-2 font-semibold">
                {nurseName} · {text.title}
            </summary>
            <ul className="my-3 list-disc space-y-2 pl-5 text-sm">
                <li>{text.hint}</li>
                <li>{text.preserve}</li>
                <li>{text.override}</li>
            </ul>
            <label className="mb-3 flex flex-wrap items-center gap-3">
                {text.month}
                <input
                    type="month"
                    value={period}
                    min="2000-01"
                    max="2100-12"
                    disabled={dirty || saving || !!year}
                    onChange={(e) => setPeriod(e.target.value)}
                    className="min-h-11 rounded border border-gray-5 px-2"
                />
            </label>
            {query.isPending ? (
                <p role="status">{text.loading}</p>
            ) : query.isError ? (
                <div role="alert">
                    <ul className="list-disc pl-5">
                        <li>{text.loadFailed}</li>
                    </ul>
                    <button type="button" className="min-h-11 underline" onClick={() => void query.refetch()}>
                        {text.retry}
                    </button>
                </div>
            ) : (
                <>
                    <label className="my-2 grid gap-2">
                        {text.off}
                        <input
                            type="number"
                            min="0"
                            max={new Date(y, m, 0).getDate()}
                            step="1"
                            value={off}
                            placeholder={text.inherit}
                            disabled={saving || query.isFetching}
                            onChange={(e) => {
                                setOff(e.target.value);
                                setDirty(true);
                                setSaved(false);
                            }}
                            className="min-h-11 rounded border border-gray-5 px-3"
                        />
                    </label>
                    {annualTypes.length === 0 && (
                        <ul className="my-3 list-disc pl-5 text-sm">
                            <li>{text.noAnnualTypes}</li>
                        </ul>
                    )}
                    {annualTypes.map((type) => (
                        <label key={type.wardShiftTypeId} className="my-2 grid gap-2">
                            {type.name} · {text.annual}
                            <input
                                type="number"
                                min="0"
                                max={new Date(y, m, 0).getDate()}
                                step="1"
                                value={annual[type.wardShiftTypeId] ?? ''}
                                placeholder={text.inherit}
                                disabled={saving || query.isFetching}
                                onChange={(e) => {
                                    setAnnual({...annual, [type.wardShiftTypeId]: e.target.value});
                                    setDirty(true);
                                    setSaved(false);
                                }}
                                className="min-h-11 rounded border border-gray-5 px-3"
                            />
                        </label>
                    ))}
                    {error && (
                        <ul ref={errorRef} tabIndex={-1} role="alert" className="my-3 list-disc pl-5 text-red">
                            <li>{error}</li>
                        </ul>
                    )}
                    {saved && (
                        <p role="status" className="my-3 text-sm">
                            {text.saved}
                        </p>
                    )}
                    <div className="mt-3 flex flex-wrap gap-3">
                        <button
                            type="button"
                            disabled={!dirty || saving}
                            onClick={() => void save()}
                            className="min-h-11 rounded-lg bg-main-1 px-4 text-white disabled:opacity-50"
                        >
                            {saving ? text.saving : text.save}
                        </button>
                        <button
                            type="button"
                            disabled={saving}
                            onClick={() => {
                                setOff('');
                                setAnnual({});
                                setDirty(true);
                                setSaved(false);
                            }}
                            className="min-h-11 px-3 underline"
                        >
                            {text.inherit}
                        </button>
                        <button type="button" disabled={!dirty || saving} onClick={reset} className="min-h-11 px-3 underline">
                            {text.reset}
                        </button>
                    </div>
                </>
            )}
        </details>
    );
}
