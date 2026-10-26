import {beforeEach, describe, expect, it, vi} from 'vitest';
import {readScheduleChat, scheduleChatKey, scheduleChatOwner, writeScheduleChat} from '../schedule-chat-cache';

const isMessages = (value: unknown): value is string[] => Array.isArray(value) && value.every((message) => typeof message === 'string');

beforeEach(() => window.localStorage.clear());

describe('schedule chat cache', () => {
    it('separates ward administrator identities from ordinary accounts', () => {
        const syntheticAdminToken = `test.${btoa(JSON.stringify({principalType: 'WARD_ADMIN', wardAdminAccountId: 1}))}.test`;

        expect(scheduleChatOwner(1, null)).toBe('account:1');
        expect(scheduleChatOwner(null, syntheticAdminToken)).toBe('ward-admin:1');
        expect(scheduleChatOwner(null, null)).toBeNull();
    });
    it('keeps the full transcript for a schedule and separates accounts, wards, teams, years and months', () => {
        const key = scheduleChatKey(1, 2, 3, 2026, 7);
        const messages = ['고정할 근무를 확인해 주세요.', '이대로 자동채우기', '자동채우기를 마치지 못했어요.'];

        expect(writeScheduleChat(key, messages)).toBe(true);
        expect(readScheduleChat(key, isMessages)).toEqual(messages);

        for (const other of [
            scheduleChatKey(2, 2, 3, 2026, 7),
            scheduleChatKey(1, 4, 3, 2026, 7),
            scheduleChatKey(1, 2, 4, 2026, 7),
            scheduleChatKey(1, 2, 3, 2027, 7),
            scheduleChatKey(1, 2, 3, 2026, 8),
        ]) {
            expect(readScheduleChat(other, isMessages)).toBeNull();
        }

        expect(scheduleChatKey(null, 2, 3, 2026, 7)).toBeNull();
    });

    it('recovers from malformed or unavailable storage without breaking the schedule', () => {
        localStorage.setItem('chat', '{broken');
        expect(readScheduleChat('chat', isMessages)).toBeNull();
        localStorage.setItem('chat', '{"messages":false}');
        expect(readScheduleChat('chat', isMessages)).toBeNull();

        const denied = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
            throw new Error('quota');
        });

        expect(writeScheduleChat('chat', ['response'])).toBe(false);
        denied.mockRestore();
    });
});
