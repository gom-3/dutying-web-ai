import {type TAccount} from '@/entities/account';
import {type TWard} from '@/entities/ward';

export interface IAccountAPI {
    // GET
    getAccount: (accountId: number) => Promise<TAccount>;
    getAccountMe: () => Promise<TAccount>;
    getAccountMeWaiting: () => Promise<TWard>;
    getDefaultProfileImages: () => Promise<string[]>;
    // PUT
    editAccount: (dto: TEditProfileRequest) => Promise<TAccount>;
    editAccountStatus: (accountId: number, status: TAccount['status']) => Promise<TAccount>;
    // PATCH
    initAccount: (dto: TEditProfileRequest) => Promise<TAccount>;
    // DELETE
    deleteAccount: (accountId: number) => Promise<void>;
}

export type TEditProfileRequest = {
    accountId: number;
    name: string;
    profileImgUrl?: string;
    defaultProfileImgId?: number;
};
