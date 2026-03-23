import {DateUtil} from '@dutying/utils/date';
import {useQuery, useQueryClient} from '@tanstack/react-query';
import {produce} from 'immer';
import {useCallback, useEffect, useRef} from 'react';
import {match} from 'ts-pattern';
import {events, sendEvent} from '@/analytics';
import {type TRequestShift} from '@/entities/shift';
import {type TShiftTeam, type TWardShiftType} from '@/entities/ward';
import {wardQueryOptions} from '@/entities/ward/model/queries';
import useAuth from '@/features/auth/useAuth';
import {WardAPI} from '@/shared/api';
import {showActionErrorFeedback, showValidationFeedback} from '@/shared/util/feedback';
import {useRequestShiftStore} from './store';
import {type TFocus} from './type';
import {findNurse, getRequestShiftEditAvailability, keydownEventMapper, moveFocus} from './utils';

const useRequestShift = (activeEffect = false) => {
    const {
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
    const bootstrapStatus =
        !_loaded || (isAuth && wardId === null && (accountMeStatus === 'idle' || accountMeStatus === 'loading'))
            ? 'pending'
            : isAuth && wardId === null && accountMeStatus === 'error'
              ? 'error'
              : 'success';
    const changeStatusResetTimerRef = useRef<number | null>(null);
    const requestShiftChangeQueueRef = useRef<Array<{focus: TFocus; shiftTypeId: number | null}>>([]);
    const isProcessingRequestShiftQueueRef = useRef(false);
    const clearChangeStatusResetTimer = useCallback(() => {
        if (changeStatusResetTimerRef.current !== null) {
            window.clearTimeout(changeStatusResetTimerRef.current);
            changeStatusResetTimerRef.current = null;
        }
    }, []);
    const setChangeStatusWithAutoReset = useCallback(
        (status: 'idle' | 'loading' | 'success' | 'error') => {
            clearChangeStatusResetTimer();
            setState('changeStatus', status);

            if (status === 'loading' || status === 'idle') return;

            changeStatusResetTimerRef.current = window.setTimeout(() => {
                setState('changeStatus', 'idle');
                changeStatusResetTimerRef.current = null;
            }, 2400);
        },
        [clearChangeStatusResetTimer, setState],
    );
    const applyRequestShiftChangeToCache = useCallback(
        (focus: TFocus, shiftTypeId: number | null) => {
            const {shiftNurseId, day} = focus;
            const currentShift = queryClient.getQueryData<TRequestShift>(requestShiftQueryKey);

            if (!currentShift) return;

            const currentShiftTypeId = currentShift.divisionShiftNurses
                .flatMap((division) => division)
                .find((row) => row.shiftNurse.shiftNurseId === shiftNurseId)?.wardReqShiftList[focus.day];

            if (currentShiftTypeId === undefined || currentShiftTypeId === shiftTypeId) return;

            if (wardShiftTypeMap) {
                const edit = {
                    nurseName: findNurse(currentShift, focus.shiftNurseId)!.name,
                    focus,
                    prevShiftType: currentShiftTypeId ? (wardShiftTypeMap.get(currentShiftTypeId) as TWardShiftType) : null,
                    nextShiftType: shiftTypeId ? (wardShiftTypeMap.get(shiftTypeId) as TWardShiftType) : null,
                    dateString: DateUtil.getDateString(new Date(), 'yyyy-MM-dd HH:mm:ss'),
                };

                sendEvent(
                    events.requestPage.changeShift,
                    `${focus.shiftNurseName} / ${day + 1}일 | ` +
                        match(edit)
                            .with({prevShiftType: null}, () => `추가 → ${edit.nextShiftType?.shortName}`)
                            .with({nextShiftType: null}, () => `${edit.prevShiftType?.shortName} → 삭제`)
                            .otherwise(() => `${edit.prevShiftType?.shortName} → ${edit.nextShiftType?.shortName}`),
                );
            }

            queryClient.setQueryData<TRequestShift>(
                requestShiftQueryKey,
                produce(currentShift, (draft) => {
                    draft.divisionShiftNurses
                        .flatMap((division) => division)
                        .find((row) => row.shiftNurse.shiftNurseId === shiftNurseId)!.wardReqShiftList[focus.day] = shiftTypeId;
                }),
            );
        },
        [queryClient, requestShiftQueryKey, wardShiftTypeMap],
    );
    const flushRequestShiftChangeQueue = useCallback(async () => {
        if (isProcessingRequestShiftQueueRef.current || !wardId) return;

        isProcessingRequestShiftQueueRef.current = true;
        setChangeStatusWithAutoReset('loading');

        let hasError = false;

        while (requestShiftChangeQueueRef.current.length > 0) {
            const nextChange = requestShiftChangeQueueRef.current.shift();

            if (!nextChange) continue;

            try {
                await WardAPI.updateReqShift(
                    wardId,
                    year,
                    month,
                    nextChange.focus.day + 1,
                    nextChange.focus.shiftNurseId,
                    nextChange.shiftTypeId,
                );
            } catch {
                hasError = true;
            }
        }

        if (hasError) {
            await queryClient.invalidateQueries({queryKey: requestShiftQueryKey});
            setChangeStatusWithAutoReset('error');
        } else {
            setChangeStatusWithAutoReset('success');
        }

        isProcessingRequestShiftQueueRef.current = false;

        if (requestShiftChangeQueueRef.current.length > 0) {
            void flushRequestShiftChangeQueue();
        }
    }, [month, queryClient, requestShiftQueryKey, setChangeStatusWithAutoReset, wardId, year]);
    const {
        data: shiftTeams,
        status: shiftTeamsStatus,
        refetch: refetchShiftTeams,
    } = useQuery({
        ...shiftTeamsQueryOptions,
        queryFn: async () => {
            const res = await WardAPI.getShiftTeams(wardId!);

            if (res.length === 0) {
                setState('currentShiftTeamId', null);

                return res;
            }

            if (currentShiftTeamId) {
                if (res.every((x) => x.shiftTeamId !== currentShiftTeamId)) {
                    setState('currentShiftTeamId', res[0].shiftTeamId);
                }
            } else {
                setState('currentShiftTeamId', res[0].shiftTeamId);
            }

            return res;
        },
        enabled: !!wardId,
    });
    const {
        data: dutyRequestList,
        status: dutyRequestStatus,
        refetch: refetchDutyRequestList,
    } = useQuery({
        ...requestListQueryOptions,
        enabled: wardId !== null && currentShiftTeamId !== null,
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

            if (!foldedLevels || !oldCurrentShiftTeamId || (oldCurrentShiftTeamId && oldCurrentShiftTeamId !== currentShiftTeamId)) {
                setState(
                    'foldedLevels',
                    res.divisionShiftNurses.map(() => false),
                );
                setState('oldCurrentShiftTeamId', currentShiftTeamId);
            }

            return res;
        },
        enabled: wardId !== null && currentShiftTeamId !== null,
    });
    const changeRequestShift = useCallback(
        async (focus: TFocus, shiftTypeId: number | null) => {
            if (!wardId) return;

            await queryClient.cancelQueries({queryKey: requestShiftQueryKey});
            applyRequestShiftChangeToCache(focus, shiftTypeId);
            requestShiftChangeQueueRef.current.push({focus, shiftTypeId});

            void flushRequestShiftChangeQueue();
        },
        [applyRequestShiftChangeToCache, flushRequestShiftChangeQueue, queryClient, requestShiftQueryKey, wardId],
    );
    const acceptRequests = useCallback(
        async (reqShiftIds: number[], isAccepted: boolean | null) => {
            if (!wardId) return false;

            if (reqShiftIds.length === 0 || useRequestShiftStore.getState().updatingRequestId !== null) return false;

            setState('updatingRequestId', reqShiftIds.length === 1 ? reqShiftIds[0] : -1);

            try {
                const results = await Promise.allSettled(
                    reqShiftIds.map((reqShiftId) => WardAPI.acceptRequestShift(wardId, reqShiftId, isAccepted)),
                );
                const rejectedResults = results.filter((result) => result.status === 'rejected');

                if (results.length > 0) {
                    await queryClient.invalidateQueries({queryKey: requestShiftQueryKey});
                    await queryClient.invalidateQueries({queryKey: dutyRequestQueryKey});
                }

                if (rejectedResults.length > 0) {
                    showActionErrorFeedback(rejectedResults[0].reason, '신청 처리에 실패했습니다.');
                }

                return rejectedResults.length === 0;
            } finally {
                setState('updatingRequestId', null);
            }
        },
        [dutyRequestQueryKey, queryClient, requestShiftQueryKey, setState, wardId],
    );
    const acceptRequest = useCallback(
        async (reqShiftId: number, isAccepted: boolean | null) => {
            return acceptRequests([reqShiftId], isAccepted);
        },
        [acceptRequests],
    );
    const changeMonth = (type: 'prev' | 'next') => {
        const targetYear = type === 'prev' ? (month === 1 ? year - 1 : year) : month === 12 ? year + 1 : year;
        const targetMonth = type === 'prev' ? (month === 1 ? 12 : month - 1) : month === 12 ? 1 : month + 1;
        const targetAvailability = getRequestShiftEditAvailability(targetYear, targetMonth);

        if (type === 'prev') {
            if (!readonly && targetAvailability.status === 'lockedPast' && targetAvailability.validationMessage) {
                showValidationFeedback(targetAvailability.validationMessage);
                setState('readonly', true);
            }

            if (month === 1) {
                setState('month', 12);
                setState('year', year - 1);
            } else {
                setState('month', month - 1);
            }
        } else if (type === 'next') {
            if (targetAvailability.status === 'lockedFuture' && targetAvailability.validationMessage) {
                showValidationFeedback(targetAvailability.validationMessage);

                return;
            }

            if (month === 12) {
                setState('month', 1);
                setState('year', year + 1);
            } else {
                setState('month', month + 1);
            }
        }
    };
    const changeFocusedShift = useCallback(
        (shiftTypeId: number | null) => {
            if (!wardId || !focus || !requestShift) return;

            if (
                requestShift.divisionShiftNurses.flatMap((x) => x).find((x) => x.shiftNurse.shiftNurseId === focus.shiftNurseId)!
                    .wardReqShiftList[focus.day] === shiftTypeId
            )
                return;

            const requestDutyRequest = dutyRequestList?.find(
                (x) =>
                    x.nurseId ===
                        requestShift.divisionShiftNurses.flatMap((x) => x).find((x) => x.shiftNurse.shiftNurseId === focus.shiftNurseId)
                            ?.shiftNurse.nurseId && x.date === focus.day,
            );

            if (requestDutyRequest && requestDutyRequest.wardShiftTypeId !== shiftTypeId && !confirm('신청을 거절하시겠습니까?')) return;

            if (requestDutyRequest) {
                acceptRequest(
                    requestDutyRequest.wardReqShiftId,
                    shiftTypeId === null ? null : requestDutyRequest.wardShiftTypeId === shiftTypeId,
                );
            }

            changeRequestShift(focus, shiftTypeId);
        },
        [acceptRequest, changeRequestShift, dutyRequestList, focus, requestShift, wardId],
    );
    const foldLevel = (level: number) => {
        if (!requestShift || !foldedLevels) return;

        setState(
            'foldedLevels',
            foldedLevels.map((x, index) => (index === level ? !x : x)),
        );
    };
    const handleKeyDown = useCallback(
        (e: KeyboardEvent) => {
            if (['Ctrl', 'Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].indexOf(e.code) != -1) {
                e.preventDefault(); // Key 입력으로 화면이 이동하는 것을 막습니다.
            }

            const ctrlKey = e.ctrlKey || e.metaKey;

            if (!focus || !requestShift) return;

            if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
                moveFocus(
                    e.key.replace('Arrow', '').toLowerCase() as 'left' | 'right' | 'up' | 'down',
                    ctrlKey,
                    requestShift,
                    focus,
                    (focus: TFocus | null) => setState('focus', focus),
                );
            }

            keydownEventMapper(
                e,
                ...requestShift.wardShiftTypes.map((shiftType) => ({
                    keys: [shiftType.shortName],
                    callback: () => {
                        changeFocusedShift(shiftType.wardShiftTypeId);
                        moveFocus('right', ctrlKey, requestShift, focus, (focus: TFocus | null) => {
                            setState('focus', focus);
                            sendEvent(ctrlKey ? events.requestPage.moveCellFocus : events.requestPage.moveCellFocus, e.key);
                        });
                    },
                })),
                {
                    keys: ['Backspace'],
                    callback: () => {
                        changeFocusedShift(null);
                        moveFocus('left', ctrlKey, requestShift, focus, (focus: TFocus | null) => {
                            setState('focus', focus);
                            sendEvent(ctrlKey ? events.requestPage.moveCellFocus : events.requestPage.moveCellFocus, e.key);
                        });
                    },
                },
                {keys: ['Delete'], callback: () => changeFocusedShift(null)},
            );
        },
        [focus, requestShift, setState, changeFocusedShift],
    );
    const handleToggleEditMode = (targetDate?: {year: number; month: number}) => {
        const nextEditAvailability = targetDate ? getRequestShiftEditAvailability(targetDate.year, targetDate.month) : editAvailability;

        if (readonly) {
            if (!nextEditAvailability.canEdit && nextEditAvailability.validationMessage) {
                showValidationFeedback(nextEditAvailability.validationMessage);

                return;
            }

            setState('readonly', false);
        } else {
            setState('readonly', true);
            setState('focus', null);

            if (requestShift) {
                setState(
                    'foldedLevels',
                    requestShift.divisionShiftNurses.map(() => false),
                );
            }
        }
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

        if (currentShiftTeamId !== null) {
            retryTasks.push(refetchDutyRequestList(), refetchRequestShift());
        }

        await Promise.all(retryTasks);
    }, [currentShiftTeamId, handleGetAccountMe, refetchDutyRequestList, refetchRequestShift, refetchShiftTeams, wardId]);

    useEffect(() => {
        if (activeEffect && requestShift) {
            window.dispatchEvent(new Event('resize'));

            const wardShiftTypeMap = new Map<number, TWardShiftType>();

            requestShift.wardShiftTypes.forEach((wardShiftType) => {
                wardShiftTypeMap.set(wardShiftType.wardShiftTypeId, wardShiftType);
            });

            if (foldedLevels && foldedLevels?.length !== requestShift.divisionShiftNurses.length) {
                setState(
                    'foldedLevels',
                    requestShift.divisionShiftNurses.map(() => false),
                );
            }

            setState('wardShiftTypeMap', wardShiftTypeMap);
        }
    }, [activeEffect, foldedLevels, requestShift, setState]);

    useEffect(() => {
        if (activeEffect) document.addEventListener('keydown', handleKeyDown);

        return () => {
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [activeEffect, focus, requestShift, handleKeyDown]);

    useEffect(
        () => () => {
            clearChangeStatusResetTimer();
        },
        [clearChangeStatusResetTimer],
    );

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
            currentShiftTeam: shiftTeams?.find((x) => x.shiftTeamId === currentShiftTeamId) as TShiftTeam | null,
            shiftTeams,
            editAvailability,
        },
        actions: {
            changeRequestShift: (focus: TFocus, shiftTypeId: number | null) => changeRequestShift(focus, shiftTypeId),
            toggleEditMode: handleToggleEditMode,
            createNextMonthShift: handleCreateNextMonthShift,
            acceptRequest: (reqShiftId: number, isAccepted: boolean | null) => acceptRequest(reqShiftId, isAccepted),
            acceptRequests: (reqShiftIds: number[], isAccepted: boolean | null) => acceptRequests(reqShiftIds, isAccepted),
            foldLevel,
            changeMonth,
            retry,
            changeFocus: (focus: TFocus | null) => setState('focus', focus),
            changeShiftTeam: (shiftTeam: TShiftTeam) => setState('currentShiftTeamId', shiftTeam.shiftTeamId),
        },
    };
};

export default useRequestShift;
