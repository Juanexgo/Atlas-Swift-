/**
 * Vector ops — all assume L2-normalized inputs for cosine = dot.
 * Plain functions, no allocations in the hot path.
 */

export function dot(a: Float32Array, b: Float32Array): number {
  const len = Math.min(a.length, b.length);
  let s = 0;
  // Manually unroll for V8 — modest but real win on hot search loops.
  let i = 0;
  for (; i + 4 <= len; i += 4) {
    s += a[i]! * b[i]! + a[i + 1]! * b[i + 1]! + a[i + 2]! * b[i + 2]! + a[i + 3]! * b[i + 3]!;
  }
  for (; i < len; i++) s += a[i]! * b[i]!;
  return s;
}

export function l2norm(v: Float32Array): number {
  let s = 0;
  for (let i = 0; i < v.length; i++) s += v[i]! * v[i]!;
  return Math.sqrt(s);
}

/** In-place L2 normalize. Returns the same array. */
export function normalize(v: Float32Array): Float32Array {
  const n = l2norm(v);
  if (n < 1e-12) return v;
  const inv = 1 / n;
  for (let i = 0; i < v.length; i++) v[i] = v[i]! * inv;
  return v;
}

/** Add b into a in place. */
export function addInto(a: Float32Array, b: Float32Array): void {
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i++) a[i] = a[i]! + b[i]!;
}

export function scaleInto(a: Float32Array, k: number): void {
  for (let i = 0; i < a.length; i++) a[i] = a[i]! * k;
}

export function meanVector(vectors: Float32Array[]): Float32Array {
  if (vectors.length === 0) return new Float32Array(0);
  const dim = vectors[0]!.length;
  const out = new Float32Array(dim);
  for (const v of vectors) addInto(out, v);
  scaleInto(out, 1 / vectors.length);
  return out;
}
