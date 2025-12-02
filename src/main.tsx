import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import {createRoot} from 'react-dom/client';
import {Toaster} from 'react-hot-toast';
import {BrowserRouter} from 'react-router-dom';
import App from '@/app/App';
import Loading from '@/features/Loading';
import Tutorial from '@/features/Tutorial';
import {initializeProfileImageStore} from './features/file/store';
import initializeApp from './initializeApp';
import './index.css';

const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            staleTime: 1000 * 10,
        },
    },
});

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
