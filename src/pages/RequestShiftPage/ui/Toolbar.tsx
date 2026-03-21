import {events, sendEvent} from '@/analytics';
import useRequestShift from '@/features/shift/useRequestShift';
import {NextIcon, PenIcon, PrevIcon, SaveCompleteIcon, SavingIcon} from '@/shared/assets/svg';
import Button from '@/shared/ui/form-controls/Button';
import Select from '@/shared/ui/form-controls/Select';

const SAVE_STATUS_LABEL: Record<'idle' | 'loading' | 'success' | 'error', string> = {
    idle: '변경 사항 없음',
    loading: '저장 중',
    success: '저장 완료',
    error: '저장 실패',
};

function Toolbar() {
    const {
        state: {month, changeStatus, currentShiftTeam, shiftTeams, readonly},
        actions: {changeMonth, changeShiftTeam, toggleEditMode},
    } = useRequestShift();

    return (
        <div
            id="toolbar"
            className="flex flex-col gap-4 rounded-[20px] bg-white px-5 py-5 md:px-8 md:py-6 xl:flex-row xl:items-center xl:justify-between"
        >
            <div className="flex flex-col gap-4 md:flex-row md:items-center">
                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        className="grid size-9 place-items-center rounded-[10px] text-gray-5 transition-colors hover:bg-gray-7 hover:text-sub-1"
                        onClick={() => {
                            changeMonth('prev');
                            sendEvent(events.requestPage.toolbar.changeMonth);
                        }}
                        aria-label="이전 달 보기"
                    >
                        <PrevIcon className="h-7.5 w-7.5" />
                    </button>
                    <p className="min-w-[6rem] text-center font-apple text-2xl font-semibold text-main-1">{month}월</p>
                    <button
                        type="button"
                        className="grid size-9 place-items-center rounded-[10px] text-gray-5 transition-colors hover:bg-gray-7 hover:text-sub-1"
                        onClick={() => {
                            changeMonth('next');
                            sendEvent(events.requestPage.toolbar.changeMonth);
                        }}
                        aria-label="다음 달 보기"
                    >
                        <NextIcon className="h-7.5 w-7.5" />
                    </button>
                </div>

                {currentShiftTeam ? (
                    <Select
                        value={currentShiftTeam.shiftTeamId}
                        options={shiftTeams?.map((shiftTeam) => ({
                            label: shiftTeam.name,
                            value: shiftTeam.shiftTeamId,
                        }))}
                        className="h-11 w-full md:w-[220px]"
                        selectClassName="rounded-[14px] border border-gray-6 bg-gray-7 px-4 font-apple text-base font-semibold text-sub-1 outline-none"
                        onChange={(e) => {
                            changeShiftTeam(shiftTeams!.find((shiftTeam) => shiftTeam.shiftTeamId === parseInt(e.target.value, 10))!);
                            sendEvent(events.requestPage.toolbar.changeShiftTeam);
                        }}
                    />
                ) : null}
            </div>

            <div className="flex flex-col gap-3 md:flex-row md:items-center">
                {!readonly ? (
                    <div className="flex items-center gap-2 rounded-[12px] bg-gray-7 px-4 py-2 font-apple text-sm font-medium text-gray-3">
                        {changeStatus === 'loading' ? <SavingIcon className="h-5 w-5" /> : <SaveCompleteIcon className="h-5 w-5" />}
                        {SAVE_STATUS_LABEL[changeStatus]}
                    </div>
                ) : null}

                <div className="flex gap-3">
                    {readonly ? (
                        <Button
                            id="editButton"
                            type="button"
                            size="md"
                            className="h-11 rounded-[14px] px-5 font-semibold"
                            onClick={() => {
                                toggleEditMode();
                                sendEvent(events.requestPage.toolbar.changeEditMode, 'edit');
                            }}
                        >
                            수정하기
                            <PenIcon className="h-5 w-5 stroke-white" />
                        </Button>
                    ) : (
                        <Button
                            type="button"
                            size="md"
                            className="h-11 rounded-[14px] px-5 font-semibold"
                            onClick={() => {
                                toggleEditMode();
                                sendEvent(events.requestPage.toolbar.changeEditMode, 'save');
                            }}
                        >
                            저장하기
                        </Button>
                    )}
                </div>
            </div>
        </div>
    );
}

export default Toolbar;
