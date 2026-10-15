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
        const restart = screen.getByRole('button', {name: 'aiAdjust.chat.restart'});
        expect(restart.closest('header')).not.toBeNull();
        expect(restart.nextElementSibling).toBe(screen.getByRole('button', {name: 'aiAdjust.close'}));
        expect(onGenerate).not.toHaveBeenCalled();
        expect(onRegenerate).not.toHaveBeenCalled();

        expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
        expect(document.querySelector('.ai-adjust-chat-scroll')).toHaveAttribute('data-composer-hidden', 'true');
        const generate = screen.getByRole('button', {name: 'aiAdjust.chat.regenerate'});
        await user.click(generate);
        expect(hasGeneratedSchedule ? onRegenerate : onGenerate).toHaveBeenCalledOnce();
        expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
        expect(screen.queryByRole('button', {name: 'aiAdjust.chat.modify'})).not.toBeInTheDocument();
        await user.click(screen.getByRole('button', {name: 'aiAdjust.chat.restart'}));
        expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
        await user.click(screen.getByRole('button', {name: 'aiAdjust.chat.modify'}));
        expect(screen.getByRole('textbox')).toHaveFocus();
        expect(document.querySelector('.ai-adjust-chat-scroll')).toHaveAttribute('data-composer-hidden', 'false');
        expect(screen.getByText('aiAdjust.chat.askChanges')).toBeInTheDocument();
        await user.type(screen.getByRole('textbox'), '오프 수를 11로 맞춰줘');
        await user.click(screen.getByRole('button', {name: 'aiAdjust.send'}));
        expect(interpret).toHaveBeenCalledOnce();
        expect(screen.queryByRole('button', {name: 'aiAdjust.chat.regenerate'})).not.toBeInTheDocument();
        expect(screen.getByRole('status', {name: 'aiAdjust.reviewing'}).textContent).toBe('');
        expect(screen.getByRole('status').querySelectorAll('.ai-adjust-review-dot')).toHaveLength(3);
        expect(screen.queryByText('aiAdjust.reviewing')).not.toBeInTheDocument();
        expect(screen.queryByText(/aiAdjust.elapsed/)).not.toBeInTheDocument();
        expect(screen.getByRole('button', {name: 'aiAdjust.chat.restart'})).toBeEnabled();
        expect(screen.getAllByRole('button', {name: 'aiAdjust.chat.restart'})).toHaveLength(1);
        await user.click(restart);
        expect(screen.queryByRole('status', {name: 'aiAdjust.reviewing'})).not.toBeInTheDocument();
        expect(screen.getByRole('button', {name: 'aiAdjust.chat.modify'})).toBeEnabled();
    });
});
