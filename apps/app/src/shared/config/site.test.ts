import {describe, expect, it} from 'vitest';
import {normalizeSiteOrigin, toAppRedirectPath} from './site';

describe('normalizeSiteOrigin', () => {
    it('strips trailing slash from configured origin', () => {
        expect(normalizeSiteOrigin('https://app.dutying.net/', 'https://fallback.example')).toBe('https://app.dutying.net');
    });

    it('falls back when the configured origin is missing', () => {
        expect(normalizeSiteOrigin(undefined, 'https://fallback.example')).toBe('https://fallback.example');
    });
});

describe('toAppRedirectPath', () => {
    const appOrigin = 'https://app.dutying.net';

    it('keeps same-origin absolute URLs as app-relative paths', () => {
        expect(toAppRedirectPath('https://app.dutying.net/make?tab=1#top', appOrigin)).toBe('/make?tab=1#top');
    });

    it('keeps safe relative paths', () => {
        expect(toAppRedirectPath('/member?sort=name', appOrigin)).toBe('/member?sort=name');
    });

    it('rejects cross-origin URLs', () => {
        expect(toAppRedirectPath('https://dutying.net/login', appOrigin)).toBeUndefined();
    });

    it('rejects protocol-relative paths', () => {
        expect(toAppRedirectPath('//dutying.net/make', appOrigin)).toBeUndefined();
    });
});
