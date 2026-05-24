/**
 * JSX intrinsic augmentation for R3F nodes.
 *
 * Direct, resolution-independent augmentation. We type the intrinsics
 * we use as React.ReactElement-producing components, so TSX recognizes
 * them as valid host elements no matter which R3F variant pnpm resolved.
 *
 * The runtime is provided by R3F's custom reconciler at runtime — TS
 * only needs the JSX wrappers to typecheck.
 */
import type { ThreeElements } from '@react-three/fiber';

declare module 'react' {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace JSX {
    interface IntrinsicElements {
      instancedMesh: ThreeElements['instancedMesh'];
      lineSegments: ThreeElements['lineSegments'];
      mesh: ThreeElements['mesh'];
      group: ThreeElements['group'];
      primitive: ThreeElements['primitive'];
    }
  }
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace JSX {
    interface IntrinsicElements {
      instancedMesh: ThreeElements['instancedMesh'];
      lineSegments: ThreeElements['lineSegments'];
      mesh: ThreeElements['mesh'];
      group: ThreeElements['group'];
      primitive: ThreeElements['primitive'];
    }
  }
}

export {};
