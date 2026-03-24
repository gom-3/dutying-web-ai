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
    const isSaved = changeStatus === 'success';
    const hasSaveError = changeStatus === 'error';
    const title = readonly ? t('page.request.toolbar.readonlyTitle', {month}) : t('page.request.toolbar.editTitle');
    const actionLabel = isSaving
        ? t('page.request.toolbar.savingAction')
        : readonly
          ? t('page.request.toolbar.editAction')
          : t('page.request.toolbar.saveAction');
    const feedback =
        hasSaveError
            ? {
                  tone: 'error' as const,
                  message: t('page.request.toolbar.saveError'),
              }
            : isSaving
              ? {
                    tone: 'info' as const,
                    message: t('page.request.toolbar.savingDescription'),
                }
              : isSaved
                ? {
                      tone: 'success' as const,
                      message: t('page.request.toolbar.savedDescription'),
                  }
                : readonly
                  ? {
                        tone: 'neutral' as const,
                        message: editAvailability.canEdit
                            ? t('page.request.toolbar.readonlyDescription')
                            : editAvailability.description,
                    }
                  : {
                        tone: 'info' as const,
                        message: t('page.request.toolbar.editingDescription'),
                    };
    const feedbackClassName = cn(
        'mt-[-24px] font-apple text-base font-medium',
        feedback.tone === 'error'
            ? 'text-sub-2'
            : feedback.tone === 'success'
              ? 'text-green-600'
              : feedback.tone === 'info'
                ? 'text-main-2'
                : 'text-gray-4',
    );

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
                    if (!changeMonth('prev')) return;

                    sendEvent(events.requestPage.toolbar.changeMonth);
                }}
                onNextMonth={() => {
                    if (!changeMonth('next')) return;

                    sendEvent(events.requestPage.toolbar.changeMonth);
                }}
                onSelectShiftTeam={(shiftTeamId) => {
                    if (isSaving) return;

                    const nextTeam = shiftTeams?.find((shiftTeam) => shiftTeam.shiftTeamId === shiftTeamId);

                    if (!nextTeam) return;

                    if (!changeShiftTeam(nextTeam)) return;

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
                        if (!toggleEditMode()) return;

                        sendEvent(events.requestPage.toolbar.changeEditMode, readonly ? 'edit' : 'save');
                    }}
                >
                    {actionLabel}
                </button>
            </div>

            <p className={feedbackClassName}>{feedback.message}</p>
        </div>
    );
}

export default Toolbar;
