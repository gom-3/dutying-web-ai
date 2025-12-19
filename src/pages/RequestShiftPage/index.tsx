import useRequestShift from '@/features/shift/useRequestShift';
import RequestCalendar from './ui/RequestCalendar';
import Toolbar from './ui/Toolbar';

const RequestShiftPage = () => {
    useRequestShift(true);

    return (
        <div className="mx-auto flex h-screen w-fit min-w-418.5 flex-col">
            <Toolbar />
            <RequestCalendar />
        </div>
    );
};

export default RequestShiftPage;
