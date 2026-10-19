import {fireEvent, render, screen, waitFor, within} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {useRef, useState} from 'react';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import i18n from '@/i18n';
import {AiConversationFeedbackButton} from '../ai-conversation-feedback-button';
import {AiConversationFeedbackDialog} from '../ai-conversation-feedback-dialog';

beforeEach(async () => {
    await i18n.changeLanguage('ko');
});

function Fixture({disabled = false, onSubmit = vi.fn(), onClose = vi.fn(), onKeyDown = vi.fn()}) {
    const [open, setOpen] = useState(false);
    const [value, setValue] = useState('');
    const trigger = useRef<HTMLButtonElement | null>(null);

    return (
        <section onKeyDown={onKeyDown}>
            <button type="button">뒤의 대화</button>
            <AiConversationFeedbackButton
                label="이 결과에 의견 보내기"
                onClick={(event) => {
                    trigger.current = event.currentTarget;
                    setOpen(true);
                }}
            />
            <AiConversationFeedbackDialog
                open={open}
                target="자동채우기 1회차 결과"
                value={value}
                disabled={disabled}
                returnFocusTo={trigger.current}
                onChange={setValue}
                onSubmit={onSubmit}
                onClose={() => {
                    onClose();
                    setOpen(false);
                }}
            />
        </section>
    );
}

describe('result feedback dialog', () => {
    it('focuses the labeled input, prevents whitespace submissions and preserves a selected-result target', async () => {
        const user = userEvent.setup();
        const onSubmit = vi.fn();

        render(<Fixture onSubmit={onSubmit} />);
        await user.click(screen.getByRole('button', {name: '이 결과에 의견 보내기'}));

        const dialog = screen.getByRole('dialog', {name: '결과에 의견 보내기'});
        const input = within(dialog).getByRole('textbox', {name: '의견'});
        const send = within(dialog).getByRole('button', {name: '의견 보내기'});

        expect(input).toHaveFocus();
        expect(input).toHaveAttribute('maxlength', '500');
        expect(within(dialog).getByText('자동채우기 1회차 결과')).toBeVisible();
        expect(send).toBeDisabled();
        await user.type(input, '   ');
        expect(send).toBeDisabled();
        fireEvent.submit(send.closest('form')!);
        expect(onSubmit).not.toHaveBeenCalled();
        await user.type(input, '휴무가 요청과 달라요');
        expect(send).toBeEnabled();
        await user.click(send);
        expect(onSubmit).toHaveBeenCalledOnce();
        expect(input).toHaveAccessibleDescription(/입력 글자 수\s*14 \/ 500/);
    });

    it.each(['취소', '의견 작성 닫기'])('closes with %s and returns focus to the originating icon', async (name) => {
        const user = userEvent.setup();

        render(<Fixture />);

        const trigger = screen.getByRole('button', {name: '이 결과에 의견 보내기'});

        await user.click(trigger);
        await user.click(screen.getByRole('button', {name}));
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        await waitFor(() => expect(trigger).toHaveFocus());
    });

    it('keeps keyboard focus inside the modal and prevents Escape from reaching the chat', async () => {
        const user = userEvent.setup();
        const onKeyDown = vi.fn();

        render(<Fixture onKeyDown={onKeyDown} />);
        await user.click(screen.getByRole('button', {name: '이 결과에 의견 보내기'}));

        const dialog = screen.getByRole('dialog');

        onKeyDown.mockClear();
        screen.getByRole('button', {name: '뒤의 대화', hidden: true}).focus();
        expect(dialog.contains(document.activeElement)).toBe(true);
        await user.keyboard('{Escape}');
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        expect(onKeyDown).not.toHaveBeenCalled();
    });

    it('blocks dismissal and submission while sending', async () => {
        const user = userEvent.setup();
        const onClose = vi.fn();
        const onSubmit = vi.fn();

        render(<Fixture disabled onClose={onClose} onSubmit={onSubmit} />);
        await user.click(screen.getByRole('button', {name: '이 결과에 의견 보내기'}));
        expect(screen.getByRole('textbox', {name: '의견'})).toBeDisabled();
        expect(screen.getByRole('button', {name: '의견 보내기'})).toHaveAttribute('aria-busy', 'true');
        expect(screen.getByRole('button', {name: '취소'})).toBeDisabled();
        expect(screen.getByRole('button', {name: '의견 작성 닫기'})).toBeDisabled();
        await user.keyboard('{Escape}');
        fireEvent.pointerDown(screen.getByTestId('ai-feedback-overlay'), {pointerType: 'mouse', button: 0, ctrlKey: false});
        expect(screen.getByRole('dialog')).toBeVisible();
        expect(onClose).not.toHaveBeenCalled();
        expect(onSubmit).not.toHaveBeenCalled();
    });

    it('shows actionable errors beside the retained text and renders English labels', async () => {
        const user = userEvent.setup();
        const onChange = vi.fn();

        await i18n.changeLanguage('en');
        render(
            <AiConversationFeedbackDialog
                open
                target="Adjustment 2 result"
                value="The days off differ."
                error="Your feedback could not be sent. Please try again."
                retryHint="Keep this window open and try again."
                returnFocusTo={null}
                onChange={onChange}
                onSubmit={vi.fn()}
                onClose={vi.fn()}
            />,
        );

        const dialog = screen.getByRole('dialog', {name: 'Feedback on this result'});
        const input = within(dialog).getByRole('textbox', {name: 'Your feedback'});

        expect(input).toHaveValue('The days off differ.');
        expect(input).toHaveAttribute('aria-invalid', 'true');
        expect(within(dialog).getByRole('alert')).toHaveTextContent('Your feedback could not be sent. Please try again.');
        expect(within(dialog).getByText('Keep this window open and try again.')).toBeVisible();
        await user.type(input, '!');
        expect(onChange).toHaveBeenLastCalledWith('The days off differ.!');
    });
});
