import type {
    TOnboardingScheduleInputPreviewDTO,
    TOnboardingScheduleInputPreviewResponse,
    TOnboardingWardDraftResponse,
} from '@dutying/api/ward';
import {type DropResult} from '@hello-pangea/dnd';
import * as Sentry from '@sentry/react';
import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import toast from 'react-hot-toast';
import useRegister from '@/features/register';
import {FileAPI} from '@/shared/api';
import type {TOnboardingWardParseOptions} from '@/shared/api/file/type';
import {
    applyParsedWardData,
    buildOnboardingParseDraftInjection,
    getOnboardingUploadFailureMessage,
    isSupportedOnboardingUploadFile,
    type TOnboardingParsedShiftType,
} from './adapter';
import {
    addNurseDraft,
    addShiftTypeDraft,
    addTeamDraft,
    applyScheduleInputDraft,
    applyUploadedScheduleTemplateDraft,
    canComplete,
    canGoNext,
    canGoPrev,
    createInitialDraft,
    deleteNurseDraft,
    deleteShiftTypeDraft,
    deleteTeamDraft,
    getCompletionValidationIssues,
    getScheduleMonthKey,
    getStepValidation,
    goNextStep as goNextStepDraft,
    goPreviousStep as goPreviousStepDraft,
    hasScheduleInputDraft,
    MAX_ONBOARDING_NURSES,
    MAX_ONBOARDING_TEAMS,
    prepareManualEntryDraft,
    saveSkillLevelConfig,
    type TOnboardingNurseDraft,
    type TOnboardingConstraintDraft,
    type TOnboardingTeamScheduleDraft,
    type TOnboardingWardDraft,
    type TSkillLevelConfig,
    updateConstraintCandidateDraft,
    updateNurseDraft,
    updateShiftTypeDraft,
    updateTeamNameDraft,
} from './draft';
import {parseOnboardingScheduleTemplate} from './schedule-template-parser';
import {sortNursesByMode} from './sort';
import {createOnboardingWardCreateExecutor, type TOnboardingWardCreateSubmission} from './submission';
import type {TSortMode} from './types';

const MAX_STEP = 4;
const ONBOARDING_DRAFT_AUTOSAVE_DELAY_MS = 600;

type TSubmissionStatus = 'idle' | 'submitting' | 'success' | 'error';
type TUploadStatus = 'idle' | 'uploading' | 'success' | 'warning' | 'error';
type TDraftCreationStatus = 'idle' | 'creating' | 'created' | 'error';
type TDraftRestoreStatus = 'loading' | 'ready' | 'error';

const parseScheduleTemplateSafely = async (file: File, options?: TOnboardingWardParseOptions) => {
    if (!options?.targetYear || !options.targetMonth) {
        return [];
    }

    if (!file.name.toLowerCase().endsWith('.xlsx')) {
        return [];
    }

    try {
        return await parseOnboardingScheduleTemplate(file, {
            targetYear: options.targetYear,
            targetMonth: options.targetMonth,
        });
    } catch {
        return [];
    }
};

type TPersistedOnboardingWardDraft = {
    draft: TOnboardingWardDraft;
    draftWardId: number | null;
    isSkillLevelEnabled: boolean;
    selectedTeamId: string;
    sortMode: TSortMode;
};

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;
const isOnboardingStep = (value: unknown): value is TOnboardingWardDraft['currentStep'] =>
    value === 1 || value === 2 || value === 3 || value === 4;
const isSortMode = (value: unknown): value is TSortMode => value === 'manual' || value === 'name' || value === 'skill';
const isScheduleDraft = (value: unknown): value is TOnboardingTeamScheduleDraft =>
    isRecord(value) && typeof value.year === 'number' && typeof value.month === 'number' && Array.isArray(value.rows);
const normalizeScheduleInputs = (value: unknown): TOnboardingWardDraft['scheduleInputs'] => {
    if (!isRecord(value)) {
        return {};
    }

    return Object.fromEntries(
        Object.entries(value).map(([teamId, teamValue]) => {
            if (isScheduleDraft(teamValue)) {
                return [teamId, {[getScheduleMonthKey(teamValue.year, teamValue.month)]: teamValue}];
            }

            if (!isRecord(teamValue)) {
                return [teamId, undefined];
            }

            return [
                teamId,
                Object.fromEntries(
                    Object.entries(teamValue).filter(([, scheduleValue]) => isScheduleDraft(scheduleValue)),
                ) as TOnboardingWardDraft['scheduleInputs'][string],
            ];
        }),
    );
};
const readServerOnboardingWardDraftPayload = (payload: unknown): TPersistedOnboardingWardDraft | null => {
    if (!isRecord(payload) || !isRecord(payload.draft)) {
        return null;
    }

    const draft = payload.draft;

    if (
        !isOnboardingStep(draft.currentStep) ||
        typeof draft.wardName !== 'string' ||
        typeof draft.hospitalName !== 'string' ||
        !Array.isArray(draft.shiftTypes) ||
        !Array.isArray(draft.teams) ||
        !Array.isArray(draft.nurses) ||
        !Array.isArray(draft.constraintCandidates)
    ) {
        return null;
    }

    const draftWardId = typeof payload.draftWardId === 'number' ? payload.draftWardId : null;
    const restoredDraft = draft as TOnboardingWardDraft;

    return {
        draft: {
            ...restoredDraft,
            scheduleInputs: normalizeScheduleInputs(restoredDraft.scheduleInputs),
        },
        draftWardId,
        isSkillLevelEnabled: payload.isSkillLevelEnabled === true,
        selectedTeamId: typeof payload.selectedTeamId === 'string' ? payload.selectedTeamId : '',
        sortMode: isSortMode(payload.sortMode) ? payload.sortMode : 'manual',
    };
};
const buildServerOnboardingWardDraftPayload = (
    draft: TOnboardingWardDraft,
    draftWardId: number | null,
    isSkillLevelEnabled: boolean,
    selectedTeamId: string,
    sortMode: TSortMode,
): Record<string, unknown> => ({
    draft,
    draftWardId,
    isSkillLevelEnabled,
    selectedTeamId,
    sortMode,
});
const getTeamSchedules = (scheduleInputs: TOnboardingWardDraft['scheduleInputs'][string]) =>
    Object.values(scheduleInputs ?? {})
        .filter((schedule): schedule is TOnboardingTeamScheduleDraft => Boolean(schedule))
        .sort((left, right) => left.year * 12 + left.month - (right.year * 12 + right.month));
const isUsedScheduleRow = (row: TOnboardingTeamScheduleDraft['rows'][number]) =>
    Boolean(row.name.trim()) || Object.values(row.shifts).some((value) => value.trim());
const toScheduleInputPreviewRequest = (
    schedule: TOnboardingTeamScheduleDraft,
): {request: TOnboardingScheduleInputPreviewDTO; schedule: TOnboardingTeamScheduleDraft} | null => {
    const rows = schedule.rows.filter(isUsedScheduleRow);
    const namedRows = rows.filter((row) => row.name.trim());
    const hasDutyValue = namedRows.some((row) => Object.values(row.shifts).some((value) => value.trim()));

    if (namedRows.length === 0 || !hasDutyValue) {
        return null;
    }

    const daysInMonth = new Date(schedule.year, schedule.month, 0).getDate();
    const normalizedSchedule: TOnboardingTeamScheduleDraft = {
        ...schedule,
        rows: namedRows,
    };

    return {
        schedule: normalizedSchedule,
        request: {
            targetYear: schedule.year,
            targetMonth: schedule.month,
            nurseNameBlock: namedRows.map((row) => row.name.trim()).join('\n'),
            dutyBlock: namedRows
                .map((row) => Array.from({length: daysInMonth}, (_, index) => row.shifts[String(index + 1)]?.trim() ?? '').join('\t'))
                .join('\n'),
        },
    };
};
const toParsedShiftType = (shiftType: TOnboardingWardDraft['shiftTypes'][number]): TOnboardingParsedShiftType => ({
    name: shiftType.name,
    shortName: shiftType.shortName,
    startTime: shiftType.startTime,
    endTime: shiftType.endTime,
    color: shiftType.color,
    isDefault: shiftType.isDefault,
    isOff: shiftType.isOff,
    classification: shiftType.classification,
});
const toSchedulePreviewShiftTypes = (response: TOnboardingScheduleInputPreviewResponse): TOnboardingParsedShiftType[] =>
    response.wardShiftTypes.map((shiftType) => ({
        name: shiftType.name,
        shortName: shiftType.shortName,
        startTime: shiftType.startTime ?? undefined,
        endTime: shiftType.endTime ?? undefined,
        color: shiftType.color,
        isDefault: shiftType.isDefault,
        isOff: shiftType.isOff,
        classification: shiftType.classification ?? undefined,
    }));
const normalizeShiftTypeMergeKey = (shortName?: string | null) => shortName?.trim().toUpperCase();
const mergeSchedulePreviewShiftTypes = (
    draft: TOnboardingWardDraft,
    response: TOnboardingScheduleInputPreviewResponse,
): TOnboardingParsedShiftType[] => {
    const draftShiftTypes = draft.shiftTypes.map(toParsedShiftType);
    const previewShiftTypes = toSchedulePreviewShiftTypes(response);
    const draftByShortName = new Map(
        draftShiftTypes
            .map((shiftType) => [normalizeShiftTypeMergeKey(shiftType.shortName), shiftType] as const)
            .filter((entry): entry is [string, TOnboardingParsedShiftType] => Boolean(entry[0])),
    );
    const previewByShortName = new Map(
        previewShiftTypes
            .map((shiftType) => [normalizeShiftTypeMergeKey(shiftType.shortName), shiftType] as const)
            .filter((entry): entry is [string, TOnboardingParsedShiftType] => Boolean(entry[0])),
    );
    const orderedShortNames: string[] = [];
    const appendShortName = (shiftType: TOnboardingParsedShiftType) => {
        const shortName = normalizeShiftTypeMergeKey(shiftType.shortName);

        if (shortName && !orderedShortNames.includes(shortName)) {
            orderedShortNames.push(shortName);
        }
    };

    draftShiftTypes.forEach(appendShortName);
    previewShiftTypes.forEach(appendShortName);

    return orderedShortNames
        .map((shortName) => previewByShortName.get(shortName) ?? draftByShortName.get(shortName))
        .filter((shiftType): shiftType is TOnboardingParsedShiftType => Boolean(shiftType));
};
const createPreviewNurseId = (index: number) => `nurse-preview-${Date.now()}-${index}`;
const normalizeNurseMergeKey = (name: string) => name.trim();
const mergeInitialShifts = (
    existingShifts: TOnboardingNurseDraft['initialShifts'],
    nextShifts: TOnboardingNurseDraft['initialShifts'],
): NonNullable<TOnboardingNurseDraft['initialShifts']> => {
    const shiftByDate = new Map<string, string>();

    [...(existingShifts ?? []), ...(nextShifts ?? [])].forEach((shift) => {
        shiftByDate.set(shift.date, shift.shiftShortName);
    });

    return Array.from(shiftByDate.entries())
        .map(([date, shiftShortName]) => ({date, shiftShortName}))
        .sort((left, right) => left.date.localeCompare(right.date));
};
const applySchedulePreviewToDraft = (
    draft: TOnboardingWardDraft,
    teamId: string,
    schedule: TOnboardingTeamScheduleDraft,
    response: TOnboardingScheduleInputPreviewResponse,
): TOnboardingWardDraft => {
    const draftWithShiftTypes = applyParsedWardData(draft, {
        shiftTypes: mergeSchedulePreviewShiftTypes(draft, response),
    });
    const shiftIdByShortName = new Map(draftWithShiftTypes.shiftTypes.map((shiftType) => [shiftType.shortName, shiftType.id]));
    const possibleShiftTypeIds = response.wardShiftTypes
        .map((shiftType) => shiftIdByShortName.get(shiftType.shortName))
        .filter((shiftTypeId): shiftTypeId is string => Boolean(shiftTypeId));
    const fallbackPossibleShiftTypeIds = draftWithShiftTypes.shiftTypes.map((shiftType) => shiftType.id);
    const defaultEmploymentDate = new Date().toISOString().slice(0, 10);
    const existingTeamNurses = draftWithShiftTypes.nurses.filter((nurse) => nurse.teamId === teamId);
    const existingNurseByName = new Map(existingTeamNurses.map((nurse) => [normalizeNurseMergeKey(nurse.name), nurse]));
    const touchedNurseIds = new Set<string>();
    const nurseIdByDisplayOrder = new Map<number, string>();
    const nextTeamNurses = response.nurses.map((nurse, index) => {
        const existingNurse = existingNurseByName.get(normalizeNurseMergeKey(nurse.name));
        const id = existingNurse?.id ?? createPreviewNurseId(index + 1);

        nurseIdByDisplayOrder.set(nurse.displayOrder, id);
        touchedNurseIds.add(id);

        return {
            ...existingNurse,
            id,
            teamId,
            name: nurse.name,
            memo: existingNurse?.memo ?? '',
            isWorker: existingNurse?.isWorker ?? true,
            employmentDate: existingNurse?.employmentDate ?? defaultEmploymentDate,
            possibleShiftTypeIds: possibleShiftTypeIds.length > 0 ? possibleShiftTypeIds : fallbackPossibleShiftTypeIds,
            level: existingNurse?.level ?? null,
            initialShifts: mergeInitialShifts(existingNurse?.initialShifts, nurse.initialShifts),
        };
    });
    const preservedTeamNurses = existingTeamNurses.filter((nurse) => !touchedNurseIds.has(nurse.id));
    const monthKey = getScheduleMonthKey(schedule.year, schedule.month);
    const nextSchedule: TOnboardingTeamScheduleDraft = {
        ...schedule,
        rows: schedule.rows.map((row, index) => ({
            ...row,
            nurseId: nurseIdByDisplayOrder.get(index + 1) ?? null,
        })),
    };

    return {
        ...draftWithShiftTypes,
        nurses: [...draftWithShiftTypes.nurses.filter((nurse) => nurse.teamId !== teamId), ...preservedTeamNurses, ...nextTeamNurses],
        scheduleInputs: {
            ...(draftWithShiftTypes.scheduleInputs ?? {}),
            [teamId]: {
                ...(draftWithShiftTypes.scheduleInputs?.[teamId] ?? {}),
                [monthKey]: nextSchedule,
            },
        },
    };
};
const hasServerSavableDraftSignal = (draft: TOnboardingWardDraft) =>
    [draft.wardName.trim(), draft.hospitalName.trim(), draft.uploadedFileName].some(Boolean) || draft.currentStep > 1;
const reorderByIndex = <T>(items: T[], sourceIndex: number, destinationIndex: number) => {
    const next = [...items];
    const [moved] = next.splice(sourceIndex, 1);

    if (!moved) {
        return items;
    }

    next.splice(destinationIndex, 0, moved);

    return next;
};
const replaceTeamNurses = (draft: TOnboardingWardDraft, teamId: string, nextTeamNurses: TOnboardingNurseDraft[]): TOnboardingWardDraft => {
    const nextNurses: TOnboardingNurseDraft[] = [];

    let teamCursor = 0;

    draft.nurses.forEach((nurse) => {
        if (nurse.teamId !== teamId) {
            nextNurses.push(nurse);

            return;
        }

        const replacement = nextTeamNurses[teamCursor++];

        if (replacement) {
            nextNurses.push(replacement);
        }
    });

    if (teamCursor < nextTeamNurses.length) {
        nextNurses.push(...nextTeamNurses.slice(teamCursor));
    }

    return {
        ...draft,
        nurses: nextNurses,
    };
};
const enforceWorkerGroupOrder = (teamNurses: TOnboardingNurseDraft[]) => sortNursesByMode(teamNurses, 'manual');
const getWorkerBoundaryIndex = (teamNurses: TOnboardingNurseDraft[]) => {
    const firstOffIndex = teamNurses.findIndex((nurse) => !nurse.isWorker);

    return firstOffIndex === -1 ? teamNurses.length : firstOffIndex;
};
const insertAtWorkerBoundary = (teamNurses: TOnboardingNurseDraft[], nurse: TOnboardingNurseDraft) => {
    const nextTeamNurses = [...teamNurses];

    nextTeamNurses.splice(getWorkerBoundaryIndex(nextTeamNurses), 0, nurse);

    return nextTeamNurses;
};
const removeEmptyTeamsForCompletion = (draft: TOnboardingWardDraft): TOnboardingWardDraft => {
    const nurseCountByTeamId = new Map<string, number>();

    draft.nurses.forEach((nurse) => {
        nurseCountByTeamId.set(nurse.teamId, (nurseCountByTeamId.get(nurse.teamId) ?? 0) + 1);
    });

    const nextTeams = draft.teams.filter((team) => (nurseCountByTeamId.get(team.id) ?? 0) > 0);

    if (nextTeams.length === draft.teams.length) {
        return draft;
    }

    const nextTeamIdSet = new Set(nextTeams.map((team) => team.id));
    const nextNurses = draft.nurses.filter((nurse) => nextTeamIdSet.has(nurse.teamId));

    return {
        ...draft,
        teams: nextTeams,
        nurses: nextNurses,
    };
};
const clampConstraintCount = (count: number) => Math.max(1, Math.min(100, Math.round(count)));
const updateConstraintParamsCount = (constraint: TOnboardingConstraintDraft, count: number): Record<string, unknown> => ({
    ...constraint.params,
    count: clampConstraintCount(count),
});
const updateConstraintParamsStaffingCount = (
    constraint: TOnboardingConstraintDraft,
    staffingIndex: number,
    count: number,
): Record<string, unknown> => {
    const staffing = constraint.params.staffing;

    if (!Array.isArray(staffing)) {
        return constraint.params;
    }

    return {
        ...constraint.params,
        staffing: staffing.map((item, index) =>
            index === staffingIndex && item && typeof item === 'object'
                ? {...(item as Record<string, unknown>), count: clampConstraintCount(count)}
                : item,
        ),
    };
};
const buildDraftWardIdentityPayload = (draft: TOnboardingWardDraft) => {
    const normalizedWardName = draft.wardName.trim();
    const normalizedHospitalName = draft.hospitalName.trim();
    const fallbackName = normalizedWardName || normalizedHospitalName || '듀팅 병동';

    return {
        name: normalizedWardName || normalizedHospitalName || fallbackName,
        hospitalName: normalizedHospitalName || normalizedWardName || fallbackName,
    };
};

function useOnboardingWardWizard() {
    const {
        actions: {
            createWard,
            createOnboardingWardDraft,
            getOnboardingWardDraft,
            saveOnboardingWardDraft,
            previewOnboardingScheduleInput,
            completeOnboardingWardDraft,
        },
    } = useRegister();
    const draftTouchedRef = useRef(false);
    const [draft, setDraft] = useState<TOnboardingWardDraft>(() => createInitialDraft());
    const [selectedTeamId, setSelectedTeamId] = useState('');
    const [sortMode, setSortModeState] = useState<TSortMode>('manual');
    const [showSkillModal, setShowSkillModal] = useState(false);
    const [isSkillLevelEnabled, setIsSkillLevelEnabled] = useState(false);
    const [submissionStatus, setSubmissionStatus] = useState<TSubmissionStatus>('idle');
    const [uploadStatus, setUploadStatus] = useState<TUploadStatus>('idle');
    const [uploadError, setUploadError] = useState<string | null>(null);
    const [uploadWarnings, setUploadWarnings] = useState<string[]>([]);
    const [draftWardId, setDraftWardId] = useState<number | null>(null);
    const [draftCreationStatus, setDraftCreationStatus] = useState<TDraftCreationStatus>('idle');
    const [draftRestoreStatus, setDraftRestoreStatus] = useState<TDraftRestoreStatus>('loading');
    const [createdWard, setCreatedWard] = useState<TOnboardingWardCreateSubmission['ward'] | null>(null);
    const onboardingWardCreateExecutor = useMemo(
        () => createOnboardingWardCreateExecutor(createWard, completeOnboardingWardDraft, draftWardId),
        [completeOnboardingWardDraft, createWard, draftWardId],
    );
    const markDraftTouched = () => {
        draftTouchedRef.current = true;
    };

    useEffect(() => {
        let isActive = true;

        const restoreDraft = async () => {
            try {
                const serverDraft = await getOnboardingWardDraft();

                if (!isActive) {
                    return;
                }

                if (serverDraft?.ward?.wardId) {
                    const restoredDraftState = readServerOnboardingWardDraftPayload(serverDraft.draftPayload);

                    setDraftWardId(serverDraft.ward.wardId);
                    setDraftCreationStatus('created');

                    if (restoredDraftState) {
                        setDraft(restoredDraftState.draft);
                        setSelectedTeamId(restoredDraftState.selectedTeamId);
                        setSortModeState(restoredDraftState.sortMode);
                        setIsSkillLevelEnabled(restoredDraftState.isSkillLevelEnabled);
                    } else {
                        setDraft((prev) => ({
                            ...prev,
                            hospitalName: serverDraft.ward.hospitalName ?? prev.hospitalName,
                            wardName: serverDraft.ward.name ?? prev.wardName,
                        }));
                    }
                }

                setDraftRestoreStatus('ready');
            } catch (error) {
                Sentry.captureException(error, {
                    tags: {feature: 'onboarding-ward-create'},
                    extra: {phase: 'restore-draft'},
                });

                if (isActive) {
                    setDraftRestoreStatus('error');
                }
            }
        };

        void restoreDraft();

        return () => {
            isActive = false;
        };
    }, [getOnboardingWardDraft]);

    useEffect(() => {
        if (!selectedTeamId && draft.teams[0]) {
            setSelectedTeamId(draft.teams[0].id);
        }
    }, [draft.teams, selectedTeamId]);

    useEffect(() => {
        if (!isSkillLevelEnabled && sortMode === 'skill') {
            setSortModeState('manual');
        }
    }, [isSkillLevelEnabled, sortMode]);

    const saveDraftSnapshot = useCallback(
        async ({showErrorToast = false, draftOverride}: {showErrorToast?: boolean; draftOverride?: TOnboardingWardDraft} = {}) => {
            if (submissionStatus === 'success' || draftCreationStatus === 'creating') {
                return true;
            }

            const targetDraft = draftOverride ?? draft;
            const identityPayload = buildDraftWardIdentityPayload(targetDraft);
            const draftPayload = buildServerOnboardingWardDraftPayload(
                targetDraft,
                draftWardId,
                isSkillLevelEnabled,
                selectedTeamId,
                sortMode,
            );

            try {
                if (draftWardId) {
                    await saveOnboardingWardDraft(draftWardId, {
                        ...identityPayload,
                        draftPayload,
                    });
                    setDraftCreationStatus('created');

                    return true;
                }

                if (!draftTouchedRef.current || !hasServerSavableDraftSignal(targetDraft)) {
                    return true;
                }

                setDraftCreationStatus('creating');

                const draftWard = await createOnboardingWardDraft({
                    ...identityPayload,
                    draftPayload,
                });

                if (!draftWard?.wardId) {
                    throw new Error('Onboarding draft ward id missing.');
                }

                setDraftWardId(draftWard.wardId);
                setDraftCreationStatus('created');

                return true;
            } catch (error) {
                Sentry.captureException(error, {
                    tags: {feature: 'onboarding-ward-create'},
                    extra: {step: targetDraft.currentStep, phase: draftWardId ? 'save-draft' : 'create-draft'},
                });
                setDraftCreationStatus('error');

                if (showErrorToast) {
                    toast.error('병동 기본 정보를 저장하지 못했어요. 다시 시도해 주세요.');
                }

                return false;
            }
        },
        [
            createOnboardingWardDraft,
            draft,
            draftCreationStatus,
            draftWardId,
            isSkillLevelEnabled,
            saveOnboardingWardDraft,
            selectedTeamId,
            sortMode,
            submissionStatus,
        ],
    );

    useEffect(() => {
        if (draftRestoreStatus === 'loading' || submissionStatus === 'success' || submissionStatus === 'submitting') {
            return;
        }

        if (!draftWardId && (!draftTouchedRef.current || !hasServerSavableDraftSignal(draft))) {
            return;
        }

        const autosaveTimer = window.setTimeout(() => {
            void saveDraftSnapshot();
        }, ONBOARDING_DRAFT_AUTOSAVE_DELAY_MS);

        return () => window.clearTimeout(autosaveTimer);
    }, [draft, draftRestoreStatus, draftWardId, saveDraftSnapshot, submissionStatus]);

    const selectedTeamExists = draft.teams.some((team) => team.id === selectedTeamId);
    const activeTeamId = selectedTeamExists ? selectedTeamId : (draft.teams[0]?.id ?? '');
    const draftForCompletion = removeEmptyTeamsForCompletion(draft);
    const currentStepValidation = getStepValidation(draft.currentStep === MAX_STEP ? draftForCompletion : draft);
    const completionValidationIssues = getCompletionValidationIssues(draftForCompletion);
    const setSortMode = (nextSortMode: TSortMode) => {
        markDraftTouched();

        if (nextSortMode === 'skill' && !isSkillLevelEnabled) {
            setSortModeState('manual');

            return;
        }

        setSortModeState(nextSortMode);
    };
    const ensureDraftWard = async () => {
        if (draftWardId) {
            await saveDraftSnapshot({showErrorToast: true});

            return true;
        }

        if (draftCreationStatus === 'creating') {
            return false;
        }

        markDraftTouched();

        return saveDraftSnapshot({showErrorToast: true});
    };
    const applyRestoredServerDraft = (serverDraft: TOnboardingWardDraftResponse, fallbackDraft: TOnboardingWardDraft) => {
        setDraftWardId(serverDraft.ward.wardId);
        setDraftCreationStatus('created');

        const restoredDraftState = readServerOnboardingWardDraftPayload(serverDraft.draftPayload);

        if (!restoredDraftState) {
            setDraft(fallbackDraft);

            return;
        }

        setDraft(restoredDraftState.draft);
        setSelectedTeamId(restoredDraftState.selectedTeamId);
        setSortModeState(restoredDraftState.sortMode);
        setIsSkillLevelEnabled(restoredDraftState.isSkillLevelEnabled);
    };
    const saveAndReloadDraft = async (nextDraft: TOnboardingWardDraft) => {
        const isSaved = await saveDraftSnapshot({showErrorToast: true, draftOverride: nextDraft});

        if (!isSaved) {
            return false;
        }

        try {
            const serverDraft = await getOnboardingWardDraft();

            if (!serverDraft?.ward?.wardId) {
                throw new Error('Onboarding draft reload returned empty response.');
            }

            applyRestoredServerDraft(serverDraft, nextDraft);

            return true;
        } catch (error) {
            Sentry.captureException(error, {
                tags: {feature: 'onboarding-ward-create'},
                extra: {phase: 'reload-draft-after-save', step: nextDraft.currentStep},
            });
            toast.error('저장한 온보딩 정보를 다시 불러오지 못했어요. 다시 시도해 주세요.');

            return false;
        }
    };
    const saveScheduleInputAndGoNext = async () => {
        const schedulePreviewTargets = draft.teams.flatMap((team) => {
            const schedules = getTeamSchedules(draft.scheduleInputs?.[team.id]);

            return schedules.flatMap((schedule) => {
                const previewInput = toScheduleInputPreviewRequest(schedule);

                return previewInput ? [{teamId: team.id, previewInput}] : [];
            });
        });

        try {
            let previewDraft = draft;

            for (const {teamId, previewInput} of schedulePreviewTargets) {
                previewDraft = applySchedulePreviewToDraft(
                    previewDraft,
                    teamId,
                    previewInput.schedule,
                    await previewOnboardingScheduleInput(previewInput.request),
                );
            }

            const nextDraft = goNextStepDraft(previewDraft);

            return saveAndReloadDraft(nextDraft);
        } catch (error) {
            Sentry.captureException(error, {
                tags: {feature: 'onboarding-ward-create'},
                extra: {phase: 'preview-and-save-schedule-input', step: draft.currentStep},
            });
            toast.error('근무표를 서버에 저장하지 못했어요. 다시 시도해 주세요.');

            return false;
        }
    };
    const goNextStep = async () => {
        if (draft.currentStep === 1) {
            const isDraftReady = await ensureDraftWard();

            if (!isDraftReady) {
                return;
            }
        }

        if (draft.currentStep === 2) {
            markDraftTouched();
            await saveScheduleInputAndGoNext();

            return;
        }

        markDraftTouched();
        setDraft((prev) => goNextStepDraft(prev));
    };
    const goPreviousStep = () => {
        markDraftTouched();
        setDraft((prev) => goPreviousStepDraft(prev));
    };
    const updateWardIdentity = (updater: Partial<Pick<TOnboardingWardDraft, 'wardName' | 'hospitalName'>>) => {
        markDraftTouched();
        setDraft((prev) => ({...prev, ...updater}));
    };
    const updateShiftType = (shiftTypeId: string, updater: Parameters<typeof updateShiftTypeDraft>[2]) => {
        markDraftTouched();
        setDraft((prev) => updateShiftTypeDraft(prev, shiftTypeId, updater));
    };
    const addShiftType = () => {
        markDraftTouched();
        setDraft((prev) => addShiftTypeDraft(prev));
    };
    const deleteShiftType = (shiftTypeId: string) => {
        markDraftTouched();
        setDraft((prev) => deleteShiftTypeDraft(prev, shiftTypeId));
    };
    const updateNurse = (nurseId: string, updater: Parameters<typeof updateNurseDraft>[2]) => {
        markDraftTouched();
        setDraft((prev) => {
            const targetNurse = prev.nurses.find((nurse) => nurse.id === nurseId);

            if (!targetNurse) {
                return prev;
            }

            const nextNurse = {...targetNurse, ...updater};
            const isWorkerToggled =
                typeof updater.isWorker === 'boolean' && targetNurse.isWorker !== updater.isWorker && sortMode === 'manual';

            if (!isWorkerToggled) {
                return updateNurseDraft(prev, nurseId, updater);
            }

            const teamNurses = prev.nurses.filter((nurse) => nurse.teamId === targetNurse.teamId);
            const nextTeamNurses = teamNurses.filter((nurse) => nurse.id !== nurseId);
            const reorderedTeamNurses = insertAtWorkerBoundary(nextTeamNurses, nextNurse);

            return replaceTeamNurses(prev, targetNurse.teamId, enforceWorkerGroupOrder(reorderedTeamNurses));
        });
    };
    const addTeam = () => {
        markDraftTouched();

        if (draft.teams.length >= MAX_ONBOARDING_TEAMS) {
            toast.error('팀은 최대 8개까지 추가할 수 있어요.');

            return;
        }

        const {draft: nextDraft, addedTeamId} = addTeamDraft(draft);

        setDraft(nextDraft);

        if (addedTeamId) {
            const addedTeamName = nextDraft.teams.find((team) => team.id === addedTeamId)?.name ?? '새 팀';

            setSelectedTeamId(addedTeamId);
            toast.success(`${addedTeamName}을 추가했어요.`, {position: 'bottom-center'});
        }
    };
    const addNurse = () => {
        markDraftTouched();

        const targetTeamId = activeTeamId || draft.teams[0]?.id;

        if (targetTeamId) {
            const teamNurseCount = draft.nurses.filter((nurse) => nurse.teamId === targetTeamId).length;

            if (teamNurseCount >= MAX_ONBOARDING_NURSES) {
                toast.error('한 팀에는 간호사를 최대 40명까지 추가할 수 있어요.');

                return;
            }

            const targetTeamName = draft.teams.find((team) => team.id === targetTeamId)?.name ?? '선택한 팀';

            setDraft((prev) => addNurseDraft(prev, targetTeamId));
            toast.success(`${targetTeamName}에 간호사를 추가했어요.`, {position: 'bottom-center'});

            return;
        }

        const {draft: withTeamDraft, addedTeamId} = addTeamDraft(draft);

        if (!addedTeamId) {
            toast.error('팀은 최대 8개까지 추가할 수 있어요.');

            return;
        }

        const addedTeamName = withTeamDraft.teams.find((team) => team.id === addedTeamId)?.name ?? '새 팀';

        setDraft(addNurseDraft(withTeamDraft, addedTeamId));
        setSelectedTeamId(addedTeamId);
        toast.success(`${addedTeamName}을 추가하고 간호사도 등록했어요.`, {position: 'bottom-center'});
    };
    const deleteActiveTeam = () => {
        markDraftTouched();

        if (!activeTeamId) {
            return;
        }

        const deletedTeamNurseCount = draft.nurses.filter((nurse) => nurse.teamId === activeTeamId).length;
        const nextDraft = deleteTeamDraft(draft, activeTeamId);

        setDraft(nextDraft);
        setSelectedTeamId(nextDraft.teams[0]?.id ?? '');

        if (deletedTeamNurseCount > 0) {
            toast.success('팀을 삭제했어요. 팀에 속한 간호사도 함께 삭제했어요.');
        }
    };
    const deleteNurse = (nurseId: string) => {
        markDraftTouched();

        if (!draft.nurses.some((nurse) => nurse.id === nurseId)) {
            return;
        }

        setDraft((prev) => deleteNurseDraft(prev, nurseId));
        toast.success('간호사를 삭제했어요.');
    };
    const updateTeamName = (teamId: string, teamName: string) => {
        markDraftTouched();
        setDraft((prev) => updateTeamNameDraft(prev, teamId, teamName));
    };
    const updateScheduleInput = (teamId: string, schedule: TOnboardingTeamScheduleDraft) => {
        markDraftTouched();
        setDraft((prev) => applyScheduleInputDraft(prev, teamId, schedule));
    };
    const toggleConstraintCandidate = (constraintId: string, selected: boolean) => {
        markDraftTouched();
        setDraft((prev) => updateConstraintCandidateDraft(prev, constraintId, {selected}));
    };
    const updateConstraintCandidateSeverity = (constraintId: string, severity: TOnboardingConstraintDraft['severity']) => {
        markDraftTouched();
        setDraft((prev) => updateConstraintCandidateDraft(prev, constraintId, {severity}));
    };
    const updateConstraintCandidateCount = (constraintId: string, count: number) => {
        markDraftTouched();
        setDraft((prev) => {
            const constraint = prev.constraintCandidates.find((candidate) => candidate.id === constraintId);

            if (!constraint) {
                return prev;
            }

            return updateConstraintCandidateDraft(prev, constraintId, {params: updateConstraintParamsCount(constraint, count)});
        });
    };
    const updateConstraintCandidateStaffingCount = (constraintId: string, staffingIndex: number, count: number) => {
        markDraftTouched();
        setDraft((prev) => {
            const constraint = prev.constraintCandidates.find((candidate) => candidate.id === constraintId);

            if (!constraint) {
                return prev;
            }

            return updateConstraintCandidateDraft(prev, constraintId, {
                params: updateConstraintParamsStaffingCount(constraint, staffingIndex, count),
            });
        });
    };
    const handleNurseDragEnd = ({destination, source}: DropResult) => {
        markDraftTouched();

        if (!destination) {
            return;
        }

        if (source.droppableId !== destination.droppableId || source.index === destination.index) {
            return;
        }

        const teamId = source.droppableId;

        setDraft((prev) => {
            const teamNurses = prev.nurses.filter((nurse) => nurse.teamId === teamId);

            if (teamNurses.length === 0) {
                return prev;
            }

            const displayedTeamNurses = sortNursesByMode(teamNurses, sortMode);
            const sourceNurse = displayedTeamNurses[source.index];

            if (!sourceNurse) {
                return prev;
            }

            const onCount = displayedTeamNurses.filter((nurse) => nurse.isWorker).length;
            const lastIndex = displayedTeamNurses.length - 1;
            const destinationIndex = Math.max(0, Math.min(destination.index, lastIndex));

            if (sortMode === 'manual') {
                const crossesWorkerBoundary = sourceNurse.isWorker ? destinationIndex >= onCount : destinationIndex < onCount;

                if (crossesWorkerBoundary) {
                    return prev;
                }
            }

            if (destinationIndex === source.index) {
                return prev;
            }

            const reorderedTeamNurses = reorderByIndex(displayedTeamNurses, source.index, destinationIndex);

            if (reorderedTeamNurses === displayedTeamNurses) {
                return prev;
            }

            return replaceTeamNurses(
                prev,
                teamId,
                sortMode === 'manual' ? reorderedTeamNurses : enforceWorkerGroupOrder(reorderedTeamNurses),
            );
        });

        if (sortMode !== 'manual') {
            setSortModeState('manual');
        }
    };
    const applyUploadedFile = async (file: File, options?: TOnboardingWardParseOptions) => {
        markDraftTouched();

        if (!isSupportedOnboardingUploadFile(file.name)) {
            const message = '엑셀 파일(.xlsx, .xls)만 업로드할 수 있어요.';

            setUploadStatus('error');
            setUploadError(message);
            setUploadWarnings([]);
            toast.error(message);

            return;
        }

        setUploadStatus('uploading');
        setUploadError(null);
        setUploadWarnings([]);

        try {
            const [response, scheduleTemplate] = await Promise.all([
                FileAPI.parseOnboardingWardExcel(file, options),
                parseScheduleTemplateSafely(file, options),
            ]);
            const {parsedWardData, warnings} = buildOnboardingParseDraftInjection(response, file.name);
            let nextActiveTeamId: string | null = null;

            setDraft((prev) => {
                const parsedDraft = applyParsedWardData(prev, parsedWardData);

                if (!options?.targetYear || !options.targetMonth || scheduleTemplate.length === 0) {
                    return parsedDraft;
                }

                const result = applyUploadedScheduleTemplateDraft(parsedDraft, {
                    fileName: file.name,
                    year: options.targetYear,
                    month: options.targetMonth,
                    teamSchedules: scheduleTemplate,
                });

                nextActiveTeamId = result.activeTeamId;

                return result.draft;
            });

            if (nextActiveTeamId) {
                setSelectedTeamId(nextActiveTeamId);
            }

            setUploadWarnings(warnings);
            setUploadStatus(warnings.length > 0 ? 'warning' : 'success');
            toast.success('근무표 파일을 반영했어요.');
        } catch (error) {
            const message = getOnboardingUploadFailureMessage(error);

            setUploadStatus('error');
            setUploadError(message);
            setUploadWarnings([]);
            toast.error(message);
        }
    };
    const saveSkillConfig = (config: TSkillLevelConfig) => {
        markDraftTouched();
        setDraft((prev) => saveSkillLevelConfig(prev, config));
        setIsSkillLevelEnabled(true);
        toast.success('숙련도 설정이 간호사 목록에 반영됐어요.');
    };
    const disableSkillConfig = () => {
        markDraftTouched();
        setIsSkillLevelEnabled(false);

        if (sortMode === 'skill') {
            setSortModeState('manual');
        }

        toast.success('숙련도 설정을 사용하지 않아요.');
    };
    const complete = async () => {
        if (submissionStatus === 'submitting') {
            return;
        }

        const nextDraft = removeEmptyTeamsForCompletion(draft);

        if (nextDraft !== draft) {
            setDraft(nextDraft);

            if (!nextDraft.teams.some((team) => team.id === activeTeamId)) {
                setSelectedTeamId(nextDraft.teams[0]?.id ?? '');
            }
        }

        if (!canComplete(nextDraft)) {
            return;
        }

        setCreatedWard(null);
        setSubmissionStatus('submitting');

        try {
            const submission = await onboardingWardCreateExecutor(nextDraft);

            setCreatedWard(submission.ward ?? null);
            setSubmissionStatus('success');
            toast.success(submission.successMessage);
        } catch (error) {
            Sentry.captureException(error, {
                tags: {feature: 'onboarding-ward-create'},
                extra: {step: draft.currentStep},
            });
            setSubmissionStatus('error');
            toast.error('병동을 만들지 못했어요. 다시 시도해 주세요.');
        }
    };
    const skipOrComplete = () => {
        if (draft.currentStep === MAX_STEP) {
            void complete();

            return;
        }

        if (draft.currentStep === 2 && !draft.uploadedFileName && !hasScheduleInputDraft(draft)) {
            markDraftTouched();
            void saveAndReloadDraft(goNextStepDraft(prepareManualEntryDraft(draft)));

            return;
        }

        void goNextStep();
    };

    return {
        draft,
        activeTeamId,
        setSelectedTeamId,
        sortMode,
        setSortMode,
        showSkillModal,
        setShowSkillModal,
        isSkillLevelEnabled,
        goNextStep,
        goPreviousStep,
        updateWardIdentity,
        skipOrComplete,
        addShiftType,
        updateShiftType,
        deleteShiftType,
        addTeam,
        addNurse,
        deleteActiveTeam,
        deleteNurse,
        updateNurse,
        updateTeamName,
        updateScheduleInput,
        toggleConstraintCandidate,
        updateConstraintCandidateSeverity,
        updateConstraintCandidateCount,
        updateConstraintCandidateStaffingCount,
        handleNurseDragEnd,
        applyUploadedFile,
        uploadStatus,
        uploadError,
        uploadWarnings,
        draftCreationStatus,
        createdWard,
        saveSkillConfig,
        disableSkillConfig,
        complete,
        canAddTeam: draft.teams.length < MAX_ONBOARDING_TEAMS,
        hasScheduleInput: hasScheduleInputDraft(draft),
        submissionStatus,
        currentStepValidation,
        completionValidationIssues,
        canGoPrev: canGoPrev(draft),
        canGoNext: canGoNext(draft),
        canComplete: canComplete(draftForCompletion),
    };
}

export default useOnboardingWardWizard;
