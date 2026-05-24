/** @type {import('next').NextConfig} */
const nextConfig = {
  // React Strict Mode duplicates effects in dev, which on Next 16 / React 19
  // can drive R3F's internal events module into a state where React's
  // dev-time introspection traverses Three.js scene graph cycles and throws
  // "cyclic object value". WebGL is inherently stateful and doesn't benefit
  // from the double-mount discipline.
  reactStrictMode: false,
  transpilePackages: [
    '@atlas/graph-engine',
    '@atlas/ui',
    '@atlas/crdt',
    '@atlas/types',
    '@atlas/design-tokens',
    '@atlas/ai',
  ],
  experimental: {
    optimizePackageImports: ['three', '@react-three/fiber', 'framer-motion'],
  },
};

export default nextConfig;
