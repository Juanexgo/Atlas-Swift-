'use client';

/**
 * Full-viewport drop zone for JSON files. Listens to drag events on the
 * window so the user can drop anywhere on the page. Renders a glass
 * overlay only while a file is being dragged — invisible at rest.
 *
 * We only intercept drags that carry files. Text drags (palette content,
 * link drags) pass through untouched.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

interface DropZoneProps {
  onDrop: (file: File) => void | Promise<void>;
}

export function DropZone({ onDrop }: DropZoneProps) {
  const [active, setActive] = useState(false);
  // Always keep the latest onDrop in a ref so the global listeners don't
  // churn on prop changes.
  const onDropRef = useRef(onDrop);
  useEffect(() => {
    onDropRef.current = onDrop;
  }, [onDrop]);

  const isFileDrag = useCallback((e: DragEvent): boolean => {
    const items = e.dataTransfer?.items;
    if (!items) return false;
    for (let i = 0; i < items.length; i++) {
      if (items[i]?.kind === 'file') return true;
    }
    return false;
  }, []);

  useEffect(() => {
    let depth = 0;

    const onDragEnter = (e: DragEvent) => {
      if (!isFileDrag(e)) return;
      e.preventDefault();
      depth++;
      setActive(true);
    };
    const onDragOver = (e: DragEvent) => {
      if (!isFileDrag(e)) return;
      e.preventDefault();
      if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
    };
    const onDragLeave = (e: DragEvent) => {
      if (!isFileDrag(e)) return;
      e.preventDefault();
      depth = Math.max(0, depth - 1);
      if (depth === 0) setActive(false);
    };
    const onDropEvent = (e: DragEvent) => {
      if (!isFileDrag(e)) return;
      e.preventDefault();
      depth = 0;
      setActive(false);
      const file = e.dataTransfer?.files?.[0];
      if (file) void onDropRef.current(file);
    };

    window.addEventListener('dragenter', onDragEnter);
    window.addEventListener('dragover', onDragOver);
    window.addEventListener('dragleave', onDragLeave);
    window.addEventListener('drop', onDropEvent);
    return () => {
      window.removeEventListener('dragenter', onDragEnter);
      window.removeEventListener('dragover', onDragOver);
      window.removeEventListener('dragleave', onDragLeave);
      window.removeEventListener('drop', onDropEvent);
    };
  }, [isFileDrag]);

  return (
    <AnimatePresence>
      {active && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.16 }}
          className="pointer-events-none fixed inset-0 z-[190] flex items-center justify-center"
        >
          <div
            aria-hidden
            className="absolute inset-0 bg-[var(--atlas-accent-aurora)]/[0.06] backdrop-blur-[2px]"
          />
          <motion.div
            initial={{ scale: 0.96, y: 8 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.97, y: 4 }}
            transition={{ type: 'spring', stiffness: 320, damping: 30 }}
            className="relative rounded-2xl border-2 border-dashed border-[var(--atlas-accent-aurora)]/60 bg-black/30 px-12 py-10 text-center backdrop-blur-xl"
          >
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[var(--atlas-accent-aurora)]/[0.14]">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path
                  d="M12 4v12m0 0 4-4m-4 4-4-4M5 20h14"
                  stroke="var(--atlas-accent-aurora)"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <div className="font-display text-[18px] font-semibold text-white/95">
              Drop your JSON
            </div>
            <div className="mt-1 text-[12.5px] text-white/55">
              Atlas snapshot or any structured JSON — we&apos;ll map it
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
