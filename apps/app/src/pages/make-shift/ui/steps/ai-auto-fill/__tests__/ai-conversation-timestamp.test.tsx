import {afterEach, describe, expect, it, vi} from 'vitest';
import {act, render, screen} from '@/shared/util/test-utils';
import {AssistantMessage, UserMessage} from '../ai-adjust-review-conversation';
import {AiConversationEntry} from '../ai-conversation-entry';
import {AiConversationTimestamp, conversationMessageDate} from '../ai-conversation-timestamp';

describe('conversation message timestamps', () => {
    afterEach(() => vi.useRealTimers());

    it('shows today as M/D HH:mm using plain text without time controls', () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date(2026, 11, 10, 12, 0));

        const createdAt = new Date(2026, 11, 10, 10, 0).toISOString();
        const {container} = render(
            <AiConversationTimestamp createdAt={createdAt}>
                <AssistantMessage>완성된 근무표</AssistantMessage>
            </AiConversationTimestamp>,
        );

        expect(container.querySelector('time')).toHaveTextContent(/^12\/10 10:00$/);
        expect(container.querySelector('time')?.dateTime).toBe(createdAt);
        expect(screen.queryByRole('button')).not.toBeInTheDocument();
        expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    });

    it('keeps each timestamp inside its actual bubble instead of the conversation row', () => {
        const createdAt = new Date(2026, 11, 10, 10, 0).toISOString();
        const {container} = render(
            <AiConversationTimestamp createdAt={createdAt}>
                <AssistantMessage>짧은 AI 답변</AssistantMessage>
                <UserMessage>내 메시지</UserMessage>
            </AiConversationTimestamp>,
        );
        const bubbles = container.querySelectorAll('[data-conversation-bubble]');

        expect(bubbles).toHaveLength(2);
        expect(bubbles[0].querySelector('time')?.dateTime).toBe(createdAt);
        expect(bubbles[1].querySelector('time')?.dateTime).toBe(createdAt);
        expect(container.querySelectorAll('time')).toHaveLength(2);
    });

    it('does not assign the parent message time to nested quoted replies', () => {
        const createdAt = new Date(2026, 11, 10, 10, 0).toISOString();
        const {container} = render(
            <AiConversationTimestamp createdAt={createdAt}>
                <AssistantMessage>
                    AI 답변<UserMessage>인용된 답변</UserMessage>
                </AssistantMessage>
            </AiConversationTimestamp>,
        );
        const nestedReply = container.querySelector('[data-conversation-bubble="user"]');

        expect(nestedReply?.querySelector('time')).toBeNull();
        expect(container.querySelectorAll('time')).toHaveLength(1);
    });

    it.each([
        {created: new Date(2026, 11, 9, 21, 0), expected: '12/9'},
        {created: new Date(2025, 11, 10, 10, 0), expected: '12/10'},
    ])('shows only the month/day for a past message: $expected', ({created, expected}) => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date(2026, 11, 10, 12, 0));

        const {container} = render(<AiConversationTimestamp createdAt={created.toISOString()} />);

        expect(container.querySelector('time')?.textContent).toBe(expected);
    });

    it('drops the time after a day changes while preserving the recorded instant', () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date(2026, 11, 31, 23, 59));

        const createdAt = new Date(2026, 11, 31, 23, 58).toISOString();
        const {container} = render(<AiConversationTimestamp createdAt={createdAt} />);

        expect(container.querySelector('time')?.textContent).toBe('12/31 23:58');
        act(() => vi.advanceTimersByTime(60_000));
        expect(container.querySelector('time')?.textContent).toBe('12/31');
        expect(container.querySelector('time')?.dateTime).toBe(createdAt);
    });

    it('shows the initial greeting time and preserves it while the entry rerenders', () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-10-28T06:30:00+09:00'));

        const onChoose = vi.fn();
        const {container, rerender} = render(<AiConversationEntry choice={null} disabled={false} onChoose={onChoose} />);

        expect(container.querySelector('time')?.dateTime).toBe('2026-10-27T21:30:00.000Z');
        vi.setSystemTime(new Date('2026-10-28T06:35:00+09:00'));
        rerender(<AiConversationEntry choice="modify" disabled={false} onChoose={onChoose} />);
        expect(Array.from(container.querySelectorAll('time')).map((time) => time.dateTime)).toEqual([
            '2026-10-27T21:30:00.000Z',
            '2026-10-27T21:35:00.000Z',
            '2026-10-27T21:35:00.000Z',
        ]);
    });

    it('does not invent a new timestamp for stored message bubbles', () => {
        const {container} = render(<AssistantMessage>Stored history</AssistantMessage>);

        expect(container.querySelector('time')).toBeNull();
    });

    it('interprets Spring offset-less timestamps in Seoul, independent of the viewer timezone', () => {
        expect(conversationMessageDate('2026-10-28T06:00:00.123456')?.toISOString()).toBe('2026-10-27T21:00:00.123Z');
        expect(conversationMessageDate('2026-10-28T06:00:00+09:00')?.toISOString()).toBe('2026-10-27T21:00:00.000Z');
        expect(conversationMessageDate('2026-10-27T21:00:00Z')?.toISOString()).toBe('2026-10-27T21:00:00.000Z');
    });

    it('preserves the original instant after rerender and omits missing or invalid times', () => {
        const {container, rerender} = render(<AiConversationTimestamp createdAt="2026-10-28T06:00:00" />);
        const time = container.querySelector('time');

        expect(time?.getAttribute('datetime')).toBe('2026-10-27T21:00:00.000Z');
        expect(time?.textContent).toMatch(/^\d{1,2}\/\d{1,2}(?: \d{2}:\d{2})?$/);

        const label = time?.textContent;

        rerender(<AiConversationTimestamp createdAt="2026-10-28T06:00:00" />);
        expect(container.querySelector('time')?.textContent).toBe(label);
        rerender(<AiConversationTimestamp createdAt="invalid" />);
        expect(container.querySelector('time')).toBeNull();
        expect(conversationMessageDate()).toBeNull();
    });
});
