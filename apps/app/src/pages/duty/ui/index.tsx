import {type TViolation} from '@/features/shift-editor/model';
import {MakeShiftCalendar} from '@/pages/make-shift/ui/steps/shared/make-shift-calendar';
import {useTypedTranslation} from '@/shared/hook/use-typed-translation';
import PageState from '@/shared/ui/PageState';
import {DutyManagementMonthTeamHeader, DutyManagementStatusCard, ManagementActionButton} from '@/widgets/duty-management/ui';
import WardCodeGuideModal from '@/widgets/ward-code-guide-modal';
import {type TDutyHook} from '../model/duty-hook';

/** /duty에서는 규칙 위반을 표시하지 않으므로 빈 맵만 전달한다. */
const EMPTY_VIOLATION_MAP: Map<string, TViolation> = new Map();

type TDutyPageViewProps = {
    duty: TDutyHook;
};

export const DutyPageView = ({duty}: TDutyPageViewProps) => {
    const {state, handlers, refs} = duty;
    const {t} = useTypedTranslation();
    const wardCodeLabel = state.wardCode || '확인 중';
    const showBootstrapLoadingState = state.bootstrapStatus === 'pending';
    const showBootstrapErrorState = state.bootstrapStatus === 'error';
    const showNoTeamsState = state.shiftTeamsStatus === 'success' && state.shiftTeams.length === 0;
    const showShiftTeamsErrorState = state.shiftTeamsStatus === 'error';
    const teamsReady = state.shiftTeamsStatus === 'success' && state.shiftTeams.length > 0;
    const showLoadingState = state.shiftTeamsStatus === 'pending' || (teamsReady && state.isDutyViewAllowed && state.status === 'pending');
    const headerDisabled = showBootstrapLoadingState || showBootstrapErrorState || !teamsReady;

    return (
        <div className="flex min-h-screen w-full flex-col bg-[#FAF8FB] px-10 py-10">
            <WardCodeGuideModal
                open={state.showOnboardingWardCreatedModal}
                wardCode={wardCodeLabel}
                wardTitle={state.wardTitle}
                onClose={handlers.dismissOnboardingWardCreatedModal}
            />
            <DutyManagementMonthTeamHeader
                year={state.year}
                month={state.month}
                prevLabel={t('page.duty.prevMonth')}
                nextLabel={t('page.duty.nextMonth')}
                shiftTeams={state.shiftTeams}
                currentShiftTeamId={state.currentShiftTeamId}
                onPrevMonth={handlers.goPrevMonth}
                onNextMonth={handlers.goNextMonth}
                onSelectShiftTeam={handlers.selectShiftTeam}
                emptyLabel={t('page.duty.noTeamsLabel')}
                formatMonthLabel={(year, month) => t('page.duty.monthHeader', {year, month})}
                disabled={headerDisabled}
                nextMonthDisabled={!state.isDutyViewAllowed || state.dutyAtMaxFutureMonth}
            />

            <div className="mt-[14px] flex flex-1 flex-col rounded-[20px] bg-[#FAF8FB] px-10 py-7">
                {showBootstrapLoadingState && (
                    <PageState
                        tone="loading"
                        title="계정 정보를 확인하고 있어요"
                        description="병동 정보를 확인한 뒤 확정 근무표 화면을 준비하고 있어요."
                        className="py-0"
                    />
                )}
                {showBootstrapErrorState && (
                    <PageState
                        tone="error"
                        title="병동 정보를 불러오지 못했어요"
                        description="계정 정보를 다시 확인해 주세요. 문제가 계속되면 다시 로그인해 주세요."
                        action={{label: t('page.state.retry'), onClick: handlers.retry}}
                        className="py-0"
                    />
                )}
                {!showBootstrapLoadingState && !showBootstrapErrorState && showNoTeamsState && (
                    <PageState
                        tone="empty"
                        title={t('page.duty.noTeamsTitle')}
                        description={t('page.duty.noTeamsDescription')}
                        className="py-0"
                    />
                )}
                {!showBootstrapLoadingState && !showBootstrapErrorState && showShiftTeamsErrorState && (
                    <PageState
                        tone="error"
                        title={t('page.duty.teamsError')}
                        description={t('page.state.errorDescription')}
                        action={{label: t('page.state.retry'), onClick: handlers.retry}}
                        className="py-0"
                    />
                )}
                {!showBootstrapLoadingState && !showBootstrapErrorState && showLoadingState && (
                    <PageState
                        tone="loading"
                        title={t('page.duty.loading')}
                        description={t('page.state.loadingDescription')}
                        className="py-0"
                    />
                )}
                {!showBootstrapLoadingState && !showBootstrapErrorState && teamsReady && !state.isDutyViewAllowed && (
                    <DutyManagementStatusCard
                        title={t('page.duty.viewRangeTitle')}
                        description={t('page.duty.viewRangeDescription')}
                        className="min-h-[360px] flex-1 border-0 bg-transparent"
                    />
                )}
                {!showBootstrapLoadingState &&
                    !showBootstrapErrorState &&
                    teamsReady &&
                    state.isDutyViewAllowed &&
                    state.status === 'error' && (
                        <PageState
                            tone="error"
                            title={t('page.duty.error')}
                            description={t('page.state.errorDescription')}
                            action={{label: t('page.state.retry'), onClick: handlers.retry}}
                            className="py-0"
                        />
                    )}
                {!showBootstrapLoadingState &&
                    !showBootstrapErrorState &&
                    teamsReady &&
                    state.isDutyViewAllowed &&
                    state.status === 'success' &&
                    state.shift && (
                        <>
                            <div className="flex flex-wrap items-center justify-between gap-4">
                                <div className="flex items-center gap-6">
                                    <h1 className="text-gray-1 font-apple text-[40px] font-semibold">
                                        {state.currentShiftTeamId
                                            ? `${state.currentShiftTeamName} ${t('page.duty.confirmedShift')}`
                                            : t('page.duty.title')}
                                    </h1>
                                    {state.dutyViewingThisCalendarMonth && (
                                        <ManagementActionButton
                                            variant="outline"
                                            className="h-11 px-5 text-2xl"
                                            onClick={handlers.goNextMonthMake}
                                        >
                                            {t('page.duty.createNextMonth')}
                                        </ManagementActionButton>
                                    )}
                                </div>

                                <div className="ml-auto flex items-center gap-3">
                                    {state.readonly ? (
                                        <>
                                            <ManagementActionButton variant="neutral" onClick={handlers.postShift}>
                                                {t('page.duty.publish')}
                                            </ManagementActionButton>
                                            <ManagementActionButton
                                                variant="neutral"
                                                onClick={handlers.exportExcel}
                                                disabled={state.isExportingExcel}
                                            >
                                                {state.isExportingExcel ? t('page.duty.exportExcelLoading') : t('page.duty.exportExcel')}
                                            </ManagementActionButton>
                                            <ManagementActionButton onClick={handlers.enableEdit}>
                                                {t('page.duty.editShift')}
                                            </ManagementActionButton>
                                        </>
                                    ) : (
                                        <>
                                            <ManagementActionButton variant="neutral" onClick={handlers.cancelEdit}>
                                                {t('page.duty.cancel')}
                                            </ManagementActionButton>
                                            <ManagementActionButton onClick={handlers.saveEdit}>
                                                {t('page.duty.save')}
                                            </ManagementActionButton>
                                        </>
                                    )}
                                </div>
                            </div>

                            <div
                                ref={refs.editorRef}
                                className="mt-6 w-full min-w-0 flex-1 outline-none"
                                tabIndex={0}
                                onKeyDown={state.readonly ? undefined : handlers.onKeyDown}
                                onPasteCapture={state.readonly ? undefined : handlers.onPasteCapture}
                            >
                                <MakeShiftCalendar
                                    shift={state.shift}
                                    doc={state.doc}
                                    violationMap={EMPTY_VIOLATION_MAP}
                                    showFaults={false}
                                    readonly={state.readonly}
                                    disableInitialSelection
                                    onCellClick={() => refs.editorRef.current?.focus()}
                                />
                            </div>
                        </>
                    )}
                {!showBootstrapLoadingState &&
                    !showBootstrapErrorState &&
                    teamsReady &&
                    state.isDutyViewAllowed &&
                    state.status === 'success' &&
                    !state.shift &&
                    state.dutyPastStrictlyBeforeLastMonth && (
                        <DutyManagementStatusCard
                            className="min-h-[400px] flex-1 border-0 bg-transparent"
                            title={t('page.duty.pastEmptyScheduleTitle', {
                                teamName: state.currentShiftTeamName,
                                month: state.month,
                            })}
                        />
                    )}
                {!showBootstrapLoadingState &&
                    !showBootstrapErrorState &&
                    teamsReady &&
                    state.isDutyViewAllowed &&
                    state.status === 'success' &&
                    !state.shift &&
                    !state.dutyPastStrictlyBeforeLastMonth && (
                        <DutyManagementStatusCard
                            className="min-h-[400px] flex-1 border-0 bg-transparent"
                            title={t('page.duty.emptyScheduleTitle', {
                                teamName: state.currentShiftTeamName,
                                month: state.month,
                            })}
                            description={t('page.duty.emptyScheduleDescription')}
                            actions={
                                <ManagementActionButton size="lg" onClick={handlers.goCurrentMonthMake}>
                                    {t('page.duty.createShiftFlow')}
                                </ManagementActionButton>
                            }
                        />
                    )}
            </div>
        </div>
    );
};
