# Invitation preview images

Friend and group invitation links use the URL's `lng` for their initial Open Graph image, title and description. Browser-side translations alone cannot change a crawler's preview. The app build emits a Cloudflare Pages `_worker.js` and a `_routes.json` limited to the two invitation paths (including trailing slashes). All other paths continue through static hosting.

The invitation URL, including `code` and `lng`, stays in `og:url` and the canonical link. Kakao may scrape `og:url` again, so it must not point to the Korean homepage. The CSR app shell and app-opening URLs remain intact. With no supported `lng`, metadata uses supported `Accept-Language` preferences and then Korean; the browser page continues to use its saved web-language setting.

Previously sent Kakao cards may retain their old preview. A newly shared URL is used for verification; an existing URL can need a targeted refresh through Kakao's URL metadata tool. Changing metadata does not retroactively edit sent chat messages.

## Assets

All paths below are relative to `apps/app/public/img/`. Existing images are reused without modification.

| Language   | Asset                      | Size       | Source                 |
| ---------- | -------------------------- | ---------- | ---------------------- |
| Korean     | `og-image-preview222.png`  | 1200 × 630 | Existing               |
| Japanese   | `landing-hero-ja-2026.png` | 1672 × 941 | Existing               |
| English    | `landing-hero-en-2026.png` | 1672 × 941 | Existing               |
| Chinese    | `invite-share-zh-v1.png`   | 1672 × 941 | Built-in ImageGen edit |
| Thai       | `invite-share-th-v1.png`   | 1672 × 941 | Built-in ImageGen edit |
| Vietnamese | `invite-share-vi-v1.png`   | 1672 × 941 | Built-in ImageGen edit |

## Final image prompt set

Three separate built-in ImageGen edits used `landing-hero-en-2026.png` as the edit target, `transparent_background=false`, and this prompt with each language and headline substituted:

```text
Use case: text-localization. Edit target: the provided Dutying marketing banner. Create the {language} localization of this same banner. Preserve the exact nurse penguin's identity, pose, large eyes, white nurse cap with red cross, blue clothing, lilac background, and the Dutying wordmark at bottom right. Keep the same wide 16:9 composition and same subject size/placement, full-bleed landscape, no new objects. Replace ONLY the large purple English headline on the right with this exact two-line text in {language}:
{headline}
Use bold, clean, native-language sans-serif typography, correctly shaped native letters and diacritics. Keep the entire headline within the right half with comfortable right margins and no clipping. Match the original purple, headline scale and clean layout. All English headline text must be removed. Keep the Dutying logo unchanged. This is a website Open Graph thumbnail, so the type should remain legible when small. Return one complete localized banner, not a collage.
```

- `zh`: `专为护士打造的` / `一站式应用`
- `th`: `แอปเดียวที่ครบ` / `สำหรับพยาบาล`
- `vi`: `Ứng dụng dành riêng` / `cho điều dưỡng`

Each slash above represents the explicit newline in the submitted prompt. The generated outputs were visually checked and copied into the project without changing the originals.
