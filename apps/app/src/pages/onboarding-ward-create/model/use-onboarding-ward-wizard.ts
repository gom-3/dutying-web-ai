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
import {
    clampSkillLevel,
    saveWardSkillSettings,
    type TSkillLevelValue,
    type TWardSkillSettings,
} from '@/features/ward-skill/model/skill-level';
import {FileAPI} from '@/shared/api';
import type {TOnboardingWardParseOptions} from '@/shared/api/file/type';
import {useTypedTranslation} from '@/shared/hook/use-typed-translation';
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
    DEFAULT_SKILL_LEVEL_CONFIG,
    deleteNurseDraft,
    deleteShiftTypeDraft,
    deleteTeamDraft,
    getCompletionValidationIssues,
    getScheduleMonthKey,
    getStepValidation,
    goNextStep as goNextStepDraft,
    goPreviousStep as goPreviousStepDraft,
    hasScheduleInputDraft,
    isOnboardingShiftTypeActive,
    MAX_ONBOARDING_NURSES,
    MAX_ONBOARDING_TEAMS,
    normalizeNurseNameForRequest,
    normalizeOnboardingShiftCode,
    prepareManualEntryDraft,
    reorderShiftTypes,
    saveSkillLevelConfig,
    type TOnboardingDraftLabels,
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
import {normalizeOnboardingScheduleFile, parseOnboardingScheduleTemplate} from './schedule-template-parser';
import {sortNursesByMode} from './sort';
import {createOnboardingWardCreateExecutor, type TOnboardingWardCreateSubmission} from './submission';
import type {TSortMode} from './types';

const MAX_STEP = 4;
const ONBOARDING_DRAFT_AUTOSAVE_DELAY_MS = 600;
const PRECEPTOR_MEMO = '\uD504\uB9AC\uC149\uD130';
const PRECEPTEE_MEMO = '\uD504\uB9AC\uC149\uD2F0';

type TSubmissionStatus = 'idle' | 'submitting' | 'success' | 'error';
type TUploadStatus = 'idle' | 'uploading' | 'success' | 'warning' | 'error';
type TDraftCreationStatus = 'idle' | 'creating' | 'created' | 'error';
type TDraftRestoreStatus = 'loading' | 'ready' | 'error';
type TDraftSaveResult = {
    success: boolean;
    response?: TOnboardingWardDraftResponse;
};

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
    selectedTeamId: string;
    sortMode: TSortMode;
};

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;
const shouldResetStepFromHistoryState = () => {
    if (typeof window === 'undefined' || !isRecord(window.history.state)) {
        return false;
    }

    if (window.history.state.resetOnboardingWardCreateStep === true) {
        return true;
    }

    const routerState = window.history.state.usr;

    return isRecord(routerState) && routerState.resetOnboardingWardCreateStep === true;
};
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
const normalizeRestoredSkillLevelConfig = (value: unknown, legacyEnabled: unknown): TOnboardingWardDraft['skillLevelConfig'] => {
    const config = isRecord(value) ? (value as Partial<TSkillLevelConfig>) : {};
    const enabled = typeof legacyEnabled === 'boolean' ? legacyEnabled : config.enabled;

    return {
        ...DEFAULT_SKILL_LEVEL_CONFIG,
        ...config,
        enabled: enabled ?? DEFAULT_SKILL_LEVEL_CONFIG.enabled,
    };
};
const normalizeRestoredNurses = (nurses: TOnboardingWardDraft['nurses']): TOnboardingWardDraft['nurses'] =>
    nurses.map((nurse) => {
        const trimmedMemo = nurse.memo.trim();
        const hasPreceptorMemo = trimmedMemo === PRECEPTOR_MEMO;
        const hasPrecepteeMemo = trimmedMemo === PRECEPTEE_MEMO;

        return {
            ...nurse,
            memo: hasPreceptorMemo || hasPrecepteeMemo ? '' : nurse.memo,
            isPreceptor: nurse.isPreceptor ?? hasPreceptorMemo,
            isPreceptee: nurse.isPreceptee ?? hasPrecepteeMemo,
        };
    });
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
            nurses: normalizeRestoredNurses(restoredDraft.nurses),
            skillLevelConfig: normalizeRestoredSkillLevelConfig(restoredDraft.skillLevelConfig, payload.isSkillLevelEnabled),
            scheduleInputs: normalizeScheduleInputs(restoredDraft.scheduleInputs),
        },
        draftWardId,
        selectedTeamId: typeof payload.selectedTeamId === 'string' ? payload.selectedTeamId : '',
        sortMode: isSortMode(payload.sortMode) ? payload.sortMode : 'manual',
    };
};
const buildServerOnboardingWardDraftPayload = (
    draft: TOnboardingWardDraft,
    draftWardId: number | null,
    selectedTeamId: string,
    sortMode: TSortMode,
): Record<string, unknown> => ({
    draft,
    draftWardId,
    isSkillLevelEnabled: draft.skillLevelConfig.enabled,
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
    shortName: normalizeOnboardingShiftCode(shiftType.shortName),
    startTime: shiftType.startTime,
    endTime: shiftType.endTime,
    color: shiftType.color,
    isDefault: shiftType.isDefault,
    isOff: shiftType.isOff,
    classification: shiftType.classification,
    source: shiftType.source,
});
const toSchedulePreviewShiftTypes = (response: TOnboardingScheduleInputPreviewResponse): TOnboardingParsedShiftType[] =>
    response.wardShiftTypes.map((shiftType) => {
        const shortName = normalizeOnboardingShiftCode(shiftType.shortName);

        return {
            name: shiftType.name?.trim() || shortName,
            shortName,
            startTime: shiftType.startTime ?? undefined,
            endTime: shiftType.endTime ?? undefined,
            color: shiftType.color,
            isDefault: shiftType.isDefault,
            isOff: shiftType.isOff,
            classification: shiftType.classification ?? undefined,
        };
    });
const normalizeShiftTypeMergeKey = (shortName?: string | null) => shortName?.trim().toUpperCase();
const mergeSchedulePreviewShiftTypes = (
    draft: TOnboardingWardDraft,
    schedule: TOnboardingTeamScheduleDraft,
    response: TOnboardingScheduleInputPreviewResponse,
): TOnboardingParsedShiftType[] => {
    const draftShiftTypes = draft.shiftTypes.map(toParsedShiftType);
    const observedPreviewShortNames = new Set(
        schedule.rows.flatMap((row) =>
            Object.values(row.shifts)
                .map((shortName) => normalizeOnboardingShiftCode(shortName))
                .map(normalizeShiftTypeMergeKey)
                .filter((shortName): shortName is string => Boolean(shortName)),
        ),
    );
    const previewShiftTypes: TOnboardingParsedShiftType[] = toSchedulePreviewShiftTypes(response)
        .map((shiftType) => ({
            ...shiftType,
            shortName: normalizeOnboardingShiftCode(shiftType.shortName ?? ''),
        }))
        .filter((shiftType) => {
            const shortName = normalizeShiftTypeMergeKey(shiftType.shortName);

            return Boolean(shortName && observedPreviewShortNames.has(shortName));
        });
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
        .map((shortName) => {
            const draftShiftType = draftByShortName.get(shortName);
            const previewShiftType = previewByShortName.get(shortName);

            if (!previewShiftType) {
                return draftShiftType;
            }

            if (draftShiftType?.protectedByPreviousSchedule) {
                return draftShiftType;
            }

            return {...previewShiftType, source: draftShiftType?.source};
        })
        .filter((shiftType): shiftType is TOnboardingParsedShiftType => Boolean(shiftType));
};
const createPreviewNurseId = (index: number) => `nurse-preview-${Date.now()}-${index}`;
const normalizeNurseMergeKey = (name: string) => name.trim();
const getScheduleReferencedNurseKeys = (scheduleInputs: TOnboardingWardDraft['scheduleInputs'][string]) => {
    const ids = new Set<string>();
    const names = new Set<string>();

    Object.values(scheduleInputs ?? {}).forEach((teamSchedule) => {
        teamSchedule?.rows.forEach((row) => {
            const name = normalizeNurseMergeKey(row.name);

            if (!name) {
                return;
            }

            names.add(name);

            if (row.nurseId) {
                ids.add(row.nurseId);
            }
        });
    });

    return {ids, names};
};
const mergeInitialShifts = (
    existingShifts: TOnboardingNurseDraft['initialShifts'] | undefined,
    nextShifts: TOnboardingNurseDraft['initialShifts'] | undefined,
): TOnboardingNurseDraft['initialShifts'] => {
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
        shiftTypes: mergeSchedulePreviewShiftTypes(draft, schedule, response),
    });
    const shiftIdByShortName = new Map(
        draftWithShiftTypes.shiftTypes.filter(isOnboardingShiftTypeActive).map((shiftType) => [shiftType.shortName, shiftType.id]),
    );
    const previewPossibleShiftTypeIds = response.wardShiftTypes
        .map((shiftType) => shiftIdByShortName.get(normalizeOnboardingShiftCode(shiftType.shortName) ?? shiftType.shortName))
        .filter((shiftTypeId): shiftTypeId is string => Boolean(shiftTypeId));
    const protectedPreviousShiftTypeIds = draftWithShiftTypes.shiftTypes
        .filter((shiftType) => isOnboardingShiftTypeActive(shiftType) && shiftType.protectedByPreviousSchedule)
        .map((shiftType) => shiftType.id);
    const possibleShiftTypeIds = Array.from(new Set([...previewPossibleShiftTypeIds, ...protectedPreviousShiftTypeIds]));
    const fallbackPossibleShiftTypeIds = draftWithShiftTypes.shiftTypes
        .filter(isOnboardingShiftTypeActive)
        .map((shiftType) => shiftType.id);
    const defaultEmploymentDate = new Date().toISOString().slice(0, 10);
    const existingTeamNurses = draftWithShiftTypes.nurses.filter((nurse) => nurse.teamId === teamId);
    const existingNurseByName = new Map(existingTeamNurses.map((nurse) => [normalizeNurseMergeKey(nurse.name), nurse]));
    const scheduleReferencedNurseKeys = getScheduleReferencedNurseKeys(draftWithShiftTypes.scheduleInputs?.[teamId]);
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
            isPreceptor: existingNurse?.isPreceptor ?? false,
            isPreceptee: existingNurse?.isPreceptee ?? false,
            isWorker: existingNurse?.isWorker ?? true,
            employmentDate: existingNurse?.employmentDate ?? defaultEmploymentDate,
            possibleShiftTypeIds: possibleShiftTypeIds.length > 0 ? possibleShiftTypeIds : fallbackPossibleShiftTypeIds,
            level: existingNurse?.level ?? null,
            initialShifts: mergeInitialShifts(
                existingNurse?.initialShifts,
                nurse.initialShifts?.map((shift) => {
                    const day = Number(shift.date.slice(-2));
                    const scheduleShortName = schedule.rows[nurse.displayOrder - 1]?.shifts[String(day)];

                    return {
                        ...shift,
                        shiftShortName: normalizeOnboardingShiftCode(scheduleShortName ?? shift.shiftShortName) ?? shift.shiftShortName,
                    };
                }),
            ),
        };
    });
    const preservedTeamNurses = existingTeamNurses.filter(
        (nurse) =>
            !touchedNurseIds.has(nurse.id) &&
            (scheduleReferencedNurseKeys.ids.has(nurse.id) || scheduleReferencedNurseKeys.names.has(normalizeNurseMergeKey(nurse.name))),
    );
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
const buildDraftWardIdentityPayload = (draft: TOnboardingWardDraft, fallbackWardName: string) => {
    const normalizedWardName = draft.wardName.trim();
    const normalizedHospitalName = draft.hospitalName.trim();
    const fallbackName = normalizedWardName || normalizedHospitalName || fallbackWardName;

    return {
        name: normalizedWardName || normalizedHospitalName || fallbackName,
        hospitalName: normalizedHospitalName || normalizedWardName || fallbackName,
    };
};

type TCreatedWardSkillNurse = {
    nurseId: number;
    name: string;
    employmentDate: string;
    proficiency?: number | null;
    level?: number | null;
};

const getSkillLevelKey = (teamName: string | null | undefined, nurseName: string) =>
    `${teamName?.trim() ?? ''}:${normalizeNurseNameForRequest(nurseName)}`;
const getManualSkillLevel = (value: number | null | undefined, levelCount: number): TSkillLevelValue => {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
        return null;
    }

    return clampSkillLevel(value, levelCount);
};
const buildOnboardingWardSkillSettings = (
    draft: TOnboardingWardDraft,
    ward: TOnboardingWardCreateSubmission['ward'],
): TWardSkillSettings | null => {
    if (!ward?.wardId) {
        return null;
    }

    const config = draft.skillLevelConfig.enabled
        ? draft.skillLevelConfig
        : {
              ...draft.skillLevelConfig,
              enabled: false,
              autoAssign: false,
          };

    if (!config.enabled || config.autoAssign) {
        return {
            config,
            frozenLevelsByNurseId: {},
        };
    }

    const teamNameById = new Map(draft.teams.map((team) => [team.id, team.name]));
    const draftLevelByTeamAndNurseName = new Map(
        draft.nurses.map((nurse) => [getSkillLevelKey(teamNameById.get(nurse.teamId), nurse.name), nurse.level]),
    );
    const frozenLevelsByNurseId: TWardSkillSettings['frozenLevelsByNurseId'] = {};

    (ward.shiftTeams ?? []).forEach((shiftTeam) => {
        (shiftTeam.nurses ?? []).forEach((nurse) => {
            const skillNurse = nurse as TCreatedWardSkillNurse;
            const skillLevelKey = getSkillLevelKey(shiftTeam.name, skillNurse.name);
            const hasDraftLevel = draftLevelByTeamAndNurseName.has(skillLevelKey);
            const draftLevel = draftLevelByTeamAndNurseName.get(skillLevelKey);
            const serverLevel =
                typeof skillNurse.proficiency === 'number'
                    ? skillNurse.proficiency
                    : typeof skillNurse.level === 'number'
                      ? skillNurse.level
                      : undefined;

            frozenLevelsByNurseId[skillNurse.nurseId] = getManualSkillLevel(hasDraftLevel ? draftLevel : serverLevel, config.levelCount);
        });
    });

    return {
        config,
        frozenLevelsByNurseId,
    };
};
const saveOnboardingWardSkillSettings = (draft: TOnboardingWardDraft, ward: TOnboardingWardCreateSubmission['ward']) => {
    const settings = buildOnboardingWardSkillSettings(draft, ward);

    if (!settings || !ward?.wardId) {
        return;
    }

    saveWardSkillSettings(ward.wardId, settings);
};

function useOnboardingWardWizard() {
    const {t} = useTypedTranslation();
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
    const onboardingDraftLabels = useMemo<TOnboardingDraftLabels>(
        () => ({
            teamName: (index) => t('feature.registerWard.shiftTeams.teamName', {index}),
            newNurseName: (index) => t('page.onboardingWardCreate.defaults.newNurseName', {index}),
            sampleNurseNames: {
                first: t('page.onboardingWardCreate.defaults.sampleNurse.first'),
                second: t('page.onboardingWardCreate.defaults.sampleNurse.second'),
                skilled: t('page.onboardingWardCreate.defaults.sampleNurse.skilled'),
                off: t('page.onboardingWardCreate.defaults.sampleNurse.off'),
            },
            shiftNames: {
                day: t('feature.registerWard.defaultShiftType.day'),
                evening: t('feature.registerWard.defaultShiftType.evening'),
                night: t('feature.registerWard.defaultShiftType.night'),
                off: t('feature.registerWard.defaultShiftType.off'),
            },
        }),
        [t],
    );
    const draftTouchedRef = useRef(false);
    const skipNextAutosaveRef = useRef(false);
    const shiftTypeStepEntryDraftRef = useRef<TOnboardingWardDraft | null>(null);
    const shouldResetStepOnRestoreRef = useRef(shouldResetStepFromHistoryState());
    const [draft, setDraft] = useState<TOnboardingWardDraft>(() => createInitialDraft(onboardingDraftLabels));
    const [selectedTeamId, setSelectedTeamId] = useState('');
    const [sortMode, setSortModeState] = useState<TSortMode>('manual');
    const [showSkillModal, setShowSkillModal] = useState(false);
    const [submissionStatus, setSubmissionStatus] = useState<TSubmissionStatus>('idle');
    const [uploadStatus, setUploadStatus] = useState<TUploadStatus>('idle');
    const [uploadError, setUploadError] = useState<string | null>(null);
    const [uploadWarnings, setUploadWarnings] = useState<string[]>([]);
    const [draftWardId, setDraftWardId] = useState<number | null>(null);
    const [draftCreationStatus, setDraftCreationStatus] = useState<TDraftCreationStatus>('idle');
    const [draftRestoreStatus, setDraftRestoreStatus] = useState<TDraftRestoreStatus>('loading');
    const [createdWard, setCreatedWard] = useState<TOnboardingWardCreateSubmission['ward'] | null>(null);
    const [isStepTransitioning, setIsStepTransitioning] = useState(false);
    const stepTransitioningRef = useRef(false);
    const draftSaveChainRef = useRef<Promise<unknown>>(Promise.resolve());
    const fallbackWardName = t('page.onboardingWardCreate.fallback.wardName');
    const onboardingWardCreateExecutor = useMemo(
        () => createOnboardingWardCreateExecutor(createWard, completeOnboardingWardDraft, draftWardId),
        [completeOnboardingWardDraft, createWard, draftWardId],
    );
    const isSkillLevelEnabled = draft.skillLevelConfig.enabled;
    const markDraftTouched = () => {
        draftTouchedRef.current = true;
    };
    const beginStepTransition = () => {
        if (stepTransitioningRef.current) {
            return false;
        }

        stepTransitioningRef.current = true;
        setIsStepTransitioning(true);

        return true;
    };
    const endStepTransition = () => {
        stepTransitioningRef.current = false;
        setIsStepTransitioning(false);
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
                        setDraft(
                            shouldResetStepOnRestoreRef.current
                                ? {
                                      ...restoredDraftState.draft,
                                      currentStep: 1,
                                  }
                                : restoredDraftState.draft,
                        );
                        setSelectedTeamId(restoredDraftState.selectedTeamId);
                        setSortModeState(restoredDraftState.sortMode);
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

    const enqueueDraftSave = useCallback((save: () => Promise<TDraftSaveResult>) => {
        const nextSave = draftSaveChainRef.current.catch(() => undefined).then(save);

        draftSaveChainRef.current = nextSave.catch(() => undefined);

        return nextSave;
    }, []);
    const saveDraftSnapshot = useCallback(
        ({
            showErrorToast = false,
            draftOverride,
            isAutosave = false,
            suppressNextAutosave = false,
        }: {
            showErrorToast?: boolean;
            draftOverride?: TOnboardingWardDraft;
            isAutosave?: boolean;
            suppressNextAutosave?: boolean;
        } = {}) => {
            if (submissionStatus === 'success' || draftCreationStatus === 'creating') {
                return Promise.resolve<TDraftSaveResult>({success: true});
            }

            const targetDraft = draftOverride ?? draft;
            const identityPayload = buildDraftWardIdentityPayload(targetDraft, fallbackWardName);
            const draftPayload = buildServerOnboardingWardDraftPayload(targetDraft, draftWardId, selectedTeamId, sortMode);

            return enqueueDraftSave(async () => {
                try {
                    if (isAutosave && stepTransitioningRef.current) {
                        return {success: true};
                    }

                    if (draftWardId) {
                        const savedDraft = await saveOnboardingWardDraft(draftWardId, {
                            ...identityPayload,
                            draftPayload,
                        });

                        if (suppressNextAutosave) {
                            skipNextAutosaveRef.current = true;
                        }

                        setDraftCreationStatus('created');

                        return {success: true, response: savedDraft};
                    }

                    if (!draftTouchedRef.current || !hasServerSavableDraftSignal(targetDraft)) {
                        return {success: true};
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

                    return {success: true};
                } catch (error) {
                    Sentry.captureException(error, {
                        tags: {feature: 'onboarding-ward-create'},
                        extra: {step: targetDraft.currentStep, phase: draftWardId ? 'save-draft' : 'create-draft'},
                    });
                    setDraftCreationStatus('error');

                    if (showErrorToast) {
                        toast.error(t('page.onboardingWardCreate.toast.saveDraftError'));
                    }

                    return {success: false};
                }
            });
        },
        [
            createOnboardingWardDraft,
            draft,
            draftCreationStatus,
            draftWardId,
            enqueueDraftSave,
            fallbackWardName,
            saveOnboardingWardDraft,
            selectedTeamId,
            sortMode,
            submissionStatus,
            t,
        ],
    );

    useEffect(() => {
        if (
            draftRestoreStatus === 'loading' ||
            submissionStatus === 'success' ||
            submissionStatus === 'submitting' ||
            isStepTransitioning
        ) {
            return;
        }

        if (skipNextAutosaveRef.current) {
            skipNextAutosaveRef.current = false;

            return;
        }

        if (!draftWardId && (!draftTouchedRef.current || !hasServerSavableDraftSignal(draft))) {
            return;
        }

        const autosaveTimer = window.setTimeout(() => {
            void saveDraftSnapshot({isAutosave: true});
        }, ONBOARDING_DRAFT_AUTOSAVE_DELAY_MS);

        return () => window.clearTimeout(autosaveTimer);
    }, [draft, draftRestoreStatus, draftWardId, isStepTransitioning, saveDraftSnapshot, submissionStatus]);

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
            const saveResult = await saveDraftSnapshot({showErrorToast: true});

            return saveResult.success;
        }

        if (draftCreationStatus === 'creating') {
            return false;
        }

        markDraftTouched();

        const saveResult = await saveDraftSnapshot({showErrorToast: true});

        return saveResult.success;
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
    };
    const saveAndReloadDraft = async (nextDraft: TOnboardingWardDraft) => {
        const saveResult = await saveDraftSnapshot({
            showErrorToast: true,
            draftOverride: nextDraft,
            suppressNextAutosave: true,
        });

        if (!saveResult.success) {
            return false;
        }

        if (saveResult.response?.ward?.wardId) {
            applyRestoredServerDraft(saveResult.response, nextDraft);

            return true;
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
            toast.error(t('page.onboardingWardCreate.toast.reloadDraftError'));

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
            const previewResults = await Promise.all(
                schedulePreviewTargets.map(async ({teamId, previewInput}) => ({
                    teamId,
                    schedule: previewInput.schedule,
                    response: await previewOnboardingScheduleInput(previewInput.request),
                })),
            );
            const previewDraft = previewResults.reduce(
                (currentDraft, {teamId, schedule, response}) => applySchedulePreviewToDraft(currentDraft, teamId, schedule, response),
                draft,
            );
            const nextDraft = goNextStepDraft(previewDraft);

            shiftTypeStepEntryDraftRef.current = nextDraft;

            return saveAndReloadDraft(nextDraft);
        } catch (error) {
            Sentry.captureException(error, {
                tags: {feature: 'onboarding-ward-create'},
                extra: {phase: 'preview-and-save-schedule-input', step: draft.currentStep},
            });
            toast.error(t('page.onboardingWardCreate.toast.saveScheduleError'));

            return false;
        }
    };
    const goNextStep = async () => {
        if (!canGoNext(draft) || !beginStepTransition()) {
            return false;
        }

        try {
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

            if (draft.currentStep === 3) {
                const nextDraft = goNextStepDraft(draft);
                const saveResult = await saveDraftSnapshot({
                    showErrorToast: true,
                    draftOverride: nextDraft,
                    suppressNextAutosave: true,
                });

                if (saveResult.success) {
                    setDraft(nextDraft);
                }

                return;
            }

            setDraft((prev) => goNextStepDraft(prev));
        } finally {
            endStepTransition();
        }
    };
    const goPreviousStep = () => {
        markDraftTouched();

        const shiftTypeStepEntryDraft = draft.currentStep === 3 ? shiftTypeStepEntryDraftRef.current : null;

        if (draft.currentStep === 3 || draft.currentStep === 2) {
            shiftTypeStepEntryDraftRef.current = null;
        }

        setDraft((prev) => {
            const previousDraft = goPreviousStepDraft(prev);

            if (prev.currentStep === 3 && shiftTypeStepEntryDraft) {
                return {
                    ...shiftTypeStepEntryDraft,
                    currentStep: previousDraft.currentStep,
                };
            }

            return previousDraft;
        });
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
            toast.error(t('page.onboardingWardCreate.toast.maxTeams', {count: MAX_ONBOARDING_TEAMS}));

            return;
        }

        const {draft: nextDraft, addedTeamId} = addTeamDraft(draft, onboardingDraftLabels);

        setDraft(nextDraft);

        if (addedTeamId) {
            const addedTeamName =
                nextDraft.teams.find((team) => team.id === addedTeamId)?.name ?? t('page.onboardingWardCreate.fallback.newTeam');

            setSelectedTeamId(addedTeamId);
            toast.success(t('page.onboardingWardCreate.toast.addTeam', {teamName: addedTeamName}), {position: 'bottom-center'});
        }
    };
    const addNurse = () => {
        markDraftTouched();

        const targetTeamId = activeTeamId || draft.teams[0]?.id;

        if (targetTeamId) {
            const teamNurseCount = draft.nurses.filter((nurse) => nurse.teamId === targetTeamId).length;

            if (teamNurseCount >= MAX_ONBOARDING_NURSES) {
                toast.error(t('page.onboardingWardCreate.toast.maxNursesPerTeam', {count: MAX_ONBOARDING_NURSES}));

                return;
            }

            const targetTeamName =
                draft.teams.find((team) => team.id === targetTeamId)?.name ?? t('page.onboardingWardCreate.fallback.selectedTeam');

            setDraft((prev) => addNurseDraft(prev, targetTeamId, onboardingDraftLabels));
            toast.success(t('page.onboardingWardCreate.toast.addNurseToTeam', {teamName: targetTeamName}), {
                position: 'bottom-center',
            });

            return;
        }

        const {draft: withTeamDraft, addedTeamId} = addTeamDraft(draft, onboardingDraftLabels);

        if (!addedTeamId) {
            toast.error(t('page.onboardingWardCreate.toast.maxTeams', {count: MAX_ONBOARDING_TEAMS}));

            return;
        }

        const addedTeamName =
            withTeamDraft.teams.find((team) => team.id === addedTeamId)?.name ?? t('page.onboardingWardCreate.fallback.newTeam');

        setDraft(addNurseDraft(withTeamDraft, addedTeamId, onboardingDraftLabels));
        setSelectedTeamId(addedTeamId);
        toast.success(t('page.onboardingWardCreate.toast.addTeamAndNurse', {teamName: addedTeamName}), {
            position: 'bottom-center',
        });
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
            toast.success(t('page.onboardingWardCreate.toast.deleteTeamWithNurses'));
        }
    };
    const deleteNurse = (nurseId: string) => {
        markDraftTouched();

        if (!draft.nurses.some((nurse) => nurse.id === nurseId)) {
            return;
        }

        setDraft((prev) => deleteNurseDraft(prev, nurseId));
        toast.success(t('page.onboardingWardCreate.toast.deleteNurse'));
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
    const handleShiftTypeDragEnd = ({destination, source}: DropResult) => {
        if (!destination || source.index === destination.index || source.droppableId !== destination.droppableId) {
            return;
        }

        markDraftTouched();
        setDraft((prev) => reorderShiftTypes(prev, {destination, source}));
    };
    const applyUploadedFile = async (file: File, options?: TOnboardingWardParseOptions) => {
        markDraftTouched();

        if (!isSupportedOnboardingUploadFile(file.name)) {
            const message = t('page.onboardingWardCreate.upload.unsupportedFile');

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
            const fileForParsing = await normalizeOnboardingScheduleFile(file);
            const scheduleTemplate = await parseScheduleTemplateSafely(fileForParsing, options);
            const targetYear = options?.targetYear;
            const targetMonth = options?.targetMonth;

            if (targetYear && targetMonth && scheduleTemplate.length > 0) {
                let nextActiveTeamId: string | null = null;

                setDraft((prev) => {
                    const result = applyUploadedScheduleTemplateDraft(
                        prev,
                        {
                            fileName: file.name,
                            year: targetYear,
                            month: targetMonth,
                            teamSchedules: scheduleTemplate,
                        },
                        onboardingDraftLabels,
                    );

                    nextActiveTeamId = result.activeTeamId;

                    return result.draft;
                });

                if (nextActiveTeamId) {
                    setSelectedTeamId(nextActiveTeamId);
                }

                setUploadStatus('success');
                toast.success(t('page.onboardingWardCreate.toast.uploadApplied'));

                return;
            }

            const response = await FileAPI.parseOnboardingWardExcel(fileForParsing, options);
            const {parsedWardData, warnings} = buildOnboardingParseDraftInjection(response, file.name, options, {
                failedSheet: (sheetName) => t('page.onboardingWardCreate.upload.failedSheet', {sheetName}),
                failedRow: (rowLabel) => t('page.onboardingWardCreate.upload.failedRow', {rowLabel}),
            });

            let nextActiveTeamId: string | null = null;

            setDraft((prev) => {
                const parsedDraft = applyParsedWardData(prev, parsedWardData);

                if (!options?.targetYear || !options.targetMonth || scheduleTemplate.length === 0) {
                    return parsedDraft;
                }

                const result = applyUploadedScheduleTemplateDraft(
                    parsedDraft,
                    {
                        fileName: file.name,
                        year: options.targetYear,
                        month: options.targetMonth,
                        teamSchedules: scheduleTemplate,
                    },
                    onboardingDraftLabels,
                );

                nextActiveTeamId = result.activeTeamId;

                return result.draft;
            });

            if (nextActiveTeamId) {
                setSelectedTeamId(nextActiveTeamId);
            }

            setUploadWarnings(warnings);
            setUploadStatus(warnings.length > 0 ? 'warning' : 'success');
            toast.success(t('page.onboardingWardCreate.toast.uploadApplied'));
        } catch (error) {
            const message = getOnboardingUploadFailureMessage(error, {
                defaultMessage: t('page.onboardingWardCreate.upload.parseFailed'),
                networkMessage: t('page.onboardingWardCreate.upload.networkFailed'),
            });

            setUploadStatus('error');
            setUploadError(message);
            setUploadWarnings([]);
            toast.error(message);
        }
    };
    const saveSkillConfig = (config: TSkillLevelConfig) => {
        markDraftTouched();
        setDraft((prev) => saveSkillLevelConfig(prev, {...config, enabled: true}));
        toast.success(t('page.onboardingWardCreate.toast.skillConfigSaved'));
    };
    const disableSkillConfig = () => {
        markDraftTouched();
        setDraft((prev) =>
            saveSkillLevelConfig(prev, {
                ...prev.skillLevelConfig,
                enabled: false,
                autoAssign: false,
            }),
        );

        if (sortMode === 'skill') {
            setSortModeState('manual');
        }

        toast.success(t('page.onboardingWardCreate.toast.skillConfigDisabled'));
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

            saveOnboardingWardSkillSettings(nextDraft, submission.ward);
            setCreatedWard(submission.ward ?? null);
            setSubmissionStatus('success');
            toast.success(t('page.onboardingWardCreate.toast.completeSuccess'));
        } catch (error) {
            Sentry.captureException(error, {
                tags: {feature: 'onboarding-ward-create'},
                extra: {step: draft.currentStep},
            });
            setSubmissionStatus('error');
            toast.error(t('page.onboardingWardCreate.toast.completeError'));
        }
    };
    const skipOrComplete = async () => {
        if (draft.currentStep === MAX_STEP) {
            void complete();

            return;
        }

        if (draft.currentStep === 2 && !draft.uploadedFileName && !hasScheduleInputDraft(draft)) {
            if (!beginStepTransition()) {
                return;
            }

            markDraftTouched();

            try {
                const nextDraft = goNextStepDraft(prepareManualEntryDraft(draft, onboardingDraftLabels));

                shiftTypeStepEntryDraftRef.current = nextDraft;
                await saveAndReloadDraft(nextDraft);
            } finally {
                endStepTransition();
            }

            return;
        }

        await goNextStep();
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
        handleShiftTypeDragEnd,
        applyUploadedFile,
        uploadStatus,
        uploadError,
        uploadWarnings,
        draftCreationStatus,
        createdWard,
        saveSkillConfig,
        disableSkillConfig,
        complete,
        isStepTransitioning,
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
