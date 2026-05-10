import {Draggable, Droppable} from '@hello-pangea/dnd';
import {ChevronDown} from 'lucide-react';
import {type ComponentProps} from 'react';
import {type TNurse} from '@/entities';
import SkillBadge from '@/features/ward-skill/ui/skill-badge';
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

/**
 * 정사각형 색상 배지(D/E/N/O 등). make-shift-calendar의 SHIFT_BADGE와 동일한 정책:
 *   - `size-`로 width=height 강제(정사각형 불변)
 *   - flex 컨테이너 안에서 `shrink-0`로 폭 줄어들지 않게 함
 */
function ShiftTypeBadge({code}: {code: string}) {
    const style = SHIFT_TYPE_STYLE[code] ?? {bg: '#939ba9', text: '#ffffff'};

    return (
        <div
            className="make-shift-workers__shift-type-badge flex shrink-0 size-[clamp(16px,1.4vw,22px)] items-center justify-center rounded-[clamp(3px,0.35vw,5px)] font-apple text-[clamp(10px,0.9vw,15px)] font-medium"
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
        <div className="make-shift-workers__header flex items-center justify-between">
            <p className="make-shift-workers__total text-gray-2 font-apple text-[clamp(13px,1.2vw,20px)] font-semibold">
                {t('page.makeShift.workers.totalCount', {count: totalCount})}
            </p>
            <button
                type="button"
                className="make-shift-workers__sort-button flex items-center gap-[clamp(2px,0.2vw,4px)] rounded-[clamp(4px,0.4vw,5px)] px-[clamp(4px,0.5vw,8px)] py-[clamp(2px,0.25vw,4px)] font-apple text-[clamp(11px,0.95vw,16px)] font-medium text-gray-3 hover:bg-white"
                onClick={onSortByLevel}
            >
                {t('page.makeShift.workers.sortByLevel')}
                <ChevronDown className="size-[clamp(14px,1.2vw,20px)]" />
            </button>
        </div>
    );
}

/**
 * 컬럼 폭과 row의 grid template은 동일하게 유지해야 정렬이 맞음.
 * 변경 시 WORKER_ROW_GRID_TEMPLATE_COLUMNS도 함께 변경.
 */
const WORKERS_GRID_TEMPLATE_COLUMNS =
    'clamp(16px,1.6vw,24px) clamp(90px,9.5vw,140px) clamp(54px,5.5vw,80px) clamp(140px,14vw,200px) 1fr';
const WORKERS_GRID_GAP = 'gap-[clamp(12px,1.6vw,24px)]';
const WORKERS_ROW_PADDING_X = 'px-[clamp(8px,0.85vw,12px)]';

export function WorkersTableHeader() {
    const {t} = useTypedTranslation();

    return (
        <div
            className={`make-shift-workers__table-header mt-[clamp(8px,0.85vw,12px)] grid items-center ${WORKERS_GRID_GAP} ${WORKERS_ROW_PADDING_X} text-[clamp(11px,0.95vw,16px)] text-gray-3`}
            style={{gridTemplateColumns: WORKERS_GRID_TEMPLATE_COLUMNS}}
        >
            <div />
            <p className="make-shift-workers__col-label make-shift-workers__col-label--name font-apple">
                {t('page.makeShift.workers.column.name')}
            </p>
            <p className="make-shift-workers__col-label make-shift-workers__col-label--level text-center font-apple">
                {t('page.makeShift.workers.column.level')}
            </p>
            <p className="make-shift-workers__col-label make-shift-workers__col-label--shift-types text-center font-apple">
                {t('page.makeShift.workers.column.shiftTypes')}
            </p>
            <p className="make-shift-workers__col-label make-shift-workers__col-label--memo text-center font-apple">
                {t('page.makeShift.workers.column.memo')}
            </p>
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
                <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className="make-shift-workers__list mt-[clamp(10px,1.0vw,16px)] flex flex-col gap-[clamp(8px,0.85vw,12px)]"
                >
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
                    className={`make-shift-workers__row grid h-[clamp(36px,3.4vw,52px)] items-center rounded-[clamp(8px,0.7vw,10px)] border border-gray-6 bg-white ${WORKERS_GRID_GAP} ${WORKERS_ROW_PADDING_X} ${
                        dragSnapshot.isDragging ? 'opacity-95' : ''
                    }`}
                    style={{gridTemplateColumns: WORKERS_GRID_TEMPLATE_COLUMNS}}
                >
                    <button
                        type="button"
                        aria-label={t('page.makeShift.workers.dragHandleAria')}
                        className="make-shift-workers__row-drag-handle cursor-grab active:cursor-grabbing"
                        {...dragProvided.dragHandleProps}
                    >
                        <SixDotsIcon className="size-[clamp(16px,1.6vw,24px)]" />
                    </button>
                    <p className="make-shift-workers__row-name font-apple text-[clamp(13px,1.2vw,20px)] font-medium text-sub-1">
                        {nurse.name}
                    </p>
                    <div className="make-shift-workers__row-level flex justify-center">
                        {/*
                         * SkillBadge 기본 사이즈(h-5, text-[14px], min-w-11)를 화면 폭에 맞춰 축소.
                         * twMerge가 마지막 클래스를 우선 적용해서 안전하게 override 됨.
                         */}
                        <SkillBadge
                            level={level}
                            config={skillConfig}
                            className="make-shift-workers__skill-badge h-[clamp(16px,1.4vw,20px)] min-w-[clamp(32px,3.2vw,44px)] text-[clamp(10px,0.9vw,14px)]"
                        />
                    </div>
                    <div className="make-shift-workers__row-shift-types flex items-center justify-center gap-[clamp(2px,0.2vw,4px)]">
                        {shiftCodes.length > 0 ? (
                            shiftCodes.map((code) => <ShiftTypeBadge key={`${nurse.nurseId}-${code}`} code={code} />)
                        ) : (
                            <span className="font-apple text-[clamp(10px,0.85vw,14px)] text-gray-4">-</span>
                        )}
                    </div>
                    <p className="make-shift-workers__row-memo text-center font-apple text-[clamp(13px,1.2vw,20px)] font-medium text-sub-1">
                        {memo || '-'}
                    </p>
                </div>
            )}
        </Draggable>
    );
}
