import {type TCreateShiftTypeDTO, type TEditWardDTO} from '@dutying/api/ward';
import {useQuery, useQueryClient} from '@tanstack/react-query';
import {useCallback} from 'react';
import toast from 'react-hot-toast';
import {wardQueryKeys, wardQueryOptions} from '@/entities/ward/model/queries';
import useAuth from '@/features/auth';
import {WardAPI} from '@/shared/api';
import {useTypedTranslation} from '@/shared/hook/use-typed-translation';
import {showActionErrorFeedback} from '@/shared/util/feedback';

function isWaitingNurseNotFoundError(error: unknown) {
    return (
        typeof error === 'object' &&
        error !== null &&
        'serverCode' in error &&
        (error as {serverCode?: unknown}).serverCode === 'WAITING_NURSE_NOT_FOUND'
    );
}

const useEditWard = () => {
    const {t} = useTypedTranslation();
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
    const invalidateWardMemberQueries = useCallback(async () => {
        await queryClient.invalidateQueries({queryKey: wardQueryKey});
        await queryClient.invalidateQueries({queryKey: shiftTeamsQueryKey});
        await queryClient.invalidateQueries({queryKey: wardWaitingNursesQueryKey});
    }, [queryClient, shiftTeamsQueryKey, wardQueryKey, wardWaitingNursesQueryKey]);
    const invalidateWaitingNurseQueries = useCallback(async () => {
        await queryClient.invalidateQueries({queryKey: wardQueryKey});
        await queryClient.invalidateQueries({queryKey: wardWaitingNursesQueryKey});
    }, [queryClient, wardQueryKey, wardWaitingNursesQueryKey]);
    const editWardSetting = useCallback(
        async (editWardDTO: TEditWardDTO) => {
            if (!wardId) return;

            try {
                await WardAPI.editWard(wardId, editWardDTO);
                await queryClient.invalidateQueries({queryKey: wardQueryKey});
            } catch (error) {
                showActionErrorFeedback(error, t('feature.editWard.editSettingFailed'));
            }
        },
        [queryClient, t, wardId, wardQueryKey],
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
                await invalidateWardMemberQueries();

                toast.success(t('feature.editWard.approveWaitingNurseSuccess'));

                return true;
            } catch (error) {
                if (isWaitingNurseNotFoundError(error)) {
                    await invalidateWardMemberQueries();
                }
                showActionErrorFeedback(error, t('feature.editWard.approveWaitingNurseFailed'));

                return false;
            }
        },
        [invalidateWardMemberQueries, t, wardId],
    );
    const connectWaitingNurses = useCallback(
        async (waitingNurseId: number, targetNurseId: number) => {
            if (!wardId) return;

            try {
                await WardAPI.connectWaitingNurses(wardId, waitingNurseId, targetNurseId);
                await invalidateWardMemberQueries();

                toast.success(t('feature.editWard.connectWaitingNurseSuccess'));

                return true;
            } catch (error) {
                if (isWaitingNurseNotFoundError(error)) {
                    await invalidateWardMemberQueries();
                }
                showActionErrorFeedback(error, t('feature.editWard.connectWaitingNurseFailed'));

                return false;
            }
        },
        [invalidateWardMemberQueries, t, wardId],
    );
    const cancelWaiting = useCallback(
        async (waitingNurseId: number) => {
            if (!wardId) return;

            try {
                await WardAPI.deleteWaitingNurseRequest(wardId, waitingNurseId);
                await invalidateWaitingNurseQueries();

                toast.success(t('feature.editWard.rejectWaitingNurseSuccess'));

                return true;
            } catch (error) {
                if (isWaitingNurseNotFoundError(error)) {
                    await invalidateWaitingNurseQueries();
                }
                showActionErrorFeedback(error, t('feature.editWard.rejectWaitingNurseFailed'));

                return false;
            }
        },
        [invalidateWaitingNurseQueries, t, wardId],
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
