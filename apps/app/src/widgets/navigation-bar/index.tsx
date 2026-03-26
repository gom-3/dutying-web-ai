import {useState} from 'react';
import {useNavigate} from 'react-router';
import {events, sendEvent} from '@/analytics';
import {FoldIcon, LogoV2} from '@/shared/assets/svg';
import ROUTE from '@/shared/constant/path';
import NavigationBarItemGroups from './NavigationBarItemGroup';

const NavigationBar = () => {
    const navigate = useNavigate();
    const [isFold, setIsFold] = useState(false);

    // 펼친 상태: 사이드바는 숨기고 좌측 상단에 fixed 버튼만 유지
    if (isFold) {
        return (
            <button
                data-testid="navigation-bar-fold-trigger"
                type="button"
                aria-label="사이드바 펼치기"
                className="fixed top-[7px] left-[14px] z-997 flex size-[42px] items-center justify-center rounded-[10px] border border-[#BFC7D4] bg-white p-[6px]"
                onClick={() => {
                    setIsFold(false);
                    sendEvent(events.navigationBar.spreadNavigation);
                }}
            >
                <FoldIcon className="h-[30px] w-[30px] rotate-180 text-gray-5" />
            </button>
        );
    }

    return (
        <aside
            data-testid="navigation-bar"
            className="sticky top-0 z-997 h-screen w-[172px] shrink-0 border-r border-gray-6 bg-white font-apple transition-[width] duration-300 ease-out"
        >
            <div className="relative flex h-full w-full flex-col">
                <div className="px-[20px]">
                    <button
                        type="button"
                        aria-label="사이드바 접기"
                        className="absolute top-[13px] right-[9px] flex size-[30px] items-center justify-center"
                        onClick={() => {
                            setIsFold(true);
                            sendEvent(events.navigationBar.foldNavigation);
                        }}
                    >
                        <FoldIcon className="h-[30px] w-[30px] text-gray-5" />
                    </button>

                    <LogoV2 className="mt-[85px] size-[28px]" />

                    <div className="mt-6 w-full">
                        <button
                            type="button"
                            className="w-full cursor-pointer rounded-[7px] border border-gray-6 bg-gray-7 py-[11px] text-[16px] font-medium text-gray-3"
                            onClick={() => navigate(ROUTE.DUTY)}
                        >
                            근무표
                        </button>
                    </div>
                </div>

                <NavigationBarItemGroups />
            </div>
        </aside>
    );
};

export default NavigationBar;
