import ReactGA from 'react-ga4';
import {beforeEach, expect, it, vi} from 'vitest';
import {isGoogleAnalyticsEnabled} from '@/shared/config/analytics';
import {trackProductOutcome} from '../growth-analytics';

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
