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

/** Behavioral signals are not dissatisfaction labels. Never include request/result text or scope IDs. */
export function trackScheduleSignal(
    signal: 'comparison_open' | 'regeneration_selected' | 'outcome_recheck' | 'feedback_open' | 'feedback_sent',
) {
    try {
        if (!isGoogleAnalyticsEnabled()) return;

        ReactGA.event('schedule_behavior', {schema_version: 1, service: 'dutying_ai', signal});
    } catch {
        // Observation is optional; scheduling and feedback must keep working.
    }
}
