import {describe, expect, it} from 'vitest';
import {render} from '@/shared/util/test-utils';
import {AiConversationTimestamp, conversationMessageDate} from '../ai-conversation-timestamp';

describe('conversation message timestamps', () => {
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
