// Default Expo Metro config — mobile is a standalone install
// (apps/mobile is excluded from pnpm-workspace.yaml). Hoisted layout
// is enforced via .npmrc so Metro's classic node resolution works.
const { getDefaultConfig } = require('expo/metro-config');

module.exports = getDefaultConfig(__dirname);
