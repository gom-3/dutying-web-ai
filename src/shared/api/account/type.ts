import {type Account} from '@/shared/types/account';
import {type Ward} from '@/shared/types/ward';

export interface IAccountAPI {
    // GET
    getAccount: (accountId: number) => Promise<Account>;
    getAccountMeWaiting: () => Promise<Ward>;
    getDefaultProfileImages: () => Promise<string[]>;
    // PUT
    editAccount: (dto: TEditProfileRequest) => Promise<Account>;
    editAccountStatus: (accountId: number, status: Account['status']) => Promise<Account>;
    // PATCH
    initAccount: (dto: TEditProfileRequest) => Promise<Account>;
    // DELETE
    deleteAccount: (accountId: number) => Promise<void>;
}

export type TEditProfileRequest = {
    accountId: number;
    name: string;
    profileImgUrl?: string;
    defaultProfileImgId?: number;
};
