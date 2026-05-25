import {act, render, screen, waitFor} from '@testing-library/react';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import {type ITutorialConfig} from '@/widgets/tutorial/tutorial.types';
import MakeTutorial from '../make-tutorial';

const setMakeTutorialMock = vi.fn();
const tutorialPortalMock = vi.fn();

let tutorialStoreState = {
    showMakeTutorial: true,
};
let makeShiftStoreState = {
    phase: 'stepping' as 'overview' | 'stepping',
    currentStep: 1 as 1 | 2 | 3 | 4 | 5 | 6,
};

vi.mock('@/features/tutorial/model/store', () => ({
    useTutorialStore: (selector: (state: typeof tutorialStoreState) => unknown) => selector(tutorialStoreState),
}));

vi.mock('@/features/tutorial', () => ({
    default: () => ({
        setMakeTutorial: setMakeTutorialMock,
    }),
}));

vi.mock('@/features/auth', () => ({
    default: () => ({
        state: {accountId: null as number | null},
        actions: {},
    }),
}));

vi.mock('../../model/make-shift-store', () => ({
    useMakeShiftStore: (selector: (state: typeof makeShiftStoreState) => unknown) => selector(makeShiftStoreState),
}));

vi.mock('@/widgets/tutorial/TutorialPortal', () => ({
    TutorialPortal: ({
        open,
        config,
        closeCallback,
        initialStepIndex,
    }: {
        open: boolean;
        config: ITutorialConfig;
        closeCallback: () => void;
        initialStepIndex?: number;
    }) => {
        tutorialPortalMock({open, config, closeCallback, initialStepIndex});

        return (
            <div
                data-testid="tutorial-portal"
                data-open={String(open)}
                data-step-count={String(config.steps.length)}
                data-initial-step-index={String(initialStepIndex ?? 0)}
            />
        );
    },
}));

function addTutorialTargets(ids: string[]) {
    ids.forEach((id) => {
        const target = document.createElement('div');

        target.id = id;
        document.body.append(target);
    });
}

function getLastTutorialCall() {
    return tutorialPortalMock.mock.lastCall?.[0] as {config: ITutorialConfig; closeCallback: () => void; open: boolean};
}

describe('make-tutorial', () => {
    beforeEach(() => {
        document.body.innerHTML = '';
        tutorialStoreState = {showMakeTutorial: true};
        makeShiftStoreState = {phase: 'stepping', currentStep: 1};
        setMakeTutorialMock.mockReset();
        tutorialPortalMock.mockReset();
    });

    it('opens tutorial only during make stepping phase', async () => {
        makeShiftStoreState = {phase: 'overview', currentStep: 1};
        addTutorialTargets(['make_stepper']);

        render(<MakeTutorial />);

        await waitFor(() => expect(screen.getByTestId('tutorial-portal')).toHaveAttribute('data-open', 'false'));
    });

    it('shows only the stepper guidance on the first tab', async () => {
        addTutorialTargets(['make_stepper']);

        render(<MakeTutorial />);

        await waitFor(() => expect(screen.getByTestId('tutorial-portal')).toHaveAttribute('data-open', 'true'));

        const lastCall = getLastTutorialCall();

        expect(screen.getByTestId('tutorial-portal')).toHaveAttribute('data-step-count', '1');
        expect(screen.getByTestId('tutorial-portal')).toHaveAttribute('data-initial-step-index', '0');
        expect(lastCall.config.steps.map((step) => step.highlightIds)).toEqual([['make_stepper']]);
        expect(lastCall.config.steps[0]?.title).toBe('근무표 만들기');
    });

    it('uses current-tab tutorial targets instead of a full flow tour', async () => {
        makeShiftStoreState = {phase: 'stepping', currentStep: 5};
        addTutorialTargets(['make_ai_fill_button', 'make_ai_view_tools', 'make_ai_history_tools']);

        render(<MakeTutorial />);

        await waitFor(() => expect(screen.getByTestId('tutorial-portal')).toHaveAttribute('data-open', 'true'));

        const lastCall = getLastTutorialCall();

        expect(screen.getByTestId('tutorial-portal')).toHaveAttribute('data-step-count', '2');
        expect(lastCall.config.steps.map((step) => step.highlightIds)).toEqual([
            ['make_ai_fill_button'],
            ['make_ai_view_tools', 'make_ai_history_tools'],
        ]);
        expect(lastCall.config.steps.map((step) => step.title)).toEqual(['AI 자동 채우기', '보조 도구 활용하기']);
    });

    it('shows fixed-shift keyboard input guidance on the fourth tab', async () => {
        makeShiftStoreState = {phase: 'stepping', currentStep: 4};
        addTutorialTargets(['make_fixed_shift_sample_cell']);

        render(<MakeTutorial />);

        await waitFor(() => expect(screen.getByTestId('tutorial-portal')).toHaveAttribute('data-open', 'true'));

        const lastCall = getLastTutorialCall();

        expect(screen.getByTestId('tutorial-portal')).toHaveAttribute('data-step-count', '1');
        expect(lastCall.config.steps.map((step) => step.highlightIds)).toEqual([['make_fixed_shift_sample_cell']]);
        expect(lastCall.config.steps[0]?.title).toBe('고정 근무 입력하기');
    });

    it('keeps later tab tutorials available after completing an earlier tab', async () => {
        addTutorialTargets(['make_stepper']);

        render(<MakeTutorial />);

        await waitFor(() => expect(screen.getByTestId('tutorial-portal')).toHaveAttribute('data-open', 'true'));

        await act(async () => {
            getLastTutorialCall().closeCallback();
        });

        expect(setMakeTutorialMock).not.toHaveBeenCalled();
        await waitFor(() => expect(screen.getByTestId('tutorial-portal')).toHaveAttribute('data-open', 'false'));
    });
});
