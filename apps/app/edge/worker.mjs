const LOCALE_COOKIE = 'dutying.locale';
const SUPPORTED_LANGUAGES = new Set(['ko', 'ja', 'en', 'zh', 'th', 'vi']);
const LANGUAGE_BY_COUNTRY = {KR: 'ko', JP: 'ja', CN: 'zh', TH: 'th', VN: 'vi'};
const CRAWLER_USER_AGENT = /(?:googlebot|bingbot|duckduckbot|baiduspider|yandexbot|slurp|facebookexternalhit|twitterbot)/i;

const normalizeCountry = (value) => (/^[A-Z]{2}$/.test(value ?? '') && value !== 'XX' ? value : null);
const normalizeLanguage = (value) => {
    const language = value?.split(/[-_]/)[0]?.toLowerCase();
    return SUPPORTED_LANGUAGES.has(language) ? language : null;
};
const cookieLanguage = (header) => {
    const raw = header
        ?.split(';')
        .map((part) => part.trim())
        .find((part) => part.startsWith(`${LOCALE_COOKIE}=`))
        ?.slice(LOCALE_COOKIE.length + 1);
    if (!raw) return null;

    try {
        return normalizeLanguage(decodeURIComponent(raw));
    } catch {
        return null;
    }
};
const browserLanguage = (header) => {
    const preferences = (header ?? '')
        .split(',')
        .map((part, index) => {
            const [tag, weight] = part.trim().split(';q=');
            return {language: normalizeLanguage(tag), quality: weight === undefined ? 1 : Number(weight), index};
        })
        .filter(({language, quality}) => language && quality > 0 && quality <= 1)
        .sort((left, right) => right.quality - left.quality || left.index - right.index);

    return preferences[0]?.language ?? null;
};

export const selectLandingLanguage = ({queryLanguage, savedLanguage, country, acceptLanguage}) =>
    normalizeLanguage(queryLanguage) ??
    normalizeLanguage(savedLanguage) ??
    LANGUAGE_BY_COUNTRY[normalizeCountry(country)] ??
    browserLanguage(acceptLanguage) ??
    'en';

export default {
    async fetch(request, env) {
        const url = new URL(request.url);

        if (url.pathname === '/__visitor-country') {
            if (request.method !== 'GET') return new Response(null, {status: 405, headers: {Allow: 'GET'}});

            return Response.json(
                {country: normalizeCountry(request.cf?.country)},
                {headers: {'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff'}},
            );
        }

        if (url.pathname !== '/' || (request.method !== 'GET' && request.method !== 'HEAD')) {
            return env.ASSETS.fetch(request);
        }

        const acceptLanguage = request.headers.get('Accept-Language');
        const savedLanguage = cookieLanguage(request.headers.get('Cookie'));
        const queryLanguage = url.searchParams.get('lng');

        // Keep the canonical Korean root crawlable regardless of crawler location.
        // A real visitor may also omit Accept-Language, so the country still applies to them.
        if (CRAWLER_USER_AGENT.test(request.headers.get('User-Agent') ?? '')) return env.ASSETS.fetch(request);

        const language = selectLandingLanguage({
            queryLanguage,
            savedLanguage,
            country: request.cf?.country,
            acceptLanguage,
        });

        if (language === 'ko') return env.ASSETS.fetch(request);

        url.pathname = `/${language}`;
        url.searchParams.delete('lng');

        return new Response(null, {
            status: 302,
            headers: {
                Location: url.toString(),
                'Cache-Control': 'private, no-store',
                Vary: 'Cookie, Accept-Language',
            },
        });
    },
};
