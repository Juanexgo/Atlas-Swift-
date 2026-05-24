'use client';

/**
 * Pan/zoom gesture handler. Hangs off the canvas root element.
 *
 * Inputs:
 *   - wheel: pan (deltaX/Y), or zoom if ctrlKey is held (trackpad pinch
 *     fires wheel events with ctrlKey on macOS/Windows).
 *   - drag with space held OR middle button: pan.
 *   - pinch gesture (touch): zoom.
 *
 * Zoom is exponential, anchored to the cursor position so the point under
 * the cursor stays put — the Figma/Maps behavior.
 */
import { useEffect } from 'react';
import { useThree } from '@react-three/fiber';
import { OrthographicCamera, Vector2 } from 'three';
import { getCameraTargets } from './SpatialCamera';

export interface CameraControlsOptions {
  /** Disable controls (e.g., when an overlay owns the input). */
  disabled?: boolean;
  minZoom?: number;
  maxZoom?: number;
  /** Zoom sensitivity multiplier. */
  zoomSpeed?: number;
}

export function useCameraControls({
  disabled = false,
  minZoom = 0.12,
  maxZoom = 4,
  zoomSpeed = 1,
}: CameraControlsOptions = {}) {
  const { gl, camera, size } = useThree();

  useEffect(() => {
    if (disabled) return;
    const dom = gl.domElement;
    const ortho = camera as OrthographicCamera;

    let spaceDown = false;
    let dragging = false;
    let lastPointer: Vector2 | null = null;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !e.repeat) {
        spaceDown = true;
        dom.style.cursor = 'grab';
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        spaceDown = false;
        dom.style.cursor = '';
      }
    };

    /**
     * Convert a screen-pixel delta into a world-space delta given current zoom.
     * One screen pixel = (1 / zoom) world units (for our ortho config).
     */
    const screenToWorld = (dx: number, dy: number): [number, number] => {
      return [dx / ortho.zoom, -dy / ortho.zoom];
    };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const targets = getCameraTargets(ortho);
      if (!targets) return;

      // ctrlKey set => pinch-zoom on macOS trackpad / ctrl+wheel
      if (e.ctrlKey || e.metaKey) {
        // Zoom around cursor. deltaY > 0 means "pinch in" => zoom out.
        const factor = Math.exp(-e.deltaY * 0.012 * zoomSpeed);
        const newZoom = Math.max(minZoom, Math.min(maxZoom, targets.zoom * factor));
        // Anchor: keep world point under cursor stationary.
        const rect = dom.getBoundingClientRect();
        const cx = e.clientX - rect.left - rect.width / 2;
        const cy = e.clientY - rect.top - rect.height / 2;
        const [wx, wy] = screenToWorld(cx, cy);
        const worldX = targets.x + wx;
        const worldY = targets.y + wy;
        const zoomRatio = newZoom / targets.zoom;
        targets.x = worldX - (worldX - targets.x) / zoomRatio;
        targets.y = worldY - (worldY - targets.y) / zoomRatio;
        targets.zoom = newZoom;
      } else {
        // Pan.
        const [dx, dy] = screenToWorld(e.deltaX, e.deltaY);
        targets.x -= dx;
        targets.y -= dy;
      }
    };

    const onPointerDown = (e: PointerEvent) => {
      if (!(spaceDown || e.button === 1)) return;
      dragging = true;
      lastPointer = new Vector2(e.clientX, e.clientY);
      dom.setPointerCapture(e.pointerId);
      dom.style.cursor = 'grabbing';
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!dragging || !lastPointer) return;
      const targets = getCameraTargets(ortho);
      if (!targets) return;
      const dx = e.clientX - lastPointer.x;
      const dy = e.clientY - lastPointer.y;
      const [wx, wy] = screenToWorld(dx, dy);
      targets.x -= wx;
      targets.y -= wy;
      lastPointer.set(e.clientX, e.clientY);
    };

    const onPointerUp = (e: PointerEvent) => {
      if (!dragging) return;
      dragging = false;
      lastPointer = null;
      try {
        dom.releasePointerCapture(e.pointerId);
      } catch {
        /* noop */
      }
      dom.style.cursor = spaceDown ? 'grab' : '';
    };

    dom.addEventListener('wheel', onWheel, { passive: false });
    dom.addEventListener('pointerdown', onPointerDown);
    dom.addEventListener('pointermove', onPointerMove);
    dom.addEventListener('pointerup', onPointerUp);
    dom.addEventListener('pointercancel', onPointerUp);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);

    return () => {
      dom.removeEventListener('wheel', onWheel);
      dom.removeEventListener('pointerdown', onPointerDown);
      dom.removeEventListener('pointermove', onPointerMove);
      dom.removeEventListener('pointerup', onPointerUp);
      dom.removeEventListener('pointercancel', onPointerUp);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      dom.style.cursor = '';
    };
  }, [gl, camera, size.width, size.height, disabled, minZoom, maxZoom, zoomSpeed]);
}

/**
 * Imperative camera fly-to. Used by focus mode and command palette.
 * Returns a Promise that resolves when the camera settles.
 */
export function flyTo(
  camera: OrthographicCamera,
  to: { x: number; y: number; zoom?: number },
): void {
  const t = getCameraTargets(camera);
  if (!t) return;
  t.x = to.x;
  t.y = to.y;
  if (to.zoom != null) t.zoom = to.zoom;
}
