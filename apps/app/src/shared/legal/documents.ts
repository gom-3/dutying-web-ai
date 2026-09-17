import {normalizePreferredLanguage} from '@/shared/i18n/locale';

export type TPublishedLegalDocument = 'termsOfService' | 'privacyPolicy';

const GLOBAL_DOCUMENT_LANGUAGE = 'en';
const PUBLISHED_LEGAL_DOCUMENT_URLS = {
    termsOfService: {
        ko: 'https://app.notion.com/p/KR-ko-KR-v2026-06-20-38598c0fae25815a9108e62a27544da9?pvs=21',
        ja: 'https://app.notion.com/p/JP-ja-JP-v2026-06-20-38598c0fae25810285b4fbe0439b60a5?pvs=21',
        zh: 'https://app.notion.com/p/CN-zh-CN-v2026-06-20-38598c0fae258196b228ec11015bd3c5?pvs=21',
        en: 'https://app.notion.com/p/GLOBAL-en-Terms-of-Service-v2026-06-20-38598c0fae258168b173cc4eadef2781?pvs=21',
    },
    privacyPolicy: {
        ko: 'https://app.notion.com/p/KR-ko-KR-v2026-06-20-38598c0fae25819bb8e4d184fab61653?pvs=21',
        ja: 'https://app.notion.com/p/JP-ja-JP-v2026-06-20-38598c0fae2581f5aec4c62cbf5826e5?pvs=21',
        zh: 'https://app.notion.com/p/CN-zh-CN-v2026-06-20-38598c0fae258136a48eeb77e58bccc8?pvs=21',
        en: 'https://app.notion.com/p/GLOBAL-en-Privacy-Policy-v2026-06-20-38598c0fae25817f80b0e5046c476863?pvs=21',
    },
} as const;

type TPublishedDocumentLanguage = keyof (typeof PUBLISHED_LEGAL_DOCUMENT_URLS)['termsOfService'];

const getPublishedDocumentLanguage = (language?: string | null): TPublishedDocumentLanguage => {
    const normalizedLanguage = normalizePreferredLanguage(language);

    if (normalizedLanguage === 'ko' || normalizedLanguage === 'ja' || normalizedLanguage === 'zh') {
        return normalizedLanguage;
    }

    return GLOBAL_DOCUMENT_LANGUAGE;
};

export const getPublishedLegalDocumentUrl = (document: TPublishedLegalDocument, language?: string | null) =>
    PUBLISHED_LEGAL_DOCUMENT_URLS[document][getPublishedDocumentLanguage(language)];
