type TJwtPayload = {
    principalType?: string;
};

const decodeBase64Url = (value: string) => {
    const base64 = value.replace(/-/g, '+').replace(/_/g, '/');
    const paddedBase64 = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=');

    return atob(paddedBase64);
};

export const getAccessTokenPrincipalType = (accessToken: string | null | undefined) => {
    if (!accessToken) return null;

    try {
        const [, payload] = accessToken.split('.');

        if (!payload) return null;

        return (JSON.parse(decodeBase64Url(payload)) as TJwtPayload).principalType ?? null;
    } catch {
        return null;
    }
};

export const isWardAdminAccessToken = (accessToken: string | null | undefined) =>
    getAccessTokenPrincipalType(accessToken) === 'WARD_ADMIN';
