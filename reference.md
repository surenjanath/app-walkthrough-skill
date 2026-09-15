# App Walkthrough — technical reference

Detailed gotchas discovered building the first walkthrough (Assuria Loyalty,
an Expo/React Native app) end-to-end: emulator capture, local TTS, a Remotion
video, and a styled PDF. Read this before each phase below — every item here
cost real time to debug once.

## Phase 1 — Screen capture (Android emulator + adb)

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

**Keep motion subtle or off if asked.** A Ken Burns pan/zoom on every screen
reads as "busy" in a 15+ scene walkthrough; default to a static image in the
phone frame with just an entrance spring + text fade, and only add
pan/zoom back in if specifically requested.

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
generating: `mdls -name kMDItemNumberOfPages file.pdf` should equal
cover + TOC + scene-count + closing exactly. If it's off by even one,
something overflowed — render suspect pages to PNG and look
(`pdftoppm -png -r 100 -f N -l N file.pdf out`) rather than guessing.

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
