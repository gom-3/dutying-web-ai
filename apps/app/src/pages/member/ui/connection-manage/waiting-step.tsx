import {ProfileImage} from '@/entities/account/ui/profile-image';
import {type TWaitingNurse} from '@/entities/nurse';
import {CancelIcon} from '@/shared/assets/svg';
import {getWaitingNurseSummary} from '../../model/connection-manage';

interface IConnectionManageWaitingStepProps {
    waitingNurses: TWaitingNurse[] | undefined;
    onClose: () => void;
    onAccept: (waitingNurse: TWaitingNurse) => void;
    onReject: (nurseId: number) => void;
}

function ConnectionManageWaitingStep({waitingNurses, onClose, onAccept, onReject}: IConnectionManageWaitingStepProps) {
    return (
        <div
            className="h-[44%] min-h-117.5 w-[40%] min-w-190 rounded-[1.25rem] bg-white px-10.5 py-8.75"
            onClick={(event) => event.stopPropagation()}
        >
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <h1 className="font-apple text-[1.75rem] font-semibold text-text-1">연동 관리</h1>
                </div>
                <CancelIcon className="h-7.5 w-7.5" onClick={onClose} />
            </div>
            <div className="h-full overflow-hidden pt-10.5">
                <p className="font-apple text-[1rem] font-medium text-sub-3">신청 내역</p>
                {waitingNurses?.length === 0 ? (
                    <div className="flex h-[calc(100%-80px)] items-center justify-center font-apple text-[1.7rem] text-sub-2">
                        연동 신청을 한 간호사가 없습니다.
                    </div>
                ) : (
                    <div className="mt-6 scrollbar-hide flex h-[calc(100%-5.9375rem)] flex-col gap-4 overflow-scroll">
                        {waitingNurses?.map((waitingNurse) => {
                            const waitingNurseSummary = getWaitingNurseSummary(waitingNurse);

                            return (
                                <div
                                    key={waitingNurse.waitingNurseId}
                                    className="flex h-18 shrink-0 items-center rounded-[.625rem] border-[.0625rem] border-sub-4.5 bg-main-bg px-5"
                                >
                                    <ProfileImage className="h-8 w-8" profileImg={{profileImgUrl: waitingNurse.profileImgUrl}} />
                                    <p className="ml-[.625rem] font-apple text-[1.5rem] font-medium text-sub-1">{waitingNurse.name}</p>
                                    <div
                                        className={`ml-8 flex h-5 w-7 items-center justify-center rounded-[.3125rem] bg-sub-5 font-apple text-[.875rem] ${
                                            waitingNurse.gender === '남' ? 'text-[#A2A6F5]' : 'text-[#F5A2C5]'
                                        }`}
                                    >
                                        {waitingNurse.gender}
                                    </div>
                                    <p className="ml-4 font-poppins text-[1.25rem] font-medium text-sub-1">
                                        {waitingNurseSummary.formattedPhoneNumber}
                                    </p>
                                    <div className="ml-auto flex h-11.5 w-36.5 items-center justify-center gap-[.125rem] rounded-[.3125rem] border-[.0313rem] border-sub-4 bg-sub-5 p-[.125rem]">
                                        <button
                                            className="flex h-9.5 flex-1 items-center justify-center rounded-[.3125rem] font-poppins text-[1.5rem] text-sub-2.5 hover:bg-main-1 hover:text-white"
                                            onClick={() => onAccept(waitingNurse)}
                                        >
                                            수락
                                        </button>
                                        <button
                                            className="flex h-9.5 flex-1 items-center justify-center rounded-[.3125rem] font-poppins text-[1.5rem] text-sub-2.5 hover:bg-sub-2 hover:text-white"
                                            onClick={() => confirm('정말 거절하시겠습니까?') && onReject(waitingNurse.nurseId)}
                                        >
                                            거절
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}

export default ConnectionManageWaitingStep;
