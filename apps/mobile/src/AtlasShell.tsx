/**
 * Mobile shell — composes the canvas, HUD, focus sheet, command sheet.
 *
 * This is the mirror of apps/web/src/features/atlas-shell/AtlasShell.tsx,
 * shaped for touch:
 *  - Tap a node → focus + fly camera
 *  - Tap empty space → unfocus
 *  - Pinch to zoom, two-finger drag to pan (Gesture composition)
 *  - Tap search trigger or use a top swipe gesture (future) → command sheet
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Platform, StyleSheet, useWindowDimensions, View } from 'react-native';
import { GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import * as Haptics from 'expo-haptics';
import { useGraphStore } from './store/graphStore';
import { useLayout } from './layout/useLayout';
import { useCamera } from './canvas/useCamera';
import { SkiaScene } from './canvas/SkiaScene';
import { Background } from './ui/Background';
import { HUD } from './ui/HUD';
import { FocusSheet } from './ui/FocusSheet';
import { CommandSheet } from './ui/CommandSheet';
import { generateMobileSeed } from './seed';

/**
 * Tiny haptic wrappers that no-op on non-iOS so we don't crash on Android
 * or web. iOS specs taptic feedback as part of its HIG; we use it on
 * focus (light), search-select (medium), and unfocus (selection).
 */
function hapticFocus(): void {
  if (Platform.OS !== 'ios') return;
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
}
function hapticSelect(): void {
  if (Platform.OS !== 'ios') return;
  Haptics.selectionAsync().catch(() => undefined);
}

export function AtlasShell() {
  const { width, height } = useWindowDimensions();
  const setGraph = useGraphStore((s) => s.setGraph);
  const setFocus = useGraphStore((s) => s.setFocus);
  const nodes = useGraphStore((s) => s.nodes);
  const focusId = useGraphStore((s) => s.focusId);
  const [searchOpen, setSearchOpen] = useState(false);
  const [status, setStatus] = useState<'loading' | 'ready'>('loading');

  // Seed the graph on first mount.
  useEffect(() => {
    const seed = generateMobileSeed();
    setGraph(seed);
    setStatus('ready');
  }, [setGraph]);

  // Use store's nodes (with derived radius) and current edges for layout.
  const edges = useGraphStore((s) => s.edges);
  const layout = useLayout(nodes, edges);

  /**
   * Hit-test a world coordinate against all nodes (radius-aware).
   * Returns the closest node within its radius or null.
   */
  const hitTest = useCallback(
    (wx: number, wy: number): string | null => {
      const positions = layout.positions;
      let bestId: string | null = null;
      let bestD2 = Infinity;
      for (let i = 0; i < nodes.length; i++) {
        const x = positions[i * 2] ?? 0;
        const y = positions[i * 2 + 1] ?? 0;
        const dx = x - wx;
        const dy = y - wy;
        const d2 = dx * dx + dy * dy;
        const r = (nodes[i]?.radius ?? 10) + 6;
        if (d2 < r * r && d2 < bestD2) {
          bestD2 = d2;
          bestId = nodes[i]!.id;
        }
      }
      return bestId;
    },
    [nodes, layout.positions],
  );

  const camera = useCamera({
    width,
    height,
    onTap: (wx, wy) => {
      const id = hitTest(wx, wy);
      if (id) {
        hapticFocus();
        setFocus(id);
        // Fly camera to the tapped node, leaving room for the bottom sheet.
        camera.flyTo(wx, wy - height * 0.15, Math.max(1.2, camera.scale.value));
      } else if (focusId) {
        hapticSelect();
        setFocus(null);
      }
    },
  });

  const handleSearchSelect = useCallback(
    (id: string) => {
      hapticFocus();
      setSearchOpen(false);
      setFocus(id);
      // Find the node's current world position and fly there.
      const idx = useGraphStore.getState().nodeIndex.get(id);
      if (idx != null) {
        const wx = layout.positions[idx * 2] ?? 0;
        const wy = layout.positions[idx * 2 + 1] ?? 0;
        camera.flyTo(wx, wy - height * 0.15, 1.4);
      }
    },
    [camera, height, layout.positions, setFocus],
  );

  const memoizedBackground = useMemo(() => <Background />, []);

  return (
    <SafeAreaProvider>
      <GestureHandlerRootView style={styles.root}>
        <StatusBar style="light" />
        {memoizedBackground}
        <GestureDetector gesture={camera.gestures}>
          <View style={styles.canvasWrap}>
            <SkiaScene
              positions={layout.positions}
              tx={camera.tx}
              ty={camera.ty}
              scale={camera.scale}
              width={width}
              height={height}
            />
          </View>
        </GestureDetector>

        {/* HUD + sheets read safe-area insets directly (via useDeviceProfile).
            We don't use <SafeAreaView> because it adds padding we want to
            place manually around the Dynamic Island. */}
        <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
          <HUD onOpenSearch={() => setSearchOpen(true)} status={status} />
        </View>

        {focusId && (
          <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
            <FocusSheet
              nodeId={focusId}
              onClose={() => {
                hapticSelect();
                setFocus(null);
              }}
            />
          </View>
        )}

        {searchOpen && (
          <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
            <CommandSheet
              onSelect={handleSearchSelect}
              onClose={() => setSearchOpen(false)}
            />
          </View>
        )}
      </GestureHandlerRootView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  canvasWrap: { flex: 1 },
});
