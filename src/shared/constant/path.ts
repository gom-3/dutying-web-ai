import {type TValues} from '../types/util';

const ROUTE = {
    ROOT: '/',
    REGISTER: '/register',
    ENTER_WARD: '/enter-ward',
    REGISTER_WARD: '/register-ward',
    LOGIN: '/login',
    REFRESH: '/refresh',
    REDIRECT: '/oauth2/redirect',
    ONBOARDING: '/onboarding',
    MAKE: '/make',
    REQUEST: '/request',
    DUTY: '/duty',
    MEMBER: '/member',
    PROFILE: '/profile',
};

export type TRoute = TValues<typeof ROUTE>;

export default ROUTE;
