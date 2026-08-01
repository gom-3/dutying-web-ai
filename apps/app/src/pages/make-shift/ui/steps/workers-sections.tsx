import {Draggable, Droppable} from '@hello-pangea/dnd';
import {Check} from 'lucide-react';
import {type TNurse, type TNurseShiftType, type TWardShiftType} from '@/entities';
import {getMemoWithoutRoleMarkers, hasNursePrecepteeRole, hasNursePreceptorRole} from '@/pages/member/model/nurse-role';
import {type TGroupedDivisionNurses} from '@/pages/member/model/shift-team-list';
import {SixDotsIcon} from '@/shared/assets/svg';
import {useTypedTranslation} from '@/shared/hook/use-typed-translation';
import {Switch} from '@/shared/ui/primitives/switch';
import {formatNurseDisplayName} from './shared/format-nurse-display-name';

const FALLBACK_SHIFT_TYPE_STYLE: Record<string, {bg: string; text: string}> = {
    D: {bg: '#4dc2ad', text: '#ffffff'},
    E: {bg: '#ff8ba5', text: '#ffffff'},
    N: {bg: '#3580ff', text: '#ffffff'},
    O: {bg: '#465b7a', text: '#ffffff'},
};
const DEFAULT_SHIFT_TYPE_STYLE = {bg: '#939ba9', text: '#ffffff'};
const WORKERS_GRID_TEMPLATE_COLUMNS_WITHOUT_SKILL =
    'minmax(112px,0.72fr) minmax(168px,1.28fr) minmax(68px,0.42fr) minmax(68px,0.42fr) minmax(64px,0.38fr) minmax(88px,0.52fr)';
const WORKERS_GRID_GAP = 'gap-[clamp(6px,0.65vw,10px)]';
const WORKERS_ROW_PADDING_X = 'px-[clamp(10px,1vw,16px)]';
const WORKERS_NAME_TEXT_CLASS =
    'min-w-0 max-w-full overflow-hidden text-ellipsis py-px text-center font-apple text-[clamp(12px,1.05vw,16px)] leading-[1.35] font-normal whitespace-nowrap text-sub-1';
const WORKERS_MUTED_TEXT_CLASS = 'font-apple text-[clamp(10px,0.85vw,13px)] font-normal text-gray-4';
const MEMO_PREVIEW_LENGTH = 20;

type TShiftTypeBadge = {
    key: string;
    code: string;
    backgroundColor: string;
    textColor: string;
};

function normalizeShiftTypeKey(value: string | null | undefined) {
    return (value ?? '').trim().toUpperCase();
}

function getFirstShiftTypeCode(...values: Array<string | null | undefined>) {
    return values.map(normalizeShiftTypeKey).find((value) => value.length > 0) ?? '';
}

function setIfAbsent<T>(map: Map<string, T>, key: string, value: T) {
    if (!key || map.has(key)) return;

    map.set(key, value);
}

function findWardShiftType(nurseShiftType: TNurseShiftType, wardShiftTypes: TWardShiftType[] | undefined) {
    if (!wardShiftTypes?.length) return undefined;

    if (typeof nurseShiftType.wardShiftTypeId === 'number') {
        return wardShiftTypes.find((shiftType) => shiftType.wardShiftTypeId === nurseShiftType.wardShiftTypeId);
    }

    const byName = new Map<string, TWardShiftType>();
    const byShortName = new Map<string, TWardShiftType>();

    wardShiftTypes.forEach((shiftType) => {
        setIfAbsent(byName, normalizeShiftTypeKey(shiftType.name), shiftType);
        setIfAbsent(byShortName, normalizeShiftTypeKey(shiftType.shortName), shiftType);
    });

    return byName.get(normalizeShiftTypeKey(nurseShiftType.name)) ?? byShortName.get(normalizeShiftTypeKey(nurseShiftType.shortName));
}

export function buildShiftTypeBadges(nurse: TNurse, wardShiftTypes: TWardShiftType[] | undefined): TShiftTypeBadge[] {
    return nurse.nurseShiftTypes
        .filter((shift) => shift.isPossible)
        .map((shift) => {
            const wardShiftType = findWardShiftType(shift, wardShiftTypes);
            const code = getFirstShiftTypeCode(wardShiftType?.shortName, shift.shortName, shift.name);
            const fallbackStyle = FALLBACK_SHIFT_TYPE_STYLE[code] ?? DEFAULT_SHIFT_TYPE_STYLE;

            return {
                key:
                    typeof shift.wardShiftTypeId === 'number' ? `ward-${shift.wardShiftTypeId}` : `nurse-${shift.nurseShiftTypeId}-${code}`,
                code,
                backgroundColor: wardShiftType?.color ?? fallbackStyle.bg,
                textColor: fallbackStyle.text,
            };
        })
        .filter((badge) => badge.code.length > 0);
}

function ShiftTypeBadge({badge}: {badge: TShiftTypeBadge}) {
    const style = {bg: badge.backgroundColor, text: badge.textColor};

    return (
        <div
            className="make-shift-workers__shift-type-badge flex size-[clamp(16px,1.15vw,20px)] shrink-0 items-center justify-center rounded-[clamp(3px,0.35vw,5px)] font-apple text-[clamp(10px,0.78vw,13px)] font-medium"
            style={{backgroundColor: style.bg, color: style.text}}
        >
            {badge.code}
        </div>
    );
}

function RoleCheckIndicator({label}: {label: string}) {
    return (
        <span
            role="img"
            aria-label={label}
            title={label}
            className="inline-grid size-[clamp(17px,1.25vw,20px)] shrink-0 place-items-center rounded-full bg-[#F1EDFF] text-[#8B5CF6]"
        >
            <Check className="size-[clamp(9px,0.75vw,12px)] stroke-[3]" aria-hidden="true" />
        </span>
    );
}

function formatMemoPreview(memo: string) {
    return memo.length > MEMO_PREVIEW_LENGTH ? `${memo.slice(0, MEMO_PREVIEW_LENGTH)}...` : memo;
}

export function WorkersTableHeader() {
    const {t} = useTypedTranslation();

    return (
        <div
            className={`make-shift-workers__table-header grid h-7 items-center ${WORKERS_GRID_GAP} ${WORKERS_ROW_PADDING_X} font-apple text-[12px] font-semibold text-gray-4`}
            style={{gridTemplateColumns: WORKERS_GRID_TEMPLATE_COLUMNS_WITHOUT_SKILL}}
        >
            <p className="make-shift-workers__col-label make-shift-workers__col-label--name text-center">
                {t('page.makeShift.workers.column.name')}
            </p>
            <p className="make-shift-workers__col-label make-shift-workers__col-label--shift-types text-center">
                {t('page.makeShift.workers.column.shiftTypes')}
            </p>
            <p className="make-shift-workers__col-label make-shift-workers__col-label--preceptor text-center">
                {t('page.makeShift.workers.column.preceptor')}
            </p>
            <p className="make-shift-workers__col-label make-shift-workers__col-label--preceptee text-center">
                {t('page.makeShift.workers.column.preceptee')}
            </p>
            <p className="make-shift-workers__col-label make-shift-workers__col-label--is-worker text-center">
                {t('page.makeShift.workers.column.isWorker')}
            </p>
            <p className="make-shift-workers__col-label make-shift-workers__col-label--memo text-center">
                {t('page.makeShift.workers.column.memo')}
            </p>
        </div>
    );
}

type TWorkersListProps = {
    grouped: TGroupedDivisionNurses;
    shiftTeamId: number;
    wardShiftTypes: TWardShiftType[] | undefined;
    isBusy: boolean;
    getWorkerState: (nurse: TNurse) => boolean;
    onToggleWorker: (nurse: TNurse, checked: boolean) => void;
    setRowRef: (nurseId: number, element: HTMLDivElement | null) => void;
};

export function WorkersList({
    grouped,
    shiftTeamId,
    wardShiftTypes,
    isBusy,
    getWorkerState,
    onToggleWorker,
    setRowRef,
}: TWorkersListProps) {
    return (
        <div className="make-shift-workers__list-wrapper mt-1.5 flex flex-col gap-2">
            {grouped.map(([division, divisionWorkers]) => (
                <div key={`${shiftTeamId},${division}`} className="make-shift-workers__division-block">
                    <Droppable droppableId={`${shiftTeamId},${division}`}>
                        {(provided) => (
                            <div
                                ref={provided.innerRef}
                                {...provided.droppableProps}
                                className="make-shift-workers__list flex flex-col gap-1"
                            >
                                {divisionWorkers.map((nurse, index) => (
                                    <WorkerRow
                                        key={nurse.nurseId}
                                        nurse={nurse}
                                        index={index}
                                        wardShiftTypes={wardShiftTypes}
                                        isWorker={getWorkerState(nurse)}
                                        isBusy={isBusy}
                                        onToggleWorker={onToggleWorker}
                                        setRowRef={setRowRef}
                                    />
                                ))}
                                {provided.placeholder}
                            </div>
                        )}
                    </Droppable>
                </div>
            ))}
        </div>
    );
}

type TWorkerRowProps = {
    nurse: TNurse;
    index: number;
    wardShiftTypes: TWardShiftType[] | undefined;
    isWorker: boolean;
    isBusy: boolean;
    onToggleWorker: (nurse: TNurse, checked: boolean) => void;
    setRowRef: (nurseId: number, element: HTMLDivElement | null) => void;
};

function WorkerRow({
    nurse,
    index,
    wardShiftTypes,
    isWorker,
    isBusy,
    onToggleWorker,
    setRowRef,
}: TWorkerRowProps) {
    const {t} = useTypedTranslation();
    const shiftTypeBadges = buildShiftTypeBadges(nurse, wardShiftTypes);
    const isPreceptor = hasNursePreceptorRole(nurse);
    const isPreceptee = hasNursePrecepteeRole(nurse);
    const memo = getMemoWithoutRoleMarkers(nurse.memo).trim();
    const memoPreview = memo ? formatMemoPreview(memo) : '';
    const fadedRowClass = isWorker ? '' : 'opacity-55';
    return (
        <Draggable draggableId={String(nurse.nurseId)} index={index} isDragDisabled={!isWorker}>
            {(dragProvided, dragSnapshot) => {
                const {style: dragStyle, ...draggableProps} = dragProvided.draggableProps;

                return (
                    <div
                        ref={(element) => {
                            dragProvided.innerRef(element);
                            setRowRef(nurse.nurseId, element);
                        }}
                        {...draggableProps}
                        className={`make-shift-workers__row grid min-h-10 items-center rounded-[12px] bg-white ${WORKERS_GRID_GAP} ${WORKERS_ROW_PADDING_X} transition-colors hover:bg-[#FBFDFF] ${fadedRowClass} ${
                            dragSnapshot.isDragging ? 'opacity-95' : ''
                        }`}
                        style={{
                            ...(dragStyle ?? {}),
                            gridTemplateColumns: WORKERS_GRID_TEMPLATE_COLUMNS_WITHOUT_SKILL,
                        }}
                    >
                        <div className="make-shift-workers__row-name relative flex min-w-0 items-center justify-center px-7">
                            <button
                                type="button"
                                aria-label={t('page.makeShift.workers.dragHandleAria')}
                                disabled={!isWorker}
                                className={`make-shift-workers__row-drag-handle absolute left-0 grid size-7 shrink-0 place-items-center rounded-[8px] text-gray-4 transition-colors hover:bg-gray-7 hover:text-sub-2 focus-visible:ring-2 focus-visible:ring-main-1/25 focus-visible:outline-none disabled:cursor-not-allowed ${
                                    isWorker ? 'cursor-grab active:cursor-grabbing' : ''
                                }`}
                                {...dragProvided.dragHandleProps}
                            >
                                <SixDotsIcon className="size-[clamp(13px,1.1vw,16px)]" />
                            </button>
                            <p className={WORKERS_NAME_TEXT_CLASS} title={nurse.name}>
                                {formatNurseDisplayName(nurse.name)}
                            </p>
                        </div>
                        <div className="make-shift-workers__row-shift-types flex items-center justify-center gap-[clamp(2px,0.24vw,4px)]">
                            {shiftTypeBadges.length > 0 ? (
                                shiftTypeBadges.map((badge) => <ShiftTypeBadge key={badge.key} badge={badge} />)
                            ) : (
                                <span className={WORKERS_MUTED_TEXT_CLASS}>-</span>
                            )}
                        </div>
                        <div className="make-shift-workers__row-preceptor flex items-center justify-center">
                            {isPreceptor ? (
                                <RoleCheckIndicator label={t('page.makeShift.workers.column.preceptor')} />
                            ) : (
                                <span className={WORKERS_MUTED_TEXT_CLASS}>-</span>
                            )}
                        </div>
                        <div className="make-shift-workers__row-preceptee flex items-center justify-center">
                            {isPreceptee ? (
                                <RoleCheckIndicator label={t('page.makeShift.workers.column.preceptee')} />
                            ) : (
                                <span className={WORKERS_MUTED_TEXT_CLASS}>-</span>
                            )}
                        </div>
                        <div className="make-shift-workers__row-is-worker flex justify-center">
                            <Switch
                                checked={isWorker}
                                disabled={isBusy}
                                onClick={(event) => {
                                    event.stopPropagation();
                                }}
                                onCheckedChange={(checked) => onToggleWorker(nurse, checked)}
                                className="relative h-5 w-9 justify-start border-0 bg-sub-4 p-0 shadow-none data-[state=checked]:bg-main-1 data-[state=unchecked]:bg-sub-4"
                                thumbClassName="absolute top-0.5 left-0.5 h-4 w-4 translate-x-0 bg-white shadow-sm data-[state=checked]:translate-x-4"
                                aria-label={`${nurse.name} ${t('page.makeShift.workers.column.isWorker')}`}
                            />
                        </div>
                        <div className="make-shift-workers__row-memo flex min-w-0 items-center justify-center">
                            {memo ? (
                                <p
                                    className="min-w-0 truncate text-center font-apple text-[clamp(11px,0.95vw,14px)] font-normal text-sub-2"
                                    title={memo}
                                >
                                    {memoPreview}
                                </p>
                            ) : (
                                <span className={WORKERS_MUTED_TEXT_CLASS}>-</span>
                            )}
                        </div>
                    </div>
                );
            }}
        </Draggable>
    );
}
