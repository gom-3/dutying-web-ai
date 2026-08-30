import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {describe, expect, it} from 'vitest';

const dynamicAppPaths = [
    '/dutying/notices/:noticeId',
    '/app/friends/invite',
    '/app/moim/invite',
    '/app/nultalk/posts/:postId',
    '/app/wards/:wardId/board/posts/:postId',
    '/app/notice/:noticeId',
];

describe('deep link hosting configuration', () => {
    it('proxies Cloudflare routes to the root app shell without redirecting to index.html', () => {
        const redirects = readFileSync(resolve(process.cwd(), 'public/_redirects'), 'utf8');

        for (const path of dynamicAppPaths) {
            expect(redirects).toContain(`${path} / 200`);
        }
        expect(redirects).not.toContain('/index.html 200');
    });

    it('uses the same root app shell rewrites on Vercel', () => {
        const config = JSON.parse(readFileSync(resolve(process.cwd(), 'vercel.json'), 'utf8')) as {
            rewrites: Array<{source: string; destination: string}>;
        };

        expect(config.rewrites).toEqual(
            expect.arrayContaining(
                dynamicAppPaths.map((source) =>
                    expect.objectContaining({
                        source,
                        destination: '/',
                    }),
                ),
            ),
        );
    });
});
