import {useDutyHook} from './model/duty-hook';
import {DutyPageView} from './view';

const DutyPage = () => {
    const duty = useDutyHook();

    return <DutyPageView duty={duty} />;
};

export default DutyPage;
