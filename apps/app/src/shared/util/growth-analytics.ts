import ReactGA from 'react-ga4';
import {isGoogleAnalyticsEnabled} from '@/shared/config/analytics';

/** Send synchronously before document navigation; only controlled values are allowed. */
export function trackGrowthAction(action: 'web_cta_click' | 'app_store_click', destination: 'web' | 'ios' | 'android') {
    if (!isGoogleAnalyticsEnabled()) return;

    ReactGA.event(action, {destination});
}

/** Outcome events contain controlled enums only; analytics must never break a successful action. */
export function trackProductOutcome(
    event: 'login' | 'sign_up' | 'ward_created' | 'schedule_confirmed' | 'schedule_published',
    method?: 'password' | 'social',
) {
    if (!isGoogleAnalyticsEnabled()) return;

    try {
        ReactGA.event(event, {schema_version: 1, service: 'dutying_ai', ...(method ? {method} : {})});
    } catch {
        // Telemetry failures must not change account or scheduling outcomes.
    }
}
