import ReactGA from 'react-ga4';
import {beforeEach, expect, it, vi} from 'vitest';
import {isGoogleAnalyticsEnabled} from '@/shared/config/analytics';
import {trackProductOutcome, trackScheduleSignal} from '../growth-analytics';

vi.mock('react-ga4', () => ({default: {event: vi.fn()}}));
vi.mock('@/shared/config/analytics', () => ({isGoogleAnalyticsEnabled: vi.fn(() => true)}));
beforeEach(() => {
    vi.clearAllMocks();
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
