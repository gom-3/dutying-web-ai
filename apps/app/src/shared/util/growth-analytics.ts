import ReactGA from 'react-ga4';
import {isGoogleAnalyticsEnabled} from '@/shared/config/analytics';

/** Send synchronously before document navigation; only controlled values are allowed. */
export function trackGrowthAction(action: 'web_cta_click' | 'app_store_click', destination: 'web' | 'ios' | 'android') {
    if (!isGoogleAnalyticsEnabled()) return;

    ReactGA.event(action, {destination});
}
