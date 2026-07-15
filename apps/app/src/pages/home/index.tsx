import {cn} from '@dutying/utils/style';
import {useQueries, useQuery} from '@tanstack/react-query';
import {CalendarDays, ChevronDown, X} from 'lucide-react';
import {type ReactNode, useEffect, useMemo, useRef, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {useNavigate} from 'react-router';
import {type TShift, type TShiftTeam, type TWardShiftClassification, type TWardShiftType} from '@/entities';
import ShiftBadge from '@/entities/shift/ui/shift-badge';
import {wardQueryOptions} from '@/entities/ward/model/queries';
import useAuth from '@/features/auth';
import {isWardAdminAccessToken} from '@/features/auth/model/admin-token';
import {isDutyShiftFullyAssigned, isDutyShiftWithoutAssignments} from '@/features/shift-editor';
import {BoardAPI} from '@/shared/api';
import {type TWardBoardDeadline, type TWardBoardSchedule} from '@/shared/api/board';
import {PersonIcon} from '@/shared/assets/svg';
import ROUTE, {MEMBER_CONNECTION_MANAGE_PATH} from '@/shared/constant/path';
import {useTypedTranslation} from '@/shared/hook/use-typed-translation';
import {getLocaleForLanguage} from '@/shared/i18n/locale';
import {getShiftWorkflowStatus} from '@/shared/lib/shift-workflow-status';
import PageState from '@/shared/ui/PageState';
import {Skeleton} from '@/shared/ui/primitives/skeleton';
import {NotificationBell} from '@/widgets/notifications/notification-bell';

const DAY_MS = 24 * 60 * 60 * 1000;
const TASK_LOOKAHEAD_DAYS = 7;
const CALENDAR_ITEM_LIMIT = 3;
const SUNDAY_INDEX = 0;
const SATURDAY_INDEX = 6;
const SHIFT_CLASSIFICATION_ORDER: Partial<Record<TWardShiftClassification, number>> = {
    DAY: 10,
    EVENING: 20,
    NIGHT: 30,
    OFF: 80,
    OTHER_LEAVE: 90,
};

type TScheduleStatus = 'checking' | 'error' | 'empty' | 'draft' | 'complete';
type TCalendarItemTone = 'today' | 'warning' | 'danger' | 'quiet';
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

type TCalendarItem = {
    key: string;
    kind: 'schedule' | 'deadline';
    tone: TCalendarItemTone;
    badge: string;
    title: string;
    meta: string;
    sortOrder: number;
} & (
    | {
          kind: 'schedule';
          schedule: TWardBoardSchedule;
      }
    | {
          kind: 'deadline';
          deadline: TWardBoardDeadline;
      }
);

type TMonthlyShiftCell = {
    day: number;
    dateKey: string;
    weekdayIndex: number;
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

type THomeTranslator = ReturnType<typeof useTypedTranslation>['t'];

const MONTHLY_SORT_OPTIONS: TMonthlySortOption[] = ['default', 'nameAsc', 'todayShift'];
const getMonthlySortLabel = (value: TMonthlySortOption, t: THomeTranslator) => {
    switch (value) {
        case 'nameAsc':
            return t('page.home.sort.nameAsc');
        case 'todayShift':
            return t('page.home.sort.todayShift');
        case 'default':
            return t('page.home.sort.default');
    }
};
const pad2 = (value: number) => String(value).padStart(2, '0');
const toDateKey = (date: Date) => `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
const parseDateKey = (dateKey: string) => {
    const [year, month, day] = dateKey.split('-').map(Number);

    return new Date(year, (month || 1) - 1, day || 1);
};
const compareDateKey = (left: string, right: string) => left.localeCompare(right);
const addDays = (date: Date, days: number) => {
    const nextDate = new Date(date);

    nextDate.setDate(nextDate.getDate() + days);

    return nextDate;
};
const getMaxDateKey = (left: string, right: string) => (compareDateKey(left, right) >= 0 ? left : right);
const getNextYearMonth = (year: number, month: number) => (month === 12 ? {year: year + 1, month: 1} : {year, month: month + 1});
const getMonthStartKey = (year: number, month: number) => toDateKey(new Date(year, month - 1, 1));
const getMonthEndKey = (year: number, month: number) => toDateKey(new Date(year, month, 0));
const formatMonth = (year: number, month: number, locale: string) =>
    new Intl.DateTimeFormat(locale, {year: 'numeric', month: 'long'}).format(new Date(year, month - 1, 1));
const formatDateWithWeekday = (date: Date, locale: string) =>
    new Intl.DateTimeFormat(locale, {month: 'long', day: 'numeric', weekday: 'long'}).format(date);
const formatDateWithWeekdayParts = (date: Date, locale: string) =>
    new Intl.DateTimeFormat(locale, {month: 'long', day: 'numeric', weekday: 'long'}).formatToParts(date);
const getHeaderWeekdayClassName = (weekdayIndex: number) => {
    if (weekdayIndex === SATURDAY_INDEX) return 'text-[#5F8BFF]';

    if (weekdayIndex === SUNDAY_INDEX) return 'text-[#FF6384]';

    return undefined;
};
const formatMonthDay = (dateKey: string, locale: string) => {
    const date = parseDateKey(dateKey);

    return new Intl.DateTimeFormat(locale, {month: 'long', day: 'numeric'}).format(date);
};
const formatShortMonthDay = (dateKey: string, locale: string) => {
    const date = parseDateKey(dateKey);

    return new Intl.DateTimeFormat(locale, {month: 'numeric', day: 'numeric'}).format(date);
};
const getDayDiff = (dateKey: string, todayKey: string) =>
    Math.round((parseDateKey(dateKey).getTime() - parseDateKey(todayKey).getTime()) / DAY_MS);
const buildMakePath = ({year, month, shiftTeamId}: {year: number; month: number; shiftTeamId?: number}) => {
    const params = new URLSearchParams({year: String(year), month: String(month)});

    if (shiftTeamId) {
        params.set('shiftTeamId', String(shiftTeamId));
    }

    return `${ROUTE.MAKE}?${params.toString()}`;
};
const readBooleanLike = (value: unknown) => {
    if (typeof value === 'boolean') return value;

    if (typeof value === 'number') return value === 1;

    if (typeof value === 'string') {
        const normalizedValue = value.trim().toLowerCase();

        if (normalizedValue === 'true' || normalizedValue === '1') return true;

        if (normalizedValue === 'false' || normalizedValue === '0') return false;
    }

    return undefined;
};
const getFirstNonEmptyValue = (...values: Array<string | null | undefined>) => values.find((value) => value?.trim()) ?? '';
const getBoardScheduleStartDate = (schedule: TWardBoardSchedule) =>
    getFirstNonEmptyValue(schedule.startDate, schedule.start_date, schedule.scheduleDate, schedule.schedule_date);
const getBoardScheduleEndDate = (schedule: TWardBoardSchedule) =>
    getFirstNonEmptyValue(
        schedule.endDate,
        schedule.end_date,
        schedule.scheduleDate,
        schedule.schedule_date,
        getBoardScheduleStartDate(schedule),
    );
const isBoardDeadlineSchedule = (schedule: TWardBoardSchedule) => (schedule.sourceType ?? schedule.source_type) === 'BOARD_DEADLINE';
const isScheduleOnDate = (schedule: TWardBoardSchedule, dateKey: string) => {
    const startDate = getBoardScheduleStartDate(schedule);
    const endDate = getBoardScheduleEndDate(schedule);

    if (!startDate || !endDate) return false;

    return compareDateKey(startDate, dateKey) <= 0 && compareDateKey(endDate, dateKey) >= 0;
};
const normalizeTimeInput = (value?: string | null) => (value ? value.slice(0, 5) : '');
const getBoardScheduleAllDay = (schedule: TWardBoardSchedule) =>
    readBooleanLike(schedule.allDay ?? schedule.isAllDay ?? schedule.all_day ?? schedule.is_all_day) ?? false;
const getBoardScheduleTimeLabel = (schedule: TWardBoardSchedule, t: THomeTranslator) => {
    if (getBoardScheduleAllDay(schedule)) return t('page.home.calendar.allDay');

    const startTime = normalizeTimeInput(schedule.startTime ?? schedule.start_time);
    const endTime = normalizeTimeInput(schedule.endTime ?? schedule.end_time);

    if (startTime && endTime) return `${startTime}-${endTime}`;

    return getFirstNonEmptyValue(startTime, endTime, t('page.home.calendar.timeUnknown'));
};
const formatBoardScheduleDateRange = (startDate: string, endDate: string, locale: string) =>
    startDate === endDate ? formatMonthDay(startDate, locale) : `${formatMonthDay(startDate, locale)} - ${formatMonthDay(endDate, locale)}`;
const formatBoardScheduleDateTime = (dateKey: string, time: string, locale: string) =>
    time ? `${formatMonthDay(dateKey, locale)} ${time}` : formatMonthDay(dateKey, locale);
const getBoardScheduleDateTimeDetail = (schedule: TWardBoardSchedule, t: THomeTranslator, locale: string) => {
    const startDate = getBoardScheduleStartDate(schedule);
    const endDate = getBoardScheduleEndDate(schedule);
    const allDay = getBoardScheduleAllDay(schedule);

    if (allDay) {
        return {
            primary: formatBoardScheduleDateRange(startDate, endDate, locale),
            badge: t('page.board.date.allDay'),
        };
    }

    const startTime = normalizeTimeInput(schedule.startTime ?? schedule.start_time);
    const endTime = normalizeTimeInput(schedule.endTime ?? schedule.end_time);
    const timeRange =
        startTime && endTime ? `${startTime}-${endTime}` : getFirstNonEmptyValue(startTime, endTime, t('page.board.date.timeUnknown'));

    if (startDate === endDate) {
        return {
            primary: formatMonthDay(startDate, locale),
            secondary: timeRange,
        };
    }

    return {
        primary: `${formatBoardScheduleDateTime(startDate, startTime, locale)} - ${formatBoardScheduleDateTime(endDate, endTime, locale)}`,
        secondary: startTime || endTime ? undefined : t('page.board.date.timeUnknown'),
    };
};
const getCalendarItems = (
    schedules: TWardBoardSchedule[],
    deadlines: TWardBoardDeadline[],
    todayKey: string,
    t: THomeTranslator,
    locale: string,
): TCalendarItem[] => {
    const scheduleItems: TCalendarItem[] = schedules
        .filter((schedule) => !isBoardDeadlineSchedule(schedule))
        .flatMap((schedule): TCalendarItem[] => {
            const startDate = getBoardScheduleStartDate(schedule);
            const endDate = getBoardScheduleEndDate(schedule);

            if (!startDate || !endDate) return [];

            if (isScheduleOnDate(schedule, todayKey)) {
                return [
                    {
                        key: `schedule-today-${schedule.scheduleId ?? schedule.id ?? startDate}-${schedule.title}`,
                        kind: 'schedule',
                        tone: 'today',
                        badge: t('page.home.calendar.today'),
                        title: schedule.title,
                        meta: t('page.home.calendar.scheduleMeta', {time: getBoardScheduleTimeLabel(schedule, t)}),
                        sortOrder: 10,
                        schedule,
                    },
                ];
            }

            const diff = getDayDiff(startDate, todayKey);

            if (diff <= 0 || diff > TASK_LOOKAHEAD_DAYS) return [];

            return [
                {
                    key: `schedule-upcoming-${schedule.scheduleId ?? schedule.id ?? startDate}-${schedule.title}`,
                    kind: 'schedule',
                    tone: 'quiet',
                    badge: formatShortMonthDay(startDate, locale),
                    title: schedule.title,
                    meta: t('page.home.calendar.scheduleDateMeta', {
                        date: formatMonthDay(startDate, locale),
                        time: getBoardScheduleTimeLabel(schedule, t),
                    }),
                    sortOrder: 50 + diff,
                    schedule,
                },
            ];
        });
    const deadlineItems: TCalendarItem[] = deadlines.flatMap((deadline): TCalendarItem[] => {
        const diff = getDayDiff(deadline.deadlineDate, todayKey);

        if (diff < -TASK_LOOKAHEAD_DAYS || diff > TASK_LOOKAHEAD_DAYS) return [];

        return [
            {
                key: `deadline-${deadline.postId}-${deadline.deadlineDate}`,
                kind: 'deadline',
                tone: diff < 0 ? 'danger' : 'warning',
                badge: diff < 0 ? t('page.home.calendar.overdue') : diff === 0 ? t('page.home.calendar.today') : `D-${diff}`,
                title: deadline.postTitle,
                meta: t('page.home.calendar.deadlineMeta', {date: formatMonthDay(deadline.deadlineDate, locale)}),
                sortOrder: diff === 0 ? 20 : diff < 0 ? 25 + Math.abs(diff) : 30 + diff,
                deadline,
            },
        ];
    });

    return [...scheduleItems, ...deadlineItems]
        .sort((left, right) => left.sortOrder - right.sortOrder || left.title.localeCompare(right.title, locale))
        .slice(0, CALENDAR_ITEM_LIMIT);
};
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
const getScheduleStatusLabel = (status: TScheduleStatus, t: THomeTranslator) => {
    switch (status) {
        case 'checking':
            return t('page.home.status.checking');
        case 'error':
            return t('page.home.status.error');
        case 'empty':
            return t('page.home.status.empty');
        case 'draft':
            return t('page.home.status.draft');
        case 'complete':
            return t('page.home.status.complete');
    }
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
const getCalendarToneClassName = (tone: TCalendarItemTone) =>
    cn(
        tone === 'today'
            ? 'bg-[#EAF6EE] text-[#1E7A43]'
            : tone === 'warning'
              ? 'bg-[#FFF6E8] text-[#A35F00]'
              : tone === 'danger'
                ? 'bg-[#FFF0F0] text-[#C74343]'
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
            label: shiftType.name || shiftType.shortName,
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
                const dateKey = toDateKey(date);
                const shiftTypeId = row.wardShiftList?.[index] ?? null;

                return {
                    day: day.day,
                    dateKey,
                    weekdayIndex: date.getDay(),
                    isToday: dateKey === todayKey,
                    shiftType: shiftTypeId === null ? null : (shiftTypeById.get(shiftTypeId) ?? null),
                };
            }),
        }));
};
const sortMonthlyShiftRows = (rows: TMonthlyShiftRow[], sortOption: TMonthlySortOption, locale: string) => {
    const sortedRows = [...rows];

    if (sortOption === 'nameAsc') {
        return sortedRows.sort(
            (left, right) => left.nurseName.localeCompare(right.nurseName, locale) || left.teamName.localeCompare(right.teamName, locale),
        );
    }

    if (sortOption === 'todayShift') {
        return sortedRows.sort((left, right) => {
            const leftToday = left.cells.find((cell) => cell.isToday)?.shiftType ?? null;
            const rightToday = right.cells.find((cell) => cell.isToday)?.shiftType ?? null;

            return (
                getShiftTypeSortOrder(leftToday) - getShiftTypeSortOrder(rightToday) ||
                left.teamName.localeCompare(right.teamName, locale) ||
                left.nurseName.localeCompare(right.nurseName, locale)
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
                'inline-flex h-10 shrink-0 cursor-pointer items-center justify-center rounded-[8px] px-4 font-apple text-[14px] font-semibold transition focus-visible:bg-main-light focus-visible:outline-none active:scale-[0.99]',
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
    const {t} = useTypedTranslation();

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
                {t('page.home.filter.all')}
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
    const {t} = useTypedTranslation();

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
                {t('page.home.filter.all')}
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

function MonthlySortSelect({value, onChange}: {value: TMonthlySortOption; onChange: (value: TMonthlySortOption) => void}) {
    const {t} = useTypedTranslation();
    const [isOpen, setIsOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement | null>(null);
    const selectedOption = MONTHLY_SORT_OPTIONS.includes(value) ? value : 'default';

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
                aria-label={t('page.home.sort.openAria')}
                className={cn(
                    'flex h-8 min-w-[112px] items-center justify-between gap-3 rounded-[5px] bg-gray-6 px-3 font-apple text-[16px] text-gray-3 transition-colors focus-visible:outline-2 focus-visible:outline-main-1',
                    isOpen ? 'bg-white text-sub-1 shadow-[0px_10px_28px_rgba(95,100,135,0.16)]' : 'hover:bg-gray-7',
                )}
                onClick={() => setIsOpen((prev) => !prev)}
            >
                <span>{getMonthlySortLabel(selectedOption, t)}</span>
                <ChevronDown aria-hidden="true" className={cn('h-4 w-4 shrink-0 transition-transform', isOpen && 'rotate-180')} />
            </button>
            {isOpen ? (
                <div
                    role="listbox"
                    aria-label={t('page.home.sort.label')}
                    className="absolute top-full right-0 z-20 mt-1 w-[150px] animate-in overflow-hidden rounded-[10px] border border-gray-6 bg-white py-1 shadow-[0px_10px_28px_rgba(95,100,135,0.16)] duration-150 fade-in-0 zoom-in-95 slide-in-from-top-1"
                >
                    {MONTHLY_SORT_OPTIONS.map((option) => {
                        const isSelected = option === value;

                        return (
                            <button
                                key={option}
                                type="button"
                                role="option"
                                aria-selected={isSelected}
                                className={cn(
                                    'flex w-full items-center px-4 py-2.5 text-left font-apple text-[15px] transition-colors hover:bg-gray-7 focus-visible:outline-2 focus-visible:outline-main-1',
                                    isSelected ? 'bg-main-light font-semibold text-main-1' : 'text-sub-1',
                                )}
                                onClick={() => {
                                    onChange(option);
                                    setIsOpen(false);
                                }}
                            >
                                {getMonthlySortLabel(option, t)}
                            </button>
                        );
                    })}
                </div>
            ) : null}
        </div>
    );
}

function TodayShiftLine({group}: {group: TTodayShiftGroup}) {
    const shiftLabel = group.label.trim();
    const shiftName = shiftLabel.length > 0 ? shiftLabel : (group.shiftType?.shortName?.trim() ?? '');

    return (
        <div className="min-w-0 rounded-[8px] bg-white px-2.5 py-2">
            <div className="flex min-w-0 items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2">
                    <ShiftBadge shiftType={group.shiftType} className="!size-7 !rounded-[7px] !text-[13px]" />
                    <p className="min-w-0 truncate text-[13px] leading-4 font-bold text-sub-1">{shiftName}</p>
                </div>
                <span className="inline-flex shrink-0 items-center gap-1 text-[11px] font-bold text-gray-4">
                    <PersonIcon aria-hidden="true" className="size-3" />
                    {group.names.length}
                </span>
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
    const {t} = useTypedTranslation();
    const filledGroups = duty.groups.filter((group) => group.names.length > 0);
    const hasSchedule = duty.status !== 'empty' && duty.status !== 'error' && duty.status !== 'checking';

    return (
        <article className="grid min-w-0 grid-cols-[108px_minmax(0,1fr)] gap-2 rounded-[8px] bg-[#F6F7F9] p-2.5">
            <div className="flex min-w-0 flex-col justify-center px-1.5 py-1">
                <h3 className="truncate text-[16px] leading-5 font-bold text-sub-1">{duty.teamName}</h3>
                <p className="mt-1 inline-flex items-center gap-1 text-[12px] leading-4 font-bold text-gray-3">
                    <PersonIcon aria-hidden="true" className="size-3" />
                    {duty.assignedCount}
                </p>
            </div>
            {hasSchedule && filledGroups.length > 0 ? (
                <div className="grid min-w-0 grid-cols-[repeat(auto-fit,minmax(152px,1fr))] gap-1.5">
                    {filledGroups.map((group) => (
                        <TodayShiftLine key={group.key} group={group} />
                    ))}
                </div>
            ) : (
                <div className="flex min-h-[72px] items-center justify-center px-4 text-center">
                    <p className="text-[14px] font-bold text-gray-3">{t('page.home.today.emptyShift')}</p>
                </div>
            )}
        </article>
    );
}

function TodayDutyOverview({duties}: {duties: TTodayTeamDuty[]}) {
    const {t} = useTypedTranslation();

    if (duties.length === 0) {
        return (
            <div className="flex min-h-[180px] flex-col items-center justify-center rounded-[8px] bg-[#F6F7F9] px-5 text-center">
                <p className="text-[15px] font-bold text-sub-1">{t('page.home.emptyTeams.title')}</p>
                <p className="mt-1 text-[13px] font-semibold text-gray-3">{t('page.home.emptyTeams.description')}</p>
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

function NextScheduleTaskRow({
    item,
    year,
    month,
    onNavigate,
}: {
    item: TScheduleStatusItem;
    year: number;
    month: number;
    onNavigate: (path: string) => void;
}) {
    const {t} = useTypedTranslation();

    return (
        <button
            type="button"
            className="flex min-h-[44px] w-full cursor-pointer items-center justify-between gap-3 rounded-[8px] bg-[#F6F7F9] p-3 text-left transition hover:bg-[#ECEFF3] focus-visible:bg-main-light focus-visible:outline-none"
            onClick={() =>
                onNavigate(
                    buildMakePath({
                        year,
                        month,
                        shiftTeamId: item.team.shiftTeamId,
                    }),
                )
            }
        >
            <span className="min-w-0 flex-1">
                <span className="block truncate text-[14px] font-bold text-sub-1">
                    {t('page.home.nextSchedule.title', {teamName: item.team.name})}
                </span>
            </span>
            <span className={cn('shrink-0', getScheduleStatusClassName(item.status))}>{getScheduleStatusLabel(item.status, t)}</span>
        </button>
    );
}

function CalendarActionButton({onClick}: {onClick: () => void}) {
    const {t} = useTypedTranslation();

    return (
        <button
            type="button"
            aria-label={t('page.home.calendar.openAll')}
            title={t('page.home.calendar.openAll')}
            className="inline-flex size-8 cursor-pointer items-center justify-center rounded-[8px] bg-[#F1F3F5] text-gray-3 transition hover:bg-[#E9ECEF] hover:text-sub-1 focus-visible:bg-main-light focus-visible:outline-none"
            onClick={onClick}
        >
            <CalendarDays aria-hidden="true" className="size-3.5" />
        </button>
    );
}

function CalendarPreview({
    items,
    isLoading,
    onOpen,
    onOpenSchedule,
}: {
    items: TCalendarItem[];
    isLoading: boolean;
    onOpen: () => void;
    onOpenSchedule: (schedule: TWardBoardSchedule) => void;
}) {
    const {t} = useTypedTranslation();

    if (isLoading) {
        return (
            <div className="rounded-[8px] bg-[#F6F7F9] px-3 py-2 text-[12px] font-bold text-gray-3">{t('page.home.calendar.loading')}</div>
        );
    }

    if (items.length === 0) {
        return (
            <button
                type="button"
                className="flex w-full cursor-pointer items-center gap-3 rounded-[8px] bg-[#F6F7F9] p-3 text-left transition hover:bg-[#ECEFF3] focus-visible:bg-main-light focus-visible:outline-none"
                onClick={onOpen}
            >
                <span className="flex size-9 shrink-0 items-center justify-center rounded-[8px] bg-white text-gray-3">
                    <CalendarDays aria-hidden="true" className="size-4" />
                </span>
                <span className="min-w-0">
                    <span className="block truncate text-[14px] font-bold text-sub-1">{t('page.home.calendar.empty')}</span>
                </span>
            </button>
        );
    }

    return (
        <div className="grid gap-2">
            {items.map((item) => (
                <button
                    key={item.key}
                    type="button"
                    className="w-full cursor-pointer rounded-[8px] bg-[#F6F7F9] p-3 text-left transition hover:bg-[#ECEFF3] focus-visible:bg-main-light focus-visible:outline-none"
                    onClick={() => {
                        if (item.kind === 'schedule') {
                            onOpenSchedule(item.schedule);

                            return;
                        }

                        onOpen();
                    }}
                >
                    <div className="flex min-w-0 items-start gap-3">
                        <span className={cn('shrink-0 rounded-[8px] px-2 py-1 text-[11px] font-bold', getCalendarToneClassName(item.tone))}>
                            {item.badge}
                        </span>
                        <span className="min-w-0 flex-1">
                            <span className="block truncate text-[14px] font-bold text-sub-1">{item.title}</span>
                            <span className="mt-1 block truncate text-[12px] font-semibold text-gray-3">{item.meta}</span>
                        </span>
                    </div>
                </button>
            ))}
        </div>
    );
}

function WardScheduleViewModal({schedule, locale, onClose}: {schedule: TWardBoardSchedule; locale: string; onClose: () => void}) {
    const {t} = useTypedTranslation();
    const detailDateTime = getBoardScheduleDateTimeDetail(schedule, t, locale);
    const content = schedule.content?.trim() ?? '';
    const modalTitle = t('page.board.schedule.modalView');

    useEffect(() => {
        const handleKeyDown = (event: globalThis.KeyboardEvent) => {
            if (event.key === 'Escape') {
                onClose();
            }
        };
        const previousOverflow = document.body.style.overflow;

        document.body.style.overflow = 'hidden';
        document.addEventListener('keydown', handleKeyDown);

        return () => {
            document.body.style.overflow = previousOverflow;
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [onClose]);

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 px-4 py-6"
            role="presentation"
            onMouseDown={onClose}
        >
            <div
                role="dialog"
                aria-modal="true"
                aria-label={t('page.board.schedule.modalAria', {title: modalTitle})}
                className="w-full max-w-[440px] rounded-[16px] bg-white p-5 shadow-[0_24px_80px_rgba(15,23,42,0.22)]"
                onMouseDown={(event) => event.stopPropagation()}
            >
                <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                        <p className="text-[13px] font-semibold text-gray-3">{t('page.board.schedule.sectionTitle')}</p>
                        <h2 className="mt-1 text-[22px] leading-7 font-semibold break-words text-sub-1">{schedule.title}</h2>
                    </div>
                    <button
                        type="button"
                        className="grid h-9 w-9 shrink-0 place-items-center rounded-[8px] text-gray-4 transition-colors hover:bg-gray-7 hover:text-sub-1"
                        onClick={onClose}
                        aria-label={t('page.board.schedule.closeAria')}
                        title={t('page.board.schedule.closeAria')}
                    >
                        <X className="size-4" aria-hidden="true" />
                    </button>
                </div>

                <div className="mt-5 grid gap-4">
                    <div className="grid gap-1.5">
                        <span className="text-[13px] font-semibold text-sub-2">{t('page.board.schedule.dateTime')}</span>
                        <div className="flex min-h-11 items-start gap-2 rounded-[8px] bg-gray-7 px-3.5 py-3 text-[14px] leading-5 font-semibold text-sub-1">
                            <CalendarDays className="size-4 shrink-0 text-main-1" aria-hidden="true" />
                            <div className="grid min-w-0 flex-1 gap-1">
                                <div className="flex min-w-0 flex-wrap items-center gap-2">
                                    <span className="min-w-0 break-words">{detailDateTime.primary}</span>
                                    {'badge' in detailDateTime && detailDateTime.badge ? (
                                        <span className="inline-flex h-6 shrink-0 items-center rounded-full bg-main-light px-2.5 text-[12px] font-semibold text-main-1">
                                            {detailDateTime.badge}
                                        </span>
                                    ) : null}
                                </div>
                                {'secondary' in detailDateTime && detailDateTime.secondary ? (
                                    <span className="text-[12px] leading-4 font-medium text-gray-3">{detailDateTime.secondary}</span>
                                ) : null}
                            </div>
                        </div>
                    </div>

                    <div className="grid gap-1.5">
                        <span className="text-[13px] font-semibold text-sub-2">{t('page.board.schedule.memo')}</span>
                        <div className="flex min-h-[112px] items-start rounded-[8px] bg-gray-7 px-3.5 py-3 text-[14px] leading-5 font-medium">
                            <p className={cn('min-h-5 whitespace-pre-line', content ? 'text-sub-1' : 'text-gray-4')}>
                                {content || t('page.board.schedule.noMemo')}
                            </p>
                        </div>
                    </div>
                </div>

                <div className="mt-5 flex justify-end">
                    <button
                        type="button"
                        className="h-10 rounded-[8px] bg-gray-7 px-4 text-[13px] font-semibold text-sub-2 transition-colors hover:bg-gray-6"
                        onClick={onClose}
                    >
                        {t('page.board.common.close')}
                    </button>
                </div>
            </div>
        </div>
    );
}

function MonthlyScheduleTable({
    rows,
    hasTeams,
    showTeamName,
    emptyTitle,
    emptyDescription,
    locale,
    onOpen,
}: {
    rows: TMonthlyShiftRow[];
    hasTeams: boolean;
    showTeamName: boolean;
    emptyTitle: string;
    emptyDescription: string;
    locale: string;
    onOpen: () => void;
}) {
    const {t} = useTypedTranslation();
    const days = rows[0]?.cells ?? [];
    const dayGridTemplateColumns = `repeat(${days.length}, minmax(0, 1fr))`;
    const gridTemplateColumns = '96px minmax(0, 1fr)';

    if (!hasTeams) {
        return (
            <div className="flex min-h-[220px] flex-col items-center justify-center rounded-[8px] bg-[#F6F7F9] px-5 text-center">
                <p className="text-[15px] font-bold text-sub-1">{t('page.home.monthly.emptyTeamsTitle')}</p>
                <p className="mt-1 text-[13px] font-semibold text-gray-3">{t('page.home.emptyTeams.description')}</p>
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
            <div
                className="make-shift-calendar__header grid min-w-0 items-center py-1"
                style={{gridTemplateColumns, columnGap: '8px', paddingLeft: '4px'}}
            >
                <div className="min-w-0 truncate text-center font-apple text-[12px] font-medium text-sub-3">
                    {t('page.home.monthly.nameHeader')}
                </div>
                <div
                    className="make-shift-calendar__day-header-pill grid min-w-0 rounded-[12px] bg-gray-7 px-0 py-1"
                    style={{gridTemplateColumns: dayGridTemplateColumns}}
                >
                    {days.map((cell) => (
                        <div
                            key={cell.day}
                            className={cn(
                                'relative min-w-0 rounded-full text-center font-poppins text-[12px] leading-5 font-semibold tabular-nums',
                                cell.weekdayIndex === SATURDAY_INDEX
                                    ? 'text-blue'
                                    : cell.weekdayIndex === SUNDAY_INDEX
                                      ? 'text-red'
                                      : 'text-sub-3',
                                cell.isToday && 'bg-main-1 text-white',
                            )}
                            title={formatDateWithWeekday(parseDateKey(cell.dateKey), locale)}
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
                        className="make-shift-calendar__row grid h-[44px] w-full min-w-0 items-stretch"
                        style={{gridTemplateColumns, columnGap: '8px', paddingLeft: '4px'}}
                    >
                        <div
                            className="make-shift-calendar__row-name flex min-h-0 min-w-0 flex-col items-center justify-center truncate rounded-[8px] text-center font-apple leading-none whitespace-nowrap text-sub-1"
                            title={showTeamName ? `${row.teamName} ${row.nurseName}` : row.nurseName}
                        >
                            <span className="block max-w-full truncate text-[13px]">{row.nurseName}</span>
                            <span
                                aria-hidden={!showTeamName}
                                className={cn(
                                    'mt-1 block max-w-full truncate text-[10px] font-bold text-gray-4',
                                    !showTeamName && 'invisible',
                                )}
                            >
                                {row.teamName}
                            </span>
                        </div>
                        <div
                            className="make-shift-calendar__row-days grid h-full min-w-0 items-stretch px-0"
                            style={{gridTemplateColumns: dayGridTemplateColumns}}
                        >
                            {row.cells.map((cell) => (
                                <div
                                    key={`${row.shiftNurseId}-${cell.day}`}
                                    className={cn(
                                        'make-shift-calendar__day-cell group relative z-[10] flex h-full min-w-0 items-center justify-center',
                                        cell.weekdayIndex === SATURDAY_INDEX
                                            ? 'bg-blue/5'
                                            : cell.weekdayIndex === SUNDAY_INDEX
                                              ? 'bg-red/5'
                                              : '',
                                        cell.isToday && 'bg-main-light',
                                    )}
                                    title={t('page.home.monthly.cellTitle', {
                                        nurseName: row.nurseName,
                                        day: cell.day,
                                        shift: cell.shiftType?.shortName ?? '-',
                                    })}
                                >
                                    <span className="make-shift-calendar__shift-badge-wrap relative z-[20] flex size-[24px] min-w-0 shrink-0 items-center justify-center">
                                        <ShiftBadge
                                            shiftType={cell.shiftType}
                                            className="make-shift-calendar__shift-badge relative z-[20] !h-full min-h-0 !w-full min-w-0 rounded-[.375rem] text-[12px] leading-none"
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

function HomePageSkeleton() {
    const {t} = useTypedTranslation();

    return (
        <div
            role="status"
            aria-busy="true"
            aria-label={t('page.home.skeleton.loadingAria')}
            data-testid="home-page-skeleton"
            className="min-h-screen w-full min-w-[1080px] bg-main-bg px-8 py-6 font-apple"
        >
            <div className="mx-auto flex w-full max-w-[1480px] flex-col gap-5">
                <header className="flex min-w-0 items-end justify-between gap-5">
                    <div className="min-w-0">
                        <Skeleton className="h-4 w-52 rounded-full bg-gray-6" />
                        <Skeleton className="mt-3 h-10 w-72 rounded-full bg-gray-6" />
                        <Skeleton className="mt-3 h-4 w-44 rounded-full bg-gray-6/80" />
                    </div>
                    <Skeleton className="h-10 w-40 shrink-0 rounded-[8px] bg-sub-4.5" />
                </header>

                <main className="grid grid-cols-[minmax(0,1fr)_360px] gap-5">
                    <section className="min-w-0 rounded-[8px] bg-white p-5">
                        <div className="flex min-w-0 items-start justify-between gap-4">
                            <div className="min-w-0">
                                <Skeleton className="h-7 w-32 rounded-full bg-gray-6" />
                                <Skeleton className="mt-2 h-4 w-48 rounded-full bg-gray-6/80" />
                            </div>
                        </div>
                        <div className="mt-5 flex min-w-0 flex-wrap gap-2">
                            {Array.from({length: 4}, (_, index) => (
                                <Skeleton
                                    key={index}
                                    className={cn('h-9 rounded-[8px]', index === 0 ? 'w-20 bg-sub-4.5' : 'w-24 bg-gray-6')}
                                />
                            ))}
                        </div>
                        <div className="mt-4 grid gap-3">
                            {Array.from({length: 3}, (_, rowIndex) => (
                                <div
                                    key={rowIndex}
                                    className="grid min-w-0 grid-cols-[108px_minmax(0,1fr)] gap-2 rounded-[8px] bg-[#F6F7F9] p-2.5"
                                >
                                    <div className="flex min-w-0 flex-col justify-center px-1.5 py-1">
                                        <Skeleton className="h-5 w-16 rounded-full bg-gray-6" />
                                        <Skeleton className="mt-2 h-4 w-10 rounded-full bg-gray-6/80" />
                                    </div>
                                    <div className="grid min-w-0 grid-cols-3 gap-1.5">
                                        {Array.from({length: 3}, (_, cardIndex) => (
                                            <div key={cardIndex} className="min-w-0 rounded-[8px] bg-white px-2.5 py-2">
                                                <div className="flex min-w-0 items-center gap-2">
                                                    <Skeleton className="size-7 rounded-[7px] bg-main-4/80" />
                                                    <Skeleton className="h-4 w-12 rounded-full bg-gray-6" />
                                                </div>
                                                <div className="mt-3 flex gap-1">
                                                    <Skeleton className="h-6 w-10 rounded-[7px] bg-gray-6/80" />
                                                    <Skeleton className="h-6 w-12 rounded-[7px] bg-gray-6/80" />
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </section>

                    <aside className="flex min-w-0 flex-col gap-5">
                        <section className="min-w-0 rounded-[8px] bg-white p-5">
                            <Skeleton className="h-7 w-24 rounded-full bg-gray-6" />
                            <div className="mt-5 grid grid-cols-2 gap-2">
                                <Skeleton className="h-[68px] rounded-[8px] bg-[#F1F3F5]" />
                                <Skeleton className="h-[68px] rounded-[8px] bg-[#F1F3F5]" />
                            </div>
                            <div className="mt-3 grid gap-2">
                                {Array.from({length: 3}, (_, index) => (
                                    <Skeleton key={index} className="h-11 rounded-[8px] bg-[#F1F3F5]" />
                                ))}
                            </div>
                        </section>

                        <section className="min-w-0 rounded-[8px] bg-white p-5">
                            <div className="flex items-center justify-between gap-4">
                                <Skeleton className="h-7 w-20 rounded-full bg-gray-6" />
                                <Skeleton className="size-8 rounded-[8px] bg-[#F1F3F5]" />
                            </div>
                            <div className="mt-5 grid gap-2">
                                {Array.from({length: 3}, (_, index) => (
                                    <div key={index} className="rounded-[8px] bg-[#F6F7F9] p-3">
                                        <div className="flex min-w-0 items-start gap-3">
                                            <Skeleton className="h-6 w-10 shrink-0 rounded-[8px] bg-gray-6" />
                                            <span className="min-w-0 flex-1">
                                                <Skeleton className="h-4 w-9/12 rounded-full bg-gray-6" />
                                                <Skeleton className="mt-2 h-3 w-7/12 rounded-full bg-gray-6/80" />
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </section>
                    </aside>

                    <section className="col-span-2 min-w-0 rounded-[8px] bg-white p-5">
                        <div className="flex min-w-0 items-start justify-between gap-4">
                            <div className="min-w-0">
                                <Skeleton className="h-7 w-36 rounded-full bg-gray-6" />
                                <Skeleton className="mt-2 h-4 w-44 rounded-full bg-gray-6/80" />
                            </div>
                            <Skeleton className="h-10 w-32 rounded-[8px] bg-[#F1F3F5]" />
                        </div>
                        <div className="mt-5 mb-4 flex min-w-0 items-center justify-between gap-4">
                            <div className="flex min-w-0 gap-2">
                                {Array.from({length: 4}, (_, index) => (
                                    <Skeleton key={index} className="h-8 w-20 rounded-[8px] bg-gray-6" />
                                ))}
                            </div>
                            <Skeleton className="h-8 w-28 rounded-[5px] bg-gray-6" />
                        </div>
                        <div className="grid gap-2">
                            <div className="grid items-center gap-2 py-1" style={{gridTemplateColumns: '96px minmax(0, 1fr)'}}>
                                <Skeleton className="mx-auto h-4 w-12 rounded-full bg-gray-6" />
                                <div
                                    className="grid min-w-0 gap-1 rounded-[12px] bg-gray-7 px-2 py-1"
                                    style={{gridTemplateColumns: 'repeat(14, minmax(0, 1fr))'}}
                                >
                                    {Array.from({length: 14}, (_, index) => (
                                        <Skeleton key={index} className="h-5 rounded-full bg-gray-6" />
                                    ))}
                                </div>
                            </div>
                            {Array.from({length: 5}, (_, rowIndex) => (
                                <div
                                    key={rowIndex}
                                    className="grid h-[44px] items-stretch gap-2"
                                    style={{gridTemplateColumns: '96px minmax(0, 1fr)'}}
                                >
                                    <Skeleton className="rounded-[8px] bg-gray-6" />
                                    <div className="grid min-w-0 gap-1" style={{gridTemplateColumns: 'repeat(14, minmax(0, 1fr))'}}>
                                        {Array.from({length: 14}, (_, cellIndex) => (
                                            <Skeleton key={cellIndex} className="m-auto size-6 rounded-[6px] bg-gray-6/80" />
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </section>
                </main>
            </div>
        </div>
    );
}

function HomePage() {
    const {t} = useTypedTranslation();
    const {i18n} = useTranslation();
    const locale = getLocaleForLanguage(i18n.resolvedLanguage ?? i18n.language);
    const navigate = useNavigate();
    const {
        state: {accessToken, wardId, accountMe},
    } = useAuth();
    const [selectedTodayTeamId, setSelectedTodayTeamId] = useState<number | 'all'>('all');
    const [selectedMonthlyTeamId, setSelectedMonthlyTeamId] = useState<TMonthlyTeamFilter>('all');
    const [monthlySortOption, setMonthlySortOption] = useState<TMonthlySortOption>('default');
    const [selectedCalendarSchedule, setSelectedCalendarSchedule] = useState<TWardBoardSchedule | null>(null);
    const today = useMemo(() => new Date(), []);
    const todayKey = toDateKey(today);
    const todayDateParts = useMemo(() => formatDateWithWeekdayParts(today, locale), [locale, today]);
    const headerWeekdayClassName = getHeaderWeekdayClassName(today.getDay());
    const currentYearMonth = {year: today.getFullYear(), month: today.getMonth() + 1};
    const nextYearMonth = getNextYearMonth(currentYearMonth.year, currentYearMonth.month);
    const monthStartKey = getMonthStartKey(currentYearMonth.year, currentYearMonth.month);
    const monthEndKey = getMonthEndKey(currentYearMonth.year, currentYearMonth.month);
    const calendarEndKey = toDateKey(addDays(today, TASK_LOOKAHEAD_DAYS));
    const boardCalendarEndKey = getMaxDateKey(monthEndKey, calendarEndKey);
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
    const deadlinesQuery = useQuery({
        queryKey: ['home', 'board-deadlines', wardId, monthStartKey, boardCalendarEndKey],
        queryFn: () => BoardAPI.getDeadlines(wardId!, monthStartKey, boardCalendarEndKey),
        enabled: wardId !== null,
        staleTime: 30_000,
    });
    const schedulesQuery = useQuery({
        queryKey: ['home', 'board-schedules', wardId, monthStartKey, boardCalendarEndKey],
        queryFn: () => BoardAPI.getSchedules(wardId!, monthStartKey, boardCalendarEndKey),
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
        monthlyTeamId === 'all' ? null : (currentScheduleStatusItems.find((item) => item.team.shiftTeamId === monthlyTeamId) ?? null);
    const monthlySourceItems =
        monthlyTeamId === 'all'
            ? currentScheduleStatusItems
            : currentScheduleStatusItems.filter((item) => item.team.shiftTeamId === monthlyTeamId);
    const monthlyRows = useMemo(
        () =>
            sortMonthlyShiftRows(
                monthlySourceItems.flatMap((item) => getMonthlyShiftRows(item, todayKey, currentYearMonth.year, currentYearMonth.month)),
                monthlySortOption,
                locale,
            ),
        [currentYearMonth.month, currentYearMonth.year, locale, monthlySortOption, monthlySourceItems, todayKey],
    );
    const deadlines = deadlinesQuery.data ?? [];
    const schedules = schedulesQuery.data ?? [];
    const calendarItems = useMemo(
        () => getCalendarItems(schedules, deadlines, todayKey, t, locale),
        [deadlines, locale, schedules, t, todayKey],
    );
    const waitingNurseCount = waitingNursesQuery.data?.length ?? 0;
    const pendingRequestCount = pendingRequestsQuery.data?.totalPendingCount ?? 0;
    const todayAssignedCount = todayDuties.reduce((total, duty) => total + duty.assignedCount, 0);
    const isBootstrapLoading = wardId !== null && (wardQuery.isPending || shiftTeamsQuery.isPending);
    const isBootstrapError = wardId !== null && (wardQuery.isError || shiftTeamsQuery.isError);
    const shouldShowNotificationBell = isWardAdminAccessToken(accessToken);
    const wardTitle = wardQuery.data ? `${wardQuery.data.hospitalName} ${wardQuery.data.name}` : t('page.home.fallback.ward');
    const trimmedManagerName = accountMe?.name?.trim() ?? '';
    const managerName = trimmedManagerName.length > 0 ? trimmedManagerName : t('page.home.fallback.manager');
    const monthlyOpenPath = buildMakePath({
        year: currentYearMonth.year,
        month: currentYearMonth.month,
        shiftTeamId: selectedMonthlyItem?.team.shiftTeamId,
    });
    const monthlyScheduleDescription =
        monthlyTeamId === 'all'
            ? t('page.home.monthly.descriptionAll', {month: formatMonth(currentYearMonth.year, currentYearMonth.month, locale)})
            : selectedMonthlyItem
              ? t('page.home.monthly.descriptionTeam', {
                    month: formatMonth(currentYearMonth.year, currentYearMonth.month, locale),
                    teamName: selectedMonthlyItem.team.name,
                })
              : formatMonth(currentYearMonth.year, currentYearMonth.month, locale);
    const monthlyEmptyTitle =
        monthlyTeamId === 'all'
            ? t('page.home.monthly.emptyAllTitle')
            : t('page.home.monthly.emptyTeamTitle', {teamName: selectedMonthlyItem?.team.name ?? t('page.home.fallback.selectedTeam')});

    if (wardId === null) {
        return (
            <div className="flex min-h-screen w-full bg-main-bg">
                <PageState
                    tone="empty"
                    layout="screen"
                    title={t('page.home.state.noWardTitle')}
                    description={t('page.home.state.noWardDescription')}
                />
            </div>
        );
    }

    if (isBootstrapLoading) {
        return <HomePageSkeleton />;
    }

    if (isBootstrapError) {
        return (
            <div className="flex min-h-screen w-full bg-main-bg">
                <PageState
                    tone="error"
                    layout="screen"
                    title={t('page.home.state.errorTitle')}
                    description={t('page.home.state.errorDescription')}
                    action={{
                        label: t('page.home.state.retry'),
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
        <div className="min-h-screen w-full min-w-[1080px] bg-main-bg px-8 py-6 font-apple">
            <div className="mx-auto flex w-full max-w-[1480px] flex-col gap-5">
                <header className="flex min-w-0 items-end justify-between gap-5">
                    <div className="min-w-0">
                        <p className="truncate text-[14px] font-bold text-gray-3">{wardTitle}</p>
                        <h1 className="mt-1 truncate text-[32px] leading-[40px] font-bold text-sub-1">
                            {todayDateParts.map((part, index) =>
                                part.type === 'weekday' ? (
                                    <span key={`${part.type}-${index}`} className={headerWeekdayClassName}>
                                        {part.value}
                                    </span>
                                ) : (
                                    <span key={`${part.type}-${index}`}>{part.value}</span>
                                ),
                            )}
                        </h1>
                        <p className="mt-1 text-[14px] font-semibold text-gray-3">
                            {t('page.home.header.todayAssigned', {managerName, count: todayAssignedCount})}
                        </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
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
                            {t('page.home.header.createNextMonth')}
                        </HomeButton>
                        {shouldShowNotificationBell ? <NotificationBell /> : null}
                    </div>
                </header>

                <main className="grid grid-cols-[minmax(0,1fr)_360px] gap-5">
                    <SectionShell title={t('page.home.sections.todayDuty')}>
                        <TeamFilter teams={shiftTeams} selectedTeamId={selectedTodayTeamId} onSelectTeam={setSelectedTodayTeamId} />
                        <div className="mt-4">
                            <TodayDutyOverview duties={visibleTodayDuties} />
                        </div>
                    </SectionShell>

                    <aside className="flex min-w-0 flex-col gap-5">
                        <SectionShell title={t('page.home.sections.tasks')}>
                            <div className="grid grid-cols-2 gap-2">
                                <QueueButton
                                    label={t('page.home.queue.pendingRequests')}
                                    value={pendingRequestCount}
                                    onClick={() => navigate(ROUTE.REQUEST)}
                                />
                                <QueueButton
                                    label={t('page.home.queue.waitingNurses')}
                                    value={waitingNurseCount}
                                    onClick={() => navigate(MEMBER_CONNECTION_MANAGE_PATH)}
                                />
                            </div>
                            {nextScheduleStatusItems.length > 0 ? (
                                <div className="mt-3 grid gap-2" aria-label={t('page.home.tasks.nextScheduleAria')}>
                                    {nextScheduleStatusItems.slice(0, 4).map((item) => (
                                        <NextScheduleTaskRow
                                            key={item.team.shiftTeamId}
                                            item={item}
                                            year={nextYearMonth.year}
                                            month={nextYearMonth.month}
                                            onNavigate={navigate}
                                        />
                                    ))}
                                </div>
                            ) : null}
                        </SectionShell>

                        <SectionShell
                            title={t('page.home.sections.calendar')}
                            action={<CalendarActionButton onClick={() => navigate(ROUTE.BOARD)} />}
                        >
                            <CalendarPreview
                                items={calendarItems}
                                isLoading={deadlinesQuery.isPending || schedulesQuery.isPending}
                                onOpen={() => navigate(ROUTE.BOARD)}
                                onOpenSchedule={setSelectedCalendarSchedule}
                            />
                        </SectionShell>
                    </aside>

                    <SectionShell
                        title={t('page.home.sections.monthly')}
                        description={monthlyScheduleDescription}
                        action={
                            <HomeButton variant="plain" onClick={() => navigate(monthlyOpenPath)}>
                                {t('page.home.monthly.edit')}
                            </HomeButton>
                        }
                        className="col-span-2"
                    >
                        <div className="mb-4 flex min-w-0 items-center justify-between gap-4">
                            <ScheduleTeamTabs teams={shiftTeams} selectedTeamId={monthlyTeamId} onSelectTeam={setSelectedMonthlyTeamId} />
                            <MonthlySortSelect value={monthlySortOption} onChange={setMonthlySortOption} />
                        </div>
                        <MonthlyScheduleTable
                            rows={monthlyRows}
                            hasTeams={shiftTeams.length > 0}
                            showTeamName={monthlyTeamId === 'all'}
                            emptyTitle={monthlyEmptyTitle}
                            emptyDescription={t('page.home.monthly.emptyDescription')}
                            locale={locale}
                            onOpen={() => navigate(monthlyOpenPath)}
                        />
                    </SectionShell>
                </main>
                {selectedCalendarSchedule ? (
                    <WardScheduleViewModal
                        schedule={selectedCalendarSchedule}
                        locale={locale}
                        onClose={() => setSelectedCalendarSchedule(null)}
                    />
                ) : null}
            </div>
        </div>
    );
}

export default HomePage;
