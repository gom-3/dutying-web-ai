import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query';
import {useCallback} from 'react';
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
    const {mutate: updateWardMutate} = useMutation({
        mutationFn: ({wardId, editWardDTO}: {wardId: number; editWardDTO: EditWardDTO}) => WardAPI.editWard(wardId, editWardDTO),
        onSuccess: () => {
            queryClient.invalidateQueries({queryKey: wardQueryKey});
        },
        onError: () => {
            alert('근무 설정 수정에 실패하였습니다.');
        },
    });
    const {mutate: createShiftTypeMutate} = useMutation({
        mutationFn: ({wardId, createShiftTypeDTO}: {wardId: number; createShiftTypeDTO: CreateShiftTypeDTO}) =>
            WardAPI.createShiftType(wardId, createShiftTypeDTO),
        onSuccess: () => {
            queryClient.invalidateQueries({queryKey: wardQueryKey});
        },
    });
    const {mutate: updateShiftTypeMutate} = useMutation({
        mutationFn: ({
            wardId,
            shiftTypeId,
            createShiftTypeDTO,
        }: {
            wardId: number;
            shiftTypeId: number;
            createShiftTypeDTO: CreateShiftTypeDTO;
        }) => WardAPI.updateShiftType(wardId, shiftTypeId, createShiftTypeDTO),
        onSuccess: () => {
            queryClient.invalidateQueries({queryKey: wardQueryKey});
            queryClient.invalidateQueries({queryKey: shiftQueryKey});
        },
    });
    const {mutate: deleteShiftTypeMutate} = useMutation({
        mutationFn: ({wardId, shiftTypeId}: {wardId: number; shiftTypeId: number}) => WardAPI.deleteShiftType(wardId, shiftTypeId),
        onSuccess: () => {
            queryClient.invalidateQueries({queryKey: wardQueryKey});
        },
    });
    const {mutate: approveWatingNursesMutate} = useMutation({
        mutationFn: ({wardId, waitingNurseId, shiftTeamId}: {wardId: number; waitingNurseId: number; shiftTeamId: number}) =>
            WardAPI.approveWatingNurses(wardId, waitingNurseId, shiftTeamId),
        onSuccess: () => {
            queryClient.invalidateQueries({queryKey: wardQueryKey});
            queryClient.invalidateQueries({queryKey: wardWaitingNursesQueryKey});
        },
    });
    const {mutate: connectWatingNursesMutate} = useMutation({
        mutationFn: ({wardId, waitingNurseId, targetNurseId}: {wardId: number; waitingNurseId: number; targetNurseId: number}) =>
            WardAPI.connectWatingNurses(wardId, waitingNurseId, targetNurseId),
        onSuccess: () => {
            queryClient.invalidateQueries({queryKey: wardQueryKey});
            queryClient.invalidateQueries({queryKey: wardWaitingNursesQueryKey});
        },
    });
    const {mutate: cancelWaitingMutate} = useMutation({
        mutationFn: ({wardId, nurseId}: {wardId: number; nurseId: number}) => WardAPI.deleteWatingNurses(wardId, nurseId),
        onSuccess: () => {
            queryClient.invalidateQueries({queryKey: wardQueryKey});
            queryClient.invalidateQueries({queryKey: wardWaitingNursesQueryKey});
        },
    });
    const editWardSetting = useCallback(
        (editWardDTO: EditWardDTO) => {
            if (wardId) {
                updateWardMutate({wardId, editWardDTO});
            }
        },
        [updateWardMutate, wardId],
    );
    const addShiftType = useCallback(
        (createShiftTypeDTO: CreateShiftTypeDTO) => {
            if (wardId) {
                createShiftTypeMutate({wardId, createShiftTypeDTO});
            }
        },
        [createShiftTypeMutate, wardId],
    );
    const editShiftType = useCallback(
        (shiftTypeId: number, createShiftTypeDTO: CreateShiftTypeDTO) => {
            if (wardId) {
                updateShiftTypeMutate({wardId, shiftTypeId, createShiftTypeDTO});
            }
        },
        [updateShiftTypeMutate, wardId],
    );
    const removeShiftType = useCallback(
        (shiftTypeId: number) => {
            if (wardId) {
                deleteShiftTypeMutate({wardId, shiftTypeId});
            }
        },
        [deleteShiftTypeMutate, wardId],
    );
    const approveWatingNurses = useCallback(
        (waitingNurseId: number, shiftTeamId: number) => {
            if (wardId) {
                approveWatingNursesMutate({wardId, waitingNurseId, shiftTeamId});
            }
        },
        [approveWatingNursesMutate, wardId],
    );
    const connectWatingNurses = useCallback(
        (waitingNurseId: number, targetNurseId: number) => {
            if (wardId) {
                connectWatingNursesMutate({wardId, waitingNurseId, targetNurseId});
            }
        },
        [connectWatingNursesMutate, wardId],
    );
    const cancelWaiting = useCallback(
        (nurseId: number) => {
            if (wardId) {
                cancelWaitingMutate({wardId, nurseId});
            }
        },
        [cancelWaitingMutate, wardId],
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
