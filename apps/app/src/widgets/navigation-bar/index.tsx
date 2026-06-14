import {cn} from '@dutying/utils/style';
import {useEffect, useState} from 'react';
import {Link} from 'react-router';
import {events, sendEvent} from '@/analytics';
import {FoldIcon} from '@/shared/assets/svg';
import ROUTE from '@/shared/constant/path';
import {useTypedTranslation} from '@/shared/hook/use-typed-translation';
import {useNavigationBarFoldStore} from './navigation-bar-fold-store';
import NavigationBarItemGroups from './NavigationBarItemGroup';

const NAV_WIDTH_EXPANDED = 'w-[216px]';
const NAV_WIDTH_COLLAPSED = 'w-[64px]';

type TNavigationBarProps = {
    compactMode?: boolean;
};

const NavigationBar = ({compactMode = false}: TNavigationBarProps) => {
    const {t} = useTypedTranslation();
    const isFold = useNavigationBarFoldStore((s) => s.isFold);
    const setFold = useNavigationBarFoldStore((s) => s.setFold);
    const resetFold = useNavigationBarFoldStore((s) => s.reset);
    const [isHoverExpanded, setIsHoverExpanded] = useState(false);
    const [isFocusExpanded, setIsFocusExpanded] = useState(false);
    const isBaseFolded = compactMode || isFold;
    const isPreviewExpanded = isBaseFolded && (isHoverExpanded || isFocusExpanded);
    const isCollapsed = isBaseFolded && !isPreviewExpanded;

    useEffect(() => {
        return () => {
            resetFold();
        };
    }, [resetFold]);

    useEffect(() => {
        if (!isBaseFolded) {
            setIsHoverExpanded(false);
            setIsFocusExpanded(false);
        }
    }, [isBaseFolded]);

    return (
        <aside
            data-testid="navigation-bar"
            className={cn(
                'sticky top-0 z-[997] min-h-screen shrink-0 overflow-x-hidden border-r border-gray-6 bg-white font-apple shadow-[8px_0_24px_rgba(36,36,40,0.04)] transition-[width] duration-300 ease-out',
                isCollapsed ? NAV_WIDTH_COLLAPSED : NAV_WIDTH_EXPANDED,
            )}
            onPointerEnter={() => {
                if (isBaseFolded) {
                    setIsHoverExpanded(true);
                }
            }}
            onPointerLeave={() => setIsHoverExpanded(false)}
            onFocusCapture={() => {
                if (isBaseFolded) {
                    setIsFocusExpanded(true);
                }
            }}
            onBlurCapture={(event) => {
                const nextFocusedElement = event.relatedTarget;

                if (!(nextFocusedElement instanceof Node) || !event.currentTarget.contains(nextFocusedElement)) {
                    setIsFocusExpanded(false);
                }
            }}
        >
            <div className={cn('flex min-h-screen flex-col', isCollapsed ? 'px-2 py-3' : 'px-3 py-4')}>
                <div className={cn('flex min-h-11 items-center', isCollapsed ? 'flex-col gap-2' : 'justify-between')}>
                    <Link
                        to={ROUTE.ROOT}
                        aria-label={t('page.navigationBar.landingAria')}
                        className="shrink-0 rounded-[8px] focus-visible:ring-2 focus-visible:ring-main-3 focus-visible:ring-offset-2 focus-visible:outline-none"
                    >
                        {isCollapsed ? (
                            <img src="/img/image-43-2.png" alt="" aria-hidden="true" className="mt-2 size-[22px] object-contain" />
                        ) : (
                            <img
                                src="/img/group-19.png"
                                alt=""
                                aria-hidden="true"
                                className="h-[26px] w-auto max-w-[128px] object-contain"
                            />
                        )}
                    </Link>
                    {compactMode ? null : (
                        <button
                            data-testid="navigation-bar-fold-trigger"
                            type="button"
                            aria-label={t(isFold ? 'page.navigationBar.expandAria' : 'page.navigationBar.foldAria')}
                            className={cn(
                                'flex size-11 shrink-0 items-center justify-center rounded-[10px] text-gray-4 transition-colors hover:bg-gray-7 hover:text-sub-1',
                                'focus-visible:ring-2 focus-visible:ring-main-3 focus-visible:ring-offset-2 focus-visible:outline-none',
                            )}
                            onClick={() => {
                                setFold(!isFold, 'user');
                                setIsHoverExpanded(false);
                                setIsFocusExpanded(false);
                                sendEvent(isFold ? events.navigationBar.spreadNavigation : events.navigationBar.foldNavigation);
                            }}
                        >
                            <FoldIcon className={cn('size-[26px]', isFold ? 'rotate-180' : undefined)} />
                        </button>
                    )}
                </div>

                <NavigationBarItemGroups collapsed={isCollapsed} />
            </div>
        </aside>
    );
};

export default NavigationBar;
