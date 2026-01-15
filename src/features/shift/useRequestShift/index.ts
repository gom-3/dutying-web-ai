import {useQuery, useQueryClient} from '@tanstack/react-query';
import {produce} from 'immer';
import {useCallback, useEffect, useState} from 'react';
import {match} from 'ts-pattern';
import {events, sendEvent} from '@/analytics';
import {wardQueryOptions} from '@/entities/ward/model/queries';
import useAuth from '@/features/auth/useAuth';
import {WardAPI} from '@/shared/api';
import {moveSelection} from '@/shared/editor/editor-core/selection';
import {type RequestShift} from '@/shared/types/shift';
import {type ShiftTeam, type WardShiftType} from '@/shared/types/ward';
import {DateUtil} from '@/shared/util/date';
import {type Focus} from '../editDuty/faults';
import {findNurse} from '../editDuty/find-nurse';
import {keydownEventMapper} from '../editDuty/keyboard';
import {useRequestShiftStore} from './store';

const useRequestShift = (activeEffect = false) => {
    const {year, month, focus, foldedLevels, currentShiftTeamId, oldCurrentShiftTeamId, wardShiftTypeMap, readonly, setState} =
        useRequestShiftStore();
    const {
        state: {wardId},
    } = useAuth();
    const queryClient = useQueryClient();
    const [changeStatus, setChangeStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
    const shiftTeamsQueryOptions = wardQueryOptions.shiftTeams(wardId ?? 0);
    const requestListQueryOptions = wardQueryOptions.requestList(wardId ?? 0, currentShiftTeamId ?? 0, year, month);
    const requestShiftQueryOptions = wardQueryOptions.request(wardId ?? 0, currentShiftTeamId ?? 0, year, month);
    const wardConstraintQueryOptions = wardQueryOptions.constraint(wardId ?? 0, currentShiftTeamId ?? 0);
    const requestShiftQueryKey = requestShiftQueryOptions.queryKey;
    const shiftTeamQueryKey = shiftTeamsQueryOptions.queryKey;
    const wardConstraintQueryKey = wardConstraintQueryOptions.queryKey;
    const dutyRequestQueryKey = requestListQueryOptions.queryKey;
    const {data: shiftTeams} = useQuery({
        ...shiftTeamsQueryOptions,
        queryFn: async () => {
            const res = await WardAPI.getShiftTeams(wardId!);

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
    const {data: dutyRequestList} = useQuery({
        ...requestListQueryOptions,
        enabled: wardId !== null && currentShiftTeamId !== null,
    });
    const {data: requestShift, status: shiftStatus} = useQuery({
        ...requestShiftQueryOptions,
        queryFn: async () => {
            const res = await WardAPI.getReqShift(wardId!, currentShiftTeamId!, year, month);

            if (res === null) return;

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
        async (focus: Focus, shiftTypeId: number | null) => {
            if (!wardId) return;

            setChangeStatus('loading');
            await queryClient.cancelQueries({queryKey: requestShiftQueryKey});

            const {shiftNurseId, day} = focus;
            const oldShift = queryClient.getQueryData<RequestShift>(requestShiftQueryKey);

            if (oldShift && wardShiftTypeMap) {
                const oldShiftTypeId = oldShift.divisionShiftNurses
                    .flatMap((x) => x)
                    .find((x) => x.shiftNurse.shiftNurseId === shiftNurseId)!.wardReqShiftList[focus.day];
                const edit = {
                    nurseName: findNurse(oldShift, focus.shiftNurseId)!.name,
                    focus,
                    prevShiftType: oldShiftTypeId ? wardShiftTypeMap.get(oldShiftTypeId) : null,
                    nextShiftType: shiftTypeId ? wardShiftTypeMap.get(shiftTypeId) : null,
                    dateString: DateUtil.getDateString(new Date(), 'yyyy-MM-dd HH:mm:ss'),
                };

                queryClient.setQueryData<RequestShift>(
                    requestShiftQueryKey,
                    produce(oldShift, (draft) => {
                        draft.divisionShiftNurses
                            .flatMap((x) => x)
                            .find((x) => x.shiftNurse.shiftNurseId === focus.shiftNurseId)!.wardReqShiftList[focus.day] =
                            shiftTypeId;
                    }),
                );

                sendEvent(
                    events.requestPage.changeShift,
                    `${focus.shiftNurseName} / ${day + 1}일 | ` +
                        match(edit)
                            .with({prevShiftType: null}, () => `추가 → ${edit.nextShiftType?.shortName}`)
                            .with({nextShiftType: null}, () => `${edit.prevShiftType?.shortName} → 삭제`)
                            .otherwise(() => `${edit.prevShiftType?.shortName} → ${edit.nextShiftType?.shortName}`),
                );
            }

            try {
                await WardAPI.updateReqShift(wardId, year, month, focus.day + 1, focus.shiftNurseId, shiftTypeId);
                setChangeStatus('success');
                setTimeout(() => setChangeStatus('idle'), 0);
            } catch {
                if (oldShift) {
                    queryClient.setQueryData(requestShiftQueryKey, oldShift);
                }
                setChangeStatus('error');
                setTimeout(() => setChangeStatus('idle'), 0);
            }
        },
        [queryClient, requestShiftQueryKey, wardId, wardShiftTypeMap, year, month],
    );
    const acceptRequest = useCallback(
        async (reqShiftId: number, isAccepted: boolean | null) => {
            if (!wardId) return;

            try {
                await WardAPI.acceptRequestShift(wardId, reqShiftId, isAccepted);
                await queryClient.invalidateQueries({queryKey: requestShiftQueryKey});
                await queryClient.invalidateQueries({queryKey: dutyRequestQueryKey});
            } catch {
                alert('신청 처리에 실패했습니다.');
            }
        },
        [dutyRequestQueryKey, queryClient, requestShiftQueryKey, wardId],
    );
    const changeMonth = (type: 'prev' | 'next') => {
        if (type === 'prev') {
            if (new Date(year, month, 1) <= new Date() && !readonly) {
                alert('두달 전 신청 근무는 수정하실 수 없습니다');
                setState('readonly', true);
            }

            if (month === 1) {
                setState('month', 12);
                setState('year', year - 1);
            } else {
                setState('month', month - 1);
            }
        } else if (type === 'next') {
            if (new Date(year, month - 1, 1) > new Date()) {
                alert('두달 뒤 신청 근무는 아직 수정하실  수 없습니다.');

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
                const bounds = {rowCount: requestShift.divisionShiftNurses.flatMap((d) => d).length, colCount: requestShift.days.length};
                const rowIndexByShiftNurseId = new Map(
                    requestShift.divisionShiftNurses.flatMap((d) => d).map((r, idx) => [r.shiftNurse.shiftNurseId, idx] as const),
                );
                const currentRow = rowIndexByShiftNurseId.get(focus.shiftNurseId) ?? 0;
                const currentSel = {type: 'single' as const, anchor: {row: currentRow, col: focus.day}};
                const nextSel = moveSelection(
                    currentSel,
                    e.key.replace('Arrow', '').toLowerCase() as 'left' | 'right' | 'up' | 'down',
                    bounds,
                    false,
                    ctrlKey,
                );

                if (!nextSel) return;

                const pos = nextSel.type === 'single' ? nextSel.anchor : nextSel.from;
                const row = requestShift.divisionShiftNurses.flatMap((d) => d)[pos.row];

                if (!row) return;

                setState('focus', {shiftNurseId: row.shiftNurse.shiftNurseId, shiftNurseName: row.shiftNurse.name, day: pos.col});
            }

            keydownEventMapper(
                e,
                ...requestShift.wardShiftTypes.map((shiftType) => ({
                    keys: [shiftType.shortName],
                    callback: () => {
                        changeFocusedShift(shiftType.wardShiftTypeId);

                        // 입력 후 우측 이동
                        const bounds = {
                            rowCount: requestShift.divisionShiftNurses.flatMap((d) => d).length,
                            colCount: requestShift.days.length,
                        };
                        const rowIndexByShiftNurseId = new Map(
                            requestShift.divisionShiftNurses.flatMap((d) => d).map((r, idx) => [r.shiftNurse.shiftNurseId, idx] as const),
                        );
                        const currentRow = rowIndexByShiftNurseId.get(focus.shiftNurseId) ?? 0;
                        const currentSel = {type: 'single' as const, anchor: {row: currentRow, col: focus.day}};
                        const nextSel = moveSelection(currentSel, 'right', bounds, false, ctrlKey);

                        if (!nextSel) return;

                        const pos = nextSel.type === 'single' ? nextSel.anchor : nextSel.from;
                        const row = requestShift.divisionShiftNurses.flatMap((d) => d)[pos.row];

                        if (!row) return;

                        setState('focus', {shiftNurseId: row.shiftNurse.shiftNurseId, shiftNurseName: row.shiftNurse.name, day: pos.col});
                        sendEvent(ctrlKey ? events.requestPage.moveCellFocus : events.requestPage.moveCellFocus, e.key);
                    },
                })),
                {
                    keys: ['Backspace'],
                    callback: () => {
                        changeFocusedShift(null);

                        const bounds = {
                            rowCount: requestShift.divisionShiftNurses.flatMap((d) => d).length,
                            colCount: requestShift.days.length,
                        };
                        const rowIndexByShiftNurseId = new Map(
                            requestShift.divisionShiftNurses.flatMap((d) => d).map((r, idx) => [r.shiftNurse.shiftNurseId, idx] as const),
                        );
                        const currentRow = rowIndexByShiftNurseId.get(focus.shiftNurseId) ?? 0;
                        const currentSel = {type: 'single' as const, anchor: {row: currentRow, col: focus.day}};
                        const nextSel = moveSelection(currentSel, 'left', bounds, false, ctrlKey);

                        if (!nextSel) return;

                        const pos = nextSel.type === 'single' ? nextSel.anchor : nextSel.from;
                        const row = requestShift.divisionShiftNurses.flatMap((d) => d)[pos.row];

                        if (!row) return;

                        setState('focus', {shiftNurseId: row.shiftNurse.shiftNurseId, shiftNurseName: row.shiftNurse.name, day: pos.col});
                        sendEvent(ctrlKey ? events.requestPage.moveCellFocus : events.requestPage.moveCellFocus, e.key);
                    },
                },
                {keys: ['Delete'], callback: () => changeFocusedShift(null)},
            );
        },
        [focus, requestShift, setState, changeFocusedShift],
    );
    const handleToggleEditMode = () => {
        if (readonly) {
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

        if (nextMonth > 12) {
            setState('year', year + 1);
            setState('month', 1);
        } else {
            setState('month', nextMonth);
        }

        handleToggleEditMode();
    };

    useEffect(() => {
        if (activeEffect && requestShift) {
            window.dispatchEvent(new Event('resize'));

            const wardShiftTypeMap = new Map<number, WardShiftType>();

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

    return {
        queryKey: {
            requestShiftQueryKey,
            shiftTeamQueryKey,
            wardConstraintQueryKey,
        },
        state: {
            year,
            month,
            requestShift,
            dutyRequestList,
            focus,
            foldedLevels,
            changeStatus,
            shiftStatus,
            wardShiftTypeMap,
            readonly,
            currentShiftTeam: shiftTeams?.find((x) => x.shiftTeamId === currentShiftTeamId) as ShiftTeam | null,
            shiftTeams,
        },
        actions: {
            changeRequestShift: (focus: Focus, shiftTypeId: number | null) => changeRequestShift(focus, shiftTypeId),
            toggleEditMode: handleToggleEditMode,
            createNextMonthShift: handleCreateNextMonthShift,
            acceptRequest: (reqShiftId: number, isAccepted: boolean | null) => acceptRequest(reqShiftId, isAccepted),
            foldLevel,
            changeMonth,
            changeFocus: (focus: Focus | null) => setState('focus', focus),
            changeShiftTeam: (shiftTeam: ShiftTeam) => setState('currentShiftTeamId', shiftTeam.shiftTeamId),
        },
    };
};

export default useRequestShift;
