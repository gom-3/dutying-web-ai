import {DragDropContext, type DropResult} from '@hello-pangea/dnd';
import {useQuery} from '@tanstack/react-query';
import {useEffect, useMemo, useState} from 'react';
import {type TNurse} from '@/entities';
import {wardQueryOptions} from '@/entities/ward/model/queries';
import useAuth from '@/features/auth/useAuth';
import {getWardSkillSettings, resolveWardSkillLevels} from '@/features/ward/skill-level';
import {useMakeShiftStore} from '../../model/make-shift-store';
import {WorkersHeader, WorkersList, WorkersTableHeader} from './workers-sections';

export function Workers() {
    const {
        state: {wardId},
    } = useAuth();
    const currentShiftTeamId = useMakeShiftStore((s) => s.currentShiftTeamId);
    const enabled = wardId !== null && currentShiftTeamId !== null;
    const {data} = useQuery({
        ...wardQueryOptions.shiftTeamNurses(wardId ?? -1, currentShiftTeamId ?? -1),
        enabled,
    });
    const {data: ward} = useQuery({
        ...wardQueryOptions.id(wardId ?? -1),
        enabled: wardId !== null,
    });
    const workers = useMemo(() => (data ?? []).filter((nurse) => nurse.isWorker), [data]);
    const allWardNurses = useMemo(() => ward?.shiftTeams.flatMap((shiftTeam) => shiftTeam.nurses) ?? workers, [ward?.shiftTeams, workers]);
    const skillSettings = useMemo(() => getWardSkillSettings(wardId), [wardId]);
    const {config: skillConfig, levelsByNurseId} = useMemo(
        () => resolveWardSkillLevels(allWardNurses, skillSettings),
        [allWardNurses, skillSettings],
    );
    const [orderedWorkers, setOrderedWorkers] = useState<TNurse[]>([]);
    const totalCount = orderedWorkers.length;

    useEffect(() => {
        setOrderedWorkers(workers);
    }, [workers]);

    const onDragEnd = (result: DropResult) => {
        if (!result.destination) return;

        const fromIndex = result.source.index;
        const toIndex = result.destination.index;

        if (fromIndex === toIndex) return;

        setOrderedWorkers((prev) => {
            const next = prev.slice();
            const [moved] = next.splice(fromIndex, 1);

            if (!moved) return prev;

            next.splice(toIndex, 0, moved);

            return next;
        });
    };
    const sortByLevel = () => {
        setOrderedWorkers((prev) => prev.slice().sort((a, b) => (levelsByNurseId[b.nurseId] ?? 0) - (levelsByNurseId[a.nurseId] ?? 0)));
    };

    return (
        <div id="make_workers_step" className="rounded-[15px] bg-gray-7 p-[30px]">
            <WorkersHeader totalCount={totalCount} onSortByLevel={sortByLevel} />
            <WorkersTableHeader />

            <DragDropContext onDragEnd={onDragEnd}>
                <WorkersList workers={orderedWorkers} levelsByNurseId={levelsByNurseId} skillConfig={skillConfig} />
            </DragDropContext>
        </div>
    );
}
