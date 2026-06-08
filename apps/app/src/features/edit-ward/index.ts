import {type TCreateShiftTypeDTO, type TEditWardDTO} from '@dutying/api/ward';
import {useQuery, useQueryClient} from '@tanstack/react-query';
import {useCallback} from 'react';
import toast from 'react-hot-toast';
import {wardQueryKeys, wardQueryOptions} from '@/entities/ward/model/queries';
import useAuth from '@/features/auth';
import {WardAPI} from '@/shared/api';
import {showActionErrorFeedback} from '@/shared/util/feedback';

const useEditWard = () => {
    const {
        state: {wardId},
    } = useAuth();
    const wardQueryKey = wardQueryKeys.id(wardId ?? 0);
    const wardWaitingNursesQueryKey = wardQueryKeys.waitingNurses(wardId ?? 0);
    const shiftTeamsQueryKey = wardQueryKeys.shiftTeams(wardId ?? 0);
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
        async (editWardDTO: TEditWardDTO) => {
            if (!wardId) return;

            try {
                await WardAPI.editWard(wardId, editWardDTO);
                await queryClient.invalidateQueries({queryKey: wardQueryKey});
            } catch (error) {
                showActionErrorFeedback(error, '근무 설정을 수정하지 못했어요.');
            }
        },
        [queryClient, wardId, wardQueryKey],
    );
    const addShiftType = useCallback(
        async (createShiftTypeDTO: TCreateShiftTypeDTO) => {
            if (!wardId) return;

            await WardAPI.createShiftType(wardId, createShiftTypeDTO);
            await queryClient.invalidateQueries({queryKey: wardQueryKey});
        },
        [queryClient, wardId, wardQueryKey],
    );
    const editShiftType = useCallback(
        async (shiftTypeId: number, createShiftTypeDTO: TCreateShiftTypeDTO) => {
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
    const approveWaitingNurses = useCallback(
        async (waitingNurseId: number, shiftTeamId: number) => {
            if (!wardId) return;

            try {
                await WardAPI.approveWaitingNurses(wardId, waitingNurseId, shiftTeamId);
                await queryClient.invalidateQueries({queryKey: wardQueryKey});
                await queryClient.invalidateQueries({queryKey: shiftTeamsQueryKey});
                await queryClient.invalidateQueries({queryKey: wardWaitingNursesQueryKey});

                toast.success('선택한 팀에 간호사를 추가했어요.');

                return true;
            } catch (error) {
                showActionErrorFeedback(error, '팀을 추가하지 못했어요.');

                return false;
            }
        },
        [queryClient, shiftTeamsQueryKey, wardId, wardQueryKey, wardWaitingNursesQueryKey],
    );
    const connectWaitingNurses = useCallback(
        async (waitingNurseId: number, targetNurseId: number) => {
            if (!wardId) return;

            try {
                await WardAPI.connectWaitingNurses(wardId, waitingNurseId, targetNurseId);
                await queryClient.invalidateQueries({queryKey: wardQueryKey});
                await queryClient.invalidateQueries({queryKey: shiftTeamsQueryKey});
                await queryClient.invalidateQueries({queryKey: wardWaitingNursesQueryKey});

                toast.success('기존 간호사 계정과 연결했어요.');

                return true;
            } catch (error) {
                showActionErrorFeedback(error, '기존 간호사 계정에 연결하지 못했어요.');

                return false;
            }
        },
        [queryClient, shiftTeamsQueryKey, wardId, wardQueryKey, wardWaitingNursesQueryKey],
    );
    const cancelWaiting = useCallback(
        async (waitingNurseId: number) => {
            if (!wardId) return;

            try {
                await WardAPI.deleteWaitingNurseRequest(wardId, waitingNurseId);
                await queryClient.invalidateQueries({queryKey: wardQueryKey});
                await queryClient.invalidateQueries({queryKey: wardWaitingNursesQueryKey});

                toast.success('연동 요청을 거절했어요.');

                return true;
            } catch (error) {
                showActionErrorFeedback(error, '연동 요청을 거절하지 못했어요.');

                return false;
            }
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
            watingNurses: watingNurses ?? [],
        },
        actions: {
            editWardSetting,
            removeShiftType,
            editShiftType,
            addShiftType,
            approveWaitingNurses,
            connectWaitingNurses,
            cancelWaiting,
        },
    };
};

export default useEditWard;
