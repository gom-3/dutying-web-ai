import {cn} from '@dutying/utils/style';
import {AlertCircle, CheckCircle2, Loader2, Settings} from 'lucide-react';
import {useState} from 'react';
import {events, sendEvent} from '@/analytics';
import useRequestShift from '@/features/request-shift';
import {useTypedTranslation} from '@/shared/hook/use-typed-translation';
import {DutyManagementMonthTeamHeader} from '@/widgets/duty-management/ui';
import RequestReceptionSettingsModal from './request-reception-settings-modal';

function Toolbar() {
    const {t} = useTypedTranslation();
    const [isReceptionSettingsOpen, setIsReceptionSettingsOpen] = useState(false);
    const {
        state: {year, month, changeStatus, currentShiftTeam, shiftTeams, teamPendingRequestCountByTeamId, editAvailability},
        actions: {changeMonth, changeShiftTeam},
    } = useRequestShift();
    const isSaving = changeStatus === 'loading';
    const isSaved = changeStatus === 'success';
    const hasSaveError = changeStatus === 'error';
    const title = editAvailability.canEdit ? t('page.request.toolbar.editTitle') : t('page.request.toolbar.readonlyTitle', {month});
    const headerShiftTeams = (shiftTeams ?? []).map((team) => ({
        ...team,
        pendingCount: teamPendingRequestCountByTeamId?.[team.shiftTeamId] ?? 0,
    }));
    const feedback = hasSaveError
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
            : {
                  tone: 'neutral' as const,
                  message: editAvailability.description,
              };
    const shouldShowFeedback = hasSaveError || isSaving || isSaved || !editAvailability.canEdit;
    const feedbackIcon =
        feedback.tone === 'error' ? (
            <AlertCircle className="h-3.5 w-3.5" />
        ) : feedback.tone === 'success' ? (
            <CheckCircle2 className="h-3.5 w-3.5" />
        ) : isSaving ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : null;
    const feedbackClassName = cn(
        'inline-flex min-h-7 items-center gap-1.5 rounded-full px-2.5 font-apple text-[12px] font-medium',
        feedback.tone === 'error'
            ? 'bg-[#FFF7F8] text-red'
            : feedback.tone === 'success'
              ? 'bg-[#F0FBF4] text-[#168A45]'
              : feedback.tone === 'info'
                ? 'bg-main-light text-main-1'
                : 'bg-gray-7 text-gray-3',
    );

    return (
        <>
            <div id="toolbar" className="mx-auto flex w-full max-w-none flex-col gap-2">
                <DutyManagementMonthTeamHeader
                    year={year}
                    month={month}
                    prevLabel={t('page.duty.prevMonth')}
                    nextLabel={t('page.duty.nextMonth')}
                    shiftTeams={headerShiftTeams}
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
                        const nextTeam = shiftTeams?.find((shiftTeam) => shiftTeam.shiftTeamId === shiftTeamId);

                        if (!nextTeam) return;

                        if (!changeShiftTeam(nextTeam)) return;

                        sendEvent(events.requestPage.toolbar.changeShiftTeam);
                    }}
                    emptyLabel={t('page.request.toolbar.noTeamsLabel')}
                    formatMonthLabel={(headerYear, headerMonth) => t('page.duty.monthHeader', {year: headerYear, month: headerMonth})}
                    disabled={isSaving}
                    teamTone="darkSegmented"
                />

                <div className="flex flex-col gap-2 py-3 md:flex-row md:items-end md:justify-between">
                    <div className="min-w-0">
                        <h1 className="font-apple text-[30px] font-semibold text-sub-1">{title}</h1>
                        {shouldShowFeedback ? (
                            <p className={cn('mt-2', feedbackClassName)} aria-live="polite">
                                {feedbackIcon}
                                {feedback.message}
                            </p>
                        ) : null}
                    </div>
                    <button
                        type="button"
                        className="inline-flex h-10 shrink-0 items-center gap-2 self-start rounded-[10px] bg-white px-3.5 font-apple text-[13px] font-semibold text-sub-1 shadow-[0_1px_3px_rgba(15,23,42,0.08)] ring-1 ring-gray-6 transition-colors hover:bg-gray-7 hover:text-sub-1 hover:ring-gray-5 focus-visible:ring-2 focus-visible:ring-main-1/40 focus-visible:outline-none md:self-auto"
                        onClick={() => setIsReceptionSettingsOpen(true)}
                    >
                        <Settings className="h-4 w-4" aria-hidden="true" />
                        {t('page.request.toolbar.settingsAction')}
                    </button>
                </div>
            </div>
            <RequestReceptionSettingsModal open={isReceptionSettingsOpen} onOpenChange={setIsReceptionSettingsOpen} />
        </>
    );
}

export default Toolbar;
