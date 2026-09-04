import {describe, expect, it, vi} from 'vitest';
import {render, screen, userEvent} from '@/shared/util/test-utils';
import AiAdjustChipBar from '../ai-adjust-chip-bar';

vi.mock('@/shared/hook/use-typed-translation', () => ({
    useTypedTranslation: () => ({
        t: (key: string, options?: Record<string, unknown>) => (options ? `${key}:${JSON.stringify(options)}` : key),
    }),
}));

describe('AiAdjustChipBar', () => {
    const baseProps = {
        knobs: {},
        strength: 'NORMAL' as const,
        disabled: false,
        lastChangedCount: null,
        onToggle: vi.fn(),
    };

    it('reports which knob and value a chip stands for', async () => {
        const onToggle = vi.fn();

        render(<AiAdjustChipBar {...baseProps} onToggle={onToggle} />);
        await userEvent.click(screen.getByText('page.makeShift.aiRefill.adjust.clusterOn'));

        expect(onToggle).toHaveBeenCalledWith('CLUSTERING', 1);
    });

    it('marks the active chip so the current direction is visible', () => {
        render(<AiAdjustChipBar {...baseProps} knobs={{CLUSTERING: -1}} />);

        expect(screen.getByText('page.makeShift.aiRefill.adjust.clusterOff')).toHaveAttribute('aria-pressed', 'true');
        // 뭉치기와 흩기는 한 축의 양 끝이라 동시에 켜질 수 없다.
        expect(screen.getByText('page.makeShift.aiRefill.adjust.clusterOn')).toHaveAttribute('aria-pressed', 'false');
    });

    it('shows how many cells moved so the result is not silent', () => {
        render(<AiAdjustChipBar {...baseProps} lastChangedCount={12} />);

        expect(screen.getByText(/adjust\.applied/)).toBeInTheDocument();
    });

    it('says nothing changed instead of leaving the user guessing', () => {
        render(<AiAdjustChipBar {...baseProps} lastChangedCount={0} />);

        expect(screen.getByText('page.makeShift.aiRefill.adjust.noChange')).toBeInTheDocument();
    });

    it('blocks input while a request is in flight', async () => {
        const onToggle = vi.fn();

        render(<AiAdjustChipBar {...baseProps} disabled onToggle={onToggle} />);
        await userEvent.click(screen.getByText('page.makeShift.aiRefill.adjust.offBalance'));

        expect(onToggle).not.toHaveBeenCalled();
    });
});
