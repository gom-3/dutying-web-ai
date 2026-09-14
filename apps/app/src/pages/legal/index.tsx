import {useEffect} from 'react';
import {useTranslation} from 'react-i18next';
import {getPublishedLegalDocumentUrl, type TPublishedLegalDocument} from '@/shared/legal/documents';
import PageState from '@/shared/ui/PageState';

function LegalDocumentRedirect({document}: {document: TPublishedLegalDocument}) {
    const {i18n, t} = useTranslation();
    const documentUrl = getPublishedLegalDocumentUrl(document, i18n.resolvedLanguage ?? i18n.language);

    useEffect(() => {
        window.location.replace(documentUrl);
    }, [documentUrl]);

    return (
        <PageState tone="loading" layout="screen" title={t('page.state.loadingTitle')} description={t('page.state.loadingDescription')} />
    );
}

export function PrivacyPolicyPage() {
    return <LegalDocumentRedirect document="privacyPolicy" />;
}

export function TermsOfServicePage() {
    return <LegalDocumentRedirect document="termsOfService" />;
}
