# app-walkthrough

A [Claude Code](https://claude.com/claude-code) skill that turns a mobile or
web app into a **narrated walkthrough video** and a **matching styled PDF
guide** — by actually capturing real screens from a running
emulator/simulator/browser, writing narration, synthesizing local
text-to-speech, and rendering both deliverables end to end.

No cloud TTS bill, no manual screen recording, no slide deck. Point it at an
app and it does the whole pipeline: capture → script → voiceover → video →
PDF.

## What you get

<p align="center">
  <img src="example/docs/preview/cover.png" width="45%" alt="Sample PDF cover" />
  <img src="example/docs/preview/scene.png" width="45%" alt="Sample PDF scene page" />
</p>

<p align="center">
  <video src="example/video/out/walkthrough.mp4" controls width="320"></video>
  <br/><sub>The matching ~85s narrated video (click to play)</sub>
</p>

A short narrated MP4 (phone-frame mockups of the real screens, brand-colored
title cards, synced voiceover) and a styled multi-page PDF (cover, table of
contents, one page per screen with a write-up, closing page) — both built
from one shared `script.json` so they never drift out of sync with each
other.

**[`example/`](example/)** is a complete, real run of the pipeline against a
small fictional demo app ("Acme Rewards" — synthetic mockup screens, not a
real product) so you can see exactly what the output looks like before
running it on your own app:
- [`example/video/out/walkthrough.mp4`](example/video/out/walkthrough.mp4) — the rendered video (~85s)
- [`example/docs/walkthrough.pdf`](example/docs/walkthrough.pdf) — the rendered PDF (11 pages)
- [`example/script.json`](example/script.json) — the source script driving both

## Install

```bash
git clone https://github.com/surenjanath/app-walkthrough-skill.git ~/.claude/skills/app-walkthrough
```

That's it — Claude Code picks up skills from `~/.claude/skills/<name>/SKILL.md`
automatically. (For a single project instead of every project, clone into
`<project>/.claude/skills/app-walkthrough` instead.)

## Use it

Just ask, in Claude Code, inside the app's project:

> "Can you make a walkthrough video and PDF for this app?"

Claude will read `SKILL.md`, ask you a few quick questions where it
genuinely needs input (how to capture screens, whether the app needs test
credentials, narration approach), then run the full pipeline. You can also
invoke it explicitly with `/app-walkthrough`.

## Requirements

The skill checks for these itself and will tell you what's missing, but for
reference:
- **Screen capture:** Android SDK platform-tools (`adb`) + an emulator AVD,
  or Xcode Simulator, or a browser (for a web app)
- **Local TTS:** [`uv`](https://github.com/astral-sh/uv) (for a throwaway
  Python venv), [`espeak-ng`](https://github.com/espeak-ng/espeak-ng)
  (`brew install espeak-ng`) — [Kokoro](https://github.com/hexgrad/kokoro)
  itself installs into the venv, no API key
- **Video:** Node.js, [Remotion](https://www.remotion.dev/) (installed via
  npm into the generated project, not this repo)
- **PDF:** Google Chrome (used headless for `--print-to-pdf`)
- `ffmpeg` for audio format conversion

## What's inside this repo

```
SKILL.md          the playbook Claude follows — read this to see the whole process
reference.md      hard-won gotchas from building this (adb coordinate math, a React
                   Native Modal touch-bounds bug, Remotion interpolate() pitfalls,
                   Chrome print-to-pdf pagination, Kokoro setup, and more)
assets/
  script.example.json   the script.json shape both deliverables are generated from
  audio/                Kokoro narration generator
  docs/                 the PDF HTML generator (headless-Chrome print-to-pdf)
  video-template/       a ready-to-copy Remotion project (phone-frame mockup,
                         brand-badge logo, synced voiceover, no motion by default)
example/           a full real run of the pipeline against a synthetic demo app
```

## Why this exists

Built by actually doing this once, live, for a real app — hitting (and
writing down) every gotcha along the way rather than guessing at a generic
process. `reference.md` is the part worth reading even if you never run
Claude Code — it's a real account of what breaks when you drive a React
Native app via `adb`, why `interpolate()` throws in Remotion, and why a
naive HTML→PDF pagination silently corrupts page layout.

## License

MIT — see [LICENSE](LICENSE). Use it, fork it, improve it, send a PR.
