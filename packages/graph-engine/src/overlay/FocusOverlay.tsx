'use client';

/**
 * Focus overlay — the WebGL ↔ DOM bridge.
 *
 * When a node is focused, the overlay:
 *   1. Reads the node's live world position from the layout buffer.
 *   2. Projects to screen coordinates each frame.
 *   3. Positions a DOM card via translate3d (composited; no layout).
 *
 * The DOM card is the place where rich text editing, contextual UI, and
 * accessible controls live. WebGL renders the spatial canvas; DOM handles
 * the focused interaction surface.
 *
 * IMPORTANT: this component lives *outside* the Canvas (in DOM space)
 * but uses a tiny R3F portal hook to read the camera each frame. To
 * avoid React reconciling on every frame, the card's position is set via
 * a direct DOM ref + translate3d, not via state.
 */
import { useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useGraph } from '../store/graphStore';
import { projectToScreen } from './projectToScreen';
import type { Camera } from 'three';

interface FocusOverlayProps {
  positionsRef: { current: Float32Array };
  /** Provided by the scene — a getter for the live camera. */
  cameraRef: { current: Camera | null };
  /** Render the inside of the card given a node id. */
  children: (nodeId: string) => ReactNode;
}

export function FocusOverlay({ positionsRef, cameraRef, children }: FocusOverlayProps) {
  const focusId = useGraph((s) => s.focusId);
  const nodeIndex = useGraph((s) => s.nodeIndex);
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  // RAF loop — read camera + position, write transform.
  useEffect(() => {
    if (!focusId) return;
    const idx = nodeIndex.get(focusId);
    if (idx == null) return;

    let rafId = 0;
    const tick = () => {
      rafId = requestAnimationFrame(tick);
      const wrapper = wrapperRef.current;
      const camera = cameraRef.current;
      const positions = positionsRef.current;
      if (!wrapper || !camera) return;
      const x = positions[idx * 2];
      const y = positions[idx * 2 + 1];
      if (x == null || y == null) return;
      const screen = projectToScreen(x, y, camera, window.innerWidth, window.innerHeight);
      if (!screen) {
        wrapper.style.opacity = '0';
        return;
      }
      wrapper.style.transform = `translate3d(${screen.x}px, ${screen.y}px, 0)`;
      wrapper.style.opacity = '1';
    };
    tick();
    return () => cancelAnimationFrame(rafId);
  }, [focusId, nodeIndex, cameraRef, positionsRef]);

  if (!focusId || typeof document === 'undefined') return null;

  return createPortal(
    <div
      ref={wrapperRef}
      className="pointer-events-none fixed left-0 top-0 z-[150] -translate-x-1/2 -translate-y-1/2"
      style={{ willChange: 'transform' }}
    >
      <div className="pointer-events-auto" style={{ transform: 'translate(0, 56px)' }}>
        {children(focusId)}
      </div>
    </div>,
    document.body,
  );
}
