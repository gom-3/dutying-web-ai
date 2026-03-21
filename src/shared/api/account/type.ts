import type {TWardResponse} from '../ward/type';

export type TAccountStatus = 'INITIAL' | 'NURSE_INFO_PENDING' | 'WARD_SELECT_PENDING' | 'WARD_ENTRY_PENDING' | 'LINKED' | 'DEMO';

export type TAccountResponse = {
    accountId: number;
    nurseId: number | null;
    wardId: number | null;
    shiftTeamId: number | null;
    email: string;
    name: string;
    profileImgBase64?: string;
    profileImgUrl: string;
    isManager: boolean;
    status: TAccountStatus;
};

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
