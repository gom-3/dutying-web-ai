import {type ReactNode} from 'react';
import {MemoryRouter, useLocation} from 'react-router';
import {beforeEach, describe, expect, it} from 'vitest';
import {render, screen, waitFor} from '@/shared/util/test-utils';
import {useMakeShiftStore} from '../make-shift-store';
import {useMakeShiftRouteSync} from '../use-route-sync';

function SyncProbe() {
    useMakeShiftRouteSync();

    const location = useLocation();

    return <div data-testid="location">{`${location.pathname}${location.search}`}</div>;
}

function wrapper(initialEntry: string) {
    return function TestWrapper({children}: {children: ReactNode}) {
        return <MemoryRouter initialEntries={[initialEntry]}>{children}</MemoryRouter>;
    };
}

function readSearchParams() {
    const locationText = screen.getByTestId('location').textContent ?? '';
    const queryString = locationText.split('?')[1] ?? '';

    return new URLSearchParams(queryString);
}

describe('useMakeShiftRouteSync', () => {
    beforeEach(() => {
        useMakeShiftStore.setState({
            phase: 'overview',
            currentStep: 1,
            maxReachedStep: 1,
            isHydrated: true,
            wardId: 1,
            year: 2026,
            month: 7,
            shiftTeams: [],
            shiftTeamsStatus: 'success',
            currentShiftTeamId: 10,
            shiftStatus: 'success',
            shiftExists: false,
            shiftFullyAssigned: false,
            confirmedShiftSnapshot: null,
            workerConfirmationStatus: 'idle',
            workerConfirmationCount: 0,
            stepNavigationBusy: {},
        });
    });

    it('writes the selected month and team to the URL while clearing stale one-time flags', async () => {
        render(<SyncProbe />, {wrapper: wrapper('/make?foo=bar&step=4&onboardingSchedule=1')});

        await waitFor(() => {
            const params = readSearchParams();

            expect(params.get('foo')).toBe('bar');
            expect(params.get('year')).toBe('2026');
            expect(params.get('month')).toBe('7');
            expect(params.get('shiftTeamId')).toBe('10');
            expect(params.get('step')).toBeNull();
            expect(params.get('onboardingSchedule')).toBeNull();
        });
    });

    it('keeps the current step in the URL during the authoring flow', async () => {
        useMakeShiftStore.setState({
            phase: 'stepping',
            currentStep: 3,
            maxReachedStep: 3,
        });

        render(<SyncProbe />, {wrapper: wrapper('/make?year=2026&month=7&shiftTeamId=10')});

        await waitFor(() => {
            const params = readSearchParams();

            expect(params.get('year')).toBe('2026');
            expect(params.get('month')).toBe('7');
            expect(params.get('shiftTeamId')).toBe('10');
            expect(params.get('step')).toBe('3');
        });
    });
});
