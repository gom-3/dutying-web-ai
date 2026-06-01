import {ArrowLeft, Building2, ChevronRight, DoorOpen} from 'lucide-react';
import {useNavigate} from 'react-router';
import useAuth from '@/features/auth';
import ROUTE from '@/shared/constant/path';

interface ISelectEnterOrCreateProps {
    onBack?: () => void;
}

function SelectEnterOrCreate({onBack}: ISelectEnterOrCreateProps) {
    const {
        state: {accountMe},
    } = useAuth();
    const navigate = useNavigate();

    return (
        <div className="flex w-full flex-col">
            {onBack ? (
                <button
                    type="button"
                    className="mb-6 flex h-10 w-fit cursor-pointer items-center gap-2 rounded-[12px] bg-white px-3 text-sm font-medium text-gray-3 transition-colors hover:bg-gray-7"
                    onClick={onBack}
                >
                    <ArrowLeft className="h-4 w-4" />
                    계정 정보로
                </button>
            ) : null}

            <div>
                <h1 className="text-[32px] font-semibold text-sub-1">
                    {accountMe?.name ? `${accountMe.name}님,` : '이제'} 병동을 연결해요
                </h1>
                <p className="mt-2 text-sm text-gray-3">처음 시작한다면 새 병동을 만들고, 초대 코드를 받았다면 기존 병동에 들어가요.</p>
            </div>

            <div className="mt-6 space-y-3">
                <button
                    type="button"
                    className="group flex min-h-36 w-full cursor-pointer items-center gap-4 rounded-[24px] bg-white p-6 text-left transition-colors hover:bg-gray-7"
                    onClick={() => navigate(ROUTE.ONBOARDING_WARD_CREATE)}
                >
                    <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[18px] bg-main-light text-main-1">
                        <Building2 className="h-6 w-6" />
                    </span>
                    <span className="min-w-0 flex-1">
                        <span className="block text-[22px] font-semibold text-sub-1">새 병동 만들기</span>
                        <span className="mt-2 block text-sm leading-6 text-gray-3">병원명, 병동명, 팀 정보를 차례로 설정해요.</span>
                    </span>
                    <ChevronRight className="h-5 w-5 shrink-0 text-gray-4 transition-transform group-hover:translate-x-0.5" />
                </button>

                <button
                    type="button"
                    className="group flex min-h-24 w-full cursor-pointer items-center gap-4 rounded-[24px] bg-white p-5 text-left transition-colors hover:bg-gray-7"
                    onClick={() => navigate(ROUTE.ENTER_WARD)}
                >
                    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[16px] bg-main-light text-main-1">
                        <DoorOpen className="h-5 w-5" />
                    </span>
                    <span className="min-w-0 flex-1">
                        <span className="block text-[17px] font-semibold text-sub-1">기존 병동 입장하기</span>
                        <span className="mt-1 block text-sm leading-6 text-gray-3">관리자가 준 6자리 코드가 있을 때 선택해요.</span>
                    </span>
                    <ChevronRight className="h-4 w-4 shrink-0 text-gray-4 transition-transform group-hover:translate-x-0.5" />
                </button>
            </div>
        </div>
    );
}

export default SelectEnterOrCreate;
