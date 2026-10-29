import {afterEach, describe, expect, it, vi} from 'vitest';
import {render} from '@/shared/util/test-utils';
import {AssistantMessage} from '../ai-adjust-review-conversation';
import {AiConversationEntry} from '../ai-conversation-entry';
import {AiConversationTimestamp, conversationMessageDate} from '../ai-conversation-timestamp';

describe('conversation message timestamps', () => {
    afterEach(() => vi.useRealTimers());

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
        expect(time?.textContent).toMatch(/2026/);

        const label = time?.textContent;

        rerender(<AiConversationTimestamp createdAt="2026-10-28T06:00:00" />);
        expect(container.querySelector('time')?.textContent).toBe(label);
        rerender(<AiConversationTimestamp createdAt="invalid" />);
        expect(container.querySelector('time')).toBeNull();
        expect(conversationMessageDate()).toBeNull();
    });
});
