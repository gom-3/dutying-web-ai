import {useCallback} from 'react';
import {useQuery, useQueryClient} from '@tanstack/react-query';
import {wardQueryKeys, wardQueryOptions} from '@/entities/ward/model/queries';
import useAuth from '@/features/auth/useAuth';
import {WardAPI} from '@/shared/api';
import {type CreateShiftTypeDTO} from '@/shared/api/ward/type';
import {type EditWardDTO} from '@/shared/api/ward/type';

const useEditWard = () => {
    const {
        state: {wardId},
    } = useAuth();
    const wardQueryKey = wardQueryKeys.id(wardId ?? 0);
    const wardWaitingNursesQueryKey = wardQueryKeys.waitingNurses(wardId ?? 0);
    const wardQueryOptionsValue = wardQueryOptions.id(wardId ?? 0);
    const wardWaitingNursesQueryOptions = wardQueryOptions.waitingNurses(wardId ?? 0);
    const queryClient = useQueryClient();
    const shiftQueryKey = wardQueryKeys.shift();
    const {data: ward} = useQuery({
        ...wardQueryOptionsValue,
        enabled: !!wardId,
    });
    const {data: watingNurses} = useQuery({
        ...wardWaitingNursesQueryOptions,
        enabled: !!wardId,
    });
    const editWardSetting = useCallback(
        async (editWardDTO: EditWardDTO) => {
            if (!wardId) return;

            try {
                await WardAPI.editWard(wardId, editWardDTO);
                await queryClient.invalidateQueries({queryKey: wardQueryKey});
            } catch {
                alert('근무 설정 수정에 실패하였습니다.');
            }
        },
        [queryClient, wardId, wardQueryKey],
    );
    const addShiftType = useCallback(
        async (createShiftTypeDTO: CreateShiftTypeDTO) => {
            if (!wardId) return;

            await WardAPI.createShiftType(wardId, createShiftTypeDTO);
            await queryClient.invalidateQueries({queryKey: wardQueryKey});
        },
        [queryClient, wardId, wardQueryKey],
    );
    const editShiftType = useCallback(
        async (shiftTypeId: number, createShiftTypeDTO: CreateShiftTypeDTO) => {
            if (!wardId) return;

            await WardAPI.updateShiftType(wardId, shiftTypeId, createShiftTypeDTO);
            await queryClient.invalidateQueries({queryKey: wardQueryKey});
            await queryClient.invalidateQueries({queryKey: shiftQueryKey});
        },
        [queryClient, shiftQueryKey, wardId, wardQueryKey],
    );
    const removeShiftType = useCallback(
        async (shiftTypeId: number) => {
            if (!wardId) return;

            await WardAPI.deleteShiftType(wardId, shiftTypeId);
            await queryClient.invalidateQueries({queryKey: wardQueryKey});
        },
        [queryClient, wardId, wardQueryKey],
    );
    const approveWatingNurses = useCallback(
        async (waitingNurseId: number, shiftTeamId: number) => {
            if (!wardId) return;

            await WardAPI.approveWatingNurses(wardId, waitingNurseId, shiftTeamId);
            await queryClient.invalidateQueries({queryKey: wardQueryKey});
            await queryClient.invalidateQueries({queryKey: wardWaitingNursesQueryKey});
        },
        [queryClient, wardId, wardQueryKey, wardWaitingNursesQueryKey],
    );
    const connectWatingNurses = useCallback(
        async (waitingNurseId: number, targetNurseId: number) => {
            if (!wardId) return;

            await WardAPI.connectWatingNurses(wardId, waitingNurseId, targetNurseId);
            await queryClient.invalidateQueries({queryKey: wardQueryKey});
            await queryClient.invalidateQueries({queryKey: wardWaitingNursesQueryKey});
        },
        [queryClient, wardId, wardQueryKey, wardWaitingNursesQueryKey],
    );
    const cancelWaiting = useCallback(
        async (nurseId: number) => {
            if (!wardId) return;

            await WardAPI.deleteWatingNurses(wardId, nurseId);
            await queryClient.invalidateQueries({queryKey: wardQueryKey});
            await queryClient.invalidateQueries({queryKey: wardWaitingNursesQueryKey});
        },
        [queryClient, wardId, wardQueryKey, wardWaitingNursesQueryKey],
    );

    return {
        queryKey: {
            getWardQueryKey: wardQueryKey,
            getWardWaitingNursesQueryKey: wardWaitingNursesQueryKey,
        },
        state: {
            ward,
            watingNurses,
        },
        actions: {
            editWardSetting,
            removeShiftType,
            editShiftType,
            addShiftType,
            approveWatingNurses,
            connectWatingNurses,
            cancelWaiting,
        },
    };
};

export default useEditWard;
