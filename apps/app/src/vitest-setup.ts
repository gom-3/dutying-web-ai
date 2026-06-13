import {afterAll, afterEach, beforeAll, beforeEach} from 'vitest';
import '@testing-library/jest-dom';
import '@/i18n';
import i18n from '@/i18n';

// Start server before all tests
beforeAll(() => {});

//  Close server after all tests
afterAll(() => {});

// Reset handlers after each test `important for test isolation`
afterEach(() => {});

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
