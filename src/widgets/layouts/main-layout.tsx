import {Outlet} from 'react-router';
import NavigationBar from '@/features/NavigationBar';

export const MainLayout = () => {
    return (
        <div className="flex h-full w-full bg-[#FDFCFE]">
            <NavigationBar />
            <main className="min-w-0 flex-1">
                <Outlet />
            </main>
        </div>
    );
};
