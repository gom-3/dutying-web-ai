import {twMerge} from 'tailwind-merge';
import {type TWaitingNurse} from '@/entities/nurse';
import type {TConnectMode} from '../../model/connectionManage';
import {getWaitingNurseSummary} from '../../model/connectionManage';

interface IConnectionManageMethodStepProps {
    currentWaitingNurse: TWaitingNurse | null;
    connectMode: TConnectMode;
    onBack: () => void;
    onNext: () => void;
    onChangeConnectMode: (mode: TConnectMode) => void;
}

function ConnectionManageMethodStep({
    currentWaitingNurse,
    connectMode,
    onBack,
    onNext,
    onChangeConnectMode,
}: IConnectionManageMethodStepProps) {
    const waitingNurseSummary = currentWaitingNurse ? getWaitingNurseSummary(currentWaitingNurse) : null;

    return (
        <div
            className="h-[36%] min-h-95 w-[40%] min-w-190 rounded-[1.25rem] bg-white px-10.5 py-8.75"
            onClick={(event) => event.stopPropagation()}
        >
            <div className="flex items-center justify-between">
                <h1 className="font-apple text-[1.75rem] font-semibold text-text-1">간호사 계정을 어떻게 생성할까요?</h1>
                <div className="ml-auto flex gap-5">
                    <button
                        className="flex h-7.5 items-center rounded-[1.875rem] border-[.0625rem] border-sub-3 px-[.75rem] font-apple text-[1rem] text-sub-3"
                        onClick={onBack}
                    >
                        이전
                    </button>
                    <button
                        className="flex h-7.5 items-center rounded-[1.875rem] border-[.0625rem] border-main-1 px-[.75rem] font-apple text-[1rem] text-main-1"
                        onClick={onNext}
                    >
                        다음
                    </button>
                </div>
            </div>
            <div className="pt-10.5">
                <p className="font-apple text-[1rem] font-medium text-sub-3">연동할 간호사</p>
                <div className="mt-6 flex h-18 shrink-0 items-center rounded-[.625rem] border-[.0625rem] border-sub-4.5 bg-main-bg px-5">
                    <img className="rounded-full" src="" alt="" />
                    <p className="ml-[.625rem] font-apple text-[1.5rem] font-medium text-sub-1">{currentWaitingNurse?.name}</p>
                    <div
                        className={`ml-8 flex h-5 w-7 items-center justify-center rounded-[.3125rem] bg-sub-5 font-apple text-[.875rem] ${
                            currentWaitingNurse?.gender === '남' ? 'text-[#A2A6F5]' : 'text-[#F5A2C5]'
                        }`}
                    >
                        {currentWaitingNurse?.gender}
                    </div>
                    <p className="ml-4 font-poppins text-[1.25rem] font-medium text-sub-1">{waitingNurseSummary?.formattedPhoneNumber}</p>
                </div>
            </div>
            <div className="mt-4.75 flex w-full">
                <button
                    className={twMerge(
                        'h-11.5 flex-1 rounded-l-[3.125rem] border-[.0625rem] border-main-3 font-apple text-[1.5rem] font-medium',
                        connectMode === 'link' ? 'bg-main-1 text-white' : 'bg-sub-5 text-sub-2.5',
                    )}
                    onClick={() => onChangeConnectMode('link')}
                >
                    기존 간호사와 연동하기
                </button>
                <button
                    className={twMerge(
                        'h-11.5 flex-1 rounded-r-[3.125rem] border-[.0625rem] border-main-3 font-apple text-[1.5rem] font-medium',
                        connectMode === 'link' ? 'bg-sub-5 text-sub-2.5' : 'bg-main-1 text-white',
                    )}
                    onClick={() => onChangeConnectMode('add')}
                >
                    팀에 추가하기
                </button>
            </div>
            <div className="mt-[.625rem] space-y-1 font-apple text-[.875rem] text-main-2">
                <p>*기존 간호사와 연동 시, 미연동 상태인 간호사 목록에서 일치하는 계정을 연결할 수 있어요.</p>
                <p>*팀에 추가 시, 선택한 팀에 새 간호사 관계가 생성돼요.</p>
            </div>
        </div>
    );
}

export default ConnectionManageMethodStep;
