'use client';

import {
  type ReactNode,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Glass } from './glass';
import { Kbd } from './kbd';
import { cn } from './cn';

export interface CommandItem {
  id: string;
  label: string;
  hint?: string;
  group?: string;
  /** Optional leading content — icon, swatch, etc. */
  leading?: ReactNode;
  /** Optional trailing keyboard shortcut. */
  shortcut?: string[];
  onSelect: () => void;
  /** Free-form keywords to enable fuzzy matching. */
  keywords?: string[];
}

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: CommandItem[];
  placeholder?: string;
  /** Notify when the query string changes (for upstream AI search). */
  onQueryChange?: (query: string) => void;
}

/**
 * The keyboard-first command spine of Atlas.
 *
 * - Substring + token match, no fuzzy lib (fast, predictable, no deps)
 * - Items ranked by: prefix > whole-word > substring > keywords
 * - Arrow keys + enter, Escape closes
 * - Auto-focus on open, restore focus on close
 */
export function CommandPalette({
  open,
  onOpenChange,
  items,
  placeholder = 'Search Atlas…',
  onQueryChange,
}: CommandPaletteProps) {
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);

  useEffect(() => {
    onQueryChange?.(query);
  }, [query, onQueryChange]);
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);

  // Manage focus on open/close
  useEffect(() => {
    if (open) {
      previousFocus.current = document.activeElement as HTMLElement;
      // RAF wait — modal mount hasn't placed input yet
      requestAnimationFrame(() => inputRef.current?.focus());
    } else {
      setQuery('');
      setActive(0);
      previousFocus.current?.focus();
    }
  }, [open]);

  const filtered = useMemo(() => filterItems(items, query), [items, query]);
  useEffect(() => setActive(0), [query]);

  const groups = useMemo(() => groupItems(filtered), [filtered]);

  const close = useCallback(() => onOpenChange(false), [onOpenChange]);

  const handleKey = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        close();
        return;
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActive((i) => Math.min(i + 1, filtered.length - 1));
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActive((i) => Math.max(i - 1, 0));
        return;
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        const item = filtered[active];
        if (item) {
          item.onSelect();
          close();
        }
      }
    },
    [filtered, active, close],
  );

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[200] flex items-start justify-center px-4 pt-[12vh]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.14 }}
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) close();
          }}
          role="presentation"
        >
          {/* Scrim */}
          <div
            aria-hidden
            className="absolute inset-0 bg-black/40 backdrop-blur-[6px]"
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Command palette"
            className="relative w-full max-w-[640px]"
            initial={{ opacity: 0, y: -12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 320, damping: 32, mass: 1 }}
            onKeyDown={handleKey}
          >
            <Glass elevation="command" luminous className="overflow-hidden">
              <div className="flex items-center gap-3 border-b border-white/[0.06] px-5 py-4">
                <SearchGlyph />
                <input
                  ref={inputRef}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={placeholder}
                  aria-autocomplete="list"
                  aria-controls={listId}
                  className="w-full bg-transparent text-[15px] font-medium text-white/95 placeholder:text-white/30 focus:outline-none"
                  spellCheck={false}
                  autoComplete="off"
                />
                <Kbd>esc</Kbd>
              </div>

              <ul
                id={listId}
                role="listbox"
                aria-label="Suggestions"
                className="max-h-[60vh] overflow-y-auto py-2"
              >
                {groups.length === 0 && (
                  <li className="px-5 py-8 text-center text-sm text-white/40">
                    No matches.
                  </li>
                )}
                {groups.map((group) => (
                  <li key={group.label}>
                    <div className="px-5 pb-1.5 pt-3 text-[10.5px] font-medium uppercase tracking-[0.12em] text-white/30">
                      {group.label}
                    </div>
                    <ul>
                      {group.items.map((item) => {
                        const idx = filtered.indexOf(item);
                        const isActive = idx === active;
                        return (
                          <li key={item.id}>
                            <button
                              type="button"
                              role="option"
                              aria-selected={isActive}
                              onMouseEnter={() => setActive(idx)}
                              onClick={() => {
                                item.onSelect();
                                close();
                              }}
                              className={cn(
                                'group relative flex w-full items-center gap-3 px-5 py-2.5 text-left text-[14px] font-medium transition-colors',
                                isActive ? 'text-white' : 'text-white/70 hover:text-white/90',
                              )}
                            >
                              {isActive && (
                                <motion.div
                                  layoutId="command-active"
                                  className="absolute inset-x-2 inset-y-0.5 -z-10 rounded-md bg-white/[0.06]"
                                  transition={{
                                    type: 'spring',
                                    stiffness: 520,
                                    damping: 38,
                                  }}
                                />
                              )}
                              {item.leading && (
                                <span className="flex h-6 w-6 items-center justify-center text-white/60">
                                  {item.leading}
                                </span>
                              )}
                              <span className="flex-1 truncate">{item.label}</span>
                              {item.hint && (
                                <span className="truncate text-[12px] font-normal text-white/40">
                                  {item.hint}
                                </span>
                              )}
                              {item.shortcut && (
                                <span className="flex items-center gap-1">
                                  {item.shortcut.map((k, i) => (
                                    <Kbd key={i}>{k}</Kbd>
                                  ))}
                                </span>
                              )}
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </li>
                ))}
              </ul>

              <div className="flex items-center justify-between border-t border-white/[0.06] px-5 py-2.5 text-[11px] text-white/40">
                <span className="flex items-center gap-1.5">
                  <Kbd>↑</Kbd>
                  <Kbd>↓</Kbd>
                  to navigate
                </span>
                <span className="flex items-center gap-1.5">
                  <Kbd>↵</Kbd> to open
                </span>
              </div>
            </Glass>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function SearchGlyph() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden
      className="shrink-0 text-white/40"
    >
      <circle cx="7" cy="7" r="5" stroke="currentColor" strokeWidth="1.5" />
      <path d="m11 11 3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

/* ── ranking ──────────────────────────────────────────────────────────── */

function filterItems(items: CommandItem[], query: string): CommandItem[] {
  const q = query.trim().toLowerCase();
  if (!q) return items;
  const tokens = q.split(/\s+/);
  const scored: { item: CommandItem; score: number }[] = [];
  for (const item of items) {
    const score = scoreItem(item, tokens);
    if (score > 0) scored.push({ item, score });
  }
  scored.sort((a, b) => b.score - a.score);
  return scored.map((s) => s.item);
}

function scoreItem(item: CommandItem, tokens: string[]): number {
  const label = item.label.toLowerCase();
  const hint = (item.hint ?? '').toLowerCase();
  const keywords = (item.keywords ?? []).map((k) => k.toLowerCase());
  const haystack = [label, hint, ...keywords].join(' ');

  let score = 0;
  for (const t of tokens) {
    if (label.startsWith(t)) score += 100;
    else if (new RegExp(`\\b${escapeRe(t)}`).test(label)) score += 60;
    else if (label.includes(t)) score += 30;
    else if (keywords.some((k) => k.startsWith(t))) score += 40;
    else if (haystack.includes(t)) score += 10;
    else return 0;
  }
  return score;
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function groupItems(items: CommandItem[]): { label: string; items: CommandItem[] }[] {
  const order: string[] = [];
  const byGroup = new Map<string, CommandItem[]>();
  for (const item of items) {
    const g = item.group ?? 'Results';
    if (!byGroup.has(g)) {
      byGroup.set(g, []);
      order.push(g);
    }
    byGroup.get(g)!.push(item);
  }
  return order.map((label) => ({ label, items: byGroup.get(label)! }));
}
