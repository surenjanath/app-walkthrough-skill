import React from "react";
import {
  AbsoluteFill,
  Img,
  Audio,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
} from "remotion";
import type { Scene as SceneType } from "./scenes";
import { BRAND } from "./scenes";
import { OUTFIT, MANROPE } from "./fonts";

const FADE_FRAMES = 15;

function useFade(durationInFrames: number) {
  const frame = useCurrentFrame();
  return interpolate(
    frame,
    [0, FADE_FRAMES, durationInFrames - FADE_FRAMES, durationInFrames],
    [0, 1, 1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );
}

// The app's real wordmark (frontend/assets/full_new_logo.png) is dark-green
// text on transparent, so it needs a light card behind it to read on our
// dark-green scenes.
const LogoBadge: React.FC<{ width?: number; padding?: number }> = ({
  width = 220,
  padding = 18,
}) => (
  <div
    style={{
      backgroundColor: "#FFFFFF",
      borderRadius: 999,
      padding: `${padding * 0.55}px ${padding}px`,
      boxShadow: "0 10px 24px -8px rgba(0,0,0,0.35)",
      display: "inline-flex",
    }}
  >
    <Img src={staticFile("logo.png")} style={{ width, display: "block" }} />
  </div>
);

const hasAudio = (id: string) => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const manifest = require("./audioManifest.json");
    return Boolean(manifest[id]);
  } catch {
    return false;
  }
};

export const TitleCard: React.FC<{
  scene: SceneType;
  durationInFrames: number;
}> = ({ scene, durationInFrames }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const opacity = useFade(durationInFrames);
  const rise = spring({ frame, fps, from: 30, to: 0, durationInFrames: 40 });
  const audioAvailable = hasAudio(scene.id);

  return (
    <AbsoluteFill
      style={{
        backgroundColor: BRAND.primary,
        backgroundImage: `radial-gradient(circle at 50% 20%, ${BRAND.primaryLight} 0%, ${BRAND.primary} 55%, ${BRAND.primaryDark} 100%)`,
        justifyContent: "center",
        alignItems: "center",
        opacity,
      }}
    >
      {audioAvailable ? <Audio src={staticFile(`audio/${scene.id}.mp3`)} /> : null}
      <div
        style={{
          transform: `translateY(${rise}px)`,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 36,
        }}
      >
        <LogoBadge width={260} padding={26} />
        <div
          style={{
            fontFamily: OUTFIT,
            fontWeight: 300,
            fontSize: 72,
            letterSpacing: -1,
            color: "#FFFFFF",
            textAlign: "center",
            paddingLeft: 80,
            paddingRight: 80,
          }}
        >
          {scene.title}
        </div>
        <div
          style={{
            fontFamily: MANROPE,
            fontWeight: 600,
            fontSize: 28,
            color: BRAND.gold,
            letterSpacing: 3,
            textTransform: "uppercase",
            textAlign: "center",
          }}
        >
          {scene.eyebrow}
        </div>
      </div>
    </AbsoluteFill>
  );
};

export const ScreenShowcase: React.FC<{
  scene: SceneType;
  durationInFrames: number;
  index: number;
}> = ({ scene, durationInFrames }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const opacity = useFade(durationInFrames);
  const audioAvailable = hasAudio(scene.id);

  const enter = spring({ frame, fps, from: 60, to: 0, durationInFrames: 35 });
  const textIn = spring({
    frame: frame - 8,
    fps,
    from: 24,
    to: 0,
    durationInFrames: 30,
  });

  return (
    <AbsoluteFill style={{ backgroundColor: BRAND.bg, opacity }}>
      {audioAvailable ? <Audio src={staticFile(`audio/${scene.id}.mp3`)} /> : null}

      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: 260,
          background: `linear-gradient(135deg, ${BRAND.primary} 0%, ${BRAND.primaryLight} 100%)`,
        }}
      />

      <AbsoluteFill
        style={{ justifyContent: "flex-start", alignItems: "center", paddingTop: 56 }}
      >
        <div
          style={{
            transform: `translateY(${textIn}px)`,
            opacity: interpolate(textIn, [0, 24], [1, 0]),
          }}
        >
          <LogoBadge width={128} padding={12} />
        </div>

        <div
          style={{
            marginTop: 20,
            fontFamily: MANROPE,
            fontWeight: 700,
            fontSize: 18,
            letterSpacing: 3,
            color: BRAND.gold,
            textTransform: "uppercase",
            transform: `translateY(${textIn}px)`,
            opacity: interpolate(textIn, [0, 24], [1, 0]),
          }}
        >
          {scene.eyebrow}
        </div>

        <div
          style={{
            marginTop: 14,
            fontFamily: OUTFIT,
            fontWeight: 500,
            fontSize: 44,
            color: "#FFFFFF",
            textAlign: "center",
            paddingLeft: 70,
            paddingRight: 70,
            transform: `translateY(${textIn}px)`,
            opacity: interpolate(textIn, [0, 24], [1, 0]),
          }}
        >
          {scene.title}
        </div>

        <div
          style={{
            marginTop: 36,
            width: 620,
            height: 1330,
            borderRadius: 56,
            backgroundColor: "#0B0F0C",
            padding: 14,
            boxShadow: "0 40px 80px -20px rgba(18,32,24,0.55)",
            transform: `translateY(${enter}px)`,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              width: "100%",
              height: "100%",
              borderRadius: 44,
              overflow: "hidden",
              backgroundColor: "#fff",
              position: "relative",
            }}
          >
            {scene.image ? (
              <Img
                src={staticFile(`screens/${scene.image}`)}
                style={{ width: "100%", display: "block" }}
              />
            ) : null}
          </div>
        </div>
      </AbsoluteFill>

      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          height: 170,
          background: `linear-gradient(0deg, ${BRAND.bg} 40%, rgba(248,249,250,0))`,
        }}
      />
    </AbsoluteFill>
  );
};
