import useAuth from '@/features/auth/useAuth';
import {MakeShiftProvider} from './model/provider';
import {MakeShiftPageView} from './view';

const MakeShiftPage = () => {
    const {
        state: {wardId},
    } = useAuth();

    return (
        <MakeShiftProvider wardId={wardId}>
            <MakeShiftPageView />
        </MakeShiftProvider>
    );
};

export default MakeShiftPage;
