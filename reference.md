# App Walkthrough — technical reference

Detailed gotchas discovered building the first walkthrough (Assuria Loyalty,
an Expo/React Native app) end-to-end: emulator capture, local TTS, a Remotion
video, and a styled PDF. Read this before each phase below — every item here
cost real time to debug once.

## Phase 1a — Screen capture, mobile (Android emulator + adb)

**Coordinate scaling.** When you `Read` a screenshot PNG, the tool reports
something like "original 1080x2400, displayed at 900x2000. Multiply
coordinates by 1.20". That ratio is real — if you eyeball a tap target's
position in the *displayed* image and send it straight to
`adb shell input tap X Y`, you WILL be wrong (adb wants device pixels, i.e.
the *original* size). Always multiply your displayed-image estimate by that
exact ratio before tapping. Getting this wrong doesn't error — it just taps
the wrong element silently, which is much more confusing to debug.

**React Native Modal touch/visual-bounds mismatch.** Some RN `<Modal>`
components (especially ones that read `Dimensions.get("window")` once at
module import time instead of via a hook) render visually in the right place
but register touches somewhere else entirely — sometimes hundreds of pixels
off. Symptom: a clearly-visible, clearly-labeled button (e.g. a tour
"Next"/"Skip" button) does nothing no matter how many times or how carefully
you tap it, even after re-measuring from a fresh screenshot.

Fix: stop guessing pixels from screenshots for anything inside a Modal. Use
the real accessibility tree instead:

```bash
adb shell uiautomator dump /sdcard/window_dump.xml
adb pull /sdcard/window_dump.xml ./window_dump.xml
grep -o 'text="Next"[^>]*bounds="\[[0-9]*,[0-9]*\]\[[0-9]*,[0-9]*\]"' window_dump.xml
# bounds="[793,2083][987,2187]" -> tap the center: (890, 2135)
```

`resource-id`, `content-desc`, or `text` all work as the grep anchor —
prefer `resource-id` when the app sets `testID` (RN maps `testID` →
`resource-id` on Android).

**`uiautomator dump` can return a stale/cached tree.** Occasionally two
consecutive dumps return identical XML even though the visible screen
changed (e.g. a dialog was dismissed). If a dump's content looks suspicious
(matches an earlier state), take a fresh `screencap` and trust that over the
dump before spending time debugging further.

**Android back button as a fallback advance.** If a "Next"-style button in a
dialog is truly unresponsive even at correct coordinates, try
`adb shell input keyevent KEYCODE_BACK` — some coach-mark/tour libraries
intercept the hardware back press as "advance/dismiss." Don't rely on this
as a primary method though — it was flaky in practice (advanced once, then
stopped working the second time).

**`adb shell input text` and special characters.** Reliable for plain
alphanumerics. Symbols like `$` are frequently swallowed or misinterpreted
across the local-shell → adb → remote-shell → `input text` chain. If a test
password/field needs one, don't fight it — most virtual keyboards work fine
via `input tap` on the on-screen key positions instead (`?123` key, symbol
page), or ask the user if the app will actually accept the value without the
symbol.

**Animations off, always.** Before capturing anything:
```bash
adb shell settings put global window_animation_scale 0
adb shell settings put global transition_animation_scale 0
adb shell settings put global animator_duration_scale 0
```

**Fresh-install state.** `adb shell pm clear <package>` + relaunch gets you
true first-run screens (onboarding, permission prompts) reliably. Grant
runtime permissions the app will prompt for (camera etc.) via
`adb shell pm grant <package> android.permission.CAMERA` if you want the
*granted* state screen rather than the permission-request screen (capture
both if useful).

**Live/production backend.** If the app talks to a real backend with no demo
mode, you need real test credentials from the user before you can capture
authenticated screens — don't assume a mock mode exists. Treat provided
credentials as sensitive: don't write them to any file, don't echo them in
narration/PDF/video content.

**Screenshots contain real PII once logged in** (name, email, phone, partial
IDs, policy numbers). Flag this explicitly before the user shares the
finished video/PDF externally.

## Phase 1b — Screen capture, web (browser)

**Dismiss cookie/consent banners before every capture, not just the first.**
Many consent-management platforms re-show the banner (or a smaller variant)
on client-side route changes, not just full page loads — if scene 4's
screenshot has a banner and scene 1's doesn't, it's not flaky, the SPA
navigation just re-triggered it. Check each screenshot, don't assume
dismissing it once covers the whole capture session.

**Wait for hydration/animations, not just page load.** A screenshot taken
the instant `--screenshot` fires can catch a skeleton loader, an
un-hydrated SSR shell, or a mid-fade-in state. Give the page a beat
(`--virtual-time-budget=8000`+ for headless Chrome, or an explicit short
wait after `navigate` with `claude-in-chrome`) before capturing, and for
anything with scroll-triggered animations, scroll past the fold once first
so those have already fired.

**Full-page vs. viewport capture is a real decision, not a default.** A
full-page scrolling capture (e.g. `--screenshot` variants that capture the
whole scrollable height) shows a page's entire story in one image, but it
produces a very tall, narrow-looking image once scaled into a frame —
usually worse for a walkthrough than several viewport-sized screenshots at
natural scroll stops (hero, features section, pricing, footer/CTA) treated
as separate scenes. Reserve full-page capture for the rare scene that's
specifically *about* a page's total scroll story.

**Pick one viewport size and hold it for the whole tour.** Mixing a
1920x1080 capture with a 1366x768 one makes the finished browser-chrome
mockups look inconsistent — different relative UI scale, different
whitespace proportions. Decide desktop vs. mobile-responsive up front (ask
the user only if the site's target audience genuinely isn't obvious) and
capture every scene at that one size.

**Auth for web apps works the same as mobile — no demo mode, no
assumptions.** If a webapp needs login and there's no seeded demo account,
ask the user for real test credentials before attempting authenticated
screens, exactly like the mobile flow. Treat them the same way: never
written to a file, never echoed into narration/PDF/video content.

**`claude-in-chrome` over raw headless Chrome when the flow needs real
interaction.** Headless Chrome's `--screenshot` flag is fine for static
pages you can reach by URL alone. The moment the walkthrough needs to click
through a flow — log in, open a modal, advance a wizard, navigate an SPA's
client-side routes that don't have their own loadable URL — use the
`claude-in-chrome` MCP tools instead (`navigate`, `computer`, screenshot);
it's the web equivalent of driving the mobile app via `adb`.

## Phase 3 — Local TTS (Kokoro)

No API key, no per-generation cost, runs on CPU fine for short narration
clips. Setup:

```bash
brew install espeak-ng                      # phonemizer fallback dependency
uv venv --python 3.12 .venv                  # 3.12 — newer/older can break torch/spacy wheels
source .venv/bin/activate
uv pip install kokoro soundfile numpy
```

Check `~/.cache/huggingface/hub/models--hexgrad--Kokoro-82M` first — the
82M-param weights (~320MB) are often already cached from a prior run and
don't need re-downloading.

Voices (`voice=` in the pipeline call) must match the `lang_code` passed to
`KPipeline`:
- `lang_code="a"` (American): `af_bella`, `af_heart`, `af_nicole`, `af_sarah`, `am_adam`, `am_michael`
- `lang_code="b"` (British): `bf_emma`, `bf_isabella`, `bm_george`, `bm_lewis`

`speed=` on the pipeline call controls pace — 1.0 is natural, 1.15–1.25
reads as noticeably faster without sounding rushed or robotic.

**Measure real audio duration, don't estimate from word count for the final
cut.** Word-count-based pacing (~2.3 words/sec) is fine for a first-draft
scene-length guess, but for the actual render, generate the audio first,
measure `len(samples) / sample_rate`, and set each scene's on-screen
duration to `ceil(audio_seconds + ~1s buffer)`. Otherwise narration either
gets cut off or the scene lingers awkwardly after the voice stops.

**Content/image mismatch is the easiest bug to ship.** Double check every
scene's `image` field actually shows what the `narration` text describes.
It's easy to accidentally point a scene at the wrong screenshot (e.g. a tour
dialog when the narration is about the login screen) — this reads as "the
audio says the wrong thing" even though the audio itself is fine.

## Phase 4 — Remotion video

**`interpolate()` requires a strictly increasing input range**, even when
you want the *output* to decrease. Wrong: `interpolate(x, [24, 0], [0, 1])`
throws `inputRange must be strictly monotonically increasing`. Right:
`interpolate(x, [0, 24], [1, 0])` — swap which array encodes the direction.

**Google Fonts don't apply from a plain CSS string.** Setting
`fontFamily: "Outfit, sans-serif"` silently falls back to a system sans in
the headless Chrome render — there's no network fetch of the family the way
a browser tab would do it. Use `@remotion/google-fonts`:
```ts
import { loadFont } from "@remotion/google-fonts/Outfit";
const { fontFamily } = loadFont();
```
then use that returned `fontFamily` string, not a hardcoded one.

**Use the app's real logo, not an invented mark.** Find it in the app's
source (grep for `require(.*logo` / `require(.*Logo` across the app's
`app/`/`src/` directories to find which asset file is actually rendered in
the UI — there are often several similarly-named logo files in
`assets/`, e.g. a full lockup with a subtitle, a square launcher icon, a
legacy version; the one actually `require()`'d by a header/splash component
is the "current" one). If that logo is dark text on transparent (i.e.
designed to sit on a light background) and your scene background is the
brand's dark color, wrap it in a white rounded card/pill rather than
inventing a light-mode variant — cheap and looks intentional.

**Default to no motion beyond a plain crossfade.** The template's baseline
is: a scene fades in, holds static, fades out — no entrance springs, no
sliding text, no pan/zoom on the screenshot. This isn't just a Ken-Burns
call; even the "subtle" entrance-spring version (frame slides up 60px,
title slides up 24px and fades in) reads as fussy once you've got 6+ scenes
back to back. Only add motion back in if specifically requested, and start
with something small.

**`AbsoluteFill` hardcodes `width: 100%` — overriding only `left` on it
pushes content off-screen instead of narrowing it.** This is exactly the
kind of bug that doesn't error, just silently renders wrong: wrapping a
side-panel layout's "everything to the right of the sidebar" region in
`<AbsoluteFill style={{ left: 620, ... }}>` does NOT give you a 620px-to-
edge region. `AbsoluteFill`'s own style sets an explicit `width: '100%'`
(and `right: 0`) already; your `left: 620` override doesn't touch `width`,
so the element becomes 100%-of-parent wide *starting* at x=620 — meaning
its right edge lands 620px past the actual frame boundary, and everything
centered inside it (a "centered" browser-chrome mockup, in this case)
renders shifted right and clipped off the edge, while still looking
plausible enough in a quick glance to miss. Fix: don't use `AbsoluteFill`
for a partial-width region at all — use a plain `<div>` with
`position: "absolute", top: 0, left: 620, right: 0, bottom: 0`, which
correctly derives its width from the left/right offsets instead of
fighting a hardcoded one. Any time you override just one offset on an
`AbsoluteFill` (`left`, `right`, `top`, or `bottom`) without also touching
the matching size (`width`/`height`), check the actual rendered frame
before trusting it — don't assume centering math worked from reading the
JSX alone.

**Web-platform screenshots have an unpredictable aspect ratio — always
letterbox, never assume it fills the frame.** A mobile screenshot is always
roughly the same tall aspect ratio, but a web capture could be a 16:9
viewport, an ultrawide, or a very tall full-page scroll capture. Size the
browser-chrome frame to a fixed box and put the screenshot inside with
`object-fit: contain` (not `cover`, which would crop, and not letting the
image drive the frame's size, which is what actually broke the PDF version
of this — see Phase 5).

## Phase 5 — Styled PDF (HTML → headless Chrome print-to-pdf)

**Give every logical page its own explicitly-sized `<div class="page">`,
never one tall container relying on auto-pagination.** The failure mode:
stack N sections inside one div with `min-height: 297mm` per "page" and let
overflow flow to the next physical page. Chrome's print engine slices
wherever the physical page boundary falls, mid-content, and any
absolutely-positioned element (e.g. a footer anchored to the bottom of the
*logical* div) ends up rendered at the wrong physical location — floating
near the top of the *next* sliced page instead of the bottom of the
intended one.

Fix: one `.page` class, used once per logical page, with:
```css
.page { width: 210mm; height: 297mm; /* not min-height */
        overflow: hidden; page-break-after: always; page-break-inside: avoid; }
```
Each scene/section gets its own `.page` div. Verify page count after
generating — `pdfinfo file.pdf | grep Pages` (reliable); `mdls -name
kMDItemNumberOfPages file.pdf` also works but can return `(null)` on a
freshly-written file before Spotlight indexes it, which looks like failure
but isn't — don't trust a null result, re-check with `pdfinfo`. Page count
should equal cover + TOC + scene-count + closing exactly. If it's off by
even one, something overflowed — render suspect pages to PNG and look
(`pdftoppm -png -r 100 -f N -l N file.pdf out`) rather than guessing.

**A web-platform screenshot with an unconstrained-height frame will push
the copy text off the page.** The mobile phone-frame is narrow so this
never comes up, but a "browser frame sized to 100% width" for a web
screenshot inherits whatever height the image's aspect ratio implies — a
tall full-page capture can make the frame taller than the whole page,
shoving the title/body/bullets below it clean off the bottom (silently;
nothing errors, the PDF just renders wrong). Cap it: `max-height` on the
frame, `object-fit: contain` + `flex: 1; min-height: 0` on the `<img>`
inside a flex column, exactly like the video frame's fix above.

**Print command:**
```bash
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  --headless --disable-gpu --print-to-pdf="out.pdf" --print-to-pdf-no-header \
  --run-all-compositor-stages-before-draw --virtual-time-budget=15000 \
  "file://$(pwd)/doc.html"
```
`file://` image `src`s work fine from a `file://`-loaded HTML page — no
need to base64-inline screenshots.

## General

**Sub-agent scope creep.** A forked sub-agent inherits your *full*
conversation context, not just the narrow task you gave it. If you spawn one
with a small, specific ask (e.g. "just list the TTS voices") while a much
bigger plan is visible earlier in the transcript, it may go off and
continue that bigger plan unprompted — racing your own file writes. Either
give forks a task narrow enough that the surrounding context can't tempt
scope creep, or use a fresh (non-fork) agent when you specifically want it
to *not* see the rest of the plan.

**Ask before spending money.** TTS/image/video generation tools that bill
credits should be preflighted (`get_cost: true` where supported) and, if the
account is out of credits, surface that plainly and offer alternatives
(local open-source TTS, captions-only, user-recorded audio) rather than
pushing a purchase flow.
