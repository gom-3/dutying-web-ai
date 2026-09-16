// Public landing HTML is already rendered. Product routes retain their SPA entry.
const container = document.getElementById('root');
const isLandingRoute = /^\/(?:en|ja|zh|th|vi)?\/?$/.test(window.location.pathname);

if (isLandingRoute && container?.dataset.rendered === 'landing') {
    void import('./pages/landing/entry-client');
} else {
    void import('./app-client');
}
