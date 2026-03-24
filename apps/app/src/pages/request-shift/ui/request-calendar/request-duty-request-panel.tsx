import {ChevronDown} from 'lucide-react';
import {twMerge} from 'tailwind-merge';
import {type TDutyRequest} from '@/entities/shift';
import ShiftBadge from '@/entities/shift/ui/shift-badge';
import {type TWardShiftType} from '@/entities/ward';
import {type TFocus} from '@/features/request-shift/model/types';
import {useTypedTranslation} from '@/shared/hook/use-typed-translation';
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
    acceptRequest: (reqShiftId: number, isAccepted: boolean | null) => Promise<boolean>;
    acceptRequests: (reqShiftIds: number[], isAccepted: boolean | null) => Promise<boolean>;
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
    const {t} = useTypedTranslation();
    const isRequestActionLocked = updatingRequestId !== null;
    const isBulkUpdating = updatingRequestId === -1;
    const displayedRequestList = readonly ? dutyRequestList?.filter((request) => request.isAccepted === true) : dutyRequestList;
    const panelTitle = readonly ? t('page.request.panel.readonlyTitle') : t('page.request.panel.editTitle');
    const emptyTitle = readonly ? t('page.request.panel.emptyTitleReadonly') : t('page.request.panel.emptyTitleEdit');
    const emptyDescription = readonly ? t('page.request.panel.emptyDescriptionReadonly') : t('page.request.panel.emptyDescriptionEdit');
    const unresolvedRequestIds =
        displayedRequestList?.filter((request) => request.isAccepted === null).map((request) => request.wardReqShiftId) ?? [];
    const isBulkActionDisabled = dutyRequestStatus !== 'success' || isRequestActionLocked || unresolvedRequestIds.length === 0;

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
                        <p className="mt-1 font-apple text-sm font-medium text-gray-4">
                            {t('page.request.panel.unresolvedCount', {count: unresolvedRequestCount})}
                        </p>
                    ) : null}
                </div>
                <span className="inline-flex items-center gap-1 font-apple text-sm font-medium text-gray-4" aria-disabled="true">
                    {t('page.request.panel.sortOrder')}
                    <ChevronDown className="h-4 w-4" strokeWidth={1.8} />
                </span>
            </div>

            {!readonly ? (
                <div className="flex items-center justify-end gap-5 px-[18px] pt-2 pb-3">
                    <button
                        type="button"
                        className="font-apple text-xs font-medium text-gray-4 transition-colors hover:text-main-1 disabled:cursor-not-allowed disabled:opacity-40"
                        disabled={isBulkActionDisabled}
                        onClick={() => void acceptRequests(unresolvedRequestIds, true)}
                    >
                        {t('page.request.panel.acceptAll')}
                    </button>
                    <button
                        type="button"
                        className="font-apple text-xs font-medium text-gray-4 transition-colors hover:text-sub-2 disabled:cursor-not-allowed disabled:opacity-40"
                        disabled={isBulkActionDisabled}
                        onClick={() => void acceptRequests(unresolvedRequestIds, false)}
                    >
                        {t('page.request.panel.rejectAll')}
                    </button>
                </div>
            ) : (
                <div className="h-[15px]" />
            )}

            <div className="scrollbar-hide min-h-0 flex-1 overflow-y-auto">
                {dutyRequestStatus === 'pending' ? (
                    <PageState
                        tone="loading"
                        title={readonly ? t('page.request.panel.loadingTitleReadonly') : t('page.request.panel.loadingTitleEdit')}
                        description={
                            readonly ? t('page.request.panel.loadingDescriptionReadonly') : t('page.request.panel.loadingDescriptionEdit')
                        }
                        className="px-6 py-6"
                    />
                ) : dutyRequestStatus === 'error' ? (
                    <PageState
                        tone="error"
                        title={readonly ? t('page.request.panel.errorTitleReadonly') : t('page.request.panel.errorTitleEdit')}
                        description={t('page.state.errorDescription')}
                        action={{label: t('page.state.retry'), onClick: () => void retry()}}
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
                                            <p className="text-gray-1 font-apple text-base font-normal">
                                                {t('page.request.panel.dateLabel', {month, date: dutyRequest.date})}
                                            </p>
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
                                                <span className="text-gray-1 truncate font-apple text-base font-normal">
                                                    {t('page.request.panel.nurseDateLabel', {
                                                        nurseName: dutyRequest.nurseName,
                                                        date: dutyRequest.date,
                                                    })}
                                                </span>
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
                                                    onClick={async () => {
                                                        if (isRequestActionLocked) return;

                                                        const accepted = await acceptRequest(dutyRequest.wardReqShiftId, true);

                                                        if (!accepted) return;

                                                        onAcceptAnalytics(true);
                                                    }}
                                                >
                                                    {t('page.request.panel.accept')}
                                                </button>
                                                <button
                                                    type="button"
                                                    className={twMerge(
                                                        'flex flex-1 items-center justify-center rounded-[4px] font-apple text-[14px] font-medium text-gray-4 transition-colors',
                                                        isRequestActionLocked && 'cursor-wait opacity-60',
                                                        dutyRequest.isAccepted === false && 'bg-gray-3 text-white',
                                                    )}
                                                    disabled={isRequestActionLocked}
                                                    onClick={async () => {
                                                        if (isRequestActionLocked) return;

                                                        const accepted = await acceptRequest(dutyRequest.wardReqShiftId, false);

                                                        if (!accepted) return;

                                                        onAcceptAnalytics(false);
                                                    }}
                                                >
                                                    {t('page.request.panel.reject')}
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
