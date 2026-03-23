import {DragDropContext, Draggable, Droppable, type DropResult} from '@hello-pangea/dnd';
import {useQuery} from '@tanstack/react-query';
import {ChevronDown} from 'lucide-react';
import {useEffect, useMemo, useState} from 'react';
import {type TNurse} from '@/entities';
import {wardQueryOptions} from '@/entities/ward/model/queries';
import useAuth from '@/features/auth/useAuth';
import {getWardSkillSettings, resolveWardSkillLevels} from '@/features/ward/skill-level';
import SkillBadge from '@/features/ward/SkillBadge';
import {SixDotsIcon} from '@/shared/assets/svg';
import {useTypedTranslation} from '@/shared/hook/use-typed-translation';
import {DutyManagementStatusCard} from '@/widgets/duty-management/ui';
import {useMakeShiftStore} from '../../model/make-shift-store';

const SHIFT_TYPE_STYLE: Record<string, {bg: string; text: string}> = {
    D: {bg: '#4dc2ad', text: '#ffffff'},
    E: {bg: '#ff8ba5', text: '#ffffff'},
    N: {bg: '#3580ff', text: '#ffffff'},
    O: {bg: '#465b7a', text: '#ffffff'},
};

function ShiftTypeBadge({code}: {code: string}) {
    const style = SHIFT_TYPE_STYLE[code] ?? {bg: '#939ba9', text: '#ffffff'};

    return (
        <div
            className="flex h-[23px] w-[21px] items-center justify-center rounded-[4.5px] font-apple text-[15px] font-medium"
            style={{backgroundColor: style.bg, color: style.text}}
        >
            {code}
        </div>
    );
}

function buildShiftCodes(nurse: TNurse) {
    const possible = nurse.nurseShiftTypes.filter((shift) => shift.isPossible);
    const ordered = possible
        .map((shift) => shift.shortName || shift.name)
        .map((name) => name.trim().toUpperCase())
        .filter((code) => code.length > 0);

    return ordered;
}

export function Workers() {
    const {t} = useTypedTranslation();
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
        <div className="rounded-[15px] bg-gray-7 p-[30px]">
            <div className="flex items-center justify-between">
                <p className="text-gray-2 font-apple text-[20px] font-semibold">
                    {t('page.makeShift.workers.totalCount', {count: totalCount})}
                </p>
                <button
                    type="button"
                    className="flex items-center gap-1 rounded-[5px] px-2 py-1 font-apple text-base font-medium text-gray-3 hover:bg-white"
                    onClick={sortByLevel}
                >
                    {t('page.makeShift.workers.sortByLevel')}
                    <ChevronDown className="h-5 w-5" />
                </button>
            </div>

            <div className="mt-3 grid grid-cols-[24px_140px_80px_200px_1fr] items-center gap-6 px-3 text-[16px] text-gray-3">
                <div />
                <p className="font-apple">{t('page.makeShift.workers.column.name')}</p>
                <p className="text-center font-apple">{t('page.makeShift.workers.column.level')}</p>
                <p className="text-center font-apple">{t('page.makeShift.workers.column.shiftTypes')}</p>
                <p className="text-center font-apple">{t('page.makeShift.workers.column.memo')}</p>
            </div>

            <DragDropContext onDragEnd={onDragEnd}>
                <Droppable droppableId="workers">
                    {(provided) => (
                        <div ref={provided.innerRef} {...provided.droppableProps} className="mt-4 flex flex-col gap-3">
                            {orderedWorkers.length === 0 && (
                                <DutyManagementStatusCard
                                    title="근무자로 확정된 인력이 없어요."
                                    description="근무 투입이 설정된 인원을 먼저 확인해 주세요."
                                    className="min-h-[220px] border-solid"
                                />
                            )}
                            {orderedWorkers.map((nurse, index) => {
                                const shiftCodes = buildShiftCodes(nurse);
                                const memo = nurse.memo?.trim();

                                return (
                                    <Draggable key={nurse.nurseId} draggableId={`nurse-${nurse.nurseId}`} index={index}>
                                        {(dragProvided, dragSnapshot) => (
                                            <div
                                                ref={dragProvided.innerRef}
                                                {...dragProvided.draggableProps}
                                                className={`grid h-[52px] grid-cols-[24px_140px_80px_200px_1fr] items-center gap-6 rounded-[10px] border border-gray-6 bg-white px-3 ${dragSnapshot.isDragging ? 'opacity-95' : ''}`}
                                            >
                                                <button
                                                    type="button"
                                                    aria-label={t('page.makeShift.workers.dragHandleAria')}
                                                    className="cursor-grab active:cursor-grabbing"
                                                    {...dragProvided.dragHandleProps}
                                                >
                                                    <SixDotsIcon className="h-6 w-6" />
                                                </button>
                                                <p className="font-apple text-[20px] font-medium text-sub-1">{nurse.name}</p>
                                                <div className="flex justify-center">
                                                    <SkillBadge level={levelsByNurseId[nurse.nurseId]} config={skillConfig} />
                                                </div>
                                                <div className="flex items-center justify-center gap-1">
                                                    {shiftCodes.length > 0 ? (
                                                        shiftCodes.map((code) => (
                                                            <ShiftTypeBadge key={`${nurse.nurseId}-${code}`} code={code} />
                                                        ))
                                                    ) : (
                                                        <span className="font-apple text-sm text-gray-4">-</span>
                                                    )}
                                                </div>
                                                <p className="text-center font-apple text-[20px] font-medium text-sub-1">{memo || '-'}</p>
                                            </div>
                                        )}
                                    </Draggable>
                                );
                            })}
                            {provided.placeholder}
                        </div>
                    )}
                </Droppable>
            </DragDropContext>
        </div>
    );
}
