import setupLocatorUI from '@locator/runtime';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import {createRoot} from 'react-dom/client';
import {Toaster} from 'react-hot-toast';
import {BrowserRouter} from 'react-router-dom';
import App from '@/app/App';
import {initializeProfileImageStore} from '@/features/file';
import Loading from '@/widgets/loading';
import Tutorial from '@/widgets/tutorial';
import initializeApp from './initializeApp';
import './index.css';
import './i18n';

const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            staleTime: 1000 * 10,
        },
    },
});

if (import.meta.env.DEV) {
    setupLocatorUI();
}

initializeApp();
initializeProfileImageStore();

const container = document.getElementById('root') as HTMLElement;
const element = (
    <QueryClientProvider client={queryClient}>
        <BrowserRouter>
            <App />
            <Toaster position="bottom-center" containerClassName="toaster" />
            <Loading />
            <Tutorial />
        </BrowserRouter>
    </QueryClientProvider>
);

createRoot(container).render(element);
