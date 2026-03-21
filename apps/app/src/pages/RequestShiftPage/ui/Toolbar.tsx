import {cn} from '@dutying/utils/style';
import {TriangleAlert} from 'lucide-react';
import {events, sendEvent} from '@/analytics';
import useRequestShift from '@/features/shift/useRequestShift';
import {NextIcon, PenIcon, PrevIcon, SaveCompleteIcon, SavingIcon} from '@/shared/assets/svg';
import Button from '@/shared/ui/form-controls/Button';
import Select from '@/shared/ui/form-controls/Select';
import StatusBadge from '@/shared/ui/StatusBadge';

const SAVE_STATUS_LABEL: Record<'idle' | 'loading' | 'success' | 'error', string> = {
    idle: '변경하면 자동 저장돼요',
    loading: '변경 내용을 저장하는 중이에요',
    success: '최근 변경을 저장했어요',
    error: '최근 변경 저장에 실패했어요',
};
const SAVE_STATUS_STYLE: Record<'idle' | 'loading' | 'success' | 'error', string> = {
    idle: 'bg-gray-7 text-gray-3',
    loading: 'bg-main-light text-main-1',
    success: 'bg-[#E9F8EF] text-[#237A4B]',
    error: 'bg-[#FFF0F0] text-sub-2',
};

function Toolbar() {
    const {
        state: {month, changeStatus, currentShiftTeam, shiftTeams, readonly, editAvailability},
        actions: {changeMonth, changeShiftTeam, toggleEditMode},
    } = useRequestShift();
    const isSaving = changeStatus === 'loading';
    const modeTone = !readonly ? 'brand' : editAvailability.canEdit ? 'neutral' : 'warning';
    const modeLabel = !readonly ? '수정 중' : editAvailability.badgeLabel;
    const guideMessage = !readonly
        ? '셀을 선택한 뒤 단축키로 입력하면 자동 저장돼요. 다른 근무를 입력하면 해당 신청은 자동으로 거절됩니다.'
        : editAvailability.canEdit
          ? '현재는 확인 모드예요. 제출된 신청을 검토한 뒤 수정하기를 누르면 편집을 시작할 수 있어요.'
          : editAvailability.description;

    return (
        <div id="toolbar" className="flex flex-col gap-4 rounded-[20px] bg-white px-5 py-5 md:px-8 md:py-6">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                <div className="flex flex-col gap-4 md:flex-row md:items-center">
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            className="grid size-9 place-items-center rounded-[10px] text-gray-5 transition-colors hover:bg-gray-7 hover:text-sub-1 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-gray-5"
                            onClick={() => {
                                changeMonth('prev');
                                sendEvent(events.requestPage.toolbar.changeMonth);
                            }}
                            disabled={isSaving}
                            aria-label="이전 달 보기"
                        >
                            <PrevIcon className="h-7.5 w-7.5" />
                        </button>
                        <p className="min-w-[6rem] text-center font-apple text-2xl font-semibold text-main-1">{month}월</p>
                        <button
                            type="button"
                            className="grid size-9 place-items-center rounded-[10px] text-gray-5 transition-colors hover:bg-gray-7 hover:text-sub-1 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-gray-5"
                            onClick={() => {
                                changeMonth('next');
                                sendEvent(events.requestPage.toolbar.changeMonth);
                            }}
                            disabled={isSaving}
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
                            disabled={isSaving}
                            onChange={(e) => {
                                changeShiftTeam(shiftTeams!.find((shiftTeam) => shiftTeam.shiftTeamId === parseInt(e.target.value, 10))!);
                                sendEvent(events.requestPage.toolbar.changeShiftTeam);
                            }}
                        />
                    ) : null}
                </div>

                <div className="flex flex-col gap-3 md:flex-row md:items-center">
                    {!readonly ? (
                        <div
                            className={cn(
                                'flex items-center gap-2 rounded-[12px] px-4 py-2 font-apple text-sm font-medium transition-colors',
                                SAVE_STATUS_STYLE[changeStatus],
                            )}
                            aria-live="polite"
                        >
                            {changeStatus === 'loading' ? (
                                <SavingIcon className="h-5 w-5" />
                            ) : changeStatus === 'error' ? (
                                <TriangleAlert className="h-5 w-5" strokeWidth={2.2} />
                            ) : (
                                <SaveCompleteIcon className="h-5 w-5" />
                            )}
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
                                disabled={isSaving}
                                onClick={() => {
                                    toggleEditMode();
                                    sendEvent(events.requestPage.toolbar.changeEditMode, 'save');
                                }}
                            >
                                {isSaving ? '저장 중...' : '완료'}
                            </Button>
                        )}
                    </div>
                </div>
            </div>

            <div className="rounded-[16px] border border-sub-4.5 bg-gray-7 px-4 py-3">
                <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge label={modeLabel} tone={modeTone} />
                    <StatusBadge label={editAvailability.periodLabel} tone="neutral" />
                </div>
                <p className="mt-2 font-apple text-sm leading-6 font-medium text-gray-3">{guideMessage}</p>
            </div>
        </div>
    );
}

export default Toolbar;
