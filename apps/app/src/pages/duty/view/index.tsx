import {MakeShiftEditorView} from '@/features/shift-editor';
import {useTypedTranslation} from '@/shared/hook/use-typed-translation';
import PageState from '@/shared/ui/PageState';
import {DutyManagementMonthTeamHeader, ManagementActionButton} from '@/widgets/duty-management/ui';
import {type TDutyHook} from '../model/dutyHook';

type TDutyPageViewProps = {
    duty: TDutyHook;
};

export const DutyPageView = ({duty}: TDutyPageViewProps) => {
    const {state, handlers, refs} = duty;
    const {t} = useTypedTranslation();
    const showBootstrapLoadingState = state.bootstrapStatus === 'pending';
    const showBootstrapErrorState = state.bootstrapStatus === 'error';
    const showNoTeamsState = state.shiftTeamsStatus === 'success' && state.shiftTeams.length === 0;
    const showShiftTeamsErrorState = state.shiftTeamsStatus === 'error';
    const showLoadingState =
        state.shiftTeamsStatus === 'pending' ||
        (state.shiftTeamsStatus === 'success' && state.shiftTeams.length > 0 && state.status === 'pending');

    return (
        <div className="flex min-h-screen w-full flex-col px-10 py-10">
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
            />

            <div className="mt-[14px] flex flex-1 flex-col rounded-[20px] bg-white px-10 py-7">
                <div className="flex flex-wrap items-center justify-between gap-4">
                    <div className="flex items-center gap-6">
                        <h1 className="text-gray-1 font-apple text-[40px] font-semibold">
                            {state.currentShiftTeamId
                                ? `${state.currentShiftTeamName} ${t('page.duty.confirmedShift')}`
                                : t('page.duty.title')}
                        </h1>
                        <ManagementActionButton variant="outline" className="h-11 px-5 text-2xl" onClick={handlers.goNextMonthMake}>
                            {t('page.duty.createNextMonth')}
                        </ManagementActionButton>
                    </div>

                    <div className="ml-auto flex items-center gap-3">
                        {state.readonly ? (
                            <>
                                <ManagementActionButton variant="neutral" onClick={handlers.postShift} disabled={!state.shift}>
                                    {t('page.duty.publish')}
                                </ManagementActionButton>
                                <ManagementActionButton variant="neutral" onClick={handlers.exportExcel} disabled={!state.shift}>
                                    {t('page.duty.exportExcel')}
                                </ManagementActionButton>
                                <ManagementActionButton onClick={handlers.enableEdit} disabled={!state.shift}>
                                    {t('page.duty.editShift')}
                                </ManagementActionButton>
                            </>
                        ) : (
                            <>
                                <ManagementActionButton variant="neutral" onClick={handlers.cancelEdit}>
                                    {t('page.duty.cancel')}
                                </ManagementActionButton>
                                <ManagementActionButton onClick={handlers.saveEdit}>{t('page.duty.save')}</ManagementActionButton>
                            </>
                        )}
                    </div>
                </div>

                <div className="mt-6 min-h-0 flex-1 overflow-auto">
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
                    {!showBootstrapLoadingState &&
                        !showBootstrapErrorState &&
                        state.shiftTeamsStatus === 'success' &&
                        state.shiftTeams.length > 0 &&
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
                        state.shiftTeamsStatus === 'success' &&
                        state.shiftTeams.length > 0 &&
                        state.status === 'success' &&
                        !state.shift && (
                        <PageState
                            tone="empty"
                            title={t('page.duty.emptyTitle', {teamName: state.currentShiftTeamName, month: state.month})}
                            description={t('page.duty.emptyDescription', {month: state.month})}
                            className="py-0"
                        >
                            <div className="mt-1 flex justify-center">
                                <ManagementActionButton variant="secondary" size="lg" onClick={handlers.goCurrentMonthMake}>
                                    {t('page.duty.createCurrentMonth')}
                                </ManagementActionButton>
                            </div>
                        </PageState>
                    )}
                    {!showBootstrapLoadingState && !showBootstrapErrorState && state.status === 'success' && state.shift && (
                        <div
                            ref={refs.editorRef}
                            className="outline-none"
                            tabIndex={0}
                            onKeyDown={state.readonly ? undefined : handlers.onKeyDown}
                            onPaste={state.readonly ? undefined : handlers.onPaste}
                        >
                            <MakeShiftEditorView
                                shift={state.shift}
                                doc={state.doc}
                                readonly={state.readonly}
                                showToolbar={false}
                                showNurseEditModal={false}
                                showPanel={!state.readonly}
                                calendarProps={{
                                    readonly: state.readonly,
                                    onCellClick: () => refs.editorRef.current?.focus(),
                                    disableInitialSelection: true,
                                    clearSelectionOnClickAway: false,
                                }}
                            />
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
