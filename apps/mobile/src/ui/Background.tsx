/**
 * Background — mirrors the web's radial gradient + starfield combo.
 *
 * Two layers: a deep radial gradient (LinearGradient cheats it with a
 * vertical fade because Skia's RadialGradient inside <Canvas> is heavier
 * and unnecessary at this size), and a procedurally-rendered star field
 * using Skia Circles at fixed pseudo-random positions.
 */
import React, { useMemo } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Canvas, Circle } from '@shopify/react-native-skia';

const STAR_COUNT = 60;

export function Background() {
  const { width, height } = useWindowDimensions();
  const stars = useMemo(() => {
    // Deterministic LCG so the field is stable across reloads.
    let s = 1337;
    const next = () => {
      s = (s * 9301 + 49297) % 233280;
      return s / 233280;
    };
    return Array.from({ length: STAR_COUNT }, () => ({
      x: next() * width,
      y: next() * height,
      r: 0.4 + next() * 1.2,
      o: 0.15 + next() * 0.4,
    }));
  }, [width, height]);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <LinearGradient
        colors={['#000000', '#02030a', '#000000']}
        locations={[0, 0.5, 1]}
        style={StyleSheet.absoluteFill}
      />
      <Canvas style={StyleSheet.absoluteFill}>
        {stars.map((s, i) => (
          <Circle
            key={i}
            cx={s.x}
            cy={s.y}
            r={s.r}
            color={`rgba(255, 255, 255, ${s.o})`}
          />
        ))}
      </Canvas>
    </View>
  );
}
