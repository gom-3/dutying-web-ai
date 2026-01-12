import {type Account} from '@/shared/types/account';
import {type TWard} from '@/shared/types/ward';
import axiosInstance from '../client';
import {type IAuthAPI} from './type';

class AuthAPI implements IAuthAPI {
    demoStart = async () =>
        (await axiosInstance.post<{wardResDto: TWard; accountResDto: Account; accessToken: string}>('/demo/start')).data;
    logout = async (accessToken: string | null) => (await axiosInstance.post('/token/blacklist', {accessToken})).data;
}

export default new AuthAPI();
