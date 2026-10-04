import type {TPreferredLanguage, TServiceRegion} from '@dutying/domain';

const VISITOR_COUNTRY_KEY = 'dutying.visitorCountry';
const COUNTRY_LANGUAGE: Partial<Record<string, TPreferredLanguage>> = {KR: 'ko', JP: 'ja', CN: 'zh', TH: 'th', VN: 'vi'};
const COUNTRY_REGION: Partial<Record<string, TServiceRegion>> = {KR: 'KR', JP: 'JP', CN: 'CN', TH: 'TH', VN: 'VN'};

export const normalizeVisitorCountry = (value: unknown): string | undefined =>
    typeof value === 'string' && /^[A-Z]{2}$/.test(value) && value !== 'XX' ? value : undefined;

export const getVisitorCountry = (): string | undefined => {
    if (typeof window === 'undefined') return undefined;

    try {
        return normalizeVisitorCountry(window.sessionStorage.getItem(VISITOR_COUNTRY_KEY));
    } catch {
        return undefined;
    }
};

export const getCountryLanguage = (country: string | undefined): TPreferredLanguage | undefined =>
    country ? COUNTRY_LANGUAGE[country] : undefined;

export const getCountryServiceRegion = (country: string | undefined): TServiceRegion | undefined => {
    if (!country) return undefined;

    return COUNTRY_REGION[country] ?? 'EN';
};

export const isLikelyKoreanVisitor = (country: string | undefined, phoneNumber?: string | null): boolean => {
    if (country) return country === 'KR';

    const compactPhone = phoneNumber?.replace(/[\s()-]/g, '') ?? '';
    const localPhone = compactPhone.startsWith('+82') ? `0${compactPhone.slice(3)}` : compactPhone;

    return /^01[016789]\d{7,8}$/.test(localPhone);
};

export const loadVisitorCountry = async (): Promise<string | undefined> => {
    if (typeof window === 'undefined') return undefined;

    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 1200);

    try {
        const response = await fetch('/__visitor-country', {
            cache: 'no-store',
            credentials: 'same-origin',
            signal: controller.signal,
        });

        if (!response.ok) throw new Error(`Visitor country request failed: ${response.status}`);

        const payload = (await response.json()) as {country?: unknown};
        const country = normalizeVisitorCountry(payload.country);

        if (country) window.sessionStorage.setItem(VISITOR_COUNTRY_KEY, country);
        else window.sessionStorage.removeItem(VISITOR_COUNTRY_KEY);

        return country;
    } catch {
        window.sessionStorage.removeItem(VISITOR_COUNTRY_KEY);

        return undefined;
    } finally {
        window.clearTimeout(timeout);
    }
};
