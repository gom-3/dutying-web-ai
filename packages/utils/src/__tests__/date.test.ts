import {describe, expect, it} from 'vitest';
import {DateUtil, getDayName, getDaysInMonth} from '../date';

describe('getDaysInMonth', () => {
    it('returns days for the current month when month is omitted', () => {
        const now = new Date();
        const days = getDaysInMonth();

        expect(days[0]?.getFullYear()).toBe(now.getFullYear());
        expect(days[0]?.getMonth()).toBe(now.getMonth());
        expect(days).toHaveLength(new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate());
    });

    it('treats the month argument as 1-based', () => {
        const days = getDaysInMonth(2, 2024);

        expect(days[0]?.getFullYear()).toBe(2024);
        expect(days[0]?.getMonth()).toBe(1);
        expect(days).toHaveLength(29);
    });
});

describe('getDayName', () => {
    it('keeps Korean weekday formatting as the default behavior', () => {
        DateUtil.setLocale('ko-KR');

        expect(getDayName(new Date(2026, 5, 7))).toBe('일');
    });

    it('formats weekday names with the requested locale', () => {
        const sunday = new Date(2026, 5, 7);

        expect(getDayName(sunday, 'ja-JP')).toBe('日');
        expect(getDayName(sunday, 'en-US')).toBe('Sun');
    });
});
