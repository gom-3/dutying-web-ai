import {type TReqShiftReceptionSettingsResponse, type TUpdateReqShiftReceptionSettingsDTO} from '@dutying/api/ward';
import {cn} from '@dutying/utils/style';
import {CircleAlert} from 'lucide-react';
import {type ReactNode, useEffect, useState} from 'react';
import toast from 'react-hot-toast';
import {useTypedTranslation} from '@/shared/hook/use-typed-translation';
import PageState from '@/shared/ui/PageState';
import {Switch} from '@/shared/ui/primitives/switch';
import {DEFAULT_REQ_SHIFT_RECEPTION_SETTINGS} from '../model/ward-settings-hook';

export type TRequestReceptionStatus = 'idle' | 'pending' | 'error' | 'success';

const REQUEST_RECEPTION_MIN_DAY = 1;
const REQUEST_RECEPTION_MAX_DAY = 31;
const REQUEST_RECEPTION_DEADLINE_NOTICE_HOURS = 24;
const REQUEST_RECEPTION_START_TIME = '00:00';
const REQUEST_RECEPTION_END_TIME = '23:59';
const REQUEST_RECEPTION_DAYS = Array.from({length: REQUEST_RECEPTION_MAX_DAY}, (_, index) => index + 1);
const SETTINGS_PANEL_CLASS = 'rounded-[16px] bg-white px-5 py-5';
const SETTINGS_RAIL_GRID_CLASS = 'grid grid-cols-[52px_minmax(0,1fr)] gap-3';
const SETTINGS_PRIMARY_BUTTON_CLASS =
    'h-11 rounded-[12px] bg-main-1 px-5 font-apple text-sm font-semibold text-white transition-colors hover:bg-main-1-hover disabled:bg-gray-6 disabled:text-gray-3';

function SettingsStateFrame({children}: {children: ReactNode}) {
    return <div className="flex min-h-[240px] items-center justify-center rounded-[16px] bg-white px-6 py-8">{children}</div>;
}

function SettingPanel({
    eyebrow,
    title,
    description,
    children,
}: {
    eyebrow: string;
    title: string;
    description?: string;
    children: ReactNode;
}) {
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
                            <p className="mt-1 font-apple text-[13px] leading-[20px] [word-break:keep-all] text-gray-3">{description}</p>
                        ) : null}
                    </div>
                    {children}
                </div>
            </div>
        </section>
    );
}

function InlineFieldError({id, children}: {id?: string; children: ReactNode}) {
    return (
        <p
            id={id}
            className="mt-1 flex items-center justify-center gap-1 font-apple text-[11px] leading-none whitespace-nowrap text-red transition-opacity duration-150"
            role="alert"
        >
            <CircleAlert className="h-3 w-3" aria-hidden="true" />
            {children}
        </p>
    );
}

function toRequestReceptionDraft(settings: TReqShiftReceptionSettingsResponse): TUpdateReqShiftReceptionSettingsDTO {
    return {
        enabled: settings.enabled,
        startDay: settings.startDay,
        startTime: REQUEST_RECEPTION_START_TIME,
        endDay: settings.endDay,
        endTime: REQUEST_RECEPTION_END_TIME,
        notifyOnOpen: settings.notifyOnOpen,
        notifyBeforeDeadline: settings.notifyBeforeDeadline,
        notifyBeforeDeadlineHours: settings.notifyBeforeDeadlineHours || REQUEST_RECEPTION_DEADLINE_NOTICE_HOURS,
    };
}

function isValidReceptionDay(day: number) {
    return Number.isInteger(day) && day >= REQUEST_RECEPTION_MIN_DAY && day <= REQUEST_RECEPTION_MAX_DAY;
}

type TRequestReceptionValidationKey =
    | 'page.wardSettings.requestReception.validation.day'
    | 'page.wardSettings.requestReception.validation.range';

function getRequestReceptionErrors(draft: TUpdateReqShiftReceptionSettingsDTO, t: (key: TRequestReceptionValidationKey) => string) {
    if (!draft.enabled) return {};

    const errors: Partial<Record<'startDay' | 'endDay' | 'range', string>> = {};

    if (!isValidReceptionDay(draft.startDay)) {
        errors.startDay = t('page.wardSettings.requestReception.validation.day');
    }

    if (!isValidReceptionDay(draft.endDay)) {
        errors.endDay = t('page.wardSettings.requestReception.validation.day');
    }

    if (!errors.startDay && !errors.endDay && draft.startDay > draft.endDay) {
        errors.range = t('page.wardSettings.requestReception.validation.range');
    }

    return errors;
}

function normalizeRequestReceptionPayload(draft: TUpdateReqShiftReceptionSettingsDTO): TUpdateReqShiftReceptionSettingsDTO {
    return {
        ...draft,
        startTime: REQUEST_RECEPTION_START_TIME,
        endTime: REQUEST_RECEPTION_END_TIME,
        notifyBeforeDeadlineHours: REQUEST_RECEPTION_DEADLINE_NOTICE_HOURS,
    };
}

function RequestReceptionDayRangePicker({
    startDay,
    endDay,
    disabled,
    onChange,
}: {
    startDay: number;
    endDay: number;
    disabled: boolean;
    onChange: (range: {startDay: number; endDay: number}) => void;
}) {
    const {t} = useTypedTranslation();
    const [anchorDay, setAnchorDay] = useState<number | null>(null);
    const daySuffix = t('page.wardSettings.requestReception.daySuffix');

    useEffect(() => {
        if (disabled) {
            setAnchorDay(null);
        }
    }, [disabled]);

    const selectDay = (day: number) => {
        if (disabled) return;

        if (anchorDay === null) {
            setAnchorDay(day);
            onChange({startDay: day, endDay: day});

            return;
        }

        onChange({
            startDay: Math.min(anchorDay, day),
            endDay: Math.max(anchorDay, day),
        });
        setAnchorDay(null);
    };

    return (
        <div className={cn('inline-flex max-w-full flex-col rounded-[16px] bg-[#F6F7F9] p-3', disabled && 'opacity-55')}>
            <div className="mb-3 flex flex-wrap gap-2">
                <span className="rounded-full bg-white px-3 py-1.5 font-apple text-[12px] font-semibold text-gray-3">
                    {t('page.wardSettings.requestReception.startDay')} {startDay}
                    {daySuffix}
                </span>
                <span className="rounded-full bg-white px-3 py-1.5 font-apple text-[12px] font-semibold text-gray-3">
                    {t('page.wardSettings.requestReception.endDay')} {endDay}
                    {daySuffix}
                </span>
            </div>
            <div className="grid grid-cols-7 gap-1">
                {REQUEST_RECEPTION_DAYS.map((day) => {
                    const inRange = day >= startDay && day <= endDay;
                    const boundary = day === startDay || day === endDay;

                    return (
                        <button
                            key={day}
                            type="button"
                            disabled={disabled}
                            aria-pressed={inRange}
                            aria-label={`${day}${daySuffix}`}
                            className={cn(
                                'grid size-9 place-items-center rounded-[10px] font-poppins text-[13px] font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-main-1',
                                boundary
                                    ? 'bg-main-1 text-white'
                                    : inRange
                                      ? 'bg-main-light text-main-1'
                                      : 'bg-white text-gray-3 hover:bg-gray-6/60 hover:text-sub-1',
                                disabled && 'cursor-not-allowed hover:bg-white hover:text-gray-3',
                            )}
                            onClick={() => selectDay(day)}
                        >
                            {day}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}

export function RequestReceptionContent({
    settings,
    status,
    onSave,
    onRetry,
}: {
    settings: TReqShiftReceptionSettingsResponse;
    status: TRequestReceptionStatus;
    onSave: (settings: TUpdateReqShiftReceptionSettingsDTO) => Promise<boolean | void>;
    onRetry: () => void;
}) {
    const {t} = useTypedTranslation();
    const [draft, setDraft] = useState<TUpdateReqShiftReceptionSettingsDTO>(() =>
        toRequestReceptionDraft(settings ?? DEFAULT_REQ_SHIFT_RECEPTION_SETTINGS),
    );
    const [showValidationHighlight, setShowValidationHighlight] = useState(false);

    useEffect(() => {
        setDraft(toRequestReceptionDraft(settings ?? DEFAULT_REQ_SHIFT_RECEPTION_SETTINGS));
        setShowValidationHighlight(false);
    }, [settings]);

    const normalizedDraft = normalizeRequestReceptionPayload(draft);
    const errors = getRequestReceptionErrors(normalizedDraft, t);
    const hasValidationError = Object.values(errors).some(Boolean);
    const summary = t('page.wardSettings.requestReception.summary.enabled', {
        startDay: normalizedDraft.startDay,
        startTime: normalizedDraft.startTime,
        endDay: normalizedDraft.endDay,
        endTime: normalizedDraft.endTime,
    });
    const patchDraft = (patch: Partial<TUpdateReqShiftReceptionSettingsDTO>) => {
        setDraft((prev) => ({...prev, ...patch}));
    };
    const handleSave = async () => {
        setShowValidationHighlight(true);

        if (hasValidationError) return;

        const saved = await onSave(normalizedDraft);

        if (saved === false) return;

        toast.success(t('page.wardSettings.requestReception.toast.saveSuccess'));
    };

    if (status === 'pending') {
        return (
            <SettingsStateFrame>
                <PageState tone="loading" title={t('page.wardSettings.requestReception.loading')} className="py-0" />
            </SettingsStateFrame>
        );
    }

    if (status === 'error') {
        return (
            <SettingsStateFrame>
                <PageState
                    tone="error"
                    title={t('page.wardSettings.requestReception.error')}
                    description={t('page.state.errorDescription')}
                    action={{label: t('page.state.retry'), onClick: () => void onRetry()}}
                    className="py-0"
                />
            </SettingsStateFrame>
        );
    }

    return (
        <div className="w-full">
            <div className={SETTINGS_PANEL_CLASS}>
                <div className="min-w-0">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                        <div className="min-w-0">
                            <p className="font-apple text-[17px] leading-[24px] font-semibold [word-break:keep-all] text-sub-1">
                                {t('page.wardSettings.requestReception.toggleTitle')}
                            </p>
                            <p className="mt-1 max-w-[620px] font-apple text-[13px] leading-[20px] [word-break:keep-all] text-gray-3">
                                {t('page.wardSettings.requestReception.toggleDescription')}
                            </p>
                        </div>
                        <Switch
                            checked={draft.enabled}
                            onCheckedChange={(checked) => patchDraft({enabled: checked})}
                            aria-label={t('page.wardSettings.requestReception.toggleTitle')}
                            className="shrink-0 data-[state=checked]:bg-main-1"
                        />
                    </div>
                </div>
            </div>

            {draft.enabled ? (
                <div className="mt-4 grid gap-4">
                    <SettingPanel eyebrow="01" title={t('page.wardSettings.requestReception.sectionTitle')} description={summary}>
                        <RequestReceptionDayRangePicker
                            startDay={draft.startDay}
                            endDay={draft.endDay}
                            disabled={!draft.enabled}
                            onChange={(range) => patchDraft(range)}
                        />
                        {showValidationHighlight && errors.startDay ? <InlineFieldError>{errors.startDay}</InlineFieldError> : null}
                        {showValidationHighlight && errors.endDay ? <InlineFieldError>{errors.endDay}</InlineFieldError> : null}
                        {showValidationHighlight && errors.range ? <InlineFieldError>{errors.range}</InlineFieldError> : null}
                    </SettingPanel>

                    <SettingPanel eyebrow="02" title={t('page.wardSettings.requestReception.notificationTitle')}>
                        <div className="grid gap-3">
                            <label className="flex flex-col gap-3 rounded-[14px] bg-[#F6F7F9] px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                                <span className="min-w-0">
                                    <span className="block font-apple text-sm font-semibold text-sub-1">
                                        {t('page.wardSettings.requestReception.notifyOnOpen')}
                                    </span>
                                    <span className="mt-0.5 block font-apple text-xs text-gray-3">
                                        {t('page.wardSettings.requestReception.notifyOnOpenDescription')}
                                    </span>
                                </span>
                                <Switch
                                    className="shrink-0 data-[state=checked]:bg-main-1"
                                    checked={draft.notifyOnOpen}
                                    onCheckedChange={(checked) => patchDraft({notifyOnOpen: checked})}
                                />
                            </label>
                            <label className="flex flex-col gap-3 rounded-[14px] bg-[#F6F7F9] px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                                <span className="min-w-0">
                                    <span className="block font-apple text-sm font-semibold text-sub-1">
                                        {t('page.wardSettings.requestReception.notifyBeforeDeadline')}
                                    </span>
                                    <span className="mt-0.5 block font-apple text-xs text-gray-3">
                                        {t('page.wardSettings.requestReception.notifyBeforeDeadlineDescription')}
                                    </span>
                                </span>
                                <Switch
                                    className="shrink-0 data-[state=checked]:bg-main-1"
                                    checked={draft.notifyBeforeDeadline}
                                    onCheckedChange={(checked) => patchDraft({notifyBeforeDeadline: checked})}
                                />
                            </label>
                        </div>
                    </SettingPanel>
                </div>
            ) : null}

            <div className="mt-4 flex justify-stretch sm:justify-end">
                <button
                    type="button"
                    onClick={() => void handleSave()}
                    className={cn(
                        SETTINGS_PRIMARY_BUTTON_CLASS,
                        'w-full sm:w-auto',
                        showValidationHighlight && hasValidationError
                            ? 'bg-gray-6 text-gray-3 hover:bg-gray-6'
                            : 'bg-main-1 text-white hover:bg-main-1-hover',
                    )}
                >
                    {t('page.wardSettings.requestReception.save')}
                </button>
            </div>
        </div>
    );
}
