'use client';

/**
 * GraphScene — composes all engine pieces into a renderable React tree.
 *
 * Order matters for transparency:
 *   1. Edges (under nodes)
 *   2. Nodes (on top)
 *
 * The scene is dumb on purpose — orchestration lives here, never logic.
 * Logic is in the focused hooks (useLayout, usePicking, etc).
 *
 * Note on bloom: we previously composed a `<Postprocessing />` pass using
 * `@react-three/postprocessing` v3, but its EffectComposer stores the
 * WebGLRenderer (and its references back to canvas + scene) on the
 * fiber's props, which React 19 + Next 16's dev-time introspection
 * walks until it hits Three's parent↔child cycles and throws
 * "cyclic object value". Until that lands a fix upstream we render
 * glow directly from the node fragment shader — visually equivalent
 * for hover/focus, and the bottleneck of selective bloom was never the
 * brand-defining feature anyway.
 */
import { useEffect } from 'react';
import { useThree } from '@react-three/fiber';
import type { Camera } from 'three';
import { InstancedNodes } from '../nodes/InstancedNodes';
import { EdgeLines } from '../edges/EdgeLines';
import { SpatialCamera } from '../camera/SpatialCamera';
import { useCameraControls } from '../camera/useCameraControls';
import { usePicking } from '../picking/usePicking';
import { useNodeDrag } from '../picking/useNodeDrag';
import { graphStore } from '../store/graphStore';
import type { LayoutHandle } from '../layout/useLayout';

interface GraphSceneProps {
  positions: Float32Array;
  /** The layout handle — required to enable drag-to-pin. */
  layout?: LayoutHandle | null;
  onPickNode?: (id: string | null) => void;
  /** Receives the live camera ref so DOM overlays can project. */
  cameraRefCallback?: (camera: Camera | null) => void;
  /** Kept in the API for compatibility but currently unused — see file header. */
  postprocess?: boolean;
}

export function GraphScene({
  positions,
  layout = null,
  onPickNode,
  cameraRefCallback,
}: GraphSceneProps) {
  return (
    <>
      <SpatialCamera />
      <Controls
        onPickNode={onPickNode}
        cameraRefCallback={cameraRefCallback}
        layout={layout}
      />
      <EdgeLines positions={positions} />
      <InstancedNodes positions={positions} />
    </>
  );
}

function Controls({
  onPickNode,
  cameraRefCallback,
  layout,
}: {
  onPickNode?: (id: string | null) => void;
  cameraRefCallback?: (camera: Camera | null) => void;
  layout: LayoutHandle | null;
}) {
  const { camera } = useThree();

  useCameraControls();
  usePicking({
    onPick: (id) => {
      const current = graphStore.getState().focusId;
      graphStore.getState().setFocus(current === id ? null : id);
      onPickNode?.(id);
    },
  });
  useNodeDrag({ layout });

  useEffect(() => {
    cameraRefCallback?.(camera);
    return () => cameraRefCallback?.(null);
  }, [camera, cameraRefCallback]);

  return null;
}
