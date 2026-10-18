// Dedicated web stream in the dutying-ai property (551586530).
// G-94QM502EQF belongs to the legacy .net property and must not be reused.
export const AI_GA_MEASUREMENT_ID = 'G-WT44BR53VN';

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

export function isMetaPixelEnabled(): boolean {
    return isMarketingAnalyticsEnabled() && Boolean(import.meta.env.VITE_PIXEL_ID);
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
