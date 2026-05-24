import { describe, it, expect } from 'vitest';
import { dot, l2norm, normalize, meanVector } from '../vector';

describe('vector ops', () => {
  it('dot is symmetric', () => {
    const a = new Float32Array([1, 2, 3, 4]);
    const b = new Float32Array([0.5, 0.25, 0.1, -1]);
    expect(dot(a, b)).toBeCloseTo(dot(b, a), 6);
  });

  it('unrolled dot matches scalar', () => {
    const a = new Float32Array(13).map((_, i) => i + 1);
    const b = new Float32Array(13).map((_, i) => (i % 3) + 1);
    let expected = 0;
    for (let i = 0; i < 13; i++) expected += a[i]! * b[i]!;
    expect(dot(a, b)).toBeCloseTo(expected, 5);
  });

  it('normalize yields unit length', () => {
    const v = normalize(new Float32Array([3, 4]));
    expect(l2norm(v)).toBeCloseTo(1, 6);
  });

  it('normalize is no-op for zero vector', () => {
    const v = normalize(new Float32Array([0, 0, 0]));
    expect(v[0]).toBe(0);
    expect(v[1]).toBe(0);
  });

  it('mean of orthonormal axes is centroid', () => {
    const m = meanVector([
      new Float32Array([1, 0, 0]),
      new Float32Array([0, 1, 0]),
    ]);
    expect(m[0]).toBeCloseTo(0.5);
    expect(m[1]).toBeCloseTo(0.5);
    expect(m[2]).toBeCloseTo(0);
  });
});
