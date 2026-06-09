import {beforeEach, describe, expect, it, vi} from 'vitest';
import {render, screen} from '@/shared/util/test-utils';
import {loadDraftStep} from '../../model/make-shift-progress-storage';
import {MakeShiftPageView} from '../index';

type TMockMakeShiftState = {
    phase: 'overview' | 'stepping';
    currentStep: 1 | 2 | 3 | 4 | 5 | 6;
    maxReachedStep: 1 | 2 | 3 | 4 | 5 | 6;
    year: number;
    month: number;
    shiftStatus: 'idle' | 'pending' | 'success' | 'error';
    shiftExists: boolean;
    shiftFullyAssigned: boolean;
    shiftTeams: Array<{shiftTeamId: number; name: string}>;
    shiftTeamsStatus: 'idle' | 'pending' | 'success' | 'error';
    currentShiftTeamId: number | null;
    wardId: number | null;
};

const mockUseCase = {
    start: vi.fn(),
    retryOverview: vi.fn(),
    goToStep: vi.fn(),
    prev: vi.fn(),
    next: vi.fn(),
};

let makeShiftState: TMockMakeShiftState;

vi.mock('@/shared/hook/use-typed-translation', () => ({
    useTypedTranslation: () => ({
        t: (key: string) => key,
    }),
}));

vi.mock('../../model/make-shift-progress-storage', () => ({
    loadDraftStep: vi.fn(() => null),
}));

vi.mock('../../model/make-shift-use-case', () => ({
    useMakeShiftUseCase: () => mockUseCase,
}));

vi.mock('../../model/make-shift-store', () => ({
    canGoNext: vi.fn(() => true),
    canGoPrev: vi.fn(() => false),
    useMakeShiftStore: (selector: (state: TMockMakeShiftState) => unknown) => selector(makeShiftState),
}));

vi.mock('../make-shift-header', () => ({
    MakeShiftHeader: () => <div data-testid="make-shift-header" />,
}));

vi.mock('../make-shift-stepper', () => ({
    MakeShiftStepper: () => <div data-testid="make-shift-stepper" />,
}));

vi.mock('../make-shift-step-content', () => ({
    MakeShiftStepContent: () => <div data-testid="make-shift-step-content" />,
}));

const mockLoadDraftStep = vi.mocked(loadDraftStep);

describe('MakeShiftPageView layout', () => {
    beforeEach(() => {
        mockLoadDraftStep.mockReturnValue(null);
        mockUseCase.start.mockClear();
        mockUseCase.retryOverview.mockClear();
        mockUseCase.goToStep.mockClear();
        mockUseCase.prev.mockClear();
        mockUseCase.next.mockClear();

        makeShiftState = {
            phase: 'stepping',
            currentStep: 1,
            maxReachedStep: 1,
            year: 2026,
            month: 6,
            shiftStatus: 'success',
            shiftExists: false,
            shiftFullyAssigned: false,
            shiftTeams: [{shiftTeamId: 1, name: 'A team'}],
            shiftTeamsStatus: 'success',
            currentShiftTeamId: 1,
            wardId: 1,
        };
    });

    it.each([1, 2, 3, 4, 5] as const)('lets stepping step %i grow vertically so the white card can expand', (currentStep) => {
        makeShiftState = {
            ...makeShiftState,
            currentStep,
            maxReachedStep: currentStep,
        };

        render(<MakeShiftPageView />);

        const stepContentWrapper = screen.getByTestId('make-shift-step-content').parentElement;
        const contentCard = screen.getByTestId('make-shift-stepper').parentElement;

        expect(contentCard).toHaveClass('overflow-visible');
        expect(contentCard).not.toHaveClass('overflow-hidden');
        expect(contentCard).not.toHaveClass('min-h-0');
        expect(stepContentWrapper).toHaveClass('pb-3');
        expect(stepContentWrapper).not.toHaveClass('min-h-0');
        expect(stepContentWrapper).not.toHaveClass('flex-1');
    });

    it('keeps the bounded layout outside the stepping flow', () => {
        makeShiftState = {
            ...makeShiftState,
            phase: 'overview',
            shiftStatus: 'pending',
        };

        render(<MakeShiftPageView />);

        const contentCard = screen.getByTestId('make-shift-header').nextElementSibling;

        expect(contentCard).toHaveClass('overflow-hidden');
        expect(contentCard).toHaveClass('min-h-0');
    });

    it('shows the first create action when the selected month has no progress', () => {
        makeShiftState = {
            ...makeShiftState,
            phase: 'overview',
            shiftStatus: 'success',
            shiftExists: false,
            shiftFullyAssigned: false,
        };

        render(<MakeShiftPageView />);

        expect(screen.getByRole('button', {name: /page\.makeShift\.overview\.createShift/})).toBeInTheDocument();
        expect(screen.queryByRole('button', {name: 'page.makeShift.overview.continueShift'})).not.toBeInTheDocument();
    });

    it('shows the continue action when the server already has assigned shifts', () => {
        makeShiftState = {
            ...makeShiftState,
            phase: 'overview',
            shiftStatus: 'success',
            shiftExists: true,
            shiftFullyAssigned: false,
        };

        render(<MakeShiftPageView />);

        expect(screen.getByRole('button', {name: 'page.makeShift.overview.continueShift'})).toBeInTheDocument();
        expect(screen.queryByRole('button', {name: /page\.makeShift\.overview\.createShift/})).not.toBeInTheDocument();
    });

    it('shows the continue action when local progress exists even if the server has no assigned shifts', () => {
        makeShiftState = {
            ...makeShiftState,
            phase: 'overview',
            shiftStatus: 'success',
            shiftExists: false,
            shiftFullyAssigned: false,
        };
        mockLoadDraftStep.mockReturnValue(2);

        render(<MakeShiftPageView />);

        expect(screen.getByRole('button', {name: 'page.makeShift.overview.continueShift'})).toBeInTheDocument();
    });
});
