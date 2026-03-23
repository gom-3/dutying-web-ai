import {cn} from '@dutying/utils/style';
import {events, sendEvent} from '@/analytics';
import useRequestShift from '@/features/shift/useRequestShift';
import {ChevronLeftIcon, ChevronRightIcon} from '@/shared/assets/svg';
import {useTypedTranslation} from '@/shared/hook/use-typed-translation';
import {DutyManagementMonthTeamHeader} from '@/widgets/duty-management/ui';

function Toolbar() {
    const {t} = useTypedTranslation();
    const {
        state: {year, month, changeStatus, currentShiftTeam, shiftTeams, readonly, editAvailability},
        actions: {changeMonth, changeShiftTeam, toggleEditMode},
    } = useRequestShift();
    const isSaving = changeStatus === 'loading';
    const title = readonly ? t('page.request.toolbar.readonlyTitle', {month}) : t('page.request.toolbar.editTitle');
    const actionLabel = isSaving
        ? t('page.request.toolbar.savingAction')
        : readonly
          ? t('page.request.toolbar.editAction')
          : t('page.request.toolbar.saveAction');

    return (
        <div id="toolbar" className="flex flex-col gap-10">
            <DutyManagementMonthTeamHeader
                year={year}
                month={month}
                prevLabel={t('page.duty.prevMonth')}
                nextLabel={t('page.duty.nextMonth')}
                shiftTeams={shiftTeams ?? []}
                currentShiftTeamId={currentShiftTeam?.shiftTeamId ?? null}
                onPrevMonth={() => {
                    if (isSaving) return;

                    changeMonth('prev');
                    sendEvent(events.requestPage.toolbar.changeMonth);
                }}
                onNextMonth={() => {
                    if (isSaving) return;

                    changeMonth('next');
                    sendEvent(events.requestPage.toolbar.changeMonth);
                }}
                onSelectShiftTeam={(shiftTeamId) => {
                    if (isSaving) return;

                    const nextTeam = shiftTeams?.find((shiftTeam) => shiftTeam.shiftTeamId === shiftTeamId);

                    if (!nextTeam) return;

                    changeShiftTeam(nextTeam);
                    sendEvent(events.requestPage.toolbar.changeShiftTeam);
                }}
                emptyLabel={t('page.request.toolbar.noTeamsLabel')}
                formatMonthLabel={(targetYear, targetMonth) => t('page.duty.monthHeader', {year: targetYear, month: targetMonth})}
                disabled={isSaving}
            />

            <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <h1 className="text-gray-1 font-apple text-[28px] font-semibold md:text-[2.375rem]">{title}</h1>

                    {!readonly ? (
                        <div className="flex items-center gap-2" aria-hidden="true">
                            <div className="grid size-[26px] place-items-center rounded-full border border-main-3 bg-white text-main-2">
                                <ChevronLeftIcon className="h-4 w-4" />
                            </div>
                            <div className="grid size-[26px] place-items-center rounded-full border border-main-3 bg-white text-main-2">
                                <ChevronRightIcon className="h-4 w-4" />
                            </div>
                        </div>
                    ) : null}
                </div>

                <button
                    id={readonly ? 'editButton' : undefined}
                    type="button"
                    className={cn(
                        'inline-flex h-[42px] items-center justify-center rounded-[10px] px-5 font-apple text-2xl font-semibold text-white transition-colors disabled:cursor-not-allowed disabled:opacity-50',
                        readonly ? 'bg-gray-3 hover:bg-[#556176]' : 'bg-main-1 hover:bg-[#5A34ED]',
                    )}
                    disabled={isSaving || (readonly && !editAvailability.canEdit)}
                    onClick={() => {
                        if (isSaving) return;

                        toggleEditMode();
                        sendEvent(events.requestPage.toolbar.changeEditMode, readonly ? 'edit' : 'save');
                    }}
                >
                    {actionLabel}
                </button>
            </div>

            {readonly && !editAvailability.canEdit ? (
                <p className="mt-[-24px] font-apple text-base font-medium text-gray-4">{editAvailability.description}</p>
            ) : null}

            {changeStatus === 'error' ? (
                <p className="mt-[-24px] font-apple text-base font-medium text-sub-2">{t('page.request.toolbar.saveError')}</p>
            ) : null}
        </div>
    );
}

export default Toolbar;
