import {DragDropContext, Draggable, Droppable, type DropResult} from '@hello-pangea/dnd';
import {Check, CircleAlert, Plus, X} from 'lucide-react';
import {type ReactNode, useEffect, useMemo, useRef, useState} from 'react';
import toast from 'react-hot-toast';
import {SixDotsIcon} from '@/shared/assets/svg';
import {useTypedTranslation} from '@/shared/hook/use-typed-translation';
import {
    getDefaultTimeRangeForRotation,
    getRequiredRotationClassificationCounts,
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
import Card from '@/shared/ui/Card';
import {Input} from '@/shared/ui/primitives/input';
import ShiftClassificationDropdown from '@/shared/ui/ShiftClassificationDropdown';
import {
    DEFAULT_SHIFT_TYPE_COLORS,
    getAutomaticPreviousScheduleShiftMapping,
    isOnboardingShiftMappingResolved,
    resolveOnboardingRotationSystem,
    type TOnboardingRotationMode,
    type TOnboardingWardShiftType,
} from '../../model';

interface IShiftTypeStepProps {
    shiftTypes: TOnboardingWardShiftType[];
    rotationMode: TOnboardingRotationMode;
    onChange: (shiftTypeId: string, updater: Partial<TOnboardingWardShiftType>) => void;
    onDragEnd: (result: DropResult) => void;
    onAdd: () => void;
    onDelete: (shiftTypeId: string) => void;
}

interface IShiftTypeRequirementsProps {
    shiftTypes: TOnboardingWardShiftType[];
    rotationMode: TOnboardingRotationMode;
}

const SHIFT_COLOR_OPTIONS = DEFAULT_SHIFT_TYPE_COLORS;
const SHIFT_NAME_MAX_LENGTH = 12;
const SHIFT_TYPE_GRID_COLS_WITH_ROTATION = 'grid-cols-[32px_minmax(110px,0.95fr)_72px_94px_170px_minmax(220px,1.35fr)_48px_40px]';
const SHIFT_TYPE_GRID_COLS_WITHOUT_ROTATION = 'grid-cols-[32px_minmax(110px,0.95fr)_72px_170px_minmax(220px,1.35fr)_48px_40px]';
const SHIFT_TYPE_INPUT_SURFACE_CLASS =
    'rounded-[10px] border-0 bg-gray-7 ring-1 ring-transparent transition-[background-color,box-shadow] duration-150 ease-out hover:bg-gray-6/50 focus-visible:border-0 focus-visible:bg-white focus-visible:ring-1 focus-visible:ring-main-1/70';
const SHIFT_TYPE_INPUT_ERROR_CLASS =
    'bg-[#FFF7F8] ring-1 ring-red/45 focus-visible:border-0 focus-visible:bg-white focus-visible:ring-red/70';
const SHIFT_TYPE_ROW_CONTROL_CLASS = 'h-10 items-center';
const SHIFT_TIME_FORMAT_REGEX = /^\d{2}:\d{2}$/;
const SHIFT_CLASSIFICATION_OPTIONS = [
    {value: 'DAY', labelKey: 'page.onboardingWardCreate.shiftType.classification.day'},
    {value: 'EVENING', labelKey: 'page.onboardingWardCreate.shiftType.classification.evening'},
    {value: 'NIGHT', labelKey: 'page.onboardingWardCreate.shiftType.classification.night'},
    {value: 'NIGHT_CONTINUATION', labelKey: 'page.onboardingWardCreate.shiftType.classification.nightContinuation'},
    {value: 'OFF', labelKey: 'page.onboardingWardCreate.shiftType.classification.off'},
    {value: 'OTHER_WORK', labelKey: 'page.onboardingWardCreate.shiftType.classification.otherWork'},
    {value: 'OTHER_LEAVE', labelKey: 'page.onboardingWardCreate.shiftType.classification.otherLeave'},
] as const;

function getAvailableShiftClassificationOptions(rotationMode: TOnboardingRotationMode) {
    const selectableClassifications = getSelectableClassificationsForWardMode(rotationMode);

    return SHIFT_CLASSIFICATION_OPTIONS.filter((option) =>
        selectableClassifications.some((classification) => classification === option.value),
    );
}

function getShiftClassificationForRotationSelection(shiftType: TOnboardingWardShiftType, rotationMode: TOnboardingRotationMode) {
    return isOnboardingShiftMappingResolved(shiftType.mappingStatus)
        ? shiftType.classification
        : (getAutomaticPreviousScheduleShiftMapping(shiftType.shortName, rotationMode)?.classification ??
              shiftType.mappingRecommendation?.classification);
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
        (shiftType.classification === 'OFF' || shiftType.classification === 'OTHER_WORK' || shiftType.classification === 'OTHER_LEAVE')
    );
}

function isOffShiftType(shiftType: TOnboardingWardShiftType) {
    return shiftType.isOff || shiftType.classification === 'OFF' || shiftType.classification === 'OTHER_LEAVE';
}

export function ShiftTypeRequirements({shiftTypes, rotationMode}: IShiftTypeRequirementsProps) {
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
                    .filter((shiftType) => isOnboardingShiftMappingResolved(shiftType.mappingStatus))
                    .map((shiftType) => ({
                        classification: shiftType.classification,
                        rotationSystem: resolveOnboardingRotationSystem(shiftType),
                    })),
            ),
        [rotationMode, shiftTypes],
    );
    const satisfiedCount = requiredShiftTypeStatuses.filter(({count}) => count === 1).length;
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
        <section id="required-shift-types" aria-labelledby="required-shift-types-title" className="mb-7 scroll-mt-6">
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
                                const isSatisfied = requiredShiftType.count === 1;
                                const statusLabel = isSatisfied
                                    ? t('page.onboardingWardCreate.shiftType.requirements.satisfied', {
                                          scope,
                                          shiftType: classificationLabel,
                                      })
                                    : requiredShiftType.count === 0
                                      ? t('page.onboardingWardCreate.shiftType.requirements.missing', {
                                            scope,
                                            shiftType: classificationLabel,
                                        })
                                      : t('page.onboardingWardCreate.shiftType.requirements.duplicate', {
                                            scope,
                                            shiftType: classificationLabel,
                                            count: requiredShiftType.count,
                                        });
                                const issueLabel =
                                    requiredShiftType.count === 0
                                        ? t('page.onboardingWardCreate.shiftType.requirements.missingShort')
                                        : t('page.onboardingWardCreate.shiftType.requirements.duplicateShort', {
                                              count: requiredShiftType.count,
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

export function ShiftTypeStep({shiftTypes, rotationMode, onChange, onDragEnd, onAdd, onDelete}: IShiftTypeStepProps) {
    const {t} = useTypedTranslation();
    const [openedColorShiftTypeId, setOpenedColorShiftTypeId] = useState<string | null>(null);
    const [shortNameErrorById, setShortNameErrorById] = useState<Record<string, string>>({});
    const openedColorContainerRef = useRef<HTMLDivElement | null>(null);
    const showRotationSystemColumn = rotationMode === 'MIXED';
    const shiftTypeGridCols = showRotationSystemColumn ? SHIFT_TYPE_GRID_COLS_WITH_ROTATION : SHIFT_TYPE_GRID_COLS_WITHOUT_ROTATION;
    const showProtectedDeleteToast = () => {
        toast.error(t('page.onboardingWardCreate.toast.previousScheduleDeleteLocked'));
    };
    const getSemanticShiftTypePatch = (
        shiftType: TOnboardingWardShiftType,
        classification: TOnboardingWardShiftType['classification'],
        rotationSystem: TSelectableShiftRotationSystem,
    ): Partial<TOnboardingWardShiftType> => {
        const isOff = classification === 'OFF' || classification === 'OTHER_LEAVE';
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
    const getShiftDurationLabel = (shiftType: TOnboardingWardShiftType) => {
        if (isOffShiftType(shiftType) || !isOnboardingShiftMappingResolved(shiftType.mappingStatus)) return '';

        const startMinutes = parseShiftTimeToMinutes(shiftType.startTime.trim());
        const endMinutes = parseShiftTimeToMinutes(shiftType.endTime.trim());

        if (startMinutes == null || endMinutes == null || endMinutes === startMinutes) {
            return '-';
        }

        const diffMinutes = endMinutes < startMinutes ? endMinutes + 24 * 60 - startMinutes : endMinutes - startMinutes;
        const hours = Math.floor(diffMinutes / 60);
        const minutes = diffMinutes % 60;

        if (minutes === 0) {
            return `${hours}h`;
        }

        return `${hours}h ${minutes}m`;
    };
    const getMappingRecommendationLabel = (shiftType: TOnboardingWardShiftType) => {
        const recommendation = shiftType.mappingRecommendation;

        if (!recommendation) return null;

        const classificationOption = SHIFT_CLASSIFICATION_OPTIONS.find((option) => option.value === recommendation.classification);
        const classificationLabel = classificationOption ? t(classificationOption.labelKey) : recommendation.classification;

        if (recommendation.rotationSystem === 'NONE') return classificationLabel;

        const rotationLabel =
            recommendation.rotationSystem === 'TWO'
                ? t('page.onboardingWardCreate.shiftType.rotationTwo')
                : t('page.onboardingWardCreate.shiftType.rotationThree');

        return `${rotationLabel} · ${classificationLabel}`;
    };

    useEffect(() => {
        if (!openedColorShiftTypeId) return;

        const handleOutsideClick = (event: MouseEvent) => {
            const target = event.target as Node;

            if (openedColorContainerRef.current?.contains(target)) return;

            setOpenedColorShiftTypeId(null);
        };

        document.addEventListener('mousedown', handleOutsideClick);

        return () => {
            document.removeEventListener('mousedown', handleOutsideClick);
        };
    }, [openedColorShiftTypeId]);

    return (
        <div className="relative">
            <ShiftTypeRequirements shiftTypes={shiftTypes} rotationMode={rotationMode} />
            <Card
                variant="elevated"
                padding="none"
                className="w-full max-w-[1120px] min-w-0 border-transparent bg-transparent p-0 shadow-none"
            >
                <div
                    className={`mb-2 grid ${shiftTypeGridCols} items-center gap-4 px-3 text-center font-apple text-[13px] font-medium text-gray-3`}
                >
                    <span />
                    <span>{t('page.onboardingWardCreate.shiftType.name')}</span>
                    <span>{t('page.onboardingWardCreate.shiftType.shortName')}</span>
                    {showRotationSystemColumn ? <span>{t('page.onboardingWardCreate.shiftType.rotation')}</span> : null}
                    <span>{t('page.onboardingWardCreate.shiftType.type')}</span>
                    <span>{t('page.onboardingWardCreate.shiftType.workTime')}</span>
                    <span>{t('page.onboardingWardCreate.shiftType.color')}</span>
                    <span />
                </div>
                <DragDropContext onDragEnd={onDragEnd}>
                    <Droppable droppableId="onboarding-shift-types">
                        {(provided) => (
                            <div
                                ref={provided.innerRef}
                                {...provided.droppableProps}
                                className="overflow-visible rounded-[16px] bg-white px-1 py-1"
                            >
                                {shiftTypes.map((shiftType, index) => (
                                    <Draggable key={shiftType.id} draggableId={shiftType.id} index={index}>
                                        {(dragProvided) => (
                                            <div
                                                ref={dragProvided.innerRef}
                                                {...dragProvided.draggableProps}
                                                className={`grid ${shiftTypeGridCols} items-start gap-4 rounded-[12px] px-3 py-3 ${
                                                    !isOnboardingShiftMappingResolved(shiftType.mappingStatus) ? 'bg-gray-7/70' : ''
                                                }`}
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
                                                <div className="flex flex-col items-center gap-1">
                                                    <Input
                                                        value={shiftType.name}
                                                        maxLength={SHIFT_NAME_MAX_LENGTH}
                                                        onChange={(event) => onChange(shiftType.id, {name: event.target.value})}
                                                        variant="foundation"
                                                        fieldSize="lg"
                                                        aria-invalid={Boolean(getShiftNameError(shiftType.name))}
                                                        aria-describedby={
                                                            getShiftNameError(shiftType.name)
                                                                ? `onboarding-shift-name-error-${shiftType.id}`
                                                                : undefined
                                                        }
                                                        className={`h-10 w-full px-3 text-center font-apple text-[15px] ${SHIFT_TYPE_INPUT_SURFACE_CLASS} ${
                                                            getShiftNameError(shiftType.name) ? SHIFT_TYPE_INPUT_ERROR_CLASS : ''
                                                        }`}
                                                        placeholder={t('page.onboardingWardCreate.shiftType.name')}
                                                    />
                                                    {getShiftNameError(shiftType.name) ? (
                                                        <InlineFieldError id={`onboarding-shift-name-error-${shiftType.id}`}>
                                                            {getShiftNameError(shiftType.name)}
                                                        </InlineFieldError>
                                                    ) : null}
                                                </div>
                                                <div className="flex flex-col items-center gap-1">
                                                    <Input
                                                        value={shiftType.shortName}
                                                        maxLength={SHIFT_SHORT_NAME_MAX_LENGTH}
                                                        onChange={(event) => {
                                                            const normalizedShortName = normalizeShiftShortNameInput(event.target.value);

                                                            if (hasInvalidShiftShortNameLengthInput(event.target.value)) {
                                                                setShortNameErrorById((prev) => ({
                                                                    ...prev,
                                                                    [shiftType.id]: t(
                                                                        'page.onboardingWardCreate.shiftType.validation.shortNameLength',
                                                                    ),
                                                                }));
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
                                                        aria-invalid={Boolean(getShiftShortNameError(shiftType.id, shiftType.shortName))}
                                                        aria-describedby={
                                                            getShiftShortNameError(shiftType.id, shiftType.shortName)
                                                                ? `onboarding-shift-short-name-error-${shiftType.id}`
                                                                : undefined
                                                        }
                                                        className={`h-10 w-16 px-1 text-center font-apple text-[15px] ${SHIFT_TYPE_INPUT_SURFACE_CLASS} ${
                                                            getShiftShortNameError(shiftType.id, shiftType.shortName)
                                                                ? SHIFT_TYPE_INPUT_ERROR_CLASS
                                                                : ''
                                                        }`}
                                                        placeholder="-"
                                                    />
                                                    {getShiftShortNameError(shiftType.id, shiftType.shortName) ? (
                                                        <InlineFieldError id={`onboarding-shift-short-name-error-${shiftType.id}`}>
                                                            {getShiftShortNameError(shiftType.id, shiftType.shortName)}
                                                        </InlineFieldError>
                                                    ) : null}
                                                </div>
                                                {showRotationSystemColumn ? (
                                                    <div className="flex h-10 items-center justify-center">
                                                        {hasFixedNoneRotationSystem(shiftType) ? (
                                                            <span className="flex h-10 w-full items-center justify-center rounded-[10px] bg-gray-7 px-2 font-apple text-[13px] text-gray-3">
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
                                                                className="px-2 pr-7 text-[13px]"
                                                            />
                                                        )}
                                                    </div>
                                                ) : null}
                                                <div className="relative mx-auto flex w-full max-w-[180px] flex-col items-center gap-1">
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
                                                                          label: t(
                                                                              'page.onboardingWardCreate.shiftType.classification.unassigned',
                                                                          ),
                                                                      },
                                                                  ]
                                                                : []),
                                                            ...getAvailableShiftClassificationOptions(rotationMode).map((option) => ({
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

                                                            const classification = value as TOnboardingWardShiftType['classification'];
                                                            const currentRotationSystem =
                                                                shiftType.rotationSystem ?? resolveOnboardingRotationSystem(shiftType);
                                                            const selectableRotationSystems = getSelectableRotationSystemsForClassification(
                                                                rotationMode,
                                                                classification,
                                                            );
                                                            const rotationSystem = selectableRotationSystems.includes(currentRotationSystem)
                                                                ? currentRotationSystem
                                                                : (selectableRotationSystems[0] ?? 'NONE');

                                                            onChange(
                                                                shiftType.id,
                                                                getSemanticShiftTypePatch(shiftType, classification, rotationSystem),
                                                            );
                                                        }}
                                                    />
                                                    {!isOnboardingShiftMappingResolved(shiftType.mappingStatus) ? (
                                                        <p
                                                            className={`text-center font-apple text-[11px] leading-[1.35] ${
                                                                getMappingRecommendationLabel(shiftType) ? 'text-gray-3' : 'text-red'
                                                            }`}
                                                            role={getMappingRecommendationLabel(shiftType) ? undefined : 'alert'}
                                                        >
                                                            {getMappingRecommendationLabel(shiftType)
                                                                ? t('page.onboardingWardCreate.shiftType.mappingRecommendation', {
                                                                      shiftType: getMappingRecommendationLabel(shiftType) ?? '',
                                                                  })
                                                                : t('page.onboardingWardCreate.shiftType.mappingRequired')}
                                                        </p>
                                                    ) : null}
                                                </div>
                                                <div className="ml-[12px] flex justify-center self-start">
                                                    <div className="flex items-start">
                                                        <div className="flex flex-col gap-1">
                                                            <div className="flex items-center gap-2">
                                                                <Input
                                                                    value={isOffShiftType(shiftType) ? '-' : shiftType.startTime}
                                                                    disabled={isOffShiftType(shiftType)}
                                                                    onChange={(event) =>
                                                                        onChange(shiftType.id, {
                                                                            startTime: normalizeShiftTimeInput(event.target.value),
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
                                                                    className={`h-10 text-center font-poppins text-[15px] ${SHIFT_TYPE_INPUT_SURFACE_CLASS} ${
                                                                        getShiftTimeError(shiftType) ? SHIFT_TYPE_INPUT_ERROR_CLASS : ''
                                                                    }`}
                                                                    placeholder="07:00"
                                                                />
                                                                <span className="font-poppins text-[15px] text-gray-3">~</span>
                                                                <Input
                                                                    value={isOffShiftType(shiftType) ? '-' : shiftType.endTime}
                                                                    disabled={isOffShiftType(shiftType)}
                                                                    onChange={(event) =>
                                                                        onChange(shiftType.id, {
                                                                            endTime: normalizeShiftTimeInput(event.target.value),
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
                                                                    className={`h-10 text-center font-poppins text-[15px] ${SHIFT_TYPE_INPUT_SURFACE_CLASS} ${
                                                                        getShiftTimeError(shiftType) ? SHIFT_TYPE_INPUT_ERROR_CLASS : ''
                                                                    }`}
                                                                    placeholder="15:00"
                                                                />
                                                            </div>
                                                            {getShiftTimeError(shiftType) ? (
                                                                <InlineFieldError id={`onboarding-shift-time-error-${shiftType.id}`}>
                                                                    {getShiftTimeError(shiftType)}
                                                                </InlineFieldError>
                                                            ) : null}
                                                        </div>
                                                        <span className="ml-2 flex h-10 min-w-[52px] items-center font-poppins text-[11px] leading-none whitespace-nowrap text-gray-4">
                                                            {getShiftDurationLabel(shiftType)}
                                                        </span>
                                                    </div>
                                                </div>
                                                <div
                                                    className={`relative flex justify-center self-start ${SHIFT_TYPE_ROW_CONTROL_CLASS}`}
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
                                                        className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-[10px] bg-gray-7"
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
                                                        <div className="absolute top-full left-1/2 z-[1000] mt-2 grid w-[126px] -translate-x-1/2 grid-cols-5 gap-2 rounded-[10px] bg-white p-2 shadow-[0px_10px_28px_rgba(95,100,135,0.16)]">
                                                            {SHIFT_COLOR_OPTIONS.map((color) => {
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
                                                                        className="flex h-5 w-5 items-center justify-center rounded-[6px] border border-black/20 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.35)]"
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
                                                    aria-disabled={shiftType.protectedByPreviousSchedule}
                                                    onClick={() => {
                                                        if (shiftType.protectedByPreviousSchedule) {
                                                            showProtectedDeleteToast();

                                                            return;
                                                        }

                                                        onDelete(shiftType.id);
                                                    }}
                                                    className={`flex w-10 justify-center self-start rounded-full text-gray-4 hover:bg-gray-7 hover:text-sub-1 ${SHIFT_TYPE_ROW_CONTROL_CLASS} ${
                                                        shiftType.protectedByPreviousSchedule ? 'cursor-not-allowed opacity-50' : ''
                                                    }`}
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
                <div className="mt-4 flex justify-end">
                    <button
                        type="button"
                        className="group flex items-center gap-2 font-apple text-[16px] font-medium text-gray-3 transition-colors hover:text-sub-2.5"
                        onClick={onAdd}
                    >
                        <span className="flex h-[19px] w-[19px] items-center justify-center rounded-full bg-gray-3 transition-colors group-hover:bg-sub-2.5">
                            <Plus className="h-[11px] w-[11px] text-white" />
                        </span>
                        {t('page.onboardingWardCreate.shiftType.add')}
                    </button>
                </div>
            </Card>
        </div>
    );
}

export default ShiftTypeStep;
