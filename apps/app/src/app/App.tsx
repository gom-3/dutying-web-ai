import {useEffect} from 'react';
import {AppErrorBoundary} from '@/app/ErrorBoundary';
import {Router} from '@/app/Router';
import useAuth from '@/features/auth';

function App() {
    useAuth();

    const setScreenHeight = () => {
        const vh = window.innerHeight * 0.01;

        document.documentElement.style.setProperty('--vh', `${vh}px`);
    };

    useEffect(() => {
        setScreenHeight();
        window.addEventListener('resize', setScreenHeight);

        return () => window.removeEventListener('resize', setScreenHeight);
    }, []);

    return (
        <AppErrorBoundary>
            <Router />
        </AppErrorBoundary>
    );
}

export default App;
