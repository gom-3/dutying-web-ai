import {cn} from '@dutying/utils/style';
import {Check, Minus, Plus} from 'lucide-react';
import type {ReactNode} from 'react';
import {useEffect, useMemo, useState} from 'react';
import toast from 'react-hot-toast';
import {useTypedTranslation} from '@/shared/hook/use-typed-translation';
import {Switch} from '@/shared/ui/primitives/switch';
import {
    calculateBaseRestTarget,
    getApproximateWeekCount,
    getRestShiftTypes,
    resolveCountedRestShiftTypeIds,
    type TRestLeavePolicy,
    type TRestTargetMode,
    useRestLeavePolicy,
} from '../model/rest-leave-policy';
import {type TWardSettingsShiftType} from '../model/ward-settings-hook';

type TRestLeavePolicySectionProps = {
    wardId: number | null;
    shiftTypes: TWardSettingsShiftType[];
    onDirtyChange?: (dirty: boolean) => void;
};

type TChoiceCardProps = {
    title: string;
    description: string;
    selected: boolean;
    onClick: () => void;
    children?: ReactNode;
};

type TSettingPanelProps = {
    eyebrow: string;
    title: string;
    description?: string;
    children: ReactNode;
};

type TNumberStepperProps = {
    value: number;
    min: number;
    max: number;
    unit: string;
    ariaLabel: string;
    onChange: (value: number) => void;
};

type TFeatureTogglePreview = {
    label: string;
    value: number;
    unit: string;
    summary?: string;
};

const SETTINGS_PANEL_CLASS = 'rounded-[16px] bg-white px-5 py-5';
const SETTINGS_RAIL_GRID_CLASS = 'grid grid-cols-[52px_minmax(0,1fr)] gap-3';
const SETTINGS_PRIMARY_BUTTON_CLASS =
    'inline-flex min-h-11 items-center rounded-[12px] bg-main-1 px-5 py-3 font-apple text-sm leading-none font-semibold text-white transition-colors hover:bg-main-1-hover disabled:bg-gray-6 disabled:text-gray-3';

function clamp(value: number, min: number, max: number) {
    return Math.min(max, Math.max(min, value));
}

function getCurrentYearMonth() {
    const today = new Date();

    return {year: today.getFullYear(), month: today.getMonth() + 1};
}

function ChoiceCard({title, description, selected, onClick, children}: TChoiceCardProps) {
    return (
        <div
            className={cn(
                'min-w-0 rounded-[16px] transition-[background-color,transform] active:scale-[0.99]',
                selected ? 'bg-main-light' : 'bg-[#F6F7F9] hover:bg-[#EFF1F4]',
            )}
        >
            <button
                type="button"
                aria-pressed={selected}
                className={cn(
                    'group flex min-h-[76px] w-full min-w-0 items-center justify-between gap-3 rounded-[16px] px-4 py-3.5 text-left focus-visible:outline-2 focus-visible:outline-main-1',
                    selected && children && 'pb-2.5',
                )}
                onClick={onClick}
            >
                <span className="min-w-0">
                    <span className="block font-apple text-[15px] leading-[21px] font-semibold [word-break:keep-all] text-sub-1">
                        {title}
                    </span>
                    <span
                        className={cn(
                            'mt-1 block font-apple text-[12px] leading-[18px] [word-break:keep-all]',
                            selected ? 'text-main-1' : 'text-gray-3',
                        )}
                    >
                        {description}
                    </span>
                </span>
                <span
                    className={cn(
                        'grid size-6 shrink-0 place-items-center rounded-full transition-colors',
                        selected ? 'bg-main-1 text-white' : 'bg-white text-transparent group-hover:text-gray-4',
                    )}
                    aria-hidden="true"
                >
                    <Check className="size-3.5" />
                </span>
            </button>
            {selected && children ? <div className="px-3.5 pb-3.5">{children}</div> : null}
        </div>
    );
}

function SettingPanel({eyebrow, title, description, children}: TSettingPanelProps) {
    return (
        <section className={SETTINGS_PANEL_CLASS}>
            <div className={SETTINGS_RAIL_GRID_CLASS}>
                <div className="flex h-6 items-center justify-center">
                    <p className="font-poppins text-[11px] leading-none font-semibold text-main-1">{eyebrow}</p>
                </div>
                <div className="min-w-0">
                    <div className="mb-4">
                        <h2 className="font-apple text-[17px] leading-[24px] font-semibold [word-break:keep-all] text-sub-1">{title}</h2>
                        {description ? (
                            <p className="mt-1 max-w-[620px] font-apple text-[13px] leading-[20px] [word-break:keep-all] text-gray-3">
                                {description}
                            </p>
                        ) : null}
                    </div>
                    {children}
                </div>
            </div>
        </section>
    );
}

function NumberStepper({value, min, max, unit, ariaLabel, onChange}: TNumberStepperProps) {
    return (
        <div className="flex min-h-[52px] items-center justify-between gap-3 rounded-[14px] bg-white px-3 py-2">
            <p className="min-w-0 font-apple text-[13px] leading-[18px] font-semibold [word-break:keep-all] text-gray-3">{ariaLabel}</p>
            <div className="inline-flex h-10 shrink-0 items-center rounded-[12px] bg-[#F6F7F9] p-0.5">
                <button
                    type="button"
                    aria-label={`${ariaLabel} -1`}
                    className="grid size-9 place-items-center rounded-[11px] text-gray-3 transition-colors hover:bg-gray-7 hover:text-sub-1 focus-visible:outline-2 focus-visible:outline-main-1"
                    onClick={() => onChange(clamp(value - 1, min, max))}
                >
                    <Minus className="size-4" />
                </button>
                <span className="flex h-9 min-w-[70px] items-center justify-center rounded-[11px] bg-white font-poppins text-[16px] leading-none font-semibold text-sub-1 tabular-nums">
                    {value}
                    <span className="ml-0.5 font-apple text-[12px] leading-none font-semibold text-gray-3">{unit}</span>
                </span>
                <button
                    type="button"
                    aria-label={`${ariaLabel} +1`}
                    className="grid size-9 place-items-center rounded-[11px] text-gray-3 transition-colors hover:bg-gray-7 hover:text-sub-1 focus-visible:outline-2 focus-visible:outline-main-1"
                    onClick={() => onChange(clamp(value + 1, min, max))}
                >
                    <Plus className="size-4" />
                </button>
            </div>
        </div>
    );
}

function FeatureToggle({
    enabled,
    title,
    description,
    preview,
    onCheckedChange,
}: {
    enabled: boolean;
    title: string;
    description: string;
    preview: TFeatureTogglePreview;
    onCheckedChange: (checked: boolean) => void;
}) {
    return (
        <div className={SETTINGS_PANEL_CLASS}>
            <div className={SETTINGS_RAIL_GRID_CLASS}>
                <div aria-hidden="true" />
                <div className="min-w-0">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                        <div className="min-w-0">
                            <p className="font-apple text-[17px] leading-[24px] font-semibold [word-break:keep-all] text-sub-1">{title}</p>
                            <p className="mt-1 max-w-[620px] font-apple text-[13px] leading-[20px] [word-break:keep-all] text-gray-3">
                                {description}
                            </p>
                        </div>
                        <Switch
                            checked={enabled}
                            onCheckedChange={onCheckedChange}
                            aria-label={title}
                            className="shrink-0 data-[state=checked]:bg-main-1"
                        />
                    </div>
                    {enabled ? (
                        <div className="mt-4 inline-flex max-w-full items-center gap-3 rounded-[14px] bg-[#F6F7F9] px-3.5 py-2.5">
                            <div className="min-w-0 max-w-[220px]">
                                <p className="font-apple text-[12px] leading-[16px] font-semibold text-gray-3">{preview.label}</p>
                                {preview.summary ? (
                                    <p className="mt-1 font-apple text-[13px] leading-[19px] font-semibold [word-break:keep-all] text-sub-2">
                                        {preview.summary}
                                    </p>
                                ) : null}
                            </div>
                            <p className="shrink-0 font-poppins text-[24px] leading-none font-semibold text-sub-1 tabular-nums">
                                {preview.value}
                                <span className="ml-0.5 font-apple text-[12px] font-semibold text-gray-3">{preview.unit}</span>
                            </p>
                        </div>
                    ) : null}
                </div>
            </div>
        </div>
    );
}

export function RestLeavePolicySection({wardId, shiftTypes, onDirtyChange}: TRestLeavePolicySectionProps) {
    const {t} = useTypedTranslation();
    const {policy, setPolicy} = useRestLeavePolicy(wardId);
    const [draft, setDraft] = useState<TRestLeavePolicy>(policy);
    const {year, month} = useMemo(getCurrentYearMonth, []);
    const weekCount = getApproximateWeekCount(year, month);
    const baseTarget = calculateBaseRestTarget(draft, year, month);
    const restShiftTypes = useMemo(() => getRestShiftTypes(shiftTypes), [shiftTypes]);
    const countedRestShiftTypeIds = useMemo(() => resolveCountedRestShiftTypeIds(draft, shiftTypes), [draft, shiftTypes]);
    const countedRestShiftTypeIdSet = useMemo(() => new Set(countedRestShiftTypeIds), [countedRestShiftTypeIds]);
    const hasChanges = JSON.stringify(draft) !== JSON.stringify(policy);
    const targetSummary =
        draft.targetMode === 'weekly'
            ? t('page.makeShift.workers.restPolicy.weeklyTarget', {
                  days: draft.weeklyOffDays,
                  weeks: weekCount,
                  count: weekCount * draft.weeklyOffDays,
              })
            : t('page.makeShift.workers.restPolicy.fixedTarget', {count: draft.fixedMonthlyOffDays});
    const previewSummary = draft.targetMode === 'weekly' ? targetSummary : undefined;

    useEffect(() => {
        setDraft(policy);
    }, [policy]);

    useEffect(() => {
        onDirtyChange?.(hasChanges);
    }, [hasChanges, onDirtyChange]);

    useEffect(() => {
        return () => onDirtyChange?.(false);
    }, [onDirtyChange]);

    const patchDraft = (patch: Partial<TRestLeavePolicy>) => {
        setDraft((prev) => ({...prev, ...patch}));
    };
    const setTargetMode = (targetMode: TRestTargetMode) => {
        patchDraft({targetMode});
    };
    const handleToggleCountedRestShiftType = (shiftTypeId: number) => {
        const selectedIds = new Set(countedRestShiftTypeIds);

        if (selectedIds.has(shiftTypeId)) {
            selectedIds.delete(shiftTypeId);
        } else {
            selectedIds.add(shiftTypeId);
        }

        patchDraft({
            countedRestShiftTypeIds: restShiftTypes.map((shiftType) => shiftType.wardShiftTypeId).filter((id) => selectedIds.has(id)),
        });
    };
    const handleSave = () => {
        setPolicy(draft);
        toast.success(t('page.wardSettings.restLeavePolicy.toast.saved'));
    };

    return (
        <div className="w-full overflow-x-auto">
            <div className="min-w-[860px]">
                <FeatureToggle
                    enabled={draft.enabled}
                    title={t('page.wardSettings.restLeavePolicy.availability.title')}
                    description={t('page.wardSettings.restLeavePolicy.simpleSubtitle')}
                    preview={{
                        label: t('page.wardSettings.restLeavePolicy.previewLabel', {month}),
                        value: baseTarget,
                        unit: t('page.wardSettings.restLeavePolicy.unit.day'),
                        summary: previewSummary,
                    }}
                    onCheckedChange={(enabled) => patchDraft({enabled})}
                />

                {draft.enabled ? (
                    <>
                        <div className="mt-4 grid gap-4">
                            <SettingPanel eyebrow="01" title={t('page.wardSettings.restLeavePolicy.target.title')}>
                                <div className="grid items-start gap-3 sm:grid-cols-2">
                                    <ChoiceCard
                                        title={t('page.wardSettings.restLeavePolicy.target.weekly.title')}
                                        description={t('page.wardSettings.restLeavePolicy.target.weekly.description')}
                                        selected={draft.targetMode === 'weekly'}
                                        onClick={() => setTargetMode('weekly')}
                                    >
                                        <NumberStepper
                                            value={draft.weeklyOffDays}
                                            min={1}
                                            max={7}
                                            unit={t('page.wardSettings.restLeavePolicy.unit.day')}
                                            ariaLabel={t('page.wardSettings.restLeavePolicy.target.weekly.stepperLabel', {
                                                count: weekCount,
                                            })}
                                            onChange={(nextValue) => patchDraft({weeklyOffDays: nextValue})}
                                        />
                                    </ChoiceCard>
                                    <ChoiceCard
                                        title={t('page.wardSettings.restLeavePolicy.target.fixed.title')}
                                        description={t('page.wardSettings.restLeavePolicy.target.fixed.description')}
                                        selected={draft.targetMode === 'fixed'}
                                        onClick={() => setTargetMode('fixed')}
                                    >
                                        <NumberStepper
                                            value={draft.fixedMonthlyOffDays}
                                            min={0}
                                            max={31}
                                            unit={t('page.wardSettings.restLeavePolicy.unit.day')}
                                            ariaLabel={t('page.wardSettings.restLeavePolicy.target.fixed.stepperLabel')}
                                            onChange={(nextValue) => patchDraft({fixedMonthlyOffDays: nextValue})}
                                        />
                                    </ChoiceCard>
                                </div>
                            </SettingPanel>

                            <div className="grid gap-4">
                                <SettingPanel eyebrow="02" title={t('page.wardSettings.restLeavePolicy.holiday.title')}>
                                    <div className="grid gap-3 sm:grid-cols-2">
                                        <ChoiceCard
                                            title={t('page.wardSettings.restLeavePolicy.holiday.include.title')}
                                            description={t('page.wardSettings.restLeavePolicy.holiday.include.description')}
                                            selected={draft.includeHolidays}
                                            onClick={() => patchDraft({includeHolidays: true})}
                                        />
                                        <ChoiceCard
                                            title={t('page.wardSettings.restLeavePolicy.holiday.exclude.title')}
                                            description={t('page.wardSettings.restLeavePolicy.holiday.exclude.description')}
                                            selected={!draft.includeHolidays}
                                            onClick={() => patchDraft({includeHolidays: false})}
                                        />
                                    </div>
                                </SettingPanel>

                                <SettingPanel eyebrow="03" title={t('page.wardSettings.restLeavePolicy.carryOver.title')}>
                                    <div className="grid gap-3 sm:grid-cols-2">
                                        <ChoiceCard
                                            title={t('page.wardSettings.restLeavePolicy.carryOver.toggle')}
                                            description={t('page.wardSettings.restLeavePolicy.carryOver.toggleHint')}
                                            selected={draft.carryOverEnabled}
                                            onClick={() => patchDraft({carryOverEnabled: true})}
                                        />
                                        <ChoiceCard
                                            title={t('page.wardSettings.restLeavePolicy.carryOver.offTitle')}
                                            description={t('page.wardSettings.restLeavePolicy.carryOver.offHint')}
                                            selected={!draft.carryOverEnabled}
                                            onClick={() => patchDraft({carryOverEnabled: false})}
                                        />
                                    </div>
                                </SettingPanel>
                            </div>

                            <SettingPanel
                                eyebrow="04"
                                title={t('page.wardSettings.restLeavePolicy.countedLeaves.sectionTitle')}
                                description={t('page.wardSettings.restLeavePolicy.countedLeaves.hint')}
                            >
                                {restShiftTypes.length > 0 ? (
                                    <div className="grid w-full grid-cols-[repeat(auto-fill,minmax(112px,1fr))] gap-1.5">
                                        {restShiftTypes.map((shiftType) => {
                                            const selected = countedRestShiftTypeIdSet.has(shiftType.wardShiftTypeId);
                                            const displayName = shiftType.name || shiftType.shortName;
                                            const shortName = shiftType.shortName || displayName;
                                            const baseColor = shiftType.color || '#BFC7D4';

                                            return (
                                                <button
                                                    key={shiftType.wardShiftTypeId}
                                                    type="button"
                                                    aria-pressed={selected}
                                                    title={`${shortName ? `${shortName} ` : ''}${displayName}`.trim()}
                                                    aria-label={t('page.wardSettings.restLeavePolicy.countedLeaves.toggleAria', {
                                                        name: displayName,
                                                    })}
                                                    className={cn(
                                                        'inline-flex min-h-8 w-full min-w-0 items-center justify-start gap-1 overflow-hidden rounded-[5px] border px-1.5 py-1 font-apple text-[13px] whitespace-nowrap transition-[background-color,color,border-color,opacity,transform,filter] duration-150 hover:-translate-y-[1px] hover:brightness-95 focus-visible:outline-2 focus-visible:outline-main-1',
                                                    )}
                                                    style={
                                                        selected
                                                            ? {borderColor: baseColor, backgroundColor: baseColor, color: '#FFFFFF'}
                                                            : {borderColor: 'transparent', backgroundColor: '#ECEFF3', color: '#6B7280'}
                                                    }
                                                    onClick={() => handleToggleCountedRestShiftType(shiftType.wardShiftTypeId)}
                                                >
                                                    <span className="relative inline-flex h-5 w-[22px] shrink-0 items-center justify-center overflow-visible">
                                                        <span
                                                            className={cn(
                                                                'absolute inset-x-0 flex min-w-0 items-center justify-center truncate px-0.5 font-medium transition-all duration-200',
                                                                selected ? 'scale-75 opacity-0' : 'scale-100 opacity-100',
                                                            )}
                                                        >
                                                            {shortName}
                                                        </span>
                                                        <Check
                                                            className={cn(
                                                                'absolute h-4 w-4 transition-all duration-200',
                                                                selected ? 'scale-100 opacity-100' : 'scale-75 opacity-0',
                                                            )}
                                                            strokeWidth={3}
                                                        />
                                                    </span>
                                                    <span className="min-w-0 flex-1 truncate text-left font-normal">{displayName}</span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                ) : (
                                    <p className="rounded-[16px] bg-[#F6F7F9] px-4 py-3 font-apple text-[13px] leading-[20px] [word-break:keep-all] text-gray-3">
                                        {t('page.wardSettings.restLeavePolicy.countedLeaves.empty')}
                                    </p>
                                )}
                            </SettingPanel>
                        </div>
                    </>
                ) : null}

                <div className="mt-4 flex justify-end">
                    <button
                        type="button"
                        disabled={!hasChanges}
                        className={cn(SETTINGS_PRIMARY_BUTTON_CLASS, 'w-full justify-center sm:w-auto')}
                        onClick={handleSave}
                    >
                        {t('page.wardSettings.restLeavePolicy.save')}
                    </button>
                </div>
            </div>
        </div>
    );
}
