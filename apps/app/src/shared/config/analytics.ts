// Dedicated web stream in the dutying-ai property (551586530).
// G-94QM502EQF belongs to the legacy .net property and must not be reused.
export const AI_GA_MEASUREMENT_ID = 'G-WT44BR53VN';

// Company-owned .ai dataset; the legacy pixel mixes .net and development traffic.
export const AI_META_PIXEL_ID = '1138075548924419';

export function metaPixelId(): string {
    const override = import.meta.env.VITE_AI_META_PIXEL_ID?.trim();

    return override && /^[1-9][0-9]+$/.test(override) && override !== '225085720489207' ? override : AI_META_PIXEL_ID;
}

export function googleAnalyticsMeasurementId(): string {
    const override = import.meta.env.VITE_AI_GA_TRACKING_ID?.trim();

    if (override) return override;

    return AI_GA_MEASUREMENT_ID;
}

/** Only this service's production hosts may send marketing events. */
export function isMarketingAnalyticsEnabled(hostname = typeof window === 'undefined' ? '' : window.location.hostname): boolean {
    return import.meta.env.PROD && ['dutying.ai', 'www.dutying.ai', 'app.dutying.ai'].includes(hostname);
}

export function isGoogleAnalyticsEnabled(): boolean {
    return isMarketingAnalyticsEnabled() && Boolean(googleAnalyticsMeasurementId());
}

/** OAuth callbacks and credential-bearing URLs must never initialize or send Pixel events. */
export function isMetaPixelLocationSafe(location: Pick<Location, 'pathname' | 'search' | 'hash'> = window.location): boolean {
    if (location.pathname.startsWith('/oauth2/')) return false;

    const credentialKeys = new Set([
        'token',
        'accesstoken',
        'access_token',
        'refreshtoken',
        'refresh_token',
        'idtoken',
        'id_token',
        'code',
        'password',
        'email',
        'phone',
        'authorization',
    ]);

    return [location.search, location.hash.replace(/^#/, '?')].every((part) =>
        [...new URLSearchParams(part).keys()].every((key) => !credentialKeys.has(key.toLowerCase())),
    );
}

export function isMetaPixelEnabled(): boolean {
    return isMarketingAnalyticsEnabled() && isMetaPixelLocationSafe() && Boolean(metaPixelId());
}

/** Preserve campaign attribution, but never send arbitrary query parameters or fragments. */
export function analyticsPageLocation(pathname: string, search = window.location.search): string {
    const url = new URL(pathname, window.location.origin);
    const query = new URLSearchParams(search);

    for (const key of [
        'utm_source',
        'utm_medium',
        'utm_campaign',
        'utm_id',
        'utm_term',
        'utm_content',
        'gclid',
        'dclid',
        'gbraid',
        'wbraid',
    ]) {
        const value = query.get(key);

        if (value && /^[a-zA-Z0-9_.~ -]{1,200}$/.test(value)) url.searchParams.set(key, value);
    }

    return url.toString();
}

/** Do not credit the sign-in provider as an acquisition channel on return. */
export function isAuthenticationReferrer(referrer: string): boolean {
    try {
        return ['accounts.google.com', 'accounts.kakao.com', 'kauth.kakao.com', 'access.line.me', 'appleid.apple.com'].includes(
            new URL(referrer).hostname,
        );
    } catch {
        return false;
    }
}
