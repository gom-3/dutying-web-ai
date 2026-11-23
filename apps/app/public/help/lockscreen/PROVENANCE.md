# Dutying lockscreen guide

Imported from `dutying-lockscreen-publish.zip`, supplied on 2026-11-19.
Original `public/index.html` SHA-256:
`65f05f2f653fc4fef0c736c7e98856bb4fe68d3739c8fe184fb39e3c1743c723`.

The original tutorial flows, screenshots, crop coordinates, shortcut URLs, hash
routes, progress storage, and theme choices are preserved. The guide home and
visual styles were adapted for the Dutying website. Images and the included font
were moved into `assets/`, so browsers can cache them independently. Keep
`FONT-LICENSE.txt` with the font. No runtime dependency, API, or database is used.

`index.html` contains the trusted tutorial JSON. `guide.js` controls navigation
and renders that data; `guide.css` owns the visual system. `theme.js` restores the
selected theme before the page renders. Vite copies this directory to the build
unchanged; the entry URL is `/help/lockscreen/`.

The landing and guide home use the user's iPhone screenshot supplied on
2026-11-19, encoded as lossless `assets/lockscreen-iphone.webp`. Its decoded
pixels match the supplied PNG. `iphone-preview.css` supplies the shared device
frame; the screenshot already contains the date, clock, and lockscreen controls.

The full guide was redesigned around one action per screen. Step headings and
supporting copy were shortened; native action links, conditions, exact shortcut
and notification names, step IDs, branching, screenshots and storage keys remain
unchanged. The final screen confirms completion of the guide, not verification
of native iPhone execution.

The home orders setup as wallpaper with refresh, followed by the optional to-do
control. Wallpaper setup has 8 steps for app-close refresh or 15 for notification
refresh. The to-do control has 8 steps and uses the wallpaper setup completed
first. Existing `auto`, `quickadd/refresh-*`, and removed test-step hashes and
saved progress resolve to their current wallpaper steps.

When accepting a newer source ZIP, merge flow data and assets deliberately rather
than replacing the website entry page. Preserve `wallpaper`, `quickadd`, `auto`
flow IDs and stable step IDs to keep shared links and saved progress useful.
The content includes trusted HTML in step bodies and notes; sanitize it before
ever accepting content from an untrusted or user-editable source.

The source package states that the notification refresh path requires a new
native app build. Its verification record does not establish end-to-end iPhone
Shortcuts execution or final wallpaper refresh. Frontend checks do not replace
that native runtime verification. Personal automations are still connected by
the user on the iPhone; they are not embedded in the shared shortcut files.

## 2026-11-21 video review

The supplied 43.2-second and 196.332-second iPhone recordings establish the
wallpaper picker, permission prompt, notification editor and shortcut-name launch
error. Nine cropped images from those videos are available in this directory.
The completed title-filter image comes from the user's earlier iPhone screenshot
of the same setup. Native labels and contents have not been recreated.

The iCloud public records checked on 2026-11-21 use NFD Korean names, while the
old run links passed NFC names. The videos show a shortcut present in the
library while a website launch reports it missing, and subsequently show its
native execution permission prompt. This supports a name-lookup problem, but
does not isolate iOS's internal comparison or rule out an import timing issue.
The guide now opens the library and points to the native play button. This also
handles user renaming and duplicate imports without matching a shortcut name.

The extra test shortcut has been removed from the setup flow. Verification uses
an actual change in Dutying followed by returning to Home and checking the Lock
Screen. The title-filter and automation-enable steps have actual captures.
The cropped “run shortcut” action image deliberately excludes the incomplete
notification condition visible above it in the supplied recording.

These edits were made in `apps/app/public/help/lockscreen/` in the web
repository. Treat this directory as the guide source for this revision. Merge
older mobile-repository tutorial exports before replacing it. Local DOM checks
and Safari review establish the web flow. Final iPhone automatic refresh and
production publication require separate verification.

App-opening steps use the actual app icons beside the heading and in the
launch button. Dutying's icon comes from the mobile project's
`assets/icons/app_icon_1024.png`. The Shortcuts icon comes from the bundled
iOS simulator's `Shortcuts.app/AppIcon60x60@2x.png`. The standalone HTML embeds
both images as well.

Step headings now state the next action. The website's receiving buttons are
labeled “배경 단축어 받기”, “할 일 단축어 받기” and “설정 단축어 받기”.
The native “단축어 추가” button is identified as the following action inside
Shortcuts. Notification configuration has separate receive and execute steps.

The “알림이 보이나요?” question is excluded from the visible setup. New users
follow the supplied iPhone video's notification setup from step 5. Starting
over selects this video path even when an older session used app-close
automation. Explicit app-close step links and saved progress still open that
fallback. Existing question-step hashes redirect to notification configuration.
App-close refresh is linked as help when the notification item is unavailable;
scheduled refresh requires notification setup or a separate time automation.

The photo-selection recovery note is always visible as a pale rose callout,
with a filled notice icon and high-contrast text. Light and dark themes use
separate surface and foreground tokens.

## 2026-11-22 video flow correction

The supplied recording's actual sequence is: the bottom-center plus in All
Shortcuts, the Automation category below Search, scroll to Notification under
the Apps section, then select Dutying. This is different from the older
Automation-tab instructions. Frames at 102, 103.5, 107, 108.5 and 111 seconds
establish this path. Further actual captures show Run Shortcut search at 153,
selection at 156, the attached action and back button at 162 seconds. The
configuration play button comes from 84 seconds. Eight additional crops are
included, with unmodified native labels and precise source times in the
capture manifest. The completed title-filter capture remains the user's earlier
iPhone screenshot because that condition was missing in the video.

Step 5 onward now separates shortcut installation, configuration execution,
creation of the notification trigger, app selection, title filtering, enabling,
action search, shortcut selection, saving and actual-change verification.
No extra test shortcut or yes/no question is introduced. This remains a guide
edit; the supplied recording does not prove final native automatic refresh.

## Equal vertical feature previews

The guide home presents two equally styled pale-purple feature sections in one
column. Each has its own actual captures, an enlarge control and an identically
styled setup link. The calendar is cropped from the mobile project's verified
native renderer output `artifacts/lockscreen-footer-20261122/monthly-light.png`
using example data, so it reflects the latest template spacing and purple today
indicator. The lower-left control crop comes from the existing user-supplied
iPhone capture; the input dialog is the existing native
simulator capture, cropped to the dialog rather than showing the simulator
desktop or unrelated Shortcuts library. No native screenshot contents were
recreated. The wide side-by-side guide layout is replaced by instructions
followed by captures in a single centered column on all screen sizes.

The native wallpaper renderer no longer draws the lower-left update timestamp
in month, week or focus templates. The right-side logo is retained. The guide's
starting-step preview now uses the current native-rendered sample rather than
the older full iPhone capture with the timestamp. Applying the native change
on a user's iPhone requires a new app build and a subsequent wallpaper refresh;
publishing the static web guide alone does not update the installed renderer.
