import {afterEach, beforeEach} from 'vitest';
import '@testing-library/jest-dom';
import '@/i18n';
import i18n from '@/i18n';
import {assertNoUnexpectedNetworkRequests, installTestNetworkGuard} from '@/shared/util/test-network-guard';

installTestNetworkGuard();
// Fail even when UI error handling catches the blocked network exception.
afterEach(assertNoUnexpectedNetworkRequests);

beforeEach(async () => {
    if (
        typeof window === 'undefined' ||
        !window.localStorage ||
        typeof window.localStorage.setItem !== 'function' ||
        typeof window.localStorage.getItem !== 'function'
    ) {
        return;
    }

    await i18n.changeLanguage('ko');
});
