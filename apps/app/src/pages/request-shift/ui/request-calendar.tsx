import {cn} from '@dutying/utils/style';
import {ArrowRight, UserPlus} from 'lucide-react';
import {useCallback, useMemo, useRef} from 'react';
import useOnclickOutside from 'react-cool-onclickoutside';
import {useNavigate} from 'react-router-dom';
import {events, sendEvent} from '@/analytics';
import {useUIConfigStore} from '@/entities/ui/useUIConfig/store';
import useAuth from '@/features/auth';
import useRequestShift from '@/features/request-shift';
import {getWardSkillSettings, resolveWardSkillLevels} from '@/features/ward-skill/model/skill-level';
import ROUTE from '@/shared/constant/path';
import {useTypedTranslation} from '@/shared/hook/use-typed-translation';
import {ManagementActionButton} from '@/widgets/duty-management/ui';
import RequestCalendarGrid from './request-calendar/request-calendar-grid';
import RequestCalendarHeader from './request-calendar/request-calendar-header';
import RequestDutyRequestPanel from './request-calendar/request-duty-request-panel';
import {useRequestCalendarFocusScroll} from './request-calendar/use-request-calendar-focus-scroll';
import {createConnectedNurseIdSet, createDutyRequestLookup, createShiftNurseIdByNurseId} from './request-calendar/utils';

type TRequestCalendarProps = {
    defaultReviewMode?: 'date' | 'request' | 'pending' | 'nurse';
};

export default function ShiftCalendar({defaultReviewMode}: TRequestCalendarProps = {}) {
    const {t} = useTypedTranslation();
    const navigate = useNavigate();
    const {
        state: {
            year,
            month,
            requestShift,
            dutyRequestList,
            dutyRequestStatus,
            updatingRequestId,
            focus,
            wardShiftTypeMap,
            currentShiftTeam,
            shiftTeams,
            editAvailability,
        },
        actions: {changeFocus, acceptRequest, acceptRequests, retry},
    } = useRequestShift();
    const {
        state: {wardId},
    } = useAuth();
    const separateWeekendColor = useUIConfigStore((state) => state.separateWeekendColor);
    const focusedCellRef = useRef<HTMLDivElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const clickAwayRef = useOnclickOutside(() => {
        changeFocus(null);
    });
    const handleSelectCell = useCallback(
        (nextFocus: Parameters<typeof changeFocus>[0]) => {
            changeFocus(nextFocus);
            sendEvent(events.requestPage.calendar.focusCell);
        },
        [changeFocus],
    );
    const skillSettings = useMemo(() => getWardSkillSettings(wardId), [wardId]);
    const allWardNurses = useMemo(
        () => shiftTeams?.flatMap((shiftTeam) => shiftTeam.nurses) ?? currentShiftTeam?.nurses ?? [],
        [currentShiftTeam?.nurses, shiftTeams],
    );
    const {config: skillConfig, levelsByNurseId} = useMemo(
        () => resolveWardSkillLevels(allWardNurses, skillSettings),
        [allWardNurses, skillSettings],
    );
    const hasCurrentTeamNurses = (currentShiftTeam?.nurses.length ?? 0) > 0;
    const goToMemberSettings = useCallback(() => {
        if (!currentShiftTeam) return;

        navigate(`${ROUTE.MEMBER}?shiftTeamId=${currentShiftTeam.shiftTeamId}`);
    }, [currentShiftTeam, navigate]);

    useRequestCalendarFocusScroll({focus, focusedCellRef, containerRef});

    if (!requestShift || !wardShiftTypeMap || !currentShiftTeam) return null;

    const canEditRequests = editAvailability.canEdit;
    const dutyRequestLookup = createDutyRequestLookup(dutyRequestList);
    const connectedNurseIds = createConnectedNurseIdSet(currentShiftTeam);
    const shiftNurseIdByNurseId = createShiftNurseIdByNurseId(requestShift);

    return (
        <div
            id="calendar"
            className={cn(
                'mx-auto mt-2 grid min-h-0 w-full max-w-none min-w-[1160px] flex-1 grid-cols-[minmax(876px,1fr)_minmax(271px,clamp(271px,18vw,344px))] items-start gap-3',
                !hasCurrentTeamNurses && 'items-stretch',
            )}
        >
            <section
                className={cn('min-h-0 min-w-0 overflow-hidden rounded-[18px] bg-white p-2', !hasCurrentTeamNurses && 'h-full')}
                aria-label="신청 근무표"
            >
                <div ref={clickAwayRef} className="flex h-full min-h-0 flex-col rounded-[18px] bg-white">
                    {hasCurrentTeamNurses ? (
                        <div ref={containerRef} className="min-h-[420px] w-full overflow-x-auto overflow-y-visible rounded-[18px] bg-white">
                            <div className="min-w-[860px]">
                                <RequestCalendarHeader
                                    days={requestShift.days}
                                    focusDay={focus?.day}
                                    separateWeekendColor={separateWeekendColor}
                                />
                                <RequestCalendarGrid
                                    requestShift={requestShift}
                                    focus={focus}
                                    readonly
                                    separateWeekendColor={separateWeekendColor}
                                    wardShiftTypeMap={wardShiftTypeMap}
                                    dutyRequestLookup={dutyRequestLookup}
                                    connectedNurseIds={connectedNurseIds}
                                    skillConfig={skillConfig}
                                    levelsByNurseId={levelsByNurseId}
                                    focusedCellRef={focusedCellRef}
                                    onSelectCell={handleSelectCell}
                                />
                            </div>
                        </div>
                    ) : (
                        <div className="flex h-full min-h-[240px] flex-col items-center justify-center px-4 py-8 text-center">
                            <div className="grid size-12 place-items-center rounded-full bg-main-light text-main-1 shadow-[inset_0_0_0_1px_rgba(112,82,255,0.10)]">
                                <UserPlus aria-hidden className="size-6" strokeWidth={2.2} />
                            </div>
                            <p className="mt-5 max-w-[520px] font-apple text-[22px] leading-[1.35] font-semibold break-keep text-sub-1">
                                <span className="text-main-1">{currentShiftTeam.name}</span>
                                {t('page.request.calendar.noNurseTitleSuffix')}
                            </p>
                            <p className="mt-2 max-w-[560px] font-apple text-[15px] leading-6 font-medium break-keep text-gray-3">
                                {t('page.request.calendar.noNurseDescription')}
                            </p>
                            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                                <ManagementActionButton
                                    size="sm"
                                    variant="primary"
                                    className="h-11 cursor-pointer rounded-[12px] px-5 text-[15px]"
                                    onClick={goToMemberSettings}
                                >
                                    {t('page.request.calendar.noNurseAction')}
                                    <ArrowRight aria-hidden className="size-4" />
                                </ManagementActionButton>
                            </div>
                        </div>
                    )}
                </div>
            </section>
            <RequestDutyRequestPanel
                year={year}
                month={month}
                days={requestShift.days}
                dutyRequestList={dutyRequestList}
                dutyRequestStatus={dutyRequestStatus}
                wardShiftTypeMap={wardShiftTypeMap}
                canEdit={canEditRequests}
                updatingRequestId={updatingRequestId}
                shiftNurseIdByNurseId={shiftNurseIdByNurseId}
                changeFocus={changeFocus}
                acceptRequest={acceptRequest}
                acceptRequests={acceptRequests}
                retry={retry}
                onAcceptAnalytics={(accepted) => sendEvent(events.requestPage.acceptRequest, String(accepted))}
                defaultReviewMode={defaultReviewMode}
                className={!hasCurrentTeamNurses ? 'h-full' : undefined}
            />
        </div>
    );
}
