import ReactPixel from 'react-facebook-pixel';
import ReactGA from 'react-ga4';
import {beforeEach, expect, it, vi} from 'vitest';
import {isGoogleAnalyticsEnabled, isMetaPixelEnabled} from '@/shared/config/analytics';
import {trackProductOutcome, trackScheduleSignal} from '../growth-analytics';

vi.mock('react-facebook-pixel', () => ({default: {track: vi.fn()}}));
vi.mock('react-ga4', () => ({default: {event: vi.fn()}}));
vi.mock('@/shared/config/analytics', () => ({isGoogleAnalyticsEnabled: vi.fn(() => true), isMetaPixelEnabled: vi.fn(() => true)}));
beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(isMetaPixelEnabled).mockReturnValue(true);
    vi.mocked(isGoogleAnalyticsEnabled).mockReturnValue(true);
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
    expect(ReactPixel.track).toHaveBeenCalledExactlyOnceWith('CompleteRegistration', {status: true, registration_method: method});
});
it('does not treat login or scheduling as registration', () => {
    trackProductOutcome('login', 'social');
    trackProductOutcome('ward_created');
    expect(ReactPixel.track).not.toHaveBeenCalled();
});
it('sends Meta registration even when GA is disabled or throws', () => {
    vi.mocked(isGoogleAnalyticsEnabled).mockReturnValue(false);
    trackProductOutcome('sign_up', 'password');
    vi.mocked(isGoogleAnalyticsEnabled).mockReturnValue(true);
    vi.mocked(ReactGA.event).mockImplementationOnce(() => {
        throw new Error('GA unavailable');
    });
    trackProductOutcome('sign_up', 'social');
    expect(ReactPixel.track).toHaveBeenCalledTimes(2);
});
it('blocks Meta on disabled hosts and contains pixel failures', () => {
    vi.mocked(isMetaPixelEnabled).mockReturnValue(false);
    trackProductOutcome('sign_up', 'password');
    expect(ReactPixel.track).not.toHaveBeenCalled();
    vi.mocked(isMetaPixelEnabled).mockReturnValue(true);
    vi.mocked(ReactPixel.track).mockImplementationOnce(() => {
        throw new Error('pixel unavailable');
    });
    expect(() => trackProductOutcome('sign_up', 'password')).not.toThrow();
});
