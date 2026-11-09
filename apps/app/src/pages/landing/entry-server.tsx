import {renderToString} from 'react-dom/server';
import {I18nextProvider} from 'react-i18next';
import {StaticRouter} from 'react-router';
import i18n from '@/i18n';
import {createLandingI18n} from './landing-i18n';
import LandingPageView, {guestSession} from './landing-page-view';

export function renderLanding(language: string, path: string) {
    const full = i18n.getResourceBundle(language, 'translation');
    const {aiRefill, calendar, steps} = full.page.makeShift;
    const {grid, validation} = full.feature.shiftEditor;
    // Send only public-page copy; the scheduler and other locales stay out of the entry bundle.
    const translation = {
        page: {
            landing: full.page.landing,
            login: {
                termsOfService: full.page.login.termsOfService,
                privacyPolicy: full.page.login.privacyPolicy,
                signupLink: full.page.login.signupLink,
            },
            profile: {language: full.page.profile.language},
            navigationBar: {items: {account: full.page.navigationBar.items.account}},
            state: {loadingTitle: full.page.state.loadingTitle},
            makeShift: {
                calendar: {violationDialogAria: calendar.violationDialogAria},
                aiRefill: {
                    toolbarTitle: aiRefill.toolbarTitle,
                    toolbarSubTitle: aiRefill.toolbarSubTitle,
                    firstFill: aiRefill.firstFill,
                    confirm: aiRefill.confirm,
                },
                steps: {
                    workers: {label: steps.workers.label},
                    constraints: {label: steps.constraints.label},
                    requests: {label: steps.requests.label},
                    fixedShifts: {label: steps.fixedShifts.label},
                    aiAutofill: {label: steps.aiAutofill.label},
                },
            },
        },
        feature: {shiftEditor: {grid: {nameHeader: grid.nameHeader}, validation: {maxConsecutiveWork: validation.maxConsecutiveWork}}},
        entity: {account: full.entity.account},
    };
    const instance = createLandingI18n(language, translation);
    const html = renderToString(
        <I18nextProvider i18n={instance}>
            <StaticRouter location={path}>
                <LandingPageView {...guestSession} />
            </StaticRouter>
        </I18nextProvider>,
    );

    return {html, data: JSON.stringify({language, translation}).replace(/</g, '\\u003c')};
}
