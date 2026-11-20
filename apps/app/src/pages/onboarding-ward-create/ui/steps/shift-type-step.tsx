import {DragDropContext, Draggable, Droppable, type DropResult} from '@hello-pangea/dnd';
import {Check, CircleAlert, Plus, X} from 'lucide-react';
import {useEffect, useMemo, useRef, useState} from 'react';
import toast from 'react-hot-toast';
import {SixDotsIcon} from '@/shared/assets/svg';
import {useTypedTranslation} from '@/shared/hook/use-typed-translation';
import {normalizeInputWidth} from '@/shared/lib/input-width';
import {
    getDefaultTimeRangeForRotation,
    getRequiredRotationClassificationCounts,
    isRequiredRotationClassificationSatisfied,
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
} from '@/shared/lib/shift-short-name';
import CompositionInput from '@/shared/ui/form-controls/CompositionInput';
import ShiftClassificationDropdown from '@/shared/ui/ShiftClassificationDropdown';
import {
    DEFAULT_SHIFT_TYPE_COLORS,
    ONBOARDING_SHIFT_NAME_MAX_LENGTH,
    getAutomaticPreviousScheduleShiftMapping,
    isLastOnboardingAnnualLeave,
    isOnboardingShiftTypeActive,
    isOnboardingShiftMappingResolved,
    resolveOnboardingRotationSystem,
    type TOnboardingRotationMode,
    type TOnboardingWardShiftType,
} from '../../model';
import {ShiftTypeErrorHelp} from '../shift-type-error-help';
import {ShiftTypeFeedback, type TShiftTypeFieldIssue} from '../shift-type-feedback';
import {getShiftClassificationError} from '../shift-type-validation';
import styles from './shift-type-step.module.css';

interface IShiftTypeStepProps {
    shiftTypes: TOnboardingWardShiftType[];
    rotationMode: TOnboardingRotationMode;
    allowNightContinuation?: boolean;
    requireNightContinuation?: boolean;
    onChange: (shiftTypeId: string, updater: Partial<TOnboardingWardShiftType>) => void;
    onDragEnd: (result: DropResult) => void;
    onAdd: () => void;
    onDelete: (shiftTypeId: string) => void;
}

interface IShiftTypeRequirementsProps {
    shiftTypes: TOnboardingWardShiftType[];
    rotationMode: TOnboardingRotationMode;
    requireNightContinuation?: boolean;
}

const SHIFT_COLOR_OPTIONS = DEFAULT_SHIFT_TYPE_COLORS;
const SHIFT_TYPE_INPUT_SURFACE_CLASS =
    'rounded-lg border-0 bg-gray-7 shadow-none ring-0 transition-colors duration-150 hover:bg-gray-6/50 focus-visible:border-0 focus-visible:bg-main-light focus-visible:text-main-1 focus-visible:ring-0';
const SHIFT_TYPE_INPUT_ERROR_CLASS =
    'bg-[#FFF1F3] text-[#B4234D] focus-visible:border-0 focus-visible:bg-[#FFE2E8] focus-visible:text-[#981E41] focus-visible:ring-0';
const SHIFT_TIME_FORMAT_REGEX = /^\d{2}:\d{2}$/;
const SHIFT_CLASSIFICATION_OPTIONS = [
    {value: 'DAY', labelKey: 'page.onboardingWardCreate.shiftType.classification.day'},
    {value: 'EVENING', labelKey: 'page.onboardingWardCreate.shiftType.classification.evening'},
    {value: 'NIGHT', labelKey: 'page.onboardingWardCreate.shiftType.classification.night'},
    {value: 'NIGHT_CONTINUATION', labelKey: 'page.onboardingWardCreate.shiftType.classification.nightContinuation'},
    {value: 'OFF', labelKey: 'page.onboardingWardCreate.shiftType.classification.off'},
    {value: 'OTHER_WORK', labelKey: 'page.onboardingWardCreate.shiftType.classification.otherWork'},
    {value: 'ANNUAL_LEAVE', labelKey: 'page.onboardingWardCreate.shiftType.classification.annualLeave'},
    {value: 'OTHER_LEAVE', labelKey: 'page.onboardingWardCreate.shiftType.classification.otherLeave'},
] as const;

function getAvailableShiftClassificationOptions(rotationMode: TOnboardingRotationMode, allowNightContinuation: boolean) {
    const selectableClassifications = getSelectableClassificationsForWardMode(rotationMode);

    return SHIFT_CLASSIFICATION_OPTIONS.filter(
        (option) =>
            selectableClassifications.some((classification) => classification === option.value) &&
            (allowNightContinuation || option.value !== 'NIGHT_CONTINUATION'),
    );
}

function getShiftClassificationForRotationSelection(shiftType: TOnboardingWardShiftType, rotationMode: TOnboardingRotationMode) {
    if (isOnboardingShiftMappingResolved(shiftType.mappingStatus)) return shiftType.classification;

    if (shiftType.importedCode) return undefined;

    return (
        getAutomaticPreviousScheduleShiftMapping(shiftType.shortName, rotationMode)?.classification ??
        shiftType.mappingRecommendation?.classification
    );
}

function getAvailableShiftRotationSystems(shiftType: TOnboardingWardShiftType, rotationMode: TOnboardingRotationMode) {
    if (rotationMode === 'MIXED') return getSelectableShiftRotationSystemsForWardMode(rotationMode);

    const classification = getShiftClassificationForRotationSelection(shiftType, rotationMode);

    if (!classification) return [];

    return getSelectableRotationSystemsForClassification(rotationMode, classification);
}

function hasFixedNoneRotationSystem(shiftType: TOnboardingWardShiftType) {
    return (
        isOnboardingShiftMappingResolved(shiftType.mappingStatus) &&
        (shiftType.classification === 'OFF' ||
            shiftType.classification === 'OTHER_WORK' ||
            shiftType.classification === 'ANNUAL_LEAVE' ||
            shiftType.classification === 'OTHER_LEAVE')
    );
}

function isOffShiftType(shiftType: TOnboardingWardShiftType) {
    return (
        shiftType.isOff ||
        shiftType.classification === 'OFF' ||
        shiftType.classification === 'ANNUAL_LEAVE' ||
        shiftType.classification === 'OTHER_LEAVE'
    );
}

export function ShiftTypeRequirements({shiftTypes, rotationMode, requireNightContinuation = false}: IShiftTypeRequirementsProps) {
    const {t} = useTypedTranslation();
    const titleKey =
        rotationMode === 'TWO'
            ? 'page.onboardingWardCreate.shiftType.requirements.titleTwo'
            : rotationMode === 'THREE'
              ? 'page.onboardingWardCreate.shiftType.requirements.titleThree'
              : 'page.onboardingWardCreate.shiftType.requirements.titleMixed';
    const requiredShiftTypeStatuses = useMemo(
        () =>
            getRequiredRotationClassificationCounts(
                rotationMode,
                shiftTypes
                    .filter(
                        (shiftType) => isOnboardingShiftTypeActive(shiftType) && isOnboardingShiftMappingResolved(shiftType.mappingStatus),
                    )
                    .map((shiftType) => ({
                        classification: shiftType.classification,
                        rotationSystem: resolveOnboardingRotationSystem(shiftType),
                    })),
                {includeNightContinuation: requireNightContinuation, includeAnnualLeave: true},
            ),
        [requireNightContinuation, rotationMode, shiftTypes],
    );
    const satisfiedCount = requiredShiftTypeStatuses.filter(isRequiredRotationClassificationSatisfied).length;
    const issueCount = requiredShiftTypeStatuses.length - satisfiedCount;
    const showGroupLabels = rotationMode === 'MIXED';
    const requirementGroups = showGroupLabels
        ? [
              {
                  key: 'THREE',
                  title: t('page.onboardingWardCreate.shiftType.rotationThree'),
                  items: requiredShiftTypeStatuses.filter(({rotationSystem}) => rotationSystem === 'THREE'),
              },
              {
                  key: 'TWO',
                  title: t('page.onboardingWardCreate.shiftType.rotationTwo'),
                  items: requiredShiftTypeStatuses.filter(({rotationSystem}) => rotationSystem === 'TWO'),
              },
              {
                  key: 'COMMON',
                  title: t('page.onboardingWardCreate.shiftType.requirements.groupCommon'),
                  items: requiredShiftTypeStatuses.filter(({rotationSystem}) => rotationSystem === 'NONE'),
              },
          ]
        : [{key: rotationMode, title: null, items: requiredShiftTypeStatuses}];
    const getRequiredShiftTypeCopy = (requiredShiftType: (typeof requiredShiftTypeStatuses)[number]) => {
        const classificationOption = SHIFT_CLASSIFICATION_OPTIONS.find((option) => option.value === requiredShiftType.classification);
        const classificationLabel = classificationOption ? t(classificationOption.labelKey) : requiredShiftType.classification;
        const scope =
            rotationMode === 'MIXED' && requiredShiftType.rotationSystem !== 'NONE'
                ? requiredShiftType.rotationSystem === 'TWO'
                    ? t('page.onboardingWardCreate.shiftType.requirements.scopeTwo')
                    : t('page.onboardingWardCreate.shiftType.requirements.scopeThree')
                : t('page.onboardingWardCreate.shiftType.requirements.scopeDefault');

        return {classificationLabel, scope};
    };

    return (
        <section id="required-shift-types" tabIndex={-1} aria-labelledby="required-shift-types-title" className="mb-7 scroll-mt-6">
            <h2 id="required-shift-types-title" className="font-apple text-[16px] font-semibold text-sub-1">
                {t(titleKey)}
            </h2>
            <p role="status" aria-live="polite" aria-atomic="true" className="sr-only">
                {t('page.onboardingWardCreate.shiftType.requirements.liveSummary', {
                    ready: satisfiedCount,
                    total: requiredShiftTypeStatuses.length,
                    issues: issueCount,
                })}
            </p>
            <div className="mt-3 space-y-2.5">
                {requirementGroups.map((group) => (
                    <div key={group.key} className="flex flex-wrap items-start gap-x-4 gap-y-2">
                        {group.title ? (
                            <h3 className="w-12 shrink-0 pt-0.5 font-apple text-[12px] leading-5 font-semibold text-gray-3">
                                {group.title}
                            </h3>
                        ) : null}
                        <ul className="flex min-w-0 flex-1 flex-wrap gap-x-5 gap-y-2">
                            {group.items.map((requiredShiftType) => {
                                const {classificationLabel, scope} = getRequiredShiftTypeCopy(requiredShiftType);
                                const isSatisfied = isRequiredRotationClassificationSatisfied(requiredShiftType);
                                const duplicateCount = requiredShiftType.duplicateCount;
                                const statusLabel = isSatisfied
                                    ? t('page.onboardingWardCreate.shiftType.requirements.satisfied', {
                                          scope,
                                          shiftType: classificationLabel,
                                      })
                                    : duplicateCount <= 1 && requiredShiftType.count === 0
                                      ? t('page.onboardingWardCreate.shiftType.requirements.missing', {
                                            scope,
                                            shiftType: classificationLabel,
                                        })
                                      : t('page.onboardingWardCreate.shiftType.requirements.duplicate', {
                                            scope,
                                            shiftType: classificationLabel,
                                            count: duplicateCount,
                                        });
                                const issueLabel =
                                    duplicateCount <= 1 && requiredShiftType.count === 0
                                        ? t('page.onboardingWardCreate.shiftType.requirements.missingShort')
                                        : t('page.onboardingWardCreate.shiftType.requirements.duplicateShort', {
                                              count: duplicateCount,
                                          });

                                return (
                                    <li
                                        key={`${requiredShiftType.rotationSystem}-${requiredShiftType.classification}`}
                                        aria-label={statusLabel}
                                        className="flex min-w-0 items-start gap-2"
                                    >
                                        {isSatisfied ? (
                                            <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#147A50]" aria-hidden="true" />
                                        ) : (
                                            <CircleAlert className="mt-0.5 h-4 w-4 shrink-0 text-[#B4234D]" aria-hidden="true" />
                                        )}
                                        <span className="flex min-w-0 flex-wrap items-baseline gap-x-1.5 font-apple leading-5">
                                            <span
                                                className={`text-[13px] font-medium break-keep ${
                                                    isSatisfied ? 'text-sub-1' : 'text-[#B4234D]'
                                                }`}
                                            >
                                                {classificationLabel}
                                            </span>
                                            {!isSatisfied ? (
                                                <span className="text-[12px] font-semibold break-keep text-[#B4234D]">{issueLabel}</span>
                                            ) : null}
                                        </span>
                                    </li>
                                );
                            })}
                        </ul>
                    </div>
                ))}
            </div>
        </section>
    );
}

const parseShiftTimeToMinutes = (value: string) => {
    if (!SHIFT_TIME_FORMAT_REGEX.test(value)) return null;

    const [hour, minute] = value.split(':').map(Number);

    if (!Number.isInteger(hour) || !Number.isInteger(minute)) return null;

    if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;

    return hour * 60 + minute;
};
const normalizeShiftTimeInput = (value: string) => {
    const trimmed = normalizeInputWidth(value).trim();

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
};
const toCanonicalShiftTime = (value: string) => {
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
};

export function ShiftTypeStep({
    shiftTypes,
    rotationMode,
    allowNightContinuation = true,
    requireNightContinuation = false,
    onChange: onShiftTypeChange,
    onDragEnd,
    onAdd,
    onDelete,
}: IShiftTypeStepProps) {
    const {t} = useTypedTranslation();
    const onChange: IShiftTypeStepProps['onChange'] = (shiftTypeId, updater) => {
        if (
            isLastOnboardingAnnualLeave(shiftTypes, shiftTypeId) &&
            (updater.isActive === false ||
                (updater.classification != null && updater.classification !== 'ANNUAL_LEAVE') ||
                updater.mappingStatus === 'UNASSIGNED')
        ) {
            toast.error(t('page.onboardingWardCreate.toast.annualLeaveRequired'));

            return;
        }

        onShiftTypeChange(shiftTypeId, updater);
    };
    const [openedColorShiftTypeId, setOpenedColorShiftTypeId] = useState<string | null>(null);
    const [shortNameErrorById, setShortNameErrorById] = useState<Record<string, string>>({});
    const classificationErrorById = new Map(
        shiftTypes.map((shiftType) => [shiftType.id, getShiftClassificationError(shiftType, shiftTypes, rotationMode, t)]),
    );
    const openedColorContainerRef = useRef<HTMLDivElement | null>(null);
    const reviewRequiredCount = shiftTypes.filter((shiftType) => !isOnboardingShiftMappingResolved(shiftType.mappingStatus)).length;
    const showRotationSystemColumn = rotationMode === 'MIXED';
    const showProtectedDeleteToast = () => {
        toast.error(t('page.onboardingWardCreate.toast.previousScheduleDeleteLocked'));
    };
    const getSemanticShiftTypePatch = (
        shiftType: TOnboardingWardShiftType,
        classification: TOnboardingWardShiftType['classification'],
        rotationSystem: TSelectableShiftRotationSystem,
    ): Partial<TOnboardingWardShiftType> => {
        const isOff = classification === 'OFF' || classification === 'ANNUAL_LEAVE' || classification === 'OTHER_LEAVE';
        const isNightContinuation = classification === 'NIGHT_CONTINUATION';
        const timeRange = getDefaultTimeRangeForRotation(rotationSystem, classification);

        return {
            classification,
            isOff,
            isCounted: !isOff && !isNightContinuation,
            rotationSystem,
            paidMinutes: isNightContinuation ? 0 : rotationSystem === 'TWO' ? 630 : null,
            startTime: isOff ? '' : (timeRange?.startTime ?? shiftType.startTime),
            endTime: isOff ? '' : (timeRange?.endTime ?? shiftType.endTime),
            mappingStatus: 'CONFIRMED',
        };
    };
    const changeShiftTypeRotationSystem = (shiftType: TOnboardingWardShiftType, rotationSystem: TSelectableShiftRotationSystem) => {
        const classification = getShiftClassificationForRotationSelection(shiftType, rotationMode);

        if (!classification) {
            onChange(shiftType.id, {rotationSystem, mappingStatus: 'UNASSIGNED'});

            return;
        }

        onChange(shiftType.id, getSemanticShiftTypePatch(shiftType, classification, rotationSystem));
    };
    const duplicatedShiftShortNameKeys = useMemo(() => {
        const countByShortNameKey = new Map<string, number>();

        shiftTypes.forEach((shiftType) => {
            const normalizedShortNameKey = getShiftShortNameEntryKey(shiftType.shortName);

            if (!normalizedShortNameKey) return;

            countByShortNameKey.set(normalizedShortNameKey, (countByShortNameKey.get(normalizedShortNameKey) ?? 0) + 1);
        });

        return new Set(
            Array.from(countByShortNameKey.entries())
                .filter(([, count]) => count > 1)
                .map(([shortNameKey]) => shortNameKey),
        );
    }, [shiftTypes]);
    const getShiftShortNameError = (shiftTypeId: string, shortName: string) => {
        if (shortNameErrorById[shiftTypeId]) return shortNameErrorById[shiftTypeId];

        const normalizedShortName = shortName.trim().toLocaleUpperCase();

        if (!normalizedShortName) return t('page.onboardingWardCreate.shiftType.validation.shortNameRequired');

        if (hasInvalidShiftShortNameLengthInput(shortName)) {
            return t('page.onboardingWardCreate.shiftType.validation.shortNameLength');
        }

        if (hasInvalidShiftShortNameEntryKey(normalizedShortName)) {
            return t('page.onboardingWardCreate.shiftType.validation.shortNameFirstKey');
        }

        if (duplicatedShiftShortNameKeys.has(getShiftShortNameEntryKey(normalizedShortName))) {
            return t('page.onboardingWardCreate.shiftType.validation.shortNameDuplicate');
        }

        return null;
    };
    const getShiftNameError = (name: string) => {
        if (!name.trim()) return t('page.onboardingWardCreate.shiftType.validation.nameRequired');

        if (name.trim().length > ONBOARDING_SHIFT_NAME_MAX_LENGTH) return t('page.onboardingWardCreate.shiftType.validation.nameLength');

        return null;
    };
    const getShiftTimeError = (shiftType: TOnboardingWardShiftType) => {
        if (isOffShiftType(shiftType) || !isOnboardingShiftMappingResolved(shiftType.mappingStatus)) return null;

        const normalizedStartTime = shiftType.startTime.trim();
        const normalizedEndTime = shiftType.endTime.trim();

        if (!normalizedStartTime || !normalizedEndTime) return t('page.onboardingWardCreate.shiftType.validation.timeRequired');

        const startMinutes = parseShiftTimeToMinutes(normalizedStartTime);
        const endMinutes = parseShiftTimeToMinutes(normalizedEndTime);

        if (startMinutes == null || endMinutes == null) return t('page.onboardingWardCreate.shiftType.validation.timeFormat');

        const isSameTime = endMinutes === startMinutes;

        if (isSameTime) {
            return t('page.onboardingWardCreate.shiftType.validation.timeOrder');
        }

        return null;
    };
    const fieldIssuesById = new Map(
        shiftTypes.map((shiftType) => {
            const issues: TShiftTypeFieldIssue[] = [];
            const shortNameError = getShiftShortNameError(shiftType.id, shiftType.shortName);
            const nameError = getShiftNameError(shiftType.name);
            const timeError = getShiftTimeError(shiftType);

            if (shortNameError) {
                issues.push({
                    id: `onboarding-shift-short-name-error-${shiftType.id}`,
                    label: t('page.onboardingWardCreate.shiftType.shortName'),
                    message: shortNameError,
                    required: !shiftType.shortName.trim(),
                });
            }

            if (nameError) {
                issues.push({
                    id: `onboarding-shift-name-error-${shiftType.id}`,
                    label: t('page.onboardingWardCreate.shiftType.name'),
                    message: nameError,
                    required: !shiftType.name.trim(),
                });
            }

            if (timeError) {
                issues.push({
                    id: `onboarding-shift-time-error-${shiftType.id}`,
                    label: t('page.onboardingWardCreate.shiftType.workTime'),
                    message: timeError,
                    required: !shiftType.startTime.trim() || !shiftType.endTime.trim(),
                });
            }

            return [shiftType.id, issues] as const;
        }),
    );

    useEffect(() => {
        if (!openedColorShiftTypeId) return;

        const handleOutsideClick = (event: MouseEvent) => {
            const target = event.target as Node;

            if (openedColorContainerRef.current?.contains(target)) return;

            setOpenedColorShiftTypeId(null);
        };
        const handleEscape = (event: KeyboardEvent) => {
            if (event.key !== 'Escape') return;

            openedColorContainerRef.current?.querySelector('button')?.focus();
            setOpenedColorShiftTypeId(null);
        };

        document.addEventListener('mousedown', handleOutsideClick);
        document.addEventListener('keydown', handleEscape);

        return () => {
            document.removeEventListener('mousedown', handleOutsideClick);
            document.removeEventListener('keydown', handleEscape);
        };
    }, [openedColorShiftTypeId]);

    return (
        <div className="relative">
            <ShiftTypeRequirements
                shiftTypes={shiftTypes}
                rotationMode={rotationMode}
                requireNightContinuation={requireNightContinuation}
            />
            {reviewRequiredCount > 0 ? (
                <p aria-live="polite" className="mb-3 text-right font-apple text-sm font-medium text-main-1">
                    {t('page.onboardingWardCreate.shiftType.reviewCount', {count: reviewRequiredCount})}
                </p>
            ) : null}
            <div className={styles.table} data-mixed={showRotationSystemColumn || undefined}>
                <div className={styles.header}>
                    <span />
                    <span id="onboarding-shift-short-name-label">{t('page.onboardingWardCreate.shiftType.shortName')}</span>
                    <span id="onboarding-shift-name-label">{t('page.onboardingWardCreate.shiftType.name')}</span>
                    {showRotationSystemColumn ? <span>{t('page.onboardingWardCreate.shiftType.rotation')}</span> : null}
                    <span>{t('page.onboardingWardCreate.shiftType.type')}</span>
                    <span>{t('page.onboardingWardCreate.shiftType.workTime')}</span>
                    <span>{t('page.onboardingWardCreate.shiftType.color')}</span>
                    <span />
                </div>
                <DragDropContext onDragEnd={onDragEnd}>
                    <Droppable droppableId="onboarding-shift-types">
                        {(provided) => (
                            <div ref={provided.innerRef} {...provided.droppableProps} className={styles.list}>
                                {shiftTypes.map((shiftType, index) => (
                                    <Draggable key={shiftType.id} draggableId={shiftType.id} index={index}>
                                        {(dragProvided) => (
                                            <div
                                                ref={dragProvided.innerRef}
                                                {...dragProvided.draggableProps}
                                                id={`onboarding-shift-row-${shiftType.id}`}
                                                tabIndex={-1}
                                                className={styles.row}
                                                data-pending={!isOnboardingShiftMappingResolved(shiftType.mappingStatus) || undefined}
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
                                                    className={styles.drag}
                                                >
                                                    <SixDotsIcon className="h-4 w-4" />
                                                </button>
                                                <div className={styles.code} data-shift-field="code">
                                                    <span aria-hidden="true" className={styles.mobileLabel}>
                                                        {t('page.onboardingWardCreate.shiftType.shortName')}
                                                    </span>
                                                    <CompositionInput
                                                        value={shiftType.shortName}
                                                        onFocus={(event) => {
                                                            if (shiftType.importedCode === shiftType.shortName)
                                                                event.currentTarget.select();
                                                        }}
                                                        onValueChange={(value) => {
                                                            const normalizedShortName = normalizeShiftShortNameInput(value);

                                                            if (hasInvalidShiftShortNameLengthInput(value)) {
                                                                setShortNameErrorById((prev) => ({
                                                                    ...prev,
                                                                    [shiftType.id]: t(
                                                                        'page.onboardingWardCreate.shiftType.validation.shortNameLength',
                                                                    ),
                                                                }));

                                                                if (shiftType.importedCode) return;
                                                            } else if (hasInvalidShiftShortNameEntryKey(normalizedShortName)) {
                                                                setShortNameErrorById((prev) => ({
                                                                    ...prev,
                                                                    [shiftType.id]: t(
                                                                        'page.onboardingWardCreate.shiftType.validation.shortNameFirstKey',
                                                                    ),
                                                                }));
                                                            } else {
                                                                setShortNameErrorById((prev) => ({...prev, [shiftType.id]: ''}));
                                                            }

                                                            onChange(shiftType.id, {shortName: normalizedShortName});
                                                        }}
                                                        variant="foundation"
                                                        fieldSize="lg"
                                                        aria-labelledby="onboarding-shift-short-name-label"
                                                        aria-invalid={Boolean(getShiftShortNameError(shiftType.id, shiftType.shortName))}
                                                        aria-describedby={
                                                            getShiftShortNameError(shiftType.id, shiftType.shortName)
                                                                ? `onboarding-shift-short-name-error-${shiftType.id}`
                                                                : undefined
                                                        }
                                                        className={`h-11 w-full px-1 text-center font-apple text-[15px] ${SHIFT_TYPE_INPUT_SURFACE_CLASS} ${
                                                            getShiftShortNameError(shiftType.id, shiftType.shortName)
                                                                ? SHIFT_TYPE_INPUT_ERROR_CLASS
                                                                : ''
                                                        }`}
                                                        placeholder="-"
                                                    />
                                                </div>
                                                <div className={styles.name} data-shift-field="name">
                                                    <span aria-hidden="true" className={styles.mobileLabel}>
                                                        {t('page.onboardingWardCreate.shiftType.name')}
                                                    </span>
                                                    <CompositionInput
                                                        value={shiftType.name}
                                                        maxLength={ONBOARDING_SHIFT_NAME_MAX_LENGTH}
                                                        onValueChange={(value) => onChange(shiftType.id, {name: value})}
                                                        variant="foundation"
                                                        fieldSize="lg"
                                                        aria-labelledby="onboarding-shift-name-label"
                                                        aria-invalid={Boolean(getShiftNameError(shiftType.name))}
                                                        aria-describedby={
                                                            getShiftNameError(shiftType.name)
                                                                ? `onboarding-shift-name-error-${shiftType.id}`
                                                                : undefined
                                                        }
                                                        className={`h-11 w-full px-3 text-center font-apple text-[15px] ${SHIFT_TYPE_INPUT_SURFACE_CLASS} ${
                                                            getShiftNameError(shiftType.name) ? SHIFT_TYPE_INPUT_ERROR_CLASS : ''
                                                        }`}
                                                        placeholder={t('page.onboardingWardCreate.shiftType.name')}
                                                    />
                                                </div>
                                                {showRotationSystemColumn ? (
                                                    <div className={styles.rotation}>
                                                        <span aria-hidden="true" className={styles.mobileLabel}>
                                                            {t('page.onboardingWardCreate.shiftType.rotation')}
                                                        </span>
                                                        {hasFixedNoneRotationSystem(shiftType) ? (
                                                            <span className="flex h-11 w-full items-center justify-center rounded-lg bg-gray-7 px-2 font-apple text-[13px] text-gray-3">
                                                                {t('page.onboardingWardCreate.shiftType.rotationNone')}
                                                            </span>
                                                        ) : (
                                                            <ShiftClassificationDropdown
                                                                value={
                                                                    isOnboardingShiftMappingResolved(shiftType.mappingStatus)
                                                                        ? (shiftType.rotationSystem ??
                                                                          resolveOnboardingRotationSystem(shiftType))
                                                                        : shiftType.rotationSystem && shiftType.rotationSystem !== 'NONE'
                                                                          ? shiftType.rotationSystem
                                                                          : 'UNASSIGNED'
                                                                }
                                                                options={[
                                                                    ...(!isOnboardingShiftMappingResolved(shiftType.mappingStatus)
                                                                        ? [
                                                                              {
                                                                                  value: 'UNASSIGNED',
                                                                                  label: t(
                                                                                      'page.onboardingWardCreate.shiftType.classification.unassigned',
                                                                                  ),
                                                                              },
                                                                          ]
                                                                        : []),
                                                                    ...getAvailableShiftRotationSystems(shiftType, rotationMode).map(
                                                                        (rotationSystem) => ({
                                                                            value: rotationSystem,
                                                                            label:
                                                                                rotationSystem === 'THREE'
                                                                                    ? t('page.onboardingWardCreate.shiftType.rotationThree')
                                                                                    : rotationSystem === 'TWO'
                                                                                      ? t('page.onboardingWardCreate.shiftType.rotationTwo')
                                                                                      : t(
                                                                                            'page.onboardingWardCreate.shiftType.rotationNone',
                                                                                        ),
                                                                        }),
                                                                    ),
                                                                ]}
                                                                ariaLabel={t('page.onboardingWardCreate.shiftType.rotationAria', {
                                                                    shiftName:
                                                                        shiftType.name ||
                                                                        shiftType.shortName ||
                                                                        t('page.onboardingWardCreate.shiftType.work'),
                                                                })}
                                                                onChange={(value) => {
                                                                    if (value === 'UNASSIGNED') return;

                                                                    changeShiftTypeRotationSystem(
                                                                        shiftType,
                                                                        value as TSelectableShiftRotationSystem,
                                                                    );
                                                                }}
                                                                className="h-11 px-2 pr-7 text-[13px]"
                                                            />
                                                        )}
                                                    </div>
                                                ) : null}
                                                <div className={styles.classification} data-shift-field="classification">
                                                    <span aria-hidden="true" className={styles.mobileLabel}>
                                                        {t('page.onboardingWardCreate.shiftType.type')}
                                                    </span>
                                                    <div className={styles.classificationControl}>
                                                        <ShiftClassificationDropdown
                                                            value={
                                                                isOnboardingShiftMappingResolved(shiftType.mappingStatus)
                                                                    ? shiftType.classification
                                                                    : 'UNASSIGNED'
                                                            }
                                                            options={[
                                                                ...(shiftType.source === 'schedule-input'
                                                                    ? [
                                                                          {
                                                                              value: 'UNASSIGNED',
                                                                              label: t('page.onboardingWardCreate.shiftType.selectType'),
                                                                          },
                                                                      ]
                                                                    : []),
                                                                ...getAvailableShiftClassificationOptions(
                                                                    rotationMode,
                                                                    allowNightContinuation,
                                                                ).map((option) => ({
                                                                    value: option.value,
                                                                    label: t(option.labelKey),
                                                                })),
                                                            ]}
                                                            ariaLabel={t('page.onboardingWardCreate.shiftType.classificationAria', {
                                                                shiftName:
                                                                    shiftType.name ||
                                                                    shiftType.shortName ||
                                                                    t('page.onboardingWardCreate.shiftType.work'),
                                                            })}
                                                            ariaInvalid={Boolean(classificationErrorById.get(shiftType.id))}
                                                            ariaDescribedBy={
                                                                classificationErrorById.get(shiftType.id)
                                                                    ? `onboarding-shift-rotation-error-${shiftType.id}`
                                                                    : undefined
                                                            }
                                                            className={`h-11 ${SHIFT_TYPE_INPUT_SURFACE_CLASS} ${
                                                                classificationErrorById.get(shiftType.id)
                                                                    ? `${SHIFT_TYPE_INPUT_ERROR_CLASS} pr-11 [&>svg]:hidden`
                                                                    : ''
                                                            }`}
                                                            onChange={(value) => {
                                                                if (value === 'UNASSIGNED') {
                                                                    onChange(shiftType.id, {
                                                                        classification: 'OTHER_WORK',
                                                                        rotationSystem: 'NONE',
                                                                        isDefault: false,
                                                                        isOff: false,
                                                                        isCounted: true,
                                                                        paidMinutes: null,
                                                                        mappingStatus: 'UNASSIGNED',
                                                                    });

                                                                    return;
                                                                }

                                                                if (value === 'NIGHT_CONTINUATION' && !allowNightContinuation) return;

                                                                const classification = value as TOnboardingWardShiftType['classification'];
                                                                const currentRotationSystem =
                                                                    shiftType.rotationSystem ?? resolveOnboardingRotationSystem(shiftType);
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

                                                                onChange(
                                                                    shiftType.id,
                                                                    getSemanticShiftTypePatch(shiftType, classification, rotationSystem),
                                                                );
                                                            }}
                                                        />
                                                        {classificationErrorById.get(shiftType.id) ? (
                                                            <ShiftTypeErrorHelp
                                                                id={`onboarding-shift-rotation-error-${shiftType.id}`}
                                                                shiftName={
                                                                    shiftType.name ||
                                                                    shiftType.shortName ||
                                                                    t('page.onboardingWardCreate.shiftType.work')
                                                                }
                                                                message={classificationErrorById.get(shiftType.id)!}
                                                            />
                                                        ) : null}
                                                    </div>
                                                </div>
                                                <div className={styles.time} data-shift-field="time">
                                                    <span aria-hidden="true" className={styles.mobileLabel}>
                                                        {t('page.onboardingWardCreate.shiftType.workTime')}
                                                    </span>
                                                    {isOffShiftType(shiftType) ||
                                                    (!isOnboardingShiftMappingResolved(shiftType.mappingStatus) &&
                                                        !shiftType.startTime &&
                                                        !shiftType.endTime) ? (
                                                        <span className={styles.emptyTime}>—</span>
                                                    ) : (
                                                        <>
                                                            <div className={styles.timeFields}>
                                                                <CompositionInput
                                                                    value={isOffShiftType(shiftType) ? '-' : shiftType.startTime}
                                                                    disabled={isOffShiftType(shiftType)}
                                                                    onValueChange={(value) =>
                                                                        onChange(shiftType.id, {
                                                                            startTime: normalizeShiftTimeInput(value),
                                                                        })
                                                                    }
                                                                    onBlur={(event) =>
                                                                        onChange(shiftType.id, {
                                                                            startTime: toCanonicalShiftTime(event.target.value),
                                                                        })
                                                                    }
                                                                    variant="foundation"
                                                                    fieldSize="lg"
                                                                    aria-invalid={Boolean(getShiftTimeError(shiftType))}
                                                                    aria-describedby={
                                                                        getShiftTimeError(shiftType)
                                                                            ? `onboarding-shift-time-error-${shiftType.id}`
                                                                            : undefined
                                                                    }
                                                                    className={`h-11 min-w-0 text-center font-poppins text-[15px] ${SHIFT_TYPE_INPUT_SURFACE_CLASS} ${
                                                                        getShiftTimeError(shiftType) ? SHIFT_TYPE_INPUT_ERROR_CLASS : ''
                                                                    }`}
                                                                    placeholder="07:00"
                                                                />
                                                                <span className="font-poppins text-[15px] text-gray-3">~</span>
                                                                <CompositionInput
                                                                    value={isOffShiftType(shiftType) ? '-' : shiftType.endTime}
                                                                    disabled={isOffShiftType(shiftType)}
                                                                    onValueChange={(value) =>
                                                                        onChange(shiftType.id, {
                                                                            endTime: normalizeShiftTimeInput(value),
                                                                        })
                                                                    }
                                                                    onBlur={(event) =>
                                                                        onChange(shiftType.id, {
                                                                            endTime: toCanonicalShiftTime(event.target.value),
                                                                        })
                                                                    }
                                                                    variant="foundation"
                                                                    fieldSize="lg"
                                                                    aria-invalid={Boolean(getShiftTimeError(shiftType))}
                                                                    aria-describedby={
                                                                        getShiftTimeError(shiftType)
                                                                            ? `onboarding-shift-time-error-${shiftType.id}`
                                                                            : undefined
                                                                    }
                                                                    className={`h-11 min-w-0 text-center font-poppins text-[15px] ${SHIFT_TYPE_INPUT_SURFACE_CLASS} ${
                                                                        getShiftTimeError(shiftType) ? SHIFT_TYPE_INPUT_ERROR_CLASS : ''
                                                                    }`}
                                                                    placeholder="15:00"
                                                                />
                                                            </div>
                                                        </>
                                                    )}
                                                </div>
                                                <div
                                                    className={styles.color}
                                                    ref={openedColorShiftTypeId === shiftType.id ? openedColorContainerRef : null}
                                                >
                                                    <button
                                                        type="button"
                                                        aria-label={t('page.onboardingWardCreate.shiftType.colorSelectAria', {
                                                            shiftName:
                                                                shiftType.name ||
                                                                shiftType.shortName ||
                                                                t('page.onboardingWardCreate.shiftType.work'),
                                                        })}
                                                        className={styles.colorTrigger}
                                                        aria-expanded={openedColorShiftTypeId === shiftType.id}
                                                        onClick={() =>
                                                            setOpenedColorShiftTypeId((prev) =>
                                                                prev === shiftType.id ? null : shiftType.id,
                                                            )
                                                        }
                                                    >
                                                        <span
                                                            className="h-6 w-6 rounded-[7px]"
                                                            style={{backgroundColor: shiftType.color}}
                                                        />
                                                    </button>
                                                    {openedColorShiftTypeId === shiftType.id ? (
                                                        <div
                                                            className={styles.palette}
                                                            role="group"
                                                            aria-label={t('page.onboardingWardCreate.shiftType.color')}
                                                        >
                                                            {Array.from(new Set([shiftType.color, ...SHIFT_COLOR_OPTIONS])).map((color) => {
                                                                const isSelected = shiftType.color.toLowerCase() === color.toLowerCase();

                                                                return (
                                                                    <button
                                                                        key={color}
                                                                        type="button"
                                                                        aria-label={t(
                                                                            'page.onboardingWardCreate.shiftType.colorOptionAria',
                                                                            {
                                                                                color,
                                                                            },
                                                                        )}
                                                                        className={styles.swatch}
                                                                        aria-pressed={isSelected}
                                                                        style={{backgroundColor: color}}
                                                                        onClick={() => {
                                                                            onChange(shiftType.id, {color});
                                                                            setOpenedColorShiftTypeId(null);
                                                                        }}
                                                                    >
                                                                        {isSelected ? <Check className="h-3.5 w-3.5 text-white" /> : null}
                                                                    </button>
                                                                );
                                                            })}
                                                        </div>
                                                    ) : null}
                                                </div>
                                                <button
                                                    type="button"
                                                    aria-label={t('page.onboardingWardCreate.shiftType.deleteAria', {
                                                        shiftName:
                                                            shiftType.name ||
                                                            shiftType.shortName ||
                                                            t('page.onboardingWardCreate.shiftType.work'),
                                                    })}
                                                    aria-disabled={
                                                        shiftType.protectedByPreviousSchedule === true ||
                                                        isLastOnboardingAnnualLeave(shiftTypes, shiftType.id)
                                                    }
                                                    onClick={() => {
                                                        if (isLastOnboardingAnnualLeave(shiftTypes, shiftType.id)) {
                                                            toast.error(t('page.onboardingWardCreate.toast.annualLeaveRequired'));

                                                            return;
                                                        }

                                                        if (shiftType.protectedByPreviousSchedule) {
                                                            showProtectedDeleteToast();

                                                            return;
                                                        }

                                                        onDelete(shiftType.id);
                                                    }}
                                                    className={styles.delete}
                                                >
                                                    <X className="h-4 w-4" />
                                                </button>
                                                {fieldIssuesById.get(shiftType.id)!.length > 0 ? (
                                                    <div className={styles.rowNotes}>
                                                        <ShiftTypeFeedback issues={fieldIssuesById.get(shiftType.id)!} />
                                                    </div>
                                                ) : null}
                                            </div>
                                        )}
                                    </Draggable>
                                ))}
                                {provided.placeholder}
                            </div>
                        )}
                    </Droppable>
                </DragDropContext>
                <div className="mt-4 flex justify-center">
                    <button type="button" className={`${styles.add} font-apple`} onClick={onAdd}>
                        <span className={styles.addIcon}>
                            <Plus className="h-[11px] w-[11px] text-white" aria-hidden="true" />
                        </span>
                        {t('page.onboardingWardCreate.shiftType.add')}
                    </button>
                </div>
            </div>
        </div>
    );
}

export default ShiftTypeStep;
