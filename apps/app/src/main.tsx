import {captureBillingReturnPayload} from './features/commercial/billing-return-payload';
import {getIndexedMarketingLanguageFromPath} from './shared/seo/marketing-locale';

// Scrub the single-use card authorization before loading the application or analytics.
captureBillingReturnPayload();

// Public landing HTML is already rendered. Product routes retain their SPA entry.
const container = document.getElementById('root');

if (container?.dataset.rendered === 'landing' && getIndexedMarketingLanguageFromPath(window.location.pathname)) {
    void import('./pages/landing/entry-client');
} else {
    void import('./app-client');
}
