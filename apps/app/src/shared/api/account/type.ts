import type {TAccount, TAccountStatus} from '@dutying/domain';
import type {TWardResponse} from '../ward/type';

export type {TAccountStatus};

export type TAccountResponse = TAccount;

export interface IAccountAPI {
    // GET
    getAccount: (accountId: number) => Promise<TAccountResponse>;
    getAccountMe: () => Promise<TAccountResponse>;
    getAccountMeWaiting: () => Promise<TWardResponse>;
    getDefaultProfileImages: () => Promise<string[]>;
    // PUT
    editAccount: (dto: TEditProfileRequest) => Promise<TAccountResponse>;
    editAccountStatus: (accountId: number, status: TAccountStatus) => Promise<TAccountResponse>;
    // PATCH
    initAccount: (dto: TEditProfileRequest) => Promise<TAccountResponse>;
    // DELETE
    deleteAccount: (accountId: number) => Promise<void>;
}

export type TEditProfileRequest = {
    accountId: number;
    name: string;
    profileImgUrl?: string;
    defaultProfileImgId?: number;
};
