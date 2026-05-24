'use client';

/**
 * Atlas camera — orthographic, with spring-damped pan/zoom.
 *
 * Why orthographic: text labels stay readable at any zoom. Perspective
 * causes parallax that fights the "Apple Maps" feel for a flat knowledge
 * graph. Depth comes from postprocessing (bloom, blur on out-of-focus),
 * not foreshortening.
 *
 * The camera mutates its own position/zoom directly inside useFrame —
 * never via React state. The store's camera slice is a *projection* read
 * by overlays, written once per frame from the imperative camera.
 */
import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import type { OrthographicCamera } from 'three';
import { graphStore } from '../store/graphStore';

export interface CameraTargets {
  x: number;
  y: number;
  zoom: number;
}

/**
 * Critical-ish damping toward a target. Frame-rate independent.
 *
 * dt is in seconds. λ controls "half-life" — higher = snappier.
 */
function damp(current: number, target: number, lambda: number, dt: number): number {
  return current + (target - current) * (1 - Math.exp(-lambda * dt));
}

interface SpatialCameraProps {
  /** Bounds for clamping zoom. */
  minZoom?: number;
  maxZoom?: number;
}

export function SpatialCamera({
  minZoom = 0.12,
  maxZoom = 4,
}: SpatialCameraProps) {
  const { camera, size } = useThree();
  const targetRef = useRef<CameraTargets>({ x: 0, y: 0, zoom: 1 });

  // Cast: we configure as orthographic below.
  const ortho = camera as OrthographicCamera;

  // Configure ortho frustum to viewport. Re-runs on resize.
  useEffect(() => {
    ortho.left = -size.width;
    ortho.right = size.width;
    ortho.top = size.height;
    ortho.bottom = -size.height;
    ortho.near = -1000;
    ortho.far = 1000;
    ortho.position.z = 10;
    ortho.updateProjectionMatrix();
  }, [size.width, size.height, ortho]);

  // Expose targets to gesture handlers via a stable side-channel on the
  // camera instance. We deliberately do NOT call `setThree({ camera })`
  // here — it would re-trigger R3F's event-system installation every
  // mount and, with React 19's dev error path, can surface as a cyclic
  // object reference when React tries to inspect the new state.
  useEffect(() => {
    (ortho as unknown as { __atlasTargets: CameraTargets }).__atlasTargets = targetRef.current;
  }, [ortho]);

  useFrame((_, dt) => {
    const t = targetRef.current;
    // Critically damp position and zoom each frame. λ tuned for "snappy
    // but not jittery" feel — roughly matches the standard spring preset.
    ortho.position.x = damp(ortho.position.x, t.x, 14, dt);
    ortho.position.y = damp(ortho.position.y, t.y, 14, dt);

    const targetZoom = Math.max(minZoom, Math.min(maxZoom, t.zoom));
    if (Math.abs(ortho.zoom - targetZoom) > 0.0005) {
      ortho.zoom = damp(ortho.zoom, targetZoom, 14, dt);
      ortho.updateProjectionMatrix();
    }

    // Project to store (read by overlays). Only commit if changed enough
    // — Zustand selectors won't fire if values are identical.
    const cur = graphStore.getState().camera;
    if (
      Math.abs(cur.x - ortho.position.x) > 0.5 ||
      Math.abs(cur.y - ortho.position.y) > 0.5 ||
      Math.abs(cur.zoom - ortho.zoom) > 0.002
    ) {
      graphStore.getState().setCamera({
        x: ortho.position.x,
        y: ortho.position.y,
        zoom: ortho.zoom,
      });
    }
  });

  return null;
}

/**
 * Read the current camera targets from an externally-held camera.
 * Returns null if the camera hasn't been initialized yet.
 */
export function getCameraTargets(camera: OrthographicCamera): CameraTargets | null {
  return (camera as unknown as { __atlasTargets?: CameraTargets }).__atlasTargets ?? null;
}
