'use client';

/**
 * Drag-to-pin gesture.
 *
 * Reuses the hover state maintained by usePicking — when the pointer
 * goes down over a hovered node, we begin dragging it. World-space
 * delta is computed from screen pixels via camera zoom so the drag
 * feels 1:1 at any zoom. Releasing unpins (the simulation relaxes the
 * node back into its cluster) unless Shift is held.
 *
 * The gesture cooperates with usePicking + useCameraControls by:
 *   - bailing when Space is held (camera pan)
 *   - stopping propagation on drag-end so the click handler doesn't fire
 */
import { useEffect } from 'react';
import { useThree } from '@react-three/fiber';
import { graphStore } from '../store/graphStore';
import { useGraph } from '../store/graphStore';
import type { LayoutHandle } from '../layout/useLayout';

interface NodeDragOptions {
  layout: LayoutHandle | null;
  disabled?: boolean;
}

const DRAG_THRESHOLD_PX = 4;

export function useNodeDrag({ layout, disabled = false }: NodeDragOptions) {
  const { gl, camera } = useThree();
  const nodes = useGraph((s) => s.nodes);
  const nodeIndex = useGraph((s) => s.nodeIndex);

  useEffect(() => {
    if (disabled || !layout || nodes.length === 0) return;
    const dom = gl.domElement;

    let draggingId: string | null = null;
    let draggingIdx = -1;
    let startPointer: { x: number; y: number } | null = null;
    let startWorld: { x: number; y: number } | null = null;
    let moved = false;
    let spaceDown = false;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space') spaceDown = true;
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') spaceDown = false;
    };

    const screenToWorldDelta = (dx: number, dy: number): [number, number] => {
      const z = (camera as unknown as { zoom: number }).zoom;
      return [dx / z, -dy / z];
    };

    const onPointerDown = (e: PointerEvent) => {
      if (e.button !== 0 || spaceDown) return;
      // hoverId is updated by usePicking on the same pointermove that
      // brought us here. If the user is over a node, hoverId === that id.
      const id = graphStore.getState().hoverId;
      if (!id) return;
      const idx = nodeIndex.get(id);
      if (idx == null) return;
      draggingId = id;
      draggingIdx = idx;
      startPointer = { x: e.clientX, y: e.clientY };
      startWorld = {
        x: layout.positions[idx * 2] ?? 0,
        y: layout.positions[idx * 2 + 1] ?? 0,
      };
      moved = false;
      try {
        dom.setPointerCapture(e.pointerId);
      } catch {
        /* noop */
      }
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!draggingId || !startPointer || !startWorld) return;
      const dx = e.clientX - startPointer.x;
      const dy = e.clientY - startPointer.y;
      if (!moved && Math.hypot(dx, dy) < DRAG_THRESHOLD_PX) return;
      moved = true;
      const [wdx, wdy] = screenToWorldDelta(dx, dy);
      const tx = startWorld.x + wdx;
      const ty = startWorld.y + wdy;
      layout.pin(draggingId, tx, ty);
      // Stamp positions directly so the render is instant — the worker
      // tick will catch up asynchronously.
      layout.positions[draggingIdx * 2] = tx;
      layout.positions[draggingIdx * 2 + 1] = ty;
      e.preventDefault();
    };

    const onPointerUp = (e: PointerEvent) => {
      if (!draggingId) return;
      const id = draggingId;
      const wasMoved = moved;
      const shift = e.shiftKey;
      try {
        dom.releasePointerCapture(e.pointerId);
      } catch {
        /* noop */
      }
      draggingId = null;
      draggingIdx = -1;
      startPointer = null;
      startWorld = null;
      moved = false;
      if (wasMoved) {
        if (!shift) layout.pin(id, null, null);
        layout.reheat(0.3);
        // Suppress the click that would otherwise fire focus.
        e.stopPropagation();
        // Prevent the synthesized click from setting focus.
        const blockClick = (ce: MouseEvent) => {
          ce.stopPropagation();
          ce.preventDefault();
          dom.removeEventListener('click', blockClick, true);
        };
        dom.addEventListener('click', blockClick, true);
      }
    };

    dom.addEventListener('pointerdown', onPointerDown);
    dom.addEventListener('pointermove', onPointerMove);
    dom.addEventListener('pointerup', onPointerUp);
    dom.addEventListener('pointercancel', onPointerUp);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      dom.removeEventListener('pointerdown', onPointerDown);
      dom.removeEventListener('pointermove', onPointerMove);
      dom.removeEventListener('pointerup', onPointerUp);
      dom.removeEventListener('pointercancel', onPointerUp);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [gl, camera, nodes, nodeIndex, layout, disabled]);
}
