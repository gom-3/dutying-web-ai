import {MakeShiftEditorView} from '@/features/shift-editor';
import {useTypedTranslation} from '@/shared/hook/use-typed-translation';
import {DutyManagementMonthTeamHeader, DutyManagementStatusCard, ManagementActionButton} from '@/widgets/duty-management/ui';
import {type TDutyHook} from '../model/dutyHook';

type TDutyPageViewProps = {
    duty: TDutyHook;
};

export const DutyPageView = ({duty}: TDutyPageViewProps) => {
    const {state, handlers, refs} = duty;
    const {t} = useTypedTranslation();

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
                    {state.shiftTeams.length === 0 && (
                        <DutyManagementStatusCard title={t('page.duty.noTeamsTitle')} description={t('page.duty.noTeamsDescription')} />
                    )}
                    {state.status === 'pending' && <DutyManagementStatusCard title={t('page.duty.loading')} />}
                    {state.shiftTeams.length > 0 && state.status === 'error' && <DutyManagementStatusCard title={t('page.duty.error')} />}
                    {state.shiftTeams.length > 0 && state.status === 'success' && !state.shift && (
                        <DutyManagementStatusCard
                            title={t('page.duty.emptyTitle', {teamName: state.currentShiftTeamName, month: state.month})}
                            description={t('page.duty.emptyDescription', {month: state.month})}
                            actions={
                                <ManagementActionButton variant="secondary" size="lg" onClick={handlers.goCurrentMonthMake}>
                                    {t('page.duty.createCurrentMonth')}
                                </ManagementActionButton>
                            }
                        />
                    )}
                    {state.status === 'success' && state.shift && (
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
