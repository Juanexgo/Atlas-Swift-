/**
 * Skia scene — the visual analog of the web's R3F canvas.
 *
 * Renders edges + nodes inside a transformed Group. Pan/zoom comes from
 * shared Reanimated values mutated by gesture handlers in the parent.
 *
 * Visual parity choices:
 *   - Each node is a Circle with a BlurMaskFilter — produces a glow
 *     that visually matches the web's fragment-shader glow.
 *   - Hover/focus state intensifies the glow radius and adds a fainter
 *     outer halo.
 *   - Edges are drawn as straight lines with alpha proportional to
 *     strength. When a focus is active, incident edges brighten and
 *     non-incident edges dim — same rules as the web edge shader.
 */
import React, { useMemo } from 'react';
import { Canvas, Group, Circle, Path, Skia, BlurMask } from '@shopify/react-native-skia';
import { useDerivedValue, type SharedValue } from 'react-native-reanimated';
import { useGraphStore, type RenderNode } from '../store/graphStore';
import { accentFor, color } from '../theme/tokens';
import type { AtlasEdge } from '../types';

interface SkiaSceneProps {
  positions: Float32Array;
  /** Reanimated shared values driving the camera transform. */
  tx: SharedValue<number>;
  ty: SharedValue<number>;
  scale: SharedValue<number>;
  /** Viewport size from useWindowDimensions. */
  width: number;
  height: number;
}

export function SkiaScene({ positions, tx, ty, scale, width, height }: SkiaSceneProps) {
  const nodes = useGraphStore((s) => s.nodes);
  const edges = useGraphStore((s) => s.edges);
  const nodeIndex = useGraphStore((s) => s.nodeIndex);
  const focusId = useGraphStore((s) => s.focusId);
  const hoverId = useGraphStore((s) => s.hoverId);

  // Compose the transform as a Skia matrix every frame via derived value.
  // We translate by the canvas center so world origin sits at the middle.
  const transform = useDerivedValue(() => {
    return [
      { translateX: width / 2 + tx.value },
      { translateY: height / 2 + ty.value },
      { scale: scale.value },
    ];
  }, [width, height]);

  return (
    <Canvas style={{ flex: 1 }}>
      <Group transform={transform}>
        <Edges positions={positions} edges={edges} nodeIndex={nodeIndex} focusId={focusId} />
        <Nodes positions={positions} nodes={nodes} focusId={focusId} hoverId={hoverId} />
      </Group>
    </Canvas>
  );
}

interface EdgesProps {
  positions: Float32Array;
  edges: AtlasEdge[];
  nodeIndex: Map<string, number>;
  focusId: string | null;
}

function Edges({ positions, edges, nodeIndex, focusId }: EdgesProps) {
  // Build a single Skia Path for all edges — way cheaper than N <Line> nodes.
  // We rebuild every render of this component; the parent re-renders only
  // when the store slice (edges, focus) changes, so this isn't per-frame.
  const focusIdx = focusId ? nodeIndex.get(focusId) ?? -1 : -1;

  const incidentPath = useMemo(() => {
    if (focusIdx < 0) return null;
    const p = Skia.Path.Make();
    for (const e of edges) {
      const si = nodeIndex.get(e.source) ?? -1;
      const ti = nodeIndex.get(e.target) ?? -1;
      if (si < 0 || ti < 0) continue;
      if (si !== focusIdx && ti !== focusIdx) continue;
      const sx = positions[si * 2] ?? 0;
      const sy = positions[si * 2 + 1] ?? 0;
      const tx = positions[ti * 2] ?? 0;
      const ty = positions[ti * 2 + 1] ?? 0;
      p.moveTo(sx, sy);
      p.lineTo(tx, ty);
    }
    return p;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [edges, nodeIndex, focusIdx, positions.length]);

  const normalPath = useMemo(() => {
    const p = Skia.Path.Make();
    for (const e of edges) {
      const si = nodeIndex.get(e.source) ?? -1;
      const ti = nodeIndex.get(e.target) ?? -1;
      if (si < 0 || ti < 0) continue;
      if (focusIdx >= 0 && (si === focusIdx || ti === focusIdx)) continue;
      const sx = positions[si * 2] ?? 0;
      const sy = positions[si * 2 + 1] ?? 0;
      const tx = positions[ti * 2] ?? 0;
      const ty = positions[ti * 2 + 1] ?? 0;
      p.moveTo(sx, sy);
      p.lineTo(tx, ty);
    }
    return p;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [edges, nodeIndex, focusIdx, positions.length]);

  return (
    <>
      <Path
        path={normalPath}
        style="stroke"
        strokeWidth={1}
        color={focusIdx >= 0 ? 'rgba(200, 220, 255, 0.04)' : 'rgba(200, 220, 255, 0.14)'}
      />
      {incidentPath && (
        <Path
          path={incidentPath}
          style="stroke"
          strokeWidth={1.5}
          color="rgba(140, 198, 255, 0.6)"
        />
      )}
    </>
  );
}

interface NodesProps {
  positions: Float32Array;
  nodes: RenderNode[];
  focusId: string | null;
  hoverId: string | null;
}

function Nodes({ positions, nodes, focusId, hoverId }: NodesProps) {
  const count = nodes.length;
  return (
    <>
      {nodes.map((n, i) => {
        if (i >= count) return null;
        const x = positions[i * 2] ?? 0;
        const y = positions[i * 2 + 1] ?? 0;
        const accent = accentFor(n.kind);
        const isFocused = n.id === focusId;
        const isHovered = n.id === hoverId;
        const dimmed = focusId != null && !isFocused;
        const r = n.radius * (isFocused ? 1.25 : isHovered ? 1.1 : 1);
        const opacity = dimmed ? 0.32 : 1;
        return (
          <React.Fragment key={n.id}>
            {/* Outer halo — only on focused */}
            {isFocused && (
              <Circle cx={x} cy={y} r={r + 14} color={`${accent}33`} opacity={opacity}>
                <BlurMask blur={10} style="normal" />
              </Circle>
            )}
            {/* Glow ring */}
            <Circle cx={x} cy={y} r={r + 4} color={accent} opacity={opacity * 0.45}>
              <BlurMask blur={isFocused ? 8 : 4} style="solid" />
            </Circle>
            {/* Core */}
            <Circle cx={x} cy={y} r={r} color={accent} opacity={opacity} />
            {/* Inner highlight — gives the lit-from-above feel */}
            <Circle
              cx={x}
              cy={y - r * 0.3}
              r={r * 0.55}
              color={color.text.primary}
              opacity={opacity * 0.16}
            />
          </React.Fragment>
        );
      })}
    </>
  );
}
