import {describe, expect, it} from 'vitest';
import {queueConversationCapture, readConversationImage, saveConversationImage} from '../conversation-image-cache';

describe('conversation image cache', () => {
    it('evicts older images and retains recently viewed results', () => {
        for (let i = 0; i < 8; i++) saveConversationImage(`a${i}`, new Blob(['image']));
        readConversationImage('a0');
        saveConversationImage('a8', new Blob(['next']));
        expect(readConversationImage('a0')).toBeDefined();
        expect(readConversationImage('a1')).toBeUndefined();
    });
    it('does not retain oversized images', () => {
        saveConversationImage('large', new Blob([new Uint8Array(17 * 1024 * 1024)]));
        expect(readConversationImage('large')).toBeUndefined();
    });
    it('serializes captures and continues after a failed capture', async () => {
        const order: number[] = [];
        const a = queueConversationCapture(async () => {
            order.push(1);
            await Promise.resolve();
            order.push(2);
            throw new Error('failed');
        });
        const b = queueConversationCapture(async () => {
            order.push(3);
            return 'ok';
        });
        await expect(a).rejects.toThrow('failed');
        await expect(b).resolves.toBe('ok');
        expect(order).toEqual([1, 2, 3]);
    });
});
