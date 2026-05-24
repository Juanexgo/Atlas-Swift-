'use client';

/**
 * Instanced node renderer.
 *
 * One InstancedMesh for ALL nodes — no React reconciliation per node.
 *
 * Per-instance data is packed into custom BufferAttributes:
 *   - aColor   : vec3   accent color
 *   - aRadius  : float  base radius in world units
 *   - aState   : float  packed flags { hover, focus, dimmed } as bits
 *
 * The vertex shader reads instance-matrix + attributes; the fragment
 * shader renders a soft disc with glow that intensifies on hover/focus.
 *
 * Positions live in a Float32Array shared by reference with the layout
 * worker. Every frame we read positions and write transform matrices to
 * the instanceMatrix attribute, then flag it for upload. No React, no
 * allocations.
 *
 * Why `<primitive object={mesh}>` instead of `<instancedMesh args=…>`:
 * passing live Three objects (BufferGeometry, ShaderMaterial) as `args`
 * to R3F's JSX intrinsics in R3F v9 / React 19 leaves those objects on
 * the fiber's props. React's dev-mode introspection can then walk those
 * props and choke on the parent↔child cycles inside Three's scene graph
 * with a "cyclic object value" TypeError. Handing R3F a pre-built
 * object via `primitive` is the supported escape hatch — R3F doesn't
 * reconcile its internals, so there is no surface for the cycle.
 */
import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  Color,
  InstancedBufferAttribute,
  InstancedMesh,
  Matrix4,
  PlaneGeometry,
  ShaderMaterial,
  Vector3,
} from 'three';
import { useGraph } from '../store/graphStore';

const STATE_HOVER = 1;
const STATE_FOCUS = 2;
const STATE_DIMMED = 4;

interface InstancedNodesProps {
  positions: Float32Array;
}

export function InstancedNodes({ positions }: InstancedNodesProps) {
  const nodes = useGraph((s) => s.nodes);
  const hoverId = useGraph((s) => s.hoverId);
  const focusId = useGraph((s) => s.focusId);
  const nodeIndex = useGraph((s) => s.nodeIndex);

  // Shared geometry/material — constructed once per session.
  const material = useMemo(
    () =>
      new ShaderMaterial({
        transparent: true,
        depthTest: false,
        depthWrite: false,
        uniforms: {},
        vertexShader: NODE_VERTEX,
        fragmentShader: NODE_FRAGMENT,
      }),
    [],
  );

  // The InstancedMesh itself is constructed imperatively. We rebuild it
  // when the node count changes (InstancedMesh's count is set at
  // construction and can't grow past its allocated buffer).
  const mesh = useMemo(() => {
    if (nodes.length === 0) return null;
    const geometry = new PlaneGeometry(2, 2);
    const m = new InstancedMesh(geometry, material, nodes.length);
    m.frustumCulled = false;
    return m;
  }, [nodes.length, material]);

  // Cached buffers — separate memo so attribute writes don't reallocate
  // the typed arrays on hover/focus changes.
  const buffers = useMemo(() => {
    const count = nodes.length;
    const colors = new Float32Array(count * 3);
    const radii = new Float32Array(count);
    const states = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      const n = nodes[i]!;
      const c = new Color(n.color);
      colors[i * 3] = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;
      radii[i] = n.radius;
      states[i] = 0;
    }
    return { colors, radii, states, count };
  }, [nodes]);

  // Bind attributes once the mesh exists.
  useEffect(() => {
    if (!mesh) return;
    mesh.geometry.setAttribute('aColor', new InstancedBufferAttribute(buffers.colors, 3));
    mesh.geometry.setAttribute('aRadius', new InstancedBufferAttribute(buffers.radii, 1));
    mesh.geometry.setAttribute('aState', new InstancedBufferAttribute(buffers.states, 1));
    mesh.count = buffers.count;
    mesh.instanceMatrix.needsUpdate = true;
  }, [mesh, buffers]);

  // Update state attribute reactively on hover/focus change.
  useEffect(() => {
    if (!mesh) return;
    const states = buffers.states;
    states.fill(0);
    if (focusId != null) {
      for (let i = 0; i < states.length; i++) states[i] = STATE_DIMMED;
      const fi = nodeIndex.get(focusId);
      if (fi != null) states[fi] = STATE_FOCUS;
    }
    if (hoverId != null) {
      const hi = nodeIndex.get(hoverId);
      if (hi != null) states[hi] = (states[hi] ?? 0) | STATE_HOVER;
    }
    const attr = mesh.geometry.getAttribute('aState') as InstancedBufferAttribute | undefined;
    if (attr) attr.needsUpdate = true;
  }, [mesh, hoverId, focusId, nodeIndex, buffers.states]);

  // Per-frame transform writes.
  const tmpMat = useMemo(() => new Matrix4(), []);
  const tmpPos = useMemo(() => new Vector3(), []);

  useFrame(() => {
    if (!mesh) return;
    const count = Math.min(buffers.count, positions.length / 2);
    for (let i = 0; i < count; i++) {
      const x = positions[i * 2] ?? 0;
      const y = positions[i * 2 + 1] ?? 0;
      tmpPos.set(x, y, 0);
      tmpMat.makeTranslation(tmpPos.x, tmpPos.y, tmpPos.z);
      mesh.setMatrixAt(i, tmpMat);
    }
    mesh.instanceMatrix.needsUpdate = true;
  });

  // Cleanup on unmount or before the next mesh swap.
  const previous = useRef<InstancedMesh | null>(null);
  useEffect(() => {
    if (previous.current && previous.current !== mesh) {
      previous.current.geometry.dispose();
    }
    previous.current = mesh;
  }, [mesh]);

  if (!mesh) return null;
  return <primitive object={mesh} />;
}

/* ── shaders ─────────────────────────────────────────────────────────── */

const NODE_VERTEX = /* glsl */ `
  attribute vec3 aColor;
  attribute float aRadius;
  attribute float aState;

  varying vec3 vColor;
  varying float vState;
  varying vec2 vUv;

  void main() {
    vColor = aColor;
    vState = aState;
    vUv = uv;

    float hover = (mod(aState, 2.0) >= 1.0) ? 1.0 : 0.0;
    float focused = (mod(aState, 4.0) >= 2.0) ? 1.0 : 0.0;
    float scale = aRadius * (1.0 + hover * 0.10 + focused * 0.25);

    vec4 mvPosition = modelViewMatrix * instanceMatrix * vec4(position * scale, 1.0);
    gl_Position = projectionMatrix * mvPosition;
  }
`;

const NODE_FRAGMENT = /* glsl */ `
  precision highp float;

  varying vec3 vColor;
  varying float vState;
  varying vec2 vUv;

  void main() {
    vec2 p = vUv - 0.5;
    float d = length(p) * 2.0;
    if (d > 1.0) discard;

    float hover = (mod(vState, 2.0) >= 1.0) ? 1.0 : 0.0;
    float focused = (mod(vState, 4.0) >= 2.0) ? 1.0 : 0.0;
    float dimmed = (mod(vState, 8.0) >= 4.0) ? 1.0 : 0.0;

    float core = smoothstep(0.95, 0.7, d);
    float highlight = smoothstep(0.6, 0.0, d) * 0.35;
    float glow = smoothstep(1.0, 0.55, d) * (0.18 + 0.35 * hover + 0.55 * focused);

    vec3 base = vColor;
    vec3 col = base * (0.85 + highlight) + glow * base;
    col *= mix(1.0, 0.86, smoothstep(0.0, 1.0, d));

    float alpha = core + glow;
    if (dimmed > 0.5 && focused < 0.5) {
      alpha *= 0.22;
      col *= 0.7;
    }

    gl_FragColor = vec4(col, alpha);
  }
`;
