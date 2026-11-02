// Vite inlines the existing invitation translations and image catalog into the
// generated _worker.js. This module has no browser or external runtime imports.
export const INVITE_PREVIEW_PATHS = ['/app/friends/invite', '/app/moim/invite'];

const escapeHtml = (value) =>
    String(value).replace(
        /[&<>"']/g,
        (character) =>
            ({
                '&': '&amp;',
                '<': '&lt;',
                '>': '&gt;',
                '"': '&quot;',
                "'": '&#39;',
            })[character],
    );

export function resolvePreviewLanguage(url, acceptLanguage, data) {
    const normalize = (value) => {
        const language = value?.trim().split(/[-_]/)[0]?.toLowerCase();

        return Object.hasOwn(data, language) ? language : undefined;
    };
    const explicit = normalize(url.searchParams.get('lng'));

    if (explicit) return explicit;

    const preferences = (acceptLanguage ?? '')
        .split(',')
        .map((preference) => {
            const [tag, ...parameters] = preference.trim().split(';');
            const weight = parameters.find((parameter) => parameter.trim().startsWith('q='));
            const quality = weight === undefined ? 1 : Number(weight.trim().slice(2));

            return {language: normalize(tag), quality};
        })
        .filter(({language, quality}) => language && quality > 0 && quality <= 1);

    return preferences.sort((left, right) => right.quality - left.quality)[0]?.language ?? 'ko';
}

export function createInvitePreviewWorker(data) {
    return {
        async fetch(request, env) {
            const url = new URL(request.url);
            const path = url.pathname.replace(/\/$/, '');
            const kind = path === INVITE_PREVIEW_PATHS[0] ? 'friend' : path === INVITE_PREVIEW_PATHS[1] ? 'moim' : undefined;

            if (!kind || !['GET', 'HEAD'].includes(request.method)) return env.ASSETS.fetch(request);

            // Fetch the normal CSR app shell without conditional request headers.
            // The browser keeps the original URL, query (including code/lng) and hash.
            const shell = await env.ASSETS.fetch(new Request(new URL('/app-shell', url)));

            if (shell.status !== 200 || !shell.headers.get('content-type')?.includes('text/html')) return shell;

            const language = resolvePreviewLanguage(url, request.headers.get('accept-language'), data);
            const {image, invites} = data[language];
            const copy = invites[kind];
            const imageUrl = new URL(image.path, url.origin).href;

            url.hash = '';

            // og:url must retain the full invitation URL. Kakao may scrape that
            // URL again; pointing it at / would discard the invitation language.
            const title = escapeHtml(copy.pageTitle);
            const description = escapeHtml(copy.description);
            const pageUrl = escapeHtml(url.href);
            const metadata = `<!-- MARKETING_SEO_START -->
<title>${title}</title>
<meta name="title" content="${title}" />
<meta name="description" content="${description}" />
<meta name="robots" content="noindex, nofollow" />
<link rel="canonical" href="${pageUrl}" />
<meta property="og:type" content="website" />
<meta property="og:site_name" content="Dutying" />
<meta property="og:url" content="${pageUrl}" />
<meta property="og:locale" content="${image.locale}" />
<meta property="og:title" content="${title}" />
<meta property="og:description" content="${description}" />
<meta property="og:image" content="${escapeHtml(imageUrl)}" />
<meta property="og:image:type" content="image/png" />
<meta property="og:image:width" content="${image.width}" />
<meta property="og:image:height" content="${image.height}" />
<meta property="og:image:alt" content="${escapeHtml(copy.title.replace(/\s+/g, ' '))}" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:url" content="${pageUrl}" />
<meta name="twitter:title" content="${title}" />
<meta name="twitter:description" content="${description}" />
<meta name="twitter:image" content="${escapeHtml(imageUrl)}" />
<!-- MARKETING_SEO_END -->`;
            const html = (await shell.text())
                .replace(/<!-- MARKETING_SEO_START -->[\s\S]*?<!-- MARKETING_SEO_END -->/, () => metadata)
                .replace(/<html lang="[^"]*">/, `<html lang="${language}">`);
            const headers = new Headers(shell.headers);

            // The HTML varies by invitation URL and may vary by browser language.
            headers.set('Cache-Control', 'private, no-store');
            headers.append('Vary', 'Accept-Language');
            for (const header of ['ETag', 'Last-Modified', 'Content-Length', 'Content-Encoding']) headers.delete(header);

            return new Response(request.method === 'HEAD' ? null : html, {status: 200, headers});
        },
    };
}

export default createInvitePreviewWorker({
    /*__INVITE_PREVIEW_DATA__*/
});
