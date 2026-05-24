'use client';

import type { HTMLAttributes, Ref } from 'react';
import { cn } from './cn';

type Elevation = 'raised' | 'floating' | 'command' | 'modal';

interface GlassProps extends HTMLAttributes<HTMLDivElement> {
  elevation?: Elevation;
  /** When true, applies a subtle interior gradient for emphasis surfaces. */
  luminous?: boolean;
  /** React 19 idiom — pass ref as a regular prop. */
  ref?: Ref<HTMLDivElement>;
}

const ELEVATION_CLASSES: Record<Elevation, string> = {
  raised:
    'bg-[var(--atlas-glass-base)] backdrop-blur-[var(--atlas-blur-raised)] backdrop-saturate-150 border-[var(--atlas-glass-border)]',
  floating:
    'bg-[var(--atlas-glass-raised)] backdrop-blur-[var(--atlas-blur-floating)] backdrop-saturate-150 border-[var(--atlas-glass-border)]',
  command:
    'bg-[var(--atlas-glass-floating)] backdrop-blur-[var(--atlas-blur-command)] backdrop-saturate-200 border-[var(--atlas-glass-border-strong)]',
  modal:
    'bg-[var(--atlas-glass-floating)] backdrop-blur-[var(--atlas-blur-modal)] backdrop-saturate-200 border-[var(--atlas-glass-border-strong)]',
};

/**
 * The signature Atlas surface. Combines backdrop blur, tinted background,
 * subtle inner highlight, and elevation-coupled shadow.
 *
 * Migrated to React 19's ref-as-prop pattern — forwardRef's
 * ForwardRefExoticComponent type doesn't satisfy the new component
 * signature in React 19's stricter JSX runtime.
 */
export function Glass({
  elevation = 'floating',
  luminous = false,
  className,
  children,
  ref,
  ...rest
}: GlassProps) {
  return (
    <div
      ref={ref}
      className={cn(
        'relative isolate rounded-[var(--atlas-radius-lg)] border shadow-[0_12px_32px_rgba(0,0,0,0.5),0_4px_12px_rgba(0,0,0,0.3)]',
        ELEVATION_CLASSES[elevation],
        className,
      )}
      {...rest}
    >
      {/* Inner top highlight — gives glass the lit-from-above quality */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-[inherit] bg-gradient-to-b from-white/[0.06] to-transparent"
      />
      {luminous && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-[inherit] opacity-60"
          style={{
            background:
              'radial-gradient(120% 80% at 50% -10%, rgba(124,198,255,0.18), transparent 60%)',
          }}
        />
      )}
      <div className="relative">{children}</div>
    </div>
  );
}
