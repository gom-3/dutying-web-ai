import {useMemo} from 'react';
import ShiftBadge from '@/features/ShiftBadge';
import useUIConfig from '@/features/ui/useUIConfig';
import {canGoNext, canGoPrev, useMakeShiftStore} from '../../model/make-shift-store';
import {useMakeShiftUseCase} from '../../model/make-shift-use-case';
import {useRequestsShiftsHook} from '../../model/requestsShiftsHook';

export function RequestsShifts() {
    const useCase = useMakeShiftUseCase();
    const canPrev = useMakeShiftStore((s) => canGoPrev(s));
    const canNext = useMakeShiftStore((s) => canGoNext(s));
    const {
        state: {requestShift, requestList, wardShiftTypeMap, appliedRequests},
        status: {loading, error},
    } = useRequestsShiftsHook();
    const {
        state: {separateWeekendColor},
    } = useUIConfig();
    const pendingRequests = useMemo(() => requestList?.filter((x) => x.isAccepted === null) ?? [], [requestList]);

    return (
        <div className="flex min-h-0 flex-1 flex-col">
            <div className="flex flex-wrap items-start justify-between gap-6">
                <div className="flex items-baseline gap-[20px]">
                    <p className="font-apple text-[32px] font-semibold text-sub-1">신청 근무를 확정해 주세요</p>
                    <p className="font-apple text-xl font-medium text-gray-3">
                        반영된 스케줄은 <span className="text-main-1">근무표에 고정</span>됩니다.
                    </p>
                    {/* <div className="mt-4 flex flex-wrap items-center gap-2">
                        <StatusPill label="반영된 신청 근무" count={appliedRequests.length} />
                        <StatusPill label="반영 대기 신청" count={pendingRequests.length} />
                    </div> */}
                </div>

                <div className="flex items-center gap-3">
                    <button
                        className="h-[42px] rounded-[10px] bg-gray-6 px-5 font-apple text-base font-semibold text-gray-3 disabled:opacity-50"
                        onClick={() => useCase.prev()}
                        disabled={!canPrev}
                        type="button"
                    >
                        이전
                    </button>
                    <button
                        className="h-[42px] rounded-[10px] bg-main-1 px-5 font-apple text-base font-semibold text-white disabled:opacity-50"
                        onClick={() => useCase.next()}
                        disabled={!canNext}
                        type="button"
                    >
                        다음
                    </button>
                </div>
            </div>

            <div className="mt-6 flex min-h-0 flex-1 gap-6">
                {/* 캘린더 */}
                <div className="min-w-0 flex-1">
                    {loading && <div className="p-6 font-apple text-base font-medium text-gray-4">신청 근무 데이터를 불러오는 중...</div>}
                    {!loading && error && (
                        <div className="p-6 font-apple text-base font-medium text-gray-4">
                            데이터를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.
                        </div>
                    )}
                    {!loading && !error && !requestShift && (
                        <div className="p-6 font-apple text-base font-medium text-gray-4">이번 달 신청 근무표가 없어요.</div>
                    )}

                    {!loading && !error && requestShift && (
                        <div className="flex h-full min-h-0 flex-col">
                            {/* 본문 */}
                            <div className="scrollbar-default min-h-0 scroll-m-2 overflow-auto rounded-[15px] shadow-banner">
                                {/* 상단 날짜 헤더 */}
                                <div className="flex items-center px-5">
                                    <div className="w-24 shrink-0 text-center font-apple text-[1rem] font-medium text-sub-3">이름</div>
                                    <div className="min-w-0 flex-1">
                                        <div className="inline-flex rounded-[2.5rem] px-4 py-[.1875rem]">
                                            {requestShift.days.map((item, idx) => {
                                                const isSat = item.dayType === 'saturday';
                                                const isSun = item.dayType === 'sunday' || item.dayType === 'holiday';
                                                const textColor = isSun
                                                    ? 'text-red'
                                                    : isSat
                                                      ? separateWeekendColor
                                                          ? 'text-blue'
                                                          : 'text-red'
                                                      : 'text-sub-2.5';

                                                return (
                                                    <p
                                                        key={idx}
                                                        className={`w-9 flex-1 rounded-full text-center font-poppins text-[1rem] ${textColor}`}
                                                    >
                                                        {item.day}
                                                    </p>
                                                );
                                            })}
                                        </div>
                                    </div>
                                </div>

                                {/* 근무 표*/}
                                <div className="flex flex-col">
                                    {requestShift.divisionShiftNurses.map((division, divisionIndex) => {
                                        if (division.length === 0) return null;

                                        return (
                                            <div key={divisionIndex} className="rounded-[20px] bg-white">
                                                <div className="min-w-0">
                                                    <div className="flex flex-col">
                                                        {division.map((row) => (
                                                            <div key={row.shiftNurse.shiftNurseId} className="flex h-10 items-center px-5">
                                                                <div className="w-24 shrink-0 truncate text-center font-apple text-[1.25rem] text-sub-1">
                                                                    {row.shiftNurse.name}
                                                                </div>
                                                                <div className="flex h-full min-w-max px-4.25">
                                                                    {row.wardReqShiftList.map((wardShiftTypeId, dateIdx) => {
                                                                        const dayType = requestShift.days[dateIdx]?.dayType;
                                                                        const isSat = dayType === 'saturday';
                                                                        const isSun = dayType === 'sunday' || dayType === 'holiday';
                                                                        const bg = isSun
                                                                            ? 'bg-[#FFE1E680]'
                                                                            : isSat
                                                                              ? separateWeekendColor
                                                                                  ? 'bg-[#E1E5FF80]'
                                                                                  : 'bg-[#FFE1E680]'
                                                                              : '';

                                                                        return (
                                                                            <div
                                                                                key={dateIdx}
                                                                                className={`flex h-full w-9 items-center justify-center px-[.25rem] ${bg}`}
                                                                            >
                                                                                <ShiftBadge
                                                                                    shiftType={wardShiftTypeMap.get(wardShiftTypeId ?? -1)}
                                                                                />
                                                                            </div>
                                                                        );
                                                                    })}
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* 우측 리스트 */}
                <div className="w-[360px] shrink-0 rounded-[20px] bg-white shadow-banner">
                    <div className="border-b border-sub-4.5 px-6 py-4">
                        <p className="font-apple text-[1.25rem] font-semibold text-main-1">신청 내역</p>
                    </div>

                    <div className="scrollbar-hide max-h-[calc(100vh-22rem)] overflow-y-auto px-6 py-4">
                        <div>
                            <div className="flex items-center justify-between">
                                <p className="font-apple text-base font-semibold text-sub-1">반영된 신청</p>
                                <p className="font-apple text-sm font-medium text-gray-4">{appliedRequests.length}개</p>
                            </div>

                            <div className="mt-3 space-y-2">
                                {appliedRequests.length === 0 ? (
                                    <p className="font-apple text-sm font-medium text-gray-4">반영된 신청이 없어요.</p>
                                ) : (
                                    appliedRequests.map((item, idx) => (
                                        <div
                                            key={`${item.nurseName}-${item.date}-${item.wardShiftTypeId}-${idx}`}
                                            className="flex items-center gap-3"
                                        >
                                            <div className="min-w-0 flex-1">
                                                <p className="truncate font-apple text-sm font-medium text-sub-1">
                                                    {item.nurseName} / {item.date}일
                                                </p>
                                            </div>
                                            <ShiftBadge shiftType={wardShiftTypeMap.get(item.wardShiftTypeId)} />
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>

                        <div className="mt-6">
                            <div className="flex items-center justify-between">
                                <p className="font-apple text-base font-semibold text-sub-1">반영 대기</p>
                                <p className="font-apple text-sm font-medium text-gray-4">{pendingRequests.length}개</p>
                            </div>

                            <div className="mt-3 space-y-2">
                                {pendingRequests.length === 0 ? (
                                    <p className="font-apple text-sm font-medium text-gray-4">반영 대기 신청이 없어요.</p>
                                ) : (
                                    pendingRequests.map((dutyRequest) => (
                                        <div key={dutyRequest.wardReqShiftId} className="flex items-center gap-3">
                                            <div className="min-w-0 flex-1">
                                                <p className="truncate font-apple text-sm font-medium text-sub-1">
                                                    {dutyRequest.nurseName} / {dutyRequest.date}일
                                                </p>
                                            </div>
                                            <ShiftBadge shiftType={wardShiftTypeMap.get(dutyRequest.wardShiftTypeId)} isOnlyRequest />
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
