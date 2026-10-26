import {useEffect, useId, useImperativeHandle, useState, type Ref} from 'react';
import type {TWardShiftType} from '@/entities';
import {usePersonalRestText} from './copy';
import type {TResolvedRestConflict} from './rest-conflict';
import {useRestEditorCopy} from './rest-editor-copy';
import {usePersonalRestForm} from './use-personal-rest-form';

export type TRestEditorState = {dirty: boolean; saving: boolean; ready: boolean; refreshPending: boolean};
export type TRestEditorHandle = {apply: () => Promise<boolean>};
export type TRestEditorContext = {nurses: {nurseId: number; name: string}[]; shiftTypes: TWardShiftType[]};

type TProps = {
    conflicts: TResolvedRestConflict[];
    shiftTypes: TWardShiftType[];
    year: number;
    month: number;
    disabled: boolean;
    editorRef: Ref<TRestEditorHandle>;
    onStateChange: (state: TRestEditorState) => void;
    onApplied: () => Promise<void> | void;
};

export function SidebarRestEditor(props: TProps) {
    const text = useRestEditorCopy();
    const [selected, setSelected] = useState(props.conflicts[0]?.nurseId);
    const [locked, setLocked] = useState(false);
    const nurse = props.conflicts.find((nurse) => nurse.nurseId === selected) ?? props.conflicts[0];

    if (!nurse) return null;

    return (
        <section className="space-y-5 break-keep" aria-label={text.tab}>
            <div>
                <p className="text-[15px] font-semibold text-[#333D4B]">{text.month(props.year, props.month)}</p>
                <p className="mt-1 text-[13px] leading-5 text-[#667085]">{text.intro}</p>
            </div>
            {props.conflicts.length > 1 ? (
                <label className="grid gap-2 text-[14px] font-medium text-[#333D4B]">
                    {text.nurse}
                    <select
                        value={nurse.nurseId}
                        disabled={props.disabled || locked}
                        onChange={(event) => setSelected(Number(event.target.value))}
                        className="min-h-[44px] w-full rounded-[10px] border border-[#D0D5DD] bg-white px-3 text-[15px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-main-1 disabled:opacity-50"
                    >
                        {props.conflicts.map((nurse) => (
                            <option key={nurse.nurseId} value={nurse.nurseId}>
                                {nurse.name}
                            </option>
                        ))}
                    </select>
                </label>
            ) : (
                <p className="text-[17px] font-semibold text-[#333D4B]">{nurse.name}</p>
            )}
            <ul
                aria-label={text.reason}
                className="list-disc space-y-2 rounded-[10px] bg-[#FFF8EB] py-3 pr-3 pl-7 text-[13px] leading-6 text-[#7A4B12]"
            >
                {nurse.explanations.map((explanation) => (
                    <li key={explanation}>{explanation}</li>
                ))}
            </ul>
            <RestFields
                key={`${nurse.nurseId}:${props.year}:${props.month}`}
                {...props}
                nurseId={nurse.nurseId}
                onLockedChange={setLocked}
            />
        </section>
    );
}

function RestFields({
    nurseId,
    year,
    month,
    shiftTypes,
    disabled,
    editorRef,
    onStateChange,
    onApplied,
    onLockedChange,
}: TProps & {nurseId: number; onLockedChange: (locked: boolean) => void}) {
    const text = useRestEditorCopy();
    const legacy = usePersonalRestText();
    const id = useId();
    const form = usePersonalRestForm({nurseId, y: year, m: month, shiftTypes, enabled: true, onApplied, refreshFailed: text.refreshFailed});
    const {query, off, annual, dirty, saving, refreshPending} = form;
    const ready = !query.isPending && !query.isError && !query.isFetching;
    const locked = disabled || saving || !ready || refreshPending;

    useImperativeHandle(editorRef, () => ({apply: form.save}));
    useEffect(() => {
        onStateChange({dirty, saving, ready, refreshPending});
        onLockedChange(dirty || saving || refreshPending);
    }, [dirty, saving, ready, refreshPending, onStateChange, onLockedChange]);

    const fields = [
        {id: 'off', label: text.off, value: off, change: form.setOff},
        ...form.annualTypes.map((type) => ({
            id: String(type.wardShiftTypeId),
            label: type.name,
            value: annual[type.wardShiftTypeId] ?? '',
            change: (value: string) => form.setAnnual({...annual, [type.wardShiftTypeId]: value}),
        })),
    ];
    const entered = [off, ...Object.values(annual)].filter((value) => value !== '');
    const total = entered.every((value) => /^\d+$/.test(value)) ? entered.reduce((sum, value) => sum + Number(value), 0) : null;

    if (query.isPending)
        return (
            <p role="status" className="py-5 text-sm text-[#667085]">
                {legacy.loading}
            </p>
        );

    if (query.isError)
        return (
            <div className="space-y-2">
                <p role="alert">{legacy.loadFailed}</p>
                <button
                    type="button"
                    className="min-h-[44px] rounded-lg px-3 text-main-1 focus-visible:outline-2 focus-visible:outline-main-1"
                    onClick={() => void query.refetch()}
                >
                    {legacy.retry}
                </button>
            </div>
        );

    return (
        <div className="space-y-4">
            <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,140px),1fr))] gap-4">
                {fields.map((field) => (
                    <label key={field.id} className="grid gap-2 text-[14px] font-medium text-[#333D4B]">
                        {field.label}
                        <span className="flex min-h-[48px] min-w-0 items-center rounded-[10px] border border-[#D0D5DD] bg-white focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-main-1">
                            <input
                                aria-describedby={`${id}-hint`}
                                aria-invalid={Boolean(form.error)}
                                type="number"
                                min={0}
                                max={new Date(year, month, 0).getDate()}
                                step={1}
                                value={field.value}
                                placeholder="—"
                                disabled={locked}
                                onChange={(event) => {
                                    field.change(event.target.value);
                                    form.setDirty(true);
                                    form.setSaved(false);
                                }}
                                className="min-h-[48px] w-full min-w-0 bg-transparent px-3 text-[18px] tabular-nums outline-none disabled:opacity-50"
                            />
                            <span aria-hidden="true" className="shrink-0 pr-3 text-[13px] text-[#667085]">
                                {text.day}
                            </span>
                        </span>
                    </label>
                ))}
            </div>
            <p id={`${id}-hint`} className="text-[13px] leading-5 text-[#667085]">
                {text.hint}
            </p>
            {off !== '' && total !== null && <p className="text-[14px] font-medium text-[#5931B9]">{text.total(total)}</p>}
            {form.annualTypes.length === 0 && <p className="text-[13px] leading-5 text-[#667085]">{legacy.noAnnualTypes}</p>}
            {form.error && (
                <ul
                    ref={form.errorRef}
                    tabIndex={-1}
                    role="alert"
                    className="list-disc rounded-[10px] bg-[#FFF1F0] py-3 pr-3 pl-7 text-[13px] leading-5 text-[#B42318] focus-visible:outline-2 focus-visible:outline-[#B42318]"
                >
                    <li>{form.error}</li>
                </ul>
            )}
            <button
                type="button"
                disabled={locked || (!off && !Object.values(annual).some((value) => value !== ''))}
                onClick={() => {
                    form.setOff('');
                    form.setAnnual({});
                    form.setDirty(true);
                    form.setSaved(false);
                }}
                className="min-h-[44px] rounded-[8px] px-3 text-[13px] font-medium text-main-1 hover:bg-main-light focus-visible:outline-2 focus-visible:outline-main-1 disabled:opacity-40"
            >
                {text.inherit}
            </button>
            <p className="border-t border-[#E5E8EB] pt-4 text-[13px] leading-5 text-[#667085]">{text.next}</p>
        </div>
    );
}
