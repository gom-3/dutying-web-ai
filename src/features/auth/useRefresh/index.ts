import {useCallback} from 'react';
import toast from 'react-hot-toast';
import {useNavigate} from 'react-router';
import useAuth from '@/features/auth/useAuth';
import axiosInstance from '@/shared/api/client';
import ROUTE from '@/shared/constant/path';

export default function useRefresh() {
    const {
        actions: {handleLogout, handleLogin},
    } = useAuth();
    const navigate = useNavigate();
    const refresh = useCallback(async () => {
        try {
            axiosInstance.defaults.headers.common['Authorization'] = undefined;

            const accessToken = (await axiosInstance.post('/token/refresh')).data.accessToken;

            handleLogin(accessToken, 'back');
        } catch {
            toast.error('로그인이 만료되었습니다. 다시 로그인해주세요.');
            handleLogout();
            navigate(ROUTE.ROOT);
        }
    }, [handleLogin, handleLogout, navigate]);

    return {refresh};
}
