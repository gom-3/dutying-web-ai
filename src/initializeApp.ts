import * as Sentry from '@sentry/react';
import {createBrowserHistory} from 'history';
import {enableMapSet} from 'immer';
import ReactPixel from 'react-facebook-pixel';
import ReactGA from 'react-ga4';

export default function initializeApp() {
    enableMapSet();

    if (import.meta.env.PROD) {
        Sentry.init({
            dsn: 'https://5035f79c451043f4b6438a90817ff608@o4505477969084416.ingest.us.sentry.io/4505477970526208',
            tracesSampleRate: 0.2,
            attachStacktrace: true,
            environment: 'production',
        });

        // GA 관련 초기화
        ReactGA.initialize(import.meta.env.VITE_GA_TRACKING_ID, {gaOptions: {}});

        const history = createBrowserHistory();

        history.listen(async (response) => {
            ReactGA.send({hitType: 'pageview', page: response.location.pathname});
        });

        // Pixel 관련 초기화
        ReactPixel.init(import.meta.env.VITE_PIXEL_ID);
        ReactPixel.pageView();
    }
}
