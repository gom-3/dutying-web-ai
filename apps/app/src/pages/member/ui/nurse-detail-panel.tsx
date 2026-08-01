import {cn} from '@dutying/utils/style';
import {produce} from 'immer';
import {ArrowRightLeft, Check, ChevronDown, ChevronRight, Loader2} from 'lucide-react';
import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {createPortal} from 'react-dom';
import toast from 'react-hot-toast';
import {events, sendEvent} from '@/analytics';
import {type TNurse, type TShiftTeam, type TWardShiftType} from '@/entities';
import useEditShiftTeam from '@/features/edit-shift-team';
import {InfoIcon, LinkedIcon, UnlinkedIcon} from '@/shared/assets/svg';
import {useTypedTranslation} from '@/shared/hook/use-typed-translation';
import TextField from '@/shared/ui/form-controls/TextField';
import {Switch} from '@/shared/ui/primitives/switch';
import {Tooltip, TooltipContent, TooltipProvider, TooltipTrigger} from '@/shared/ui/primitives/tooltip';
import {hasNurseChanges, hasNurseProfileChanges} from '../model/nurse-edit';
import {getMemoWithoutRoleMarkers, hasNursePrecepteeRole, hasNursePreceptorRole, normalizeNurseRoleFields} from '../model/nurse-role';
import {DEFAULT_NURSE_SHIFT_RATIO_WEIGHT, resolveNurseShiftTypeOptions} from '../model/nurse-shift-types';

interface INurseDetailPanelProps {
    onClose: () => void;
    onOpenWardCodeGuide: () => void;
    onRegisterDraftActions?: (actions: {save: () => Promise<boolean>; discard: () => void} | null) => void;
    shiftTeams: TShiftTeam[] | undefined;
    onMoveShiftTeam: (shiftTeamId: number) => Promise<boolean>;
    wardShiftTypes: TWardShiftType[] | undefined;
}

const MIN_SHIFT_RATIO_WEIGHT = 1;
const MAX_SHIFT_RATIO_WEIGHT = 99;
const BIRTH_DATE_DIGIT_MAX_LENGTH = 8;
const LOCAL_DATE_KEY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const MONTHLY_SHIFT_RATIO_CLASSIFICATIONS = [
    'DAY',
    'EVENING',
    'NIGHT',
    'OFF',
] as const satisfies readonly TWardShiftType['classification'][];

const isValidBirthDateParts = (year: number, month: number, day: number) => {
    if (!Number.isInteger(year) || year < 1000 || year > 9999) return false;
    if (!Number.isInteger(month) || month < 1 || month > 12) return false;
    if (!Number.isInteger(day) || day < 1) return false;

    return day <= new Date(year, month, 0).getDate();
};
const getBirthDateDigits = (value: string) => value.replace(/\D/g, '').slice(0, BIRTH_DATE_DIGIT_MAX_LENGTH);
const formatBirthDateDigits = (digits: string) => [digits.slice(0, 4), digits.slice(4, 6), digits.slice(6, 8)].filter(Boolean).join('.');
const formatBirthDateInput = (birthDate?: string | null) => {
    if (!birthDate) return '';

    const match = LOCAL_DATE_KEY_PATTERN.exec(birthDate);

    if (match) return `${match[1]}.${match[2]}.${match[3]}`;

    return formatBirthDateDigits(getBirthDateDigits(birthDate));
};
const toBirthDateKeyFromDigits = (digits: string) => {
    if (digits.length !== BIRTH_DATE_DIGIT_MAX_LENGTH) return null;

    const yearDigits = digits.slice(0, 4);
    const monthDigits = digits.slice(4, 6);
    const dayDigits = digits.slice(6, 8);
    const year = Number(yearDigits);
    const month = Number(monthDigits);
    const day = Number(dayDigits);

    if (!isValidBirthDateParts(year, month, day)) return null;

    return `${yearDigits}-${monthDigits}-${dayDigits}`;
};
const toBirthDateInputText = (value: string) => formatBirthDateDigits(getBirthDateDigits(value));

const toShiftRatioWeight = (value: number | null | undefined) =>
    typeof value === 'number' && Number.isFinite(value)
        ? Math.min(MAX_SHIFT_RATIO_WEIGHT, Math.max(MIN_SHIFT_RATIO_WEIGHT, Math.round(value)))
        : DEFAULT_NURSE_SHIFT_RATIO_WEIGHT;
const toShiftTypeColor = (value: string | null | undefined) => {
    if (!value) return '#BFC7D4';

    return value.startsWith('#') ? value : `#${value}`;
};
const isMonthlyShiftRatioClassification = (classification: TWardShiftType['classification'] | null | undefined) =>
    MONTHLY_SHIFT_RATIO_CLASSIFICATIONS.some((targetClassification) => targetClassification === classification);
const getMonthlyShiftRatioClassificationOrder = (classification: TWardShiftType['classification'] | null | undefined) => {
    const index = MONTHLY_SHIFT_RATIO_CLASSIFICATIONS.findIndex((targetClassification) => targetClassification === classification);

    return index === -1 ? MONTHLY_SHIFT_RATIO_CLASSIFICATIONS.length : index;
};

function BirthDateInput({
    value,
    disabled,
    onChange,
    onValidityChange,
}: {
    value: string | null | undefined;
    disabled: boolean;
    onChange: (birthDate: string | null) => void;
    onValidityChange: (isValid: boolean) => void;
}) {
    const {t} = useTypedTranslation();
    const label = t('page.member.detail.birthDate');
    const [inputText, setInputText] = useState(() => formatBirthDateInput(value));
    const inputDigits = getBirthDateDigits(inputText);
    const inputDateKey = toBirthDateKeyFromDigits(inputDigits);
    const isInputValid = inputText.length === 0 || Boolean(inputDateKey);

    useEffect(() => {
        setInputText(formatBirthDateInput(value));
    }, [value]);

    useEffect(() => {
        onValidityChange(isInputValid);
    }, [isInputValid, onValidityChange]);

    const handleInputChange = (nextValue: string) => {
        const nextText = toBirthDateInputText(nextValue);
        const nextDateKey = toBirthDateKeyFromDigits(getBirthDateDigits(nextText));

        setInputText(nextText);

        if (!nextText) {
            onChange(null);

            return;
        }

        if (nextDateKey) {
            onChange(nextDateKey);
        }
    };

    return (
        <div className="mb-2.5">
            <div className="flex items-center justify-between gap-3">
                <label htmlFor="nurseBirthDate" className="font-apple text-[13px] font-semibold text-[#5C667D] min-[1600px]:text-[14px]">
                    {label}
                </label>
                {!value ? (
                    <span className="font-apple text-[12px] font-medium text-gray-4 min-[1600px]:text-[13px]">
                        {t('page.member.detail.birthDateEmpty')}
                    </span>
                ) : null}
            </div>
            <div
                className={cn(
                    'mt-2 flex h-10 w-full shrink-0 items-center gap-2 rounded-[9px] border border-gray-6 bg-main-bg px-2.5 transition-colors focus-within:border-main-1 focus-within:outline-1 focus-within:outline-main-1 min-[1600px]:text-[14px]',
                    isInputValid ? undefined : 'border-[#E57373] bg-white focus-within:border-[#E57373] focus-within:outline-[#E57373]',
                    disabled ? 'cursor-not-allowed opacity-50' : undefined,
                )}
            >
                <input
                    id="nurseBirthDate"
                    type="text"
                    inputMode="numeric"
                    disabled={disabled}
                    name="nurseBirthDate"
                    aria-label={label}
                    aria-invalid={!isInputValid}
                    maxLength={10}
                    placeholder="YYYY.MM.DD"
                    className="h-full min-w-0 flex-1 bg-transparent font-poppins text-[13px] text-sub-1 outline-none placeholder:font-apple placeholder:text-gray-4 disabled:cursor-not-allowed min-[1600px]:text-[14px]"
                    value={inputText}
                    onChange={(event) => handleInputChange(event.target.value)}
                />
            </div>
        </div>
    );
}

function NurseDetailPanel({
    onClose,
    onOpenWardCodeGuide,
    onRegisterDraftActions,
    shiftTeams,
    onMoveShiftTeam,
    wardShiftTypes,
}: INurseDetailPanelProps) {
    const {
        state: {selectedNurse, selectedNurseDrawerMode, nurseSaveStatus, isDeletingNurse},
        actions: {updateNurse, updateNurseShift, deleteNurse, setNurseDraftDirty, disconnectNurse},
    } = useEditShiftTeam();
    const {t} = useTypedTranslation();
    const [writeNurse, setWriteNurse] = useState<TNurse | null>(null);
    const [showNameRequiredError, setShowNameRequiredError] = useState(false);
    const [disconnectConfirmModalOpen, setDisconnectConfirmModalOpen] = useState(false);
    const [deleteConfirmModalOpen, setDeleteConfirmModalOpen] = useState(false);
    const [moveTeamMenuOpen, setMoveTeamMenuOpen] = useState(false);
    const [isMovingTeam, setIsMovingTeam] = useState(false);
    const [exitConfirmModalOpen, setExitConfirmModalOpen] = useState(false);
    const [isBirthDateDraftValid, setIsBirthDateDraftValid] = useState(true);
    const [isShiftRatioOpen, setIsShiftRatioOpen] = useState(false);
    const textInputRef = useRef<HTMLInputElement>(null);
    const memoTextareaRef = useRef<HTMLTextAreaElement>(null);
    const moveTeamMenuRef = useRef<HTMLDivElement>(null);
    const modalRoot = document.getElementById('modal-root') ?? document.body;
    const isDirty = hasNurseChanges(selectedNurse, writeNurse);
    const isBusy = nurseSaveStatus === 'saving' || isDeletingNurse || isMovingTeam;
    const isCreateMode = selectedNurseDrawerMode === 'create';
    const isPreceptor = hasNursePreceptorRole(writeNurse);
    const isPreceptee = hasNursePrecepteeRole(writeNurse);
    const canSaveCreateDraft = (draft: TNurse) => draft.name.trim().length > 0;
    const nurseNameForAria = writeNurse?.name.trim() ? writeNurse.name : t('page.member.common.nurseFallback');
    useEffect(() => {
        setWriteNurse(selectedNurse ? normalizeNurseRoleFields(selectedNurse) : null);
        setShowNameRequiredError(false);
        setMoveTeamMenuOpen(false);
        setIsMovingTeam(false);
        setIsBirthDateDraftValid(true);
        setIsShiftRatioOpen(false);

        if (selectedNurse) textInputRef.current?.focus();
    }, [selectedNurse]);

    useEffect(() => {
        if (!moveTeamMenuOpen) return;

        const closeOnOutsideClick = (event: MouseEvent) => {
            if (moveTeamMenuRef.current?.contains(event.target as Node)) return;

            setMoveTeamMenuOpen(false);
        };

        document.addEventListener('mousedown', closeOnOutsideClick);

        return () => {
            document.removeEventListener('mousedown', closeOnOutsideClick);
        };
    }, [moveTeamMenuOpen]);

    useEffect(() => {
        setNurseDraftDirty(isDirty);
    }, [isDirty, setNurseDraftDirty]);

    const shiftTypeColorById = useMemo(
        () => new Map((wardShiftTypes ?? []).map((shiftType) => [shiftType.wardShiftTypeId, shiftType.color])),
        [wardShiftTypes],
    );
    const wardShiftTypeById = useMemo(
        () => new Map((wardShiftTypes ?? []).map((shiftType) => [shiftType.wardShiftTypeId, shiftType])),
        [wardShiftTypes],
    );
    const shiftTypeOptions = useMemo(() => {
        if (!writeNurse) return [];

        return resolveNurseShiftTypeOptions(writeNurse.nurseShiftTypes, wardShiftTypes);
    }, [wardShiftTypes, writeNurse]);
    const possibleShiftRatioOptions = useMemo(
        () =>
            shiftTypeOptions
                .filter((shiftType) => {
                    const classification =
                        typeof shiftType.wardShiftTypeId === 'number'
                            ? wardShiftTypeById.get(shiftType.wardShiftTypeId)?.classification
                            : undefined;

                    return shiftType.isPossible && isMonthlyShiftRatioClassification(classification);
                })
                .sort((left, right) => {
                    const leftClassification =
                        typeof left.wardShiftTypeId === 'number' ? wardShiftTypeById.get(left.wardShiftTypeId)?.classification : undefined;
                    const rightClassification =
                        typeof right.wardShiftTypeId === 'number'
                            ? wardShiftTypeById.get(right.wardShiftTypeId)?.classification
                            : undefined;
                    const classificationOrder =
                        getMonthlyShiftRatioClassificationOrder(leftClassification) -
                        getMonthlyShiftRatioClassificationOrder(rightClassification);

                    if (classificationOrder !== 0) return classificationOrder;

                    return (left.wardShiftTypeId ?? left.apiShiftTypeId) - (right.wardShiftTypeId ?? right.apiShiftTypeId);
                }),
        [shiftTypeOptions, wardShiftTypeById],
    );
    const shiftRatioTotal = useMemo(
        () => possibleShiftRatioOptions.reduce((sum, shiftType) => sum + toShiftRatioWeight(shiftType.targetRatioWeight), 0),
        [possibleShiftRatioOptions],
    );
    const shiftRatioDisplayOptions = useMemo(
        () =>
            possibleShiftRatioOptions.map((shiftType) => {
                const weight = toShiftRatioWeight(shiftType.targetRatioWeight);
                const percent = shiftRatioTotal > 0 ? (weight / shiftRatioTotal) * 100 : 0;
                const color = toShiftTypeColor(
                    typeof shiftType.wardShiftTypeId === 'number' ? shiftTypeColorById.get(shiftType.wardShiftTypeId) : undefined,
                );

                return {
                    shiftType,
                    label: shiftType.shortName || shiftType.name,
                    weight,
                    percent,
                    roundedPercent: Math.round(percent),
                    color,
                };
            }),
        [possibleShiftRatioOptions, shiftRatioTotal, shiftTypeColorById],
    );
    const selectedShiftTeamId = useMemo(() => {
        if (!selectedNurse) return null;

        return (
            selectedNurse.shiftTeamId ??
            shiftTeams?.find((shiftTeam) => shiftTeam.nurses.some((nurse) => nurse.nurseId === selectedNurse.nurseId))?.shiftTeamId ??
            null
        );
    }, [selectedNurse, shiftTeams]);
    const moveTargetShiftTeams = useMemo(
        () => (shiftTeams ?? []).filter((shiftTeam) => shiftTeam.shiftTeamId !== selectedShiftTeamId),
        [selectedShiftTeamId, shiftTeams],
    );
    const updateShiftRatioWeight = useCallback(
        (params: {
            apiShiftTypeId: number;
            wardShiftTypeId?: number;
            name: string;
            shortName?: string;
            targetRatioWeight: number;
            isPossible?: boolean;
            isPreferred?: boolean;
        }) => {
            const nextTargetRatioWeight = toShiftRatioWeight(params.targetRatioWeight);

            setWriteNurse((prev) =>
                prev
                    ? {
                          ...prev,
                          nurseShiftTypes: produce(prev.nurseShiftTypes, (draft) => {
                              const target = draft.find(
                                  (x) =>
                                      (typeof params.wardShiftTypeId === 'number' && x.wardShiftTypeId === params.wardShiftTypeId) ||
                                      x.nurseShiftTypeId === params.apiShiftTypeId,
                              );

                              if (target) {
                                  target.targetRatioWeight = nextTargetRatioWeight;

                                  return;
                              }

                              draft.push({
                                  nurseShiftTypeId: params.apiShiftTypeId,
                                  wardShiftTypeId: params.wardShiftTypeId,
                                  name: params.name,
                                  shortName: params.shortName ?? '',
                                  isPossible: params.isPossible ?? true,
                                  isPreferred: params.isPreferred ?? false,
                                  targetRatioWeight: nextTargetRatioWeight,
                              });
                          }),
                      }
                    : prev,
            );
        },
        [],
    );
    const handleSave = useCallback(async () => {
        if (!selectedNurse || !writeNurse || isBusy) return false;

        if (writeNurse.name.trim().length === 0) {
            setShowNameRequiredError(true);

            return false;
        }

        if (isCreateMode && !canSaveCreateDraft(writeNurse)) return false;

        if (!isBirthDateDraftValid) return false;

        const originalShiftTypeByWardShiftTypeId = new Map(
            selectedNurse.nurseShiftTypes.flatMap((shiftType) =>
                typeof shiftType.wardShiftTypeId === 'number' ? ([[shiftType.wardShiftTypeId, shiftType]] as const) : [],
            ),
        );
        const originalShiftTypeByNurseShiftTypeId = new Map(
            selectedNurse.nurseShiftTypes.map((shiftType) => [shiftType.nurseShiftTypeId, shiftType]),
        );
        const changedShiftTypes = shiftTypeOptions.filter((draftShiftType) => {
            const originalShiftType =
                (typeof draftShiftType.wardShiftTypeId === 'number'
                    ? originalShiftTypeByWardShiftTypeId.get(draftShiftType.wardShiftTypeId)
                    : undefined) ?? originalShiftTypeByNurseShiftTypeId.get(draftShiftType.apiShiftTypeId);
            const originalIsPossible = originalShiftType?.isPossible ?? true;
            const originalTargetRatioWeight = toShiftRatioWeight(originalShiftType?.targetRatioWeight);
            const draftTargetRatioWeight = toShiftRatioWeight(draftShiftType.targetRatioWeight);

            return originalIsPossible !== draftShiftType.isPossible || originalTargetRatioWeight !== draftTargetRatioWeight;
        });

        for (const shiftType of changedShiftTypes) {
            const saved = await updateNurseShift(
                writeNurse.nurseId,
                shiftType.apiShiftTypeId,
                {isPossible: shiftType.isPossible, targetRatioWeight: toShiftRatioWeight(shiftType.targetRatioWeight)},
                {
                    wardShiftTypeId: shiftType.wardShiftTypeId,
                    name: shiftType.name,
                    shortName: shiftType.shortName ?? '',
                    targetRatioWeight: toShiftRatioWeight(shiftType.targetRatioWeight),
                },
            );

            if (!saved) return false;
        }

        if (hasNurseProfileChanges(selectedNurse, writeNurse)) {
            const saved = await updateNurse(writeNurse.nurseId, {
                name: writeNurse.name,
                phoneNum: writeNurse.phoneNum,
                isWorker: writeNurse.isWorker,
                isWardManager: writeNurse.isWardManager,
                memo: getMemoWithoutRoleMarkers(writeNurse.memo),
                isPreceptor,
                isPreceptee,
                birthDate: writeNurse.birthDate,
            });

            if (!saved) return false;
        }

        if (isDirty) {
            toast.success(t('page.member.toast.saveNurseInfo'));
        }

        return true;
    }, [
        isBirthDateDraftValid,
        isBusy,
        isCreateMode,
        isDirty,
        selectedNurse,
        t,
        shiftTypeOptions,
        updateNurse,
        updateNurseShift,
        writeNurse,
    ]);
    const handleDiscardDraft = useCallback(() => {
        setWriteNurse(selectedNurse ?? null);
        setShowNameRequiredError(false);
        setMoveTeamMenuOpen(false);
        setIsBirthDateDraftValid(true);
        setNurseDraftDirty(false);
    }, [selectedNurse, setNurseDraftDirty]);

    useEffect(() => {
        if (!onRegisterDraftActions) return;

        onRegisterDraftActions({
            save: handleSave,
            discard: handleDiscardDraft,
        });

        return () => onRegisterDraftActions(null);
    }, [handleDiscardDraft, handleSave, onRegisterDraftActions]);

    const handleRequestClose = () => {
        if (isDirty) {
            setExitConfirmModalOpen(true);

            return;
        }

        onClose();
    };

    if (!selectedNurse || !writeNurse) {
        return (
            <aside className="h-full w-[300px] overflow-hidden border-0 bg-white p-4 min-[1400px]:w-[340px] min-[1600px]:w-[400px] min-[1600px]:p-5">
                <div className="flex h-full items-center justify-center rounded-[14px] border border-dashed border-gray-6 bg-main-bg px-6 text-center">
                    <p className="font-apple text-[15px] leading-7 text-gray-3">{t('page.member.detail.emptyPinnedDescription')}</p>
                </div>
            </aside>
        );
    }

    return (
        <TooltipProvider delayDuration={120}>
            <aside className="flex h-full w-[300px] flex-col overflow-hidden bg-white min-[1400px]:w-[340px] min-[1600px]:w-[400px] [&_button:not(:disabled)]:cursor-pointer">
                <div className="shrink-0 px-3 pt-3 pb-2.5 min-[1600px]:px-4 min-[1600px]:pt-4 min-[1600px]:pb-3">
                    <div className="flex items-center justify-between">
                        <p className="font-apple text-[13px] font-semibold text-gray-3">{t('page.member.table.name')}</p>
                        <button
                            type="button"
                            className="grid size-7 place-items-center rounded-full bg-gray-7 text-gray-4 transition-colors hover:bg-gray-6 hover:text-sub-2 focus-visible:outline-2 focus-visible:outline-main-1 min-[1600px]:size-8"
                            onClick={handleRequestClose}
                            aria-label={t('page.member.detail.close')}
                        >
                            <ChevronRight
                                aria-hidden="true"
                                className="h-[18px] w-[18px] min-[1600px]:h-5 min-[1600px]:w-5"
                                strokeWidth={2.4}
                            />
                        </button>
                    </div>
                    <div className="mt-2 grid grid-cols-[minmax(0,88fr)_minmax(0,12fr)] items-center gap-2.5">
                        <TextField
                            ref={textInputRef}
                            autoFocus
                            disabled={isBusy}
                            name="nurseName"
                            maxLength={30}
                            placeholder={showNameRequiredError ? t('page.member.table.name') : undefined}
                            className={cn(
                                'h-10 min-w-0 rounded-[10px] border-gray-6 px-3 text-[18px] font-bold text-text-1 shadow-none outline-none focus:!border focus-visible:!border min-[1600px]:h-11 min-[1600px]:text-[20px]',
                                showNameRequiredError &&
                                    '!border !border-[#E57373] font-normal placeholder:font-normal placeholder:text-[#D6DCE6] focus:!outline-none focus-visible:!border-[#E57373]',
                            )}
                            value={writeNurse.name}
                            onChange={(event) => {
                                if (showNameRequiredError && event.target.value.trim().length > 0) {
                                    setShowNameRequiredError(false);
                                }

                                setWriteNurse((prev) => (prev ? {...prev, name: event.target.value} : prev));
                                sendEvent(events.memberPage.editNurseDrawer.changeNurseName);
                            }}
                        />
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <button
                                    type="button"
                                    disabled={isBusy}
                                    className="inline-flex h-10 w-full items-center justify-center text-sub-2 transition-colors hover:text-sub-1 disabled:opacity-50 min-[1600px]:h-11"
                                    onClick={() => {
                                        if (writeNurse.isConnected) {
                                            setDisconnectConfirmModalOpen(true);

                                            return;
                                        }

                                        onOpenWardCodeGuide();
                                    }}
                                    aria-label={t('page.member.detail.connectionStatusAria', {nurseName: nurseNameForAria})}
                                >
                                    {writeNurse.isConnected ? <LinkedIcon className="h-5 w-5" /> : <UnlinkedIcon className="h-5 w-5" />}
                                </button>
                            </TooltipTrigger>
                            {!writeNurse.isConnected ? (
                                <TooltipContent side="top">{t('page.member.detail.disconnectedTooltip')}</TooltipContent>
                            ) : null}
                        </Tooltip>
                    </div>
                </div>

                <div className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain">
                    <div className="shrink-0 border-t border-gray-7 px-3 py-2.5 min-[1600px]:px-4 min-[1600px]:py-3">
                        <div className="flex items-center justify-between">
                            <p className="font-apple text-[13px] font-semibold text-[#5C667D] min-[1600px]:text-[14px]">
                                {t('page.member.detail.shiftTypes')}
                            </p>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <button
                                        type="button"
                                        className="grid size-6 place-items-center rounded-full text-gray-4 transition-colors hover:bg-gray-7 hover:text-sub-2 focus-visible:outline-2 focus-visible:outline-main-1 min-[1600px]:size-7"
                                        aria-label={t('page.member.detail.shiftTypesHelpAria')}
                                    >
                                        <InfoIcon className="size-4" />
                                    </button>
                                </TooltipTrigger>
                                <TooltipContent side="top">{t('page.member.detail.shiftTypesHint')}</TooltipContent>
                            </Tooltip>
                        </div>
                        <div className="mt-2 grid w-full grid-cols-4 gap-1.5">
                            {shiftTypeOptions.map(({isPossible, name, shortName, apiShiftTypeId, wardShiftTypeId}) => {
                                const baseColor = toShiftTypeColor(
                                    typeof wardShiftTypeId === 'number' ? shiftTypeColorById.get(wardShiftTypeId) : undefined,
                                );

                                return (
                                    <button
                                        key={apiShiftTypeId}
                                        type="button"
                                        disabled={isBusy}
                                        aria-pressed={isPossible}
                                        title={`${shortName ? `${shortName} ` : ''}${name}`.trim()}
                                        className={cn(
                                            'inline-flex min-h-7 w-full min-w-0 cursor-pointer items-center justify-start gap-1 overflow-hidden rounded-[5px] border px-1.5 py-1 font-apple text-[13px] whitespace-nowrap transition-[background-color,color,border-color,opacity,transform,filter] duration-150 hover:-translate-y-[1px] hover:brightness-95 focus-visible:outline-2 focus-visible:outline-main-1 disabled:cursor-not-allowed disabled:opacity-50 min-[1600px]:min-h-8 min-[1600px]:px-2 min-[1600px]:text-[14px]',
                                        )}
                                        style={
                                            isPossible
                                                ? {borderColor: baseColor, backgroundColor: baseColor, color: '#FFFFFF'}
                                                : {borderColor: 'transparent', backgroundColor: '#ECEFF3', color: '#6B7280'}
                                        }
                                        onClick={() => {
                                            setWriteNurse((prev) =>
                                                prev
                                                    ? {
                                                          ...prev,
                                                          nurseShiftTypes: produce(prev.nurseShiftTypes, (draft) => {
                                                              const target = draft.find(
                                                                  (x) =>
                                                                      (typeof wardShiftTypeId === 'number' &&
                                                                          x.wardShiftTypeId === wardShiftTypeId) ||
                                                                      x.nurseShiftTypeId === apiShiftTypeId,
                                                              );

                                                              if (target) {
                                                                  target.isPossible = !isPossible;

                                                                  return;
                                                              }

                                                              draft.push({
                                                                  nurseShiftTypeId: apiShiftTypeId,
                                                                  wardShiftTypeId,
                                                                  name,
                                                                  shortName: shortName ?? '',
                                                                  isPossible: !isPossible,
                                                                  isPreferred: false,
                                                                  targetRatioWeight: DEFAULT_NURSE_SHIFT_RATIO_WEIGHT,
                                                              });
                                                          }),
                                                      }
                                                    : prev,
                                            );
                                            sendEvent(events.memberPage.editNurseDrawer.changeNurseShiftTypes);
                                        }}
                                    >
                                        <span className="relative inline-flex h-5 w-[22px] shrink-0 items-center justify-center overflow-visible min-[1600px]:w-6">
                                            <span
                                                className={cn(
                                                    'absolute inset-x-0 flex min-w-0 items-center justify-center truncate px-0.5 font-medium transition-all duration-200',
                                                    isPossible ? 'scale-75 opacity-0' : 'scale-100 opacity-100',
                                                )}
                                            >
                                                {shortName || ''}
                                            </span>
                                            <Check
                                                className={cn(
                                                    'absolute h-4 w-4 transition-all duration-200',
                                                    isPossible ? 'scale-100 opacity-100' : 'scale-75 opacity-0',
                                                )}
                                                strokeWidth={3}
                                            />
                                        </span>
                                        <span className="min-w-0 flex-1 truncate text-left font-normal">{name}</span>
                                    </button>
                                );
                            })}
                        </div>
                        <div className="mt-3 border-t border-gray-7 pt-3">
                            <div className="flex items-center justify-between gap-2">
                                <div className="min-w-0">
                                    <p className="font-apple text-[12px] font-semibold text-[#5C667D] min-[1600px]:text-[13px]">
                                        {t('page.member.detail.shiftRatio')}
                                    </p>
                                </div>
                                <div className="flex shrink-0 items-center gap-1">
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <button
                                                type="button"
                                                className="grid size-6 place-items-center rounded-full text-gray-4 transition-colors hover:bg-gray-7 hover:text-sub-2 focus-visible:outline-2 focus-visible:outline-main-1 min-[1600px]:size-7"
                                                aria-label={t('page.member.detail.shiftRatioHelpAria')}
                                            >
                                                <InfoIcon className="size-4" />
                                            </button>
                                        </TooltipTrigger>
                                        <TooltipContent side="top">{t('page.member.detail.shiftRatioHint')}</TooltipContent>
                                    </Tooltip>
                                    <button
                                        type="button"
                                        className="grid size-6 place-items-center rounded-full text-gray-4 transition-colors hover:bg-gray-7 hover:text-sub-2 focus-visible:outline-2 focus-visible:outline-main-1 min-[1600px]:size-7"
                                        onClick={() => setIsShiftRatioOpen((current) => !current)}
                                        aria-expanded={isShiftRatioOpen}
                                        aria-label={t('page.member.detail.shiftRatio')}
                                        title={t('page.member.detail.shiftRatio')}
                                    >
                                        <ChevronDown
                                            className={cn('h-4 w-4 transition-transform', isShiftRatioOpen ? 'rotate-180' : undefined)}
                                            strokeWidth={2.4}
                                        />
                                    </button>
                                </div>
                            </div>
                            {shiftRatioDisplayOptions.length > 0 ? (
                                <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
                                    {shiftRatioDisplayOptions.map(({shiftType, label, weight, color}) => (
                                        <span
                                            key={`ratio-summary-${shiftType.apiShiftTypeId}`}
                                            className="inline-flex min-w-0 items-center gap-1.5 font-poppins text-[11px] font-semibold text-sub-2 min-[1600px]:text-[12px]"
                                        >
                                            <span className="text-[10px] leading-none" style={{color}} aria-hidden="true">
                                                ●
                                            </span>
                                            <span className="min-w-0 truncate">{label}</span>
                                            <span className="shrink-0 font-apple text-[11px] font-semibold text-gray-3 min-[1600px]:text-[12px]">
                                                {weight}일
                                            </span>
                                        </span>
                                    ))}
                                </div>
                            ) : null}
                            {isShiftRatioOpen ? (
                                shiftRatioDisplayOptions.length > 0 ? (
                                    <div className="mt-2 grid gap-1.5">
                                        {shiftRatioDisplayOptions.map(({shiftType, label, weight, roundedPercent, color}) => (
                                            <div
                                                key={`ratio-input-${shiftType.apiShiftTypeId}`}
                                                className="grid min-h-10 grid-cols-[minmax(0,1fr)_72px] items-center gap-2 rounded-[7px] bg-gray-7 px-2 py-1.5"
                                            >
                                                <div className="flex min-w-0 items-center gap-2">
                                                    <span
                                                        className="h-2.5 w-2.5 shrink-0 rounded-full"
                                                        style={{backgroundColor: color}}
                                                        aria-hidden="true"
                                                    />
                                                    <span className="min-w-0 flex-1 truncate font-apple text-[12px] font-medium text-sub-2 min-[1600px]:text-[13px]">
                                                        {label}
                                                    </span>
                                                    <span className="shrink-0 font-poppins text-[11px] font-semibold text-gray-3">
                                                        {roundedPercent}%
                                                    </span>
                                                </div>
                                                <div className="grid h-6 grid-cols-[minmax(0,1fr)_auto] items-center rounded-[6px] border border-gray-6 bg-white transition-colors focus-within:border-main-1 focus-within:outline-1 focus-within:outline-main-1">
                                                    <input
                                                        type="number"
                                                        min={MIN_SHIFT_RATIO_WEIGHT}
                                                        max={MAX_SHIFT_RATIO_WEIGHT}
                                                        step={1}
                                                        inputMode="numeric"
                                                        disabled={isBusy}
                                                        className="h-full min-w-0 bg-transparent px-1 text-right font-poppins text-[12px] font-semibold text-sub-1 outline-none disabled:cursor-not-allowed disabled:opacity-50"
                                                        value={weight}
                                                        aria-label={t('page.member.detail.shiftRatioInputAria', {
                                                            shiftName: shiftType.name,
                                                        })}
                                                        onChange={(event) =>
                                                            updateShiftRatioWeight({
                                                                apiShiftTypeId: shiftType.apiShiftTypeId,
                                                                wardShiftTypeId: shiftType.wardShiftTypeId,
                                                                name: shiftType.name,
                                                                shortName: shiftType.shortName,
                                                                isPossible: shiftType.isPossible,
                                                                isPreferred: shiftType.isPreferred,
                                                                targetRatioWeight: event.currentTarget.valueAsNumber,
                                                            })
                                                        }
                                                    />
                                                    <span className="pr-1.5 font-apple text-[11px] font-semibold text-gray-3">일</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="mt-2 rounded-[7px] bg-gray-7 px-2 py-2 font-apple text-[12px] font-medium text-gray-3">
                                        {t('page.member.detail.shiftRatioEmpty')}
                                    </p>
                                )
                            ) : null}
                        </div>
                    </div>

                    <div className="shrink-0 border-t border-gray-7 px-3 py-2.5 min-[1600px]:px-4 min-[1600px]:py-3">
                        <p className="font-apple text-[13px] font-semibold text-[#5C667D] min-[1600px]:text-[14px]">
                            {t('page.member.detail.rolesAndPermissions')}
                        </p>
                        <div className="mt-2 grid grid-cols-2 gap-1.5">
                            <div className="flex min-h-9 items-center justify-between rounded-[9px] bg-gray-7 px-3 min-[1600px]:min-h-10">
                                <p className="font-apple text-[12px] font-medium text-sub-2 min-[1600px]:text-[14px]">
                                    {t('page.member.detail.preceptor')}
                                </p>
                                <button
                                    type="button"
                                    role="checkbox"
                                    aria-checked={isPreceptor}
                                    aria-label={t('page.member.row.preceptorAria', {nurseName: nurseNameForAria})}
                                    disabled={isBusy}
                                    className={cn(
                                        'group flex h-6 w-6 items-center justify-center rounded-[7px] border transition-colors focus-visible:outline-2 focus-visible:outline-main-1 disabled:opacity-50',
                                        isPreceptor
                                            ? 'border-main-1 bg-main-1 text-white'
                                            : 'border-sub-4 bg-white text-transparent hover:border-2 hover:border-main-1 hover:bg-main-light',
                                    )}
                                    onClick={() =>
                                        setWriteNurse((prev) =>
                                            prev
                                                ? {
                                                      ...prev,
                                                      isPreceptor: !hasNursePreceptorRole(prev),
                                                      isPreceptee: hasNursePreceptorRole(prev) ? prev.isPreceptee === true : false,
                                                      memo: getMemoWithoutRoleMarkers(prev.memo),
                                                  }
                                                : prev,
                                        )
                                    }
                                >
                                    <Check className="h-3.5 w-3.5 stroke-[3] transition-[stroke-width] duration-150 group-hover:stroke-[3.6]" />
                                </button>
                            </div>
                            <div className="flex min-h-9 items-center justify-between rounded-[9px] bg-gray-7 px-3 min-[1600px]:min-h-10">
                                <p className="font-apple text-[12px] font-medium text-sub-2 min-[1600px]:text-[14px]">
                                    {t('page.member.detail.preceptee')}
                                </p>
                                <button
                                    type="button"
                                    role="checkbox"
                                    aria-checked={isPreceptee}
                                    aria-label={t('page.member.row.precepteeAria', {nurseName: nurseNameForAria})}
                                    disabled={isBusy}
                                    className={cn(
                                        'group flex h-6 w-6 items-center justify-center rounded-[7px] border transition-colors focus-visible:outline-2 focus-visible:outline-main-1 disabled:opacity-50',
                                        isPreceptee
                                            ? 'border-main-1 bg-main-1 text-white'
                                            : 'border-sub-4 bg-white text-transparent hover:border-2 hover:border-main-1 hover:bg-main-light',
                                    )}
                                    onClick={() =>
                                        setWriteNurse((prev) => {
                                            if (!prev) return prev;

                                            const nextIsPreceptee = !hasNursePrecepteeRole(prev);

                                            return {
                                                ...prev,
                                                isPreceptor: nextIsPreceptee ? false : prev.isPreceptor === true,
                                                isPreceptee: nextIsPreceptee,
                                                memo: getMemoWithoutRoleMarkers(prev.memo),
                                            };
                                        })
                                    }
                                >
                                    <Check className="h-3.5 w-3.5 stroke-[3] transition-[stroke-width] duration-150 group-hover:stroke-[3.6]" />
                                </button>
                            </div>
                            <div className="flex min-h-9 items-center justify-between rounded-[9px] bg-gray-7 px-3 min-[1600px]:min-h-10">
                                <p className="font-apple text-[12px] font-medium text-sub-2 min-[1600px]:text-[14px]">
                                    {t('page.member.detail.worker')}
                                </p>
                                <Switch
                                    checked={writeNurse.isWorker}
                                    disabled={isBusy}
                                    onCheckedChange={(checked) => setWriteNurse((prev) => (prev ? {...prev, isWorker: checked} : prev))}
                                    className="relative h-6 w-11 justify-start border-0 bg-sub-4 p-0 shadow-none data-[state=checked]:bg-main-1 data-[state=unchecked]:bg-sub-4"
                                    thumbClassName="absolute top-0.5 left-0.5 h-5 w-5 translate-x-0 bg-white shadow-sm data-[state=checked]:translate-x-5"
                                    aria-label={t('page.member.row.workerAria', {nurseName: nurseNameForAria})}
                                />
                            </div>
                        </div>
                    </div>

                    <div className="flex shrink-0 flex-col border-t border-gray-7 px-3 py-2.5 min-[1600px]:px-4 min-[1600px]:py-3">
                        <BirthDateInput
                            value={writeNurse.birthDate}
                            disabled={isBusy}
                            onChange={(birthDate) => setWriteNurse((prev) => (prev ? {...prev, birthDate} : prev))}
                            onValidityChange={setIsBirthDateDraftValid}
                        />
                        <p className="shrink-0 font-apple text-[13px] font-semibold text-[#5C667D] min-[1600px]:text-[14px]">
                            {t('page.member.detail.phone')}
                        </p>
                        <input
                            type="tel"
                            disabled={isBusy}
                            name="nursePhoneNum"
                            className="mt-2 h-10 w-full shrink-0 rounded-[9px] border border-gray-6 bg-main-bg p-2.5 font-poppins text-[13px] text-sub-1 transition-colors focus:border-main-1 focus-visible:outline-1 focus-visible:outline-main-1 disabled:cursor-not-allowed disabled:opacity-50 min-[1600px]:text-[14px]"
                            value={writeNurse.phoneNum ?? ''}
                            onChange={(event) => setWriteNurse((prev) => (prev ? {...prev, phoneNum: event.target.value} : prev))}
                        />
                        <p className="mt-2.5 shrink-0 font-apple text-[13px] font-semibold text-[#5C667D] min-[1600px]:text-[14px]">
                            {t('page.member.detail.memo')}
                        </p>
                        <textarea
                            ref={memoTextareaRef}
                            name="nurseMemo"
                            aria-label={t('page.member.detail.memo')}
                            value={getMemoWithoutRoleMarkers(writeNurse.memo)}
                            disabled={isBusy}
                            className="mt-2 h-14 w-full shrink-0 resize-none overflow-hidden rounded-[9px] border border-gray-6 bg-main-bg p-2.5 font-apple text-[13px] leading-5 text-sub-1 transition-colors focus:border-main-1 focus-visible:outline-1 focus-visible:outline-main-1 min-[1600px]:h-16 min-[1600px]:text-[14px]"
                            onChange={(event) => setWriteNurse((prev) => (prev ? {...prev, memo: event.target.value} : prev))}
                        />
                        <div ref={moveTeamMenuRef} className="relative shrink-0 pt-1.5">
                            <div className="grid grid-cols-2 gap-2">
                                <button
                                    type="button"
                                    aria-haspopup="listbox"
                                    aria-expanded={moveTeamMenuOpen}
                                    disabled={isBusy || moveTargetShiftTeams.length === 0}
                                    className={cn(
                                        'inline-flex h-9 w-full items-center justify-center gap-2 rounded-[9px] bg-[#F3F4F6] px-3 font-apple text-[13px] font-semibold text-[#5C667D] transition-colors hover:bg-[#EAECEF] focus-visible:outline-2 focus-visible:outline-main-1 disabled:cursor-not-allowed disabled:opacity-45 min-[1600px]:h-10 min-[1600px]:text-[14px]',
                                        moveTeamMenuOpen && 'bg-[#EAECEF] text-sub-1',
                                    )}
                                    onClick={() => setMoveTeamMenuOpen((prev) => !prev)}
                                >
                                    {isMovingTeam ? (
                                        <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2.4} />
                                    ) : (
                                        <ArrowRightLeft className="h-4 w-4" strokeWidth={2.4} />
                                    )}
                                    {t('page.member.detail.moveTeam')}
                                </button>
                                <button
                                    type="button"
                                    disabled={isBusy}
                                    className="h-9 w-full rounded-[9px] bg-[#FFF5F5] px-3 font-apple text-[13px] font-semibold text-[#D14343] transition-colors hover:bg-[#FEECEC] disabled:opacity-50 min-[1600px]:h-10 min-[1600px]:text-[14px]"
                                    onClick={() => setDeleteConfirmModalOpen(true)}
                                >
                                    {t('page.member.common.deleteAction')}
                                </button>
                            </div>
                            {moveTeamMenuOpen ? (
                                <div
                                    role="listbox"
                                    className="absolute right-0 bottom-full left-0 z-20 mb-2 overflow-hidden rounded-[12px] border border-gray-6 bg-white py-2 shadow-[0px_12px_28px_rgba(61,70,88,0.14)]"
                                >
                                    <p className="px-3 pb-2 font-apple text-[12px] font-semibold text-[#8A94A8]">
                                        {t('page.member.detail.moveTargetTeam')}
                                    </p>
                                    <div className="px-2">
                                        {moveTargetShiftTeams.map((shiftTeam) => (
                                            <button
                                                key={shiftTeam.shiftTeamId}
                                                type="button"
                                                role="option"
                                                aria-selected={false}
                                                disabled={isMovingTeam}
                                                className="flex min-h-10 w-full items-center gap-2 rounded-[9px] px-2.5 text-left transition-colors hover:bg-main-light focus-visible:outline-2 focus-visible:outline-main-1 disabled:opacity-50"
                                                onClick={async () => {
                                                    if (isMovingTeam) return;

                                                    setIsMovingTeam(true);

                                                    try {
                                                        const moved = await onMoveShiftTeam(shiftTeam.shiftTeamId);

                                                        if (moved) {
                                                            setMoveTeamMenuOpen(false);
                                                        }
                                                    } finally {
                                                        setIsMovingTeam(false);
                                                    }
                                                }}
                                            >
                                                <span className="min-w-0 flex-1 truncate font-apple text-[14px] font-semibold text-sub-1">
                                                    {shiftTeam.name}
                                                </span>
                                                <span className="shrink-0 rounded-full bg-gray-7 px-2 py-0.5 font-poppins text-[12px] font-semibold text-gray-3">
                                                    {shiftTeam.nurses.length}
                                                </span>
                                                <ChevronRight className="h-4 w-4 shrink-0 text-gray-4" strokeWidth={2.4} />
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            ) : null}
                        </div>
                    </div>
                </div>
                <div className="shrink-0 border-t border-gray-7 px-3 py-2.5 min-[1600px]:px-4 min-[1600px]:py-3">
                    <button
                        type="button"
                        disabled={isBusy || !isDirty || !isBirthDateDraftValid}
                        className="h-10 w-full rounded-[10px] bg-main-1 px-3 font-apple text-[14px] font-semibold text-white transition-colors hover:bg-main-1-hover disabled:cursor-not-allowed disabled:bg-[#C7D0DE]"
                        onClick={() => void handleSave()}
                    >
                        {t('page.member.detail.saveAction')}
                    </button>
                </div>

                {disconnectConfirmModalOpen ? (
                    <div
                        className="fixed inset-0 z-[1001] flex items-center justify-center bg-black/45 px-4"
                        onClick={() => setDisconnectConfirmModalOpen(false)}
                    >
                        <div
                            role="dialog"
                            aria-modal="true"
                            className="w-full max-w-[440px] rounded-[16px] bg-white px-6 py-5"
                            onClick={(event) => event.stopPropagation()}
                        >
                            <p className="font-apple text-[20px] font-semibold text-sub-1">{t('page.member.modal.disconnectTitle')}</p>
                            <p className="mt-2 font-apple text-[15px] text-gray-3">
                                <span className="font-semibold text-sub-1">
                                    {writeNurse.name.trim() ? writeNurse.name : t('page.member.common.selectedNurse')}
                                </span>
                                {t('page.member.modal.disconnectDescriptionSuffix')}
                            </p>
                            <div className="mt-6 flex items-center gap-3">
                                <button
                                    type="button"
                                    className="h-11 flex-1 rounded-[10px] bg-[#F3F4F6] px-6 font-apple text-[16px] font-semibold text-gray-3 transition-colors hover:bg-[#EAECEF]"
                                    onClick={() => setDisconnectConfirmModalOpen(false)}
                                >
                                    {t('page.member.common.close')}
                                </button>
                                <button
                                    type="button"
                                    className="h-11 flex-1 rounded-[10px] bg-[#D14343] px-6 font-apple text-[16px] font-semibold text-white transition-colors hover:bg-[#BD3434]"
                                    onClick={async () => {
                                        const ok = await disconnectNurse(writeNurse.nurseId);

                                        if (ok) {
                                            setDisconnectConfirmModalOpen(false);
                                        }
                                    }}
                                >
                                    {t('page.member.common.disconnectAction')}
                                </button>
                            </div>
                        </div>
                    </div>
                ) : null}
                {deleteConfirmModalOpen
                    ? createPortal(
                          <div
                              className="fixed inset-0 z-[1002] flex items-center justify-center bg-black/45 px-4"
                              onClick={() => setDeleteConfirmModalOpen(false)}
                          >
                              <div
                                  role="dialog"
                                  aria-modal="true"
                                  className="w-full max-w-[440px] rounded-[16px] bg-white px-6 py-5"
                                  onClick={(event) => event.stopPropagation()}
                              >
                                  <p className="font-apple text-[20px] font-semibold text-sub-1">
                                      {t('page.member.modal.deleteNurseTitle')}
                                  </p>
                                  <p className="mt-2 font-apple text-[15px] text-gray-3">
                                      <span className="font-semibold text-sub-1">
                                          {writeNurse.name.trim() ? writeNurse.name : t('page.member.common.selectedNurse')}
                                      </span>
                                      {t('page.member.modal.deleteNurseDescriptionSuffix')}
                                  </p>
                                  <div className="mt-6 flex items-center gap-3">
                                      <button
                                          type="button"
                                          className="h-11 flex-1 rounded-[10px] bg-[#F3F4F6] px-6 font-apple text-[16px] font-semibold text-gray-3 transition-colors hover:bg-[#EAECEF]"
                                          onClick={() => setDeleteConfirmModalOpen(false)}
                                      >
                                          {t('page.member.common.close')}
                                      </button>
                                      <button
                                          type="button"
                                          className="h-11 flex-1 rounded-[10px] bg-[#D14343] px-6 font-apple text-[16px] font-semibold text-white transition-colors hover:bg-[#BD3434]"
                                          onClick={async () => {
                                              setDeleteConfirmModalOpen(false);

                                              if (!writeNurse.shiftTeamId) return;

                                              await deleteNurse(writeNurse.shiftTeamId, writeNurse.nurseId);
                                          }}
                                      >
                                          {t('page.member.common.deleteAction')}
                                      </button>
                                  </div>
                              </div>
                          </div>,
                          modalRoot,
                      )
                    : null}
                {exitConfirmModalOpen
                    ? createPortal(
                          <div
                              className="fixed inset-0 z-[1003] flex items-center justify-center bg-black/45 px-4"
                              onClick={() => setExitConfirmModalOpen(false)}
                          >
                              <div
                                  role="dialog"
                                  aria-modal="true"
                                  className="w-full max-w-[460px] rounded-[16px] bg-white px-6 py-5"
                                  onClick={(event) => event.stopPropagation()}
                              >
                                  <p className="font-apple text-[20px] font-semibold text-sub-1">
                                      {t('page.member.modal.unsavedExitTitle')}
                                  </p>
                                  <p className="mt-2 font-apple text-[15px] text-gray-3">{t('page.member.modal.unsavedExitDescription')}</p>
                                  <div className="mt-6 grid grid-cols-3 gap-2">
                                      <button
                                          type="button"
                                          className="h-11 rounded-[10px] bg-[#F3F4F6] px-4 font-apple text-[15px] font-semibold text-gray-3 transition-colors hover:bg-[#EAECEF]"
                                          onClick={() => setExitConfirmModalOpen(false)}
                                      >
                                          {t('page.member.common.cancel')}
                                      </button>
                                      <button
                                          type="button"
                                          className="h-11 rounded-[10px] bg-[#FFF5F5] px-4 font-apple text-[15px] font-semibold text-[#D14343] transition-colors hover:bg-[#FEECEC]"
                                          onClick={() => {
                                              setExitConfirmModalOpen(false);
                                              onClose();
                                          }}
                                      >
                                          {t('page.member.common.discard')}
                                      </button>
                                      <button
                                          type="button"
                                          className="h-11 rounded-[10px] bg-main-1 px-4 font-apple text-[15px] font-semibold text-white transition-colors hover:bg-main-1-hover"
                                          onClick={async () => {
                                              const saved = await handleSave();

                                              if (!saved) return;

                                              setExitConfirmModalOpen(false);
                                              onClose();
                                          }}
                                      >
                                          {t('page.member.common.saveAndLeave')}
                                      </button>
                                  </div>
                              </div>
                          </div>,
                          modalRoot,
                      )
                    : null}
            </aside>
        </TooltipProvider>
    );
}

export default NurseDetailPanel;
