import {setAccessToken} from '@/shared/api/client';
import useAuthStore from './auth/useAuth/store';
import {useRequestShiftStore} from './shift/useRequestShift/store';

const useInitStore = () => {
    const {initState: initReqShiftStore} = useRequestShiftStore();
    const {initState: initAuthStore} = useAuthStore();
    const initStore = () => {
        initReqShiftStore();
        initAuthStore();
        setAccessToken('');
    };

    return initStore;
};

export default useInitStore;
