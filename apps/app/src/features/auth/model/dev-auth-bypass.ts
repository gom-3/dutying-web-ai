import type {TAccount} from '@/entities/account';

export const DEV_AUTH_BYPASS_TOKEN = '__dutying_dev_auth_bypass__';

export const isDevAuthBypassAvailable = () => import.meta.env.DEV;

export const isDevAuthBypassToken = (accessToken: string | null | undefined) => accessToken === DEV_AUTH_BYPASS_TOKEN;

export const createDevAuthBypassAccount = (): TAccount =>
    ({
        accountId: -1,
        nurseId: null,
        wardId: null,
        shiftTeamId: null,
        email: 'dev-bypass@example.com',
        name: 'DEV Admin',
        phoneNum: '01012341234',
        profileImgUrl: '',
        authProvider: 'KAKAO',
        role: 'OWNER',
        permissions: [],
        tutorials: {seen: []},
        isManager: true,
        status: 'WORKSPACE_SETUP_PENDING',
    }) as unknown as TAccount;
