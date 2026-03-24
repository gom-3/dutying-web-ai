import useAuth from '@/features/auth/useAuth';
import {useMakeShiftBootstrap} from './model/use-bootstrap';
import {MakeShiftPageView} from './view';
import MakeTutorial from './view/make-tutorial';

const MakeShiftPage = () => {
    const {
        state: {wardId},
    } = useAuth();

    useMakeShiftBootstrap(wardId);

    return (
        <>
            <MakeShiftPageView />
            <MakeTutorial />
        </>
    );
};

export default MakeShiftPage;
