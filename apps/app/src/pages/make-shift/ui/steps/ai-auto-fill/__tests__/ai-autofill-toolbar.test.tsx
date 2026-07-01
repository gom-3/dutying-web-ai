import {render, screen, userEvent} from '@/shared/util/test-utils';
import {describe, expect, it, vi} from 'vitest';
import {AiAutofillToolbar} from '../ai-autofill-toolbar';

vi.mock('@/shared/hook/use-typed-translation', () => ({
    useTypedTranslation: () => ({
        t: (key: string) =>
            (
                {
                    'page.makeShift.aiRefill.action': 'Refill',
                    'page.makeShift.aiRefill.confirm': 'Confirm',
                    'page.makeShift.aiRefill.firstFill': 'Autofill',
                    'page.makeShift.aiRefill.generating': 'Filling',
                    'page.makeShift.aiRefill.retry': 'Retry',
                    'page.makeShift.aiRefill.saveSnapshot': 'Save draft',
                    'page.makeShift.aiRefill.fixedDisplay': 'Show fixed',
                    'page.makeShift.aiRefill.fixedDisplayHidden': 'Fixed shifts hidden',
                    'page.makeShift.aiRefill.fixedDisplayShown': 'Fixed shifts shown',
                    'page.makeShift.aiRefill.showViolations': 'Show violations',
                    'page.makeShift.aiRefill.snapshotSidebar.title': 'History',
                    'page.makeShift.aiRefill.toolbarSubTitle': 'Use AI Autofill',
                    'page.makeShift.aiRefill.toolbarTitle': 'Fill and confirm',
                    'page.makeShift.aiRefill.validationStatus.checking': 'Checking',
                    'page.makeShift.aiRefill.viewOptions': 'Display options',
                    'page.makeShift.aiRefill.violationsHidden': 'Constraint violations hidden',
                    'page.makeShift.aiRefill.violationsShown': 'Constraint violations shown',
                    'page.makeShift.navigation.saving': 'Saving',
                })[key] ?? key,
    }),
}));

function renderToolbar({
    showFixedShifts = true,
    showFaults = true,
    onToggleFixedShifts = vi.fn(),
    onToggleFaults = vi.fn(),
}: {
    showFixedShifts?: boolean;
    showFaults?: boolean;
    onToggleFixedShifts?: () => void;
    onToggleFaults?: () => void;
} = {}) {
    render(
        <AiAutofillToolbar
            showFixedShifts={showFixedShifts}
            onToggleFixedShifts={onToggleFixedShifts}
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
    it('renders the fixed-shift display switch as a labeled pin toggle', () => {
        renderToolbar();

        const fixedButton = screen.getByRole('button', {name: 'Fixed shifts shown'});

        expect(fixedButton).toHaveAttribute('aria-pressed', 'true');
        expect(fixedButton).toHaveTextContent('Show fixed');
        expect(screen.getByRole('button', {name: 'Constraint violations shown'})).toHaveTextContent('Show violations');
    });

    it('toggles fixed shift visibility', async () => {
        const user = userEvent.setup();
        const onToggleFixedShifts = vi.fn();

        renderToolbar({showFixedShifts: false, onToggleFixedShifts});

        const fixedButton = screen.getByRole('button', {name: 'Fixed shifts hidden'});

        expect(fixedButton).toHaveAttribute('aria-pressed', 'false');

        await user.click(fixedButton);

        expect(onToggleFixedShifts).toHaveBeenCalledTimes(1);
    });

    it('toggles constraint violation visibility', async () => {
        const user = userEvent.setup();
        const onToggleFaults = vi.fn();

        renderToolbar({showFaults: false, onToggleFaults});

        const violationsButton = screen.getByRole('button', {name: 'Constraint violations hidden'});

        expect(violationsButton).toHaveAttribute('aria-pressed', 'false');
        expect(violationsButton).toHaveTextContent('Show violations');

        await user.click(violationsButton);

        expect(onToggleFaults).toHaveBeenCalledTimes(1);
    });
});
