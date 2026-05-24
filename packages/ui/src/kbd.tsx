'use client';

import type { HTMLAttributes } from 'react';
import { cn } from './cn';

interface KbdProps extends HTMLAttributes<HTMLElement> {
  /** Render with a slightly stronger surface for emphasis. */
  strong?: boolean;
}

/** Single-glyph keyboard hint, sized to inline with body text. */
export function Kbd({ children, strong, className, ...rest }: KbdProps) {
  return (
    <kbd
      className={cn(
        'inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-[5px] border px-[5px] font-mono text-[10.5px] font-medium leading-none tracking-tight',
        strong
          ? 'border-white/15 bg-white/[0.08] text-white/80'
          : 'border-white/10 bg-white/[0.04] text-white/55',
        className,
      )}
      {...rest}
    >
      {children}
    </kbd>
  );
}
