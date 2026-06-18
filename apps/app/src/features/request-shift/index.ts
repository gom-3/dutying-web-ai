import {useQueries, useQuery, useQueryClient} from '@tanstack/react-query';
import {useCallback, useEffect, useMemo} from 'react';
import {type TRequestShift} from '@/entities/shift';
import {type TShiftTeam} from '@/entities/ward';
import {wardQueryKeys, wardQueryOptions} from '@/entities/ward/model/queries';
import useAuth from '@/features/auth';
import {WardAPI} from '@/shared/api';
import {useTypedTranslation} from '@/shared/hook/use-typed-translation';
import {showActionErrorFeedback, showValidationFeedback} from '@/shared/util/feedback';
import {countPendingDutyRequests} from './model/pending-request-count';
import {
    createInitialFoldedLevels,
    createWardShiftTypeMap,
    getAdjacentRequestShiftDate,
    getRequestShiftBootstrapStatus,
    getRequestShiftMonthChangeDecision,
    shouldResetFoldedLevelsOnRequestLoad,
    shouldSyncFoldedLevelsLength,
} from './model/request-shift';
import {useRequestShiftStore} from './model/store';
import {type TFocus} from './model/types';
import {useRequestShiftChangeQueue} from './model/use-request-shift-change-queue';
import {useRequestShiftKeyboard} from './model/use-request-shift-keyboard';
import {getRequestShiftEditAvailability} from './model/utils';

const useRequestShift = (activeEffect = false) => {
    const {t} = useTypedTranslation();
    const {
        wardId: requestWardId,
        year,
        month,
        focus,
        foldedLevels,
        currentShiftTeamId,
        oldCurrentShiftTeamId,
        wardShiftTypeMap,
        readonly,
        changeStatus,
        updatingRequestId,
        setState,
        setWardContext,
    } = useRequestShiftStore();
    const {
        state: {wardId, isAuth, _loaded, accountMeStatus},
        actions: {handleGetAccountMe},
    } = useAuth();
    const queryClient = useQueryClient();
    const shiftTeamsQueryOptions = wardQueryOptions.shiftTeams(wardId ?? 0);
    const requestListQueryOptions = wardQueryOptions.requestList(wardId ?? 0, currentShiftTeamId ?? 0, year, month);
    const requestShiftQueryOptions = wardQueryOptions.request(wardId ?? 0, currentShiftTeamId ?? 0, year, month);
    const wardConstraintQueryOptions = wardQueryOptions.constraint(wardId ?? 0, currentShiftTeamId ?? 0);
    const requestShiftQueryKey = requestShiftQueryOptions.queryKey;
    const shiftTeamQueryKey = shiftTeamsQueryOptions.queryKey;
    const wardConstraintQueryKey = wardConstraintQueryOptions.queryKey;
    const dutyRequestQueryKey = requestListQueryOptions.queryKey;
    const editAvailability = getRequestShiftEditAvailability(year, month);
    const bootstrapStatus = getRequestShiftBootstrapStatus({_loaded, isAuth, wardId, accountMeStatus});
    const {
        data: shiftTeams,
        status: shiftTeamsStatus,
        refetch: refetchShiftTeams,
    } = useQuery({
        ...shiftTeamsQueryOptions,
        queryFn: async () => WardAPI.getShiftTeams(wardId!),
        enabled: !!wardId,
    });
    const isCurrentShiftTeamReady =
        wardId !== null &&
        requestWardId === wardId &&
        currentShiftTeamId !== null &&
        shiftTeamsStatus === 'success' &&
        Boolean(shiftTeams?.some((shiftTeam) => shiftTeam.shiftTeamId === currentShiftTeamId));

    useEffect(() => {
        setWardContext(wardId);
    }, [setWardContext, wardId]);

    useEffect(() => {
        if (wardId === null || requestWardId !== wardId || shiftTeamsStatus !== 'success') return;

        const firstTeamId = shiftTeams?.[0]?.shiftTeamId ?? null;
        const hasCurrentTeam = currentShiftTeamId !== null && Boolean(shiftTeams?.some((shiftTeam) => shiftTeam.shiftTeamId === currentShiftTeamId));
        const nextShiftTeamId = hasCurrentTeam ? currentShiftTeamId : firstTeamId;

        if (nextShiftTeamId !== currentShiftTeamId) {
            setState('currentShiftTeamId', nextShiftTeamId);
        }
    }, [currentShiftTeamId, requestWardId, setState, shiftTeams, shiftTeamsStatus, wardId]);
    const teamPendingRequestCountQueries = useQueries({
        queries: (shiftTeams ?? []).map((shiftTeam) => ({
            queryKey: wardQueryKeys.requestList(wardId ?? 0, shiftTeam.shiftTeamId, year, month),
            queryFn: async () => WardAPI.getRequestList(wardId!, shiftTeam.shiftTeamId, year, month),
            enabled: wardId !== null,
            select: countPendingDutyRequests,
        })),
    });
    const teamPendingRequestCountByTeamId = useMemo(
        () =>
            (shiftTeams ?? []).reduce<Record<number, number>>((acc, shiftTeam, index) => {
                acc[shiftTeam.shiftTeamId] = teamPendingRequestCountQueries[index]?.data ?? 0;

                return acc;
            }, {}),
        [shiftTeams, teamPendingRequestCountQueries],
    );
    const {
        data: dutyRequestList,
        status: dutyRequestStatus,
        refetch: refetchDutyRequestList,
    } = useQuery({
        ...requestListQueryOptions,
        queryFn: async () => WardAPI.getRequestList(wardId!, currentShiftTeamId!, year, month),
        enabled: isCurrentShiftTeamReady,
    });
    const {
        data: requestShift,
        status: shiftStatus,
        refetch: refetchRequestShift,
    } = useQuery({
        ...requestShiftQueryOptions,
        queryFn: async (): Promise<TRequestShift> => {
            const res = await WardAPI.getReqShift(wardId!, currentShiftTeamId!, year, month);

            if (res === null) return null as unknown as TRequestShift;

            if (
                shouldResetFoldedLevelsOnRequestLoad({
                    foldedLevels,
                    previousShiftTeamId: oldCurrentShiftTeamId,
                    currentShiftTeamId,
                })
            ) {
                setState('foldedLevels', createInitialFoldedLevels(res));
                setState('oldCurrentShiftTeamId', currentShiftTeamId);
            }

            return res;
        },
        enabled: isCurrentShiftTeamReady,
    });
    const {changeRequestShift} = useRequestShiftChangeQueue({
        wardId,
        year,
        month,
        requestShiftQueryKey,
        wardShiftTypeMap,
        queryClient,
        setChangeStatus: (status) => setState('changeStatus', status),
    });
    const acceptRequests = useCallback(
        async (reqShiftIds: number[], isAccepted: boolean | null) => {
            if (reqShiftIds.length === 0 || useRequestShiftStore.getState().updatingRequestId !== null) return false;

            if (!wardId) return false;

            setState('updatingRequestId', reqShiftIds.length === 1 ? reqShiftIds[0] : -1);

            try {
                const results = await Promise.allSettled(
                    reqShiftIds.map((reqShiftId) => WardAPI.acceptRequestShift(wardId, reqShiftId, isAccepted)),
                );
                const rejectedResults = results.filter((result) => result.status === 'rejected');

                await queryClient.invalidateQueries({queryKey: requestShiftQueryKey});
                await queryClient.invalidateQueries({queryKey: dutyRequestQueryKey});
                await queryClient.invalidateQueries({queryKey: wardQueryKeys.requestPendingCount(wardId)});
                await queryClient.invalidateQueries({queryKey: [...wardQueryKeys.all(), 'duty', wardId]});

                if (rejectedResults.length > 0) {
                    showActionErrorFeedback(rejectedResults[0].reason, t('feature.requestShift.processFailed'));

                    return false;
                }

                return rejectedResults.length === 0;
            } finally {
                setState('updatingRequestId', null);
            }
        },
        [dutyRequestQueryKey, queryClient, requestShiftQueryKey, setState, t, wardId],
    );
    const acceptRequest = useCallback(
        async (reqShiftId: number, isAccepted: boolean | null) => {
            return acceptRequests([reqShiftId], isAccepted);
        },
        [acceptRequests],
    );
    const changeMonth = (type: 'prev' | 'next') => {
        const targetDate = getAdjacentRequestShiftDate(year, month, type);
        const decision = getRequestShiftMonthChangeDecision({
            year,
            month,
            type,
            readonly,
            targetAvailability: getRequestShiftEditAvailability(targetDate.year, targetDate.month),
        });

        if (decision.feedbackMessage) {
            showValidationFeedback(decision.feedbackMessage);
        }

        if (decision.shouldEnableReadonly) {
            setState('readonly', true);
        }

        if (decision.shouldBlock) return false;

        setState('year', decision.year);
        setState('month', decision.month);

        return true;
    };
    const foldLevel = (level: number) => {
        if (!requestShift || !foldedLevels) return;

        setState(
            'foldedLevels',
            foldedLevels.map((isFolded, index) => (index === level ? !isFolded : isFolded)),
        );
    };

    useRequestShiftKeyboard({
        activeEffect,
        focus,
        requestShift,
        setFocus: (nextFocus) => setState('focus', nextFocus),
    });

    const handleToggleEditMode = (targetDate?: {year: number; month: number}) => {
        const nextEditAvailability = targetDate ? getRequestShiftEditAvailability(targetDate.year, targetDate.month) : editAvailability;

        if (readonly) {
            if (!nextEditAvailability.canEdit && nextEditAvailability.validationMessage) {
                showValidationFeedback(nextEditAvailability.validationMessage);

                return false;
            }

            setState('readonly', false);

            return true;
        }

        setState('readonly', true);
        setState('focus', null);

        if (requestShift) {
            setState('foldedLevels', createInitialFoldedLevels(requestShift));
        }

        return true;
    };
    const handleCreateNextMonthShift = () => {
        const nextMonth = new Date().getMonth() + 2;
        const nextDate =
            nextMonth > 12
                ? {
                      year: year + 1,
                      month: 1,
                  }
                : {
                      year,
                      month: nextMonth,
                  };

        if (nextMonth > 12) {
            setState('year', year + 1);
            setState('month', 1);
        } else {
            setState('month', nextMonth);
        }

        handleToggleEditMode(nextDate);
    };
    const retry = useCallback(async () => {
        if (wardId === null) {
            await handleGetAccountMe().catch(() => undefined);

            return;
        }

        const retryTasks: Promise<unknown>[] = [refetchShiftTeams()];

        if (isCurrentShiftTeamReady) {
            retryTasks.push(refetchDutyRequestList(), refetchRequestShift());
        }

        await Promise.all(retryTasks);
    }, [handleGetAccountMe, isCurrentShiftTeamReady, refetchDutyRequestList, refetchRequestShift, refetchShiftTeams, wardId]);

    useEffect(() => {
        if (!activeEffect || !requestShift) return;

        window.dispatchEvent(new Event('resize'));

        if (
            shouldSyncFoldedLevelsLength({
                foldedLevels,
                requestShift,
            })
        ) {
            setState('foldedLevels', createInitialFoldedLevels(requestShift));
        }

        setState('wardShiftTypeMap', createWardShiftTypeMap(requestShift));
    }, [activeEffect, foldedLevels, requestShift, setState]);

    return {
        queryKey: {
            requestShiftQueryKey,
            shiftTeamQueryKey,
            wardConstraintQueryKey,
        },
        state: {
            year,
            month,
            bootstrapStatus,
            requestShift,
            dutyRequestList,
            focus,
            foldedLevels,
            changeStatus,
            shiftStatus,
            shiftTeamsStatus,
            dutyRequestStatus,
            wardShiftTypeMap,
            readonly,
            updatingRequestId,
            currentShiftTeam: isCurrentShiftTeamReady
                ? (shiftTeams?.find((shiftTeam) => shiftTeam.shiftTeamId === currentShiftTeamId) as TShiftTeam | null)
                : null,
            shiftTeams,
            teamPendingRequestCountByTeamId,
            editAvailability,
        },
        actions: {
            changeRequestShift: (nextFocus: TFocus, shiftTypeId: number | null) => changeRequestShift(nextFocus, shiftTypeId),
            toggleEditMode: handleToggleEditMode,
            createNextMonthShift: handleCreateNextMonthShift,
            acceptRequest: (reqShiftId: number, isAccepted: boolean | null) => acceptRequest(reqShiftId, isAccepted),
            acceptRequests: (reqShiftIds: number[], isAccepted: boolean | null) => acceptRequests(reqShiftIds, isAccepted),
            foldLevel,
            changeMonth,
            retry,
            changeFocus: (nextFocus: TFocus | null) => setState('focus', nextFocus),
            changeShiftTeam: (shiftTeam: TShiftTeam) => {
                if (shiftTeam.shiftTeamId === currentShiftTeamId) return false;

                setState('currentShiftTeamId', shiftTeam.shiftTeamId);

                return true;
            },
        },
    };
};

export default useRequestShift;
