import {cn} from '@dutying/utils/style';
import {type ComponentType, type SVGProps, useEffect, useRef, useState} from 'react';
import {useLocation, useNavigate} from 'react-router';
import {events, sendEvent} from '@/analytics';
import {type TRoute} from '@/shared/constant/path';

type TNavigationBarImageIcon = {
    kind: 'image';
    defaultSrc: string;
    hoverSrc: string;
    activeSrc: string;
};

type TNavigationBarComponentIcon = {
    kind: 'component';
    Icon: ComponentType<SVGProps<SVGSVGElement>>;
    SelectedIcon?: ComponentType<SVGProps<SVGSVGElement>>;
};

export type TNavigationBarItemIcon = TNavigationBarImageIcon | TNavigationBarComponentIcon;

const iconTapMotionClass =
    'transition-transform duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] will-change-transform group-active:scale-[0.9] group-active:duration-100 group-active:ease-out motion-reduce:transition-none';

interface INavigationBarItemProps {
    path?: TRoute;
    activePaths?: TRoute[];
    icon: TNavigationBarItemIcon;
    text: string;
    collapsed?: boolean;
    alignWithCollapsedIcon?: boolean;
    disabled?: boolean;
    badgeCount?: number;
    onNavigate?: () => void;
}

const NavigationBarItem = ({
    path,
    activePaths,
    icon,
    text,
    collapsed = false,
    alignWithCollapsedIcon = false,
    disabled = false,
    badgeCount = 0,
    onNavigate,
}: INavigationBarItemProps) => {
    const navigate = useNavigate();
    const {pathname} = useLocation();
    const isSelected = Boolean(path) && (activePaths ?? [path]).some((activePath) => activePath === pathname);
    const isDisabled = disabled || !path;
    const [isPressedPreview, setIsPressedPreview] = useState(false);
    const [isNavigationPreview, setIsNavigationPreview] = useState(false);
    const [isTapAnimating, setIsTapAnimating] = useState(false);
    const tapAnimationTimeoutRef = useRef<number | null>(null);
    const isInteractionPreview = !isSelected && (isPressedPreview || isNavigationPreview);
    const badgeLabel = badgeCount > 99 ? '99+' : String(badgeCount);
    const canSwapImageIcon = icon.kind === 'image' && !isSelected && !isInteractionPreview && !isDisabled;
    const CurrentComponentIcon =
        icon.kind === 'component' && isSelected && icon.SelectedIcon ? icon.SelectedIcon : icon.kind === 'component' ? icon.Icon : null;
    const iconMotionClassName = cn(iconTapMotionClass, isTapAnimating ? 'scale-[0.9] duration-100 ease-out' : undefined);

    useEffect(() => {
        setIsPressedPreview(false);
        setIsNavigationPreview(false);
    }, [pathname]);

    useEffect(() => {
        return () => {
            if (tapAnimationTimeoutRef.current !== null) {
                window.clearTimeout(tapAnimationTimeoutRef.current);
            }
        };
    }, []);

    const triggerTapAnimation = () => {
        if (tapAnimationTimeoutRef.current !== null) {
            window.clearTimeout(tapAnimationTimeoutRef.current);
        }

        setIsTapAnimating(true);
        tapAnimationTimeoutRef.current = window.setTimeout(() => {
            setIsTapAnimating(false);
            tapAnimationTimeoutRef.current = null;
        }, 120);
    };

    return (
        <button
            type="button"
            data-navigation-path={path}
            title={collapsed ? text : undefined}
            aria-label={collapsed ? text : undefined}
            aria-current={isSelected ? 'page' : undefined}
            aria-disabled={isDisabled ? true : undefined}
            disabled={isDisabled}
            className={cn(
                'group relative flex min-h-[clamp(38px,5.6vh,44px)] w-full items-center rounded-[10px] font-apple text-[15px] leading-normal font-semibold transition-colors duration-150',
                'focus-visible:ring-2 focus-visible:ring-main-3 focus-visible:ring-offset-2 focus-visible:outline-none',
                collapsed
                    ? 'justify-center px-0'
                    : alignWithCollapsedIcon
                      ? 'justify-start gap-3 pr-3 pl-[13px]'
                      : 'justify-start gap-3 px-3',
                isSelected ? 'bg-main-light text-[#844AFF]' : 'text-gray-3 hover:bg-gray-7 hover:text-sub-1',
                isDisabled ? 'cursor-not-allowed opacity-45 hover:bg-transparent hover:text-gray-3' : 'cursor-pointer',
            )}
            onPointerDown={() => {
                if (isDisabled) return;

                triggerTapAnimation();

                if (!isSelected) {
                    setIsPressedPreview(true);
                }
            }}
            onPointerUp={() => setIsPressedPreview(false)}
            onPointerCancel={() => setIsPressedPreview(false)}
            onPointerLeave={() => setIsPressedPreview(false)}
            onClick={() => {
                if (isDisabled) return;

                onNavigate?.();
                setIsNavigationPreview(true);
                navigate(path);
                sendEvent(events.navigationBar.navigate, path);
            }}
        >
            {isSelected ? (
                <span
                    aria-hidden="true"
                    className={cn(
                        'absolute left-0 w-[3px] rounded-r-full bg-[#844AFF]',
                        collapsed || alignWithCollapsedIcon ? 'top-[11px] h-[22px]' : 'top-2.5 h-6',
                    )}
                />
            ) : null}
            {icon.kind === 'image' ? (
                <span aria-hidden="true" className={cn('relative size-[22px] shrink-0', iconMotionClassName)}>
                    <img
                        src={icon.defaultSrc}
                        alt=""
                        aria-hidden="true"
                        className={cn(
                            'absolute inset-0 size-full object-contain transition-opacity duration-150',
                            isSelected || isInteractionPreview
                                ? 'opacity-0'
                                : canSwapImageIcon
                                  ? 'opacity-100 group-hover:opacity-0'
                                  : 'opacity-100',
                        )}
                    />
                    <img
                        src={icon.hoverSrc}
                        alt=""
                        aria-hidden="true"
                        className={cn(
                            'absolute inset-0 size-full object-contain transition-opacity duration-150',
                            isInteractionPreview ? 'opacity-100' : canSwapImageIcon ? 'opacity-0 group-hover:opacity-100' : 'opacity-0',
                        )}
                    />
                    <img
                        src={icon.activeSrc}
                        alt=""
                        aria-hidden="true"
                        className={cn(
                            'absolute inset-0 size-full object-contain transition-opacity duration-150',
                            isSelected ? 'opacity-100' : 'opacity-0',
                        )}
                    />
                </span>
            ) : CurrentComponentIcon ? (
                <CurrentComponentIcon
                    className={cn(
                        'size-5 shrink-0',
                        iconMotionClassName,
                        isSelected ? 'text-[#844AFF]' : 'text-gray-4 group-hover:text-sub-1',
                    )}
                    aria-hidden="true"
                />
            ) : null}
            {collapsed ? null : <span className="min-w-0 flex-1 truncate text-left">{text}</span>}
            {badgeCount > 0 ? (
                <span
                    className={cn(
                        'absolute flex min-w-3.5 items-center justify-center rounded-full bg-[#E55C6E] px-1 font-poppins text-[8px] leading-[14px] text-white',
                        collapsed ? 'top-1 right-1' : 'top-[7px] right-2',
                    )}
                    aria-hidden="true"
                >
                    {badgeLabel}
                </span>
            ) : null}
        </button>
    );
};

export default NavigationBarItem;
