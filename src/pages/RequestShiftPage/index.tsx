import useRequestShift from '@/features/shift/useRequestShift';
import PageState from '@/shared/ui/PageState';
import SectionHeader from '@/shared/ui/SectionHeader';
import RequestCalendar from './ui/RequestCalendar';
import Toolbar from './ui/Toolbar';

const RequestShiftPage = () => {
    const {
        state: {readonly, requestShift, shiftStatus, shiftTeams, shiftTeamsStatus},
        actions: {retry, createNextMonthShift},
    } = useRequestShift(true);
    const shiftTeamCount = shiftTeams?.length ?? 0;
    const showNoTeamsState = shiftTeamsStatus === 'success' && shiftTeamCount === 0;
    const showLoadingState =
        shiftTeamsStatus === 'pending' || (shiftTeamsStatus === 'success' && shiftTeamCount > 0 && shiftStatus === 'pending');
    const showErrorState =
        shiftTeamsStatus === 'error' || (shiftTeamsStatus === 'success' && shiftTeamCount > 0 && shiftStatus === 'error');
    const showEmptyState = shiftTeamsStatus === 'success' && shiftTeamCount > 0 && shiftStatus === 'success' && !requestShift;

    return (
        <div className="flex min-h-screen w-full flex-col px-5 py-5 md:px-10 md:py-10">
            <Toolbar />

            <div className="mt-3 flex flex-1 flex-col rounded-[20px] bg-white px-5 py-6 md:px-10 md:py-8">
                {showNoTeamsState ? (
                    <PageState
                        tone="empty"
                        title="아직 등록된 팀이 없어요"
                        description="신청 근무를 작성하려면 먼저 근무 팀을 등록해 주세요."
                        className="py-0"
                    />
                ) : showLoadingState ? (
                    <PageState
                        tone="loading"
                        title="신청 근무표를 불러오는 중이에요"
                        description="잠시만 기다려 주세요."
                        className="py-0"
                    />
                ) : showErrorState ? (
                    <PageState
                        tone="error"
                        title="신청 근무표를 불러오지 못했어요"
                        description="네트워크 상태를 확인한 뒤 다시 시도해 주세요."
                        action={{label: '다시 시도', onClick: () => void retry()}}
                        className="py-0"
                    />
                ) : showEmptyState ? (
                    <PageState
                        tone="empty"
                        title="이번 달 신청 근무표가 아직 없어요"
                        description="다음 달 신청 근무표를 먼저 열어 작성할 수 있어요."
                        className="py-0"
                    >
                        <div className="mt-1 flex justify-center">
                            <button
                                type="button"
                                className="inline-flex h-11 items-center justify-center rounded-[14px] bg-main-light px-5 font-apple text-base font-semibold text-main-1 transition-colors hover:bg-main-4"
                                onClick={createNextMonthShift}
                            >
                                다음 달 신청 근무 작성하기
                            </button>
                        </div>
                    </PageState>
                ) : (
                    <>
                        <SectionHeader
                            title={readonly ? '신청 근무를 확인해 주세요' : '신청 근무를 확정해 주세요'}
                            description={
                                readonly
                                    ? '제출된 신청 근무와 팀별 배치를 한 화면에서 검토할 수 있어요.'
                                    : '셀을 선택한 뒤 단축키로 근무를 입력하거나 간호사 신청을 바로 반영할 수 있어요.'
                            }
                            className="mb-8"
                            titleClassName="text-[28px] md:text-[32px]"
                            descriptionClassName="text-base md:text-[20px]"
                        />
                        <RequestCalendar />
                    </>
                )}
            </div>
        </div>
    );
};

export default RequestShiftPage;
