'use client';

/**
 * The R3F canvas — strictly the WebGL surface. Knows nothing about
 * commands, palettes, or focus cards.
 *
 * Implementation note: Canvas config (gl, camera, dpr) is hoisted to
 * module-level constants. Inline object literals would create new
 * identities every render, causing R3F v9 to repeatedly re-install its
 * event system — which in turn triggers a circular-reference TypeError
 * when React's dev-mode error path tries to inspect Three.js objects
 * (they have parent ⇄ child cycles).
 */
import { useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import { GraphScene, useLayout, useGraph, type LayoutHandle } from '@atlas/graph-engine';
import type { Camera } from 'three';

interface GraphCanvasProps {
  onLayout: (h: LayoutHandle | null) => void;
  onCamera: (c: Camera | null) => void;
}

const GL_CONFIG = {
  antialias: true,
  alpha: true,
  powerPreference: 'high-performance' as const,
  stencil: false,
  depth: false,
};

const CAMERA_CONFIG = {
  position: [0, 0, 10] as [number, number, number],
  zoom: 1,
  near: -1000,
  far: 1000,
};

const DPR: [number, number] = [1, 2];

export function GraphCanvas({ onLayout, onCamera }: GraphCanvasProps) {
  return (
    <Canvas
      orthographic
      dpr={DPR}
      gl={GL_CONFIG}
      camera={CAMERA_CONFIG}
    >
      <SceneBridge onLayout={onLayout} onCamera={onCamera} />
    </Canvas>
  );
}

/** Lives inside <Canvas> so it can call useThree/useLayout. */
function SceneBridge({ onLayout, onCamera }: GraphCanvasProps) {
  const nodes = useGraph((s) => s.nodes);
  const edges = useGraph((s) => s.edges);
  const layout = useLayout(nodes, edges);
  const hasNodes = nodes.length > 0;

  useEffect(() => {
    onLayout(layout);
    return () => onLayout(null);
  }, [layout, onLayout]);

  return (
    <GraphScene
      positions={layout.positions}
      layout={layout}
      cameraRefCallback={onCamera}
      postprocess={hasNodes}
    />
  );
}
