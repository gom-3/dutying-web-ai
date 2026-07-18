import {DateUtil} from '@dutying/utils/date';
import i18n from 'i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import {initReactI18next} from 'react-i18next';
import {getLocaleForLanguage, normalizePreferredLanguage, SUPPORTED_LANGUAGES} from '@/shared/i18n/locale';
import {
    en as generatedEn,
    ja as generatedJa,
    ko as generatedKo,
    th as generatedTh,
    vi as generatedVi,
    zh as generatedZh,
} from '@/shared/i18n/resources.generated';
import {en} from '@/shared/locales/en';
import {ja} from '@/shared/locales/ja';
import {ko} from '@/shared/locales/ko';
import {th} from '@/shared/locales/th';
import {vi} from '@/shared/locales/vi';
import {zh} from '@/shared/locales/zh';

const fillMissingTranslations = <TPrimary, TFallback>(primary: TPrimary, fallback: TFallback): TPrimary & TFallback => {
    if (typeof primary !== 'object' || primary === null || Array.isArray(primary)) {
        return (primary ?? fallback) as TPrimary & TFallback;
    }

    const result = {...(primary as Record<string, unknown>)};

    Object.entries(fallback as Record<string, unknown>).forEach(([key, fallbackValue]) => {
        const primaryValue = result[key];

        if (primaryValue === undefined) {
            result[key] = fallbackValue;
            return;
        }

        if (
            typeof primaryValue === 'object' &&
            primaryValue !== null &&
            !Array.isArray(primaryValue) &&
            typeof fallbackValue === 'object' &&
            fallbackValue !== null &&
            !Array.isArray(fallbackValue)
        ) {
            result[key] = fillMissingTranslations(primaryValue, fallbackValue);
        }
    });

    return result as TPrimary & TFallback;
};

const supplementalKo = {
    page: {
        makeShift: {
            workers: {
                restPolicy: {
                    targetLabel: '목표 휴무일',
                    adjustmentNone: '추가 조정 없음',
                    adjustmentPlus: '+{{count}}일 추가',
                    adjustmentMinus: '{{count}}일 차감',
                    weeklyTarget: '주 {{days}}일 × {{weeks}}주 = {{count}}일',
                    fixedTarget: '월 {{count}}일',
                    decreaseTarget: '목표 휴무일 줄이기',
                    increaseTarget: '목표 휴무일 늘리기',
                    dayUnit: '일',
                },
            },
        },
        wardSettings: {
            restLeavePolicy: {
                availability: {
                    title: '휴무일 계산 사용',
                },
                simpleSubtitle: '목표 휴무일과 계산에 포함할 휴무 유형을 관리해요.',
                previewLabel: '{{month}}월 예상 목표 휴무일',
                unit: {
                    day: '일',
                },
                target: {
                    title: '목표 휴무일 설정',
                    weekly: {
                        title: '주 단위로 계산',
                        description: '한 주에 필요한 휴무일 수를 기준으로 월 목표를 자동 계산해요.',
                        stepperLabel: '{{count}}주 기준 주간 휴무일 수',
                    },
                    fixed: {
                        title: '월 고정값으로 계산',
                        description: '매월 동일한 휴무일 목표를 직접 지정해요.',
                        stepperLabel: '월 고정 휴무일 수',
                    },
                },
                holiday: {
                    title: '공휴일 포함 여부',
                    include: {
                        title: '공휴일 포함',
                        description: '공휴일도 목표 휴무일 계산에 포함해요.',
                    },
                    exclude: {
                        title: '공휴일 제외',
                        description: '공휴일은 별도로 보고 목표 휴무일 계산에서 제외해요.',
                    },
                },
                carryOver: {
                    title: '휴무일 이월',
                    toggle: '부족분 이월',
                    toggleHint: '이번 달에 채우지 못한 휴무일을 다음 달 계산에 반영해요.',
                    offTitle: '이월하지 않음',
                    offHint: '매월 설정한 목표만 기준으로 계산해요.',
                },
                countedLeaves: {
                    sectionTitle: '휴무일로 계산할 근무 유형',
                    hint: 'OFF 같은 휴무일로 인정할 근무 유형을 선택해요.',
                    toggleAria: '{{name}} 휴무일 계산 포함 여부',
                    empty: '휴무일로 설정할 휴무 근무 유형이 없어요.',
                },
                toast: {
                    saved: '휴무일 계산 설정을 저장했어요.',
                },
                save: '저장',
            },
            requestReception: {
                notificationTitle: '알림 설정',
            },
        },
    },
} as const;

const resources = {
    ko: {translation: fillMissingTranslations(fillMissingTranslations(generatedKo, ko), supplementalKo)},
    en: {translation: fillMissingTranslations(generatedEn, en)},
    ja: {translation: fillMissingTranslations(generatedJa, ja)},
    zh: {translation: fillMissingTranslations(generatedZh, zh)},
    th: {translation: fillMissingTranslations(generatedTh, th)},
    vi: {translation: fillMissingTranslations(generatedVi, vi)},
} as const;

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
