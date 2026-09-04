# Channel Talk language integration

The React web app uses `ChannelTalkLink` for landing-page inquiries, the Dutying contact item, and legal-page support links. Clicking it loads Channel Talk on demand and opens the messenger inside the page. SDK failures fall back to the existing `https://ye620.channel.io` support page.

The integration uses the public installation key served by that existing channel. It boots anonymously and does not send the signed-in account's profile or member ID.

## Website languages

The current i18next language is normalized and passed to `boot.language`. After boot, the integration always waits for `updateUser({language})` before showing the messenger: boot alone can restore a returning visitor's saved language. Subsequent language changes use the same update without resetting the conversation.

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

The SDK lifecycle tests cover all six language preferences, deferred initialization, replacement of the SDK queue function, overriding a saved language before opening, language changes during initialization, and retry after a download timeout or language-update failure.

Production browser verification reproduced Korean system UI on an English page's first inquiry click. Changing the website language to Japanese then correctly changed the messenger's system UI, exposing the missing initial `updateUser` call. An earlier automated browser received `401 unauthenticatedError`; that result was specific to that test environment and did not establish a production authentication outage. Custom Korean channel text still requires translations in the Channel Talk administrator.

The corrected production build was checked in a browser: after opening the Korean messenger, navigating to the English page and clicking the inquiry link displayed `Start a chat`, `Home`, `Messages`, and `Settings` in English immediately.
