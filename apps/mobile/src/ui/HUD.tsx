/**
 * Heads-up display, optimized for Dynamic Island and Pro Max screens.
 *
 * Top-left:  Atlas wordmark + status — pushed below the Dynamic Island
 * Top-right: search trigger — same vertical alignment as left
 * Bottom:    metrics pill — clears the home indicator
 *
 * On a 15 Pro Max specifically, we get ~59pt top safe and ~34pt bottom
 * safe. The Dynamic Island sits in the top inset, so positioning at
 * `insets.top + 4` lands cleanly under it.
 */
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import Svg, { Circle, Defs, LinearGradient, Stop } from 'react-native-svg';
import { useGraphStore } from '../store/graphStore';
import { color } from '../theme/tokens';
import { useDeviceProfile } from '../theme/device';

interface HUDProps {
  onOpenSearch: () => void;
  status: 'loading' | 'ready';
}

export function HUD({ onOpenSearch, status }: HUDProps) {
  const nodeCount = useGraphStore((s) => s.nodes.length);
  const edgeCount = useGraphStore((s) => s.edges.length);
  const device = useDeviceProfile();

  // Vertical position of the top HUD row:
  //   - clear the Dynamic Island / notch
  //   - add a small breathing gap below it
  const topY = device.topSafe + (device.hasDynamicIsland ? 6 : 8);
  const edgePad = device.spacing.edge;

  return (
    <>
      <Animated.View
        entering={FadeInDown.duration(420).delay(120)}
        style={[styles.topLeft, { top: topY, left: edgePad }]}
      >
        <AtlasMark size={device.cls === 'max' ? 30 : 28} />
        <View style={{ marginLeft: device.spacing.hudGap }}>
          <Text style={[styles.brand, { fontSize: device.type.brand }]}>Atlas</Text>
          <Text style={[styles.brandSub, { fontSize: device.type.caption - 0.5 }]}>
            Spatial knowledge OS
          </Text>
        </View>
        <View
          style={[
            styles.dot,
            { backgroundColor: status === 'ready' ? '#34D399' : '#FBBF24' },
          ]}
        />
      </Animated.View>

      <Animated.View
        entering={FadeInDown.duration(420).delay(180)}
        style={[styles.topRight, { top: topY, right: edgePad }]}
      >
        <Pressable onPress={onOpenSearch} android_disableSound>
          <BlurView intensity={28} tint="dark" style={styles.glass}>
            <View
              style={[
                styles.searchInner,
                {
                  paddingHorizontal: device.spacing.hudGap + 4,
                  paddingVertical: 9,
                },
              ]}
            >
              <SearchGlyph />
              <Text style={[styles.searchText, { fontSize: device.type.body }]}>
                Search
              </Text>
            </View>
          </BlurView>
        </Pressable>
      </Animated.View>

      <Animated.View
        entering={FadeInUp.duration(420).delay(240)}
        style={[
          styles.bottom,
          { bottom: device.bottomSafe + 12 },
        ]}
      >
        <BlurView intensity={28} tint="dark" style={styles.glass}>
          <View
            style={[
              styles.bottomInner,
              { paddingHorizontal: device.spacing.sheetPad - 2 },
            ]}
          >
            <Metric label="Nodes" value={String(nodeCount)} typeSize={device.type.body - 1} />
            <Divider />
            <Metric label="Edges" value={String(edgeCount)} typeSize={device.type.body - 1} />
          </View>
        </BlurView>
      </Animated.View>
    </>
  );
}

function Metric({
  label,
  value,
  typeSize,
}: {
  label: string;
  value: string;
  typeSize: number;
}) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6 }}>
      <Text style={[styles.metricValue, { fontSize: typeSize }]}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

function Divider() {
  return <View style={styles.divider} />;
}

function AtlasMark({ size = 28 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 28 28">
      <Defs>
        <LinearGradient id="g1" x1="0" y1="0" x2="28" y2="28">
          <Stop offset="0" stopColor="#7CC6FF" />
          <Stop offset="1" stopColor="#A78BFA" />
        </LinearGradient>
        <LinearGradient id="g2" x1="0" y1="28" x2="28" y2="0">
          <Stop offset="0" stopColor="#F472B6" />
          <Stop offset="1" stopColor="#7CC6FF" />
        </LinearGradient>
      </Defs>
      <Circle cx="14" cy="14" r="11.5" stroke="url(#g1)" strokeOpacity={0.65} fill="none" />
      <Circle cx="14" cy="14" r="7.5" stroke="url(#g2)" strokeOpacity={0.8} fill="none" />
      <Circle cx="14" cy="14" r="3.5" fill="#7CC6FF" />
    </Svg>
  );
}

function SearchGlyph() {
  return (
    <Svg width={14} height={14} viewBox="0 0 16 16">
      <Circle cx={7} cy={7} r={5} stroke={color.text.secondary} strokeWidth={1.5} fill="none" />
    </Svg>
  );
}

const styles = StyleSheet.create({
  topLeft: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 10,
  },
  topRight: {
    position: 'absolute',
    zIndex: 10,
  },
  bottom: {
    position: 'absolute',
    alignSelf: 'center',
    zIndex: 10,
  },
  glass: {
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: color.glass.border,
  },
  searchInner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: color.glass.base,
    gap: 8,
  },
  bottomInner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 9,
    backgroundColor: color.glass.base,
    gap: 14,
  },
  brand: {
    color: color.text.primary,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  brandSub: {
    color: color.text.tertiary,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    marginTop: 2,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginLeft: 10,
  },
  searchText: {
    color: color.text.secondary,
    fontWeight: '500',
  },
  metricValue: {
    fontVariant: ['tabular-nums'],
    color: color.text.primary,
    fontWeight: '600',
  },
  metricLabel: {
    color: color.text.tertiary,
    fontSize: 10,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  divider: {
    width: 1,
    height: 12,
    backgroundColor: color.glass.border,
  },
});
