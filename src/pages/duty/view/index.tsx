import {MakeShiftEditorView} from '@/features/shift-editor';
import {ChevronLeftIcon, ChevronRightIcon} from '@/shared/assets/svg';
import {useTypedTranslation} from '@/shared/hook/use-typed-translation';
import {type TDutyHook} from '../model/dutyHook';

type TDutyPageViewProps = {
    duty: TDutyHook;
};

export const DutyPageView = ({duty}: TDutyPageViewProps) => {
    const {state, handlers, refs} = duty;
    const {t} = useTypedTranslation();

    return (
        <div className="flex min-h-screen w-full flex-col px-10 py-10">
            <div className="flex flex-wrap items-center gap-4">
                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        className="grid size-6 place-items-center text-gray-5 hover:text-gray-4"
                        onClick={handlers.goPrevMonth}
                        aria-label={t('page.duty.prevMonth')}
                    >
                        <ChevronLeftIcon />
                    </button>
                    <div className="font-apple text-2xl font-semibold text-main-1">
                        {t('page.duty.monthHeader', {year: state.year, month: state.month})}
                    </div>
                    <button
                        type="button"
                        className="grid size-6 place-items-center text-gray-5 hover:text-gray-4"
                        onClick={handlers.goNextMonth}
                        aria-label={t('page.duty.nextMonth')}
                    >
                        <ChevronRightIcon />
                    </button>
                </div>

                <div className="max-w-full rounded-[10px] bg-main-light px-[10px] py-[7px]">
                    <div className="scrollbar-hide flex max-w-full gap-1 overflow-x-auto whitespace-nowrap">
                        {state.shiftTeams.map((team) => {
                            const selected = team.shiftTeamId === state.currentShiftTeamId;

                            return (
                                <button
                                    key={team.shiftTeamId}
                                    type="button"
                                    onClick={() => handlers.selectShiftTeam(team.shiftTeamId)}
                                    className={`flex h-[32px] items-center justify-center rounded-[10px] px-[16px] py-[6px] ${
                                        selected ? 'bg-main-1 text-white' : 'text-gray-3'
                                    }`}
                                >
                                    <p className="font-apple text-base leading-normal font-medium">{team.name}</p>
                                </button>
                            );
                        })}
                    </div>
                </div>
            </div>

            <div className="mt-[14px] flex flex-1 flex-col rounded-[20px] bg-white px-10 py-7">
                <div className="flex flex-wrap items-center justify-between gap-4">
                    <div className="flex items-center gap-6">
                        <h1 className="text-gray-1 font-apple text-[40px] font-semibold">
                            {state.currentShiftTeamName} {t('page.duty.confirmedShift')}
                        </h1>
                        <button
                            type="button"
                            className="flex h-11 items-center rounded-[10px] border border-main-1 px-5 font-apple text-2xl font-semibold text-main-1"
                            onClick={handlers.goNextMonthMake}
                        >
                            {t('page.duty.createNextMonth')}
                        </button>
                    </div>

                    <div className="ml-auto flex items-center gap-3">
                        {state.readonly ? (
                            <>
                                <button
                                    type="button"
                                    className="h-10 rounded-[10px] bg-gray-6 px-4 font-apple text-xl font-medium text-gray-3"
                                    onClick={handlers.postShift}
                                >
                                    {t('page.duty.publish')}
                                </button>
                                <button
                                    type="button"
                                    className="h-10 rounded-[10px] bg-gray-6 px-4 font-apple text-xl font-medium text-gray-3"
                                    onClick={handlers.exportExcel}
                                >
                                    {t('page.duty.exportExcel')}
                                </button>
                                <button
                                    type="button"
                                    className="h-10 rounded-[10px] bg-main-1 px-4 font-apple text-xl font-medium text-white"
                                    onClick={handlers.enableEdit}
                                >
                                    {t('page.duty.editShift')}
                                </button>
                            </>
                        ) : (
                            <>
                                <button
                                    type="button"
                                    className="h-10 rounded-[10px] bg-gray-6 px-4 font-apple text-xl font-medium text-gray-3"
                                    onClick={handlers.cancelEdit}
                                >
                                    {t('page.duty.cancel')}
                                </button>
                                <button
                                    type="button"
                                    className="h-10 rounded-[10px] bg-main-1 px-4 font-apple text-xl font-medium text-white"
                                    onClick={handlers.saveEdit}
                                >
                                    {t('page.duty.save')}
                                </button>
                            </>
                        )}
                    </div>
                </div>

                <div className="mt-6 min-h-0 flex-1 overflow-auto">
                    {state.status === 'pending' && (
                        <div className="flex h-full min-h-[300px] items-center justify-center">
                            <p className="font-apple text-2xl font-semibold text-gray-3">{t('page.duty.loading')}</p>
                        </div>
                    )}
                    {state.status === 'error' && (
                        <div className="flex h-full min-h-[300px] items-center justify-center">
                            <p className="font-apple text-2xl font-semibold text-gray-3">{t('page.duty.error')}</p>
                        </div>
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
