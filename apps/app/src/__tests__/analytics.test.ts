import ReactPixel from 'react-facebook-pixel';
import ReactGA from 'react-ga4';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import {isGoogleAnalyticsEnabled, isMetaPixelEnabled} from '@/shared/config/analytics';
import {trackGrowthAction} from '@/shared/util/growth-analytics';
import {events, sendEvent} from '../analytics';

vi.mock('react-ga4', () => ({default: {event: vi.fn()}}));
vi.mock('react-facebook-pixel', () => ({default: {trackCustom: vi.fn()}}));
vi.mock('@/shared/config/analytics', () => ({isGoogleAnalyticsEnabled: vi.fn(), isMetaPixelEnabled: vi.fn()}));

beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(isGoogleAnalyticsEnabled).mockReturnValue(false);
    vi.mocked(isMetaPixelEnabled).mockReturnValue(false);
});

describe('analytics destinations', () => {
    it('does not send to disabled or unconfigured providers', () => {
        sendEvent(events.auth.login);
        trackGrowthAction('app_store_click', 'ios');
        expect(ReactGA.event).not.toHaveBeenCalled();
        expect(ReactPixel.trackCustom).not.toHaveBeenCalled();
    });

    it('keeps provider configuration independent', () => {
        vi.mocked(isMetaPixelEnabled).mockReturnValue(true);
        sendEvent(events.auth.login);
        expect(ReactPixel.trackCustom).toHaveBeenCalledWith('auth_login', {label: undefined});
        expect(ReactGA.event).not.toHaveBeenCalled();
    });

    it.each(['ios', 'android'] as const)('records %s store click as a click, not installation', (store) => {
        vi.mocked(isGoogleAnalyticsEnabled).mockReturnValue(true);
        trackGrowthAction('app_store_click', store);
        expect(ReactGA.event).toHaveBeenCalledExactlyOnceWith('app_store_click', {destination: store});
    });
});
