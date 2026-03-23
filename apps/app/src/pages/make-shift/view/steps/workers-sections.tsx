import {Draggable, Droppable} from '@hello-pangea/dnd';
import {ChevronDown} from 'lucide-react';
import {type ComponentProps} from 'react';
import {type TNurse} from '@/entities';
import SkillBadge from '@/features/ward/SkillBadge';
import {SixDotsIcon} from '@/shared/assets/svg';
import {useTypedTranslation} from '@/shared/hook/use-typed-translation';
import {DutyManagementStatusCard} from '@/widgets/duty-management/ui';

const SHIFT_TYPE_STYLE: Record<string, {bg: string; text: string}> = {
    D: {bg: '#4dc2ad', text: '#ffffff'},
    E: {bg: '#ff8ba5', text: '#ffffff'},
    N: {bg: '#3580ff', text: '#ffffff'},
    O: {bg: '#465b7a', text: '#ffffff'},
};

type TSkillConfig = ComponentProps<typeof SkillBadge>['config'];

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

export function buildShiftCodes(nurse: TNurse) {
    return nurse.nurseShiftTypes
        .filter((shift) => shift.isPossible)
        .map((shift) => shift.shortName || shift.name)
        .map((name) => name.trim().toUpperCase())
        .filter((code) => code.length > 0);
}

export function WorkersHeader({totalCount, onSortByLevel}: {totalCount: number; onSortByLevel: () => void}) {
    const {t} = useTypedTranslation();

    return (
        <div className="flex items-center justify-between">
            <p className="text-gray-2 font-apple text-[20px] font-semibold">
                {t('page.makeShift.workers.totalCount', {count: totalCount})}
            </p>
            <button
                type="button"
                className="flex items-center gap-1 rounded-[5px] px-2 py-1 font-apple text-base font-medium text-gray-3 hover:bg-white"
                onClick={onSortByLevel}
            >
                {t('page.makeShift.workers.sortByLevel')}
                <ChevronDown className="h-5 w-5" />
            </button>
        </div>
    );
}

export function WorkersTableHeader() {
    const {t} = useTypedTranslation();

    return (
        <div className="mt-3 grid grid-cols-[24px_140px_80px_200px_1fr] items-center gap-6 px-3 text-[16px] text-gray-3">
            <div />
            <p className="font-apple">{t('page.makeShift.workers.column.name')}</p>
            <p className="text-center font-apple">{t('page.makeShift.workers.column.level')}</p>
            <p className="text-center font-apple">{t('page.makeShift.workers.column.shiftTypes')}</p>
            <p className="text-center font-apple">{t('page.makeShift.workers.column.memo')}</p>
        </div>
    );
}

type TWorkersListProps = {
    workers: TNurse[];
    levelsByNurseId: Record<number, number>;
    skillConfig: TSkillConfig;
};

export function WorkersList({workers, levelsByNurseId, skillConfig}: TWorkersListProps) {
    const {t} = useTypedTranslation();

    return (
        <Droppable droppableId="workers">
            {(provided) => (
                <div ref={provided.innerRef} {...provided.droppableProps} className="mt-4 flex flex-col gap-3">
                    {workers.length === 0 ? (
                        <DutyManagementStatusCard
                            title={t('page.makeShift.workers.emptyTitle')}
                            description={t('page.makeShift.workers.emptyDescription')}
                            className="min-h-[220px] border-solid"
                        />
                    ) : null}
                    {workers.map((nurse, index) => (
                        <WorkerRow
                            key={nurse.nurseId}
                            nurse={nurse}
                            index={index}
                            level={levelsByNurseId[nurse.nurseId]}
                            skillConfig={skillConfig}
                        />
                    ))}
                    {provided.placeholder}
                </div>
            )}
        </Droppable>
    );
}

type TWorkerRowProps = {
    nurse: TNurse;
    index: number;
    level: number | undefined;
    skillConfig: TSkillConfig;
};

function WorkerRow({nurse, index, level, skillConfig}: TWorkerRowProps) {
    const {t} = useTypedTranslation();
    const shiftCodes = buildShiftCodes(nurse);
    const memo = nurse.memo?.trim();

    return (
        <Draggable draggableId={`nurse-${nurse.nurseId}`} index={index}>
            {(dragProvided, dragSnapshot) => (
                <div
                    ref={dragProvided.innerRef}
                    {...dragProvided.draggableProps}
                    className={`grid h-[52px] grid-cols-[24px_140px_80px_200px_1fr] items-center gap-6 rounded-[10px] border border-gray-6 bg-white px-3 ${
                        dragSnapshot.isDragging ? 'opacity-95' : ''
                    }`}
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
                        <SkillBadge level={level} config={skillConfig} />
                    </div>
                    <div className="flex items-center justify-center gap-1">
                        {shiftCodes.length > 0 ? (
                            shiftCodes.map((code) => <ShiftTypeBadge key={`${nurse.nurseId}-${code}`} code={code} />)
                        ) : (
                            <span className="font-apple text-sm text-gray-4">-</span>
                        )}
                    </div>
                    <p className="text-center font-apple text-[20px] font-medium text-sub-1">{memo || '-'}</p>
                </div>
            )}
        </Draggable>
    );
}
