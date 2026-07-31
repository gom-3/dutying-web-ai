import {type TValues} from '@dutying/utils';

const ROUTE = {
    ROOT: '/',
    HOME: '/home',
    REGISTER: '/register',
    ENTER_WARD: '/enter-ward',
    REGISTER_WARD: '/register-ward',
    ONBOARDING_WARD_CREATE: '/onboarding/ward-create',
    LOGIN: '/login',
    SIGN_IN: '/login',
    SIGN_UP: '/signup',
    REFRESH: '/refresh',
    MAINTENANCE: '/maintenance',
    RENEWAL: '/renewal',
    UI_PREVIEW: '/__ui',
    REDIRECT: '/oauth2/redirect',
    ONBOARDING: '/onboarding',
    MAKE: '/make',
    REQUEST: '/request',
    DUTY: '/duty',
    BOARD: '/board',
    MEMBER: '/member',
    WARD_SETTINGS: '/ward-settings',
    WARD_ADMINS: '/ward-settings/admins',
    WARD_INFO_SETTINGS: '/ward-info-settings',
    PROFILE: '/profile',
    DUTYING: '/dutying',
    DUTYING_NOTICES: '/dutying/notices',
    DUTYING_NOTICE_DETAIL: '/dutying/notices/:noticeId',
};

export const MEMBER_CONNECTION_MANAGE_SEARCH_PARAM = 'connectionManage';
export const MEMBER_CONNECTION_MANAGE_SEARCH_VALUE = 'open';
export const MEMBER_CONNECTION_MANAGE_PATH = `${ROUTE.MEMBER}?${MEMBER_CONNECTION_MANAGE_SEARCH_PARAM}=${MEMBER_CONNECTION_MANAGE_SEARCH_VALUE}`;

export type TRoute = TValues<typeof ROUTE>;

export default ROUTE;
