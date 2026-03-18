import {useLocation} from 'react-router';
import {match} from 'ts-pattern';
import ROUTE from '@/shared/constant/path';
import MemberTutorial from './MemberTutorial';
import RequestTutorial from './RequestTutorial';
// @TODO import MakeTutorial from './MakeTutorial'; 근무표 작성 개편 중으로 인해 임시 주석 처리

const Tutorial = () => {
    const {pathname} = useLocation();

    return match(pathname)
        .with(ROUTE.REQUEST, () => <RequestTutorial />)
        .with(ROUTE.MEMBER, () => <MemberTutorial />)
        .otherwise(() => null);
};

export default Tutorial;
