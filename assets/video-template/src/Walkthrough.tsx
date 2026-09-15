import React from "react";
import { Sequence, AbsoluteFill } from "remotion";
import { scenes, FPS, Scene, BRAND } from "./scenes";
import { TitleCard, ScreenShowcase } from "./Scene";

export const Walkthrough: React.FC<{ scenes: Scene[] }> = ({
  scenes: sceneList,
}) => {
  let startFrame = 0;
  const items: { scene: Scene; start: number; duration: number; index: number }[] =
    [];

  sceneList.forEach((scene, index) => {
    const duration = Math.round(scene.seconds * FPS);
    items.push({ scene, start: startFrame, duration, index });
    startFrame += duration;
  });

  return (
    <AbsoluteFill style={{ backgroundColor: BRAND.bg }}>
      {items.map(({ scene, start, duration, index }) => (
        <Sequence key={scene.id} from={start} durationInFrames={duration}>
          {scene.id === "intro" || scene.id === "outro" ? (
            <TitleCard scene={scene} durationInFrames={duration} />
          ) : (
            <ScreenShowcase scene={scene} durationInFrames={duration} index={index} />
          )}
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};

export { scenes };
