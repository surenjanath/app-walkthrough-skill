import React from "react";
import { Composition } from "remotion";
import { Walkthrough } from "./Walkthrough";
import { FPS, scenes, totalSeconds } from "./scenes";

export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="Walkthrough"
      component={Walkthrough}
      durationInFrames={Math.round(totalSeconds * FPS)}
      fps={FPS}
      width={1080}
      height={1920}
      defaultProps={{ scenes }}
    />
  );
};
