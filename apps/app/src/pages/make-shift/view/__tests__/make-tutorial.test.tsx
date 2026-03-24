import {render, screen} from '@testing-library/react';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import {type ITutorialConfig} from '@/widgets/tutorial/tutorial.types';
import MakeTutorial from '../make-tutorial';

const setMakeTutorialMock = vi.fn();
const nextMock = vi.fn();
const prevMock = vi.fn();
const tutorialPortalMock = vi.fn();

let tutorialStoreState = {
    showMakeTutorial: true,
};
let makeShiftStoreState = {
    phase: 'stepping' as 'overview' | 'stepping',
};

vi.mock('@/features/ui/useTutorial/store', () => ({
    useTutorialStore: (selector: (state: typeof tutorialStoreState) => unknown) => selector(tutorialStoreState),
}));

vi.mock('@/features/ui/useTutorial', () => ({
    default: () => ({
        setMakeTutorial: setMakeTutorialMock,
    }),
}));

vi.mock('../../model/make-shift-store', () => ({
    useMakeShiftStore: (selector: (state: typeof makeShiftStoreState) => unknown) => selector(makeShiftStoreState),
}));

vi.mock('../../model/make-shift-use-case', () => ({
    useMakeShiftUseCase: () => ({
        next: nextMock,
        prev: prevMock,
    }),
}));

vi.mock('@/widgets/tutorial/TutorialPortal', () => ({
    TutorialPortal: ({open, config, closeCallback}: {open: boolean; config: ITutorialConfig; closeCallback: () => void}) => {
        tutorialPortalMock({open, config, closeCallback});

        return <div data-testid="tutorial-portal" data-open={String(open)} data-step-count={String(config.steps.length)} />;
    },
}));

describe('make-tutorial', () => {
    beforeEach(() => {
        tutorialStoreState = {showMakeTutorial: true};
        makeShiftStoreState = {phase: 'stepping'};
        setMakeTutorialMock.mockReset();
        nextMock.mockReset();
        prevMock.mockReset();
        tutorialPortalMock.mockReset();
    });

    it('opens tutorial only during make stepping phase', () => {
        makeShiftStoreState = {phase: 'overview'};

        render(<MakeTutorial />);

        expect(screen.getByTestId('tutorial-portal')).toHaveAttribute('data-open', 'false');
    });

    it('builds stepping tutorial config for current make flow', () => {
        render(<MakeTutorial />);

        const portal = screen.getByTestId('tutorial-portal');
        const lastCall = tutorialPortalMock.mock.lastCall?.[0] as {config: ITutorialConfig; open: boolean};

        expect(portal).toHaveAttribute('data-open', 'true');
        expect(portal).toHaveAttribute('data-step-count', '6');
        expect(lastCall.open).toBe(true);
        expect(lastCall.config.steps[0]?.highlightIds).toEqual(['make_stepper']);
        expect(lastCall.config.steps[4]?.highlightIds).toEqual(['make_fixed_shifts_step', 'count_by_day']);
        expect(lastCall.config.steps[5]?.highlightIds).toEqual(['make_ai_autofill_actions', 'make_ai_autofill_status']);
    });
});
