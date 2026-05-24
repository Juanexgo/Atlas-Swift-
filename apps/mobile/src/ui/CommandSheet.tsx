/**
 * Command sheet — mobile equivalent of the web's ⌘K palette.
 *
 * Bottom sheet with a TextInput at the top, filtered node list below.
 * Substring + token match, ranked by prefix > word-start > substring.
 */
import React, { useMemo, useState } from 'react';
import {
  FlatList,
  Keyboard,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Animated, {
  Easing,
  SlideInDown,
  SlideOutDown,
} from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import { useGraphStore } from '../store/graphStore';
import { accentFor, color } from '../theme/tokens';
import { useDeviceProfile } from '../theme/device';

interface CommandSheetProps {
  onSelect: (id: string) => void;
  onClose: () => void;
}

export function CommandSheet({ onSelect, onClose }: CommandSheetProps) {
  const nodes = useGraphStore((s) => s.nodes);
  const [query, setQuery] = useState('');
  const device = useDeviceProfile();

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return nodes.slice(0, 30);
    const tokens = q.split(/\s+/);
    return nodes
      .map((n) => ({ n, score: scoreNode(n.title.toLowerCase(), tokens) }))
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 30)
      .map((x) => x.n);
  }, [nodes, query]);

  return (
    <>
      <Pressable style={styles.scrim} onPress={onClose} />
      <Animated.View
        entering={SlideInDown.duration(320).easing(Easing.out(Easing.cubic))}
        exiting={SlideOutDown.duration(200)}
        style={[
          styles.wrapper,
          {
            paddingHorizontal: device.spacing.edge - 4,
            paddingBottom: device.bottomSafe,
          },
        ]}
      >
        <BlurView intensity={60} tint="dark" style={styles.glass}>
          <View style={styles.inputWrap}>
            <TextInput
              autoFocus
              placeholder="Jump to anything…"
              placeholderTextColor={color.text.tertiary}
              value={query}
              onChangeText={setQuery}
              style={styles.input}
              returnKeyType="search"
              onSubmitEditing={() => {
                const first = filtered[0];
                if (first) {
                  Keyboard.dismiss();
                  onSelect(first.id);
                }
              }}
            />
          </View>
          <FlatList
            data={filtered}
            keyExtractor={(n) => n.id}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => (
              <Pressable
                onPress={() => {
                  Keyboard.dismiss();
                  onSelect(item.id);
                }}
                style={({ pressed }) => [
                  styles.row,
                  { backgroundColor: pressed ? color.glass.base : 'transparent' },
                ]}
              >
                <View
                  style={[styles.dot, { backgroundColor: accentFor(item.kind) }]}
                />
                <Text style={styles.rowTitle} numberOfLines={1}>
                  {item.title}
                </Text>
                <Text style={styles.rowKind}>{item.kind}</Text>
              </Pressable>
            )}
            ListEmptyComponent={
              <Text style={styles.empty}>No matches.</Text>
            }
            style={{ maxHeight: 360 }}
          />
        </BlurView>
      </Animated.View>
    </>
  );
}

function scoreNode(title: string, tokens: string[]): number {
  let score = 0;
  for (const t of tokens) {
    if (title.startsWith(t)) score += 100;
    else if (new RegExp(`\\b${escapeRe(t)}`).test(title)) score += 60;
    else if (title.includes(t)) score += 30;
    else return 0;
  }
  return score;
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const styles = StyleSheet.create({
  scrim: {
    position: 'absolute',
    inset: 0,
    backgroundColor: 'rgba(0,0,0,0.45)',
    zIndex: 60,
  } as never,
  wrapper: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 12,
    paddingBottom: 12,
    zIndex: 70,
  },
  glass: {
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: color.glass.borderStrong,
  },
  inputWrap: {
    paddingHorizontal: 18,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: color.glass.border,
    backgroundColor: 'rgba(10, 10, 14, 0.6)',
  },
  input: {
    color: color.text.primary,
    fontSize: 16,
    fontWeight: '500',
    padding: 0,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 11,
    gap: 10,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  rowTitle: {
    flex: 1,
    color: color.text.primary,
    fontSize: 14,
  },
  rowKind: {
    color: color.text.tertiary,
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  empty: {
    color: color.text.tertiary,
    textAlign: 'center',
    padding: 32,
    fontSize: 13,
  },
});
