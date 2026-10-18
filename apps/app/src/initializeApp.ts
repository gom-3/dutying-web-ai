import * as Sentry from '@sentry/react';
import {enableMapSet} from 'immer';
import ReactPixel from 'react-facebook-pixel';
import ReactGA from 'react-ga4';
import {googleAnalyticsMeasurementId, isGoogleAnalyticsEnabled, isMetaPixelEnabled} from '@/shared/config/analytics';
import {isNonProductionAppDomain} from '@/shared/config/feature-flags';

export default function initializeApp() {
    enableMapSet();

    if (import.meta.env.PROD) {
        const gaTrackingId = googleAnalyticsMeasurementId();
        const pixelId = import.meta.env.VITE_PIXEL_ID;

        Sentry.init({
            dsn: 'https://5035f79c451043f4b6438a90817ff608@o4505477969084416.ingest.us.sentry.io/4505477970526208',
            tracesSampleRate: 0.2,
            attachStacktrace: true,
            // dev/preview 배포도 PROD 빌드라 여기까지 들어온다. 접속 도메인으로 갈라야
            // 개발 환경 에러가 운영 이슈로 섞이지 않는다.
            environment: isNonProductionAppDomain() ? 'development' : 'production',
        });

        // The dedicated .ai stream has enhanced measurement disabled. Router owns page_view.
        if (isGoogleAnalyticsEnabled() && gaTrackingId) {
            ReactGA.initialize(gaTrackingId, {gtagOptions: {send_page_view: false}});
        }

        // Pixel 관련 초기화
        if (isMetaPixelEnabled() && pixelId) {
            ReactPixel.init(pixelId);
            ReactPixel.pageView();
        }
    }
}
