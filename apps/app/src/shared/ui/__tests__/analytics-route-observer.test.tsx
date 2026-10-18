import {fireEvent, render, screen} from '@testing-library/react';
import {StrictMode} from 'react';
import ReactGA from 'react-ga4';
import {MemoryRouter, useNavigate} from 'react-router-dom';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import {isGoogleAnalyticsEnabled} from '@/shared/config/analytics';
import type * as AnalyticsConfig from '@/shared/config/analytics';
import {AnalyticsRouteObserver} from '../analytics-route-observer';

vi.mock('react-ga4', () => ({default: {event: vi.fn()}}));
vi.mock('@/shared/config/analytics', async (importOriginal) => ({
    ...(await importOriginal<typeof AnalyticsConfig>()),
    isGoogleAnalyticsEnabled: vi.fn(() => true),
}));

function Controls() {
    const navigate = useNavigate();

    return (
        <>
            <button onClick={() => navigate('/make?token=secret#private')}>move</button>
            <button onClick={() => navigate('/make?month=11')}>query</button>
            <button onClick={() => navigate(-1)}>back</button>
        </>
    );
}

beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(isGoogleAnalyticsEnabled).mockReturnValue(true);
});

describe('route measurements', () => {
    it('records initial/path/back navigation without query, hash, or strict-mode duplicates', () => {
        render(
            <StrictMode>
                <MemoryRouter>
                    <AnalyticsRouteObserver />
                    <Controls />
                </MemoryRouter>
            </StrictMode>,
        );
        expect(ReactGA.event).toHaveBeenCalledTimes(1);
        fireEvent.click(screen.getByText('move'));
        expect(ReactGA.event).toHaveBeenLastCalledWith('page_view', {page_path: '/make', page_location: window.location.origin + '/make'});
        fireEvent.click(screen.getByText('query'));
        expect(ReactGA.event).toHaveBeenCalledTimes(2);
        fireEvent.click(screen.getByText('back'));
        expect(ReactGA.event).toHaveBeenCalledTimes(2);
        fireEvent.click(screen.getByText('back'));
        expect(ReactGA.event).toHaveBeenLastCalledWith('page_view', {page_path: '/', page_location: window.location.origin + '/'});
        expect(ReactGA.event).toHaveBeenCalledTimes(3);
    });

    it('does not collect when disabled', () => {
        vi.mocked(isGoogleAnalyticsEnabled).mockReturnValue(false);
        render(
            <MemoryRouter>
                <AnalyticsRouteObserver />
            </MemoryRouter>,
        );
        expect(ReactGA.event).not.toHaveBeenCalled();
    });
});
