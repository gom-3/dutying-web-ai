import {type TAccount} from '@/entities/account';
import {type TWard} from '@/entities/ward';
import axiosInstance from '../client';
import {type IAuthAPI} from './type';

class AuthAPI implements IAuthAPI {
    demoStart = async () =>
        (await axiosInstance.post<{wardResDto: TWard; accountResDto: TAccount; accessToken: string}>('/demo/start')).data;
    logout = async (accessToken: string | null) => (await axiosInstance.post('/token/blacklist', {accessToken})).data;
}

export default new AuthAPI();
