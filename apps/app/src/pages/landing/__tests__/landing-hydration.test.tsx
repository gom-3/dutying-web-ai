import {act} from '@testing-library/react';
import {hydrateRoot} from 'react-dom/client';
import {I18nextProvider} from 'react-i18next';
import {BrowserRouter} from 'react-router';
import {describe, expect, it, vi} from 'vitest';
import {getMarketingAppStoreUrls, getNurseAppHref} from '@/shared/seo/marketing-locale';
import {renderLanding} from '../entry-server';
import {createLandingI18n} from '../landing-i18n';
import LandingPageView, {guestSession} from '../landing-page-view';

describe('static landing hydration', () => {
    const sampleNames: Record<string, string> = {
        ko: '김서연',
        en: 'Emma Reed',
        ja: '佐藤 美咲',
        zh: '陈雨桐',
        'zh-TW': '陳怡君',
        th: 'ณิชา',
        vi: 'Mai Anh',
    };
    const localizedUsageCount = {
        en: '10,000+',
        ja: '1万人',
        zh: '1 万名',
        'zh-TW': '1 萬名',
        th: '10,000 คนขึ้นไป',
        vi: '10.000+',
    };

    it.each(['ko', 'en', 'ja', 'zh', 'zh-TW', 'th', 'vi'] as const)(
        'keeps the %s content and links when React starts',
        async (language) => {
            const path = language === 'ko' ? '/' : `/${language.toLowerCase()}`;

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
            const usageStats = container.querySelector('#hospital-usage dl');
            const heroActions = container.querySelectorAll('.landing-hero-actions a');
            const links = [...container.querySelectorAll('a')];
            const onRecoverableError = vi.fn();

            let root: ReturnType<typeof hydrateRoot>;

            expect(main).not.toBeNull();
            expect(container.querySelectorAll('h1')).toHaveLength(1);
            expect(container.querySelector('#web')).not.toBeNull();
            expect(container.querySelector('#app')).not.toBeNull();
            expect(container.querySelector('#adoption form')).toBeNull();
            expect(container.querySelector('#landing-adoption-title')).toHaveTextContent(parsed.translation.page.landing.adoption.title);
            expect(container.querySelector('#landing-summary-title')).toHaveTextContent(parsed.translation.page.landing.workflow.title);
            expect(container.querySelector('#excel p')).toHaveTextContent(parsed.translation.page.landing.webSection.importTitle);
            expect(container.querySelector('.landing-hero-offer strong')).not.toBeNull();
            expect(heroActions).toHaveLength(1);
            expect(heroActions[0]).toHaveTextContent(parsed.translation.page.landing.common.startFree);
            expect(heroActions[0]).toHaveAttribute('href', '/login?next=%2Fmake');
            expect(container.querySelectorAll('a[href="#adoption"]')).toHaveLength(1);
            expect(container.querySelector(`header nav a[href="${getNurseAppHref(language)}"]`)).not.toBeNull();
            expect(container.querySelector('.landing-hero-product .landing-schedule-preview__name')).toHaveTextContent(
                sampleNames[language],
            );
            expect(container.querySelector('.landing-hero-product .landing-schedule-preview__title')).toHaveTextContent(
                parsed.translation.page.makeShift.aiRefill.toolbarTitle,
            );
            expect(container.querySelector('.landing-hero-product .landing-schedule-preview button')).toBeNull();

            if (language === 'ko') {
                expect(main).toHaveClass('landing-main--adoption');
                expect(usageStats).toHaveTextContent('1만 명 이상');
                expect(usageStats).toHaveTextContent('50개 이상');
                expect(container.querySelector('#hospital-usage')).toHaveTextContent('충북대학교병원');
                expect(container.querySelector('.landing-nurse-usage')).toBeNull();
                expect(title).toHaveTextContent('교대 근무표, 듀팅으로 더 간편하게');

                const schedule = container.querySelector('.landing-hero-product .landing-schedule-preview__board');
                const fixed = [...(schedule?.querySelectorAll('[data-fixed="true"] [data-shift]') ?? [])];

                expect(fixed.filter((cell) => cell.getAttribute('data-shift') !== 'O').map((cell) => cell.textContent)).toEqual([
                    'D',
                    'E',
                    'N',
                ]);
                expect(fixed.filter((cell) => cell.getAttribute('data-shift') === 'O').length).toBeGreaterThan(3);
                expect(schedule).toHaveAccessibleName(/근무 조건 위반 1개.*근무가 5일 연속.*최대 4일까지/);
                expect(schedule?.querySelector('[data-violation="true"]')).toBeNull();
            } else {
                expect(hero).not.toBeNull();
                expect(container.querySelector('#hospital-usage')).toBeNull();
                expect(container.textContent).not.toMatch(/[가-힣]/);
                expect(container.querySelector('footer a[hreflang=ko], footer a[href="/refund"]')).toBeNull();
                expect(container.querySelector('.landing-nurse-usage__count')).toHaveTextContent(localizedUsageCount[language]);
            }

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
            expect(container.querySelector('#hospital-usage dl')).toBe(usageStats);
            expect([...container.querySelectorAll('a')].filter((link) => !link.closest('#adoption form'))).toEqual(links);

            expect(container.querySelector('#adoption form label[for="landing-adoption-hospitalName"]')).toHaveTextContent(
                parsed.translation.page.landing.adoption.fields.hospitalName,
            );

            await act(async () => root!.unmount());
            container.remove();
        },
    );

    it.each(['ko', 'en', 'ja', 'zh', 'zh-TW', 'th', 'vi'] as const)('hydrates the standalone %s nurse app page', async (language) => {
        const path = getNurseAppHref(language);

        window.history.replaceState(null, '', path);

        const {html, data} = renderLanding(language, path);
        const parsed = JSON.parse(data);
        const i18n = createLandingI18n(parsed.language, parsed.translation);
        const container = document.createElement('div');

        container.innerHTML = html;
        document.body.appendChild(container);

        const title = container.querySelector('h1');
        const links = [...container.querySelectorAll('a')];
        const {ios, android} = getMarketingAppStoreUrls(language);
        const onRecoverableError = vi.fn();

        let root: ReturnType<typeof hydrateRoot>;

        expect(container.querySelectorAll('h1')).toHaveLength(1);
        expect(container.querySelector('#web')).toBeNull();
        if (language !== 'ko') expect(container.textContent).not.toMatch(/[가-힣]/);
        expect(container.querySelector('#app')).not.toBeNull();
        expect(container.querySelector('#mobile-app-download')).not.toBeNull();
        expect(links.map((link) => link.getAttribute('href'))).toEqual(expect.arrayContaining([ios, android]));

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
        expect(container.querySelector('h1')).toBe(title);
        expect([...container.querySelectorAll('a')]).toEqual(links);

        await act(async () => root!.unmount());
        container.remove();
    });
});
