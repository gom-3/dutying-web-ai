import {describe, expect, it, vi} from 'vitest';
import {render, screen, userEvent} from '@/shared/util/test-utils';
import {AiAutofillToolbar} from '../ai-autofill-toolbar';

vi.mock('@/shared/hook/use-typed-translation', () => ({
    useTypedTranslation: () => ({
        t: (key: string) =>
            ({
                'page.makeShift.aiRefill.action': 'Refill',
                'page.makeShift.aiRefill.confirm': 'Confirm',
                'page.makeShift.aiRefill.firstFill': 'Autofill',
                'page.makeShift.aiRefill.generating': 'Filling',
                'page.makeShift.aiRefill.retry': 'Retry',
                'page.makeShift.aiRefill.undo': 'Undo',
                'page.makeShift.aiRefill.redo': 'Redo',
                'page.makeShift.aiRefill.saveSnapshot': 'Save draft',
                'page.makeShift.aiRefill.savingSnapshot': 'Saving draft',
                'page.makeShift.aiRefill.fixedDisplay': 'Fixed shifts',
                'page.makeShift.aiRefill.fixedDisplayHidden': 'Fixed shifts hidden',
                'page.makeShift.aiRefill.fixedDisplayShown': 'Fixed shifts shown',
                'page.makeShift.aiRefill.fixedDisplayHighlight': 'Highlight fixed shifts',
                'page.makeShift.aiRefill.fixedSelectionTools': 'Fixed selection tools',
                'page.makeShift.aiRefill.fixSelection': 'Fix selected shifts',
                'page.makeShift.aiRefill.unfixSelection': 'Unfix selected shifts',
                'page.makeShift.aiRefill.clearUnlockedCells': 'Clear all except fixed shifts',
                'page.makeShift.aiRefill.requestDisplay': 'Requested shifts',
                'page.makeShift.aiRefill.requestDisplayHidden': 'Requested shifts hidden',
                'page.makeShift.aiRefill.requestDisplayShown': 'Requested shifts shown',
                'page.makeShift.aiRefill.requestDisplayHighlight': 'Highlight requested shifts',
                'page.makeShift.aiRefill.showViolations': 'Show violations',
                'page.makeShift.aiRefill.snapshotSidebar.title': 'History',
                'page.makeShift.aiRefill.statusHighlightTools': 'Request and fixed shift indicators',
                'page.makeShift.aiRefill.toolbarSubTitle': 'Use AI Autofill',
                'page.makeShift.aiRefill.toolbarTitle': 'Fill and confirm',
                'page.makeShift.aiRefill.validationStatus.checking': 'Checking',
                'page.makeShift.aiRefill.viewOptions': 'Display options',
                'page.makeShift.aiRefill.viewBaseline': 'Show requests and fixed shifts only',
                'page.makeShift.aiRefill.viewBaselineCompact': 'Requests/fixed',
                'page.makeShift.aiRefill.viewComplete': 'Show all assignments',
                'page.makeShift.aiRefill.viewCompleteCompact': 'All',
                'page.makeShift.aiRefill.violationsHidden': 'Constraint violations hidden',
                'page.makeShift.aiRefill.violationsShown': 'Constraint violations shown',
                'page.makeShift.navigation.saving': 'Saving',
            })[key] ?? key,
    }),
}));

function renderToolbar({
    showFaults = true,
    onFixedShiftsAttentionStart = vi.fn(),
    onFixedShiftsAttentionEnd = vi.fn(),
    onRequestShiftsAttentionStart = vi.fn(),
    onRequestShiftsAttentionEnd = vi.fn(),
    onToggleFaults = vi.fn(),
    onRequestClearUnlockedCells = vi.fn(),
    canClearUnlockedCells = true,
}: {
    showFaults?: boolean;
    onFixedShiftsAttentionStart?: () => void;
    onFixedShiftsAttentionEnd?: () => void;
    onRequestShiftsAttentionStart?: () => void;
    onRequestShiftsAttentionEnd?: () => void;
    onToggleFaults?: () => void;
    onRequestClearUnlockedCells?: () => void;
    canClearUnlockedCells?: boolean;
} = {}) {
    render(
        <AiAutofillToolbar
            onFixedShiftsAttentionStart={onFixedShiftsAttentionStart}
            onFixedShiftsAttentionEnd={onFixedShiftsAttentionEnd}
            onRequestShiftsAttentionStart={onRequestShiftsAttentionStart}
            onRequestShiftsAttentionEnd={onRequestShiftsAttentionEnd}
            canFixSelection
            canUnfixSelection
            onFixSelection={vi.fn()}
            onUnfixSelection={vi.fn()}
            canClearUnlockedCells={canClearUnlockedCells}
            onRequestClearUnlockedCells={onRequestClearUnlockedCells}
            showFaults={showFaults}
            onToggleFaults={onToggleFaults}
            canUndo={false}
            canRedo={false}
            onUndo={vi.fn()}
            onRedo={vi.fn()}
            onOpenSnapshotHistory={vi.fn()}
            onAiFill={vi.fn()}
            isAiGenerating={false}
            aiStatus="idle"
            hasCompletedAiFill={false}
            scheduleValidationStatus="idle"
            onConfirm={vi.fn()}
            isConfirming={false}
            canConfirm
            onSaveSnapshot={vi.fn()}
            isSavingSnapshot={false}
        />,
    );
}

describe('AiAutofillToolbar', () => {
    it('renders compact support tools', () => {
        renderToolbar();

        const statusDisplayButton = screen.getByRole('button', {name: 'Request and fixed shift indicators'});

        expect(statusDisplayButton).toHaveTextContent('');
        expect(statusDisplayButton).toHaveAttribute('aria-expanded', 'false');
        expect(screen.queryByRole('button', {name: 'Highlight fixed shifts'})).not.toBeInTheDocument();
        expect(screen.queryByRole('button', {name: 'Highlight requested shifts'})).not.toBeInTheDocument();
        expect(screen.getByRole('button', {name: 'Fix selected shifts'})).toBeEnabled();
        expect(screen.getByRole('button', {name: 'Unfix selected shifts'})).toBeEnabled();
        expect(screen.getByRole('button', {name: 'Clear all except fixed shifts'})).toBeEnabled();
        expect(screen.getByRole('tooltip', {name: 'Fix selected shifts'})).toBeInTheDocument();
        expect(screen.getByRole('tooltip', {name: 'Unfix selected shifts'})).toBeInTheDocument();
        expect(screen.getByRole('tooltip', {name: 'Clear all except fixed shifts'})).toBeInTheDocument();
        expect(screen.getByRole('tooltip', {name: 'Constraint violations shown'})).toBeInTheDocument();
        expect(screen.getByRole('tooltip', {name: 'Undo'})).toBeInTheDocument();
        expect(screen.getByRole('tooltip', {name: 'Redo'})).toBeInTheDocument();
        expect(screen.getByRole('tooltip', {name: 'Save draft'})).toBeInTheDocument();
        expect(screen.getByRole('tooltip', {name: 'History'})).toBeInTheDocument();
        expect(screen.getByRole('button', {name: 'Fix selected shifts'}).closest('.ai-autofill-toolbar__fixed-actions')).toBe(
            screen.getByRole('button', {name: 'Unfix selected shifts'}).closest('.ai-autofill-toolbar__fixed-actions'),
        );
        expect(
            screen.getByRole('button', {name: 'Clear all except fixed shifts'}).closest('.ai-autofill-toolbar__fixed-actions'),
        ).toBeNull();
        expect(
            screen.getByRole('button', {name: 'Clear all except fixed shifts'}).closest('.ai-autofill-toolbar__clear-actions'),
        ).toBeInTheDocument();
        expect(
            screen
                .getAllByRole('button')
                .map((button) => button.textContent)
                .filter(Boolean),
        ).toEqual(['Autofill', 'Confirm']);
        expect(screen.getByRole('button', {name: 'Constraint violations shown'})).toHaveTextContent('');
    });

    it('requests confirmation before clearing non-fixed shifts', async () => {
        const user = userEvent.setup();
        const onRequestClearUnlockedCells = vi.fn();

        renderToolbar({onRequestClearUnlockedCells});

        await user.click(screen.getByRole('button', {name: 'Clear all except fixed shifts'}));

        expect(onRequestClearUnlockedCells).toHaveBeenCalledTimes(1);
    });

    it('disables the clear-all tool when no unlocked cells can be cleared', () => {
        renderToolbar({canClearUnlockedCells: false});

        expect(screen.getByRole('button', {name: 'Clear all except fixed shifts'})).toBeDisabled();
    });

    it('shows fixed and requested indicators inside the status display menu', async () => {
        const user = userEvent.setup();

        renderToolbar();

        const statusDisplayButton = screen.getByRole('button', {name: 'Request and fixed shift indicators'});

        await user.click(statusDisplayButton);

        expect(statusDisplayButton).toHaveAttribute('aria-expanded', 'true');
        expect(screen.getByRole('menu', {name: 'Request and fixed shift indicators'})).toBeInTheDocument();
        expect(screen.getByRole('button', {name: 'Highlight fixed shifts'})).toHaveTextContent('');
        expect(screen.getByRole('button', {name: 'Highlight requested shifts'})).toHaveTextContent('');
        expect(screen.getByText('Fixed shifts')).toBeInTheDocument();
        expect(screen.getByText('Requested shifts')).toBeInTheDocument();
        expect(screen.getByRole('button', {name: 'Highlight requested shifts'}).querySelector('img')).toHaveAttribute(
            'src',
            '/img/make-request-display.png',
        );
    });

    it('keeps fixed shift positions highlighted while hovered', async () => {
        const user = userEvent.setup();
        const onFixedShiftsAttentionStart = vi.fn();
        const onFixedShiftsAttentionEnd = vi.fn();

        renderToolbar({onFixedShiftsAttentionStart, onFixedShiftsAttentionEnd});

        await user.click(screen.getByRole('button', {name: 'Request and fixed shift indicators'}));

        const fixedButton = screen.getByRole('button', {name: 'Highlight fixed shifts'});

        expect(fixedButton).toHaveAttribute('aria-pressed', 'true');

        await user.hover(fixedButton);

        expect(onFixedShiftsAttentionStart).toHaveBeenCalledTimes(1);
        expect(onFixedShiftsAttentionEnd).not.toHaveBeenCalled();

        await user.unhover(fixedButton);

        expect(onFixedShiftsAttentionEnd).toHaveBeenCalledTimes(1);
    });

    it('keeps requested shift positions highlighted while hovered', async () => {
        const user = userEvent.setup();
        const onRequestShiftsAttentionStart = vi.fn();
        const onRequestShiftsAttentionEnd = vi.fn();

        renderToolbar({onRequestShiftsAttentionStart, onRequestShiftsAttentionEnd});

        await user.click(screen.getByRole('button', {name: 'Request and fixed shift indicators'}));

        const requestButton = screen.getByRole('button', {name: 'Highlight requested shifts'});

        expect(requestButton).toHaveAttribute('aria-pressed', 'true');

        await user.hover(requestButton);

        expect(onRequestShiftsAttentionStart).toHaveBeenCalledTimes(1);
        expect(onRequestShiftsAttentionEnd).not.toHaveBeenCalled();

        await user.unhover(requestButton);

        expect(onRequestShiftsAttentionEnd).toHaveBeenCalledTimes(1);
    });

    it('toggles constraint violation visibility', async () => {
        const user = userEvent.setup();
        const onToggleFaults = vi.fn();

        renderToolbar({showFaults: false, onToggleFaults});

        const violationsButton = screen.getByRole('button', {name: 'Constraint violations hidden'});

        expect(violationsButton).toHaveAttribute('aria-pressed', 'false');
        expect(violationsButton).toHaveTextContent('');
        expect(violationsButton).toHaveClass('text-gray-3');
        expect(violationsButton).not.toHaveClass('hover:bg-white');
        expect(screen.getByRole('tooltip', {name: 'Constraint violations hidden'})).toBeInTheDocument();

        await user.click(violationsButton);

        expect(onToggleFaults).toHaveBeenCalledTimes(1);
    });
});
