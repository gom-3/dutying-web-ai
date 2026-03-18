import {useDutyHook} from './model/dutyHook';
import {DutyPageView} from './view';

const DutyPage = () => {
    const duty = useDutyHook();

    return <DutyPageView duty={duty} />;
};

export default DutyPage;
