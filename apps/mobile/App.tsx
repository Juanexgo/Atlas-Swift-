/**
 * Atlas Mobile entry — wraps the spatial shell with Reanimated +
 * gesture handler providers. All the action is in src/AtlasShell.tsx.
 *
 * Visual parity goals with the web app:
 *   - Same dark void + starfield + radial vignette background
 *   - Same accent palette via NODE_KIND_ACCENT
 *   - Same focus card structure (kind chip, title, body, tags,
 *     "Summarize with AI", connected list)
 *   - Same metric HUD layout (Atlas mark + status dot top-left,
 *     search trigger top-right, node/edge counts bottom-center)
 *   - Same gestures (pinch zoom, pan, tap to focus)
 *   - WebGL shader glow is approximated with Skia BlurMask — visually
 *     equivalent at typical viewing distance.
 */
import 'react-native-gesture-handler';
import React from 'react';
import { AtlasShell } from './src/AtlasShell';

export default function App(): React.JSX.Element {
  return <AtlasShell />;
}
