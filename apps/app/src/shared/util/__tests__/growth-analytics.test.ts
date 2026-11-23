import ReactGA from 'react-ga4';
import {afterEach, beforeEach, expect, it, vi} from 'vitest';
import {isGoogleAnalyticsEnabled, isMetaPixelEnabled} from '@/shared/config/analytics';
import {setAnalyticsAccount, trackProductOutcome, trackScheduleSignal} from '../growth-analytics';

const pixelTrack = vi.fn();

vi.mock('react-ga4', () => ({default: {event: vi.fn(), gtag: vi.fn()}}));
vi.mock('@/shared/config/analytics', () => ({isGoogleAnalyticsEnabled: vi.fn(() => true), isMetaPixelEnabled: vi.fn(() => true)}));
beforeEach(() => {
    vi.resetAllMocks();
    vi.stubGlobal('fbq', pixelTrack);
    vi.mocked(isMetaPixelEnabled).mockReturnValue(true);
    vi.mocked(isGoogleAnalyticsEnabled).mockReturnValue(true);
});
afterEach(() => vi.unstubAllGlobals());
it('keeps app/admin principals distinct and clears invalid or logged-out identities', () => {
    setAnalyticsAccount('app', 42);
    setAnalyticsAccount('web', 42);
    setAnalyticsAccount('web', null);
    setAnalyticsAccount('app', -1);
    expect(ReactGA.gtag).toHaveBeenNthCalledWith(1, 'set', 'user_id', 'app_42');
    expect(ReactGA.gtag).toHaveBeenNthCalledWith(2, 'set', 'user_id', 'web_42');
    expect(ReactGA.gtag).toHaveBeenNthCalledWith(3, 'set', 'user_id', null);
    expect(ReactGA.gtag).toHaveBeenNthCalledWith(4, 'set', 'user_id', null);
});
it('does not identify users when collection is disabled or break auth on SDK failure', () => {
    vi.mocked(isGoogleAnalyticsEnabled).mockReturnValue(false);
    setAnalyticsAccount('web', 42);
    expect(ReactGA.gtag).not.toHaveBeenCalled();
    vi.mocked(isGoogleAnalyticsEnabled).mockReturnValue(true);
    vi.mocked(ReactGA.gtag).mockImplementationOnce(() => {
        throw new Error('SDK unavailable');
    });
    expect(() => setAnalyticsAccount('web', 42)).not.toThrow();
});
it('sends only controlled outcome metadata', () => {
    trackProductOutcome('sign_up', 'password');
    expect(ReactGA.event).toHaveBeenCalledWith('sign_up', {schema_version: 1, service: 'dutying_ai', method: 'password'});
});
it('blocks development and preview outcomes', () => {
    vi.mocked(isGoogleAnalyticsEnabled).mockReturnValue(false);
    trackProductOutcome('ward_created');
    expect(ReactGA.event).not.toHaveBeenCalled();
});
it('keeps a successful product action successful when the analytics SDK fails', () => {
    vi.mocked(ReactGA.event).mockImplementationOnce(() => {
        throw new Error('SDK unavailable');
    });
    expect(() => trackProductOutcome('schedule_confirmed')).not.toThrow();
});

it.each([
    'preparation_started',
    'preparation_paused',
    'comparison_open',
    'regeneration_selected',
    'outcome_recheck',
    'feedback_open',
    'feedback_sent',
] as const)('sends a controlled scheduling signal without user text or identifiers: %s', (signal) => {
    trackScheduleSignal(signal);
    expect(ReactGA.event).toHaveBeenCalledWith('schedule_behavior', {schema_version: 1, service: 'dutying_ai', signal});
});
it('does not send scheduling signals when analytics is disabled', () => {
    vi.mocked(isGoogleAnalyticsEnabled).mockReturnValue(false);
    trackScheduleSignal('feedback_open');
    expect(ReactGA.event).not.toHaveBeenCalled();
});
it('keeps scheduling usable when either analytics configuration or the SDK fails', () => {
    vi.mocked(isGoogleAnalyticsEnabled).mockImplementationOnce(() => {
        throw new Error('configuration unavailable');
    });
    expect(() => trackScheduleSignal('comparison_open')).not.toThrow();
    vi.mocked(ReactGA.event).mockImplementationOnce(() => {
        throw new Error('SDK unavailable');
    });
    expect(() => trackScheduleSignal('feedback_sent')).not.toThrow();
});

it.each(['password', 'social'] as const)('sends standard Meta registration after %s signup', (method) => {
    trackProductOutcome('sign_up', method);
    expect(pixelTrack).toHaveBeenCalledExactlyOnceWith('track', 'CompleteRegistration', {status: true, registration_method: method});
});
it('does not treat login or scheduling as registration', () => {
    trackProductOutcome('login', 'social');
    trackProductOutcome('ward_created');
    expect(pixelTrack).not.toHaveBeenCalled();
});
it('sends Meta registration even when GA is disabled or throws', () => {
    vi.mocked(isGoogleAnalyticsEnabled).mockReturnValue(false);
    trackProductOutcome('sign_up', 'password');
    vi.mocked(isGoogleAnalyticsEnabled).mockReturnValue(true);
    vi.mocked(ReactGA.event).mockImplementationOnce(() => {
        throw new Error('GA unavailable');
    });
    trackProductOutcome('sign_up', 'social');
    expect(pixelTrack).toHaveBeenCalledTimes(2);
});
it('blocks Meta on disabled hosts and contains pixel failures', () => {
    vi.mocked(isMetaPixelEnabled).mockReturnValue(false);
    trackProductOutcome('sign_up', 'password');
    expect(pixelTrack).not.toHaveBeenCalled();
    vi.mocked(isMetaPixelEnabled).mockReturnValue(true);
    vi.mocked(pixelTrack).mockImplementationOnce(() => {
        throw new Error('pixel unavailable');
    });
    expect(() => trackProductOutcome('sign_up', 'password')).not.toThrow();
});
