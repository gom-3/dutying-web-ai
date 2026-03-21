import {useQuery, useQueryClient} from '@tanstack/react-query';
import {produce} from 'immer';
import {useCallback} from 'react';
import toast from 'react-hot-toast';
import {type TRequestShift, type TShift} from '@/entities/shift';
import {type TWard} from '@/entities/ward';
import {wardQueryKeys, wardQueryOptions} from '@/entities/ward/model/queries';
import useAuth from '@/features/auth/useAuth';
import useRequestShift from '@/features/shift/useRequestShift';
import {NurseAPI, WardAPI} from '@/shared/api';
import {type TUpdateNurseDTO, type TUpdateNurseShiftTypeRequest} from '@/shared/api/nurse/type';
import {type TUpdateShiftTeamDTO} from '@/shared/api/ward/type';
import {showActionErrorFeedback} from '@/shared/util/feedback';
import useEditNurseStore from './store';

const useEditShiftTeam = () => {
    const {selectedNurseId, selectedNurseDrawerMode, isNurseDraftDirty, nurseSaveStatus, isAddingNurse, isDeletingNurse, patch} =
        useEditNurseStore();
    const {
        state: {wardId},
    } = useAuth();
    const queryClient = useQueryClient();
    const wardQueryKey = wardQueryKeys.id(wardId ?? 0);
    const wardQueryOptionsValue = wardQueryOptions.id(wardId ?? 0);
    const shiftQueryKey = wardQueryKeys.shift();
    const {
        queryKey: {requestShiftQueryKey},
    } = useRequestShift();
    const {data: ward} = useQuery({
        ...wardQueryOptionsValue,
        enabled: !!wardId,
    });
    const invalidateWard = useCallback(async () => {
        await queryClient.invalidateQueries({queryKey: wardQueryKey});
    }, [queryClient, wardQueryKey]);
    const invalidateWardShiftAndRequest = useCallback(async () => {
        await queryClient.invalidateQueries({queryKey: wardQueryKey});
        await queryClient.invalidateQueries({queryKey: shiftQueryKey});
        await queryClient.invalidateQueries({queryKey: requestShiftQueryKey});
    }, [queryClient, requestShiftQueryKey, shiftQueryKey, wardQueryKey]);
    const addNurse = useCallback(
        async (shiftTeamId: number) => {
            if (!wardId) return;

            patch({
                isAddingNurse: true,
            });

            try {
                const nurse = await WardAPI.addNurseIntoShiftTeam(wardId, shiftTeamId, {
                    name: `간호사${Math.floor(Math.random() * 10000)}`,
                    phoneNum: '01012345678',
                    gender: '여',
                    isWorker: true,
                    employmentDate: '2021-08-01',
                    isDutyManager: false,
                    isWardManager: false,
                    memo: '',
                });

                patch({
                    selectedNurseId: nurse.nurseId,
                    selectedNurseDrawerMode: 'create',
                    isNurseDraftDirty: false,
                    nurseSaveStatus: 'idle',
                });

                toast.success('새 간호사를 추가했어요. 이름과 연락처를 확인한 뒤 저장해 주세요.');
                await invalidateWard();
            } catch (error) {
                showActionErrorFeedback(error, '간호사 추가에 실패했습니다.');
            } finally {
                patch({
                    isAddingNurse: false,
                });
            }
        },
        [invalidateWard, patch, wardId],
    );
    const deleteNurse = useCallback(
        async (shiftTeamId: number, nurseId: number) => {
            if (!wardId) return;

            patch({
                isDeletingNurse: true,
            });

            try {
                await WardAPI.removeNurseFromShiftTeam(wardId, shiftTeamId, nurseId);
                patch({
                    selectedNurseId: null,
                    selectedNurseDrawerMode: 'edit',
                    isNurseDraftDirty: false,
                    nurseSaveStatus: 'idle',
                });
                toast.success('간호사를 삭제했어요.');
                await invalidateWard();
            } catch (error) {
                showActionErrorFeedback(error, '간호사 삭제에 실패했습니다.');
            } finally {
                patch({
                    isDeletingNurse: false,
                });
            }
        },
        [invalidateWard, patch, wardId],
    );
    const selectNurse = useCallback(
        (nurseId: number | null, mode: 'create' | 'edit' = 'edit') => {
            const isChangingSelection = selectedNurseId !== nurseId;
            const isClosingDrawer = nurseId === null;

            if ((isChangingSelection || isClosingDrawer) && selectedNurseId !== null && isNurseDraftDirty) {
                const isConfirmed = window.confirm('저장되지 않은 변경 사항이 있습니다. 저장하지 않고 닫을까요?');

                if (!isConfirmed) return false;
            }

            patch({
                selectedNurseId: nurseId,
                selectedNurseDrawerMode: nurseId === null ? 'edit' : mode,
                isNurseDraftDirty: false,
                nurseSaveStatus: 'idle',
            });

            return true;
        },
        [isNurseDraftDirty, patch, selectedNurseId],
    );
    const updateNurse = useCallback(
        async (nurseId: number, updateNurseDTO: TUpdateNurseDTO) => {
            patch({
                nurseSaveStatus: 'saving',
            });

            try {
                await NurseAPI.updateNurse(nurseId, updateNurseDTO);
                patch({
                    isNurseDraftDirty: false,
                    nurseSaveStatus: 'success',
                    selectedNurseDrawerMode: 'edit',
                });

                await invalidateWardShiftAndRequest();

                return true;
            } catch (error) {
                patch({
                    nurseSaveStatus: 'error',
                });

                showActionErrorFeedback(error, '간호사 정보 수정에 실패했습니다.');

                return false;
            }
        },
        [invalidateWardShiftAndRequest, patch],
    );
    const updateNurseShift = useCallback(
        async (nurseId: number, nurseShiftTypeId: number, change: TUpdateNurseShiftTypeRequest) => {
            await NurseAPI.updateNurseShiftType(nurseId, nurseShiftTypeId, change);
            await invalidateWard();
        },
        [invalidateWard],
    );
    const createShiftTeam = useCallback(async () => {
        if (!wardId) return;

        await WardAPI.createShiftTeam(wardId);
        await invalidateWard();
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
                        const sourceNurses = draft.shiftTeams.find((shiftTeam) => shiftTeam.shiftTeamId === shiftTeamId)!.nurses;
                        const nurse = sourceNurses.find((nurse) => nurse.nurseId === nurseId)!;

                        sourceNurses.splice(
                            sourceNurses.findIndex((x) => x.nurseId === nurseId),
                            1,
                        );

                        const destinationNurses = draft.shiftTeams.find((shiftTeam) => shiftTeam.shiftTeamId === nextShiftTeamId)!.nurses;
                        const index = destinationNurses.findIndex((x) => x.priority === nextPriority);

                        destinationNurses.splice(index === -1 ? 0 : index, 0, {
                            ...nurse,
                            divisionNum,
                            priority: (prevPriority + nextPriority) / 2,
                        });
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
            } catch {
                if (!oldShift || !oldReqShift || !oldWard) return;

                queryClient.setQueryData(wardQueryKey, oldWard);
                queryClient.setQueryData(shiftQueryKey, oldShift);
                queryClient.setQueryData(requestShiftQueryKey, oldReqShift);
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
            patch({
                isNurseDraftDirty: isDirty,
                nurseSaveStatus: isDirty ? 'idle' : nurseSaveStatus,
            });
        },
        [nurseSaveStatus, patch],
    );

    return {
        state: {
            ward,
            selectedNurse: ward?.shiftTeams?.flatMap((x) => x.nurses).find((nurse) => nurse.nurseId === selectedNurseId),
            shiftTeams: ward?.shiftTeams,
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
