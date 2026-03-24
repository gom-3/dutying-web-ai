import {useDutyHook} from './model/dutyHook';
import {DutyPageView} from './ui';

const DutyPage = () => {
    const duty = useDutyHook();

    return <DutyPageView duty={duty} />;
};

export default DutyPage;
