import {Clock3, X} from 'lucide-react';
import useRegister from '@/features/register';

function PendingEnter() {
    const {
        state: {accountMe, accountWaitingWard},
        actions: {cancelWaiting},
    } = useRegister();

    return (
        <div className="flex w-full flex-col">
            <div>
                <h1 className="text-[32px] font-semibold text-sub-1">입장 승인을 기다리고 있어요</h1>
                <p className="mt-2 text-sm text-gray-3">관리자가 승인하면 바로 병동을 사용할 수 있어요.</p>
            </div>

            <section className="mt-6 rounded-[24px] bg-white p-6">
                <div className="flex items-center gap-4">
                    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[16px] bg-main-light text-main-1">
                        <Clock3 className="h-5 w-5" />
                    </span>
                    <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-sub-2.5">요청한 병동</p>
                        <p className="mt-1 text-[20px] font-semibold text-sub-1">
                            {accountWaitingWard?.hospitalName} {accountWaitingWard?.name}
                        </p>
                    </div>
                </div>
            </section>

            <button
                type="button"
                onClick={() => accountMe?.nurseId && accountWaitingWard && cancelWaiting(accountWaitingWard.wardId, accountMe.nurseId)}
                className="mt-5 h-11 cursor-pointer gap-2 self-end rounded-[12px] bg-[#FFF1F6] px-4 text-sm font-semibold text-red transition-colors hover:bg-[#FFE6EF]"
            >
                <X className="h-4 w-4" />
                입장 요청 취소
            </button>
        </div>
    );
}

export default PendingEnter;
