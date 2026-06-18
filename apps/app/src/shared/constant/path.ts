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
};

export type TRoute = TValues<typeof ROUTE>;

export default ROUTE;
