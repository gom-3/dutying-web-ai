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

The home offers two complete setups: wallpaper and the to-do button, both ending
with automatic refresh. The to-do flow also prepares `듀팅 배경 갱신` and its
wallpaper target before connecting the automation. The source `auto` definition
is reused internally; its old hashes and saved progress now resolve inside the
wallpaper flow. Existing to-do step IDs continue to work, with refresh steps
following the original input step.

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
