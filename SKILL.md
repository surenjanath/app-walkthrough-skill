---
name: app-walkthrough
description: Generate a narrated walkthrough video (Remotion) and a styled PDF feature guide for a mobile app, website, or web app, by capturing real screens from a running emulator/simulator/browser, writing a narration script, synthesizing local TTS voiceover, and rendering both deliverables. Use when the user asks for an app walkthrough, demo video, feature-guide video/PDF, product tour, or onboarding video — for a mobile app, a marketing website, or a SaaS/web app they're building.
arguments: [target]
---

Build a detailed app walkthrough as **two deliverables**: a narrated MP4
video and a styled PDF guide, both driven by one shared `script.json`. This
was built once end-to-end for a React Native/Expo app (see
`reference.md` in this skill directory for every gotcha hit along the way —
**read it now**, before starting; it will save real time). The approach
below is app-framework-agnostic (works for RN/Expo, Flutter, native, or even
a responsive web app captured in a browser) — adapt the capture mechanics to
whatever `$target` actually is.

If `$target` was given, treat it as a hint for which project/app to walk
through. If not, ask, or infer from the current working directory.

All work happens in a new `walkthrough/` directory at the project root —
never edit the app's own source.

## 0. Discover, then ask only what's genuinely unclear

First, decide **`platform`: `"mobile"` or `"web"`** — this drives everything
downstream (capture method, video orientation, PDF layout). Usually obvious
from the target: a React Native/Expo/Flutter/native app → `mobile`; a
website or a browser-based web app (Next.js, Rails, Django, a SPA, etc.) →
`web`. If genuinely ambiguous (e.g. an Expo app that also ships a web
build), ask.

Then spend a few tool calls learning the app before asking anything else:
- Find its design system (theme file, `design_guidelines.json`,
  Tailwind config, or similar) for brand colors and fonts.
- Find its real logo asset: grep the app's source for
  `require(.*[Ll]ogo` (RN) or `logo\.(svg|png)` / an `<img>`/`<Image>`
  referencing it (web), to find the file actually rendered in the UI, not
  just anything named `icon.png` in an assets folder.
- Find its screen/route list (`app/` for Expo Router or Next.js App Router,
  `src/screens`, `pages/`, etc.) to scope what a "full tour" covers.
- Check whether it needs a login and whether a demo/mock mode exists, or if
  it always talks to a live backend.
- Check available capture surfaces:
  - **mobile:** booted iOS simulator (`xcrun simctl list devices`), Android
    emulator AVDs (`emulator -list-avds`).
  - **web:** a local dev server (`npm run dev` / `next dev` / etc. — check
    `package.json` `scripts`) or an already-deployed URL. Prefer the dev
    server for anything gated behind auth or still in development.

Then ask (via AskUserQuestion, 2-4 options each, only what's ambiguous):
1. **Narration approach** — local TTS (Kokoro, free) vs. captions-only vs.
   user-recorded audio. Default to local TTS; only ask if you suspect the
   user wants something else.
2. **Screen capture method** — emulator/simulator vs. browser vs. existing
   screenshots, if more than one is plausible.
3. **Credentials**, if the app requires login and has no demo mode — ask
   the user for test credentials directly; never guess or fabricate them.
4. **Scope** — full app tour vs. one core flow, if the app is large.

Don't ask about things you can just decide sensibly (video orientation,
voice pick, exact scene count) — state the default you're going with in one
line and move on.

## 1. Set up the workspace

```bash
mkdir -p walkthrough/screenshots walkthrough/docs walkthrough/assets
```

Copy the app's real logo file into `walkthrough/assets/logo.png` now (used
by both the PDF and the video).

## 2. Capture screens

**Read `reference.md`'s capture-phase section for your platform before
doing this** — mobile's coordinate-scaling/Modal-touch-bounds issues and
web's cookie-banner/full-page-capture issues are each the single biggest
time sink if you hit them blind.

### Mobile (Android emulator shown; adapt for iOS simulator)

```bash
emulator -list-avds
emulator -avd <name> -no-snapshot &
adb wait-for-device
until [ "$(adb shell getprop sys.boot_completed | tr -d '\r')" = "1" ]; do sleep 2; done
adb shell settings put global window_animation_scale 0
adb shell settings put global transition_animation_scale 0
adb shell settings put global animator_duration_scale 0
adb install -r <path-to-apk>
adb shell monkey -p <package> -c android.intent.category.LAUNCHER 1
adb exec-out screencap -p > walkthrough/screenshots/NN_name.png
```

Log out / clear app data (`adb shell pm clear <package>`) and relaunch when
you need a true first-run state. When a tap doesn't do anything on a
clearly-visible button, don't just retry the same coordinates — see
reference.md's Modal-bounds section and switch to `uiautomator dump`
immediately rather than guessing repeatedly.

### Web (website or web app)

Prefer the `claude-in-chrome` MCP tools when available — they give you
real interaction (click, fill forms, log in, navigate an SPA's client-side
routes) the same way the mobile flow uses `adb`, not just static
screenshots:
1. `tabs_context_mcp` / `tabs_create_mcp` to open a tab at the dev server or
   deployed URL.
2. `navigate` / `computer` to click through to each screen worth showing;
   dismiss cookie/consent banners first (see reference.md — they ruin a
   screenshot if left up).
3. Capture each screen — prefer a **viewport-sized** screenshot
   (matches what a visitor actually sees first) over a full-page scroll
   capture unless a specific scene is explicitly about a long page (e.g. a
   pricing page or a landing page's full scroll story).

Without `claude-in-chrome` (static pages, or scripting is simpler), headless
Chrome works directly:
```bash
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  --headless --disable-gpu --window-size=1920,1080 \
  --screenshot="walkthrough/screenshots/NN_name.png" \
  --virtual-time-budget=8000 --run-all-compositor-stages-before-draw \
  "https://the-url-or-localhost:port/route"
```
Pick a `--window-size` and stick to it for every screen in the tour —
mixed viewport sizes look inconsistent once framed in the browser-chrome
mockup. 1920x1080 (desktop) is the sensible default; use a narrower size
(e.g. 390x844) instead if the walkthrough is specifically about the site's
*mobile-responsive* view.

Number screenshots in narrative order (`01_`, `02_`, ...) either way, so
they sort naturally. Capture: the homepage/landing, sign-in or onboarding if
present, the main authenticated views, key feature/detail pages, and
settings/account.

## 3. Write `walkthrough/script.json`

This is the single source of truth for both deliverables. Shape it like
`${CLAUDE_SKILL_DIR}/assets/script.example.json` for a mobile app, or
`${CLAUDE_SKILL_DIR}/assets/script.web.example.json` for a website/web app
(read the one matching your `platform` now):

```jsonc
{
  "appName": "...",
  "tagline": "...",
  "platform": "mobile",   // or "web" — omit for mobile, the default
  "brand": { "primary": "#...", "primaryLight": "#...", "primaryDark": "#...",
             "gold": "#...", "silver": "#...", "platinum": "#...",
             "bg": "#...", "surface": "#...",
             "textPrimary": "#...", "textSecondary": "#...", "success": "#..." },
  "scenes": [
    { "id": "intro", "image": null, "eyebrow": "...", "title": "...",
      "narration": "1-3 spoken sentences.", "seconds": 12 },
    { "id": "some-screen", "image": "05_screen.png", "eyebrow": "...",
      "title": "...", "narration": "...", "seconds": 12,
      "url": "example.com/route" }  // web only — shown in the browser chrome bar
  ]
}
```

`platform` determines both deliverables' layout automatically — nothing
else to configure: the video renders vertical 1080x1920 with a phone-bezel
frame for `mobile`, or landscape 1920x1080 with a browser-chrome frame
(traffic-light dots + optional `url` pill) for `web`; the PDF switches
between a narrow phone frame beside the copy (`mobile`) and a wide
browser-chrome frame stacked above the copy (`web`) the same way.

Pull `brand` colors from the app's real design tokens found in step 0, not
invented ones. Write narration in the app's actual voice/tone (check for a
style doc; otherwise match the copy tone already visible in the app's UI).
`seconds` is just a rough starting estimate (~2.3 words/sec + 1s) — it gets
overwritten with real measured audio duration in step 4. **Double-check
every scene's `image` actually shows what its `narration` describes** —
this is the easiest mismatch to ship (see reference.md).

`id` is also the audio filename stem and the video's internal Sequence
key — keep it a short kebab-case slug.

## 4. Generate narration audio (local TTS)

Copy the template and run it:
```bash
cp "${CLAUDE_SKILL_DIR}/assets/audio/generate_audio.py" walkthrough/generate_audio.py
brew install espeak-ng   # if not already installed
uv venv --python 3.12 walkthrough/.venv
source walkthrough/.venv/bin/activate
uv pip install kokoro soundfile numpy
```
Edit `VOICE`/`SPEED`/`lang_code` at the top of `generate_audio.py` per
reference.md's voice table (match the app's tone — e.g. a mature/premium
brand suits a lower, unhurried voice). Then:
```bash
cd walkthrough && python generate_audio.py
```
This writes `walkthrough/video/public/audio/<id>.mp3`,
`walkthrough/video/src/audioManifest.json`, and
`walkthrough/audioDurations.json` (measured real durations).

If the user asked for captions-only or user-recorded audio instead, skip
this step accordingly (captions-only: skip `<Audio>` in the video, add an
on-screen caption bar instead; user-recorded: ask them to drop files at
`walkthrough/video/public/audio/<id>.mp3` matching each scene id).

## 5. Build and render the video (Remotion)

```bash
mkdir -p walkthrough/video/src walkthrough/video/public/screens
cp -r "${CLAUDE_SKILL_DIR}/assets/video-template/." walkthrough/video/
cp walkthrough/screenshots/*.png walkthrough/video/public/screens/
cp walkthrough/assets/logo.png walkthrough/video/public/logo.png
cd walkthrough/video && npm install
node scripts/genScenes.mjs          # generates src/scenes.ts from ../script.json
```
After audio exists, sync real durations into `src/scenes.ts`:
```bash
node scripts/applyDurations.mjs
```
Customize before rendering:
- `src/fonts.ts` — swap in the app's actual heading/body Google Fonts.
- `src/Scene.tsx` — the phone-frame mockup (mobile) / browser-chrome mockup
  (web) + title-card components; already generic (reads `BRAND`/logo/
  `PLATFORM`/dimensions from generated `scenes.ts` + `public/logo.png`, and
  `Walkthrough.tsx` picks the right layout automatically from `PLATFORM`).
  Only touch this if the app's layout needs something the template doesn't
  cover. **No pan/zoom by default** — only add motion back if asked.

Test-compile before the full render (cheap, catches typos fast):
```bash
npx remotion render src/index.ts Walkthrough out/test.mp4 --frames=0-2
```
Then the real render:
```bash
npx remotion render src/index.ts Walkthrough out/walkthrough.mp4
```
Pull a few frames with `ffmpeg -ss <t> -i out/walkthrough.mp4 -frames:v 1 ...`
and `Read` them to sanity-check fonts/logo/content before calling it done.

## 6. Build the PDF

```bash
cp "${CLAUDE_SKILL_DIR}/assets/docs/build_pdf_html.mjs" walkthrough/docs/build_pdf_html.mjs
```
Open it and fill in the `DETAILS` object (currently `{}`) with a richer
written `kicker`/`body`/`bullets` per scene id — this is what makes the PDF
read as a proper guide rather than a narration transcript. Any scene left
out of `DETAILS` just falls back to using `narration` as the body, which is
fine for less important scenes.

```bash
cd walkthrough && node docs/build_pdf_html.mjs
cd docs
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  --headless --disable-gpu --print-to-pdf="walkthrough.pdf" --print-to-pdf-no-header \
  --run-all-compositor-stages-before-draw --virtual-time-budget=15000 \
  "file://$(pwd)/walkthrough.html"
```
Verify page count matches expectations
(`mdls -name kMDItemNumberOfPages walkthrough.pdf`) — see reference.md if
it's off. Render a couple of pages to PNG and `Read` them to check layout
before finishing (`pdftoppm -png -r 100 -f N -l N walkthrough.pdf out`).

## 7. Wrap up

- Kill any emulator/simulator you booted.
- Delete test/throwaway files (`out/test.mp4`, stray `.png` previews).
- Report final paths for both deliverables, total video duration, PDF page
  count, and **explicitly flag if any captured screen contains real user
  PII** (logged-in account details) before the user shares either file
  externally.

## Iterating afterward

Both deliverables regenerate from the same edit points:
- Change copy/timing → edit `walkthrough/script.json` → re-run
  `node scripts/genScenes.mjs` (+ `applyDurations.mjs` if audio changed) →
  re-render video; re-run `build_pdf_html.mjs` → reprint PDF.
- Change voice/pace → edit `generate_audio.py` → re-run → re-sync durations
  → re-render video.
- Live-preview the video while iterating: `npx remotion studio src/index.ts`.
