import {DragDropContext, type DropResult} from '@hello-pangea/dnd';
import {useQuery} from '@tanstack/react-query';
import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {type TNurse} from '@/entities/nurse';
import {wardQueryOptions} from '@/entities/ward/model/queries';
import useAuth from '@/features/auth';
import useEditShiftTeam from '@/features/edit-shift-team';
import {getWardSkillSettings, resolveWardSkillLevels} from '@/features/ward-skill/model/skill-level';
import {getGroupedDivisionNurses} from '@/pages/member/model/shift-team-list';
import {PersonIcon} from '@/shared/assets/svg';
import {useTypedTranslation} from '@/shared/hook/use-typed-translation';
import {DutyManagementStatusCard} from '@/widgets/duty-management/ui';
import {
    applyMakeShiftWorkerDrag,
    buildMakeShiftWorkerMovePayload,
    freshenMakeShiftDisplayWorkers,
    sortMakeShiftWorkersInitialOrder,
} from '../../model/make-shift-worker-order';
import {useMakeShiftStore} from '../../model/make-shift-store';
import {WorkersList, WorkersTableHeader} from './workers-sections';

export function Workers() {
    const {t} = useTypedTranslation();
    const {
        state: {wardId},
    } = useAuth();
    const currentShiftTeamId = useMakeShiftStore((s) => s.currentShiftTeamId);
    const year = useMakeShiftStore((s) => s.year);
    const month = useMakeShiftStore((s) => s.month);
    const enabled = wardId !== null && currentShiftTeamId !== null;

    const {
        actions: {moveNurseOrder},
    } = useEditShiftTeam();

    const {data: teamNurses = []} = useQuery({
        ...wardQueryOptions.shiftTeamNurses(wardId ?? -1, currentShiftTeamId ?? -1),
        enabled,
    });

    const {data: ward} = useQuery({
        ...wardQueryOptions.id(wardId ?? -1),
        enabled: wardId !== null,
    });

    const workersOnly = useMemo(() => teamNurses.filter((nurse) => nurse.isWorker), [teamNurses]);
    const sortedFromServer = useMemo(() => sortMakeShiftWorkersInitialOrder(workersOnly), [workersOnly]);

    const [orderCustomized, setOrderCustomized] = useState(false);
    const [localWorkers, setLocalWorkers] = useState<TNurse[]>([]);
    const sortedRef = useRef(sortedFromServer);
    sortedRef.current = sortedFromServer;
    const orderCustomizedRef = useRef(false);
    orderCustomizedRef.current = orderCustomized;

    useEffect(() => {
        setOrderCustomized(false);
        setLocalWorkers([]);
    }, [currentShiftTeamId, wardId]);

    useEffect(() => {
        if (!orderCustomized) return;

        setLocalWorkers((prev) => freshenMakeShiftDisplayWorkers(prev, teamNurses));
    }, [teamNurses, orderCustomized]);

    const displayWorkers = orderCustomized ? localWorkers : sortedFromServer;
    const grouped = useMemo(() => getGroupedDivisionNurses(displayWorkers), [displayWorkers]);

    const allWardNurses = useMemo(
        () => ward?.shiftTeams.flatMap((shiftTeam) => shiftTeam.nurses) ?? displayWorkers,
        [ward?.shiftTeams, displayWorkers],
    );
    const skillSettings = useMemo(() => getWardSkillSettings(wardId), [wardId]);
    const {config: skillConfig, levelsByNurseId} = useMemo(
        () => resolveWardSkillLevels(allWardNurses, skillSettings),
        [allWardNurses, skillSettings],
    );

    const patchYearMonth = `${year}-${String(month).padStart(2, '0')}`;

    const onDragStart = useCallback(() => {
        if (!orderCustomizedRef.current) {
            setLocalWorkers(sortedRef.current);
        }

        setOrderCustomized(true);
    }, []);

    const onDragEnd = (result: DropResult) => {
        if (!result.destination || !currentShiftTeamId) return;

        const nurseId = Number.parseInt(result.draggableId, 10);
        if (Number.isNaN(nurseId)) return;

        const [srcTeamStr, srcDivStr] = result.source.droppableId.split(',');
        const [dstTeamStr, dstDivStr] = result.destination.droppableId.split(',');

        const srcTeamId = Number.parseInt(srcTeamStr!, 10);
        const dstTeamId = Number.parseInt(dstTeamStr!, 10);
        if (srcTeamId !== currentShiftTeamId || dstTeamId !== currentShiftTeamId) return;

        const srcDiv = Number.parseInt(srcDivStr!, 10);
        const dstDiv = Number.parseInt(dstDivStr!, 10);

        const displayForPayload = orderCustomized ? localWorkers : sortedFromServer;

        const payload = buildMakeShiftWorkerMovePayload(
            teamNurses,
            displayForPayload,
            currentShiftTeamId,
            nurseId,
            srcDiv,
            dstDiv,
            result.source.index,
            result.destination.index,
        );

        if (!payload) return;

        const nextDisplay = applyMakeShiftWorkerDrag(
            displayForPayload,
            nurseId,
            srcDiv,
            dstDiv,
            result.source.index,
            result.destination.index,
        );

        if (!nextDisplay) return;

        setLocalWorkers(nextDisplay);

        void moveNurseOrder(
            payload.nurseId,
            payload.sourceShiftTeamId,
            payload.destinationShiftTeamId,
            payload.divisionNum,
            payload.prevPriority,
            payload.nextPriority,
            patchYearMonth,
        );
    };

    const workerCount = displayWorkers.length;

    return (
        <div
            id="make_workers_step"
            className="make-shift-workers-root flex min-w-0 flex-col gap-[clamp(4px,0.45vw,8px)]"
        >
            <div className="make-shift-workers__headcount flex justify-end">
                <span
                    className="inline-flex items-center gap-[clamp(3px,0.35vw,6px)] font-apple text-[clamp(12px,1.05vw,17px)] font-semibold text-sub-2"
                    aria-label={t('page.makeShift.workers.totalCount', {count: workerCount})}
                >
                    <PersonIcon
                        aria-hidden
                        className="size-[clamp(14px,1.15vw,18px)] shrink-0 [&>g]:fill-current"
                    />
                    <span className="tabular-nums">{workerCount}</span>
                </span>
            </div>
            <div className="make-shift-workers min-w-0 rounded-[clamp(10px,1.0vw,15px)] bg-gray-7 px-[clamp(14px,2.0vw,30px)] pb-[clamp(14px,2.0vw,30px)] pt-[clamp(6px,0.85vw,14px)]">
                <WorkersTableHeader />

                {workerCount === 0 ? (
                    <DutyManagementStatusCard
                        title={t('page.makeShift.workers.emptyTitle')}
                        description={t('page.makeShift.workers.emptyDescription')}
                        className="mt-[clamp(4px,0.5vw,10px)] min-h-[220px] border-solid"
                    />
                ) : (
                    <DragDropContext onDragStart={onDragStart} onDragEnd={onDragEnd}>
                        <WorkersList
                            grouped={grouped}
                            shiftTeamId={currentShiftTeamId}
                            levelsByNurseId={levelsByNurseId}
                            skillConfig={skillConfig}
                        />
                    </DragDropContext>
                )}
            </div>
        </div>
    );
}
