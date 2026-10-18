import {useEffect, useRef} from 'react';
import ReactGA from 'react-ga4';
import {useLocation} from 'react-router-dom';
import {analyticsPageLocation, isGoogleAnalyticsEnabled} from '@/shared/config/analytics';

/** Owns page_view; automatic initial/history collection is disabled for this stream. */
export function AnalyticsRouteObserver() {
    const {pathname} = useLocation();
    const previousPath = useRef<string | null>(null);

    useEffect(() => {
        if (!isGoogleAnalyticsEnabled() || previousPath.current === pathname) return;

        previousPath.current = pathname;
        ReactGA.event('page_view', {page_path: pathname, page_location: analyticsPageLocation(pathname)});
    }, [pathname]);

    return null;
}
