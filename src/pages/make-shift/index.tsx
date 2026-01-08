import useAuth from '@/features/auth/useAuth';
import {useMakeShiftBootstrap} from './model/use-bootstrap';
import {MakeShiftPageView} from './view';

const MakeShiftPage = () => {
    const {
        state: {wardId},
    } = useAuth();

    useMakeShiftBootstrap(wardId);

    return <MakeShiftPageView />;
};

export default MakeShiftPage;
