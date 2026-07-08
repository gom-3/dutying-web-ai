import {type DropResult} from '@hello-pangea/dnd';
import {useQueryClient} from '@tanstack/react-query';
import {useCallback, useMemo, useState} from 'react';
import type {TNurse} from '@/entities/nurse';
import type {TRequestShift, TShift} from '@/entities/shift';
import type {TShiftTeam, TWard} from '@/entities/ward';
import {wardQueryKeys, wardQueryOptions} from '@/entities/ward/model/queries';
import {type TDutyDoc, useShiftEditorStore} from '@/features/shift-editor';
import {NurseAPI} from '@/shared/api';
import {useTypedTranslation} from '@/shared/hook/use-typed-translation';
import {showActionErrorFeedback} from '@/shared/util/feedback';
import {buildMakeShiftWorkerMovePayload} from './make-shift-worker-order';
import {
    applyNursePriorityMoveToNurses,
    applyNursePriorityMoveToSchedule,
    applyNursePriorityMoveToShiftTeams,
    getCurrentTeamNurses,
    getDisplayWorkersFromSchedule,
    sortDutyDocByScheduleOrder,
    type TNurseOrderMovePayload,
} from './nurse-order-sync';
import {useMakeShiftStore} from './make-shift-store';

type TScheduleKind = 'duty' | 'request';
type TSchedule = TShift | TRequestShift;

type TMoveScheduleRowOptions = {
    scheduleKind: TScheduleKind;
    doc?: TDutyDoc;
};

type TMoveNurseOrderOptions = {
    scheduleKind?: TScheduleKind;
    nextSchedule?: TSchedule;
    nextDoc?: TDutyDoc;
};

function formatPatchYearMonth(year: number, month: number) {
    return `${year}-${String(month).padStart(2, '0')}`;
}

function findScheduleRowByShiftNurseId(schedule: TSchedule, shiftNurseId: number) {
    for (const division of schedule.divisionShiftNurses) {
        for (const row of division) {
            if (row.shiftNurse.shiftNurseId === shiftNurseId) return row;
        }
    }

    return null;
}

function updateWardShiftTeams(ward: TWard | undefined, payload: TNurseOrderMovePayload): TWard | undefined {
    if (!ward) return ward;

    return {
        ...ward,
        shiftTeams: applyNursePriorityMoveToShiftTeams(ward.shiftTeams, payload),
    };
}

export function useMakeShiftNurseOrder() {
    const {t} = useTypedTranslation();
    const queryClient = useQueryClient();
    const wardId = useMakeShiftStore((s) => s.wardId);
    const currentShiftTeamId = useMakeShiftStore((s) => s.currentShiftTeamId);
    const year = useMakeShiftStore((s) => s.year);
    const month = useMakeShiftStore((s) => s.month);
    const shiftTeams = useMakeShiftStore((s) => s.shiftTeams);
    const currentTeamNurses = useMemo(() => getCurrentTeamNurses(shiftTeams, currentShiftTeamId), [currentShiftTeamId, shiftTeams]);
    const [isReorderingRows, setIsReorderingRows] = useState(false);
    const patchYearMonth = formatPatchYearMonth(year, month);

    const invalidateOrderQueries = useCallback(async () => {
        if (!wardId || !currentShiftTeamId) return;

        await Promise.all([
            queryClient.invalidateQueries({queryKey: wardQueryKeys.id(wardId)}),
            queryClient.invalidateQueries({queryKey: wardQueryKeys.shiftTeams(wardId)}),
            queryClient.invalidateQueries({queryKey: wardQueryKeys.shiftTeamNurses(wardId, currentShiftTeamId)}),
            queryClient.invalidateQueries({queryKey: wardQueryOptions.duty(wardId, currentShiftTeamId, year, month).queryKey}),
            queryClient.invalidateQueries({queryKey: wardQueryOptions.request(wardId, currentShiftTeamId, year, month).queryKey}),
            queryClient.invalidateQueries({queryKey: ['ward', wardId, 'shift-team', currentShiftTeamId, 'schedule-workspace', year, month]}),
        ]);
    }, [currentShiftTeamId, month, queryClient, wardId, year]);

    const moveNurseOrder = useCallback(
        async (payload: TNurseOrderMovePayload, options: TMoveNurseOrderOptions = {}) => {
            if (!wardId || !currentShiftTeamId || isReorderingRows) return false;

            const wardQueryKey = wardQueryKeys.id(wardId);
            const shiftTeamsQueryKey = wardQueryKeys.shiftTeams(wardId);
            const shiftTeamNursesQueryKey = wardQueryKeys.shiftTeamNurses(wardId, currentShiftTeamId);
            const dutyQueryKey = wardQueryOptions.duty(wardId, currentShiftTeamId, year, month).queryKey;
            const requestQueryKey = wardQueryOptions.request(wardId, currentShiftTeamId, year, month).queryKey;
            const previousStoreShiftTeams = useMakeShiftStore.getState().shiftTeams;
            const previousWard = queryClient.getQueryData<TWard>(wardQueryKey);
            const previousShiftTeams = queryClient.getQueryData<TShiftTeam[]>(shiftTeamsQueryKey);
            const previousShiftTeamNurses = queryClient.getQueryData<TNurse[]>(shiftTeamNursesQueryKey);
            const previousDuty = queryClient.getQueryData<TShift>(dutyQueryKey);
            const previousRequest = queryClient.getQueryData<TRequestShift>(requestQueryKey);
            const previousDoc = options.nextDoc ? useShiftEditorStore.getState().doc : null;
            const nextStoreShiftTeams = applyNursePriorityMoveToShiftTeams(previousStoreShiftTeams, payload);

            setIsReorderingRows(true);

            await Promise.all([
                queryClient.cancelQueries({queryKey: wardQueryKey}),
                queryClient.cancelQueries({queryKey: shiftTeamsQueryKey}),
                queryClient.cancelQueries({queryKey: shiftTeamNursesQueryKey}),
                queryClient.cancelQueries({queryKey: dutyQueryKey}),
                queryClient.cancelQueries({queryKey: requestQueryKey}),
            ]);

            useMakeShiftStore.setState({shiftTeams: nextStoreShiftTeams});
            queryClient.setQueryData<TWard>(wardQueryKey, (current) => updateWardShiftTeams(current, payload));
            queryClient.setQueryData<TShiftTeam[]>(shiftTeamsQueryKey, (current) =>
                current ? applyNursePriorityMoveToShiftTeams(current, payload) : current,
            );
            queryClient.setQueryData<TNurse[]>(shiftTeamNursesQueryKey, (current) => applyNursePriorityMoveToNurses(current, payload));

            if (options.scheduleKind === 'duty') {
                queryClient.setQueryData<TShift>(dutyQueryKey, (current) => (options.nextSchedule as TShift | undefined) ?? current);
            } else {
                queryClient.setQueryData<TShift>(dutyQueryKey, (current) => applyNursePriorityMoveToSchedule(current, payload));
            }

            if (options.scheduleKind === 'request') {
                queryClient.setQueryData<TRequestShift>(
                    requestQueryKey,
                    (current) => (options.nextSchedule as TRequestShift | undefined) ?? current,
                );
            } else {
                queryClient.setQueryData<TRequestShift>(requestQueryKey, (current) => applyNursePriorityMoveToSchedule(current, payload));
            }

            if (options.nextDoc) {
                useShiftEditorStore.getState().setDoc(options.nextDoc);
            }

            try {
                await NurseAPI.updateNurseOrder(
                    payload.nurseId,
                    payload.sourceShiftTeamId,
                    payload.destinationShiftTeamId,
                    payload.divisionNum,
                    payload.prevPriority,
                    payload.nextPriority,
                    patchYearMonth,
                );
                await invalidateOrderQueries();

                return true;
            } catch (error) {
                useMakeShiftStore.setState({shiftTeams: previousStoreShiftTeams});

                if (previousWard !== undefined) queryClient.setQueryData(wardQueryKey, previousWard);
                if (previousShiftTeams !== undefined) queryClient.setQueryData(shiftTeamsQueryKey, previousShiftTeams);
                if (previousShiftTeamNurses !== undefined) queryClient.setQueryData(shiftTeamNursesQueryKey, previousShiftTeamNurses);
                if (previousDuty !== undefined) queryClient.setQueryData(dutyQueryKey, previousDuty);
                if (previousRequest !== undefined) queryClient.setQueryData(requestQueryKey, previousRequest);
                if (previousDoc) useShiftEditorStore.getState().setDoc(previousDoc);

                showActionErrorFeedback(error, t('feature.editShiftTeam.moveNurseFailed'));

                return false;
            } finally {
                setIsReorderingRows(false);
            }
        },
        [currentShiftTeamId, invalidateOrderQueries, isReorderingRows, month, patchYearMonth, queryClient, t, wardId, year],
    );

    const moveScheduleRow = useCallback(
        async (schedule: TSchedule, result: DropResult, options: TMoveScheduleRowOptions) => {
            if (!currentShiftTeamId || !result.destination) return false;

            const shiftNurseId = Number.parseInt(result.draggableId, 10);
            const srcDiv = Number.parseInt(result.source.droppableId, 10);
            const dstDiv = Number.parseInt(result.destination.droppableId, 10);

            if ([shiftNurseId, srcDiv, dstDiv].some(Number.isNaN)) return false;

            const row = findScheduleRowByShiftNurseId(schedule, shiftNurseId);

            if (!row) return false;

            const displayWorkers = getDisplayWorkersFromSchedule(schedule, currentTeamNurses);

            if (!displayWorkers) return false;

            const sourceWorkers = displayWorkers.filter((nurse) => nurse.divisionNum === srcDiv && nurse.isWorker);
            const destinationWorkers = displayWorkers.filter((nurse) => nurse.divisionNum === dstDiv && nurse.isWorker);
            const sourceWorkerIndex = sourceWorkers.findIndex((nurse) => nurse.nurseId === row.shiftNurse.nurseId);
            const destinationWorkerIndex = Math.min(result.destination.index, destinationWorkers.length);

            if (sourceWorkerIndex === -1) return false;

            const payload = buildMakeShiftWorkerMovePayload(
                currentTeamNurses,
                displayWorkers,
                currentShiftTeamId,
                row.shiftNurse.nurseId,
                srcDiv,
                dstDiv,
                sourceWorkerIndex,
                destinationWorkerIndex,
            );

            if (!payload) return false;

            const nextSchedule = applyNursePriorityMoveToSchedule(schedule, payload);
            const nextDoc = options.doc ? sortDutyDocByScheduleOrder(options.doc, nextSchedule) : undefined;

            return moveNurseOrder(payload, {scheduleKind: options.scheduleKind, nextSchedule, nextDoc});
        },
        [currentShiftTeamId, currentTeamNurses, moveNurseOrder],
    );

    return {
        currentTeamNurses,
        isReorderingRows,
        moveNurseOrder,
        moveScheduleRow,
    };
}
