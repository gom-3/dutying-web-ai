import {describe, expect, it, vi} from 'vitest';
import {render, screen, userEvent, waitFor} from '@/shared/util/test-utils';
import {AiInfoTip} from '../ai-conversation-entry';

vi.mock('@/shared/hook/use-typed-translation', () => ({useTypedTranslation: () => ({t: (key: string) => key})}));

describe('AI preparation help', () => {
    it('keeps explanations hidden until requested and opens them with a click', async () => {
        render(<AiInfoTip label="도움말">고정할 근무를 선택해 주세요.</AiInfoTip>);
        expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
        await userEvent.click(screen.getByRole('button', {name: '도움말'}));
        expect(await screen.findByRole('tooltip')).toHaveTextContent('고정할 근무를 선택해 주세요.');
    });
    it('supports keyboard help and dismisses it without closing the conversation', async () => {
        const close = vi.fn();

        render(
            <div
                onKeyDown={(event) => {
                    if (event.key === 'Escape') close();
                }}
            >
                <AiInfoTip label="도움말">고정할 근무를 선택해 주세요.</AiInfoTip>
            </div>,
        );
        await userEvent.tab();
        expect(screen.getByRole('button', {name: '도움말'})).toHaveFocus();
        expect(await screen.findByRole('tooltip')).toHaveTextContent('고정할 근무를 선택해 주세요.');
        await userEvent.keyboard('{Escape}');
        await waitFor(() => expect(screen.queryByRole('tooltip')).not.toBeInTheDocument());
        expect(close).not.toHaveBeenCalled();
    });
});
