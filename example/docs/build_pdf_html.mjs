import { readFileSync, writeFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const script = JSON.parse(readFileSync(join(ROOT, "script.json"), "utf-8"));
const SCREENS = join(ROOT, "screenshots");

const B = script.brand;

// CUSTOMIZE: for each scene id in script.json, optionally provide a richer
// written kicker/body/bullets for the PDF (beyond the spoken narration).
// Any scene id left out just falls back to scene.narration as the body with
// no bullet list — so this can start as {} and be filled in per app.
const DETAILS = {
  intro: {
    kicker: "About this example",
    body: "Acme Rewards is a fictional demo app used to show exactly what the app-walkthrough skill produces: a narrated video and this matching PDF, both generated from the same script.json and a handful of screenshots.",
    bullets: [
      "Every screen here is a synthetic mockup — no real company's UI or data",
      "Same pipeline you'd run on a real app: capture, script, local TTS, Remotion video, styled PDF",
    ],
  },
  onboarding: {
    kicker: "First launch",
    body: "A short onboarding flow introduces the app's core idea before sign-in is required.",
    bullets: ["Skip is available at any point for returning users"],
  },
  signin: {
    kicker: "Authentication",
    body: "A lightweight sign-in screen: email, password, and a path to create an account for first-time users.",
    bullets: ["Forgot-password recovery available directly on the sign-in screen"],
  },
  home: {
    kicker: "Home tab",
    body: "The home tab renders the member's digital card with a live QR code and current tier.",
    bullets: ["Quick actions for the full-screen card and the partner scanner"],
  },
  browse: {
    kicker: "Offers tab",
    body: "A searchable, filterable directory of every active partner discount, with flagship partners pinned to the top.",
    bullets: ["Category filters: Dining, Travel, Wellness", "18 offers in this example"],
  },
  detail: {
    kicker: "Offer details",
    body: "Every offer opens into a detail screen spelling out the exact terms before a member commits to a visit.",
    bullets: ["Validity window, stackability, and a one-tap proof-at-counter action"],
  },
  settings: {
    kicker: "Settings tab",
    body: "Appearance, security, and account controls in one place.",
    bullets: ["Theme, password, biometric lock, log out"],
  },
  outro: {
    kicker: "Try it yourself",
    body: "Point the app-walkthrough skill at your own app to generate the real thing — see the skill's README for setup.",
    bullets: ["github.com — search this repo's name to find the skill source"],
  },
};

// CUSTOMIZE: path to the target app's real logo file (PNG/SVG with a
// transparent or light background — it renders inside a white pill badge,
// see .mark CSS below). Copy the app's actual logo asset into
// walkthrough/assets/logo.png and reference it here, e.g.:
//   const LOGO_PATH = join(ROOT, "assets", "logo.png");
const LOGO_PATH = join(ROOT, "assets", "logo.png");
const fmtDate = new Date().toLocaleDateString("en-US", {
  year: "numeric",
  month: "long",
  day: "numeric",
});

const sectionsHtml = script.scenes
  .map((scene, i) => {
    const d = DETAILS[scene.id] || {};
    const imgPath = scene.image ? join(SCREENS, scene.image) : null;
    const num = String(i + 1).padStart(2, "0");
    return `
  <div class="page section-page">
    <section class="scene ${i % 2 === 1 ? "reverse" : ""}">
      <div class="scene-media">
        ${
          imgPath
            ? `<div class="phone-frame"><img src="file://${imgPath}" /></div>`
            : `<div class="phone-frame placeholder"></div>`
        }
      </div>
      <div class="scene-copy">
        <div class="scene-num">${num} / ${String(script.scenes.length).padStart(2, "0")}</div>
        <div class="kicker">${d.kicker || scene.eyebrow}</div>
        <h2>${scene.title}</h2>
        <p class="lead">${d.body || scene.narration}</p>
        ${
          d.bullets
            ? `<ul>${d.bullets.map((b) => `<li>${b}</li>`).join("")}</ul>`
            : ""
        }
      </div>
    </section>
    <div class="footer-strip"><span>${script.appName}</span><span>${num} / ${String(script.scenes.length).padStart(2, "0")} — ${scene.title}</span></div>
  </div>`;
  })
  .join("\n");

const tocHtml = script.scenes
  .map((scene, i) => {
    const num = String(i + 1).padStart(2, "0");
    const d = DETAILS[scene.id] || {};
    return `<div class="toc-row"><span class="toc-num">${num}</span><span class="toc-title">${scene.title}</span><span class="toc-kicker">${d.kicker || scene.eyebrow}</span></div>`;
  })
  .join("\n");

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>${script.appName} — App Walkthrough</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&family=Manrope:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<style>
  :root {
    --primary: ${B.primary};
    --primary-light: ${B.primaryLight};
    --primary-dark: ${B.primaryDark};
    --gold: ${B.gold};
    --bg: ${B.bg};
    --surface: ${B.surface};
    --text: ${B.textPrimary};
    --text-secondary: ${B.textSecondary};
  }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body {
    font-family: 'Manrope', sans-serif;
    color: var(--text);
    background: var(--bg);
    font-size: 12.5px;
  }
  h1, h2, h3 { font-family: 'Outfit', sans-serif; margin: 0; }
  @page { size: A4; margin: 0; }

  .page { width: 210mm; height: 297mm; position: relative; page-break-after: always; page-break-inside: avoid; overflow: hidden; }
  .page:last-child { page-break-after: auto; }

  /* Cover */
  .cover {
    background: radial-gradient(circle at 50% 15%, var(--primary-light) 0%, var(--primary) 55%, var(--primary-dark) 100%);
    color: #fff;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
    padding: 40mm 20mm;
  }
  .mark {
    background: #fff; border-radius: 999px;
    padding: 7mm 14mm; margin-bottom: 14mm;
    box-shadow: 0 6px 18px -6px rgba(0,0,0,0.35);
    display: inline-flex;
  }
  .mark img { height: 12mm; display: block; }
  .mark.small { padding: 5mm 10mm; margin-bottom: 8mm; }
  .mark.small img { height: 8mm; }
  .cover .eyebrow {
    font-family: 'Manrope', sans-serif;
    font-weight: 700;
    letter-spacing: 4px;
    text-transform: uppercase;
    color: var(--gold);
    font-size: 12px;
    margin-bottom: 8mm;
  }
  .cover h1 {
    font-weight: 300;
    font-size: 46px;
    letter-spacing: -1px;
    line-height: 1.15;
    margin-bottom: 6mm;
  }
  .cover .tagline {
    font-size: 16px;
    color: rgba(255,255,255,0.85);
    font-weight: 500;
    margin-bottom: 26mm;
  }
  .cover .meta {
    font-size: 11px;
    color: rgba(255,255,255,0.6);
    letter-spacing: 1px;
  }
  .cover .divider { width: 48px; height: 2px; background: var(--gold); margin: 10mm 0; }

  /* TOC */
  .toc-page { padding: 26mm 22mm; background: var(--surface); }
  .toc-page .kicker-top {
    font-weight: 700; letter-spacing: 3px; text-transform: uppercase;
    color: var(--primary); font-size: 11px; margin-bottom: 4mm;
  }
  .toc-page h1 { font-size: 30px; font-weight: 500; color: var(--text); margin-bottom: 14mm; }
  .toc-row {
    display: flex; align-items: baseline; gap: 6mm;
    padding: 4.2mm 0; border-bottom: 1px solid #E5E7EB;
  }
  .toc-num { font-family: 'Outfit'; font-weight: 600; color: var(--gold); font-size: 13px; width: 10mm; }
  .toc-title { font-family: 'Outfit'; font-weight: 500; font-size: 14px; flex: 1; color: var(--text); }
  .toc-kicker { font-size: 10px; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 1px; }

  /* Section pages */
  .section-page { background: var(--surface); padding: 16mm 16mm; }
  .scene {
    display: flex;
    align-items: center;
    gap: 12mm;
    height: 265mm;
  }
  .scene.reverse { flex-direction: row-reverse; }
  .scene-media { flex: 0 0 68mm; display: flex; justify-content: center; }
  .phone-frame {
    width: 62mm;
    border-radius: 7mm;
    background: #0B0F0C;
    padding: 2.2mm;
    box-shadow: 0 10px 30px -8px rgba(18,32,24,0.4);
  }
  .phone-frame img { width: 100%; display: block; border-radius: 5.2mm; }
  .phone-frame.placeholder { height: 130mm; }

  .scene-copy { flex: 1; }
  .scene-num {
    font-family: 'Outfit'; font-weight: 600; color: var(--gold);
    font-size: 11px; letter-spacing: 1px; margin-bottom: 3mm;
  }
  .kicker {
    font-weight: 700; letter-spacing: 3px; text-transform: uppercase;
    color: var(--primary); font-size: 10.5px; margin-bottom: 3mm;
  }
  .scene-copy h2 { font-size: 24px; font-weight: 500; color: var(--text); margin-bottom: 5mm; line-height: 1.2; }
  .scene-copy .lead { font-size: 12.5px; line-height: 1.65; color: var(--text); margin-bottom: 5mm; }
  .scene-copy ul { margin: 0; padding-left: 4.5mm; }
  .scene-copy li { font-size: 11.5px; line-height: 1.55; color: var(--text-secondary); margin-bottom: 2mm; }
  .scene-copy li::marker { color: var(--gold); }

  /* Closing */
  .closing {
    background: radial-gradient(circle at 50% 85%, var(--primary-light) 0%, var(--primary) 55%, var(--primary-dark) 100%);
    color: #fff; display: flex; flex-direction: column; align-items: center;
    justify-content: center; text-align: center; padding: 40mm 24mm;
  }
  .closing h2 { font-size: 30px; font-weight: 300; margin-bottom: 6mm; }
  .closing p { font-size: 13px; color: rgba(255,255,255,0.8); max-width: 130mm; line-height: 1.7; }
  .closing .tag { color: var(--gold); font-weight: 600; letter-spacing: 2px; text-transform: uppercase; font-size: 11px; margin-top: 10mm; }

  .footer-strip {
    position: absolute; bottom: 10mm; left: 16mm; right: 16mm;
    display: flex; justify-content: space-between;
    font-size: 9px; color: var(--text-secondary); letter-spacing: 0.5px;
  }
</style>
</head>
<body>

  <div class="page cover">
    <div class="mark"><img src="file://${LOGO_PATH}" /></div>
    <div class="eyebrow">Complete App Walkthrough</div>
    <h1>${script.appName}</h1>
    <div class="tagline">${script.tagline}</div>
    <div class="divider"></div>
    <div class="meta">Feature Guide &amp; Screen-by-Screen Reference · ${fmtDate}</div>
  </div>

  <div class="page toc-page">
    <div class="kicker-top">Contents</div>
    <h1>Everything in this guide</h1>
    ${tocHtml}
    <div class="footer-strip"><span>${script.appName}</span><span>Page 2</span></div>
  </div>

  ${sectionsHtml}

  <div class="page closing">
    <div class="mark small"><img src="file://${LOGO_PATH}" /></div>
    <h2>Thank you</h2>
    <p>This guide covered every major screen in ${script.appName}, from first launch through everyday use — the digital card, the partner network, profile &amp; history, settings, and the offline-verifiable insurance pass.</p>
    <div class="tag">${script.tagline}</div>
  </div>

</body>
</html>`;

writeFileSync(join(ROOT, "docs", "walkthrough.html"), html);
console.log("wrote docs/walkthrough.html —", script.scenes.length, "sections");
