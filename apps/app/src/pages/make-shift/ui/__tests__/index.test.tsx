import {MemoryRouter, Route, Routes, useLocation} from 'react-router';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import useEditNurseStore from '@/features/edit-shift-team/model/store';
import ROUTE from '@/shared/constant/path';
import {render, screen, userEvent} from '@/shared/util/test-utils';
import {loadDraftStep} from '../../model/make-shift-progress-storage';
import {MakeShiftPageView} from '../index';

const queryMockState = vi.hoisted(() => ({
    pendingMutations: 0,
}));

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
    stepNavigationBusy: Partial<Record<1 | 2 | 3 | 4 | 5 | 6, boolean>>;
};

const mockUseCase = {
    start: vi.fn(),
    retryOverview: vi.fn(),
    goToStep: vi.fn(),
    prev: vi.fn(),
    next: vi.fn(),
};

let makeShiftState: TMockMakeShiftState;

vi.mock('@tanstack/react-query', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@tanstack/react-query')>();

    return {
        ...actual,
        useIsMutating: () => queryMockState.pendingMutations,
    };
});

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
    MakeShiftStepper: ({
        navigationDisabled,
        onClickStep,
    }: {
        navigationDisabled?: boolean;
        onClickStep: (step: 1 | 2 | 3 | 4 | 5 | 6) => void;
    }) => (
        <button type="button" data-testid="make-shift-stepper" disabled={navigationDisabled} onClick={() => onClickStep(5)}>
            stepper
        </button>
    ),
}));

vi.mock('../make-shift-step-content', () => ({
    MakeShiftStepContent: () => <div data-testid="make-shift-step-content" />,
}));

const mockLoadDraftStep = vi.mocked(loadDraftStep);

function LocationProbe() {
    const location = useLocation();

    return <div data-testid="location-path">{location.pathname}</div>;
}

function renderMakeShiftPageView() {
    return render(
        <MemoryRouter initialEntries={[ROUTE.MAKE]}>
            <Routes>
                <Route
                    path={ROUTE.MAKE}
                    element={
                        <>
                            <MakeShiftPageView />
                            <LocationProbe />
                        </>
                    }
                />
                <Route path={ROUTE.MEMBER} element={<LocationProbe />} />
            </Routes>
        </MemoryRouter>,
    );
}

describe('MakeShiftPageView layout', () => {
    beforeEach(() => {
        mockLoadDraftStep.mockReturnValue(null);
        mockUseCase.start.mockClear();
        mockUseCase.retryOverview.mockClear();
        mockUseCase.goToStep.mockClear();
        mockUseCase.prev.mockClear();
        mockUseCase.next.mockClear();
        queryMockState.pendingMutations = 0;
        useEditNurseStore.getState().reset();

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
            stepNavigationBusy: {},
        };
    });

    it.each([1, 2, 3, 4, 5] as const)('lets stepping step %i grow vertically so the white card can expand', (currentStep) => {
        makeShiftState = {
            ...makeShiftState,
            currentStep,
            maxReachedStep: currentStep,
        };

        const {container} = renderMakeShiftPageView();
        const pageRoot = container.firstElementChild;
        const pageFrame = pageRoot?.firstElementChild;
        const stepContentWrapper = screen.getByTestId('make-shift-step-content').parentElement;
        const contentCard = screen.getByTestId('make-shift-stepper').parentElement;

        expect(pageRoot).toHaveClass('overflow-x-auto');
        expect(pageFrame).toHaveClass('min-w-0');
        expect(pageFrame).not.toHaveClass('min-w-[1510px]');
        expect(contentCard).toHaveClass('overflow-visible');
        expect(contentCard).not.toHaveClass('overflow-hidden');
        expect(contentCard).not.toHaveClass('min-h-0');
        expect(stepContentWrapper).toHaveClass('pb-3');
        expect(stepContentWrapper).not.toHaveClass('min-h-0');
        expect(stepContentWrapper).not.toHaveClass('flex-1');
    });

    it('uses the stepping-width frame outside the stepping flow', () => {
        makeShiftState = {
            ...makeShiftState,
            phase: 'overview',
            shiftStatus: 'pending',
        };

        const {container} = renderMakeShiftPageView();
        const pageRoot = container.firstElementChild;
        const pageFrame = pageRoot?.firstElementChild;
        const contentCard = screen.getByTestId('make-shift-header').nextElementSibling;

        expect(pageRoot).toHaveClass('overflow-x-hidden');
        expect(pageFrame).toHaveClass('max-w-[1680px]');
        expect(pageFrame).toHaveClass('min-w-0');
        expect(pageFrame).not.toHaveClass('min-w-[1510px]');
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

        renderMakeShiftPageView();

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

        renderMakeShiftPageView();

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

        renderMakeShiftPageView();

        expect(screen.getByRole('button', {name: 'page.makeShift.overview.continueShift'})).toBeInTheDocument();
    });

    it('shows a member management shortcut when there are no teams', async () => {
        const user = userEvent.setup();

        makeShiftState = {
            ...makeShiftState,
            phase: 'overview',
            shiftStatus: 'success',
            shiftTeams: [],
            shiftTeamsStatus: 'success',
            currentShiftTeamId: null,
        };

        renderMakeShiftPageView();

        await user.click(screen.getByRole('button', {name: 'page.makeShift.workers.goMemberManagement'}));

        expect(screen.getByTestId('location-path')).toHaveTextContent(ROUTE.MEMBER);
    });

    it('disables progress navigation while constraint rules are saving', async () => {
        const user = userEvent.setup();

        queryMockState.pendingMutations = 1;
        makeShiftState = {
            ...makeShiftState,
            currentStep: 2,
            maxReachedStep: 5,
        };

        renderMakeShiftPageView();

        const stepper = screen.getByTestId('make-shift-stepper');

        expect(stepper).toBeDisabled();
        await user.click(stepper);
        expect(mockUseCase.goToStep).not.toHaveBeenCalled();
    });

    it('disables progress navigation while worker changes are saving', () => {
        useEditNurseStore.getState().beginSavingNurse();
        makeShiftState = {
            ...makeShiftState,
            currentStep: 1,
            maxReachedStep: 5,
        };

        renderMakeShiftPageView();

        expect(screen.getByTestId('make-shift-stepper')).toBeDisabled();
    });

    it('disables progress navigation when the current step reports a busy transition', () => {
        makeShiftState = {
            ...makeShiftState,
            currentStep: 5,
            maxReachedStep: 5,
            stepNavigationBusy: {5: true},
        };

        renderMakeShiftPageView();

        expect(screen.getByTestId('make-shift-stepper')).toBeDisabled();
    });
});
