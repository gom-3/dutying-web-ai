import {render, screen} from '@testing-library/react';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import {type ITutorialConfig} from '@/widgets/tutorial/tutorial.types';
import {BoardTutorial} from '../board-tutorial';

const setBoardTutorialMock = vi.fn();
const setBoardListTutorialMock = vi.fn();
const setBoardComposerTutorialMock = vi.fn();
const setBoardDetailTutorialMock = vi.fn();
const tutorialPortalMock = vi.fn();

let tutorialStoreState = {
    showBoardListTutorial: true,
    showBoardComposerTutorial: true,
    showBoardDetailTutorial: true,
};

vi.mock('@/features/tutorial/model/store', () => ({
    useTutorialStore: (selector: (state: typeof tutorialStoreState) => unknown) => selector(tutorialStoreState),
}));

vi.mock('@/features/tutorial', () => ({
    default: () => ({
        setBoardTutorial: setBoardTutorialMock,
        setBoardListTutorial: setBoardListTutorialMock,
        setBoardComposerTutorial: setBoardComposerTutorialMock,
        setBoardDetailTutorial: setBoardDetailTutorialMock,
    }),
}));

vi.mock('@/features/tutorial/model/use-tutorial-dismiss-persistence', () => ({
    useTutorialDismissPersistence: () => vi.fn(),
}));

vi.mock('@/widgets/tutorial/TutorialPortal', () => ({
    TutorialPortal: ({open, config, closeCallback}: {open: boolean; config: ITutorialConfig; closeCallback: () => void}) => {
        tutorialPortalMock({open, config, closeCallback});

        return <div data-testid="tutorial-portal" data-open={String(open)} data-step-count={String(config.steps.length)} />;
    },
}));

function renderBoardTutorial(options?: {canStart?: boolean; mode?: 'list' | 'composer' | 'detail'}) {
    return render(<BoardTutorial accountId={1} canStart={options?.canStart ?? true} mode={options?.mode ?? 'list'} />);
}

describe('BoardTutorial', () => {
    beforeEach(() => {
        tutorialStoreState = {
            showBoardListTutorial: true,
            showBoardComposerTutorial: true,
            showBoardDetailTutorial: true,
        };
        setBoardTutorialMock.mockReset();
        setBoardListTutorialMock.mockReset();
        setBoardComposerTutorialMock.mockReset();
        setBoardDetailTutorialMock.mockReset();
        tutorialPortalMock.mockReset();
    });

    it('opens only when the board screen is ready', () => {
        renderBoardTutorial({canStart: false});

        expect(screen.getByTestId('tutorial-portal')).toHaveAttribute('data-open', 'false');
    });

    it('shows only visible list-screen guidance on the board list', () => {
        renderBoardTutorial({mode: 'list'});

        const lastCall = tutorialPortalMock.mock.lastCall?.[0] as {config: ITutorialConfig; open: boolean};
        const highlightIds = lastCall.config.steps.flatMap((step) => step.highlightIds);

        expect(screen.getByTestId('tutorial-portal')).toHaveAttribute('data-step-count', '2');
        expect(highlightIds).toContain('board_post_list');
        expect(highlightIds).toContain('board_create_button');
        expect(highlightIds).not.toContain('board_composer_panel');
        expect(highlightIds).not.toContain('board_search_button');
        expect(highlightIds).not.toContain('board_deadline_calendar');
        expect(highlightIds).not.toContain('board_detail_panel');
    });

    it('shows composer guidance only after the composer is visible', () => {
        renderBoardTutorial({mode: 'composer'});

        const lastCall = tutorialPortalMock.mock.lastCall?.[0] as {config: ITutorialConfig; open: boolean};
        const highlightIds = lastCall.config.steps.flatMap((step) => step.highlightIds);

        expect(screen.getByTestId('tutorial-portal')).toHaveAttribute('data-step-count', '1');
        expect(highlightIds).toEqual(['board_composer_deadline_picker']);
    });

    it('shows detail guidance only after a post is visible', () => {
        renderBoardTutorial({mode: 'detail'});

        const lastCall = tutorialPortalMock.mock.lastCall?.[0] as {config: ITutorialConfig; open: boolean};
        const highlightIds = lastCall.config.steps.flatMap((step) => step.highlightIds);

        expect(screen.getByTestId('tutorial-portal')).toHaveAttribute('data-step-count', '1');
        expect(highlightIds).toEqual(['board_detail_panel']);
    });
});
