import {type Account} from '@/shared/types/account';
import {type Ward} from '@/shared/types/ward';
import axiosInstance from '../client';
import {type IAuthAPI} from './type';

class AuthAPI implements IAuthAPI {
    getAccountMe = async () => (await axiosInstance.get<Account>('/accounts/me')).data;
    demoStart = async () => (await axiosInstance.post<{wardResDto: Ward; accountResDto: Account; accessToken: string}>('/demo/start')).data;
    logout = async (accessToken: string | null) => (await axiosInstance.post('/token/blacklist', {accessToken})).data;
}

export default new AuthAPI();
