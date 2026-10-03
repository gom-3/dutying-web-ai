import {createRef} from 'react';
import {describe, expect, it, vi} from 'vitest';
import {render, screen, userEvent} from '@/shared/util/test-utils';
import AiAdjustDialog from '../ai-adjust-dialog';

vi.mock('@/shared/hook/use-typed-translation', () => ({useTypedTranslation: () => ({t: (key: string) => key})}));

describe('unified AI sidebar entry', () => {
    it.each([false, true])('keeps generation explicit, generated=%s', async (hasGeneratedSchedule) => {
        const user = userEvent.setup();
        const onGenerate = vi.fn();
        const onRegenerate = vi.fn();
        const interpret = vi.fn(() => new Promise<any>(() => {}));
        render(
            <AiAdjustDialog
                open
                onClose={vi.fn()}
                onGenerate={onGenerate}
                onRegenerate={onRegenerate}
                hasGeneratedSchedule={hasGeneratedSchedule}
                disabled={false}
                textInputRef={createRef()}
                onPickExample={vi.fn()}
                interpret={interpret}
                onApply={vi.fn()}
                goalNurses={[]}
                requests={[]}
                disablingRequestId={null}
                onDisableRequest={vi.fn()}
            />,
        );
        expect(onGenerate).not.toHaveBeenCalled();
        expect(onRegenerate).not.toHaveBeenCalled();
        const generate = screen.getByRole('button', {name: hasGeneratedSchedule ? 'aiAdjust.regenerating' : 'aiAdjust.autofill'});
        await user.click(generate);
        expect(hasGeneratedSchedule ? onRegenerate : onGenerate).toHaveBeenCalledOnce();
        await user.type(screen.getByRole('textbox'), '오프 수를 11로 맞춰줘');
        await user.click(screen.getByRole('button', {name: 'aiAdjust.send'}));
        expect(interpret).toHaveBeenCalledOnce();
        expect(generate).toBeDisabled();
        expect(screen.getByRole('status')).toHaveTextContent('aiAdjust.reviewing');
    });
});
