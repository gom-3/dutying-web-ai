import React from 'react';
import {useLocation, useNavigate} from 'react-router';
import {events, sendEvent} from '@/analytics';
import {type TRoute} from '@/shared/constant/path';

interface Props {
    path?: TRoute;
    SelectedIcon?: React.ComponentType<React.SVGProps<SVGSVGElement>>;
    Icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
    text: string;
    disabled?: boolean;
}

const NavigationBarItem = ({path, SelectedIcon, Icon, text, disabled = false}: Props) => {
    const navigate = useNavigate();
    const {pathname} = useLocation();
    const isSelected = Boolean(path) && path === pathname;
    const CurrentIcon = isSelected && SelectedIcon ? SelectedIcon : Icon;
    const isDisabled = disabled || !path;

    return (
        <button
            type="button"
            aria-current={isSelected ? 'page' : undefined}
            aria-disabled={isDisabled ? true : undefined}
            disabled={isDisabled}
            className={`flex w-full items-center justify-center gap-[10px] rounded-[5px] py-[10px] font-apple text-[16px] leading-[normal] font-medium transition-colors ${
                isSelected ? 'bg-main-light text-main-1' : 'text-gray-4 hover:bg-[#f1f1f1]'
            } ${isDisabled ? 'cursor-not-allowed opacity-50 hover:bg-transparent' : 'cursor-pointer'}`}
            onClick={() => {
                if (isDisabled) return;

                navigate(path);
                sendEvent(events.navigationBar.navigate, path);
            }}
        >
            <CurrentIcon className={`h-[34px] w-[34px] ${isSelected ? 'text-main-1' : 'text-gray-5'}`} />
            <p className="w-[92px] text-left text-base leading-normal font-medium whitespace-nowrap">{text}</p>
        </button>
    );
};

export default NavigationBarItem;
