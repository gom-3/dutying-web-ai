import {DateUtil} from '@dutying/utils/date';
import i18n from 'i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import {initReactI18next} from 'react-i18next';
import {getLocaleForLanguage, normalizePreferredLanguage, SUPPORTED_LANGUAGES} from '@/shared/i18n/locale';
import {resources} from '@/shared/i18n/resources.generated';

const syncDocumentLocale = (lng?: string) => {
    const language = normalizePreferredLanguage(lng) ?? 'en';
    const locale = getLocaleForLanguage(language);

    if (typeof document !== 'undefined') {
        document.documentElement.lang = locale;
    }

    DateUtil.setLocale(locale);
};

i18n.use(LanguageDetector)
    .use(initReactI18next)
    .init({
        fallbackLng: 'en',
        supportedLngs: [...SUPPORTED_LANGUAGES],
        nonExplicitSupportedLngs: true,
        load: 'languageOnly',
        detection: {
            order: ['querystring', 'localStorage', 'navigator', 'htmlTag'],
            lookupQuerystring: 'lng',
            lookupLocalStorage: 'i18nextLng',
            caches: ['localStorage'],
            convertDetectedLanguage: (lng) => normalizePreferredLanguage(lng) ?? 'en',
        },
        resources,
        interpolation: {
            escapeValue: false,
        },
        debug: import.meta.env.DEV && import.meta.env.MODE !== 'test',
    });

i18n.on('languageChanged', (lng) => {
    syncDocumentLocale(lng);
});

syncDocumentLocale(i18n.resolvedLanguage ?? i18n.language);

export default i18n;
