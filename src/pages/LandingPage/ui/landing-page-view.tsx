import {isMobile} from 'is-mobile';
import MobileLanding from './mobile/mobile-landing';
import WebLanding from './web/web-landing';

export const LandingPageView = () => {
    const mobile = isMobile();

    return mobile ? <MobileLanding /> : <WebLanding />;
};
