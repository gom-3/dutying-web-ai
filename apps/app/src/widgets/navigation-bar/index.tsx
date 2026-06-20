import {cn} from '@dutying/utils/style';
import {useEffect, useRef, useState} from 'react';
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
    const closePreviewTimeoutRef = useRef<number | null>(null);
    const isPreviewExpanded = compactMode && (isHoverExpanded || isFocusExpanded);
    const isCollapsed = compactMode ? !isPreviewExpanded : isFold;

    useEffect(() => {
        return () => {
            if (closePreviewTimeoutRef.current !== null) {
                window.clearTimeout(closePreviewTimeoutRef.current);
            }

            resetFold();
        };
    }, [resetFold]);

    useEffect(() => {
        if (!compactMode) {
            setIsHoverExpanded(false);
            setIsFocusExpanded(false);
        }
    }, [compactMode]);

    const closePreview = () => {
        if (closePreviewTimeoutRef.current !== null) {
            window.clearTimeout(closePreviewTimeoutRef.current);
        }

        closePreviewTimeoutRef.current = window.setTimeout(() => {
            setIsHoverExpanded(false);
            setIsFocusExpanded(false);
            closePreviewTimeoutRef.current = null;
        }, 120);
    };

    return (
        <aside
            data-testid="navigation-bar"
            className={cn(
                'sticky top-0 z-[997] h-dvh max-h-dvh shrink-0 overflow-hidden border-r border-gray-6 bg-white font-apple shadow-[8px_0_24px_rgba(36,36,40,0.04)] transition-[width] duration-300 ease-out',
                isCollapsed ? NAV_WIDTH_COLLAPSED : NAV_WIDTH_EXPANDED,
            )}
            onPointerEnter={() => {
                if (compactMode) {
                    setIsHoverExpanded(true);
                }
            }}
            onPointerLeave={() => setIsHoverExpanded(false)}
            onFocusCapture={() => {
                if (compactMode) {
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
            <div
                className={cn(
                    'flex h-full min-h-0 shrink-0 flex-col',
                    isCollapsed
                        ? 'w-[64px] px-2 py-3 [@media(max-height:720px)]:py-2'
                        : 'w-[216px] px-3 py-4 [@media(max-height:760px)]:py-3',
                )}
            >
                <div
                    className={cn(
                        'flex min-h-11 items-center [@media(max-height:760px)]:min-h-10',
                        isCollapsed ? 'flex-col gap-2' : 'justify-between',
                    )}
                >
                    <Link
                        to={ROUTE.HOME}
                        aria-label={t('page.navigationBar.home')}
                        className="shrink-0 rounded-[8px] focus-visible:ring-2 focus-visible:ring-main-3 focus-visible:ring-offset-2 focus-visible:outline-none"
                    >
                        {isCollapsed ? (
                            <img
                                src="/img/image-43-2.png"
                                alt=""
                                aria-hidden="true"
                                className="mt-2 size-[22px] object-contain [@media(max-height:720px)]:mt-1"
                            />
                        ) : (
                            <img
                                src="/img/group-19.png"
                                alt=""
                                aria-hidden="true"
                                className="h-[26px] w-auto max-w-[128px] object-contain [@media(max-height:760px)]:h-6"
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

                <NavigationBarItemGroups collapsed={isCollapsed} onItemNavigate={compactMode ? closePreview : undefined} />
            </div>
        </aside>
    );
};

export default NavigationBar;
