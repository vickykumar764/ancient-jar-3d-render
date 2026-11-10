import React from "react";
import { Composition } from "remotion";
import { AncientJarShort, JAR_FRAMES } from "./videos/ancient-jar/Bridge";
import { MinimalTest } from "./minimal";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="AncientJar"
        component={AncientJarShort}
        durationInFrames={JAR_FRAMES}
        fps={30}
        width={1080}
        height={1920}
      />
      <Composition
        id="MinimalTest"
        component={MinimalTest}
        durationInFrames={30}
        fps={30}
        width={1080}
        height={1920}
      />
    </>
  );
};
