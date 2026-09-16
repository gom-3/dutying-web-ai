import {createInstance, type ResourceLanguage} from 'i18next';

export function createLandingI18n(language: string, translation: ResourceLanguage) {
    const instance = createInstance();

    void instance.init({
        lng: language,
        fallbackLng: language,
        resources: {[language]: {translation}},
        initImmediate: false,
        interpolation: {escapeValue: false},
    });

    return instance;
}
