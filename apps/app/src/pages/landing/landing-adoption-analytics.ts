import ReactGA from 'react-ga4';
import {isGoogleAnalyticsEnabled} from '@/shared/config/analytics';

type TAdoptionEvent = ['cta_click', 'header'] | ['form_start' | 'form_success' | 'email_handoff'];

export function trackLandingAdoption(...[event, placement]: TAdoptionEvent) {
    try {
        if (isGoogleAnalyticsEnabled()) {
            ReactGA.event(`landing_adoption_${event}`, placement ? {placement} : {});
        }
    } catch {
        // Measurement must never interrupt an application.
    }
}
