import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import {createRoot} from 'react-dom/client';
import {LoaderIcon, Toaster} from 'react-hot-toast';
import {BrowserRouter} from 'react-router-dom';
import App from '@/app/App';
import {captureOAuthRedirectPayload} from '@/features/auth/model/oauth-redirect-payload';
import {initializeProfileImageStore} from '@/features/file';
import {getIndexedMarketingLanguageFromPath} from '@/shared/seo/marketing-locale';
import Loading from '@/widgets/loading';
import Tutorial from '@/widgets/tutorial';
import './index.css';
import i18n from './i18n';
import initializeApp from './initializeApp';

const indexedMarketingLanguage = getIndexedMarketingLanguageFromPath(window.location.pathname);
const rootQuerySelectsLanguage = window.location.pathname === '/' && new URLSearchParams(window.location.search).has('lng');

if (indexedMarketingLanguage && !rootQuerySelectsLanguage) {
    void i18n.changeLanguage(indexedMarketingLanguage);
}

const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            staleTime: 1000 * 10,
        },
    },
});

if (import.meta.env.DEV && import.meta.env.VITE_ENABLE_LOCATOR === 'true') {
    void import('@locator/runtime').then(({default: setupLocatorUI}) => {
        setupLocatorUI();
    });
}

captureOAuthRedirectPayload();
initializeApp();
initializeProfileImageStore();

const TOAST_LOADING_SPINNER_SIZE = 14.4;
const container = document.getElementById('root') as HTMLElement;
const element = (
    <QueryClientProvider client={queryClient}>
        <BrowserRouter>
            <App />
            <Toaster
                position="bottom-center"
                containerClassName="toaster"
                gutter={10}
                toastOptions={{
                    duration: 3000,
                    style: {
                        borderRadius: '12px',
                        background: 'rgba(0, 0, 0, 0.82)',
                        color: '#FFFFFF',
                        boxShadow: 'none',
                        border: 'none',
                        padding: '12px 14px',
                        fontSize: '14px',
                        whiteSpace: 'nowrap',
                        maxWidth: 'none',
                        width: 'max-content',
                    },
                    success: {
                        style: {
                            borderRadius: '12px',
                            background: 'rgba(0, 0, 0, 0.82)',
                            color: '#FFFFFF',
                            boxShadow: 'none',
                            border: 'none',
                            whiteSpace: 'nowrap',
                            maxWidth: 'none',
                            width: 'max-content',
                        },
                    },
                    error: {
                        style: {
                            borderRadius: '12px',
                            background: 'rgba(0, 0, 0, 0.82)',
                            color: '#FFFFFF',
                            boxShadow: 'none',
                            border: 'none',
                            whiteSpace: 'nowrap',
                            maxWidth: 'none',
                            width: 'max-content',
                        },
                    },
                    loading: {
                        icon: (
                            <LoaderIcon
                                style={{
                                    width: TOAST_LOADING_SPINNER_SIZE,
                                    height: TOAST_LOADING_SPINNER_SIZE,
                                }}
                            />
                        ),
                    },
                }}
            />
            <Loading />
            <Tutorial />
        </BrowserRouter>
    </QueryClientProvider>
);

createRoot(container).render(element);
