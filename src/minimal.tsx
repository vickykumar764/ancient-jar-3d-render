import React from "react";
import { AbsoluteFill } from "remotion";
import { ThreeCanvas } from "@remotion/three";
import { useFrame, useThree } from "@react-three/fiber";
import {
  EffectComposer as PPComposer,
  RenderPass,
  EffectPass,
  ToneMappingEffect,
} from "postprocessing";
import { ToneMappingMode } from "postprocessing";
import * as THREE from "three";

/** Final isolation probe (real renderStill path).
 *  The composer is created in a useState INITIALIZER (synchronous, during render),
 *  so it exists before ANY advance() — no useEffect ordering ambiguity.
 *  The useFrame (priority 1) renders the composer with a FIXED delta 0.016, then
 *  reads back the composer's inputBuffer centre pixel and paints the probe square:
 *    RED   = buffer blue (composer.render ran and filled the buffer)
 *    GREEN = buffer zeros (composer.render ran but filled nothing)
 *    BLUE  = useFrame never ran (square untouched, initial colour)
 *    CYAN  = useFrame threw (message on window.__useFrameError)
 *  The blue box is drawn ONLY by the composer, so the canvas shows blue iff the
 *  composer's screen output sticks. */
const flagRef: { current: HTMLDivElement | null } = { current: null };

function ManualComposer() {
  const { gl, scene, camera, size } = useThree();
  const [composer] = React.useState(() => {
    const c = new PPComposer(gl, {
      frameBufferType: THREE.UnsignedByteType,
      multisampling: 0,
    });
    c.addPass(new RenderPass(scene, camera));
    c.addPass(new EffectPass(camera, new ToneMappingEffect({ mode: ToneMappingMode.NEUTRAL })));
    c.setSize(size.width, size.height);
    return c;
  });
  React.useEffect(() => () => composer.dispose(), [composer]);
  useFrame((_, delta) => {
    try {
      // TEST: pass the REAL useFrame delta (huge on the first advance) instead of
      // the fixed 0.016. If the canvas goes green again, the huge delta is the culprit.
      composer.render(delta);
      const rt = composer.inputBuffer;
      const px = new Uint8Array(4);
      gl.readRenderTargetPixels(rt, Math.floor(rt.width / 2), Math.floor(rt.height / 2), 1, 1, px);
      if (flagRef.current) {
        flagRef.current.style.background = px[2] > 100 ? "#ff0000" : "#00ff00";
      }
    } catch (e: any) {
      (window as any).__useFrameError = String(e && e.message ? e.message : e);
      if (flagRef.current) flagRef.current.style.background = "#00ffff";
    }
  }, 1);
  return null;
}

export const MinimalTest: React.FC = () => {
  return (
    <AbsoluteFill style={{ background: "#00ff00" }}>
      <div
        ref={(el) => {
          flagRef.current = el;
        }}
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: 200,
          height: 200,
          background: "#0000ff",
          zIndex: 10,
        }}
      />
      <ThreeCanvas width={1080} height={1920} camera={{ fov: 40, near: 0.2, far: 1500 }}>
        <ambientLight intensity={1.2} />
        <directionalLight position={[5, 5, 5]} intensity={1} />
        <mesh position={[0, 0, 0]}>
          <boxGeometry args={[4, 4, 4]} />
          <meshStandardMaterial color="#0000ff" />
        </mesh>
        <ManualComposer />
      </ThreeCanvas>
    </AbsoluteFill>
  );
};
