/**
 * The 3D Scene: assembles every era-reactive subsystem, owns the bounded
 * OrbitControls, the scene fog, the era runtime ref, WebGL context-loss
 * handling, and the ambience audio bed update.
 */

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, AdaptiveDpr } from "@react-three/drei";
import { useEffect, useRef } from "react";
import * as THREE from "three";
import { useAppStore } from "../state/store";
import { useEraRuntime } from "../runtime/useEraRuntime";
import { eraState } from "../runtime/eraState";
import { audioEngine } from "../audio/AudioEngine";
import { ERAS } from "../data/eras";
import type { InterpolatedEra } from "../utils/interp";

import { SkyAndLights } from "./SkyAndLights";
import { Ground, LaneDashes } from "./Ground";
import { Buildings, WindowStrips } from "./Buildings";
import { Vehicles } from "./Vehicles";
import { Pedestrians } from "./Pedestrians";
import { StreetFurniture } from "./StreetFurniture";
import { Billboards } from "./Billboards";
import { SkyTraffic } from "./SkyTraffic";
import { PostFx } from "./PostFx";

type RuntimeRef = React.RefObject<{ era: InterpolatedEra; clock: number }>;

/**
 * Per-frame fog + ambience updater. Fog color tracks the interpolated sky fog
 * so distant geometry melts into the haze; the audio ambience bed is retargeted
 * whenever the dominant era changes.
 */
function FogAndAmbience({ rt }: { rt: RuntimeRef }) {
  // Select stable primitives only (never return a new object from the selector).
  const scene = useThree((s) => s.scene);
  const lastAmbienceEra = useRef(-1);

  useFrame(() => {
    const e = rt.current.era;
    if (scene.fog instanceof THREE.Fog) {
      scene.fog.color.copy(e.fog);
    }
    // retarget ambience when the dominant era flips
    const dominant = Math.round(eraState.eraFloat);
    if (dominant !== lastAmbienceEra.current) {
      lastAmbienceEra.current = dominant;
      const clamped = Math.max(0, Math.min(ERAS.length - 1, dominant));
      const started = useAppStore.getState().audioStarted;
      const enabled = useAppStore.getState().audioEnabled;
      if (started && enabled) {
        audioEngine.setAmbience(ERAS[clamped]!.sfx);
      }
    }
  });

  return null;
}

/** Watches for WebGL context loss and reports it to the store. */
function ContextLossWatcher({ onLoss }: { onLoss: () => void }) {
  const gl = useThree((s) => s.gl);
  useEffect(() => {
    const canvas = gl.domElement;
    const handler = () => onLoss();
    canvas.addEventListener("webglcontextlost", handler);
    return () => canvas.removeEventListener("webglcontextlost", handler);
  }, [gl, onLoss]);
  return null;
}

/** Inner scene mounted inside <Canvas>. */
function SceneInternals() {
  const rt = useEraRuntime();
  const setContextLost = useAppStore((s) => s.setContextLost);

  return (
    <>
      <SkyAndLights rt={rt} />
      <Ground rt={rt} />
      <LaneDashes rt={rt} />
      <Buildings rt={rt} />
      <WindowStrips rt={rt} />
      <Billboards rt={rt} />
      <StreetFurniture rt={rt} />
      <Vehicles rt={rt} />
      <Pedestrians rt={rt} />
      <SkyTraffic rt={rt} />
      <PostFx rt={rt} />
      <FogAndAmbience rt={rt} />
      <ContextLossWatcher onLoss={() => setContextLost(true)} />
    </>
  );
}

export interface SceneProps {
  /** called once the canvas + first frame are ready */
  onReady?: () => void;
  /** receives a function that resets the camera to the default view */
  resetViewRef?: React.MutableRefObject<() => void>;
}

export function Scene({ onReady, resetViewRef }: SceneProps) {
  const setStatus = useAppStore((s) => s.setStatus);
  const setError = useAppStore((s) => s.setError);

  return (
    <Canvas
      // Continuous loop: this scene always animates (era sweep, traffic, SFX).
      frameloop="always"
      shadows
      dpr={[1, 1.75]}
      gl={{
        antialias: true,
        powerPreference: "high-performance",
        alpha: false,
        stencil: false,
      }}
      camera={{ position: [70, 48, 70], fov: 50, near: 0.5, far: 600 }}
      onCreated={({ gl, scene }) => {
        gl.shadowMap.type = THREE.PCFSoftShadowMap;
        gl.toneMapping = THREE.ACESFilmicToneMapping;
        gl.toneMappingExposure = 1.0;
        scene.fog = new THREE.Fog(new THREE.Color("#c8dae8"), 60, 320);
        try {
          setStatus("ready");
          onReady?.();
        } catch (e) {
          setError("init-failed", String(e instanceof Error ? e.message : e));
        }
      }}
      onError={(e) => {
        setError("webgl-error", String(e instanceof Error ? e.message : "render error"));
      }}
    >
      <AdaptiveDpr pixelated={false} />
      <SceneInternals />
      <BoundedControls resetViewRef={resetViewRef} />
    </Canvas>
  );
}

/** Default camera position for the reset action. */
const DEFAULT_CAM_POS: [number, number, number] = [70, 48, 70];
const DEFAULT_TARGET: [number, number, number] = [0, 6, 0];

/**
 * OrbitControls with bounded distance + polar angle so the camera can never
 * escape the scene. Exposes a reset action via the provided ref.
 */
function BoundedControls({
  resetViewRef,
}: {
  resetViewRef?: React.MutableRefObject<() => void>;
}) {
  const controls = useRef<React.ComponentRef<typeof OrbitControls>>(null);
  const camera = useThree((s) => s.camera);

  useEffect(() => {
    const reset = () => {
      const c = controls.current;
      if (!c) return;
      camera.position.set(...DEFAULT_CAM_POS);
      c.target.set(...DEFAULT_TARGET);
      c.update();
    };
    if (resetViewRef) {
      resetViewRef.current = reset;
    }
    if (controls.current) {
      controls.current.target.set(...DEFAULT_TARGET);
    }
    return () => {
      if (resetViewRef) resetViewRef.current = () => {};
    };
  }, [camera, resetViewRef]);

  return (
    <OrbitControls
      ref={controls}
      makeDefault
      enableDamping
      dampingFactor={0.08}
      minDistance={20}
      maxDistance={180}
      maxPolarAngle={Math.PI * 0.49}
      minPolarAngle={Math.PI * 0.08}
      screenSpacePanning={false}
      target={DEFAULT_TARGET}
    />
  );
}
