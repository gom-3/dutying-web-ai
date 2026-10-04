// Public landing HTML is already rendered. Product routes retain their SPA entry.
import {getSavedLanguagePreferenceCookie, normalizePreferredLanguage} from '@/shared/i18n/locale';
import {getCountryLanguage, loadVisitorCountry} from '@/shared/i18n/visitor-country';

const container = document.getElementById('root');
const isLandingRoute = /^\/(?:en|ja|zh|th|vi)?\/?$/.test(window.location.pathname);

if (isLandingRoute && container?.dataset.rendered === 'landing') {
    void import('./pages/landing/entry-client');
} else {
    void loadVisitorCountry().then((country) => {
        try {
            if (!window.localStorage.getItem('i18nextLng')) {
                const browserLanguage =
                    navigator.languages.map(normalizePreferredLanguage).find(Boolean) ?? normalizePreferredLanguage(navigator.language);
                const language = getSavedLanguagePreferenceCookie() ?? getCountryLanguage(country) ?? browserLanguage ?? 'en';

                window.localStorage.setItem('i18nextLng', language);
            }
        } catch {
            // Private browsing can block storage; i18next will use navigator instead.
        }

        return import('./app-client');
    });
}
