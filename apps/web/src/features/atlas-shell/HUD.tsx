'use client';

/**
 * Heads-up display. The minimal chrome around the canvas.
 *
 * Top-left  : Atlas wordmark + status pulse
 * Top-right : Command palette trigger
 * Bottom    : Zoom indicator, node count, "press space + drag to pan" hint
 *
 * Everything is glass, floats above the canvas, and uses spring transitions.
 */
import { Glass, Kbd } from '@atlas/ui';
import { motion } from 'framer-motion';
import { useGraph } from '@atlas/graph-engine';
import type { RealtimeStatus } from '@atlas/crdt';

interface HUDProps {
  onOpenPalette: () => void;
  status: 'loading' | 'ready';
  realtime?: RealtimeStatus;
}

export function HUD({ onOpenPalette, status, realtime }: HUDProps) {
  const nodeCount = useGraph((s) => s.nodes.length);
  const edgeCount = useGraph((s) => s.edges.length);
  const zoom = useGraph((s) => s.camera.zoom);

  return (
    <>
      {/* Top-left mark */}
      <motion.div
        initial={{ opacity: 0, y: -6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 320, damping: 32, delay: 0.1 }}
        className="pointer-events-none absolute left-6 top-5 z-30 flex items-center gap-3"
      >
        <AtlasMark />
        <div className="flex flex-col leading-none">
          <span className="font-display text-[15px] font-semibold tracking-tight text-white/95">
            Atlas
          </span>
          <span className="mt-1 text-[10.5px] font-medium uppercase tracking-[0.18em] text-white/35">
            Spatial knowledge OS
          </span>
        </div>
        <StatusDot status={status} />
        {realtime && realtime.state !== 'idle' && <RealtimePill realtime={realtime} />}
      </motion.div>

      {/* Top-right command trigger */}
      <motion.button
        type="button"
        onClick={onOpenPalette}
        initial={{ opacity: 0, y: -6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 320, damping: 32, delay: 0.18 }}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.985 }}
        className="absolute right-6 top-5 z-30"
      >
        <Glass elevation="raised" className="px-3 py-1.5">
          <span className="flex items-center gap-2 text-[12.5px] font-medium text-white/70">
            <SearchGlyph />
            Search Atlas
            <span className="ml-3 flex items-center gap-0.5">
              <Kbd>⌘</Kbd>
              <Kbd>K</Kbd>
            </span>
          </span>
        </Glass>
      </motion.button>

      {/* Bottom HUD */}
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 320, damping: 32, delay: 0.24 }}
        className="pointer-events-none absolute bottom-5 left-1/2 z-30 -translate-x-1/2"
      >
        <Glass elevation="raised" className="flex items-center gap-5 px-4 py-2">
          <Metric label="Nodes" value={nodeCount.toLocaleString()} />
          <Divider />
          <Metric label="Edges" value={edgeCount.toLocaleString()} />
          <Divider />
          <Metric label="Zoom" value={`${(zoom * 100).toFixed(0)}%`} />
          <Divider />
          <span className="flex items-center gap-1.5 text-[11px] text-white/40">
            <Kbd>space</Kbd>
            + drag to pan
          </span>
        </Glass>
      </motion.div>
    </>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline gap-1.5">
      <span className="font-mono text-[12px] font-medium tabular-nums text-white/85">{value}</span>
      <span className="text-[10px] uppercase tracking-[0.12em] text-white/35">{label}</span>
    </div>
  );
}

function Divider() {
  return <div className="h-3 w-px bg-white/[0.08]" aria-hidden />;
}

function StatusDot({ status }: { status: 'loading' | 'ready' }) {
  const ready = status === 'ready';
  return (
    <motion.span
      className="ml-1 flex h-1.5 w-1.5 items-center justify-center rounded-full"
      animate={{
        backgroundColor: ready ? '#34D399' : '#FBBF24',
        boxShadow: ready
          ? '0 0 8px rgba(52,211,153,0.6)'
          : '0 0 8px rgba(251,191,36,0.6)',
      }}
      transition={{ duration: 0.5 }}
      aria-label={ready ? 'Ready' : 'Loading'}
    />
  );
}

const REALTIME_LABEL: Record<RealtimeStatus['state'], string> = {
  idle: 'Offline',
  connecting: 'Connecting…',
  connected: 'Live',
  disconnected: 'Reconnecting…',
  error: 'Error',
};

const REALTIME_COLOR: Record<RealtimeStatus['state'], string> = {
  idle: 'rgba(255,255,255,0.25)',
  connecting: '#FCD34D',
  connected: '#34D399',
  disconnected: '#FB923C',
  error: '#F87171',
};

function RealtimePill({ realtime }: { realtime: RealtimeStatus }) {
  const color = REALTIME_COLOR[realtime.state];
  const label = REALTIME_LABEL[realtime.state];
  const showPeers = realtime.state === 'connected' && realtime.peers > 0;
  return (
    <motion.span
      initial={{ opacity: 0, x: -4 }}
      animate={{ opacity: 1, x: 0 }}
      className="ml-2 inline-flex items-center gap-1.5 rounded-full border border-white/[0.08] bg-white/[0.04] px-2 py-0.5"
      title={`Realtime: ${label}${showPeers ? ` · ${realtime.peers} peer${realtime.peers === 1 ? '' : 's'}` : ''}`}
    >
      <span
        aria-hidden
        className="h-1.5 w-1.5 rounded-full"
        style={{
          backgroundColor: color,
          boxShadow: realtime.state === 'connected' ? `0 0 6px ${color}` : 'none',
        }}
      />
      <span className="text-[10.5px] font-medium uppercase tracking-[0.12em] text-white/70">
        {label}
      </span>
      {showPeers && (
        <span className="font-mono text-[10.5px] tabular-nums text-white/45">
          {realtime.peers + 1}
        </span>
      )}
    </motion.span>
  );
}

function AtlasMark() {
  // Lightweight inline mark: three concentric rings + a dot. Pure SVG.
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden>
      <circle cx="14" cy="14" r="11.5" stroke="url(#g1)" strokeOpacity="0.65" />
      <circle cx="14" cy="14" r="7.5" stroke="url(#g2)" strokeOpacity="0.8" />
      <circle cx="14" cy="14" r="3.5" fill="#7CC6FF" />
      <defs>
        <linearGradient id="g1" x1="0" y1="0" x2="28" y2="28">
          <stop stopColor="#7CC6FF" />
          <stop offset="1" stopColor="#A78BFA" />
        </linearGradient>
        <linearGradient id="g2" x1="0" y1="28" x2="28" y2="0">
          <stop stopColor="#F472B6" />
          <stop offset="1" stopColor="#7CC6FF" />
        </linearGradient>
      </defs>
    </svg>
  );
}

function SearchGlyph() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
      <circle cx="7" cy="7" r="5" stroke="currentColor" strokeWidth="1.5" />
      <path d="m11 11 3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}
