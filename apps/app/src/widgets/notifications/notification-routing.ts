import type {TNotification} from '@/shared/api/notification';
import ROUTE from '@/shared/constant/path';

const LOCAL_URL_BASE = 'https://dutying.local';
const normalizeDomain = (domain?: string | null) => domain?.trim().toUpperCase() ?? '';
const stripAppPrefix = (path: string) => {
    if (path === '/app') return ROUTE.HOME;

    if (path.startsWith('/app/')) return path.slice(4);

    return path;
};
const normalizeLegacyPath = (path: string) => {
    const normalizedPath = stripAppPrefix(path);

    if (normalizedPath.startsWith('/notice/')) {
        return `${ROUTE.DUTYING_NOTICES}${normalizedPath.slice('/notice'.length)}`;
    }

    return normalizedPath;
};

export const fallbackNotificationPathByDomain = (domain?: string | null) => {
    switch (normalizeDomain(domain)) {
        case 'BOARD':
        case 'CALENDAR':
            return ROUTE.BOARD;
        case 'WARD_REQ_SHIFT':
            return ROUTE.REQUEST;
        case 'WARD':
            return ROUTE.DUTY;
        case 'NOTICE':
            return ROUTE.DUTYING_NOTICES;
        case 'NULTALK':
            return ROUTE.DUTYING;
        case 'SOCIAL':
            return ROUTE.HOME;
        default:
            return ROUTE.HOME;
    }
};

export const resolveNotificationNavigationPath = (
    notification: Pick<TNotification, 'domain' | 'url'>,
    currentOrigin = window.location.origin,
) => {
    const fallbackPath = fallbackNotificationPathByDomain(notification.domain);
    const rawUrl = notification.url?.trim();

    if (!rawUrl) return fallbackPath;

    if (rawUrl.startsWith('/')) {
        const parsedUrl = new URL(rawUrl, LOCAL_URL_BASE);

        return `${normalizeLegacyPath(parsedUrl.pathname)}${parsedUrl.search}${parsedUrl.hash}`;
    }

    try {
        const parsedUrl = new URL(rawUrl);

        if (parsedUrl.origin === currentOrigin) {
            return `${normalizeLegacyPath(parsedUrl.pathname)}${parsedUrl.search}${parsedUrl.hash}`;
        }
    } catch {
        return fallbackPath;
    }

    return fallbackPath;
};
