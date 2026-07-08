import {type TTutorialKey} from '@dutying/api/account';
import {act, render, screen, waitFor} from '@testing-library/react';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import {type ITutorialConfig} from '@/widgets/tutorial/tutorial.types';
import MakeTutorial from '../make-tutorial';

const markTutorialSeenMock = vi.hoisted(() => vi.fn());
const tutorialPortalMock = vi.fn();

let tutorialStoreState = {
    showMakeTutorial: true,
};
let makeShiftStoreState = {
    phase: 'stepping' as 'overview' | 'stepping',
    currentStep: 1 as 1 | 2 | 3 | 4 | 5,
};
let authStoreState: {
    accountId: number | null;
    accountMe: {tutorials?: {seen?: TTutorialKey[]}} | null;
} = {
    accountId: null,
    accountMe: null,
};

vi.mock('@/features/tutorial/model/store', () => ({
    useTutorialStore: (selector: (state: typeof tutorialStoreState) => unknown) => selector(tutorialStoreState),
}));

vi.mock('@/features/auth', () => ({
    default: () => ({
        state: authStoreState,
        actions: {},
    }),
}));

vi.mock('@/shared/api', () => ({
    AccountAPI: {
        markTutorialSeen: markTutorialSeenMock,
    },
}));

vi.mock('../../model/make-shift-store', () => ({
    MAKE_SHIFT_CONFIRMED_STEP: 5,
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
        localStorage.clear();
        tutorialStoreState = {showMakeTutorial: true};
        makeShiftStoreState = {phase: 'stepping', currentStep: 1};
        authStoreState = {accountId: null, accountMe: null};
        markTutorialSeenMock.mockReset();
        markTutorialSeenMock.mockResolvedValue(undefined);
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

    it('marks the current make step tutorial as seen when it actually opens', async () => {
        authStoreState = {accountId: 7, accountMe: {tutorials: {seen: []}}};
        addTutorialTargets(['make_stepper']);

        render(<MakeTutorial />);

        await waitFor(() => expect(screen.getByTestId('tutorial-portal')).toHaveAttribute('data-open', 'true'));

        await waitFor(() => expect(markTutorialSeenMock).toHaveBeenCalledWith('make-step-1'));
        expect(markTutorialSeenMock).not.toHaveBeenCalledWith('make');
    });

    it('opens the current step when only another make step has already been seen', async () => {
        authStoreState = {accountId: 7, accountMe: {tutorials: {seen: ['make-step-3']}}};
        addTutorialTargets(['make_stepper']);

        render(<MakeTutorial />);

        await waitFor(() => expect(screen.getByTestId('tutorial-portal')).toHaveAttribute('data-open', 'true'));

        expect(markTutorialSeenMock).toHaveBeenCalledWith('make-step-1');
    });

    it('does not open when the account has already seen the current make step tutorial', async () => {
        authStoreState = {accountId: 7, accountMe: {tutorials: {seen: ['make-step-1']}}};
        addTutorialTargets(['make_stepper']);

        render(<MakeTutorial />);

        await waitFor(() => expect(screen.getByTestId('tutorial-portal')).toHaveAttribute('data-open', 'false'));

        expect(markTutorialSeenMock).not.toHaveBeenCalled();
    });

    it('uses current-tab tutorial targets instead of a full flow tour', async () => {
        makeShiftStoreState = {phase: 'stepping', currentStep: 4};
        addTutorialTargets([
            'make_fixed_shift_sample_cell',
            'make_ai_fix_selected_button',
            'make_ai_fill_button',
            'make_ai_view_tools',
            'make_ai_history_undo_redo_tools',
            'make_ai_history_snapshot_tools',
        ]);

        render(<MakeTutorial />);

        await waitFor(() => expect(screen.getByTestId('tutorial-portal')).toHaveAttribute('data-open', 'true'));

        const lastCall = getLastTutorialCall();

        expect(screen.getByTestId('tutorial-portal')).toHaveAttribute('data-step-count', '3');
        expect(lastCall.config.steps.map((step) => step.highlightIds)).toEqual([
            ['make_fixed_shift_sample_cell', 'make_ai_fix_selected_button'],
            ['make_ai_fill_button'],
            ['make_ai_view_tools', 'make_ai_history_undo_redo_tools', 'make_ai_history_snapshot_tools'],
        ]);
        expect(lastCall.config.steps.map((step) => step.title)).toEqual([
            '바꾸면 안 되는 근무 고정하기',
            'AI 자동 채우기',
            '보조 도구 활용하기',
        ]);
    });

    it('does not open authoring guidance on the confirmed step', async () => {
        makeShiftStoreState = {phase: 'stepping', currentStep: 5};
        addTutorialTargets([
            'make_fixed_shift_sample_cell',
            'make_ai_fix_selected_button',
            'make_ai_fill_button',
            'make_ai_view_tools',
            'make_ai_history_undo_redo_tools',
            'make_ai_history_snapshot_tools',
        ]);

        render(<MakeTutorial />);

        await waitFor(() => expect(screen.getByTestId('tutorial-portal')).toHaveAttribute('data-open', 'false'));
        expect(markTutorialSeenMock).not.toHaveBeenCalledWith('make-step-5');
    });

    it('keeps later step tutorials available after completing an earlier step', async () => {
        addTutorialTargets(['make_stepper']);

        const {rerender} = render(<MakeTutorial />);

        await waitFor(() => expect(screen.getByTestId('tutorial-portal')).toHaveAttribute('data-open', 'true'));

        await act(async () => {
            getLastTutorialCall().closeCallback();
        });

        await waitFor(() => expect(screen.getByTestId('tutorial-portal')).toHaveAttribute('data-open', 'false'));

        makeShiftStoreState = {phase: 'stepping', currentStep: 2};
        addTutorialTargets(['make_constraint_add_button']);
        rerender(<MakeTutorial />);

        await waitFor(() => expect(screen.getByTestId('tutorial-portal')).toHaveAttribute('data-open', 'true'));
    });
});
