/**
 * Pan + pinch camera state, on the UI thread.
 *
 * Uses Reanimated shared values so gesture handlers can mutate them
 * without crossing the JS bridge. The Skia Group transform reads these
 * via useDerivedValue every frame.
 */
import {
  cancelAnimation,
  useSharedValue,
  withSpring,
  type SharedValue,
} from 'react-native-reanimated';
import { Gesture } from 'react-native-gesture-handler';
import { spring } from '../theme/tokens';

export interface CameraHandle {
  tx: SharedValue<number>;
  ty: SharedValue<number>;
  scale: SharedValue<number>;
  /** Composite gesture handler for the canvas wrapper. */
  gestures: ReturnType<typeof Gesture.Race>;
  /** Imperatively fly to a target. */
  flyTo: (x: number, y: number, scale?: number) => void;
  /** Reset to origin at default zoom. */
  reset: () => void;
}

interface UseCameraOptions {
  onTap?: (worldX: number, worldY: number) => void;
  /** Viewport center offset — the Skia transform already adds w/2, h/2. */
  width: number;
  height: number;
}

export function useCamera({ onTap, width, height }: UseCameraOptions): CameraHandle {
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const scale = useSharedValue(1);
  const savedTx = useSharedValue(0);
  const savedTy = useSharedValue(0);
  const savedScale = useSharedValue(1);

  const pan = Gesture.Pan()
    .averageTouches(true)
    .onBegin(() => {
      cancelAnimation(tx);
      cancelAnimation(ty);
      savedTx.value = tx.value;
      savedTy.value = ty.value;
    })
    .onChange((e) => {
      tx.value = savedTx.value + e.translationX;
      ty.value = savedTy.value + e.translationY;
    });

  const pinch = Gesture.Pinch()
    .onBegin(() => {
      cancelAnimation(scale);
      savedScale.value = scale.value;
    })
    .onChange((e) => {
      const next = Math.max(0.3, Math.min(3.5, savedScale.value * e.scale));
      scale.value = next;
    });

  const tap = Gesture.Tap()
    .maxDuration(220)
    .onEnd((e) => {
      if (!onTap) return;
      // Convert screen px → world coords.
      // Inverse of the Group transform: translate by canvas center, then user tx/ty,
      // then scale. So worldX = (screenX - centerX - tx) / scale.
      const wx = (e.x - width / 2 - tx.value) / scale.value;
      const wy = (e.y - height / 2 - ty.value) / scale.value;
      onTap(wx, wy);
    });

  const gestures = Gesture.Race(tap, Gesture.Simultaneous(pan, pinch));

  return {
    tx,
    ty,
    scale,
    gestures,
    flyTo: (x, y, s) => {
      // Camera target is negative because we're moving the world to put
      // (x, y) at the center.
      tx.value = withSpring(-x * scale.value, spring.cinematic);
      ty.value = withSpring(-y * scale.value, spring.cinematic);
      if (s != null) scale.value = withSpring(s, spring.cinematic);
    },
    reset: () => {
      tx.value = withSpring(0, spring.cinematic);
      ty.value = withSpring(0, spring.cinematic);
      scale.value = withSpring(1, spring.cinematic);
    },
  };
}
