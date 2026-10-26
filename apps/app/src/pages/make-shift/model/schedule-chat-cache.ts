import {getWardAdminAccountIdFromAccessToken, isWardAdminAccessToken} from '@/features/auth/model/admin-token';

export function scheduleChatOwner(accountId: number | null, accessToken: string | null): string | null {
    const admin = isWardAdminAccessToken(accessToken);
    const id = admin ? getWardAdminAccountIdFromAccessToken(accessToken) : accountId;

    return id == null ? null : `${admin ? 'ward-admin' : 'account'}:${id}`;
}

/** Browser transcript supplements server conversation history; it never authorizes execution. */
export function scheduleChatKey(owner: string | number | null, wardId: number | null, teamId: number | null, year: number, month: number) {
    if (owner == null || wardId == null || teamId == null) return null;

    return `dutying:schedule-chat:v1:${owner}:${wardId}:${teamId}:${year}:${month}`;
}

export function readScheduleChat<T>(key: string | null, validate: (value: unknown) => value is T): T | null {
    if (!key) return null;

    try {
        const value: unknown = JSON.parse(window.localStorage.getItem(key) ?? 'null');

        return validate(value) ? value : null;
    } catch {
        return null;
    }
}

export function writeScheduleChat(key: string | null, value: unknown): boolean {
    if (!key) return true;

    try {
        if (value == null) window.localStorage.removeItem(key);
        else window.localStorage.setItem(key, JSON.stringify(value));

        return true;
    } catch {
        return false;
    }
}
