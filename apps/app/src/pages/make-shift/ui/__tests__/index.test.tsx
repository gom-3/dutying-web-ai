import type * as ReactQuery from '@tanstack/react-query';
import {MemoryRouter, Route, Routes, useLocation} from 'react-router';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import useEditNurseStore from '@/features/edit-shift-team/model/store';
import ROUTE from '@/shared/constant/path';
import {render, screen, userEvent} from '@/shared/util/test-utils';
import {useAiAutofillExitGuardStore} from '../../model/ai-autofill-exit-guard';
import {MakeShiftPageView} from '../index';

const queryMockState = vi.hoisted(() => ({
    pendingMutations: 0,
}));

type TMockMakeShiftState = {
    phase: 'overview' | 'stepping';
    currentStep: 1 | 2 | 3 | 4 | 5;
    maxReachedStep: 1 | 2 | 3 | 4 | 5;
    year: number;
    month: number;
    shiftStatus: 'idle' | 'pending' | 'success' | 'error';
    shiftExists: boolean;
    shiftFullyAssigned: boolean;
    shiftTeams: Array<{shiftTeamId: number; name: string}>;
    shiftTeamsStatus: 'idle' | 'pending' | 'success' | 'error';
    currentShiftTeamId: number | null;
    wardId: number | null;
    stepNavigationBusy: Partial<Record<1 | 2 | 3 | 4 | 5, boolean>>;
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
    const actual = (await importOriginal()) as typeof ReactQuery;

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
        onClickStep: (step: 1 | 2 | 3 | 4 | 5) => void;
    }) => (
        <button type="button" data-testid="make-shift-stepper" disabled={navigationDisabled} onClick={() => onClickStep(5)}>
            stepper
        </button>
    ),
}));

vi.mock('../make-shift-step-content', () => ({
    MakeShiftStepContent: () => <div data-testid="make-shift-step-content" />,
}));

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
        mockUseCase.start.mockClear();
        mockUseCase.retryOverview.mockClear();
        mockUseCase.goToStep.mockClear();
        mockUseCase.prev.mockClear();
        mockUseCase.next.mockClear();
        queryMockState.pendingMutations = 0;
        useEditNurseStore.getState().reset();
        useAiAutofillExitGuardStore.getState().resetExitGuard();
        vi.restoreAllMocks();

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

        expect(pageRoot).toHaveClass('overflow-visible');
        expect(pageRoot).not.toHaveClass('overflow-x-auto');
        expect(pageRoot).not.toHaveClass('transition-[padding-right]');
        expect(pageRoot).not.toHaveStyle({paddingRight: 'var(--make-ai-snapshot-sidebar-offset, 0px)'});
        expect(pageFrame).toHaveClass('min-w-0');
        expect(pageFrame).toHaveClass(
            'transition-[padding-right]',
            'pr-[calc(var(--make-ai-snapshot-sidebar-offset,0px)+0.75rem)]',
            'lg:pr-[calc(var(--make-ai-snapshot-sidebar-offset,0px)+1rem)]',
            'min-[1600px]:pr-[calc(var(--make-ai-snapshot-sidebar-offset,0px)+2.5rem)]',
        );
        expect(pageFrame).not.toHaveClass('min-w-[1510px]');
        expect(contentCard).toHaveClass('overflow-visible');
        expect(contentCard).not.toHaveClass('transition-[padding-right]');
        expect(contentCard).not.toHaveStyle({paddingRight: 'var(--make-ai-snapshot-sidebar-offset, 0px)'});
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

    it('blocks leaving step 5 through the stepper when editable changes are unsaved', async () => {
        const user = userEvent.setup();
        const confirmSpy = vi.spyOn(window, 'confirm');

        useAiAutofillExitGuardStore.getState().setExitGuard({hasUnsavedChanges: true, isAiGenerating: false});
        makeShiftState = {
            ...makeShiftState,
            currentStep: 5,
            maxReachedStep: 5,
        };

        renderMakeShiftPageView();

        await user.click(screen.getByTestId('make-shift-stepper'));

        expect(confirmSpy).not.toHaveBeenCalled();
        expect(screen.getByRole('dialog')).toHaveTextContent('page.makeShift.aiRefill.exitGuard.unsavedTitle');
        expect(screen.getByRole('dialog')).toHaveTextContent('page.makeShift.aiRefill.exitGuard.unsavedDescription');
        expect(mockUseCase.goToStep).not.toHaveBeenCalled();
    });

    it('allows leaving step 5 when the user confirms the AI running warning dialog', async () => {
        const user = userEvent.setup();
        const confirmSpy = vi.spyOn(window, 'confirm');

        useAiAutofillExitGuardStore.getState().setExitGuard({hasUnsavedChanges: false, isAiGenerating: true});
        makeShiftState = {
            ...makeShiftState,
            currentStep: 5,
            maxReachedStep: 5,
        };

        renderMakeShiftPageView();

        await user.click(screen.getByTestId('make-shift-stepper'));
        await user.click(screen.getByRole('button', {name: 'page.makeShift.aiRefill.exitGuard.leaveConfirm'}));

        expect(confirmSpy).not.toHaveBeenCalled();
        expect(mockUseCase.goToStep).toHaveBeenCalledWith(5);
    });
});
