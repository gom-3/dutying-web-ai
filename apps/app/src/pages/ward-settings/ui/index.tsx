import {
    type TCreateShiftTypeDTO,
    type TReqShiftReceptionSettingsResponse,
    type TUpdateReqShiftReceptionSettingsDTO,
} from '@dutying/api/ward';
import {cn} from '@dutying/utils/style';
import {Check, CircleAlert, Plus, X} from 'lucide-react';
import {type ReactNode, useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {createPortal} from 'react-dom';
import toast from 'react-hot-toast';
import {useNavigate} from 'react-router';
import {Constraints as ShiftConstraintRules} from '@/pages/make-shift/ui/steps/constraints';
import {useTypedTranslation} from '@/shared/hook/use-typed-translation';
import {
    getShiftShortNameValueKey,
    hasInvalidShiftShortNameEntryKey,
    hasInvalidShiftShortNameLengthInput,
    normalizeShiftShortNameInput,
    SHIFT_SHORT_NAME_MAX_LENGTH,
} from '@/shared/lib/shift-short-name';
import PageState from '@/shared/ui/PageState';
import ConfirmActionDialog from '@/shared/ui/ConfirmActionDialog';
import {Input} from '@/shared/ui/primitives/input';
import {Switch} from '@/shared/ui/primitives/switch';
import {formatShiftDuration} from '../model/utils';
import {
    DEFAULT_REQ_SHIFT_RECEPTION_SETTINGS,
    type TWardSettingsActions,
    type TWardSettingsShiftType,
    type TWardSettingsState,
    type TWardSettingsTab,
} from '../model/ward-settings-hook';
import {RestLeavePolicySection} from './rest-leave-policy-section';

type TWardSettingsPageViewProps = {
    state: TWardSettingsState;
    actions: TWardSettingsActions;
};

const TAB_ORDER: TWardSettingsTab[] = ['constraints', 'shiftTypes', 'restLeavePolicy', 'requestReception'];
const SHIFT_COLOR_OPTIONS = [
    '#63C8B8',
    '#F790A4',
    '#5A95F8',
    '#7688B2',
    '#F5A978',
    '#EFCB55',
    '#9AC760',
    '#62CAD8',
    '#AD87F1',
    '#EC84BB',
] as const;
const COLOR_PICKER_WIDTH = 126;
const COLOR_PICKER_VIEWPORT_PADDING = 12;
const SHIFT_TYPE_GRID_COLS = 'grid-cols-[52px_minmax(150px,1.15fr)_82px_112px_minmax(250px,1.5fr)_40px]';
const SHIFT_TYPE_INPUT_SURFACE_CLASS =
    'rounded-[10px] border-0 bg-gray-7 ring-1 ring-transparent transition-[background-color,box-shadow] duration-150 ease-out hover:bg-gray-6/50 focus-visible:border-0 focus-visible:bg-white focus-visible:ring-1 focus-visible:ring-main-1/70';
const SHIFT_TYPE_INPUT_ERROR_CLASS =
    'bg-[#FFF7F8] ring-1 ring-red/45 focus-visible:border-0 focus-visible:bg-white focus-visible:ring-red/70';
const SHIFT_NAME_MAX_LENGTH = 12;
const SHIFT_TIME_FORMAT_REGEX = /^\d{2}:\d{2}$/;
const REQUEST_RECEPTION_MIN_DAY = 1;
const REQUEST_RECEPTION_MAX_DAY = 31;
const REQUEST_RECEPTION_DEADLINE_NOTICE_HOURS = 24;
const REQUEST_RECEPTION_START_TIME = '00:00';
const REQUEST_RECEPTION_END_TIME = '23:59';
const REQUEST_RECEPTION_DAYS = Array.from({length: REQUEST_RECEPTION_MAX_DAY}, (_, index) => index + 1);
const SETTINGS_CONTENT_CLASS = 'mx-auto w-full max-w-[960px]';
const SETTINGS_PANEL_CLASS = 'rounded-[16px] bg-white px-5 py-5';
const SETTINGS_RAIL_GRID_CLASS = 'grid grid-cols-[52px_minmax(0,1fr)] gap-3';
const SETTINGS_PRIMARY_BUTTON_CLASS =
    'h-11 rounded-[12px] bg-main-1 px-5 font-apple text-sm font-semibold text-white transition-colors hover:bg-main-1-hover disabled:bg-gray-6 disabled:text-gray-3';
const SETTINGS_SECONDARY_BUTTON_CLASS =
    'flex h-10 items-center gap-2 rounded-[10px] bg-gray-7 px-4 font-apple text-sm font-semibold text-gray-3 transition-colors hover:bg-gray-6/60 hover:text-sub-1';

type TColorPickerPosition = {
    left: number;
    top: number;
};

function getColorPickerPosition(targetRect: DOMRect): TColorPickerPosition {
    const centeredLeft = targetRect.left + targetRect.width / 2 - COLOR_PICKER_WIDTH / 2;
    const maxLeft = window.innerWidth - COLOR_PICKER_WIDTH - COLOR_PICKER_VIEWPORT_PADDING;

    return {
        left: Math.max(COLOR_PICKER_VIEWPORT_PADDING, Math.min(centeredLeft, maxLeft)),
        top: targetRect.bottom + 8,
    };
}

function isOvernightShiftTime(startTime: string | null | undefined, endTime: string | null | undefined) {
    const startMinutes = parseShiftTimeToMinutes(startTime?.trim() ?? '');
    const endMinutes = parseShiftTimeToMinutes(endTime?.trim() ?? '');

    return startMinutes != null && endMinutes != null && endMinutes < startMinutes;
}

function getShiftTypeClassification(shiftType: TWardSettingsShiftType): TCreateShiftTypeDTO['classification'] {
    if (shiftType.isOff) {
        return shiftType.classification === 'OFF' ? 'OFF' : 'OTHER_LEAVE';
    }

    if (isOvernightShiftTime(shiftType.startTime, shiftType.endTime)) {
        return 'NIGHT';
    }

    if (shiftType.classification === 'OFF' || shiftType.classification === 'OTHER_LEAVE') {
        return 'OTHER_WORK';
    }

    return shiftType.classification;
}

function toShiftTypeUpdateDTO(shiftType: TWardSettingsShiftType): TCreateShiftTypeDTO {
    const shortName = shiftType.shortName.trim().toLocaleUpperCase();
    const name = shiftType.name.trim() || shortName;

    return {
        name,
        shortName,
        startTime: shiftType.startTime ?? '',
        endTime: shiftType.endTime ?? '',
        color: shiftType.color,
        isDefault: shiftType.isDefault,
        isOff: shiftType.isOff,
        isCounted: shiftType.isCounted,
        classification: getShiftTypeClassification(shiftType),
    };
}

function parseShiftTimeToMinutes(value: string) {
    if (!SHIFT_TIME_FORMAT_REGEX.test(value)) return null;

    const [hour, minute] = value.split(':').map(Number);

    if (!Number.isInteger(hour) || !Number.isInteger(minute)) return null;

    if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;

    return hour * 60 + minute;
}

function normalizeShiftTimeInput(value: string) {
    const trimmed = value.trim();

    if (!trimmed) return '';

    if (trimmed.includes(':')) {
        const [rawHour = '', rawMinute = ''] = trimmed.split(':');
        const hourDigits = rawHour.replace(/\D/g, '').slice(0, 2);
        const minuteDigits = rawMinute.replace(/\D/g, '').slice(0, 2);

        if (!hourDigits && !minuteDigits) return '';

        if (!minuteDigits) return hourDigits;

        return `${hourDigits}:${minuteDigits}`;
    }

    const digits = trimmed.replace(/\D/g, '').slice(0, 4);

    if (!digits) return '';

    if (digits.length <= 2) return digits;

    return `${digits.slice(0, 2)}:${digits.slice(2)}`;
}

function toCanonicalShiftTime(value: string) {
    const normalized = normalizeShiftTimeInput(value);
    const fullMinutes = parseShiftTimeToMinutes(normalized);

    if (fullMinutes != null) {
        const hour = String(Math.floor(fullMinutes / 60)).padStart(2, '0');
        const minute = String(fullMinutes % 60).padStart(2, '0');

        return `${hour}:${minute}`;
    }

    const partialMatch = normalized.match(/^(\d{1,2}):(\d{1,2})$/);

    if (!partialMatch) return normalized;

    const hour = Number(partialMatch[1]);
    const minute = Number(partialMatch[2]);

    if (!Number.isInteger(hour) || !Number.isInteger(minute)) return normalized;

    if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return normalized;

    return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
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

function getTabDescriptionKey(tab: TWardSettingsTab) {
    if (tab === 'shiftTypes') return 'page.wardSettings.description.shiftTypes';

    if (tab === 'restLeavePolicy') return 'page.wardSettings.description.restLeavePolicy';

    if (tab === 'requestReception') return 'page.wardSettings.description.requestReception';

    return 'page.wardSettings.description.constraints';
}

function SettingsStateFrame({children}: {children: ReactNode}) {
    return <div className="flex min-h-[240px] items-center justify-center rounded-[16px] bg-white px-6 py-8">{children}</div>;
}

function Tabs({currentTab, onSelect}: {currentTab: TWardSettingsTab; onSelect: (tab: TWardSettingsTab) => void}) {
    const {t} = useTypedTranslation();

    return (
        <div
            className="grid grid-cols-2 gap-1 rounded-[12px] bg-[#F2F4F6] p-1 lg:grid-cols-4"
            role="group"
            aria-label={t('page.wardSettings.title')}
        >
            {TAB_ORDER.map((tab) => {
                const active = currentTab === tab;

                return (
                    <button
                        key={tab}
                        type="button"
                        aria-pressed={active}
                        className={cn(
                            'h-10 rounded-[9px] px-3 font-apple text-sm font-semibold transition-colors',
                            active ? 'bg-white text-sub-1' : 'text-gray-3 hover:text-sub-1',
                        )}
                        onClick={() => onSelect(tab)}
                    >
                        {t(`page.wardSettings.tabs.${tab}`)}
                    </button>
                );
            })}
        </div>
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

function SettingPanel({eyebrow, title, description, children}: {eyebrow: string; title: string; description?: string; children: ReactNode}) {
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

function ShiftTypeTable({
    shiftTypes,
    onCreate,
    onUpdate,
    onDelete,
    onRetry,
    status,
}: {
    shiftTypes: TWardSettingsShiftType[];
    status: TWardSettingsState['shiftTypesStatus'];
    onCreate: (payload: TCreateShiftTypeDTO) => Promise<boolean | void>;
    onUpdate: (shiftType: TWardSettingsShiftType) => Promise<boolean | void>;
    onDelete: (shiftTypeId: number) => Promise<boolean | void>;
    onRetry: () => void;
}) {
    const {t} = useTypedTranslation();
    const [openedColorShiftTypeId, setOpenedColorShiftTypeId] = useState<number | null>(null);
    const [shortNameErrorById, setShortNameErrorById] = useState<Record<number, string>>({});
    const [showValidationHighlight, setShowValidationHighlight] = useState(false);
    const [draftShiftTypes, setDraftShiftTypes] = useState<TWardSettingsShiftType[]>([]);
    const [deletedShiftTypeIds, setDeletedShiftTypeIds] = useState<number[]>([]);
    const [colorPickerPosition, setColorPickerPosition] = useState<TColorPickerPosition | null>(null);
    const openedColorContainerRef = useRef<HTMLDivElement | null>(null);
    const openedColorMenuRef = useRef<HTMLDivElement | null>(null);
    const tempShiftTypeIdRef = useRef(-1);

    useEffect(() => {
        setDraftShiftTypes(shiftTypes);
        setDeletedShiftTypeIds([]);
        setShowValidationHighlight(false);
    }, [shiftTypes]);

    const duplicatedShiftShortNameKeys = useMemo(() => {
        const countByShortNameKey = new Map<string, number>();

        draftShiftTypes.forEach((shiftType) => {
            const normalizedShortNameKey = getShiftShortNameValueKey(shiftType.shortName);

            if (!normalizedShortNameKey) return;

            countByShortNameKey.set(normalizedShortNameKey, (countByShortNameKey.get(normalizedShortNameKey) ?? 0) + 1);
        });

        return new Set(
            Array.from(countByShortNameKey.entries())
                .filter(([, count]) => count > 1)
                .map(([shortNameKey]) => shortNameKey),
        );
    }, [draftShiftTypes]);
    const updateColorPickerPosition = useCallback(() => {
        if (!openedColorContainerRef.current) return;

        setColorPickerPosition(getColorPickerPosition(openedColorContainerRef.current.getBoundingClientRect()));
    }, []);
    const closeColorPicker = useCallback(() => {
        setOpenedColorShiftTypeId(null);
        setColorPickerPosition(null);
    }, []);
    const handleColorButtonClick = (shiftTypeId: number, target: HTMLElement) => {
        if (openedColorShiftTypeId === shiftTypeId) {
            closeColorPicker();

            return;
        }

        setColorPickerPosition(getColorPickerPosition(target.getBoundingClientRect()));
        setOpenedColorShiftTypeId(shiftTypeId);
    };

    useEffect(() => {
        if (!openedColorShiftTypeId) return;

        const handleOutsideClick = (event: MouseEvent) => {
            const target = event.target as Node;

            if (openedColorContainerRef.current?.contains(target)) return;

            if (openedColorMenuRef.current?.contains(target)) return;

            closeColorPicker();
        };

        updateColorPickerPosition();
        document.addEventListener('mousedown', handleOutsideClick);
        window.addEventListener('resize', updateColorPickerPosition);
        window.addEventListener('scroll', updateColorPickerPosition, true);

        return () => {
            document.removeEventListener('mousedown', handleOutsideClick);
            window.removeEventListener('resize', updateColorPickerPosition);
            window.removeEventListener('scroll', updateColorPickerPosition, true);
        };
    }, [closeColorPicker, openedColorShiftTypeId, updateColorPickerPosition]);

    const patchDraft = (shiftTypeId: number, updater: Partial<TWardSettingsShiftType>) => {
        setDraftShiftTypes((prev) => prev.map((item) => (item.wardShiftTypeId === shiftTypeId ? {...item, ...updater} : item)));
    };
    const getShiftShortNameError = (shiftTypeId: number, shortName: string) => {
        if (shortNameErrorById[shiftTypeId]) return shortNameErrorById[shiftTypeId];

        const normalizedShortName = shortName.trim().toLocaleUpperCase();

        if (!normalizedShortName) return t('page.wardSettings.shiftTypes.validation.shortNameRequired');

        if (hasInvalidShiftShortNameEntryKey(normalizedShortName)) {
            return t('page.wardSettings.shiftTypes.validation.shortNameFirstKey');
        }

        if (duplicatedShiftShortNameKeys.has(getShiftShortNameValueKey(normalizedShortName))) {
            return t('page.wardSettings.shiftTypes.validation.shortNameDuplicate');
        }

        return null;
    };
    const getShiftNameError = (name: string) => {
        if (!name.trim()) return t('page.wardSettings.shiftTypes.validation.nameRequired');

        return null;
    };
    const getShiftTimeError = (shiftType: TWardSettingsShiftType) => {
        if (shiftType.isOff) return null;

        const normalizedStartTime = shiftType.startTime?.trim() ?? '';
        const normalizedEndTime = shiftType.endTime?.trim() ?? '';

        if (!normalizedStartTime || !normalizedEndTime) return t('page.wardSettings.shiftTypes.validation.timeRequired');

        const startMinutes = parseShiftTimeToMinutes(normalizedStartTime);
        const endMinutes = parseShiftTimeToMinutes(normalizedEndTime);

        if (startMinutes == null || endMinutes == null) return t('page.wardSettings.shiftTypes.validation.timeFormat');

        if (endMinutes === startMinutes) return t('page.wardSettings.shiftTypes.validation.timeSame');

        return null;
    };
    const hasRowValidationError = (shiftType: TWardSettingsShiftType) =>
        Boolean(
            getShiftNameError(shiftType.name) ??
                getShiftShortNameError(shiftType.wardShiftTypeId, shiftType.shortName) ??
                getShiftTimeError(shiftType),
        );
    const hasAnyValidationError = draftShiftTypes.some(hasRowValidationError);
    const addDraftShiftType = () => {
        const nextTempId = tempShiftTypeIdRef.current--;

        setDraftShiftTypes((prev) => [
            ...prev,
            {
                wardShiftTypeId: nextTempId,
                name: t('page.wardSettings.shiftTypes.newShiftName'),
                shortName: 'W',
                startTime: '09:00',
                endTime: '18:00',
                color: '#63C8B8',
                isDefault: false,
                isOff: false,
                isCounted: true,
                classification: 'OTHER_WORK',
            },
        ]);
    };
    const removeDraftShiftType = (shiftTypeId: number) => {
        setDraftShiftTypes((prev) => prev.filter((shiftType) => shiftType.wardShiftTypeId !== shiftTypeId));

        if (shiftTypeId > 0) {
            setDeletedShiftTypeIds((prev) => (prev.includes(shiftTypeId) ? prev : [...prev, shiftTypeId]));
        }
    };
    const saveAllShiftTypes = async () => {
        setShowValidationHighlight(true);

        if (hasAnyValidationError) {
            const firstInvalid = draftShiftTypes.find(hasRowValidationError);

            if (!firstInvalid) return;

            const firstTargetSelector = (() => {
                if (getShiftNameError(firstInvalid.name)) return `[data-shift-name-input="${firstInvalid.wardShiftTypeId}"]`;

                if (getShiftShortNameError(firstInvalid.wardShiftTypeId, firstInvalid.shortName))
                    return `[data-shift-shortname-input="${firstInvalid.wardShiftTypeId}"]`;

                if (getShiftTimeError(firstInvalid)) return `[data-shift-start-input="${firstInvalid.wardShiftTypeId}"]`;

                return null;
            })();

            if (!firstTargetSelector) return;

            const target = document.querySelector<HTMLInputElement>(firstTargetSelector);

            if (!target) return;

            target.focus();
            target.scrollIntoView({block: 'center', behavior: 'smooth'});

            return;
        }

        for (const shiftTypeId of deletedShiftTypeIds) {
            const saved = await onDelete(shiftTypeId);

            if (saved === false) return;
        }

        for (const shiftType of draftShiftTypes) {
            if (shiftType.wardShiftTypeId < 0) {
                const saved = await onCreate(toShiftTypeUpdateDTO(shiftType));

                if (saved === false) return;

                continue;
            }

            const saved = await onUpdate(shiftType);

            if (saved === false) return;
        }

        toast.success(t('page.wardSettings.shiftTypes.toast.saveSuccess'));
    };

    if (status === 'pending') {
        return (
            <SettingsStateFrame>
                <PageState tone="loading" title={t('page.wardSettings.shiftTypes.loading')} className="py-0" />
            </SettingsStateFrame>
        );
    }

    if (status === 'error') {
        return (
            <SettingsStateFrame>
                <PageState
                    tone="error"
                    title={t('page.wardSettings.shiftTypes.error')}
                    description={t('page.state.errorDescription')}
                    action={{label: t('page.state.retry'), onClick: () => void onRetry()}}
                    className="py-0"
                />
            </SettingsStateFrame>
        );
    }

    if (draftShiftTypes.length === 0) {
        return (
            <SettingsStateFrame>
                <PageState tone="empty" title={t('page.wardSettings.shiftTypes.empty')} className="py-0">
                    <div className="mt-1 flex justify-center">
                        <button type="button" className={SETTINGS_SECONDARY_BUTTON_CLASS} onClick={addDraftShiftType}>
                            <Plus className="h-4 w-4" />
                            {t('page.wardSettings.addShiftType')}
                        </button>
                    </div>
                </PageState>
            </SettingsStateFrame>
        );
    }

    return (
        <div className="w-full">
            <div className="overflow-x-auto">
                <div className="min-w-[860px] rounded-[16px] bg-white p-2">
                    <div
                        className={`grid ${SHIFT_TYPE_GRID_COLS} items-center gap-3 px-3 py-2.5 text-center font-apple text-[12px] font-semibold text-gray-3`}
                    >
                        <span>{t('page.wardSettings.shiftTypes.column.color')}</span>
                        <span>{t('page.wardSettings.shiftTypes.column.name')}</span>
                        <span>{t('page.wardSettings.shiftTypes.column.shortName')}</span>
                        <span>{t('page.wardSettings.shiftTypes.column.type')}</span>
                        <span>{t('page.wardSettings.shiftTypes.column.workTime')}</span>
                        <span />
                    </div>
                    <div className="mt-1">
                        {draftShiftTypes.map((shiftType) => (
                            <div key={shiftType.wardShiftTypeId} className={`grid ${SHIFT_TYPE_GRID_COLS} items-start gap-3 px-3 py-3.5`}>
                                <div
                                    className="relative flex justify-center self-start"
                                    ref={openedColorShiftTypeId === shiftType.wardShiftTypeId ? openedColorContainerRef : null}
                                >
                                    <button
                                        type="button"
                                        aria-label={t('page.wardSettings.shiftTypes.colorSelectAria', {
                                            name: shiftType.name || shiftType.shortName || t('page.wardSettings.type.work'),
                                        })}
                                        className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-[10px] bg-[#F1F3F5] transition-colors hover:bg-[#E9ECEF]"
                                        onClick={(event) => handleColorButtonClick(shiftType.wardShiftTypeId, event.currentTarget)}
                                    >
                                        <span
                                            className="h-6 w-6 rounded-[7px] ring-1 ring-black/10"
                                            style={{backgroundColor: shiftType.color}}
                                        />
                                    </button>
                                    {openedColorShiftTypeId === shiftType.wardShiftTypeId &&
                                    colorPickerPosition &&
                                    typeof document !== 'undefined'
                                        ? createPortal(
                                              <div
                                                  ref={openedColorMenuRef}
                                                  style={{
                                                      left: `${colorPickerPosition.left}px`,
                                                      top: `${colorPickerPosition.top}px`,
                                                  }}
                                                  className="fixed z-[1000] grid w-[126px] grid-cols-5 gap-2 rounded-[10px] bg-white p-2 shadow-[0px_10px_28px_rgba(95,100,135,0.16)]"
                                              >
                                                  {SHIFT_COLOR_OPTIONS.map((color) => {
                                                      const isSelected = shiftType.color.toLowerCase() === color.toLowerCase();

                                                      return (
                                                          <button
                                                              key={color}
                                                              type="button"
                                                              aria-label={t('page.wardSettings.shiftTypes.colorOptionAria', {color})}
                                                              className="flex h-5 w-5 items-center justify-center rounded-[6px] border border-black/20 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.35)]"
                                                              style={{backgroundColor: color}}
                                                              onClick={() => {
                                                                  patchDraft(shiftType.wardShiftTypeId, {color});
                                                                  closeColorPicker();
                                                              }}
                                                          >
                                                              {isSelected ? <Check className="h-3.5 w-3.5 text-white" /> : null}
                                                          </button>
                                                      );
                                                  })}
                                              </div>,
                                              document.body,
                                          )
                                        : null}
                                </div>
                                <div className="flex flex-col gap-1">
                                    <Input
                                        data-shift-name-input={shiftType.wardShiftTypeId}
                                        value={shiftType.name}
                                        maxLength={SHIFT_NAME_MAX_LENGTH}
                                        onChange={(event) => patchDraft(shiftType.wardShiftTypeId, {name: event.target.value})}
                                        variant="foundation"
                                        fieldSize="lg"
                                        aria-invalid={showValidationHighlight && Boolean(getShiftNameError(shiftType.name))}
                                        aria-describedby={
                                            showValidationHighlight && getShiftNameError(shiftType.name)
                                                ? `shift-name-error-${shiftType.wardShiftTypeId}`
                                                : undefined
                                        }
                                        className={cn(
                                            `h-10 w-full px-3 text-center font-apple text-[15px] ${SHIFT_TYPE_INPUT_SURFACE_CLASS}`,
                                            showValidationHighlight && getShiftNameError(shiftType.name)
                                                ? SHIFT_TYPE_INPUT_ERROR_CLASS
                                                : '',
                                        )}
                                        placeholder={t('page.wardSettings.shiftTypes.column.name')}
                                    />
                                    {showValidationHighlight && getShiftNameError(shiftType.name) ? (
                                        <InlineFieldError id={`shift-name-error-${shiftType.wardShiftTypeId}`}>
                                            {getShiftNameError(shiftType.name)}
                                        </InlineFieldError>
                                    ) : null}
                                </div>
                                <div className="flex flex-col items-center gap-1">
                                    <Input
                                        data-shift-shortname-input={shiftType.wardShiftTypeId}
                                        value={shiftType.shortName}
                                        maxLength={SHIFT_SHORT_NAME_MAX_LENGTH}
                                        onChange={(event) => {
                                            const normalizedShortName = normalizeShiftShortNameInput(event.target.value);

                                            if (hasInvalidShiftShortNameLengthInput(event.target.value)) {
                                                setShortNameErrorById((prev) => ({
                                                    ...prev,
                                                    [shiftType.wardShiftTypeId]: t(
                                                        'page.wardSettings.shiftTypes.validation.shortNameLength',
                                                    ),
                                                }));
                                            } else if (hasInvalidShiftShortNameEntryKey(normalizedShortName)) {
                                                setShortNameErrorById((prev) => ({
                                                    ...prev,
                                                    [shiftType.wardShiftTypeId]: t(
                                                        'page.wardSettings.shiftTypes.validation.shortNameFirstKey',
                                                    ),
                                                }));
                                            } else {
                                                setShortNameErrorById((prev) => ({...prev, [shiftType.wardShiftTypeId]: ''}));
                                            }

                                            patchDraft(shiftType.wardShiftTypeId, {
                                                shortName: normalizedShortName,
                                            });
                                        }}
                                        variant="foundation"
                                        fieldSize="lg"
                                        aria-invalid={
                                            showValidationHighlight &&
                                            Boolean(getShiftShortNameError(shiftType.wardShiftTypeId, shiftType.shortName))
                                        }
                                        aria-describedby={
                                            showValidationHighlight &&
                                            getShiftShortNameError(shiftType.wardShiftTypeId, shiftType.shortName)
                                                ? `shift-short-name-error-${shiftType.wardShiftTypeId}`
                                                : undefined
                                        }
                                        className={cn(
                                            `h-10 w-16 px-1 text-center font-apple text-[15px] ${SHIFT_TYPE_INPUT_SURFACE_CLASS}`,
                                            showValidationHighlight &&
                                                getShiftShortNameError(shiftType.wardShiftTypeId, shiftType.shortName)
                                                ? SHIFT_TYPE_INPUT_ERROR_CLASS
                                                : '',
                                        )}
                                        placeholder="-"
                                    />
                                    {showValidationHighlight && getShiftShortNameError(shiftType.wardShiftTypeId, shiftType.shortName) ? (
                                        <InlineFieldError id={`shift-short-name-error-${shiftType.wardShiftTypeId}`}>
                                            {getShiftShortNameError(shiftType.wardShiftTypeId, shiftType.shortName)}
                                        </InlineFieldError>
                                    ) : null}
                                </div>
                                <div className="mx-auto flex h-10 w-full max-w-[112px] items-center rounded-[10px] bg-[#F1F3F5] p-1">
                                    <button
                                        type="button"
                                        className={cn(
                                            'h-full flex-1 rounded-[8px] font-apple text-[13px] leading-none font-semibold transition-colors',
                                            !shiftType.isOff ? 'bg-white text-sub-1' : 'bg-transparent text-gray-3 hover:text-sub-1',
                                        )}
                                        onClick={() => {
                                            if (!shiftType.isOff) return;

                                            const next = {
                                                ...shiftType,
                                                isOff: false,
                                                classification: 'OTHER_WORK' as const,
                                                startTime: shiftType.startTime || '09:00',
                                                endTime: shiftType.endTime || '18:00',
                                            };

                                            patchDraft(shiftType.wardShiftTypeId, next);
                                        }}
                                    >
                                        {t('page.wardSettings.type.work')}
                                    </button>
                                    <button
                                        type="button"
                                        className={cn(
                                            'h-full flex-1 rounded-[8px] font-apple text-[13px] leading-none font-semibold transition-colors',
                                            shiftType.isOff ? 'bg-white text-sub-1' : 'bg-transparent text-gray-3 hover:text-sub-1',
                                        )}
                                        onClick={() => {
                                            if (shiftType.isOff) return;

                                            const next = {
                                                ...shiftType,
                                                isOff: true,
                                                classification: 'OTHER_LEAVE' as const,
                                                startTime: '',
                                                endTime: '',
                                            };

                                            patchDraft(shiftType.wardShiftTypeId, next);
                                        }}
                                    >
                                        {t('page.wardSettings.type.leave')}
                                    </button>
                                </div>
                                <div className="flex self-start">
                                    <div className="flex items-start">
                                        <div className="flex flex-col gap-1">
                                            <div className="flex items-center gap-2">
                                                <Input
                                                    data-shift-start-input={shiftType.wardShiftTypeId}
                                                    value={shiftType.isOff ? '-' : (shiftType.startTime ?? '')}
                                                    disabled={shiftType.isOff}
                                                    onChange={(event) =>
                                                        patchDraft(shiftType.wardShiftTypeId, {
                                                            startTime: normalizeShiftTimeInput(event.target.value),
                                                        })
                                                    }
                                                    onBlur={(event) => {
                                                        patchDraft(shiftType.wardShiftTypeId, {
                                                            startTime: toCanonicalShiftTime(event.target.value),
                                                        });
                                                    }}
                                                    variant="foundation"
                                                    fieldSize="lg"
                                                    aria-invalid={showValidationHighlight && Boolean(getShiftTimeError(shiftType))}
                                                    aria-describedby={
                                                        showValidationHighlight && getShiftTimeError(shiftType)
                                                            ? `shift-time-error-${shiftType.wardShiftTypeId}`
                                                            : undefined
                                                    }
                                                    className={cn(
                                                        `h-10 text-center font-poppins text-[15px] ${SHIFT_TYPE_INPUT_SURFACE_CLASS}`,
                                                        showValidationHighlight && getShiftTimeError(shiftType)
                                                            ? SHIFT_TYPE_INPUT_ERROR_CLASS
                                                            : '',
                                                    )}
                                                    placeholder="07:00"
                                                />
                                                <span className="font-poppins text-[15px] text-gray-3">~</span>
                                                <Input
                                                    data-shift-end-input={shiftType.wardShiftTypeId}
                                                    value={shiftType.isOff ? '-' : (shiftType.endTime ?? '')}
                                                    disabled={shiftType.isOff}
                                                    onChange={(event) =>
                                                        patchDraft(shiftType.wardShiftTypeId, {
                                                            endTime: normalizeShiftTimeInput(event.target.value),
                                                        })
                                                    }
                                                    onBlur={(event) => {
                                                        patchDraft(shiftType.wardShiftTypeId, {
                                                            endTime: toCanonicalShiftTime(event.target.value),
                                                        });
                                                    }}
                                                    variant="foundation"
                                                    fieldSize="lg"
                                                    aria-invalid={showValidationHighlight && Boolean(getShiftTimeError(shiftType))}
                                                    aria-describedby={
                                                        showValidationHighlight && getShiftTimeError(shiftType)
                                                            ? `shift-time-error-${shiftType.wardShiftTypeId}`
                                                            : undefined
                                                    }
                                                    className={cn(
                                                        `h-10 text-center font-poppins text-[15px] ${SHIFT_TYPE_INPUT_SURFACE_CLASS}`,
                                                        showValidationHighlight && getShiftTimeError(shiftType)
                                                            ? SHIFT_TYPE_INPUT_ERROR_CLASS
                                                            : '',
                                                    )}
                                                    placeholder="15:00"
                                                />
                                            </div>
                                            {showValidationHighlight && getShiftTimeError(shiftType) ? (
                                                <InlineFieldError id={`shift-time-error-${shiftType.wardShiftTypeId}`}>
                                                    {getShiftTimeError(shiftType)}
                                                </InlineFieldError>
                                            ) : null}
                                        </div>
                                        <span className="ml-2 flex h-10 min-w-[48px] items-center rounded-[8px] bg-[#F6F7F9] px-2 font-poppins text-[11px] leading-none whitespace-nowrap text-gray-4">
                                            {shiftType.isOff ? '' : formatShiftDuration(shiftType.startTime, shiftType.endTime)}
                                        </span>
                                    </div>
                                </div>
                                {shiftType.isDefault ? (
                                    <div className="h-10 w-10" aria-hidden="true" />
                                ) : (
                                    <button
                                        type="button"
                                        aria-label={t('page.wardSettings.shiftTypes.deleteAria', {
                                            name: shiftType.name || shiftType.shortName || t('page.wardSettings.type.work'),
                                        })}
                                        onClick={() => removeDraftShiftType(shiftType.wardShiftTypeId)}
                                        className="flex h-10 w-10 items-center justify-center rounded-[8px] text-gray-4 transition-colors hover:bg-[#F1F3F5] hover:text-sub-1"
                                    >
                                        <X className="h-4 w-4" />
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>
                    <div className="flex justify-center px-3 pt-3 pb-2">
                        <button
                            type="button"
                            className="group flex items-center gap-2 font-apple text-sm font-medium text-gray-3 transition-colors hover:text-sub-2.5"
                            onClick={addDraftShiftType}
                        >
                            <span className="flex h-[19px] w-[19px] items-center justify-center rounded-full bg-gray-3 transition-colors group-hover:bg-sub-2.5">
                                <Plus className="h-[11px] w-[11px] text-white" />
                            </span>
                            {t('page.wardSettings.shiftTypes.add')}
                        </button>
                    </div>
                </div>
            </div>

            <div className="mt-4 flex justify-end">
                <button
                    type="button"
                    onClick={saveAllShiftTypes}
                    className={cn(
                        SETTINGS_PRIMARY_BUTTON_CLASS,
                        'w-full sm:w-auto',
                        showValidationHighlight && hasAnyValidationError
                            ? 'bg-gray-6 text-gray-3 hover:bg-gray-6'
                            : 'bg-main-1 text-white hover:bg-main-1-hover',
                    )}
                >
                    {t('page.wardSettings.shiftTypes.save')}
                </button>
            </div>
        </div>
    );
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

function RequestReceptionContent({
    settings,
    status,
    onSave,
    onRetry,
}: {
    settings: TReqShiftReceptionSettingsResponse;
    status: TWardSettingsState['requestReceptionStatus'];
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
                <div className={SETTINGS_RAIL_GRID_CLASS}>
                    <div aria-hidden="true" />
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

function ConstraintsContent({
    state,
    actions,
}: {
    state: Pick<TWardSettingsState, 'wardId' | 'shiftTeams' | 'shiftTeamsStatus' | 'currentShiftTeamId'>;
    actions: Pick<TWardSettingsActions, 'selectShiftTeam' | 'retryShiftTeams'>;
}) {
    const {t} = useTypedTranslation();
    const today = useMemo(() => new Date(), []);
    const year = today.getFullYear();
    const month = today.getMonth() + 1;

    if (state.shiftTeamsStatus === 'pending') {
        return (
            <SettingsStateFrame>
                <PageState tone="loading" title={t('page.wardSettings.constraints.loading')} className="py-0" />
            </SettingsStateFrame>
        );
    }

    if (state.shiftTeamsStatus === 'error') {
        return (
            <SettingsStateFrame>
                <PageState
                    tone="error"
                    title={t('page.wardSettings.constraints.error')}
                    description={t('page.state.errorDescription')}
                    action={{label: t('page.state.retry'), onClick: () => void actions.retryShiftTeams()}}
                    className="py-0"
                />
            </SettingsStateFrame>
        );
    }

    if (state.shiftTeams.length === 0) {
        return (
            <SettingsStateFrame>
                <PageState
                    tone="empty"
                    title={t('page.wardSettings.constraints.noTeamsTitle')}
                    description={t('page.wardSettings.constraints.noTeamsDescription')}
                    className="py-0"
                />
            </SettingsStateFrame>
        );
    }

    const shouldShowTeamSwitcher = state.shiftTeams.length > 1;

    return (
        <div className="w-full">
            {shouldShowTeamSwitcher ? (
                <div className="mb-4 flex flex-col gap-4 rounded-[16px] bg-white px-5 py-4 md:flex-row md:items-center md:justify-between">
                    <div>
                        <p className="font-apple text-sm font-semibold text-sub-1">{t('page.wardSettings.constraints.teamLabel')}</p>
                        <p className="mt-1 font-apple text-sm text-gray-3">{t('page.wardSettings.constraints.teamDescription')}</p>
                    </div>

                    <div className="max-w-full rounded-[12px] bg-[#F2F4F6] p-1">
                        <div className="scrollbar-hide flex max-w-full gap-1 overflow-x-auto whitespace-nowrap">
                            {state.shiftTeams.map((team) => {
                                const active = team.shiftTeamId === state.currentShiftTeamId;

                                return (
                                    <button
                                        key={team.shiftTeamId}
                                        type="button"
                                        className={cn(
                                            'rounded-[9px] px-3 py-2 font-apple text-sm font-semibold transition-colors',
                                            active ? 'bg-white text-sub-1' : 'text-gray-3 hover:text-sub-1',
                                        )}
                                        onClick={() => actions.selectShiftTeam(team.shiftTeamId)}
                                    >
                                        {team.name}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </div>
            ) : null}

            <ShiftConstraintRules
                wardId={state.wardId}
                shiftTeamId={state.currentShiftTeamId}
                shiftTeams={state.shiftTeams}
                year={year}
                month={month}
                variant="settings"
            />
        </div>
    );
}

export function WardSettingsPageView({state, actions}: TWardSettingsPageViewProps) {
    const {t} = useTypedTranslation();
    const navigate = useNavigate();
    const [hasUnsavedRestLeavePolicyChanges, setHasUnsavedRestLeavePolicyChanges] = useState(false);
    const [pendingTab, setPendingTab] = useState<TWardSettingsTab | null>(null);
    const [pendingNavigationPath, setPendingNavigationPath] = useState<string | null>(null);
    const unsavedDialogOpen = pendingTab !== null || pendingNavigationPath !== null;
    const handleSelectTab = useCallback(
        (tab: TWardSettingsTab) => {
            if (tab === state.currentTab) return;

            if (state.currentTab === 'restLeavePolicy' && hasUnsavedRestLeavePolicyChanges) {
                setPendingTab(tab);

                return;
            }

            actions.selectTab(tab);
        },
        [actions, hasUnsavedRestLeavePolicyChanges, state.currentTab],
    );
    useEffect(() => {
        if (!hasUnsavedRestLeavePolicyChanges || state.currentTab !== 'restLeavePolicy') return;

        const handleBeforeUnload = (event: BeforeUnloadEvent) => {
            event.preventDefault();
            event.returnValue = '';
        };

        window.addEventListener('beforeunload', handleBeforeUnload);

        return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }, [hasUnsavedRestLeavePolicyChanges, state.currentTab]);

    useEffect(() => {
        if (!hasUnsavedRestLeavePolicyChanges || state.currentTab !== 'restLeavePolicy') return;

        const handleNavigationClick = (event: MouseEvent) => {
            if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

            const target = event.target instanceof Element ? event.target.closest<HTMLElement>('[data-navigation-path]') : null;
            const navigationPath = target?.dataset.navigationPath;

            if (!navigationPath || navigationPath === window.location.pathname) return;

            event.preventDefault();
            event.stopPropagation();
            setPendingNavigationPath(navigationPath);
        };

        document.addEventListener('click', handleNavigationClick, true);

        return () => document.removeEventListener('click', handleNavigationClick, true);
    }, [hasUnsavedRestLeavePolicyChanges, state.currentTab]);

    const closeUnsavedDialog = () => {
        setPendingTab(null);
        setPendingNavigationPath(null);
    };
    const confirmDiscardUnsavedChanges = () => {
        setHasUnsavedRestLeavePolicyChanges(false);

        if (pendingTab !== null) {
            const nextTab = pendingTab;

            setPendingTab(null);
            actions.selectTab(nextTab);

            return;
        }

        if (pendingNavigationPath !== null) {
            const nextPath = pendingNavigationPath;

            setPendingNavigationPath(null);
            navigate(nextPath);
            return;
        }
    };

    return (
        <div className="mx-auto flex min-h-screen w-full max-w-[1040px] flex-col px-4 py-8">
            <div className={cn(SETTINGS_CONTENT_CLASS, 'flex flex-col gap-4')}>
                <div>
                    <h1 className="font-apple text-[30px] font-semibold text-sub-1">{t('page.wardSettings.title')}</h1>
                    <p className="mt-1 font-apple text-sm text-gray-3">{t(getTabDescriptionKey(state.currentTab))}</p>
                </div>

                <Tabs currentTab={state.currentTab} onSelect={handleSelectTab} />
            </div>

            <div className={cn(SETTINGS_CONTENT_CLASS, 'mt-6')}>
                {state.currentTab === 'shiftTypes' ? (
                    <ShiftTypeTable
                        shiftTypes={state.shiftTypes}
                        status={state.shiftTypesStatus}
                        onCreate={actions.addShiftType}
                        onUpdate={(shiftType) => actions.updateShiftType(shiftType.wardShiftTypeId, toShiftTypeUpdateDTO(shiftType))}
                        onDelete={actions.deleteShiftType}
                        onRetry={actions.retryShiftTypes}
                    />
                ) : state.currentTab === 'restLeavePolicy' ? (
                    <RestLeavePolicySection
                        wardId={state.wardId}
                        shiftTypes={state.shiftTypes}
                        onDirtyChange={setHasUnsavedRestLeavePolicyChanges}
                    />
                ) : state.currentTab === 'requestReception' ? (
                    <RequestReceptionContent
                        settings={state.requestReceptionSettings}
                        status={state.requestReceptionStatus}
                        onSave={actions.updateRequestReceptionSettings}
                        onRetry={actions.retryRequestReceptionSettings}
                    />
                ) : (
                    <ConstraintsContent
                        state={{
                            wardId: state.wardId,
                            shiftTeams: state.shiftTeams,
                            shiftTeamsStatus: state.shiftTeamsStatus,
                            currentShiftTeamId: state.currentShiftTeamId,
                        }}
                        actions={{
                            selectShiftTeam: actions.selectShiftTeam,
                            retryShiftTeams: actions.retryShiftTeams,
                        }}
                    />
                )}
            </div>
            <ConfirmActionDialog
                open={unsavedDialogOpen}
                title={t('page.member.modal.unsavedExitTitle')}
                description={t('page.member.modal.unsavedExitDescription')}
                confirmLabel={t('page.member.common.discard')}
                tone="danger"
                onClose={closeUnsavedDialog}
                onConfirm={confirmDiscardUnsavedChanges}
            />
        </div>
    );
}
