import {twMerge} from 'tailwind-merge';
import {type TDutyRequest} from '@/entities/shift';
import ShiftBadge from '@/entities/shift/ui/shift-badge';
import {type TWardShiftType} from '@/entities/ward';
import {type TFocus} from '@/features/shift/useRequestShift/type';
import Card from '@/shared/ui/Card';
import PageState from '@/shared/ui/PageState';
import {getDutyRequestStatusLabel, getRequestFocus} from './utils';

interface IRequestDutyRequestPanelProps {
    dutyRequestList: TDutyRequest[] | undefined;
    dutyRequestStatus: 'pending' | 'error' | 'success';
    wardShiftTypeMap: Map<number, TWardShiftType>;
    unresolvedRequestCount: number;
    readonly: boolean;
    updatingRequestId: number | null;
    shiftNurseIdByNurseId: Map<number, number>;
    changeFocus: (focus: TFocus | null) => void;
    acceptRequest: (reqShiftId: number, isAccepted: boolean | null) => void;
    retry: () => Promise<unknown>;
    onAcceptAnalytics: (accepted: boolean) => void;
}

export default function RequestDutyRequestPanel({
    dutyRequestList,
    dutyRequestStatus,
    wardShiftTypeMap,
    unresolvedRequestCount,
    readonly,
    updatingRequestId,
    shiftNurseIdByNurseId,
    changeFocus,
    acceptRequest,
    retry,
    onAcceptAnalytics,
}: IRequestDutyRequestPanelProps) {
    return (
        <Card
            id="nurse_request_list"
            variant="elevated"
            padding="none"
            className="flex w-full shrink-0 flex-col overflow-hidden border-gray-6 xl:w-[360px]"
        >
            <div className="border-b border-sub-4.5 px-6 py-5">
                <div className="flex items-center justify-between gap-3">
                    <div>
                        <p className="font-apple text-[1.25rem] font-semibold text-main-1">신청 내역</p>
                        <p className="mt-1 font-apple text-sm font-medium text-gray-4">미처리 신청 {unresolvedRequestCount}건</p>
                    </div>
                </div>
            </div>

            <div className="scrollbar-hide max-h-[calc(100vh-18rem)] overflow-y-auto px-5 py-4">
                {dutyRequestStatus === 'pending' ? (
                    <PageState
                        tone="loading"
                        title="신청 내역을 불러오는 중이에요"
                        description="제출된 신청 근무를 확인하고 있어요."
                        className="px-0 py-0"
                    />
                ) : dutyRequestStatus === 'error' ? (
                    <PageState
                        tone="error"
                        title="신청 내역을 불러오지 못했어요"
                        description="잠시 후 다시 시도해 주세요."
                        action={{label: '다시 시도', onClick: () => void retry()}}
                        className="px-0 py-0"
                    />
                ) : dutyRequestList && dutyRequestList.length > 0 ? (
                    <div className="space-y-3">
                        {dutyRequestList.map((dutyRequest) => {
                            const requestFocus = getRequestFocus(dutyRequest, shiftNurseIdByNurseId);
                            const isUpdating = updatingRequestId === dutyRequest.wardReqShiftId;

                            return (
                                <div key={dutyRequest.wardReqShiftId} className="rounded-[16px] border border-gray-6 px-4 py-3">
                                    <div className="flex items-start gap-3">
                                        <div className="min-w-0 flex-1">
                                            <button
                                                type="button"
                                                className={twMerge(
                                                    'truncate text-left font-apple text-base font-semibold text-sub-1',
                                                    (!requestFocus || readonly) && 'cursor-default',
                                                    requestFocus && !readonly && 'cursor-pointer hover:text-main-1',
                                                )}
                                                onClick={() => {
                                                    if (readonly || !requestFocus) return;

                                                    changeFocus(requestFocus);
                                                }}
                                            >
                                                {dutyRequest.nurseName} / {dutyRequest.date}일
                                            </button>
                                            <div className="mt-2 flex items-center gap-2">
                                                <ShiftBadge shiftType={wardShiftTypeMap.get(dutyRequest.wardShiftTypeId)} />
                                                <p className="font-apple text-sm font-medium text-gray-4">
                                                    {isUpdating ? '처리 중...' : getDutyRequestStatusLabel(dutyRequest.isAccepted)}
                                                </p>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="mt-4 flex rounded-[12px] bg-gray-7 p-1">
                                        <button
                                            type="button"
                                            className={twMerge(
                                                'flex h-9 flex-1 items-center justify-center rounded-[10px] font-apple text-sm font-semibold text-gray-3 transition-colors',
                                                isUpdating && 'cursor-wait opacity-60',
                                                dutyRequest.isAccepted === true && 'bg-main-1 text-white',
                                            )}
                                            disabled={isUpdating}
                                            onClick={() => {
                                                acceptRequest(dutyRequest.wardReqShiftId, true);
                                                onAcceptAnalytics(true);
                                            }}
                                        >
                                            수락
                                        </button>
                                        <button
                                            type="button"
                                            className={twMerge(
                                                'flex h-9 flex-1 items-center justify-center rounded-[10px] font-apple text-sm font-semibold text-gray-3 transition-colors',
                                                isUpdating && 'cursor-wait opacity-60',
                                                dutyRequest.isAccepted === false && 'bg-sub-2 text-white',
                                            )}
                                            disabled={isUpdating}
                                            onClick={() => {
                                                acceptRequest(dutyRequest.wardReqShiftId, false);
                                                onAcceptAnalytics(false);
                                            }}
                                        >
                                            거절
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    <div className="flex min-h-[220px] items-center justify-center rounded-[16px] bg-gray-7 px-6 text-center">
                        <p className="font-apple text-sm leading-6 font-medium text-gray-4">
                            아직 제출된 신청 근무가 없어요.
                            <br />
                            신청이 들어오면 이 패널에서 바로 확인할 수 있어요.
                        </p>
                    </div>
                )}
            </div>
        </Card>
    );
}
