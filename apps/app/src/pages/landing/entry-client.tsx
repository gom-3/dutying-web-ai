import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import type {ResourceLanguage} from 'i18next';
import {useEffect, useState} from 'react';
import {hydrateRoot} from 'react-dom/client';
import {I18nextProvider} from 'react-i18next';
import {createPath, Router, type Navigator} from 'react-router';
import {createLandingI18n} from './landing-i18n';
import LandingPageView, {guestSession, type TLandingSession} from './landing-page-view';
import type {LandingSessionBridge} from './landing-session';
import '../../index.css';

const container = document.getElementById('root')!;
const data = JSON.parse(document.getElementById('landing-data')!.textContent!) as {
    language: string;
    translation: ResourceLanguage;
};
const i18n = createLandingI18n(data.language, data.translation);
const queryClient = new QueryClient();
const createHref: Navigator['createHref'] = (to) => (typeof to === 'string' ? to : createPath(to));
// Public URLs each have their own HTML and metadata. Account actions that use
// useNavigate must load that document too, just like the landing's normal links.
const documentNavigator: Navigator = {
    createHref,
    go: (delta) => window.history.go(delta),
    push: (to) => window.location.assign(createHref(to)),
    replace: (to) => window.location.replace(createHref(to)),
};

function LandingClient() {
    const [session, setSession] = useState<TLandingSession>(guestSession);
    const [Bridge, setBridge] = useState<typeof LandingSessionBridge | null>(null);

    useEffect(() => {
        let active = true;

        // Analytics and persisted session loading never block or replace the public page.
        void import('../../initializeApp').then(({default: initializeApp}) => initializeApp()).catch(() => {});

        try {
            const saved = JSON.parse(localStorage.getItem('useAuthStore') ?? 'null');

            if (saved?.state?.accessToken) {
                void import('./landing-session')
                    .then(({LandingSessionBridge}) => {
                        if (active) setBridge(() => LandingSessionBridge);
                    })
                    .catch(() => {});
            }

            localStorage.setItem('i18nextLng', data.language);
        } catch {
            // The static page and its links also work when browser storage is unavailable.
        }

        container.dataset.hydrated = 'true';

        return () => {
            active = false;
        };
    }, []);

    return (
        <>
            <LandingPageView {...session} />
            {Bridge && <Bridge onChange={setSession} />}
        </>
    );
}

hydrateRoot(
    container,
    <I18nextProvider i18n={i18n}>
        <Router location={window.location.pathname + window.location.search + window.location.hash} navigator={documentNavigator}>
            <QueryClientProvider client={queryClient}>
                <LandingClient />
            </QueryClientProvider>
        </Router>
    </I18nextProvider>,
);
