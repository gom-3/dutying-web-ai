import type {TAccountResponse} from '@dutying/api/account';
import type {TWardResponse} from '@dutying/api/ward';

export type TAdminRole = 'OWNER' | 'EDITOR';

export type TAdminPermission =
    | 'DUTY_MANAGE'
    | 'REQUEST_MANAGE'
    | 'BOARD_MANAGE'
    | 'MEMBER_MANAGE'
    | 'WARD_SETTING_MANAGE'
    | 'ADMIN_MANAGE'
    | 'BILLING_MANAGE';

export type TAdminOnboardingStatus = 'WORKSPACE_SETUP_PENDING' | 'LINKED' | 'DISABLED';

export type TAdminMembershipResponse = {
    membershipId?: number;
    wardAdminMembershipId?: number;
    wardId: number;
    role: TAdminRole;
    status: 'ACTIVE';
};

export type TAdminMeResponse = Omit<TAccountResponse, 'status'> & {
    principalType?: 'WARD_ADMIN';
    adminAccountId?: number;
    accountStatus?: 'ACTIVE' | 'DISABLED';
    status: TAdminOnboardingStatus | TAccountResponse['status'];
    role?: TAdminRole | null;
    permissions?: TAdminPermission[];
    memberships?: TAdminMembershipResponse[];
};

export type TCreateAdminWorkspaceDTO = {
    hospitalName: string;
    wardName?: string;
    adminName?: string | null;
    phoneNum?: string | null;
    profileImgUrl?: string | null;
};

export type TUpdateAdminProfileDTO = {
    name?: string | null;
    phoneNum?: string | null;
    profileImgUrl?: string | null;
    defaultProfileImgId?: number;
};

export type TCreateAdminWorkspaceResponse =
    | TAdminMeResponse
    | TWardResponse
    | {
          account?: TAdminMeResponse;
          ward?: TWardResponse;
          membership?: TAdminMembershipResponse;
      };

export type TJoinAdminWardByCodeDTO = {
    code: string;
};

export type TJoinAdminWardByCodeResponse = {
    account?: TAdminMeResponse;
    ward?: TWardResponse;
    membership?: TAdminMembershipResponse;
};
