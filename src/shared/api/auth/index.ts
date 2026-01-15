import {type Account} from '@/entities/account';
import {type Ward} from '@/entities/ward';
import axiosInstance from '../client';
import {type IAuthAPI} from './type';

class AuthAPI implements IAuthAPI {
    demoStart = async () => (await axiosInstance.post<{wardResDto: Ward; accountResDto: Account; accessToken: string}>('/demo/start')).data;
    logout = async (accessToken: string | null) => (await axiosInstance.post('/token/blacklist', {accessToken})).data;
}

export default new AuthAPI();
