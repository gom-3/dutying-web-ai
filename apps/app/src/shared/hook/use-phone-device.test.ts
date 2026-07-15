import {afterEach, describe, expect, it} from 'vitest';
import {getIsPhoneDevice} from './use-phone-device';

const originalUserAgent = navigator.userAgent;

function setUserAgent(userAgent: string) {
    Object.defineProperty(window.navigator, 'userAgent', {
        configurable: true,
        writable: true,
        value: userAgent,
    });
}

describe('getIsPhoneDevice', () => {
    afterEach(() => setUserAgent(originalUserAgent));

    it.each([
        'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1',
        'Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 Chrome/140.0.0.0 Mobile Safari/537.36',
    ])('recognizes a phone user agent: %s', (userAgent) => {
        setUserAgent(userAgent);

        expect(getIsPhoneDevice()).toBe(true);
    });

    it.each([
        'Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1',
        'Mozilla/5.0 (Linux; Android 15; Tablet) AppleWebKit/537.36 Chrome/140.0.0.0 Safari/537.36',
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/140.0.0.0 Safari/537.36',
    ])('keeps tablets and desktop browsers on the web experience: %s', (userAgent) => {
        setUserAgent(userAgent);

        expect(getIsPhoneDevice()).toBe(false);
    });
});
