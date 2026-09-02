# Channel Talk language integration

The React web app uses `ChannelTalkLink` for landing-page inquiries, the Dutying contact item, and legal-page support links. Clicking it loads Channel Talk on demand and opens the messenger inside the page. SDK failures fall back to the existing `https://ye620.channel.io` support page.

The integration uses the public installation key served by that existing channel. It boots anonymously and does not send the signed-in account's profile or member ID.

## Website languages

The current i18next language is normalized and passed to `boot.language`. Subsequent language changes use `updateUser({language})` without resetting the conversation.

| Website language | Channel Talk language |
| ---------------- | --------------------- |
| Korean           | `ko`                  |
| Japanese         | `ja`                  |
| English          | `en`                  |
| Chinese          | `zh`                  |
| Thai             | `th`                  |
| Vietnamese       | `vi`                  |

All six preferences are preserved. Channel Talk determines which system UI translations are available; its JavaScript documentation describes English fallback for languages other than Korean and Japanese. Passing a language does not generate translations for custom channel content.

## Channel settings

Add translations for the channel profile, greeting, and other customer-facing content in the Channel Talk administrator. Workflow messages need language-specific content and language targeting.

- [Channel Talk language settings](https://docs.channel.io/help/ko/articles/f6b84106)
- [JavaScript SDK reference](https://developers.channel.io/en/articles/ChannelIO-0b119290)

## Verification on 2026-09-02

The SDK lifecycle tests cover all six language preferences, deferred initialization, replacement of the SDK queue function, language changes during initialization, and retry after a download timeout. The existing landing-page tests also pass.

Live browser verification reached the Channel Talk API, but anonymous boot returned `401 unauthenticatedError` both through the local integration and through the unchanged public `ye620.channel.io` page. Actual messenger display and server-side translations need rechecking after that channel/API authentication issue is resolved.
