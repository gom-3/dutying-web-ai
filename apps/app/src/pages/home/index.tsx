import {cn} from '@dutying/utils/style';
import {useQueries, useQuery} from '@tanstack/react-query';
import {ChevronDown} from 'lucide-react';
import {type ReactNode, useEffect, useMemo, useRef, useState} from 'react';
import {useNavigate} from 'react-router';
import {type TShift, type TShiftTeam, type TWardShiftClassification, type TWardShiftType} from '@/entities';
import ShiftBadge from '@/entities/shift/ui/shift-badge';
import {wardQueryOptions} from '@/entities/ward/model/queries';
import useAuth from '@/features/auth';
import {isDutyShiftFullyAssigned, isDutyShiftWithoutAssignments} from '@/features/shift-editor';
import {BoardAPI, WardAPI} from '@/shared/api';
import {type TWardBoardDeadline} from '@/shared/api/board';
import {isWardChatEnabled} from '@/shared/config/feature-flags';
import ROUTE from '@/shared/constant/path';
import {getShiftWorkflowStatus} from '@/shared/lib/shift-workflow-status';
import PageState from '@/shared/ui/PageState';

const DAY_MS = 24 * 60 * 60 * 1000;
const TASK_LOOKAHEAD_DAYS = 7;
const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];
const SHIFT_CLASSIFICATION_ORDER: Partial<Record<TWardShiftClassification, number>> = {
    DAY: 10,
    EVENING: 20,
    NIGHT: 30,
    OFF: 80,
    OTHER_LEAVE: 90,
};

type TScheduleStatus = 'checking' | 'error' | 'empty' | 'draft' | 'complete';
type TTaskTone = 'danger' | 'warning' | 'info' | 'quiet';
type TMonthlyTeamFilter = number | 'all';
type TMonthlySortOption = 'default' | 'nameAsc' | 'todayShift';

type TScheduleStatusItem = {
    team: TShiftTeam;
    status: TScheduleStatus;
    shift: TShift | null;
};

type TTodayShiftGroup = {
    key: string;
    label: string;
    color: string;
    shiftType: TWardShiftType | null;
    names: string[];
    order: number;
};

type TTodayTeamDuty = {
    teamId: number;
    teamName: string;
    workerCount: number;
    assignedCount: number;
    unassignedNames: string[];
    status: TScheduleStatus;
    actionPath: string;
    groups: TTodayShiftGroup[];
};

type TTaskItem = {
    key: string;
    tone: TTaskTone;
    title: string;
    description: string;
    actionLabel: string;
    path: string;
};

type TMonthlyShiftCell = {
    day: number;
    weekday: string;
    isToday: boolean;
    shiftType: TWardShiftType | null;
};

type TMonthlyShiftRow = {
    teamId: number;
    teamName: string;
    shiftNurseId: number;
    nurseName: string;
    sourceIndex: number;
    cells: TMonthlyShiftCell[];
};

const MONTHLY_SORT_OPTIONS: {value: TMonthlySortOption; label: string}[] = [
    {value: 'default', label: '기본'},
    {value: 'nameAsc', label: '이름순'},
    {value: 'todayShift', label: '오늘 근무순'},
];

const pad2 = (value: number) => String(value).padStart(2, '0');
const toDateKey = (date: Date) => `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
const parseDateKey = (dateKey: string) => {
    const [year, month, day] = dateKey.split('-').map(Number);

    return new Date(year, (month || 1) - 1, day || 1);
};
const getNextYearMonth = (year: number, month: number) => (month === 12 ? {year: year + 1, month: 1} : {year, month: month + 1});
const getMonthStartKey = (year: number, month: number) => toDateKey(new Date(year, month - 1, 1));
const getMonthEndKey = (year: number, month: number) => toDateKey(new Date(year, month, 0));
const formatMonth = (year: number, month: number) => `${year}년 ${month}월`;
const formatDateWithWeekday = (date: Date) => `${date.getMonth() + 1}월 ${date.getDate()}일 ${WEEKDAYS[date.getDay()]}요일`;
const getDayDiff = (dateKey: string, todayKey: string) =>
    Math.round((parseDateKey(dateKey).getTime() - parseDateKey(todayKey).getTime()) / DAY_MS);
const getShiftTeamNameList = (teams: TShiftTeam[]) => teams.map((team) => team.name).join(', ');
const buildMakePath = ({year, month, shiftTeamId}: {year: number; month: number; shiftTeamId?: number}) => {
    const params = new URLSearchParams({year: String(year), month: String(month)});

    if (shiftTeamId) {
        params.set('shiftTeamId', String(shiftTeamId));
    }

    return `${ROUTE.MAKE}?${params.toString()}`;
};

const getDeadlineBuckets = (deadlines: TWardBoardDeadline[], todayKey: string) => ({
    overdue: deadlines.filter((deadline) => getDayDiff(deadline.deadlineDate, todayKey) < 0),
    today: deadlines.filter((deadline) => getDayDiff(deadline.deadlineDate, todayKey) === 0),
    soon: deadlines.filter((deadline) => {
        const diff = getDayDiff(deadline.deadlineDate, todayKey);

        return diff > 0 && diff <= TASK_LOOKAHEAD_DAYS;
    }),
});

const hasDutyShiftWorkerRows = (shift: TShift) =>
    Boolean(shift.days?.length) && (shift.divisionShiftNurses ?? []).some((division) => division.some((row) => row.shiftNurse.isWorker));

const getScheduleStatus = (
    query: {isPending: boolean; isError: boolean; data?: TShift},
    options: {emptyAssignmentsAsDraft?: boolean} = {},
): {status: TScheduleStatus; shift: TShift | null} => {
    if (query.isPending) return {status: 'checking', shift: null};
    if (query.isError || !query.data) return {status: 'error', shift: null};
    const workflowStatus = getShiftWorkflowStatus(query.data);

    if (workflowStatus === 'NOT_STARTED') return {status: 'empty', shift: query.data};
    if (workflowStatus === 'IN_PROGRESS') return {status: 'draft', shift: query.data};
    if (workflowStatus === 'CONFIRMED') return {status: 'complete', shift: query.data};

    if (isDutyShiftFullyAssigned(query.data)) return {status: 'complete', shift: query.data};
    if (isDutyShiftWithoutAssignments(query.data)) {
        return {
            status: options.emptyAssignmentsAsDraft && hasDutyShiftWorkerRows(query.data) ? 'draft' : 'empty',
            shift: query.data,
        };
    }

    return {status: 'draft', shift: query.data};
};

const getScheduleStatusLabel = (status: TScheduleStatus) => {
    if (status === 'checking') return '확인 중';
    if (status === 'error') return '다시 확인';
    if (status === 'empty') return '작성 전';
    if (status === 'draft') return '진행 중';

    return '확정';
};

const getScheduleStatusClassName = (status: TScheduleStatus) =>
    cn(
        'inline-flex h-7 items-center rounded-[8px] px-2.5 text-[12px] font-semibold',
        status === 'complete'
            ? 'bg-[#EAF6EE] text-[#1E7A43]'
            : status === 'draft'
              ? 'bg-[#EDF3FF] text-[#2457B7]'
              : status === 'empty'
                ? 'bg-[#FFE8E8] font-bold text-[#C74343]'
                : status === 'error'
                  ? 'bg-[#FFF0F0] text-[#C74343]'
                  : 'bg-[#F1F3F5] text-gray-3',
    );

const getTaskToneClassName = (tone: TTaskTone) =>
    cn(
        tone === 'danger'
            ? 'bg-[#FFF0F0] text-[#C74343]'
            : tone === 'warning'
              ? 'bg-[#FFF6E8] text-[#A35F00]'
              : tone === 'info'
                ? 'bg-[#EDF3FF] text-[#2457B7]'
                : 'bg-[#F1F3F5] text-gray-3',
    );

const getTodayTeamDuty = (item: TScheduleStatusItem, todayDay: number, actionPath: string): TTodayTeamDuty => {
    const baseDuty: TTodayTeamDuty = {
        teamId: item.team.shiftTeamId,
        teamName: item.team.name,
        workerCount: item.team.nurseCnt,
        assignedCount: 0,
        unassignedNames: [],
        status: item.status,
        actionPath,
        groups: [],
    };

    if (!item.shift || isDutyShiftWithoutAssignments(item.shift)) {
        return baseDuty;
    }

    const dayIndex = item.shift.days.findIndex((day) => day.day === todayDay);

    if (dayIndex < 0) {
        return baseDuty;
    }

    const groupsByShiftTypeId = new Map<number, TTodayShiftGroup>();

    item.shift.wardShiftTypes.forEach((shiftType, index) => {
        groupsByShiftTypeId.set(shiftType.wardShiftTypeId, {
            key: String(shiftType.wardShiftTypeId),
            label: shiftType.shortName || shiftType.name,
            color: shiftType.color || '#8A8F98',
            shiftType,
            names: [],
            order: SHIFT_CLASSIFICATION_ORDER[shiftType.classification] ?? 50 + index,
        });
    });

    for (const division of item.shift.divisionShiftNurses ?? []) {
        for (const row of division) {
            if (!row.shiftNurse.isWorker) continue;

            const shiftTypeId = row.wardShiftList?.[dayIndex] ?? null;

            if (shiftTypeId === null) {
                baseDuty.unassignedNames.push(row.shiftNurse.name);
                continue;
            }

            const group = groupsByShiftTypeId.get(shiftTypeId);

            if (!group) {
                baseDuty.unassignedNames.push(row.shiftNurse.name);
                continue;
            }

            group.names.push(row.shiftNurse.name);
            baseDuty.assignedCount += 1;
        }
    }

    return {
        ...baseDuty,
        groups: Array.from(groupsByShiftTypeId.values()).sort((left, right) => left.order - right.order),
    };
};

const getShiftTypeSortOrder = (shiftType: TWardShiftType | null) =>
    shiftType ? (SHIFT_CLASSIFICATION_ORDER[shiftType.classification] ?? 50) : 999;

const getMonthlyShiftRows = (item: TScheduleStatusItem, todayKey: string, year: number, month: number): TMonthlyShiftRow[] => {
    const shift = item.shift;

    if (!shift || isDutyShiftWithoutAssignments(shift)) return [];

    const shiftTypeById = new Map(shift.wardShiftTypes.map((shiftType) => [shiftType.wardShiftTypeId, shiftType]));

    return (shift.divisionShiftNurses ?? [])
        .flatMap((division) => division)
        .filter((row) => row.shiftNurse.isWorker)
        .map((row, sourceIndex) => ({
            teamId: item.team.shiftTeamId,
            teamName: item.team.name,
            shiftNurseId: row.shiftNurse.shiftNurseId,
            nurseName: row.shiftNurse.name,
            sourceIndex,
            cells: shift.days.map((day, index) => {
                const date = new Date(year, month - 1, day.day);
                const shiftTypeId = row.wardShiftList?.[index] ?? null;

                return {
                    day: day.day,
                    weekday: WEEKDAYS[date.getDay()],
                    isToday: toDateKey(date) === todayKey,
                    shiftType: shiftTypeId === null ? null : shiftTypeById.get(shiftTypeId) ?? null,
                };
            }),
        }));
};

const sortMonthlyShiftRows = (rows: TMonthlyShiftRow[], sortOption: TMonthlySortOption) => {
    const sortedRows = [...rows];

    if (sortOption === 'nameAsc') {
        return sortedRows.sort(
            (left, right) => left.nurseName.localeCompare(right.nurseName, 'ko-KR') || left.teamName.localeCompare(right.teamName, 'ko-KR'),
        );
    }

    if (sortOption === 'todayShift') {
        return sortedRows.sort((left, right) => {
            const leftToday = left.cells.find((cell) => cell.isToday)?.shiftType ?? null;
            const rightToday = right.cells.find((cell) => cell.isToday)?.shiftType ?? null;

            return (
                getShiftTypeSortOrder(leftToday) - getShiftTypeSortOrder(rightToday) ||
                left.teamName.localeCompare(right.teamName, 'ko-KR') ||
                left.nurseName.localeCompare(right.nurseName, 'ko-KR')
            );
        });
    }

    return sortedRows;
};

function HomeButton({children, variant = 'primary', onClick}: {children: ReactNode; variant?: 'primary' | 'plain'; onClick: () => void}) {
    return (
        <button
            type="button"
            className={cn(
                'inline-flex h-10 shrink-0 cursor-pointer items-center justify-center rounded-[8px] px-4 font-apple text-[14px] font-semibold transition active:scale-[0.99] focus-visible:bg-main-light focus-visible:outline-none',
                variant === 'primary' ? 'bg-sub-1 text-white hover:bg-[#35363C]' : 'bg-[#F1F3F5] text-sub-1 hover:bg-[#E9ECEF]',
            )}
            onClick={onClick}
        >
            {children}
        </button>
    );
}

function SectionShell({
    title,
    description,
    action,
    children,
    className,
}: {
    title: string;
    description?: string;
    action?: ReactNode;
    children: ReactNode;
    className?: string;
}) {
    return (
        <section className={cn('min-w-0 rounded-[8px] bg-white p-5', className)}>
            <div className="flex min-w-0 items-start justify-between gap-4">
                <div className="min-w-0">
                    <h2 className="truncate font-apple text-[20px] leading-7 font-bold text-sub-1">{title}</h2>
                    {description ? <p className="mt-1 text-[13px] leading-5 text-gray-3">{description}</p> : null}
                </div>
                {action ? <div className="shrink-0">{action}</div> : null}
            </div>
            <div className="mt-5 min-w-0">{children}</div>
        </section>
    );
}

function TeamFilter({
    teams,
    selectedTeamId,
    onSelectTeam,
}: {
    teams: TShiftTeam[];
    selectedTeamId: number | 'all';
    onSelectTeam: (teamId: number | 'all') => void;
}) {
    return (
        <div className="flex min-w-0 flex-wrap gap-2">
            <button
                type="button"
                className={cn(
                    'h-9 cursor-pointer rounded-[8px] px-3 text-[13px] font-bold transition focus-visible:bg-main-light focus-visible:outline-none',
                    selectedTeamId === 'all' ? 'bg-sub-1 text-white' : 'bg-[#F1F3F5] text-gray-3 hover:bg-[#E9ECEF] hover:text-sub-1',
                )}
                onClick={() => onSelectTeam('all')}
            >
                전체
            </button>
            {teams.map((team) => (
                <button
                    key={team.shiftTeamId}
                    type="button"
                    className={cn(
                        'h-9 cursor-pointer rounded-[8px] px-3 text-[13px] font-bold transition focus-visible:bg-main-light focus-visible:outline-none',
                        selectedTeamId === team.shiftTeamId
                            ? 'bg-sub-1 text-white'
                            : 'bg-[#F1F3F5] text-gray-3 hover:bg-[#E9ECEF] hover:text-sub-1',
                    )}
                    onClick={() => onSelectTeam(team.shiftTeamId)}
                >
                    {team.name}
                </button>
            ))}
        </div>
    );
}

function ScheduleTeamTabs({
    teams,
    selectedTeamId,
    onSelectTeam,
}: {
    teams: TShiftTeam[];
    selectedTeamId: TMonthlyTeamFilter;
    onSelectTeam: (teamId: TMonthlyTeamFilter) => void;
}) {
    return (
        <div className="flex min-w-0 flex-wrap gap-2">
            <button
                type="button"
                className={cn(
                    'h-9 cursor-pointer rounded-[8px] px-3 text-[13px] font-bold transition focus-visible:bg-main-light focus-visible:outline-none',
                    selectedTeamId === 'all' ? 'bg-sub-1 text-white' : 'bg-[#F1F3F5] text-gray-3 hover:bg-[#E9ECEF] hover:text-sub-1',
                )}
                onClick={() => onSelectTeam('all')}
            >
                전체
            </button>
            {teams.map((team) => (
                <button
                    key={team.shiftTeamId}
                    type="button"
                    className={cn(
                        'h-9 cursor-pointer rounded-[8px] px-3 text-[13px] font-bold transition focus-visible:bg-main-light focus-visible:outline-none',
                        selectedTeamId === team.shiftTeamId
                            ? 'bg-sub-1 text-white'
                            : 'bg-[#F1F3F5] text-gray-3 hover:bg-[#E9ECEF] hover:text-sub-1',
                    )}
                    onClick={() => onSelectTeam(team.shiftTeamId)}
                >
                    {team.name}
                </button>
            ))}
        </div>
    );
}

function MonthlySortSelect({
    value,
    onChange,
}: {
    value: TMonthlySortOption;
    onChange: (value: TMonthlySortOption) => void;
}) {
    const [isOpen, setIsOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement | null>(null);
    const selectedOption = MONTHLY_SORT_OPTIONS.find((option) => option.value === value) ?? MONTHLY_SORT_OPTIONS[0];

    useEffect(() => {
        if (!isOpen) return;

        const closeOnOutsideClick = (event: MouseEvent) => {
            if (!menuRef.current?.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        const closeOnEscape = (event: globalThis.KeyboardEvent) => {
            if (event.key === 'Escape') {
                setIsOpen(false);
            }
        };

        document.addEventListener('mousedown', closeOnOutsideClick);
        document.addEventListener('keydown', closeOnEscape);

        return () => {
            document.removeEventListener('mousedown', closeOnOutsideClick);
            document.removeEventListener('keydown', closeOnEscape);
        };
    }, [isOpen]);

    return (
        <div ref={menuRef} className="relative shrink-0">
            <button
                type="button"
                aria-haspopup="listbox"
                aria-expanded={isOpen}
                aria-label="근무표 정렬 기준 열기"
                className={cn(
                    'flex h-8 min-w-[112px] items-center justify-between gap-3 rounded-[5px] bg-gray-6 px-3 font-apple text-[16px] text-gray-3 transition-colors focus-visible:outline-2 focus-visible:outline-main-1',
                    isOpen ? 'bg-white text-sub-1 shadow-[0px_10px_28px_rgba(95,100,135,0.16)]' : 'hover:bg-gray-7',
                )}
                onClick={() => setIsOpen((prev) => !prev)}
            >
                <span>{selectedOption.label}</span>
                <ChevronDown aria-hidden="true" className={cn('h-4 w-4 shrink-0 transition-transform', isOpen && 'rotate-180')} />
            </button>
            {isOpen ? (
                <div
                    role="listbox"
                    aria-label="근무표 정렬 기준"
                    className="absolute top-full right-0 z-20 mt-1 w-[150px] animate-in overflow-hidden rounded-[10px] border border-gray-6 bg-white py-1 shadow-[0px_10px_28px_rgba(95,100,135,0.16)] duration-150 fade-in-0 zoom-in-95 slide-in-from-top-1"
                >
                    {MONTHLY_SORT_OPTIONS.map((option) => {
                        const isSelected = option.value === value;

                        return (
                            <button
                                key={option.value}
                                type="button"
                                role="option"
                                aria-selected={isSelected}
                                className={cn(
                                    'flex w-full items-center px-4 py-2.5 text-left font-apple text-[15px] transition-colors hover:bg-gray-7 focus-visible:outline-2 focus-visible:outline-main-1',
                                    isSelected ? 'bg-main-light font-semibold text-main-1' : 'text-sub-1',
                                )}
                                onClick={() => {
                                    onChange(option.value);
                                    setIsOpen(false);
                                }}
                            >
                                {option.label}
                            </button>
                        );
                    })}
                </div>
            ) : null}
        </div>
    );
}

function TodayShiftLine({group}: {group: TTodayShiftGroup}) {
    const shiftName = group.shiftType?.name ?? group.label;

    return (
        <div className="min-w-0 rounded-[8px] bg-white px-2.5 py-2">
            <div className="flex min-w-0 items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2">
                    <ShiftBadge shiftType={group.shiftType} className="!size-7 !rounded-[7px] !text-[13px]" />
                    <p className="min-w-0 truncate text-[13px] leading-4 font-bold text-sub-1">{shiftName}</p>
                </div>
                <span className="shrink-0 text-[11px] font-bold text-gray-4">{group.names.length}명</span>
            </div>
            <div className="mt-2 flex min-w-0 flex-wrap gap-1">
                {group.names.map((name) => (
                    <span
                        key={`${group.key}-${name}`}
                        className="inline-flex h-6 max-w-[84px] min-w-0 items-center truncate rounded-[7px] bg-[#F6F7F9] px-2 text-[12px] font-bold text-sub-2"
                        title={name}
                    >
                        {name}
                    </span>
                ))}
            </div>
        </div>
    );
}

function TodayTeamDutyLine({duty}: {duty: TTodayTeamDuty}) {
    const filledGroups = duty.groups.filter((group) => group.names.length > 0);
    const hasSchedule = duty.status !== 'empty' && duty.status !== 'error' && duty.status !== 'checking';

    return (
        <article className="grid min-w-0 grid-cols-[108px_minmax(0,1fr)] gap-2 rounded-[8px] bg-[#F6F7F9] p-2.5">
            <div className="flex min-w-0 flex-col justify-center px-1.5 py-1">
                <h3 className="truncate text-[16px] leading-5 font-bold text-sub-1">{duty.teamName}</h3>
                <p className="mt-1 text-[12px] leading-4 font-bold text-gray-3">오늘 {duty.assignedCount}명</p>
            </div>
            {hasSchedule && filledGroups.length > 0 ? (
                <div className="grid min-w-0 grid-cols-[repeat(auto-fit,minmax(152px,1fr))] gap-1.5">
                    {filledGroups.map((group) => (
                        <TodayShiftLine key={group.key} group={group} />
                    ))}
                </div>
            ) : (
                <div className="flex min-h-[72px] items-center justify-center rounded-[8px] bg-white px-4 text-center">
                    <p className="text-[14px] font-bold text-gray-3">오늘 근무가 비어 있어요</p>
                </div>
            )}
        </article>
    );
}

function TodayDutyOverview({duties}: {duties: TTodayTeamDuty[]}) {
    if (duties.length === 0) {
        return (
            <div className="flex min-h-[180px] flex-col items-center justify-center rounded-[8px] bg-[#F6F7F9] px-5 text-center">
                <p className="text-[15px] font-bold text-sub-1">팀을 추가하면 볼 수 있어요</p>
                <p className="mt-1 text-[13px] font-semibold text-gray-3">근무자 관리에서 간호 팀을 추가해요.</p>
            </div>
        );
    }

    return (
        <div className="grid gap-3">
            {duties.map((duty) => (
                <TodayTeamDutyLine key={duty.teamId} duty={duty} />
            ))}
        </div>
    );
}

function QueueButton({label, value, onClick}: {label: string; value: number; onClick: () => void}) {
    return (
        <button
            type="button"
            className="flex min-h-[68px] cursor-pointer flex-col justify-between rounded-[8px] bg-[#F6F7F9] p-3 text-left transition hover:bg-[#ECEFF3] focus-visible:bg-main-light focus-visible:outline-none"
            onClick={onClick}
        >
            <span className="text-[12px] font-bold text-gray-3">{label}</span>
            <span className="font-poppins text-[24px] leading-none font-bold text-sub-1">{value}</span>
        </button>
    );
}

function TaskRow({task, onNavigate}: {task: TTaskItem; onNavigate: (path: string) => void}) {
    return (
        <button
            type="button"
            className="w-full cursor-pointer rounded-[8px] bg-[#F6F7F9] p-3 text-left transition hover:bg-[#ECEFF3] focus-visible:bg-main-light focus-visible:outline-none"
            onClick={() => onNavigate(task.path)}
        >
            <div className="flex min-w-0 items-start justify-between gap-3">
                <span className={cn('shrink-0 rounded-[8px] px-2 py-1 text-[11px] font-bold', getTaskToneClassName(task.tone))}>{task.actionLabel}</span>
                <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14px] font-bold text-sub-1">{task.title}</span>
                    <span className="mt-1 block truncate text-[12px] font-semibold text-gray-3">{task.description}</span>
                </span>
            </div>
        </button>
    );
}

function MonthlyScheduleTable({
    rows,
    hasTeams,
    showTeamName,
    emptyTitle,
    emptyDescription,
    onOpen,
}: {
    rows: TMonthlyShiftRow[];
    hasTeams: boolean;
    showTeamName: boolean;
    emptyTitle: string;
    emptyDescription: string;
    onOpen: () => void;
}) {
    const days = rows[0]?.cells ?? [];
    const dayGridTemplateColumns = `repeat(${days.length}, minmax(0, 1fr))`;
    const gridTemplateColumns = showTeamName ? '96px minmax(0, 1fr)' : '76px minmax(0, 1fr)';

    if (!hasTeams) {
        return (
            <div className="flex min-h-[220px] flex-col items-center justify-center rounded-[8px] bg-[#F6F7F9] px-5 text-center">
                <p className="text-[15px] font-bold text-sub-1">팀을 추가하면 근무표를 볼 수 있어요</p>
                <p className="mt-1 text-[13px] font-semibold text-gray-3">근무자 관리에서 간호 팀을 추가해요.</p>
            </div>
        );
    }

    if (rows.length === 0) {
        return (
            <button
                type="button"
                className="flex min-h-[220px] w-full cursor-pointer flex-col items-center justify-center rounded-[8px] bg-[#F6F7F9] px-5 text-center transition hover:bg-[#ECEFF3] focus-visible:bg-main-light focus-visible:outline-none"
                onClick={onOpen}
            >
                <span className="text-[16px] font-bold text-sub-1">{emptyTitle}</span>
                <span className="mt-1 text-[13px] font-semibold text-gray-3">{emptyDescription}</span>
            </button>
        );
    }

    return (
        <div className="make-shift-calendar @container relative isolate flex w-full min-w-0 flex-col gap-2">
            <div className="make-shift-calendar__header grid min-w-0 items-center py-1" style={{gridTemplateColumns, columnGap: '8px', paddingLeft: '4px'}}>
                <div className="min-w-0 truncate text-center font-apple text-[12px] font-medium text-sub-3">이름</div>
                <div
                    className="make-shift-calendar__day-header-pill grid min-w-0 rounded-[12px] bg-gray-7 px-0 py-1"
                    style={{gridTemplateColumns: dayGridTemplateColumns}}
                >
                    {days.map((cell) => (
                        <div
                            key={cell.day}
                            className={cn(
                                'relative min-w-0 rounded-full text-center font-poppins text-[12px] leading-5 font-semibold tabular-nums',
                                cell.weekday === '토' ? 'text-blue' : cell.weekday === '일' ? 'text-red' : 'text-sub-3',
                                cell.isToday && 'bg-main-1 text-white',
                            )}
                            title={`${cell.day}일 ${cell.weekday}요일`}
                        >
                            {cell.day}
                        </div>
                    ))}
                </div>
            </div>

            <div className="make-shift-calendar__division-card relative flex min-w-0 flex-1 flex-col overflow-hidden rounded-l-[16px] bg-white">
                {rows.map((row) => (
                    <div
                        key={`${row.teamId}-${row.shiftNurseId}`}
                        className={cn('make-shift-calendar__row grid w-full min-w-0 items-stretch', showTeamName ? 'h-[44px]' : 'h-[36px]')}
                        style={{gridTemplateColumns, columnGap: '8px', paddingLeft: '4px'}}
                    >
                        <div
                            className="make-shift-calendar__row-name flex min-h-0 min-w-0 flex-col items-center justify-center truncate rounded-[8px] text-center font-apple leading-none whitespace-nowrap text-sub-1"
                            title={showTeamName ? `${row.teamName} ${row.nurseName}` : row.nurseName}
                        >
                            <span className="block max-w-full truncate text-[13px]">{row.nurseName}</span>
                            {showTeamName ? <span className="mt-1 block max-w-full truncate text-[10px] font-bold text-gray-4">{row.teamName}</span> : null}
                        </div>
                        <div className="make-shift-calendar__row-days grid h-full min-w-0 items-stretch px-0" style={{gridTemplateColumns: dayGridTemplateColumns}}>
                            {row.cells.map((cell) => (
                                <div
                                    key={`${row.shiftNurseId}-${cell.day}`}
                                    className={cn(
                                        'make-shift-calendar__day-cell group relative z-[10] flex h-full min-w-0 items-center justify-center',
                                        cell.weekday === '토' ? 'bg-blue/5' : cell.weekday === '일' ? 'bg-red/5' : '',
                                        cell.isToday && 'bg-main-light',
                                    )}
                                    title={`${row.nurseName} ${cell.day}일 ${cell.shiftType?.shortName ?? '-'}`}
                                >
                                    <span className="make-shift-calendar__shift-badge-wrap relative z-[20] flex size-[24px] min-w-0 shrink-0 items-center justify-center">
                                        <ShiftBadge
                                            shiftType={cell.shiftType}
                                            className="make-shift-calendar__shift-badge relative z-[20] !h-full !w-full min-h-0 min-w-0 rounded-[.375rem] text-[12px] leading-none"
                                        />
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

function HomePage() {
    const navigate = useNavigate();
    const {
        state: {wardId, accountMe},
    } = useAuth();
    const [selectedTodayTeamId, setSelectedTodayTeamId] = useState<number | 'all'>('all');
    const [selectedMonthlyTeamId, setSelectedMonthlyTeamId] = useState<TMonthlyTeamFilter>('all');
    const [monthlySortOption, setMonthlySortOption] = useState<TMonthlySortOption>('default');
    const today = useMemo(() => new Date(), []);
    const todayKey = toDateKey(today);
    const currentYearMonth = {year: today.getFullYear(), month: today.getMonth() + 1};
    const nextYearMonth = getNextYearMonth(currentYearMonth.year, currentYearMonth.month);
    const monthStartKey = getMonthStartKey(currentYearMonth.year, currentYearMonth.month);
    const monthEndKey = getMonthEndKey(currentYearMonth.year, currentYearMonth.month);
    const isChatEnabled = isWardChatEnabled();
    const wardQuery = useQuery({
        ...wardQueryOptions.id(wardId ?? -1),
        enabled: wardId !== null,
        staleTime: 1000 * 60 * 5,
    });
    const shiftTeamsQuery = useQuery({
        ...wardQueryOptions.shiftTeams(wardId ?? -1),
        enabled: wardId !== null,
        staleTime: 1000 * 60 * 5,
    });
    const waitingNursesQuery = useQuery({
        ...wardQueryOptions.waitingNurses(wardId ?? -1),
        enabled: wardId !== null,
    });
    const pendingRequestsQuery = useQuery({
        ...wardQueryOptions.requestPendingCount(wardId ?? -1),
        enabled: wardId !== null,
        staleTime: 30_000,
    });
    const chatUnreadQuery = useQuery({
        queryKey: ['home', 'ward-chat-unread', wardId],
        queryFn: () => WardAPI.getWardChatUnreadCount(wardId!),
        enabled: wardId !== null && isChatEnabled,
        staleTime: 15_000,
    });
    const deadlinesQuery = useQuery({
        queryKey: ['home', 'board-deadlines', wardId, monthStartKey, monthEndKey],
        queryFn: () => BoardAPI.getDeadlines(wardId!, monthStartKey, monthEndKey),
        enabled: wardId !== null,
        staleTime: 30_000,
    });
    const shiftTeams = shiftTeamsQuery.data ?? [];
    const currentMonthShiftQueries = useQueries({
        queries: shiftTeams.map((team) => ({
            ...wardQueryOptions.duty(wardId ?? -1, team.shiftTeamId, currentYearMonth.year, currentYearMonth.month),
            enabled: wardId !== null,
            staleTime: 30_000,
        })),
    });
    const nextMonthShiftQueries = useQueries({
        queries: shiftTeams.map((team) => ({
            ...wardQueryOptions.duty(wardId ?? -1, team.shiftTeamId, nextYearMonth.year, nextYearMonth.month),
            enabled: wardId !== null,
            staleTime: 30_000,
        })),
    });
    const currentScheduleStatusItems = useMemo<TScheduleStatusItem[]>(
        () =>
            shiftTeams.map((team, index) => {
                const status = getScheduleStatus(currentMonthShiftQueries[index]);

                return {
                    team,
                    status: status.status,
                    shift: status.shift,
                };
            }),
        [currentMonthShiftQueries, shiftTeams],
    );
    const nextScheduleStatusItems = useMemo<TScheduleStatusItem[]>(
        () =>
            shiftTeams.map((team, index) => {
                const status = getScheduleStatus(nextMonthShiftQueries[index], {emptyAssignmentsAsDraft: true});

                return {
                    team,
                    status: status.status,
                    shift: status.shift,
                };
            }),
        [nextMonthShiftQueries, shiftTeams],
    );
    const todayDuties = useMemo(
        () =>
            currentScheduleStatusItems.map((item) =>
                getTodayTeamDuty(
                    item,
                    today.getDate(),
                    buildMakePath({
                        year: currentYearMonth.year,
                        month: currentYearMonth.month,
                        shiftTeamId: item.team.shiftTeamId,
                    }),
                ),
            ),
        [currentScheduleStatusItems, currentYearMonth.month, currentYearMonth.year, today],
    );
    const visibleTodayDuties =
        selectedTodayTeamId === 'all' ? todayDuties : todayDuties.filter((duty) => duty.teamId === selectedTodayTeamId);
    const monthlyTeamId = selectedMonthlyTeamId;
    const selectedMonthlyItem =
        monthlyTeamId === 'all' ? null : currentScheduleStatusItems.find((item) => item.team.shiftTeamId === monthlyTeamId) ?? null;
    const monthlySourceItems =
        monthlyTeamId === 'all' ? currentScheduleStatusItems : currentScheduleStatusItems.filter((item) => item.team.shiftTeamId === monthlyTeamId);
    const monthlyRows = useMemo(
        () =>
            sortMonthlyShiftRows(
                monthlySourceItems.flatMap((item) => getMonthlyShiftRows(item, todayKey, currentYearMonth.year, currentYearMonth.month)),
                monthlySortOption,
            ),
        [currentYearMonth.month, currentYearMonth.year, monthlySortOption, monthlySourceItems, todayKey],
    );
    const deadlines = deadlinesQuery.data ?? [];
    const deadlineBuckets = useMemo(() => getDeadlineBuckets(deadlines, todayKey), [deadlines, todayKey]);
    const waitingNurseCount = waitingNursesQuery.data?.length ?? 0;
    const pendingRequestCount = pendingRequestsQuery.data?.totalPendingCount ?? 0;
    const unreadChatCount = chatUnreadQuery.data?.unreadCount ?? 0;
    const nextEmptyTeams = nextScheduleStatusItems.filter((item) => item.status === 'empty');
    const nextDraftTeams = nextScheduleStatusItems.filter((item) => item.status === 'draft');
    const todayAssignedCount = todayDuties.reduce((total, duty) => total + duty.assignedCount, 0);
    const taskItems = useMemo<TTaskItem[]>(() => {
        const tasks: TTaskItem[] = [];

        if (deadlineBuckets.overdue.length > 0) {
            tasks.push({
                key: 'deadline-overdue',
                tone: 'danger',
                title: `지난 마감 ${deadlineBuckets.overdue.length}건`,
                description: deadlineBuckets.overdue[0]?.postTitle ?? '가장 지난 마감부터 확인해요',
                actionLabel: '마감',
                path: ROUTE.BOARD,
            });
        }

        if (deadlineBuckets.today.length > 0) {
            tasks.push({
                key: 'deadline-today',
                tone: 'warning',
                title: `오늘 마감 ${deadlineBuckets.today.length}건`,
                description: deadlineBuckets.today[0]?.postTitle ?? '오늘까지 처리할 게시글이에요',
                actionLabel: '오늘',
                path: ROUTE.BOARD,
            });
        }

        if (pendingRequestCount > 0) {
            tasks.push({
                key: 'pending-requests',
                tone: 'info',
                title: `대기 중인 신청 근무 ${pendingRequestCount}건`,
                description: '근무표에 반영할지 정해요',
                actionLabel: '신청',
                path: ROUTE.REQUEST,
            });
        }

        if (waitingNurseCount > 0) {
            tasks.push({
                key: 'waiting-nurses',
                tone: 'info',
                title: `입장 대기 ${waitingNurseCount}명`,
                description: '병동에 추가할 구성원을 확인해요',
                actionLabel: '멤버',
                path: ROUTE.MEMBER,
            });
        }

        if (nextEmptyTeams.length > 0) {
            tasks.push({
                key: 'next-empty',
                tone: 'warning',
                title: `${nextYearMonth.month}월 근무표를 만들 팀 ${nextEmptyTeams.length}팀`,
                description: getShiftTeamNameList(nextEmptyTeams.map((item) => item.team)),
                actionLabel: '작성',
                path: buildMakePath({
                    year: nextYearMonth.year,
                    month: nextYearMonth.month,
                    shiftTeamId: nextEmptyTeams[0]?.team.shiftTeamId,
                }),
            });
        }

        if (nextDraftTeams.length > 0) {
            tasks.push({
                key: 'next-draft',
                tone: 'quiet',
                title: `${nextYearMonth.month}월 근무표 진행 중 ${nextDraftTeams.length}팀`,
                description: getShiftTeamNameList(nextDraftTeams.map((item) => item.team)),
                actionLabel: '계속',
                path: buildMakePath({
                    year: nextYearMonth.year,
                    month: nextYearMonth.month,
                    shiftTeamId: nextDraftTeams[0]?.team.shiftTeamId,
                }),
            });
        }

        if (unreadChatCount > 0) {
            tasks.push({
                key: 'unread-chat',
                tone: 'quiet',
                title: `읽지 않은 병동톡 ${unreadChatCount}개`,
                description: '최근 대화를 확인해요',
                actionLabel: '톡',
                path: '#ward-chat',
            });
        }

        return tasks;
    }, [
        deadlineBuckets.overdue,
        deadlineBuckets.today,
        nextDraftTeams,
        nextEmptyTeams,
        nextYearMonth.month,
        nextYearMonth.year,
        pendingRequestCount,
        unreadChatCount,
        waitingNurseCount,
    ]);
    const handleNavigate = (path: string) => {
        if (path === '#ward-chat') {
            window.dispatchEvent(new CustomEvent('dutying:open-ward-chat'));

            return;
        }

        navigate(path);
    };
    const isBootstrapLoading = wardId !== null && (wardQuery.isPending || shiftTeamsQuery.isPending);
    const isBootstrapError = wardId !== null && (wardQuery.isError || shiftTeamsQuery.isError);
    const wardTitle = wardQuery.data ? `${wardQuery.data.hospitalName} ${wardQuery.data.name}` : '병동';
    const managerName = accountMe?.name?.trim() || '관리자';
    const monthlyOpenPath = buildMakePath({
        year: currentYearMonth.year,
        month: currentYearMonth.month,
        shiftTeamId: selectedMonthlyItem?.team.shiftTeamId,
    });
    const monthlyScheduleDescription =
        monthlyTeamId === 'all'
            ? `${formatMonth(currentYearMonth.year, currentYearMonth.month)} · 전체`
            : selectedMonthlyItem
              ? `${formatMonth(currentYearMonth.year, currentYearMonth.month)} · ${selectedMonthlyItem.team.name}`
              : formatMonth(currentYearMonth.year, currentYearMonth.month);
    const monthlyEmptyTitle = monthlyTeamId === 'all' ? '이번 달 근무표가 비어 있어요' : `${selectedMonthlyItem?.team.name ?? '선택한 팀'} 근무표가 비어 있어요`;

    if (wardId === null) {
        return (
            <div className="flex min-h-screen w-full bg-[#F6F7F9]">
                <PageState
                    tone="empty"
                    layout="screen"
                    title="병동을 연결해야 해요"
                    description="병동을 연결하면 홈을 볼 수 있어요."
                />
            </div>
        );
    }

    if (isBootstrapLoading) {
        return (
            <div className="flex min-h-screen w-full bg-[#F6F7F9]">
                <PageState tone="loading" layout="screen" title="홈을 불러오고 있어요" description="병동 정보를 확인하고 있어요." />
            </div>
        );
    }

    if (isBootstrapError) {
        return (
            <div className="flex min-h-screen w-full bg-[#F6F7F9]">
                <PageState
                    tone="error"
                    layout="screen"
                    title="홈을 불러오지 못했어요"
                    description="잠시 후 다시 시도해요."
                    action={{
                        label: '다시 시도하기',
                        onClick: () => {
                            void wardQuery.refetch();
                            void shiftTeamsQuery.refetch();
                        },
                    }}
                />
            </div>
        );
    }

    return (
        <div className="min-h-screen w-full min-w-[1080px] bg-[#F6F7F9] px-8 py-6 font-apple">
            <div className="mx-auto flex w-full max-w-[1480px] flex-col gap-5">
                <header className="flex min-w-0 items-end justify-between gap-5">
                    <div className="min-w-0">
                        <p className="truncate text-[14px] font-bold text-gray-3">{wardTitle}</p>
                        <h1 className="mt-1 truncate text-[32px] leading-[40px] font-bold text-sub-1">{formatDateWithWeekday(today)}</h1>
                        <p className="mt-1 text-[14px] font-semibold text-gray-3">
                            {managerName} · 오늘 근무 {todayAssignedCount}명
                        </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                        <HomeButton variant="plain" onClick={() => navigate(ROUTE.REQUEST)}>
                            신청 근무 {pendingRequestCount}
                        </HomeButton>
                        <HomeButton
                            onClick={() =>
                                navigate(
                                    buildMakePath({
                                        year: nextYearMonth.year,
                                        month: nextYearMonth.month,
                                        shiftTeamId: shiftTeams[0]?.shiftTeamId,
                                    }),
                                )
                            }
                        >
                            다음 달 근무표 만들기
                        </HomeButton>
                    </div>
                </header>

                <main className="grid grid-cols-[minmax(0,1fr)_360px] gap-5">
                    <SectionShell
                        title="오늘의 근무"
                        description="팀별 근무자를 바로 볼 수 있어요."
                    >
                        <TeamFilter teams={shiftTeams} selectedTeamId={selectedTodayTeamId} onSelectTeam={setSelectedTodayTeamId} />
                        <div className="mt-4">
                            <TodayDutyOverview duties={visibleTodayDuties} />
                        </div>
                    </SectionShell>

                    <aside className="flex min-w-0 flex-col gap-5">
                        <SectionShell title="해야 할 일" description={taskItems.length > 0 ? `지금 확인할 일 ${taskItems.length}개` : '지금 할 일은 없어요'}>
                            <div className="grid grid-cols-2 gap-2">
                                <QueueButton label="대기 중인 신청 근무" value={pendingRequestCount} onClick={() => navigate(ROUTE.REQUEST)} />
                                <QueueButton label="입장 대기" value={waitingNurseCount} onClick={() => navigate(ROUTE.MEMBER)} />
                            </div>
                            {waitingNursesQuery.isPending || pendingRequestsQuery.isPending || deadlinesQuery.isPending ? (
                                <div className="mt-3 rounded-[8px] bg-[#F6F7F9] px-3 py-2 text-[12px] font-bold text-gray-3">확인하고 있어요</div>
                            ) : null}
                            <div className="mt-3 grid gap-2">
                                {taskItems.length > 0 ? (
                                    taskItems.slice(0, 5).map((task) => <TaskRow key={task.key} task={task} onNavigate={handleNavigate} />)
                                ) : (
                                    <div className="rounded-[8px] bg-[#F6F7F9] px-4 py-5">
                                        <p className="text-[15px] font-bold text-sub-1">지금 할 일은 없어요</p>
                                        <p className="mt-1 text-[13px] font-semibold text-gray-3">오늘 근무와 이번 달 근무표만 보면 돼요.</p>
                                    </div>
                                )}
                            </div>
                        </SectionShell>

                        <SectionShell title="다음 달 근무표" description={formatMonth(nextYearMonth.year, nextYearMonth.month)}>
                            <div className="grid gap-2">
                                {nextScheduleStatusItems.length > 0 ? (
                                    nextScheduleStatusItems.slice(0, 4).map((item) => (
                                        <button
                                            key={item.team.shiftTeamId}
                                            type="button"
                                            className="flex min-h-[44px] cursor-pointer items-center justify-between gap-3 rounded-[8px] bg-[#F6F7F9] px-3 text-left transition hover:bg-[#ECEFF3] focus-visible:bg-main-light focus-visible:outline-none"
                                            onClick={() =>
                                                navigate(
                                                    buildMakePath({
                                                        year: nextYearMonth.year,
                                                        month: nextYearMonth.month,
                                                        shiftTeamId: item.team.shiftTeamId,
                                                    }),
                                                )
                                            }
                                        >
                                            <span className="truncate text-[13px] font-bold text-sub-1">{item.team.name}</span>
                                            <span className={getScheduleStatusClassName(item.status)}>{getScheduleStatusLabel(item.status)}</span>
                                        </button>
                                    ))
                                ) : (
                                    <div className="rounded-[8px] bg-[#F6F7F9] px-4 py-5">
                                        <p className="text-[14px] font-bold text-sub-1">팀을 추가하면 준비할 수 있어요</p>
                                        <p className="mt-1 text-[12px] font-semibold text-gray-3">근무자 관리에서 간호 팀을 추가해요.</p>
                                    </div>
                                )}
                            </div>
                        </SectionShell>
                    </aside>

                    <SectionShell
                        title="이번 달 근무표"
                        description={monthlyScheduleDescription}
                        action={
                            <div className="flex items-center gap-2">
                                <MonthlySortSelect value={monthlySortOption} onChange={setMonthlySortOption} />
                                <HomeButton variant="plain" onClick={() => navigate(monthlyOpenPath)}>
                                    근무표 편집하기
                                </HomeButton>
                            </div>
                        }
                        className="col-span-2"
                    >
                        <div className="mb-4 flex min-w-0 items-center justify-between gap-4">
                            <ScheduleTeamTabs teams={shiftTeams} selectedTeamId={monthlyTeamId} onSelectTeam={setSelectedMonthlyTeamId} />
                        </div>
                        <MonthlyScheduleTable
                            rows={monthlyRows}
                            hasTeams={shiftTeams.length > 0}
                            showTeamName={monthlyTeamId === 'all'}
                            emptyTitle={monthlyEmptyTitle}
                            emptyDescription="근무표 만들기에서 확인할 수 있어요."
                            onOpen={() => navigate(monthlyOpenPath)}
                        />
                    </SectionShell>
                </main>
            </div>
        </div>
    );
}

export default HomePage;
