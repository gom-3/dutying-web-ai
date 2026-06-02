import {type TUpdateNurseDTO, type TUpdateNurseShiftTypeRequest} from '@dutying/api/nurse';
import {type TUpdateShiftTeamDTO} from '@dutying/api/ward';
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
import {showActionErrorFeedback} from '@/shared/util/feedback';
import useEditNurseStore from './model/store';

const TEMP_NURSE_ID_BASE = -1_000_000;

export type TUpdateNurseShiftMeta = {
    name: string;
    shortName: string;
};

const isTempNurseId = (nurseId: number) => nurseId <= TEMP_NURSE_ID_BASE;
const normalizePhoneNum = (phoneNum: string) => phoneNum.replace(/\D/g, '');
const toRequiredPhoneNum = (phoneNum: string) => {
    const normalizedPhoneNum = normalizePhoneNum(phoneNum);

    return normalizedPhoneNum.length >= 10 && normalizedPhoneNum.length <= 11 ? normalizedPhoneNum : '01000000000';
};
const toRequiredGender = (gender: string) => (gender === '남' || gender === '여' ? gender : '여');
const getNextNewNurseName = (names: string[]) => {
    const prefix = '신규간호사';
    const usedNumbers = names
        .map((name) => {
            if (!name.startsWith(prefix)) return null;
            const suffix = name.slice(prefix.length).trim();
            const parsed = Number.parseInt(suffix, 10);
            return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
        })
        .filter((value): value is number => value != null);

    const nextNumber = (usedNumbers.length ? Math.max(...usedNumbers) : 0) + 1;
    return `${prefix}${nextNumber}`;
};
const canCreateNurse = (nurse: TUpdateNurseDTO) => nurse.name.trim().length > 0;
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
const resolveShiftTeams = (
    wardShiftTeams: TWard['shiftTeams'] | undefined,
    queriedShiftTeams: TWard['shiftTeams'] | undefined,
) => {
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
const toNursePayload = (nurse: TUpdateNurseDTO) =>
    ({
        name: nurse.name.trim(),
        gender: toRequiredGender(nurse.gender),
        phoneNum: toRequiredPhoneNum(nurse.phoneNum),
        isWorker: nurse.isWorker,
        employmentDate: nurse.employmentDate ?? '',
        isDutyManager: false,
        isWardManager: nurse.isWardManager,
        memo: nurse.memo ?? '',
    }) as TUpdateNurseDTO;
const useEditShiftTeam = () => {
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
        }
    }, [queryClient, requestShiftQueryKey, shiftQueryKey, shiftTeamsQueryKey, wardId, wardQueryKey]);
    const addNurse = useCallback(
        async (shiftTeamId: number) => {
            if (!wardId) return;

            beginAddingNurse();

            try {
                const currentWard = queryClient.getQueryData<TWard>(wardQueryKey) ?? effectiveWard;
                const targetShiftTeam = currentWard?.shiftTeams.find((shiftTeam) => shiftTeam.shiftTeamId === shiftTeamId);
                const nextName = getNextNewNurseName((targetShiftTeam?.nurses ?? []).map((nurse) => nurse.name.trim()));
                const createdNurse = await WardAPI.addNurseIntoShiftTeam(wardId, shiftTeamId, {
                    name: nextName,
                    phoneNum: '01000000000',
                    gender: '여',
                    isWorker: true,
                    employmentDate: '',
                    isDutyManager: false,
                    isWardManager: false,
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
                toast.success(`${nextName}를 추가했어요.`, {position: 'bottom-center'});
            } catch (error) {
                showActionErrorFeedback(error, '간호사를 추가하지 못했어요.');
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
                toast.success('간호사를 삭제했어요.');
                await invalidateWard();
            } catch (error) {
                showActionErrorFeedback(error, '간호사를 삭제하지 못했어요.');
            } finally {
                finishDeletingNurse();
            }
        },
        [beginDeletingNurse, completeDeletingNurse, finishDeletingNurse, invalidateWard, queryClient, ward, wardId, wardQueryKey],
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
                toast.success('연동을 끊었어요.');

                return true;
            } catch (error) {
                if (oldWard) queryClient.setQueryData(wardQueryKey, oldWard);

                if (oldShift) queryClient.setQueryData(shiftQueryKey, oldShift);

                if (oldReqShift) queryClient.setQueryData(requestShiftQueryKey, oldReqShift);

                failSavingNurse();
                showActionErrorFeedback(error, '연동을 끊지 못했어요.');

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
                        toNursePayload(updateNurseDTO),
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
                    await NurseAPI.updateNurse(nurseId, toNursePayload(updateNurseDTO));
                }

                completeSavingNurse();

                await invalidateWardShiftAndRequest();

                return true;
            } catch (error) {
                if (oldWard) queryClient.setQueryData(wardQueryKey, oldWard);

                if (oldShift) queryClient.setQueryData(shiftQueryKey, oldShift);

                if (oldReqShift) queryClient.setQueryData(requestShiftQueryKey, oldReqShift);

                failSavingNurse();

                showActionErrorFeedback(error, '간호사 정보를 수정하지 못했어요.');

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
                                        name: shiftTypeMeta.name,
                                        shortName: shiftTypeMeta.shortName,
                                        isPossible: change.isPossible ?? true,
                                        isPreferred: change.isPrefer ?? false,
                                    });
                                    targetShiftType = nurse.nurseShiftTypes[nurse.nurseShiftTypes.length - 1];
                                }

                                if (!targetShiftType) return;

                                if (typeof change.isPossible === 'boolean') {
                                    targetShiftType.isPossible = change.isPossible;
                                }

                                if (typeof change.isPrefer === 'boolean') {
                                    targetShiftType.isPreferred = change.isPrefer;
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

                showActionErrorFeedback(error, '가능한 근무 유형을 저장하지 못했어요.');

                return false;
            }
        },
        [invalidateWardShiftAndRequest, queryClient, requestShiftQueryKey, shiftQueryKey, wardQueryKey],
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

                showActionErrorFeedback(error, '간호사를 이동하지 못했어요.');

                return false;
            }
        },
        [invalidateWardShiftAndRequest, queryClient, requestShiftQueryKey, shiftQueryKey, wardQueryKey],
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
            moveNurseOrder,
            updateShiftTeam,
            setNurseDraftDirty,
        },
    };
};

export default useEditShiftTeam;
