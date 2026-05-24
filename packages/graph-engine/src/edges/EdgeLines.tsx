'use client';

/**
 * Edge renderer.
 *
 * One LineSegments mesh for ALL edges. Two vertices per edge laid out in
 * a single BufferAttribute that we rewrite each frame from node positions.
 *
 * Constructed imperatively and mounted via <primitive> for the same
 * reason as InstancedNodes — keeps Three's parent↔child cycles off the
 * React fiber.
 */
import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  BufferAttribute,
  BufferGeometry,
  LineBasicMaterial,
  LineSegments,
  ShaderMaterial,
} from 'three';
import { useGraph } from '../store/graphStore';

interface EdgeLinesProps {
  positions: Float32Array;
}

export function EdgeLines({ positions }: EdgeLinesProps) {
  const edges = useGraph((s) => s.edges);
  const nodeIndex = useGraph((s) => s.nodeIndex);
  const focusId = useGraph((s) => s.focusId);

  const edgeIndices = useMemo(() => {
    const len = edges.length;
    const s = new Int32Array(len);
    const t = new Int32Array(len);
    const strengths = new Float32Array(len);
    for (let i = 0; i < len; i++) {
      const e = edges[i]!;
      s[i] = nodeIndex.get(e.source) ?? -1;
      t[i] = nodeIndex.get(e.target) ?? -1;
      strengths[i] = e.strength;
    }
    return { s, t, strengths, len };
  }, [edges, nodeIndex]);

  // Material as a singleton — uniforms updated by ref, not React state.
  const material = useMemo(() => {
    void LineBasicMaterial; // keep import in case we want a non-shader fallback
    return new ShaderMaterial({
      transparent: true,
      depthTest: false,
      depthWrite: false,
      uniforms: {
        uHasFocus: { value: 0.0 },
      },
      vertexShader: EDGE_VERTEX,
      fragmentShader: EDGE_FRAGMENT,
    });
  }, []);

  // Build the LineSegments imperatively. Re-built when edge topology
  // changes (typical: very rare after initial seed).
  const lines = useMemo(() => {
    if (edgeIndices.len === 0) return null;
    const g = new BufferGeometry();
    const posAttr = new BufferAttribute(new Float32Array(edgeIndices.len * 6), 3);
    posAttr.setUsage(35048 /* DynamicDrawUsage */);
    g.setAttribute('position', posAttr);

    const attrStrength = new BufferAttribute(new Float32Array(edgeIndices.len * 2), 1);
    g.setAttribute('aStrength', attrStrength);
    const attrFocus = new BufferAttribute(new Float32Array(edgeIndices.len * 2), 1);
    g.setAttribute('aFocus', attrFocus);

    for (let i = 0; i < edgeIndices.len; i++) {
      const v = edgeIndices.strengths[i] ?? 0.5;
      attrStrength.array[i * 2] = v;
      attrStrength.array[i * 2 + 1] = v;
    }
    attrStrength.needsUpdate = true;

    const ls = new LineSegments(g, material);
    ls.frustumCulled = false;
    return ls;
  }, [edgeIndices, material]);

  // Toggle focus-incident colouring.
  useEffect(() => {
    if (!lines) return;
    const focusIdx = focusId != null ? nodeIndex.get(focusId) ?? -1 : -1;
    const attr = lines.geometry.getAttribute('aFocus') as BufferAttribute;
    const arr = attr.array as Float32Array;
    for (let i = 0; i < edgeIndices.len; i++) {
      const incident =
        focusIdx >= 0 &&
        (edgeIndices.s[i] === focusIdx || edgeIndices.t[i] === focusIdx);
      const v = incident ? 1 : 0;
      arr[i * 2] = v;
      arr[i * 2 + 1] = v;
    }
    attr.needsUpdate = true;
    const u = material.uniforms as Record<string, { value: number } | undefined>;
    if (u.uHasFocus) u.uHasFocus.value = focusId != null ? 1.0 : 0.0;
  }, [lines, focusId, nodeIndex, edgeIndices, material]);

  useFrame(() => {
    if (!lines) return;
    const posAttr = lines.geometry.getAttribute('position') as BufferAttribute;
    const arr = posAttr.array as Float32Array;
    for (let i = 0; i < edgeIndices.len; i++) {
      const si = edgeIndices.s[i]!;
      const ti = edgeIndices.t[i]!;
      if (si < 0 || ti < 0) continue;
      const o = i * 6;
      arr[o] = positions[si * 2] ?? 0;
      arr[o + 1] = positions[si * 2 + 1] ?? 0;
      arr[o + 2] = 0;
      arr[o + 3] = positions[ti * 2] ?? 0;
      arr[o + 4] = positions[ti * 2 + 1] ?? 0;
      arr[o + 5] = 0;
    }
    posAttr.needsUpdate = true;
  });

  const previous = useRef<LineSegments | null>(null);
  useEffect(() => {
    if (previous.current && previous.current !== lines) {
      previous.current.geometry.dispose();
    }
    previous.current = lines;
  }, [lines]);

  if (!lines) return null;
  return <primitive object={lines} />;
}

const EDGE_VERTEX = /* glsl */ `
  attribute float aStrength;
  attribute float aFocus;
  varying float vStrength;
  varying float vFocus;

  void main() {
    vStrength = aStrength;
    vFocus = aFocus;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const EDGE_FRAGMENT = /* glsl */ `
  precision highp float;
  varying float vStrength;
  varying float vFocus;
  uniform float uHasFocus;

  void main() {
    vec3 col = vec3(0.78, 0.86, 1.0);
    float alpha = 0.08 + vStrength * 0.18;

    if (uHasFocus > 0.5) {
      if (vFocus > 0.5) {
        alpha = 0.42 + vStrength * 0.4;
        col = vec3(0.55, 0.78, 1.0);
      } else {
        alpha *= 0.18;
      }
    }
    gl_FragColor = vec4(col, alpha);
  }
`;
