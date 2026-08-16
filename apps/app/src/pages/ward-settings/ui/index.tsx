import {type TCreateShiftTypeDTO} from '@dutying/api/ward';
import {cn} from '@dutying/utils/style';
import {DragDropContext, Draggable, Droppable, type DropResult} from '@hello-pangea/dnd';
import {Check, CircleAlert, Plus, X} from 'lucide-react';
import {type ReactNode, useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {createPortal} from 'react-dom';
import toast from 'react-hot-toast';
import {useNavigate} from 'react-router';
import useAuth from '@/features/auth';
import {isWardAdminAccessToken} from '@/features/auth/model/admin-token';
import {Constraints as ShiftConstraintRules} from '@/pages/make-shift/ui/steps/constraints';
import {SixDotsIcon} from '@/shared/assets/svg';
import {useTypedTranslation} from '@/shared/hook/use-typed-translation';
import {
    getDefaultTimeRangeForRotation,
    getRequiredRotationClassifications,
    getSelectableClassificationsForWardMode,
    getSelectableRotationSystemsForClassification,
    getSelectableShiftRotationSystemsForWardMode,
    type TSelectableShiftRotationSystem,
} from '@/shared/lib/shift-rotation-selection';
import {
    getShiftShortNameEntryKey,
    hasInvalidShiftShortNameEntryKey,
    hasInvalidShiftShortNameLengthInput,
    normalizeShiftShortNameInput,
    SHIFT_SHORT_NAME_MAX_LENGTH,
} from '@/shared/lib/shift-short-name';
import ConfirmActionDialog from '@/shared/ui/ConfirmActionDialog';
import PageState from '@/shared/ui/PageState';
import {Input} from '@/shared/ui/primitives/input';
import ShiftClassificationDropdown from '@/shared/ui/ShiftClassificationDropdown';
import {NotificationBell} from '@/widgets/notifications/notification-bell';
import {
    inferWardRotationMode,
    resolveWardShiftRotationSystem as getShiftTypeRotationSystem,
    type TWardRotationMode,
} from '../model/shift-type-rotation';
import {formatShiftDuration} from '../model/utils';
import {
    type TWardSettingsActions,
    type TWardSettingsShiftType,
    type TWardSettingsState,
    type TWardSettingsTab,
} from '../model/ward-settings-hook';
import {RequestReceptionContent} from './request-reception-content';
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
    '#18B69B',
    '#EF4F73',
    '#3B82F6',
    '#F08A24',
    '#5B6470',
] as const;
const COLOR_PICKER_WIDTH = 148;
const COLOR_PICKER_VIEWPORT_PADDING = 12;
const SHIFT_TYPE_GRID_COLS_WITH_ROTATION = 'grid-cols-[32px_minmax(110px,0.95fr)_72px_92px_170px_minmax(220px,1.35fr)_48px_40px]';
const SHIFT_TYPE_GRID_COLS_WITHOUT_ROTATION = 'grid-cols-[32px_minmax(110px,0.95fr)_72px_170px_minmax(220px,1.35fr)_48px_40px]';
const SHIFT_TYPE_INPUT_SURFACE_CLASS =
    'rounded-[10px] border-0 bg-gray-7 ring-1 ring-transparent transition-[background-color,box-shadow] duration-150 ease-out hover:bg-gray-6/50 focus-visible:border-0 focus-visible:bg-white focus-visible:ring-1 focus-visible:ring-main-1/70';
const SHIFT_TYPE_INPUT_ERROR_CLASS =
    'bg-[#FFF7F8] ring-1 ring-red/45 focus-visible:border-0 focus-visible:bg-white focus-visible:ring-red/70';
const SHIFT_NAME_MAX_LENGTH = 12;
const SHIFT_CLASSIFICATION_OPTIONS = [
    {value: 'DAY', labelKey: 'feature.createShiftModal.classification.day'},
    {value: 'EVENING', labelKey: 'feature.createShiftModal.classification.evening'},
    {value: 'NIGHT', labelKey: 'feature.createShiftModal.classification.night'},
    {value: 'NIGHT_CONTINUATION', labelKey: 'feature.createShiftModal.classification.nightContinuation'},
    {value: 'OFF', labelKey: 'feature.createShiftModal.classification.off'},
    {value: 'OTHER_WORK', labelKey: 'feature.createShiftModal.classification.otherWork'},
    {value: 'ANNUAL_LEAVE', labelKey: 'feature.createShiftModal.classification.annualLeave'},
    {value: 'OTHER_LEAVE', labelKey: 'feature.createShiftModal.classification.otherLeave'},
] as const;
const SHIFT_TIME_FORMAT_REGEX = /^\d{2}:\d{2}$/;
const SETTINGS_CONTENT_CLASS = 'mx-auto w-full max-w-[960px]';
const SETTINGS_PRIMARY_BUTTON_CLASS =
    'h-11 rounded-[12px] bg-main-1 px-5 font-apple text-sm font-semibold text-white transition-colors hover:bg-main-1-hover disabled:bg-gray-6 disabled:text-gray-3';

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
        if (
            shiftType.classification === 'OFF' ||
            shiftType.classification === 'ANNUAL_LEAVE' ||
            shiftType.classification === 'OTHER_LEAVE'
        ) {
            return shiftType.classification;
        }

        return 'OTHER_LEAVE';
    }

    if (shiftType.classification) return shiftType.classification;

    // Old records may not have a classification yet. Keep those records editable
    // until the user explicitly chooses a meaning in the settings screen.
    if (shiftType.isOff) return 'OTHER_LEAVE';

    return isOvernightShiftTime(shiftType.startTime, shiftType.endTime) ? 'NIGHT' : 'OTHER_WORK';
}

function isOffShiftType(shiftType: TWardSettingsShiftType) {
    const classification = getShiftTypeClassification(shiftType);

    return classification === 'OFF' || classification === 'ANNUAL_LEAVE' || classification === 'OTHER_LEAVE';
}

function isUsedShiftShortNameLocked(shiftType: TWardSettingsShiftType) {
    return shiftType.isUsed === true && getShiftTypeClassification(shiftType) === 'OTHER_WORK';
}

function getAvailableShiftClassificationOptions(rotationMode: TWardRotationMode) {
    const selectableClassifications = getSelectableClassificationsForWardMode(rotationMode);

    return SHIFT_CLASSIFICATION_OPTIONS.filter((option) =>
        selectableClassifications.some((classification) => classification === option.value),
    );
}

function getAvailableShiftRotationSystems(shiftType: TWardSettingsShiftType, rotationMode: TWardRotationMode) {
    if (rotationMode === 'MIXED') return getSelectableShiftRotationSystemsForWardMode(rotationMode);

    return getSelectableRotationSystemsForClassification(rotationMode, getShiftTypeClassification(shiftType));
}

function hasFixedNoneRotationSystem(shiftType: TWardSettingsShiftType) {
    const classification = getShiftTypeClassification(shiftType);

    return (
        classification === 'OFF' || classification === 'OTHER_WORK' || classification === 'ANNUAL_LEAVE' || classification === 'OTHER_LEAVE'
    );
}

function getSelectedShiftTypeRotationSystem(shiftType: TWardSettingsShiftType): TSelectableShiftRotationSystem {
    if (hasFixedNoneRotationSystem(shiftType)) return 'NONE';

    return shiftType.rotationSystem ?? getShiftTypeRotationSystem(shiftType);
}

function compareShiftTypesForSettings(a: TWardSettingsShiftType, b: TWardSettingsShiftType) {
    const getSettingsOrder = (shiftType: TWardSettingsShiftType) => {
        const rotationSystem = getShiftTypeRotationSystem(shiftType);
        const classification = getShiftTypeClassification(shiftType);

        if (rotationSystem === 'THREE') return 0;

        if (rotationSystem === 'TWO') return 1;

        if (classification === 'OFF') return 2;

        if (classification === 'OTHER_WORK') return 3;

        if (classification === 'ANNUAL_LEAVE') return 4;

        if (classification === 'OTHER_LEAVE') return 5;

        // DAY/EVENING/NIGHT 분류여도 교대제가 NONE이면 사용자 정의 기타근무다.
        return 3;
    };
    const settingsOrder = getSettingsOrder(a) - getSettingsOrder(b);

    if (settingsOrder !== 0) return settingsOrder;

    // 동일 그룹의 사용자 정의 근무는 현재 배열 순서를 유지한다. 따라서 드래그 정렬도 보존된다.
    return 0;
}

function toShiftTypeUpdateDTO(shiftType: TWardSettingsShiftType): TCreateShiftTypeDTO {
    const shortName = normalizeShiftShortNameInput(shiftType.shortName.trim());
    const name = shiftType.name.trim() || shortName;
    const classification = getShiftTypeClassification(shiftType);
    const isOff = classification === 'OFF' || classification === 'ANNUAL_LEAVE' || classification === 'OTHER_LEAVE';

    return {
        name,
        shortName,
        startTime: isOff ? '' : (shiftType.startTime ?? ''),
        endTime: isOff ? '' : (shiftType.endTime ?? ''),
        color: shiftType.color,
        isDefault: shiftType.isDefault,
        isOff,
        isCounted: isOff ? false : shiftType.isCounted,
        classification,
        rotationSystem: isOff ? 'NONE' : getShiftTypeRotationSystem(shiftType),
        paidMinutes: isOff ? null : shiftType.paidMinutes,
        isActive: shiftType.isActive !== false,
        displayOrder: shiftType.displayOrder,
    };
}

function areShiftTypePayloadsEqual(left: TCreateShiftTypeDTO, right: TCreateShiftTypeDTO) {
    return (
        left.name === right.name &&
        left.shortName === right.shortName &&
        left.startTime === right.startTime &&
        left.endTime === right.endTime &&
        left.color.toLocaleUpperCase() === right.color.toLocaleUpperCase() &&
        left.isDefault === right.isDefault &&
        left.isOff === right.isOff &&
        left.isCounted === right.isCounted &&
        left.classification === right.classification &&
        left.rotationSystem === right.rotationSystem &&
        (left.paidMinutes ?? null) === (right.paidMinutes ?? null) &&
        (left.isActive ?? true) === (right.isActive ?? true) &&
        (left.displayOrder ?? null) === (right.displayOrder ?? null)
    );
}

function hasPersistedShiftTypeContractDrift(persisted: TWardSettingsShiftType, desired: TCreateShiftTypeDTO) {
    return (
        persisted.rotationSystem !== desired.rotationSystem ||
        normalizeShiftShortNameInput(persisted.shortName) !== desired.shortName ||
        (persisted.paidMinutes ?? null) !== (desired.paidMinutes ?? null)
    );
}

function withShiftTypeDisplayOrders(shiftTypes: TWardSettingsShiftType[]) {
    return shiftTypes.map((shiftType, index) => ({...shiftType, displayOrder: index + 1}));
}

function withInitialShiftTypeDisplayOrders(shiftTypes: TWardSettingsShiftType[]) {
    return withShiftTypeDisplayOrders([...shiftTypes].sort(compareShiftTypesForSettings));
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

function ShiftTypeTable({
    shiftTypes,
    onCreate,
    onUpdate,
    onDelete,
    onRefresh,
    status,
}: {
    shiftTypes: TWardSettingsShiftType[];
    status: TWardSettingsState['shiftTypesStatus'];
    onCreate: (payload: TCreateShiftTypeDTO) => Promise<boolean | void>;
    onUpdate: (shiftType: TWardSettingsShiftType) => Promise<boolean | void>;
    onDelete: (shiftTypeId: number) => Promise<boolean | void>;
    onRefresh: () => Promise<void> | void;
}) {
    const {t} = useTypedTranslation();
    const [openedColorShiftTypeId, setOpenedColorShiftTypeId] = useState<number | null>(null);
    const [shortNameErrorById, setShortNameErrorById] = useState<Record<number, string>>({});
    const [showValidationHighlight, setShowValidationHighlight] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [draftShiftTypes, setDraftShiftTypes] = useState<TWardSettingsShiftType[]>([]);
    const [deletedShiftTypeIds, setDeletedShiftTypeIds] = useState<number[]>([]);
    const [colorPickerPosition, setColorPickerPosition] = useState<TColorPickerPosition | null>(null);
    const rotationMode = useMemo(() => inferWardRotationMode(shiftTypes), [shiftTypes]);
    const savingRef = useRef(false);
    const hasInitializedShiftTypeOrderRef = useRef(false);
    const openedColorContainerRef = useRef<HTMLDivElement | null>(null);
    const openedColorMenuRef = useRef<HTMLDivElement | null>(null);
    const tempShiftTypeIdRef = useRef(-1);
    const showUsedShiftTypeLockedToast = () => {
        toast.error(t('page.wardSettings.shiftTypes.toast.usedTypeLocked'));
    };
    const showUsedShiftTypeDeleteToast = () => {
        toast.error(t('page.wardSettings.shiftTypes.toast.usedTypeDeleteLocked'));
    };

    useEffect(() => {
        if (status !== 'success') return;

        setDraftShiftTypes(
            hasInitializedShiftTypeOrderRef.current
                ? withShiftTypeDisplayOrders(shiftTypes)
                : withInitialShiftTypeDisplayOrders(shiftTypes),
        );
        hasInitializedShiftTypeOrderRef.current = true;
        setDeletedShiftTypeIds([]);
        setShortNameErrorById({});
        setShowValidationHighlight(false);
    }, [shiftTypes, status]);

    const duplicatedShiftShortNameKeys = useMemo(() => {
        const countByShortNameKey = new Map<string, number>();

        draftShiftTypes
            .filter((shiftType) => shiftType.isActive !== false)
            .forEach((shiftType) => {
                const normalizedShortNameKey = getShiftShortNameEntryKey(shiftType.shortName);

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

        if (hasInvalidShiftShortNameLengthInput(shortName)) {
            return t('page.wardSettings.shiftTypes.validation.shortNameLength');
        }

        if (hasInvalidShiftShortNameEntryKey(normalizedShortName)) {
            return t('page.wardSettings.shiftTypes.validation.shortNameFirstKey');
        }

        if (duplicatedShiftShortNameKeys.has(getShiftShortNameEntryKey(normalizedShortName))) {
            return t('page.wardSettings.shiftTypes.validation.shortNameDuplicate');
        }

        return null;
    };
    const getShiftNameError = (name: string) => {
        if (!name.trim()) return t('page.wardSettings.shiftTypes.validation.nameRequired');

        return null;
    };
    const getShiftTimeError = (shiftType: TWardSettingsShiftType) => {
        if (shiftType.isActive === false) return null;

        if (isOffShiftType(shiftType)) return null;

        const normalizedStartTime = shiftType.startTime?.trim() ?? '';
        const normalizedEndTime = shiftType.endTime?.trim() ?? '';

        if (!normalizedStartTime || !normalizedEndTime) return t('page.wardSettings.shiftTypes.validation.timeRequired');

        const startMinutes = parseShiftTimeToMinutes(normalizedStartTime);
        const endMinutes = parseShiftTimeToMinutes(normalizedEndTime);

        if (startMinutes == null || endMinutes == null) return t('page.wardSettings.shiftTypes.validation.timeFormat');

        if (endMinutes === startMinutes) return t('page.wardSettings.shiftTypes.validation.timeSame');

        return null;
    };
    const isShiftTypeEnabledByRotationMode = (shiftType: TWardSettingsShiftType) => {
        const rotationSystem = getShiftTypeRotationSystem(shiftType);

        return rotationSystem === 'NONE' || rotationMode === 'MIXED' || rotationSystem === rotationMode;
    };
    const shiftTypesForSave = draftShiftTypes.map((shiftType) =>
        shiftType.isActive !== false && !isShiftTypeEnabledByRotationMode(shiftType) ? {...shiftType, isActive: false} : shiftType,
    );
    const hasRowValidationError = (shiftType: TWardSettingsShiftType) =>
        shiftType.isActive !== false &&
        isShiftTypeEnabledByRotationMode(shiftType) &&
        Boolean(
            getShiftNameError(shiftType.name) ??
                getShiftShortNameError(shiftType.wardShiftTypeId, shiftType.shortName) ??
                getShiftTimeError(shiftType),
        );
    const hasShiftRotationValidationError = (shiftType: TWardSettingsShiftType) =>
        shiftType.isActive !== false &&
        isShiftTypeEnabledByRotationMode(shiftType) &&
        !getSelectableRotationSystemsForClassification(rotationMode, getShiftTypeClassification(shiftType)).includes(
            getSelectedShiftTypeRotationSystem(shiftType),
        );
    const activeShiftTypes = shiftTypesForSave.filter((shiftType) => shiftType.isActive !== false);
    const hasActiveRotationClassification = (
        rotationSystem: NonNullable<TCreateShiftTypeDTO['rotationSystem']>,
        classification: TCreateShiftTypeDTO['classification'],
    ) =>
        activeShiftTypes.some(
            (shiftType) =>
                getSelectedShiftTypeRotationSystem(shiftType) === rotationSystem &&
                getShiftTypeClassification(shiftType) === classification,
        );
    const showRotationSystemColumn = rotationMode === 'MIXED';
    const shiftTypeGridCols = showRotationSystemColumn ? SHIFT_TYPE_GRID_COLS_WITH_ROTATION : SHIFT_TYPE_GRID_COLS_WITHOUT_ROTATION;
    const selectedRotationTitle =
        rotationMode === 'THREE'
            ? t('page.wardSettings.shiftTypes.rotation.threeTitle')
            : rotationMode === 'TWO'
              ? t('page.wardSettings.shiftTypes.rotation.twoTitle')
              : t('page.wardSettings.shiftTypes.rotation.mixedTitle');
    const requiredRotationClassifications = getRequiredRotationClassifications(rotationMode);
    const missingRequiredShiftTypeLabels = requiredRotationClassifications
        .filter(({rotationSystem, classification}) => !hasActiveRotationClassification(rotationSystem, classification))
        .map(({rotationSystem, classification}) => {
            const option = SHIFT_CLASSIFICATION_OPTIONS.find((candidate) => candidate.value === classification);
            const classificationLabel = option ? t(option.labelKey) : classification;

            if (rotationSystem === 'TWO') return t('page.wardSettings.shiftTypes.rotation.twoItem', {classification: classificationLabel});

            return classificationLabel;
        });
    const hasMissingRequiredShiftTypes = missingRequiredShiftTypeLabels.length > 0;
    const hasAnyValidationError =
        draftShiftTypes.some(hasRowValidationError) ||
        draftShiftTypes.some(hasShiftRotationValidationError) ||
        hasMissingRequiredShiftTypes;
    const nextTempShiftTypeId = () => tempShiftTypeIdRef.current--;
    const getSemanticShiftTypePatch = (
        shiftType: TWardSettingsShiftType,
        classification: TCreateShiftTypeDTO['classification'],
        rotationSystem: TSelectableShiftRotationSystem,
    ): Partial<TWardSettingsShiftType> => {
        const isOff = classification === 'OFF' || classification === 'ANNUAL_LEAVE' || classification === 'OTHER_LEAVE';
        const isNightContinuation = classification === 'NIGHT_CONTINUATION';
        const timeRange = getDefaultTimeRangeForRotation(rotationSystem, classification);

        return {
            classification,
            isOff,
            isCounted: !isOff && !isNightContinuation,
            rotationSystem,
            paidMinutes: isNightContinuation ? 0 : rotationSystem === 'TWO' ? 630 : null,
            isActive: true,
            startTime: isOff ? '' : (timeRange?.startTime ?? shiftType.startTime),
            endTime: isOff ? '' : (timeRange?.endTime ?? shiftType.endTime),
        };
    };
    const changeShiftTypeRotationSystem = (shiftType: TWardSettingsShiftType, rotationSystem: TSelectableShiftRotationSystem) => {
        patchDraft(shiftType.wardShiftTypeId, getSemanticShiftTypePatch(shiftType, getShiftTypeClassification(shiftType), rotationSystem));
    };
    const addDraftShiftType = () => {
        const nextTempId = nextTempShiftTypeId();

        setDraftShiftTypes((prev) =>
            withShiftTypeDisplayOrders([
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
                    rotationSystem: 'NONE',
                    paidMinutes: null,
                    isActive: true,
                },
            ]),
        );
    };
    const removeDraftShiftType = (shiftTypeId: number) => {
        const targetShiftType = draftShiftTypes.find((shiftType) => shiftType.wardShiftTypeId === shiftTypeId);

        if (targetShiftType?.isUsed) {
            showUsedShiftTypeDeleteToast();

            return;
        }

        setDraftShiftTypes((prev) => withShiftTypeDisplayOrders(prev.filter((shiftType) => shiftType.wardShiftTypeId !== shiftTypeId)));

        if (shiftTypeId > 0) {
            setDeletedShiftTypeIds((prev) => (prev.includes(shiftTypeId) ? prev : [...prev, shiftTypeId]));
        }
    };
    const handleShiftTypeDragEnd = ({destination, source}: DropResult) => {
        if (!destination || source.index === destination.index || source.droppableId !== destination.droppableId) return;

        setDraftShiftTypes((prev) => {
            const next = [...prev];
            const [moved] = next.splice(source.index, 1);

            if (!moved) return prev;

            next.splice(destination.index, 0, moved);

            return withShiftTypeDisplayOrders(next);
        });
        closeColorPicker();
    };
    const saveAllShiftTypes = async () => {
        if (savingRef.current) return;

        setShowValidationHighlight(true);

        if (hasAnyValidationError) {
            if (draftShiftTypes.some(hasShiftRotationValidationError)) {
                toast.error(t('page.onboardingWardCreate.blocked.invalidShiftType'));

                return;
            }

            const firstInvalid = draftShiftTypes.find(hasRowValidationError);

            if (!firstInvalid) {
                if (hasMissingRequiredShiftTypes) {
                    toast.error(
                        t('page.onboardingWardCreate.blocked.missingRequiredShiftTypes', {
                            shiftTypes: missingRequiredShiftTypeLabels.join(', '),
                        }),
                    );
                }

                return;
            }

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

        savingRef.current = true;
        setIsSaving(true);

        try {
            const deletedDefaultShiftTypeReplacements = new Map<number, TWardSettingsShiftType>();
            const replacementShiftTypeIdByDraftId = new Map<number, number>();
            const usedReplacementDraftIds = new Set<number>();

            deletedShiftTypeIds.forEach((shiftTypeId) => {
                const deletedShiftType = shiftTypes.find((shiftType) => shiftType.wardShiftTypeId === shiftTypeId);

                if (!deletedShiftType?.isDefault) return;

                const replacement = shiftTypesForSave.find(
                    (shiftType) =>
                        shiftType.wardShiftTypeId < 0 &&
                        !usedReplacementDraftIds.has(shiftType.wardShiftTypeId) &&
                        getShiftTypeClassification(shiftType) === getShiftTypeClassification(deletedShiftType) &&
                        getShiftTypeRotationSystem(shiftType) === getShiftTypeRotationSystem(deletedShiftType),
                );

                if (!replacement) return;

                deletedDefaultShiftTypeReplacements.set(shiftTypeId, replacement);
                replacementShiftTypeIdByDraftId.set(replacement.wardShiftTypeId, shiftTypeId);
                usedReplacementDraftIds.add(replacement.wardShiftTypeId);
            });

            const shiftTypeIdsToDelete = deletedShiftTypeIds.filter((id) => !deletedDefaultShiftTypeReplacements.has(id));
            const shiftTypeIdsToDeleteBeforeUpdates = shiftTypeIdsToDelete;
            const updates: TWardSettingsShiftType[] = [];
            const creations: TCreateShiftTypeDTO[] = [];

            shiftTypesForSave.forEach((shiftType) => {
                if (shiftType.wardShiftTypeId < 0) {
                    if (shiftType.isActive === false) return;

                    const replacedShiftTypeId = replacementShiftTypeIdByDraftId.get(shiftType.wardShiftTypeId);

                    if (replacedShiftTypeId != null) {
                        const replacedShiftType = shiftTypes.find((item) => item.wardShiftTypeId === replacedShiftTypeId);
                        const replacement = {
                            ...shiftType,
                            wardShiftTypeId: replacedShiftTypeId,
                            isDefault: replacedShiftType?.isDefault ?? shiftType.isDefault,
                        };

                        if (
                            !replacedShiftType ||
                            !areShiftTypePayloadsEqual(toShiftTypeUpdateDTO(replacedShiftType), toShiftTypeUpdateDTO(replacement))
                        ) {
                            updates.push(replacement);
                        }

                        return;
                    }

                    creations.push(toShiftTypeUpdateDTO(shiftType));

                    return;
                }

                const original = shiftTypes.find((candidate) => candidate.wardShiftTypeId === shiftType.wardShiftTypeId);
                const desiredPayload = toShiftTypeUpdateDTO(shiftType);

                if (
                    !original ||
                    hasPersistedShiftTypeContractDrift(original, desiredPayload) ||
                    !areShiftTypePayloadsEqual(toShiftTypeUpdateDTO(original), desiredPayload)
                ) {
                    updates.push(shiftType);
                }
            });

            const orderedUpdates = [...updates].sort((left, right) => Number(left.isActive !== false) - Number(right.isActive !== false));

            let didMutate = false;

            for (const shiftTypeId of shiftTypeIdsToDeleteBeforeUpdates) {
                const saved = await onDelete(shiftTypeId);

                if (saved === false) {
                    await onRefresh();

                    return;
                }

                didMutate = true;
            }

            for (const shiftType of orderedUpdates) {
                const saved = await onUpdate(shiftType);

                if (saved === false) {
                    await onRefresh();

                    return;
                }

                didMutate = true;
            }

            for (const payload of creations) {
                const saved = await onCreate(payload);

                if (saved === false) {
                    await onRefresh();

                    return;
                }

                didMutate = true;
            }

            if (didMutate) await onRefresh();

            toast.success(t('page.wardSettings.shiftTypes.toast.saveSuccess'));
        } finally {
            savingRef.current = false;
            setIsSaving(false);
        }
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
                    action={{label: t('page.state.retry'), onClick: () => void onRefresh()}}
                    className="py-0"
                />
            </SettingsStateFrame>
        );
    }

    return (
        <div className="w-full">
            <section
                className="mb-3 inline-flex w-full items-center gap-3 rounded-[14px] bg-white px-4 py-3 sm:w-auto"
                aria-labelledby="ward-rotation-title"
            >
                <div className="flex min-w-0 flex-col gap-0.5 sm:flex-row sm:items-baseline sm:gap-3">
                    <h2 id="ward-rotation-title" className="shrink-0 font-apple text-[13px] leading-5 font-medium text-gray-3">
                        {t('page.wardSettings.shiftTypes.rotation.modeTitle')}
                    </h2>
                    <p className="font-apple text-[16px] leading-6 font-semibold text-sub-1">{selectedRotationTitle}</p>
                </div>
            </section>
            <div className="overflow-x-auto">
                <div className="min-w-[960px] rounded-[16px] bg-white p-2">
                    <div
                        className={`grid ${shiftTypeGridCols} items-center gap-3 px-3 py-2.5 text-center font-apple text-[12px] font-semibold text-gray-3`}
                    >
                        <span />
                        <span>{t('page.wardSettings.shiftTypes.column.name')}</span>
                        <span>{t('page.wardSettings.shiftTypes.column.shortName')}</span>
                        {showRotationSystemColumn ? <span>{t('page.wardSettings.shiftTypes.column.rotation')}</span> : null}
                        <span>{t('page.wardSettings.shiftTypes.column.type')}</span>
                        <span>{t('page.wardSettings.shiftTypes.column.workTime')}</span>
                        <span>{t('page.wardSettings.shiftTypes.column.color')}</span>
                        <span />
                    </div>
                    {showValidationHighlight && hasMissingRequiredShiftTypes ? (
                        <p className="px-3 pt-2 text-center font-apple text-[12px] text-red" role="alert">
                            {t('page.onboardingWardCreate.blocked.missingRequiredShiftTypes', {
                                shiftTypes: missingRequiredShiftTypeLabels.join(', '),
                            })}
                        </p>
                    ) : null}
                    <DragDropContext onDragEnd={handleShiftTypeDragEnd}>
                        <Droppable droppableId="ward-settings-shift-types">
                            {(provided) => (
                                <div ref={provided.innerRef} {...provided.droppableProps} className="mt-1">
                                    {draftShiftTypes.map((shiftType, index) => (
                                        <Draggable
                                            key={shiftType.wardShiftTypeId}
                                            draggableId={String(shiftType.wardShiftTypeId)}
                                            index={index}
                                            isDragDisabled={shiftType.isUsed === true}
                                        >
                                            {(dragProvided) => (
                                                <div
                                                    ref={dragProvided.innerRef}
                                                    {...dragProvided.draggableProps}
                                                    className={cn(
                                                        `grid ${shiftTypeGridCols} items-start gap-3 px-3 py-3.5`,
                                                        shiftType.isActive === false && 'opacity-45',
                                                    )}
                                                >
                                                    <button
                                                        type="button"
                                                        {...dragProvided.dragHandleProps}
                                                        aria-label={t('page.onboardingWardCreate.shiftType.dragAria', {
                                                            shiftName:
                                                                shiftType.name ||
                                                                shiftType.shortName ||
                                                                t('page.onboardingWardCreate.shiftType.work'),
                                                        })}
                                                        className="hover:text-gray-2 flex h-10 w-8 cursor-grab items-center justify-center self-start text-gray-4 transition-colors active:cursor-grabbing"
                                                    >
                                                        <SixDotsIcon className="h-4 w-4" />
                                                    </button>
                                                    <div className="flex flex-col gap-1">
                                                        <Input
                                                            data-shift-name-input={shiftType.wardShiftTypeId}
                                                            value={shiftType.name}
                                                            maxLength={SHIFT_NAME_MAX_LENGTH}
                                                            onChange={(event) =>
                                                                patchDraft(shiftType.wardShiftTypeId, {name: event.target.value})
                                                            }
                                                            variant="foundation"
                                                            fieldSize="lg"
                                                            aria-invalid={
                                                                showValidationHighlight && Boolean(getShiftNameError(shiftType.name))
                                                            }
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
                                                            tabIndex={isUsedShiftShortNameLocked(shiftType) ? -1 : undefined}
                                                            readOnly={isUsedShiftShortNameLocked(shiftType)}
                                                            aria-readonly={isUsedShiftShortNameLocked(shiftType)}
                                                            onMouseDown={(event) => {
                                                                if (isUsedShiftShortNameLocked(shiftType)) event.preventDefault();
                                                            }}
                                                            onClick={() => {
                                                                if (isUsedShiftShortNameLocked(shiftType)) showUsedShiftTypeLockedToast();
                                                            }}
                                                            onKeyDown={(event) => {
                                                                if (
                                                                    isUsedShiftShortNameLocked(shiftType) &&
                                                                    (event.key.length === 1 ||
                                                                        event.key === 'Backspace' ||
                                                                        event.key === 'Delete')
                                                                ) {
                                                                    event.preventDefault();
                                                                    showUsedShiftTypeLockedToast();
                                                                }
                                                            }}
                                                            onPaste={(event) => {
                                                                if (isUsedShiftShortNameLocked(shiftType)) {
                                                                    event.preventDefault();
                                                                    showUsedShiftTypeLockedToast();
                                                                }
                                                            }}
                                                            onChange={(event) => {
                                                                if (isUsedShiftShortNameLocked(shiftType)) {
                                                                    showUsedShiftTypeLockedToast();

                                                                    return;
                                                                }

                                                                const normalizedShortName = normalizeShiftShortNameInput(
                                                                    event.target.value,
                                                                );

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
                                                                    setShortNameErrorById((prev) => ({
                                                                        ...prev,
                                                                        [shiftType.wardShiftTypeId]: '',
                                                                    }));
                                                                }

                                                                patchDraft(shiftType.wardShiftTypeId, {
                                                                    shortName: normalizedShortName,
                                                                });
                                                            }}
                                                            variant="foundation"
                                                            fieldSize="lg"
                                                            aria-invalid={
                                                                showValidationHighlight &&
                                                                Boolean(
                                                                    getShiftShortNameError(shiftType.wardShiftTypeId, shiftType.shortName),
                                                                )
                                                            }
                                                            aria-describedby={
                                                                showValidationHighlight &&
                                                                getShiftShortNameError(shiftType.wardShiftTypeId, shiftType.shortName)
                                                                    ? `shift-short-name-error-${shiftType.wardShiftTypeId}`
                                                                    : undefined
                                                            }
                                                            className={cn(
                                                                `h-10 w-16 px-1 text-center font-apple text-[15px] ${SHIFT_TYPE_INPUT_SURFACE_CLASS}`,
                                                                isUsedShiftShortNameLocked(shiftType)
                                                                    ? 'cursor-not-allowed bg-gray-6 text-gray-4 hover:bg-gray-6 focus-visible:bg-gray-6 focus-visible:ring-0'
                                                                    : '',
                                                                showValidationHighlight &&
                                                                    getShiftShortNameError(shiftType.wardShiftTypeId, shiftType.shortName)
                                                                    ? SHIFT_TYPE_INPUT_ERROR_CLASS
                                                                    : '',
                                                            )}
                                                            placeholder="-"
                                                        />
                                                        {showValidationHighlight &&
                                                        getShiftShortNameError(shiftType.wardShiftTypeId, shiftType.shortName) ? (
                                                            <InlineFieldError id={`shift-short-name-error-${shiftType.wardShiftTypeId}`}>
                                                                {getShiftShortNameError(shiftType.wardShiftTypeId, shiftType.shortName)}
                                                            </InlineFieldError>
                                                        ) : null}
                                                    </div>
                                                    {showRotationSystemColumn ? (
                                                        <div className="flex h-10 items-center justify-center">
                                                            {hasFixedNoneRotationSystem(shiftType) ? (
                                                                <span className="flex h-10 w-full items-center justify-center rounded-[10px] bg-gray-7 px-2 font-apple text-[13px] text-gray-3">
                                                                    {t('page.wardSettings.shiftTypes.rotation.noneBadge')}
                                                                </span>
                                                            ) : (
                                                                <ShiftClassificationDropdown
                                                                    value={getSelectedShiftTypeRotationSystem(shiftType)}
                                                                    disabled={shiftType.isUsed === true}
                                                                    onDisabledClick={showUsedShiftTypeLockedToast}
                                                                    options={getAvailableShiftRotationSystems(shiftType, rotationMode).map(
                                                                        (rotationSystem) => ({
                                                                            value: rotationSystem,
                                                                            label:
                                                                                rotationSystem === 'THREE'
                                                                                    ? t('page.wardSettings.shiftTypes.rotation.threeBadge')
                                                                                    : rotationSystem === 'TWO'
                                                                                      ? t('page.wardSettings.shiftTypes.rotation.twoBadge')
                                                                                      : t(
                                                                                            'page.wardSettings.shiftTypes.rotation.noneBadge',
                                                                                        ),
                                                                        }),
                                                                    )}
                                                                    ariaLabel={t('page.onboardingWardCreate.shiftType.rotationAria', {
                                                                        shiftName:
                                                                            shiftType.name ||
                                                                            shiftType.shortName ||
                                                                            t('page.wardSettings.type.work'),
                                                                    })}
                                                                    onChange={(value) =>
                                                                        changeShiftTypeRotationSystem(
                                                                            shiftType,
                                                                            value as TSelectableShiftRotationSystem,
                                                                        )
                                                                    }
                                                                    className={cn(
                                                                        'px-2 pr-7 text-[13px]',
                                                                        showValidationHighlight &&
                                                                            hasShiftRotationValidationError(shiftType)
                                                                            ? SHIFT_TYPE_INPUT_ERROR_CLASS
                                                                            : '',
                                                                    )}
                                                                />
                                                            )}
                                                        </div>
                                                    ) : null}
                                                    <div className="relative mx-auto flex h-10 w-full max-w-[180px] items-center">
                                                        <ShiftClassificationDropdown
                                                            value={getShiftTypeClassification(shiftType)}
                                                            disabled={shiftType.isUsed === true}
                                                            onDisabledClick={showUsedShiftTypeLockedToast}
                                                            options={getAvailableShiftClassificationOptions(rotationMode).map((option) => ({
                                                                value: option.value,
                                                                label: t(option.labelKey),
                                                            }))}
                                                            ariaLabel={t('page.onboardingWardCreate.shiftType.classificationAria', {
                                                                shiftName:
                                                                    shiftType.name ||
                                                                    shiftType.shortName ||
                                                                    t('page.wardSettings.type.work'),
                                                            })}
                                                            onChange={(value) => {
                                                                const classification = value as TCreateShiftTypeDTO['classification'];
                                                                const currentRotationSystem = getSelectedShiftTypeRotationSystem(shiftType);
                                                                const selectableRotationSystems =
                                                                    getSelectableRotationSystemsForClassification(
                                                                        rotationMode,
                                                                        classification,
                                                                    );
                                                                const rotationSystem = selectableRotationSystems.includes(
                                                                    currentRotationSystem,
                                                                )
                                                                    ? currentRotationSystem
                                                                    : (selectableRotationSystems[0] ?? 'NONE');

                                                                patchDraft(
                                                                    shiftType.wardShiftTypeId,
                                                                    getSemanticShiftTypePatch(shiftType, classification, rotationSystem),
                                                                );
                                                            }}
                                                        />
                                                    </div>
                                                    <div className="flex self-start">
                                                        <div className="flex items-start">
                                                            <div className="flex flex-col gap-1">
                                                                <div className="flex items-center gap-2">
                                                                    <Input
                                                                        data-shift-start-input={shiftType.wardShiftTypeId}
                                                                        value={
                                                                            isOffShiftType(shiftType) ? '-' : (shiftType.startTime ?? '')
                                                                        }
                                                                        disabled={isOffShiftType(shiftType)}
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
                                                                        aria-invalid={
                                                                            showValidationHighlight && Boolean(getShiftTimeError(shiftType))
                                                                        }
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
                                                                        value={isOffShiftType(shiftType) ? '-' : (shiftType.endTime ?? '')}
                                                                        disabled={isOffShiftType(shiftType)}
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
                                                                        aria-invalid={
                                                                            showValidationHighlight && Boolean(getShiftTimeError(shiftType))
                                                                        }
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
                                                            <span className="ml-2 flex h-10 min-w-[48px] items-center justify-center rounded-[8px] bg-[#F6F7F9] px-2 font-poppins text-[11px] leading-none whitespace-nowrap text-gray-4">
                                                                {isOffShiftType(shiftType)
                                                                    ? ''
                                                                    : formatShiftDuration(shiftType.startTime, shiftType.endTime)}
                                                            </span>
                                                        </div>
                                                    </div>
                                                    <div
                                                        className="relative flex justify-center self-start"
                                                        ref={
                                                            openedColorShiftTypeId === shiftType.wardShiftTypeId
                                                                ? openedColorContainerRef
                                                                : null
                                                        }
                                                    >
                                                        <button
                                                            type="button"
                                                            aria-label={t('page.wardSettings.shiftTypes.colorSelectAria', {
                                                                name:
                                                                    shiftType.name ||
                                                                    shiftType.shortName ||
                                                                    t('page.wardSettings.type.work'),
                                                            })}
                                                            className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-[10px] bg-[#F1F3F5] transition-colors hover:bg-[#E9ECEF]"
                                                            onClick={(event) =>
                                                                handleColorButtonClick(shiftType.wardShiftTypeId, event.currentTarget)
                                                            }
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
                                                                      className="fixed z-[1000] grid w-[148px] grid-cols-5 gap-2 rounded-[10px] bg-white p-2 shadow-[0px_10px_28px_rgba(95,100,135,0.16)]"
                                                                  >
                                                                      {SHIFT_COLOR_OPTIONS.map((color) => {
                                                                          const isSelected =
                                                                              shiftType.color.toLowerCase() === color.toLowerCase();

                                                                          return (
                                                                              <button
                                                                                  key={color}
                                                                                  type="button"
                                                                                  aria-label={t(
                                                                                      'page.wardSettings.shiftTypes.colorOptionAria',
                                                                                      {color},
                                                                                  )}
                                                                                  className="flex h-5 w-5 items-center justify-center rounded-[6px] border border-black/20 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.35)]"
                                                                                  style={{backgroundColor: color}}
                                                                                  onClick={() => {
                                                                                      patchDraft(shiftType.wardShiftTypeId, {color});
                                                                                      closeColorPicker();
                                                                                  }}
                                                                              >
                                                                                  {isSelected ? (
                                                                                      <Check className="h-3.5 w-3.5 text-white" />
                                                                                  ) : null}
                                                                              </button>
                                                                          );
                                                                      })}
                                                                  </div>,
                                                                  document.body,
                                                              )
                                                            : null}
                                                    </div>
                                                    <button
                                                        type="button"
                                                        aria-label={t('page.wardSettings.shiftTypes.deleteAria', {
                                                            name: shiftType.name || shiftType.shortName || t('page.wardSettings.type.work'),
                                                        })}
                                                        aria-disabled={shiftType.isUsed === true}
                                                        onClick={() => removeDraftShiftType(shiftType.wardShiftTypeId)}
                                                        className={cn(
                                                            'flex h-10 w-10 items-center justify-center rounded-[8px] text-gray-4 transition-colors hover:bg-[#F1F3F5] hover:text-sub-1',
                                                            shiftType.isUsed &&
                                                                'cursor-not-allowed opacity-50 hover:bg-transparent hover:text-gray-4',
                                                        )}
                                                    >
                                                        <X className="h-4 w-4" />
                                                    </button>
                                                </div>
                                            )}
                                        </Draggable>
                                    ))}
                                    {provided.placeholder}
                                </div>
                            )}
                        </Droppable>
                    </DragDropContext>
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
                    disabled={isSaving}
                    aria-busy={isSaving}
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

                    <div className="max-w-full min-w-0 overflow-visible rounded-[12px] bg-[#3D4658] p-0.5">
                        <div className="scrollbar-hide flex max-w-full min-w-0 gap-1 overflow-visible whitespace-nowrap">
                            {state.shiftTeams.map((team) => {
                                const active = team.shiftTeamId === state.currentShiftTeamId;

                                return (
                                    <button
                                        key={team.shiftTeamId}
                                        type="button"
                                        className={cn(
                                            'relative box-border grid h-8 max-h-8 min-h-8 min-w-[92px] shrink-0 place-items-center overflow-visible rounded-[9px] px-3 py-0 font-apple text-[12px] leading-none font-semibold transition-colors',
                                            active ? 'bg-white text-sub-1' : 'text-[#B8C0CF] hover:text-white',
                                        )}
                                        onClick={() => actions.selectShiftTeam(team.shiftTeamId)}
                                    >
                                        <span className="block leading-none">{team.name}</span>
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
    const {
        state: {accessToken},
    } = useAuth();
    const [hasUnsavedRestLeavePolicyChanges, setHasUnsavedRestLeavePolicyChanges] = useState(false);
    const [pendingTab, setPendingTab] = useState<TWardSettingsTab | null>(null);
    const [pendingNavigationPath, setPendingNavigationPath] = useState<string | null>(null);
    const unsavedDialogOpen = pendingTab !== null || pendingNavigationPath !== null;
    const isCurrentTabReady = (() => {
        switch (state.currentTab) {
            case 'shiftTypes':
            case 'restLeavePolicy':
                return state.shiftTypesStatus === 'success';
            case 'requestReception':
                return state.requestReceptionStatus === 'success';
            case 'constraints':
                return state.shiftTeamsStatus === 'success';
        }
    })();
    const shouldShowNotificationBell = isWardAdminAccessToken(accessToken) && state.wardId !== null && isCurrentTabReady;
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
            <div className={cn(SETTINGS_CONTENT_CLASS, 'relative flex flex-col gap-4')}>
                {shouldShowNotificationBell ? (
                    <div className="pointer-events-none absolute top-0 right-0 z-[1002]">
                        <NotificationBell />
                    </div>
                ) : null}
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
                        onRefresh={actions.retryShiftTypes}
                    />
                ) : state.currentTab === 'restLeavePolicy' ? (
                    <RestLeavePolicySection
                        wardId={state.wardId}
                        shiftTypes={state.shiftTypes.filter((shiftType) => shiftType.isActive !== false)}
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
