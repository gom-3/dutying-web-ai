# Cancellation control appearance

Use the existing shared outline Button with a visible border, neutral background, stop icon and 44px height. Reuse one scheduling cancellation component in the loading footer, sidebar and ongoing-task entry. Preserve the label, callback, disabled state and server capability gate. Keep the action compact rather than turning cancellation into a full-width primary action.

| Before                                  | After                                                               | Why                                                   |
| --------------------------------------- | ------------------------------------------------------------------- | ----------------------------------------------------- |
| Bare text without a persistent boundary | Outline button with a stop icon, neutral surface and visible border | Clearly recognizable as an action                     |
| Different classes in three surfaces     | One shared cancellation control                                     | Consistent typography, spacing and interaction states |

Verify the existing cancellation/loading/sidebar tests, TypeScript and lint. Inspect the actual production component in a local synthetic preview on desktop and 375px. No backend/API or cancellation behavior changes.

## Verification

Existing loading, task-entry and sidebar suites: 187 tests passed. TypeScript and changed-file ESLint passed. Synthetic component browser preview verified at desktop 1280x720 and mobile 375x812; the cancellation control measures 126x44px, stays within the sidebar and uses the product font. The stop icon is filled, avoiding an unchecked-checkbox appearance. Callbacks and capability gates are unchanged.
