export type TAccountStatus = 'INITIAL' | 'NURSE_INFO_PENDING' | 'WARD_SELECT_PENDING' | 'WARD_ENTRY_PENDING' | 'LINKED' | 'DEMO';
export type TPreferredLanguage = 'ko' | 'ja' | 'en' | 'zh' | 'th' | 'vi';
export type TServiceRegion = 'KR' | 'JP' | 'EN' | 'CN' | 'TH' | 'VN';

export type TTutorialKey =
    | 'make'
    | 'make-step-1'
    | 'make-step-2'
    | 'make-step-3'
    | 'make-step-4'
    | 'make-step-5'
    | 'request'
    | 'member'
    | 'board'
    | 'board-list'
    | 'board-composer'
    | 'board-detail'
    | 'onboarding-nurse-order';

export type TTutorialProgress = {
    seen?: TTutorialKey[];
    completed?: TTutorialKey[];
    skipped?: TTutorialKey[];
};

export type TAccount = {
    accountId: number;
    nurseId: number | null;
    wardId: number | null;
    shiftTeamId: number | null;
    email: string;
    name: string;
    phoneNum?: string | null;
    birthDate?: string | null;
    /** @deprecated use profileImgUrl */
    profileImgBase64?: string;
    profileImgUrl: string;
    isManager: boolean;
    status: TAccountStatus;
    serviceRegion?: TServiceRegion | null;
    preferredLanguage?: TPreferredLanguage | null;
    resolvedRegion?: TServiceRegion | null;
    resolvedLanguage?: TPreferredLanguage | null;
    tutorials?: TTutorialProgress;
};
