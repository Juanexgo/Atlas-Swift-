/**
 * Focus sheet — appears from the bottom when a node is tapped.
 *
 * Mirrors the web's FocusCard: kind chip with accent color, title, body,
 * tags, connected list, "Summarize with AI" action (calls the API when
 * EXPO_PUBLIC_ATLAS_API_URL is set, otherwise shows the offline summary).
 */
import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  SlideInDown,
  SlideOutDown,
} from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import { type AtlasNode } from '../types';
import { useGraphStore } from '../store/graphStore';
import { accentFor, color } from '../theme/tokens';
import { useDeviceProfile } from '../theme/device';

const API_URL =
  (typeof process !== 'undefined' && process.env?.EXPO_PUBLIC_ATLAS_API_URL) ||
  'http://localhost:4001';

interface FocusSheetProps {
  nodeId: string;
  onClose: () => void;
}

export function FocusSheet({ nodeId, onClose }: FocusSheetProps) {
  const node = useGraphStore((s) => s.nodes.find((n) => n.id === nodeId));
  const edges = useGraphStore((s) => s.edges);
  const nodes = useGraphStore((s) => s.nodes);
  const setFocus = useGraphStore((s) => s.setFocus);
  const device = useDeviceProfile();

  const [summary, setSummary] = useState<string | null>(null);
  const [summarizing, setSummarizing] = useState(false);

  useEffect(() => {
    setSummary(null);
  }, [nodeId]);

  if (!node) return null;

  const accent = accentFor(node.kind);

  // Neighbors: directly connected nodes
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const neighbors: { id: string; title: string; kind: AtlasNode['kind'] }[] = [];
  for (const e of edges) {
    const otherId =
      e.source === node.id ? e.target : e.target === node.id ? e.source : null;
    if (!otherId) continue;
    const n = byId.get(otherId);
    if (n) neighbors.push({ id: n.id, title: n.title, kind: n.kind });
    if (neighbors.length >= 6) break;
  }

  const requestSummary = async () => {
    if (summarizing) return;
    setSummarizing(true);
    try {
      const res = await fetch(`${API_URL}/ai/summarize/${node.id}`, {
        method: 'POST',
      });
      if (res.ok) {
        const json = (await res.json()) as { summary: string };
        setSummary(json.summary);
      } else {
        setSummary(offlineSummary(node, neighbors));
      }
    } catch {
      setSummary(offlineSummary(node, neighbors));
    } finally {
      setSummarizing(false);
    }
  };

  return (
    <Animated.View
      entering={SlideInDown.duration(360).easing(Easing.out(Easing.cubic))}
      exiting={SlideOutDown.duration(220).easing(Easing.in(Easing.cubic))}
      style={[
        styles.wrapper,
        {
          // Clear the metric pill at the bottom + the home indicator
          bottom: device.bottomSafe + 64,
          left: device.spacing.edge,
          right: device.spacing.edge,
        },
      ]}
    >
      <BlurView intensity={60} tint="dark" style={styles.glass}>
        <View
          style={[
            styles.accentStrip,
            { backgroundColor: accent, shadowColor: accent },
          ]}
        />
        <View style={[styles.body, { padding: device.spacing.sheetPad }]}>
          <View style={styles.headerRow}>
            <View
              style={[
                styles.kindChip,
                { borderColor: `${accent}40`, backgroundColor: `${accent}12` },
              ]}
            >
              <View
                style={[
                  styles.kindDot,
                  { backgroundColor: accent, shadowColor: accent },
                ]}
              />
              <Text style={[styles.kindLabel, { color: accent }]}>
                {node.kind.toUpperCase()}
              </Text>
            </View>
            <Pressable onPress={onClose} hitSlop={12}>
              <Text style={styles.close}>✕</Text>
            </Pressable>
          </View>

          <Text style={[styles.title, { fontSize: device.type.title, lineHeight: device.type.title * 1.21 }]}>
            {node.title}
          </Text>
          {node.body ? (
            <Text style={[styles.bodyText, { fontSize: device.type.body + 0.5, lineHeight: (device.type.body + 0.5) * 1.45 }]}>
              {node.body}
            </Text>
          ) : null}

          {node.tags.length > 0 && (
            <View style={styles.tagsRow}>
              {node.tags.map((t) => (
                <View key={t} style={styles.tag}>
                  <Text style={styles.tagText}>#{t}</Text>
                </View>
              ))}
            </View>
          )}

          <Pressable
            onPress={requestSummary}
            disabled={summarizing}
            style={({ pressed }) => [
              styles.summarizeBtn,
              { borderColor: color.glass.border, opacity: pressed ? 0.7 : 1 },
            ]}
          >
            <Text style={styles.sparkle}>✦</Text>
            <Text style={styles.summarizeText}>
              {summarizing
                ? 'Summarizing…'
                : summary
                  ? 'Refresh summary'
                  : 'Summarize with AI'}
            </Text>
          </Pressable>

          {summary && (
            <View style={styles.summaryBox}>
              <Text style={styles.summaryText}>{summary}</Text>
            </View>
          )}

          {neighbors.length > 0 && (
            <View style={styles.neighborsSection}>
              <Text style={styles.sectionLabel}>Connected</Text>
              <ScrollView showsVerticalScrollIndicator={false}>
                {neighbors.map((n) => (
                  <Pressable
                    key={n.id}
                    onPress={() => setFocus(n.id)}
                    style={({ pressed }) => [
                      styles.neighborRow,
                      { opacity: pressed ? 0.5 : 1 },
                    ]}
                  >
                    <View
                      style={[
                        styles.neighborDot,
                        { backgroundColor: accentFor(n.kind) },
                      ]}
                    />
                    <Text style={styles.neighborTitle} numberOfLines={1}>
                      {n.title}
                    </Text>
                    <Text style={styles.neighborKind}>{n.kind}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          )}
        </View>
      </BlurView>
    </Animated.View>
  );
}

function offlineSummary(
  node: AtlasNode,
  neighbors: { title: string }[],
): string {
  const parts: string[] = [];
  parts.push(`A ${node.kind} titled "${node.title}".`);
  if (node.body) parts.push(node.body.slice(0, 160));
  if (neighbors.length > 0) {
    parts.push(
      `Connected to: ${neighbors.slice(0, 3).map((n) => n.title).join(', ')}.`,
    );
  }
  parts.push('(Offline — start the API to enable AI summaries.)');
  return parts.join(' ');
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    maxHeight: '70%',
    zIndex: 50,
  },
  glass: {
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: color.glass.borderStrong,
  },
  accentStrip: {
    height: 2,
    width: '100%',
    shadowOpacity: 1,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 0 },
  },
  body: {
    padding: 18,
    backgroundColor: 'rgba(10, 10, 14, 0.55)',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  kindChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: 1,
    gap: 6,
  },
  kindDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    shadowOpacity: 0.8,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 0 },
  },
  kindLabel: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 1.2,
  },
  close: {
    color: color.text.tertiary,
    fontSize: 16,
    paddingHorizontal: 4,
  },
  title: {
    color: color.text.primary,
    fontSize: 19,
    fontWeight: '600',
    lineHeight: 23,
    letterSpacing: -0.3,
  },
  bodyText: {
    marginTop: 8,
    color: color.text.secondary,
    fontSize: 13.5,
    lineHeight: 19,
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 10,
    gap: 6,
  },
  tag: {
    backgroundColor: color.glass.raised,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  tagText: {
    color: color.text.secondary,
    fontSize: 11,
    fontWeight: '500',
  },
  summarizeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    marginTop: 14,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
    backgroundColor: color.glass.base,
    gap: 6,
  },
  sparkle: {
    color: color.text.secondary,
    fontSize: 11,
  },
  summarizeText: {
    color: color.text.secondary,
    fontSize: 12,
    fontWeight: '500',
  },
  summaryBox: {
    marginTop: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: color.glass.base,
    borderWidth: 1,
    borderColor: color.glass.border,
  },
  summaryText: {
    color: color.text.secondary,
    fontSize: 12.5,
    lineHeight: 18,
  },
  neighborsSection: {
    marginTop: 14,
    borderTopWidth: 1,
    borderTopColor: color.glass.border,
    paddingTop: 12,
  },
  sectionLabel: {
    color: color.text.tertiary,
    fontSize: 10,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: 8,
    fontWeight: '600',
  },
  neighborRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    gap: 8,
  },
  neighborDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  neighborTitle: {
    flex: 1,
    color: color.text.secondary,
    fontSize: 12.5,
  },
  neighborKind: {
    color: color.text.tertiary,
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
});
