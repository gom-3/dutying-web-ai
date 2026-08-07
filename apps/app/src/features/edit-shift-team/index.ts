import {type TUpdateNurseDTO, type TUpdateNurseShiftTypeRequest} from '@dutying/api/nurse';
import {type TAddShiftTeamNurseDTO, type TUpdateShiftTeamDTO} from '@dutying/api/ward';
import {useQuery, useQueryClient} from '@tanstack/react-query';
import {produce} from 'immer';
import {useCallback} from 'react';
import toast from 'react-hot-toast';
import {type TRequestShift, type TShift} from '@/entities/shift';
import {type TWard} from '@/entities/ward';
import {wardQueryKeys, wardQueryOptions} from '@/entities/ward/model/queries';
import useAuth from '@/features/auth';
import useRequestShift from '@/features/request-shift';
import {NurseAPI, WardAPI} from '@/shared/api';
import {useTypedTranslation} from '@/shared/hook/use-typed-translation';
import {showActionErrorFeedback} from '@/shared/util/feedback';
import useEditNurseStore from './model/store';

const TEMP_NURSE_ID_BASE = -1_000_000;
const DUMMY_PHONE_NUM = '01000000000';
const LEGACY_NEW_NURSE_PREFIX = '\uC2E0\uADDC\uAC04\uD638\uC0AC';
const DEFAULT_NURSE_SHIFT_RATIO_WEIGHT = 7;

export type TUpdateNurseShiftMeta = {
    wardShiftTypeId?: number;
    name: string;
    shortName: string;
    targetRatioWeight?: number;
};

const isTempNurseId = (nurseId: number) => nurseId <= TEMP_NURSE_ID_BASE;
const toPhoneDigits = (phoneNum: string | null | undefined) => (phoneNum ?? '').replace(/\D/g, '');
const isDummyPhoneNum = (phoneNum: string | null | undefined) => toPhoneDigits(phoneNum) === DUMMY_PHONE_NUM;
const toOptionalPhoneNum = (phoneNum: string | null | undefined, options: {clearBlank?: boolean} = {}) => {
    if (phoneNum === undefined) return undefined;

    if (phoneNum === null) return options.clearBlank ? null : undefined;

    const trimmedPhoneNum = phoneNum.trim();

    if (isDummyPhoneNum(trimmedPhoneNum)) return options.clearBlank ? null : undefined;

    return trimmedPhoneNum.length > 0 ? trimmedPhoneNum : options.clearBlank ? null : undefined;
};
const toOptionalBirthDate = (birthDate: string | null | undefined) => {
    if (birthDate === undefined) return undefined;
    if (birthDate === null) return null;

    const trimmedBirthDate = birthDate.trim();

    return trimmedBirthDate.length > 0 ? trimmedBirthDate : null;
};
const compactRequest = <T extends Record<string, unknown>>(request: T) =>
    Object.fromEntries(Object.entries(request).filter(([, value]) => value !== undefined)) as T;
const getNextNewNurseName = (names: string[], prefix: string) => {
    const usedNumbers = names
        .map((name) => {
            const matchedPrefix = [prefix, LEGACY_NEW_NURSE_PREFIX].find((candidate) => name.startsWith(candidate));

            if (!matchedPrefix) return null;

            const suffix = name.slice(matchedPrefix.length).trim();
            const parsed = Number.parseInt(suffix, 10);

            return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
        })
        .filter((value): value is number => value != null);
    const nextNumber = (usedNumbers.length ? Math.max(...usedNumbers) : 0) + 1;

    return `${prefix}${nextNumber}`;
};
const canCreateNurse = (nurse: TUpdateNurseDTO) => (nurse.name ?? '').trim().length > 0;

type TShiftTeamNurse = TWard['shiftTeams'][number]['nurses'][number];

const getShiftTeamNurseCount = (shiftTeams: TWard['shiftTeams'] | undefined) =>
    Array.isArray(shiftTeams) ? shiftTeams.reduce((sum, shiftTeam) => sum + (shiftTeam.nurseCnt ?? shiftTeam.nurses.length), 0) : 0;
const appendNurseToShiftTeams = (shiftTeams: TWard['shiftTeams'], shiftTeamId: number, nurse: TShiftTeamNurse) =>
    produce(shiftTeams, (draft) => {
        const shiftTeam = draft.find((team) => team.shiftTeamId === shiftTeamId);

        if (!shiftTeam) return;

        if (shiftTeam.nurses.some((currentNurse) => currentNurse.nurseId === nurse.nurseId)) return;

        shiftTeam.nurses.push(nurse);
        shiftTeam.nurseCnt = Math.max(shiftTeam.nurseCnt ?? 0, shiftTeam.nurses.length);
    });
const resolveShiftTeams = (wardShiftTeams: TWard['shiftTeams'] | undefined, queriedShiftTeams: TWard['shiftTeams'] | undefined) => {
    const safeQueriedShiftTeams = Array.isArray(queriedShiftTeams) ? queriedShiftTeams : undefined;

    if (!safeQueriedShiftTeams) return wardShiftTeams;

    if (!wardShiftTeams) return safeQueriedShiftTeams;

    const queriedNurseCount = getShiftTeamNurseCount(safeQueriedShiftTeams);
    const wardNurseCount = getShiftTeamNurseCount(wardShiftTeams);

    if (queriedNurseCount > 0 || wardNurseCount === 0) {
        return safeQueriedShiftTeams;
    }

    return wardShiftTeams;
};
const mergeWardShiftTeams = (ward: TWard | undefined, shiftTeams: TWard['shiftTeams'] | undefined): TWard | undefined => {
    if (!ward || !shiftTeams) return ward;

    return {
        ...ward,
        shiftTeams,
        nurseCnt: getShiftTeamNurseCount(shiftTeams),
    };
};
const toNursePayload = (nurse: TUpdateNurseDTO, options: {clearBlankPhoneNum?: boolean} = {}) =>
    compactRequest({
        name: nurse.name?.trim(),
        phoneNum: toOptionalPhoneNum(nurse.phoneNum, {clearBlank: options.clearBlankPhoneNum}),
        birthDate: toOptionalBirthDate(nurse.birthDate),
        isWorker: nurse.isWorker,
        isWardManager: nurse.isWardManager,
        memo: nurse.memo ?? undefined,
        isPreceptor: nurse.isPreceptor,
        isPreceptee: nurse.isPreceptee,
    }) as TUpdateNurseDTO;
const toCreateNursePayload = (nurse: TUpdateNurseDTO): TAddShiftTeamNurseDTO => ({
    ...toNursePayload(nurse),
    name: (nurse.name ?? '').trim(),
});
const useEditShiftTeam = () => {
    const {t} = useTypedTranslation();
    const {
        selectedNurseId,
        selectedNurseDrawerMode,
        isNurseDraftDirty,
        nurseSaveStatus,
        isAddingNurse,
        isDeletingNurse,
        beginAddingNurse,
        completeAddingNurse,
        finishAddingNurse,
        beginDeletingNurse,
        completeDeletingNurse,
        finishDeletingNurse,
        selectNurse: selectNurseState,
        beginSavingNurse,
        completeSavingNurse,
        failSavingNurse,
        setNurseDraftDirty: setNurseDraftDirtyState,
    } = useEditNurseStore();
    const {
        state: {wardId},
    } = useAuth();
    const queryClient = useQueryClient();
    const wardQueryKey = wardQueryKeys.id(wardId ?? 0);
    const wardQueryOptionsValue = wardQueryOptions.id(wardId ?? 0);
    const shiftTeamsQueryKey = wardQueryKeys.shiftTeams(wardId ?? 0);
    const shiftTeamsQueryOptionsValue = wardQueryOptions.shiftTeams(wardId ?? 0);
    const shiftQueryKey = wardQueryKeys.shift();
    const {
        queryKey: {requestShiftQueryKey},
    } = useRequestShift();
    const {data: ward} = useQuery({
        ...wardQueryOptionsValue,
        enabled: !!wardId,
    });
    const {data: queriedShiftTeams} = useQuery({
        ...shiftTeamsQueryOptionsValue,
        enabled: !!wardId,
    });
    const shiftTeams = resolveShiftTeams(ward?.shiftTeams, queriedShiftTeams);
    const effectiveWard = mergeWardShiftTeams(ward, shiftTeams);
    const invalidateWard = useCallback(async () => {
        await queryClient.invalidateQueries({queryKey: wardQueryKey});
        void queryClient.invalidateQueries({queryKey: shiftTeamsQueryKey});
    }, [queryClient, shiftTeamsQueryKey, wardQueryKey]);
    const invalidateWardShiftAndRequest = useCallback(async () => {
        await queryClient.invalidateQueries({queryKey: wardQueryKey});
        await queryClient.invalidateQueries({queryKey: shiftTeamsQueryKey});
        await queryClient.invalidateQueries({queryKey: shiftQueryKey});
        await queryClient.invalidateQueries({queryKey: requestShiftQueryKey});

        if (wardId) {
            await queryClient.invalidateQueries({queryKey: [...wardQueryKeys.all(), 'shiftTeamNurses', wardId]});
            await queryClient.invalidateQueries({queryKey: ['ward-board', 'schedules', wardId]});
            await queryClient.invalidateQueries({queryKey: ['home', 'board-schedules']});
        }
    }, [queryClient, requestShiftQueryKey, shiftQueryKey, shiftTeamsQueryKey, wardId, wardQueryKey]);
    const addNurse = useCallback(
        async (shiftTeamId: number) => {
            if (!wardId) return;

            beginAddingNurse();

            try {
                const currentWard = queryClient.getQueryData<TWard>(wardQueryKey) ?? effectiveWard;
                const targetShiftTeam = currentWard?.shiftTeams.find((shiftTeam) => shiftTeam.shiftTeamId === shiftTeamId);
                const nextName = getNextNewNurseName(
                    (targetShiftTeam?.nurses ?? []).map((nurse) => nurse.name.trim()),
                    t('feature.editShiftTeam.newNursePrefix'),
                );
                const createdNurse = await WardAPI.addNurseIntoShiftTeam(wardId, shiftTeamId, {
                    name: nextName,
                    isWorker: true,
                    isWardManager: false,
                    isPreceptor: false,
                    isPreceptee: false,
                    memo: '',
                });

                queryClient.setQueryData<TWard>(
                    wardQueryKey,
                    produce((queryClient.getQueryData<TWard>(wardQueryKey) ?? effectiveWard) as TWard, (draft) => {
                        draft.shiftTeams = appendNurseToShiftTeams(draft.shiftTeams, shiftTeamId, createdNurse);
                        draft.nurseCnt = getShiftTeamNurseCount(draft.shiftTeams);
                    }),
                );
                queryClient.setQueryData<TWard['shiftTeams']>(shiftTeamsQueryKey, (currentShiftTeams) => {
                    const baseShiftTeams = currentShiftTeams ?? currentWard?.shiftTeams;

                    if (!baseShiftTeams) return currentShiftTeams;

                    return appendNurseToShiftTeams(baseShiftTeams, shiftTeamId, createdNurse);
                });
                completeAddingNurse(createdNurse.nurseId);
                void invalidateWard();
                toast.success(t('feature.editShiftTeam.addNurseSuccess', {name: nextName}), {position: 'bottom-center'});
            } catch (error) {
                showActionErrorFeedback(error, t('feature.editShiftTeam.addNurseFailed'));
            } finally {
                finishAddingNurse();
            }
        },
        [
            beginAddingNurse,
            completeAddingNurse,
            effectiveWard,
            finishAddingNurse,
            invalidateWard,
            queryClient,
            shiftTeamsQueryKey,
            t,
            wardId,
            wardQueryKey,
        ],
    );
    const deleteNurse = useCallback(
        async (shiftTeamId: number, nurseId: number) => {
            if (!wardId) return;

            if (isTempNurseId(nurseId)) {
                const oldWard = queryClient.getQueryData<TWard>(wardQueryKey) ?? ward;

                if (oldWard) {
                    queryClient.setQueryData<TWard>(
                        wardQueryKey,
                        produce(oldWard, (draft) => {
                            const shiftTeam = draft.shiftTeams.find((team) => team.shiftTeamId === shiftTeamId);

                            if (!shiftTeam) return;

                            shiftTeam.nurses = shiftTeam.nurses.filter((nurse) => nurse.nurseId !== nurseId);
                            shiftTeam.nurseCnt = shiftTeam.nurses.length;
                        }),
                    );
                }

                completeDeletingNurse();

                return;
            }

            beginDeletingNurse();

            try {
                await WardAPI.removeNurseFromShiftTeam(wardId, shiftTeamId, nurseId);
                completeDeletingNurse();
                toast.success(t('feature.editShiftTeam.deleteNurseSuccess'));
                await invalidateWard();
            } catch (error) {
                showActionErrorFeedback(error, t('feature.editShiftTeam.deleteNurseFailed'));
            } finally {
                finishDeletingNurse();
            }
        },
        [beginDeletingNurse, completeDeletingNurse, finishDeletingNurse, invalidateWard, queryClient, t, ward, wardId, wardQueryKey],
    );
    const disconnectNurse = useCallback(
        async (nurseId: number) => {
            if (!wardId) return false;

            beginSavingNurse();

            await queryClient.cancelQueries({queryKey: wardQueryKey});
            await queryClient.cancelQueries({queryKey: shiftQueryKey});
            await queryClient.cancelQueries({queryKey: requestShiftQueryKey});

            const oldWard = queryClient.getQueryData<TWard>(wardQueryKey);
            const oldShift = queryClient.getQueryData<TShift>(shiftQueryKey);
            const oldReqShift = queryClient.getQueryData<TRequestShift>(requestShiftQueryKey);

            if (oldWard) {
                queryClient.setQueryData<TWard>(
                    wardQueryKey,
                    produce(oldWard, (draft) => {
                        draft.shiftTeams.forEach((shiftTeam) => {
                            shiftTeam.nurses.forEach((nurse) => {
                                if (nurse.nurseId !== nurseId) return;

                                nurse.isConnected = false;
                            });
                        });
                    }),
                );
            }

            try {
                await NurseAPI.unConnectNurse(nurseId);
                completeSavingNurse();
                await invalidateWardShiftAndRequest();
                toast.success(t('feature.editShiftTeam.disconnectSuccess'));

                return true;
            } catch (error) {
                if (oldWard) queryClient.setQueryData(wardQueryKey, oldWard);

                if (oldShift) queryClient.setQueryData(shiftQueryKey, oldShift);

                if (oldReqShift) queryClient.setQueryData(requestShiftQueryKey, oldReqShift);

                failSavingNurse();
                showActionErrorFeedback(error, t('feature.editShiftTeam.disconnectFailed'));

                return false;
            }
        },
        [
            beginSavingNurse,
            completeSavingNurse,
            failSavingNurse,
            invalidateWardShiftAndRequest,
            queryClient,
            requestShiftQueryKey,
            shiftQueryKey,
            t,
            wardId,
            wardQueryKey,
        ],
    );
    const selectNurse = useCallback(
        (nurseId: number | null, mode: 'create' | 'edit' = 'edit') => {
            if (selectedNurseId === nurseId) {
                return true;
            }

            selectNurseState(nurseId, mode);

            return true;
        },
        [selectNurseState, selectedNurseId],
    );
    const updateNurse = useCallback(
        async (nurseId: number, updateNurseDTO: TUpdateNurseDTO) => {
            if (isTempNurseId(nurseId) && !canCreateNurse(updateNurseDTO)) {
                return false;
            }

            beginSavingNurse();

            await queryClient.cancelQueries({queryKey: wardQueryKey});
            await queryClient.cancelQueries({queryKey: shiftQueryKey});
            await queryClient.cancelQueries({queryKey: requestShiftQueryKey});

            const oldWard = queryClient.getQueryData<TWard>(wardQueryKey);
            const oldShift = queryClient.getQueryData<TShift>(shiftQueryKey);
            const oldReqShift = queryClient.getQueryData<TRequestShift>(requestShiftQueryKey);

            if (oldWard) {
                queryClient.setQueryData<TWard>(
                    wardQueryKey,
                    produce(oldWard, (draft) => {
                        draft.shiftTeams.forEach((shiftTeam) => {
                            shiftTeam.nurses.forEach((nurse) => {
                                if (nurse.nurseId !== nurseId) return;

                                Object.assign(nurse, updateNurseDTO);
                            });
                        });
                    }),
                );
            }

            try {
                if (isTempNurseId(nurseId)) {
                    const createNurseDTO = updateNurseDTO as TUpdateNurseDTO & {shiftTeamId?: number};
                    const createdNurse = await WardAPI.addNurseIntoShiftTeam(
                        wardId!,
                        createNurseDTO.shiftTeamId!,
                        toCreateNursePayload(updateNurseDTO),
                    );
                    const currentWard = queryClient.getQueryData<TWard>(wardQueryKey) ?? oldWard;

                    if (currentWard) {
                        queryClient.setQueryData<TWard>(
                            wardQueryKey,
                            produce(currentWard, (draft) => {
                                draft.shiftTeams.forEach((shiftTeam) => {
                                    shiftTeam.nurses.forEach((nurse) => {
                                        if (nurse.nurseId !== nurseId) return;

                                        Object.assign(nurse, {
                                            ...nurse,
                                            ...createdNurse,
                                            shiftTeamId: createdNurse.shiftTeamId ?? createNurseDTO.shiftTeamId,
                                            wardId: createdNurse.wardId ?? wardId,
                                        });
                                    });
                                });
                            }),
                        );
                    }

                    selectNurseState(createdNurse.nurseId, 'edit');
                } else {
                    await NurseAPI.updateNurse(nurseId, toNursePayload(updateNurseDTO, {clearBlankPhoneNum: true}));
                }

                completeSavingNurse();

                await invalidateWardShiftAndRequest();

                return true;
            } catch (error) {
                if (oldWard) queryClient.setQueryData(wardQueryKey, oldWard);

                if (oldShift) queryClient.setQueryData(shiftQueryKey, oldShift);

                if (oldReqShift) queryClient.setQueryData(requestShiftQueryKey, oldReqShift);

                failSavingNurse();

                showActionErrorFeedback(error, t('feature.editShiftTeam.updateNurseFailed'));

                return false;
            }
        },
        [
            beginSavingNurse,
            completeSavingNurse,
            failSavingNurse,
            invalidateWardShiftAndRequest,
            selectNurseState,
            queryClient,
            requestShiftQueryKey,
            shiftQueryKey,
            t,
            wardId,
            wardQueryKey,
        ],
    );
    const updateNurseShift = useCallback(
        async (nurseId: number, nurseShiftTypeId: number, change: TUpdateNurseShiftTypeRequest, shiftTypeMeta?: TUpdateNurseShiftMeta) => {
            await queryClient.cancelQueries({queryKey: wardQueryKey});
            await queryClient.cancelQueries({queryKey: shiftQueryKey});
            await queryClient.cancelQueries({queryKey: requestShiftQueryKey});

            const oldWard = queryClient.getQueryData<TWard>(wardQueryKey);
            const oldShift = queryClient.getQueryData<TShift>(shiftQueryKey);
            const oldReqShift = queryClient.getQueryData<TRequestShift>(requestShiftQueryKey);

            if (oldWard) {
                queryClient.setQueryData<TWard>(
                    wardQueryKey,
                    produce(oldWard, (draft) => {
                        draft.shiftTeams.forEach((shiftTeam) => {
                            shiftTeam.nurses.forEach((nurse) => {
                                if (nurse.nurseId !== nurseId) return;

                                let targetShiftType = nurse.nurseShiftTypes.find(
                                    (shiftType) => shiftType.nurseShiftTypeId === nurseShiftTypeId,
                                );

                                if (!targetShiftType && shiftTypeMeta) {
                                    nurse.nurseShiftTypes.push({
                                        nurseShiftTypeId,
                                        wardShiftTypeId: shiftTypeMeta.wardShiftTypeId,
                                        name: shiftTypeMeta.name,
                                        shortName: shiftTypeMeta.shortName,
                                        isPossible: change.isPossible ?? true,
                                        isPreferred: change.isPreferred ?? change.isPrefer ?? false,
                                        targetRatioWeight:
                                            change.targetRatioWeight ?? shiftTypeMeta.targetRatioWeight ?? DEFAULT_NURSE_SHIFT_RATIO_WEIGHT,
                                    });
                                    targetShiftType = nurse.nurseShiftTypes[nurse.nurseShiftTypes.length - 1];
                                }

                                if (!targetShiftType) return;

                                if (typeof change.isPossible === 'boolean') {
                                    targetShiftType.isPossible = change.isPossible;
                                }

                                const nextIsPreferred = change.isPreferred ?? change.isPrefer;

                                if (typeof nextIsPreferred === 'boolean') {
                                    targetShiftType.isPreferred = nextIsPreferred;
                                }

                                if (typeof change.targetRatioWeight === 'number') {
                                    targetShiftType.targetRatioWeight = change.targetRatioWeight;
                                }
                            });
                        });
                    }),
                );
            }

            if (isTempNurseId(nurseId)) {
                return true;
            }

            try {
                await NurseAPI.updateNurseShiftType(nurseId, nurseShiftTypeId, change);
                await invalidateWardShiftAndRequest();

                return true;
            } catch (error) {
                if (oldWard) queryClient.setQueryData(wardQueryKey, oldWard);

                if (oldShift) queryClient.setQueryData(shiftQueryKey, oldShift);

                if (oldReqShift) queryClient.setQueryData(requestShiftQueryKey, oldReqShift);

                showActionErrorFeedback(error, t('feature.editShiftTeam.updateNurseShiftFailed'));

                return false;
            }
        },
        [invalidateWardShiftAndRequest, queryClient, requestShiftQueryKey, shiftQueryKey, t, wardQueryKey],
    );
    const createShiftTeam = useCallback(async () => {
        if (!wardId) return;

        const createdShiftTeam = await WardAPI.createShiftTeam(wardId);

        await invalidateWard();

        return createdShiftTeam;
    }, [invalidateWard, wardId]);
    const deleteShiftTeam = useCallback(
        async (shiftTeamId: number) => {
            if (!wardId) return;

            await WardAPI.deleteShiftTeam(wardId, shiftTeamId);
            await invalidateWard();
        },
        [invalidateWard, wardId],
    );
    const editDivision = useCallback(
        async (shiftTeamId: number, prevPriority: number, changeValue: number, patchYearMonth: string) => {
            await NurseAPI.updateShiftTeamDivision(shiftTeamId, prevPriority, changeValue, patchYearMonth);
            await invalidateWardShiftAndRequest();
        },
        [invalidateWardShiftAndRequest],
    );
    const updateShiftTeamDivisionName = useCallback(
        async (shiftTeamId: number, divisionNum: number, name: string | null) => {
            if (!wardId) return false;

            try {
                await WardAPI.updateShiftTeamDivisionName(wardId, shiftTeamId, divisionNum, {name});
                await invalidateWardShiftAndRequest();

                return true;
            } catch (error) {
                showActionErrorFeedback(error, '그룹 이름을 저장하지 못했습니다.');

                return false;
            }
        },
        [invalidateWardShiftAndRequest, wardId],
    );
    const moveNurseOrder = useCallback(
        async (
            nurseId: number,
            shiftTeamId: number,
            nextShiftTeamId: number,
            divisionNum: number,
            prevPriority: number,
            nextPriority: number,
            patchYearMonth: string,
        ) => {
            await queryClient.cancelQueries({queryKey: wardQueryKey});
            await queryClient.cancelQueries({queryKey: shiftQueryKey});
            await queryClient.cancelQueries({queryKey: requestShiftQueryKey});

            const oldWard = queryClient.getQueryData<TWard>(wardQueryKey);
            const oldShift = queryClient.getQueryData<TShift>(shiftQueryKey);
            const oldReqShift = queryClient.getQueryData<TRequestShift>(requestShiftQueryKey);

            if (oldWard) {
                queryClient.setQueryData<TWard>(
                    wardQueryKey,
                    produce(oldWard, (draft) => {
                        const sourceShiftTeam = draft.shiftTeams.find((shiftTeam) => shiftTeam.shiftTeamId === shiftTeamId);
                        const destinationShiftTeam = draft.shiftTeams.find((shiftTeam) => shiftTeam.shiftTeamId === nextShiftTeamId);

                        if (!sourceShiftTeam || !destinationShiftTeam) return;

                        const sourceNurses = sourceShiftTeam.nurses;
                        const nurse = sourceNurses.find((nurse) => nurse.nurseId === nurseId)!;

                        sourceNurses.splice(
                            sourceNurses.findIndex((x) => x.nurseId === nurseId),
                            1,
                        );

                        const destinationNurses = destinationShiftTeam.nurses;
                        const nextPriorityIndex = destinationNurses.findIndex((x) => x.priority === nextPriority);
                        const prevPriorityIndex = destinationNurses.findIndex((x) => x.priority === prevPriority);
                        const insertIndex =
                            nextPriorityIndex !== -1
                                ? nextPriorityIndex
                                : prevPriorityIndex === -1
                                  ? destinationNurses.length
                                  : prevPriorityIndex + 1;

                        destinationNurses.splice(insertIndex, 0, {
                            ...nurse,
                            shiftTeamId: nextShiftTeamId,
                            divisionNum,
                            priority: (prevPriority + nextPriority) / 2,
                        });

                        sourceShiftTeam.nurseCnt = sourceShiftTeam.nurses.length;
                        destinationShiftTeam.nurseCnt = destinationShiftTeam.nurses.length;
                    }),
                );
            }

            if (oldShift) {
                queryClient.setQueryData<TShift>(
                    shiftQueryKey,
                    produce(oldShift, (draft) => {
                        const sourceRows = draft.divisionShiftNurses.find((x) => x.some((y) => y.shiftNurse.nurseId === nurseId));

                        if (sourceRows === undefined) return;

                        const row = sourceRows.find((x) => x.shiftNurse.nurseId === nurseId)!;

                        sourceRows.splice(
                            sourceRows.findIndex((x) => x.shiftNurse.nurseId === nurseId),
                            1,
                        );

                        let desticationRow = draft.divisionShiftNurses.find((x) => x.some((y) => y.shiftNurse.priority === prevPriority));

                        if (desticationRow) {
                            const index = desticationRow.findIndex((x) => x.shiftNurse.priority === prevPriority);

                            desticationRow.splice(index === -1 ? 0 : index + 1, 0, row);
                        } else {
                            desticationRow = draft.divisionShiftNurses.find((x) => x.some((y) => y.shiftNurse.priority === nextPriority));

                            if (desticationRow) {
                                const index = desticationRow.findIndex((x) => x.shiftNurse.priority === nextPriority);

                                desticationRow.splice(index === -1 ? 0 : index, 0, row);
                            }
                        }
                    }),
                );
            }

            if (oldReqShift) {
                queryClient.setQueryData<TRequestShift>(
                    requestShiftQueryKey,
                    produce(oldReqShift, (draft) => {
                        const sourceRows = draft.divisionShiftNurses.find((x) => x.some((y) => y.shiftNurse.nurseId === nurseId));

                        if (sourceRows === undefined) return;

                        const row = sourceRows.find((x) => x.shiftNurse.nurseId === nurseId)!;

                        sourceRows.splice(
                            sourceRows.findIndex((x) => x.shiftNurse.nurseId === nurseId),
                            1,
                        );

                        let desticationRow = draft.divisionShiftNurses.find((x) => x.some((y) => y.shiftNurse.priority === prevPriority));

                        if (desticationRow) {
                            const index = desticationRow.findIndex((x) => x.shiftNurse.priority === prevPriority);

                            desticationRow.splice(index === -1 ? 0 : index + 1, 0, row);
                        } else {
                            desticationRow = draft.divisionShiftNurses.find((x) => x.some((y) => y.shiftNurse.priority === nextPriority));

                            if (desticationRow) {
                                const index = desticationRow.findIndex((x) => x.shiftNurse.priority === nextPriority);

                                desticationRow.splice(index === -1 ? 0 : index, 0, row);
                            }
                        }
                    }),
                );
            }

            try {
                await NurseAPI.updateNurseOrder(
                    nurseId,
                    shiftTeamId,
                    nextShiftTeamId,
                    divisionNum,
                    prevPriority,
                    nextPriority,
                    patchYearMonth,
                );
                await invalidateWardShiftAndRequest();

                return true;
            } catch (error) {
                if (oldWard) queryClient.setQueryData(wardQueryKey, oldWard);

                if (oldShift) queryClient.setQueryData(shiftQueryKey, oldShift);

                if (oldReqShift) queryClient.setQueryData(requestShiftQueryKey, oldReqShift);

                showActionErrorFeedback(error, t('feature.editShiftTeam.moveNurseFailed'));

                return false;
            }
        },
        [invalidateWardShiftAndRequest, queryClient, requestShiftQueryKey, shiftQueryKey, t, wardQueryKey],
    );
    const updateShiftTeam = useCallback(
        async (shiftTeamId: number, updateShiftTeamDTO: TUpdateShiftTeamDTO) => {
            if (!wardId) return;

            const oldWard = queryClient.getQueryData<TWard>(wardQueryKey);

            if (oldWard) {
                queryClient.setQueryData<TWard>(
                    wardQueryKey,
                    produce(oldWard, (draft) => {
                        const shiftTeam = draft.shiftTeams.find((shiftTeam) => shiftTeam.shiftTeamId === shiftTeamId)!;

                        shiftTeam.name = updateShiftTeamDTO.name;
                    }),
                );
            }

            try {
                await WardAPI.updateShiftTeam(wardId, shiftTeamId, updateShiftTeamDTO);
            } finally {
                await invalidateWard();
            }
        },
        [invalidateWard, queryClient, wardId, wardQueryKey],
    );
    const setNurseDraftDirty = useCallback(
        (isDirty: boolean) => {
            setNurseDraftDirtyState(isDirty);
        },
        [setNurseDraftDirtyState],
    );

    return {
        state: {
            ward: effectiveWard,
            selectedNurse: effectiveWard?.shiftTeams?.flatMap((x) => x.nurses).find((nurse) => nurse.nurseId === selectedNurseId),
            shiftTeams: effectiveWard?.shiftTeams,
            selectedNurseDrawerMode,
            isNurseDraftDirty,
            nurseSaveStatus,
            isAddingNurse,
            isDeletingNurse,
        },
        actions: {
            addNurse,
            deleteNurse,
            selectNurse,
            updateNurse,
            updateNurseShift,
            disconnectNurse,
            createShiftTeam,
            deleteShiftTeam,
            editDivision,
            updateShiftTeamDivisionName,
            moveNurseOrder,
            updateShiftTeam,
            setNurseDraftDirty,
        },
    };
};

export default useEditShiftTeam;
