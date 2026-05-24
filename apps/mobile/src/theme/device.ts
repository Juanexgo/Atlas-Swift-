/**
 * Device-aware sizing.
 *
 * We tune spacing, type, and density to specific iPhone tiers — most
 * importantly the iPhone 15 Pro Max (430×932 pt, Dynamic Island, ProMotion).
 *
 * Three buckets:
 *   - "compact"  : SE-class phones (≤375pt wide)
 *   - "regular"  : standard iPhone (376–414pt)
 *   - "max"      : Pro Max / Plus class (≥415pt — includes 15 Pro Max)
 *
 * The HUD and FocusSheet read from here so a 15 Pro Max gets larger
 * touch targets and a more breathable layout while small phones stay
 * dense.
 */
import { useWindowDimensions } from 'react-native';
import { useSafeAreaInsets, type EdgeInsets } from 'react-native-safe-area-context';

export type DeviceClass = 'compact' | 'regular' | 'max';

export interface DeviceProfile {
  cls: DeviceClass;
  width: number;
  height: number;
  insets: EdgeInsets;
  /** True for Pro / Pro Max iPhones with the Dynamic Island cutout. */
  hasDynamicIsland: boolean;

  // Tuned values — read these directly in components.
  spacing: {
    edge: number;       // outer page padding
    hudGap: number;     // gap between HUD elements
    sheetPad: number;   // inner padding for bottom sheets
  };
  type: {
    brand: number;
    title: number;
    body: number;
    label: number;
    caption: number;
  };
  /** Bottom inset to push above the home indicator, with a sensible minimum. */
  bottomSafe: number;
  /** Top inset to clear the Dynamic Island / notch / status bar. */
  topSafe: number;
}

const PRESETS: Record<DeviceClass, Pick<DeviceProfile, 'spacing' | 'type'>> = {
  compact: {
    spacing: { edge: 14, hudGap: 8, sheetPad: 14 },
    type: { brand: 14, title: 16, body: 12.5, label: 10, caption: 10 },
  },
  regular: {
    spacing: { edge: 16, hudGap: 10, sheetPad: 16 },
    type: { brand: 15, title: 18, body: 13, label: 10, caption: 10 },
  },
  max: {
    // iPhone 15 Pro Max territory — generous spacing, slightly larger type.
    spacing: { edge: 20, hudGap: 12, sheetPad: 20 },
    type: { brand: 16, title: 20, body: 14, label: 10.5, caption: 11 },
  },
};

export function useDeviceProfile(): DeviceProfile {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const cls: DeviceClass =
    width >= 415 ? 'max' : width >= 376 ? 'regular' : 'compact';
  const preset = PRESETS[cls];

  // Dynamic Island ~59pt top inset on 15 Pro/Pro Max in portrait.
  // Older notched iPhones hover around 44-50pt; the 14 Pro and newer Pros
  // are >50pt because the Island sits below the status bar.
  const hasDynamicIsland = insets.top >= 50;

  return {
    cls,
    width,
    height,
    insets,
    hasDynamicIsland,
    spacing: preset.spacing,
    type: preset.type,
    bottomSafe: Math.max(insets.bottom, 12),
    topSafe: insets.top,
  };
}
