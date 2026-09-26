import {act} from '@testing-library/react';
import {hydrateRoot} from 'react-dom/client';
import {I18nextProvider} from 'react-i18next';
import {BrowserRouter} from 'react-router';
import {describe, expect, it, vi} from 'vitest';
import {renderLanding} from '../entry-server';
import {createLandingI18n} from '../landing-i18n';
import LandingPageView, {guestSession} from '../landing-page-view';

describe('static landing hydration', () => {
    it.each(['ko', 'en', 'ja', 'zh', 'th', 'vi'])('keeps the existing %s content and links when React starts', async (language) => {
        const path = language === 'ko' ? '/' : `/${language}`;

        window.history.replaceState(null, '', path);

        const {html, data} = renderLanding(language, path);
        const parsed = JSON.parse(data);
        const i18n = createLandingI18n(parsed.language, parsed.translation);
        const container = document.createElement('div');

        container.innerHTML = html;
        document.body.appendChild(container);

        const main = container.querySelector('main');
        const title = container.querySelector('h1');
        const hero = container.querySelector('picture');
        const links = [...container.querySelectorAll('a')];
        const onRecoverableError = vi.fn();

        let root: ReturnType<typeof hydrateRoot>;

        expect(main).not.toBeNull();
        expect(container.querySelectorAll('h1')).toHaveLength(1);
        expect(container.querySelector('#web')).not.toBeNull();
        expect(container.querySelector('#app')).not.toBeNull();
        expect(links.some((link) => link.href.includes('apps.apple.com'))).toBe(true);

        await act(async () => {
            root = hydrateRoot(
                container,
                <I18nextProvider i18n={i18n}>
                    <BrowserRouter>
                        <LandingPageView {...guestSession} />
                    </BrowserRouter>
                </I18nextProvider>,
                {onRecoverableError},
            );
        });

        expect(onRecoverableError).not.toHaveBeenCalled();
        expect(container.querySelector('main')).toBe(main);
        expect(container.querySelector('h1')).toBe(title);
        expect(container.querySelector('picture')).toBe(hero);
        expect([...container.querySelectorAll('a')]).toEqual(links);

        await act(async () => root!.unmount());
        container.remove();
    });
});
