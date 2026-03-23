import useRequestShift from '@/features/shift/useRequestShift';
import Button from '@/shared/ui/form-controls/Button';
import PageState from '@/shared/ui/PageState';
import RequestCalendar from './ui/RequestCalendar';
import Toolbar from './ui/Toolbar';

const RequestShiftPage = () => {
    const {
        state: {requestShift, shiftStatus, shiftTeams, shiftTeamsStatus},
        actions: {retry, createNextMonthShift},
    } = useRequestShift(true);
    const shiftTeamCount = shiftTeams?.length ?? 0;
    const shouldShowToolbar = shiftTeamsStatus !== 'pending' && shiftTeamsStatus !== 'error' && shiftTeamCount > 0;
    const pageState =
        shiftTeamsStatus === 'pending'
            ? {
                  tone: 'loading' as const,
                  title: '신청 근무 화면을 준비하고 있어요',
                  description: '근무 팀과 신청 근무표를 순서대로 불러오고 있어요.',
              }
            : shiftTeamsStatus === 'error'
              ? {
                    tone: 'error' as const,
                    title: '근무 팀을 불러오지 못했어요',
                    description: '잠시 후 다시 시도해 주세요. 문제가 계속되면 새로고침 후 다시 확인해 주세요.',
                    action: {label: '다시 시도', onClick: () => void retry()},
                }
              : shiftTeamCount === 0
                ? {
                      tone: 'empty' as const,
                      title: '아직 등록된 팀이 없어요',
                      description: '신청 근무를 작성하려면 먼저 근무 팀을 등록해 주세요.',
                  }
                : shiftStatus === 'pending'
                  ? {
                        tone: 'loading' as const,
                        title: '신청 근무표를 불러오는 중이에요',
                        description: '선택한 팀의 신청 근무와 신청 내역을 정리하고 있어요.',
                    }
                  : shiftStatus === 'error'
                    ? {
                          tone: 'error' as const,
                          title: '신청 근무표를 불러오지 못했어요',
                          description: '잠시 후 다시 시도해 주세요. 문제가 계속되면 새로고침 후 다시 확인해 주세요.',
                          action: {label: '다시 시도', onClick: () => void retry()},
                      }
                    : !requestShift
                      ? {
                            tone: 'empty' as const,
                            title: '이번 달 신청 근무표가 아직 없어요',
                            description: '다음 달 신청 근무표를 먼저 열어 작성할 수 있어요.',
                        }
                      : null;

    return (
        <div className="flex min-h-screen w-full flex-col px-5 py-5 md:px-10 md:py-10">
            <div className="flex flex-1 flex-col rounded-[20px] bg-white px-5 py-6 shadow-banner md:px-10 md:py-8">
                {shouldShowToolbar ? <Toolbar /> : null}

                {pageState ? (
                    <PageState {...pageState} className={shouldShowToolbar ? 'py-0 pt-14' : 'py-0'}>
                        {pageState.tone === 'empty' && !requestShift && shiftTeamCount > 0 ? (
                            <div className="mt-1 flex justify-center">
                                <Button
                                    type="button"
                                    variant="secondary"
                                    size="md"
                                    className="h-11 rounded-[14px] px-5 font-semibold"
                                    onClick={createNextMonthShift}
                                >
                                    다음 달 신청 근무 작성하기
                                </Button>
                            </div>
                        ) : null}
                    </PageState>
                ) : (
                    <RequestCalendar />
                )}
            </div>
        </div>
    );
};

export default RequestShiftPage;
