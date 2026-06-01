import {ArrowLeft, Home, RotateCcw} from 'lucide-react';
import {Helmet} from 'react-helmet';
import {useNavigate} from 'react-router';
import ROUTE from '@/shared/constant/path';
import {useTypedTranslation} from '@/shared/hook/use-typed-translation';
import Button from '@/shared/ui/form-controls/Button';

type TErrorPageVariant = 'notFound' | 'unexpected';

type TErrorPageProps = {
    variant: TErrorPageVariant;
    onRetry?: () => void;
};

const ERROR_IMAGE_SRC = '/img/empty-schedule-nurse.png';

function ErrorPage({variant, onRetry}: TErrorPageProps) {
    const {t} = useTypedTranslation();
    const navigate = useNavigate();
    const isNotFound = variant === 'notFound';
    const title = t(isNotFound ? 'page.error.notFound.title' : 'page.error.unexpected.title');
    const description = t(isNotFound ? 'page.error.notFound.description' : 'page.error.unexpected.description');

    return (
        <>
            <Helmet title={`${title} | 듀팅`} />
            <main className="flex min-h-screen w-full items-center justify-center bg-main-bg px-5 py-10 font-apple">
                <section
                    className="flex w-full max-w-[680px] flex-col items-center rounded-[24px] bg-white px-6 py-10 text-center shadow-[0_20px_60px_rgba(34,34,56,0.06)] sm:px-10 sm:py-12"
                    aria-labelledby="error-page-title"
                >
                    <p className="rounded-full bg-main-light px-4 py-2 text-[14px] font-semibold text-main-1">
                        {t(isNotFound ? 'page.error.notFound.code' : 'page.error.unexpected.code')}
                    </p>
                    <img
                        src={ERROR_IMAGE_SRC}
                        alt=""
                        aria-hidden="true"
                        decoding="async"
                        className="mt-7 h-[190px] w-auto object-contain select-none sm:h-[220px]"
                    />
                    <h1
                        id="error-page-title"
                        className="mt-7 text-[26px] leading-[1.35] font-semibold break-keep text-sub-1 sm:text-[30px]"
                    >
                        {title}
                    </h1>
                    <p className="mt-3 max-w-[420px] text-[15px] leading-7 break-keep whitespace-pre-line text-gray-3">{description}</p>
                    <div className="mt-8 flex w-full flex-col items-stretch justify-center gap-3 sm:w-auto sm:flex-row">
                        {isNotFound ? (
                            <Button
                                type="button"
                                size="md"
                                className="h-12 rounded-[14px] px-5 text-[15px] font-semibold"
                                onClick={() => navigate(ROUTE.MAKE)}
                            >
                                <Home className="size-[17px]" strokeWidth={2.2} aria-hidden="true" />
                                {t('page.error.goHome')}
                            </Button>
                        ) : (
                            <Button
                                type="button"
                                size="md"
                                className="h-12 rounded-[14px] px-5 text-[15px] font-semibold"
                                onClick={onRetry ?? (() => window.location.reload())}
                            >
                                <RotateCcw className="size-[17px]" strokeWidth={2.2} aria-hidden="true" />
                                {t('page.error.retry')}
                            </Button>
                        )}
                        <Button
                            type="button"
                            variant="outline"
                            size="md"
                            className="h-12 rounded-[14px] px-5 text-[15px] font-semibold"
                            onClick={() => navigate(-1)}
                        >
                            <ArrowLeft className="size-[17px]" strokeWidth={2.2} aria-hidden="true" />
                            {t('page.error.goBack')}
                        </Button>
                    </div>
                </section>
            </main>
        </>
    );
}

export function NotFoundPage() {
    return <ErrorPage variant="notFound" />;
}

export function UnexpectedErrorPage({onRetry}: Pick<TErrorPageProps, 'onRetry'>) {
    return <ErrorPage variant="unexpected" onRetry={onRetry} />;
}
