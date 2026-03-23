import {ChevronDown} from 'lucide-react';
import {twMerge} from 'tailwind-merge';
import {type TDutyRequest} from '@/entities/shift';
import ShiftBadge from '@/entities/shift/ui/shift-badge';
import {type TWardShiftType} from '@/entities/ward';
import {type TFocus} from '@/features/shift/useRequestShift/type';
import Card from '@/shared/ui/Card';
import PageState from '@/shared/ui/PageState';
import {getRequestFocus} from './utils';

interface IRequestDutyRequestPanelProps {
    month: number;
    dutyRequestList: TDutyRequest[] | undefined;
    dutyRequestStatus: 'pending' | 'error' | 'success';
    wardShiftTypeMap: Map<number, TWardShiftType>;
    unresolvedRequestCount: number;
    readonly: boolean;
    updatingRequestId: number | null;
    shiftNurseIdByNurseId: Map<number, number>;
    changeFocus: (focus: TFocus | null) => void;
    acceptRequest: (reqShiftId: number, isAccepted: boolean | null) => Promise<void>;
    acceptRequests: (reqShiftIds: number[], isAccepted: boolean | null) => Promise<void>;
    retry: () => Promise<unknown>;
    onAcceptAnalytics: (accepted: boolean) => void;
}

export default function RequestDutyRequestPanel({
    month,
    dutyRequestList,
    dutyRequestStatus,
    wardShiftTypeMap,
    unresolvedRequestCount,
    readonly,
    updatingRequestId,
    shiftNurseIdByNurseId,
    changeFocus,
    acceptRequest,
    acceptRequests,
    retry,
    onAcceptAnalytics,
}: IRequestDutyRequestPanelProps) {
    const isRequestActionLocked = updatingRequestId !== null;
    const isBulkUpdating = updatingRequestId === -1;
    const displayedRequestList = readonly ? dutyRequestList?.filter((request) => request.isAccepted === true) : dutyRequestList;
    const panelTitle = readonly ? '반영된 신청 근무' : '신청 내역';
    const emptyTitle = readonly ? '아직 반영된 신청 근무가 없어요' : '아직 제출된 신청이 없어요';
    const emptyDescription = readonly
        ? '수락된 신청이 생기면 이 패널에서 바로 확인할 수 있어요.'
        : '신청이 들어오면 이 패널에서 바로 확인하고 처리할 수 있어요.';
    const unresolvedRequestIds =
        displayedRequestList?.filter((request) => request.isAccepted === null).map((request) => request.wardReqShiftId) ?? [];

    return (
        <Card
            id="nurse_request_list"
            variant="elevated"
            padding="none"
            className="flex w-full shrink-0 flex-col overflow-hidden border-transparent shadow-[0_4px_34px_0_rgba(237,233,245,1)] xl:w-[287px]"
        >
            <div className="flex items-center justify-between gap-3 px-[18px] pt-[18px]">
                <div>
                    <p className="font-apple text-[1.25rem] font-semibold text-main-1">{panelTitle}</p>
                    {!readonly ? (
                        <p className="mt-1 font-apple text-sm font-medium text-gray-4">미처리 신청 {unresolvedRequestCount}건</p>
                    ) : null}
                </div>
                <button type="button" className="inline-flex items-center gap-1 font-apple text-sm font-medium text-gray-4">
                    신청순
                    <ChevronDown className="h-4 w-4" strokeWidth={1.8} />
                </button>
            </div>

            {!readonly ? (
                <div className="flex items-center justify-end gap-5 px-[18px] pt-2 pb-3">
                    <button
                        type="button"
                        className="font-apple text-xs font-medium text-gray-4 transition-colors hover:text-main-1 disabled:cursor-not-allowed disabled:opacity-40"
                        disabled={isRequestActionLocked || unresolvedRequestIds.length === 0}
                        onClick={() => void acceptRequests(unresolvedRequestIds, true)}
                    >
                        모두 수락
                    </button>
                    <button
                        type="button"
                        className="font-apple text-xs font-medium text-gray-4 transition-colors hover:text-sub-2 disabled:cursor-not-allowed disabled:opacity-40"
                        disabled={isRequestActionLocked || unresolvedRequestIds.length === 0}
                        onClick={() => void acceptRequests(unresolvedRequestIds, false)}
                    >
                        모두 거절
                    </button>
                </div>
            ) : (
                <div className="h-[15px]" />
            )}

            <div className="scrollbar-hide min-h-0 flex-1 overflow-y-auto">
                {dutyRequestStatus === 'pending' ? (
                    <PageState
                        tone="loading"
                        title={readonly ? '반영된 신청 근무를 불러오는 중이에요' : '신청 내역을 불러오는 중이에요'}
                        description={readonly ? '수락된 신청 근무를 정리하고 있어요.' : '제출된 신청 근무를 확인하고 있어요.'}
                        className="px-6 py-6"
                    />
                ) : dutyRequestStatus === 'error' ? (
                    <PageState
                        tone="error"
                        title={readonly ? '반영된 신청 근무를 불러오지 못했어요' : '신청 내역을 불러오지 못했어요'}
                        description="잠시 후 다시 시도해 주세요. 문제가 계속되면 새로고침 후 다시 확인해 주세요."
                        action={{label: '다시 시도', onClick: () => void retry()}}
                        className="px-6 py-6"
                    />
                ) : displayedRequestList && displayedRequestList.length > 0 ? (
                    <div className="divide-y divide-sub-4.5">
                        {displayedRequestList.map((dutyRequest) => {
                            const requestFocus = getRequestFocus(dutyRequest, shiftNurseIdByNurseId);
                            const isUpdating = updatingRequestId === dutyRequest.wardReqShiftId || isBulkUpdating;

                            return (
                                <div
                                    key={dutyRequest.wardReqShiftId}
                                    className={twMerge(
                                        readonly
                                            ? 'flex items-center justify-between gap-4 px-[30px] py-[14px]'
                                            : 'flex items-center justify-between gap-[18px] px-[15px] py-3',
                                        isUpdating && 'opacity-70',
                                    )}
                                >
                                    {readonly ? (
                                        <>
                                            <p className="text-gray-1 font-apple text-base font-normal">{`${month}월 ${dutyRequest.date}일`}</p>
                                            <div className="flex items-center gap-6">
                                                <p className="text-gray-1 font-apple text-base font-normal">{dutyRequest.nurseName}</p>
                                                <ShiftBadge shiftType={wardShiftTypeMap.get(dutyRequest.wardShiftTypeId)} />
                                            </div>
                                        </>
                                    ) : (
                                        <>
                                            <button
                                                type="button"
                                                className={twMerge(
                                                    'inline-flex min-w-0 items-end gap-[10px] text-left',
                                                    requestFocus ? 'cursor-pointer' : 'cursor-default',
                                                )}
                                                onClick={() => {
                                                    if (!requestFocus) return;

                                                    changeFocus(requestFocus);
                                                }}
                                            >
                                                <span className="text-gray-1 truncate font-apple text-base font-normal">{`${dutyRequest.nurseName} / ${dutyRequest.date}일`}</span>
                                                <ShiftBadge shiftType={wardShiftTypeMap.get(dutyRequest.wardShiftTypeId)} />
                                            </button>
                                            <div className="flex h-7 w-[90px] rounded-[5px] border border-gray-5 bg-sub-5 p-[1px]">
                                                <button
                                                    type="button"
                                                    className={twMerge(
                                                        'flex flex-1 items-center justify-center rounded-[4px] font-apple text-[14px] font-medium text-gray-4 transition-colors',
                                                        isRequestActionLocked && 'cursor-wait opacity-60',
                                                        dutyRequest.isAccepted === true && 'bg-main-1 text-white',
                                                    )}
                                                    disabled={isRequestActionLocked}
                                                    onClick={() => {
                                                        if (isRequestActionLocked) return;

                                                        void acceptRequest(dutyRequest.wardReqShiftId, true);
                                                        onAcceptAnalytics(true);
                                                    }}
                                                >
                                                    수락
                                                </button>
                                                <button
                                                    type="button"
                                                    className={twMerge(
                                                        'flex flex-1 items-center justify-center rounded-[4px] font-apple text-[14px] font-medium text-gray-4 transition-colors',
                                                        isRequestActionLocked && 'cursor-wait opacity-60',
                                                        dutyRequest.isAccepted === false && 'bg-gray-3 text-white',
                                                    )}
                                                    disabled={isRequestActionLocked}
                                                    onClick={() => {
                                                        if (isRequestActionLocked) return;

                                                        void acceptRequest(dutyRequest.wardReqShiftId, false);
                                                        onAcceptAnalytics(false);
                                                    }}
                                                >
                                                    거절
                                                </button>
                                            </div>
                                        </>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    <PageState tone="empty" title={emptyTitle} description={emptyDescription} className="min-h-[220px] px-6 py-6" />
                )}
            </div>
        </Card>
    );
}
