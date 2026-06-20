import type {TPreferredLanguage, TServiceRegion} from '@dutying/domain';
import {RUNTIME_CONFIG} from '@/shared/config/runtime';
import {
    getDefaultServiceRegionForLanguage,
    getLocaleForLanguage,
    getStoredServiceRegion,
    normalizePreferredLanguage,
    normalizeServiceRegion,
} from '@/shared/i18n/locale';

export const TERMS_OF_SERVICE_DOCUMENT_VERSION = '2026-06-20';
export const MARKETING_COMMUNICATIONS_DOCUMENT_VERSION = '2026-06-20';

export type TLegalAgreementRecordRequest = {
    documentType: 'TERMS_OF_SERVICE' | 'MARKETING_COMMUNICATIONS';
    documentVersion: string;
    documentUrl?: string;
    agreed: true;
    agreedAt: string;
    preferredLanguage: TPreferredLanguage;
    locale: ReturnType<typeof getLocaleForLanguage>;
    serviceRegion: TServiceRegion;
};

const createAgreementBase = (
    language?: string | null,
    serviceRegion?: string | null,
    agreedAt: string = new Date().toISOString(),
) => {
    const preferredLanguage = normalizePreferredLanguage(language) ?? 'en';
    const resolvedServiceRegion =
        normalizeServiceRegion(serviceRegion) ?? getStoredServiceRegion() ?? getDefaultServiceRegionForLanguage(preferredLanguage);

    return {
        agreed: true,
        agreedAt,
        preferredLanguage,
        locale: getLocaleForLanguage(preferredLanguage),
        serviceRegion: resolvedServiceRegion,
    } as const;
};

export const createTermsAgreementRecord = (
    language?: string | null,
    serviceRegion?: string | null,
    agreedAt: string = new Date().toISOString(),
): TLegalAgreementRecordRequest => ({
    ...createAgreementBase(language, serviceRegion, agreedAt),
    documentType: 'TERMS_OF_SERVICE',
    documentVersion: TERMS_OF_SERVICE_DOCUMENT_VERSION,
    documentUrl: RUNTIME_CONFIG.docs.termsOfService,
});

export const createMarketingAgreementRecord = (
    language?: string | null,
    serviceRegion?: string | null,
    agreedAt: string = new Date().toISOString(),
): TLegalAgreementRecordRequest => ({
    ...createAgreementBase(language, serviceRegion, agreedAt),
    documentType: 'MARKETING_COMMUNICATIONS',
    documentVersion: MARKETING_COMMUNICATIONS_DOCUMENT_VERSION,
});
