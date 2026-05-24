/**
 * Project a world-space point through the camera to screen pixels.
 * Returns null if the point is off-screen (cheap early-out).
 */
import type { Camera } from 'three';
import { Vector3 } from 'three';

const v = new Vector3();

export function projectToScreen(
  worldX: number,
  worldY: number,
  camera: Camera,
  viewportWidth: number,
  viewportHeight: number,
): { x: number; y: number } | null {
  v.set(worldX, worldY, 0);
  v.project(camera);
  // v is now in NDC: [-1, 1] on each axis (and z).
  if (v.x < -1.4 || v.x > 1.4 || v.y < -1.4 || v.y > 1.4) return null;
  return {
    x: (v.x * 0.5 + 0.5) * viewportWidth,
    y: (1 - (v.y * 0.5 + 0.5)) * viewportHeight,
  };
}
