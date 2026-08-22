import type {TAccount, TAccountStatus, TPreferredLanguage, TServiceRegion, TTutorialKey} from '@dutying/domain';
import type {TWardResponse} from '../ward';

export type {TAccountStatus};
export type {TTutorialKey};

export type TAccountResponse = TAccount;
export type TDefaultProfileImageResponse = {
    id: number;
    url: string;
};

export interface IAccountAPI {
    getAccount: (accountId: number) => Promise<TAccountResponse>;
    getAccountMe: () => Promise<TAccountResponse>;
    getAccountMeWaiting: () => Promise<TWardResponse>;
    getDefaultProfileImages: () => Promise<TDefaultProfileImageResponse[]>;
    editAccount: (dto: TEditProfileRequest) => Promise<TAccountResponse>;
    editAccountStatus: (accountId: number, status: TAccountStatus) => Promise<TAccountResponse>;
    initAccount: (dto: TEditProfileRequest) => Promise<TAccountResponse>;
    updateBirthDate: (birthDate: string | null) => Promise<TAccountResponse>;
    updatePreferences: (dto: TUpdateAccountPreferencesRequest) => Promise<TAccountResponse>;
    deleteAccount: (accountId: number) => Promise<void>;
    markTutorialSeen: (tutorialKey: TTutorialKey) => Promise<void>;
}

export type TEditProfileRequest = {
    accountId: number;
    name: string;
    phoneNum?: string | null;
    profileImgUrl?: string;
    defaultProfileImgId?: number;
    serviceRegion?: TServiceRegion | null;
    preferredLanguage?: TPreferredLanguage | null;
};

export type TUpdateAccountPreferencesRequest = {
    serviceRegion?: TServiceRegion | null;
    preferredLanguage?: TPreferredLanguage | null;
};
