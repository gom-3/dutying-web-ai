import isMobile from 'is-mobile';
import {useState} from 'react';

export function getIsPhoneDevice() {
    if (typeof navigator === 'undefined') {
        return false;
    }

    // is-mobile's default mode detects phones only. Tablets remain on the web
    // experience, including iPadOS devices using a desktop-style user agent.
    return isMobile({ua: navigator.userAgent});
}

export function usePhoneDevice() {
    // Device type does not change when a desktop browser is resized, so this
    // deliberately does not subscribe to resize or matchMedia events.
    const [isPhoneDevice] = useState(getIsPhoneDevice);

    return isPhoneDevice;
}
