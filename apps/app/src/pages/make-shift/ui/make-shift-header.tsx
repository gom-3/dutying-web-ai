import toast from 'react-hot-toast';
import useAuth from '@/features/auth';
import {isWardAdminAccessToken} from '@/features/auth/model/admin-token';
import {MonthlyMemoButton} from '@/features/monthly-memo';
import {useTypedTranslation} from '@/shared/hook/use-typed-translation';
import {isMakeShiftMonthAtOrAfterMaxFutureCalendarMonth, isMakeShiftPreviousMonthDisabled} from '@/shared/lib/shift-calendar-month-policy';
import {DutyManagementMonthTeamHeader} from '@/widgets/duty-management/ui';
import {useMakeShiftStore} from '../model/make-shift-store';

function getPrevYearMonth(year: number, month: number) {
    return month <= 1 ? {year: year - 1, month: 12} : {year, month: month - 1};
}

function getNextYearMonth(year: number, month: number) {
    return month >= 12 ? {year: year + 1, month: 1} : {year, month: month + 1};
}

type TMakeShiftHeaderProps = {
    onBeforeContextChange?: (action: () => void) => void;
};

export function MakeShiftHeader({onBeforeContextChange}: TMakeShiftHeaderProps = {}) {
    const {t} = useTypedTranslation();
    const {
        state: {accessToken},
    } = useAuth();
    const wardId = useMakeShiftStore((s) => s.wardId);
    const year = useMakeShiftStore((s) => s.year);
    const month = useMakeShiftStore((s) => s.month);
    const shiftTeams = useMakeShiftStore((s) => s.shiftTeams);
    const currentShiftTeamId = useMakeShiftStore((s) => s.currentShiftTeamId);
    const goPrevMonth = useMakeShiftStore((s) => s.goPrevMonth);
    const goNextMonth = useMakeShiftStore((s) => s.goNextMonth);
    const setCurrentShiftTeamId = useMakeShiftStore((s) => s.setCurrentShiftTeamId);
    const prevMonthDisabled = isMakeShiftPreviousMonthDisabled();
    const nextMonthDisabled = isMakeShiftMonthAtOrAfterMaxFutureCalendarMonth(year, month);
    const shouldReserveNotificationSpace = isWardAdminAccessToken(accessToken);
    const currentShiftTeamName =
        shiftTeams.find((team) => team.shiftTeamId === currentShiftTeamId)?.name ?? t('page.makeShift.overview.selectedTeamFallback');
    const showContextToast = (nextYear: number, nextMonth: number, teamName: string) => {
        toast.success(t('page.makeShift.context.switchToast', {year: nextYear, month: nextMonth, teamName}), {
            id: 'make-shift-context-switch',
        });
    };
    const handlePrevMonth = () => {
        const changeContext = () => {
            const next = getPrevYearMonth(year, month);

            goPrevMonth();
            showContextToast(next.year, next.month, currentShiftTeamName);
        };

        if (onBeforeContextChange) {
            onBeforeContextChange(changeContext);
            return;
        }

        changeContext();
    };
    const handleNextMonth = () => {
        const changeContext = () => {
            const next = getNextYearMonth(year, month);

            goNextMonth();
            showContextToast(next.year, next.month, currentShiftTeamName);
        };

        if (onBeforeContextChange) {
            onBeforeContextChange(changeContext);
            return;
        }

        changeContext();
    };
    const handleSelectShiftTeam = (shiftTeamId: number) => {
        if (shiftTeamId === currentShiftTeamId) return;

        const changeContext = () => {
            const nextTeamName =
                shiftTeams.find((team) => team.shiftTeamId === shiftTeamId)?.name ?? t('page.makeShift.overview.selectedTeamFallback');

            setCurrentShiftTeamId(shiftTeamId);
            showContextToast(year, month, nextTeamName);
        };

        if (onBeforeContextChange) {
            onBeforeContextChange(changeContext);
            return;
        }

        changeContext();
    };

    return (
        <div className="flex min-w-0 flex-wrap items-center justify-between gap-3">
            <DutyManagementMonthTeamHeader
                year={year}
                month={month}
                prevLabel={t('page.duty.prevMonth')}
                nextLabel={t('page.duty.nextMonth')}
                shiftTeams={shiftTeams}
                currentShiftTeamId={currentShiftTeamId}
                onPrevMonth={handlePrevMonth}
                onNextMonth={handleNextMonth}
                onSelectShiftTeam={handleSelectShiftTeam}
                emptyLabel={t('page.makeShift.overview.noTeamsLabel')}
                formatMonthLabel={(headerYear, headerMonth) => t('page.duty.monthHeader', {year: headerYear, month: headerMonth})}
                prevMonthDisabled={prevMonthDisabled}
                nextMonthDisabled={nextMonthDisabled}
                teamTone="darkSegmented"
            />
            <MonthlyMemoButton
                wardId={wardId}
                year={year}
                month={month}
                className={shouldReserveNotificationSpace ? 'mr-[68px]' : undefined}
            />
        </div>
    );
}
