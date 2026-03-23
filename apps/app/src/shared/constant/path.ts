import {type TValues} from '../types/util';

const ROUTE = {
    ROOT: '/',
    REGISTER: '/register',
    ENTER_WARD: '/enter-ward',
    REGISTER_WARD: '/register-ward',
    ONBOARDING_WARD_CREATE: '/onboarding/ward-create',
    LOGIN: '/login',
    REFRESH: '/refresh',
    REDIRECT: '/oauth2/redirect',
    ONBOARDING: '/onboarding',
    MAKE: '/make',
    REQUEST: '/request',
    DUTY: '/duty',
    MEMBER: '/member',
    WARD_SETTINGS: '/ward-settings',
    PROFILE: '/profile',
};

export type TRoute = TValues<typeof ROUTE>;

export default ROUTE;
