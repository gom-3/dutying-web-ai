import {describe, expect, it} from 'vitest';
import type {TNotification} from '@/shared/api/notification';
import ROUTE from '@/shared/constant/path';
import {fallbackNotificationPathByDomain, resolveNotificationNavigationPath} from '../notification-routing';

const notification = (overrides: Partial<TNotification>): TNotification => ({
    id: 1,
    content: 'notification',
    classification: 'NOTICE',
    isRead: false,
    ...overrides,
});

describe('notification routing', () => {
    it('falls back by server notification domain', () => {
        expect(fallbackNotificationPathByDomain('BOARD')).toBe(ROUTE.BOARD);
        expect(fallbackNotificationPathByDomain('CALENDAR')).toBe(ROUTE.BOARD);
        expect(fallbackNotificationPathByDomain('WARD_REQ_SHIFT')).toBe(ROUTE.REQUEST);
        expect(fallbackNotificationPathByDomain('WARD')).toBe(ROUTE.DUTY);
        expect(fallbackNotificationPathByDomain('NOTICE')).toBe(ROUTE.DUTYING_NOTICES);
        expect(fallbackNotificationPathByDomain(null)).toBe(ROUTE.HOME);
    });

    it('keeps current server relative urls and query params', () => {
        expect(
            resolveNotificationNavigationPath(
                notification({
                    domain: 'WARD_REQ_SHIFT',
                    url: '/request?wardId=1&year=2026&month=8',
                }),
                'https://www.dutying.ai',
            ),
        ).toBe('/request?wardId=1&year=2026&month=8');
    });

    it('normalizes app-prefixed and legacy notice paths', () => {
        expect(
            resolveNotificationNavigationPath(notification({domain: 'BOARD', url: '/app/board?postId=7'}), 'https://www.dutying.ai'),
        ).toBe('/board?postId=7');
        expect(resolveNotificationNavigationPath(notification({domain: 'NOTICE', url: '/notice/5'}), 'https://www.dutying.ai')).toBe(
            '/dutying/notices/5',
        );
    });

    it('keeps same-origin absolute urls inside the app', () => {
        expect(
            resolveNotificationNavigationPath(
                notification({
                    domain: 'NOTICE',
                    url: 'https://www.dutying.ai/app/dutying/notices/5?from=push',
                }),
                'https://www.dutying.ai',
            ),
        ).toBe('/dutying/notices/5?from=push');
    });

    it('falls back instead of navigating to external origins', () => {
        expect(
            resolveNotificationNavigationPath(
                notification({
                    domain: 'WARD',
                    url: 'https://example.com/phishing',
                }),
                'https://www.dutying.ai',
            ),
        ).toBe(ROUTE.DUTY);
        expect(
            resolveNotificationNavigationPath(
                notification({
                    domain: 'BOARD',
                    url: '//example.com/phishing',
                }),
                'https://www.dutying.ai',
            ),
        ).toBe(ROUTE.BOARD);
    });
});
