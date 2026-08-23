import {useNavigate, useSearchParams} from 'react-router-dom';
import ROUTE from '@/shared/constant/path';
import {useTypedTranslation} from '@/shared/hook/use-typed-translation';
import PageState from '@/shared/ui/PageState';

const OAuthErrorPage = () => {
    const {t} = useTypedTranslation();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const error = searchParams.get('error')?.trim();
    const errorCode = searchParams.get('errorCode')?.trim();

    return (
        <PageState
            tone="error"
            layout="screen"
            title={t('page.login.redirect.errorTitle')}
            description={error || t('page.login.redirect.adminTokenMissing')}
            action={{
                label: t('page.login.loginLink'),
                onClick: () => navigate(ROUTE.LOGIN, {replace: true}),
            }}
        >
            {errorCode ? <p className="font-mono text-xs text-gray-3">{errorCode}</p> : null}
        </PageState>
    );
};

export default OAuthErrorPage;
