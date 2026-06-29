import React from 'react';
import { cn } from '@/lib/utils';

export type MagicCardProps = React.HTMLAttributes<HTMLElement> & {
  as?: 'article' | 'div';
  gradientSize?: number;
  gradientFrom?: string;
  gradientTo?: string;
};

export function MagicCard({
  as: Component = 'div',
  className,
  gradientSize = 220,
  gradientFrom = 'var(--accent)',
  gradientTo = 'var(--accent-2)',
  style,
  onPointerMove,
  onPointerLeave,
  ...props
}: MagicCardProps) {
  const move = (event: React.PointerEvent<HTMLElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    event.currentTarget.style.setProperty('--magic-x', String(event.clientX - rect.left) + 'px');
    event.currentTarget.style.setProperty('--magic-y', String(event.clientY - rect.top) + 'px');
    onPointerMove?.(event);
  };
  const leave = (event: React.PointerEvent<HTMLElement>) => {
    event.currentTarget.style.removeProperty('--magic-x');
    event.currentTarget.style.removeProperty('--magic-y');
    onPointerLeave?.(event);
  };

  return (
    <Component
      className={cn('magic-card', className)}
      style={{
        '--magic-size': String(gradientSize) + 'px',
        '--magic-from': gradientFrom,
        '--magic-to': gradientTo,
        backdropFilter: 'blur(18px) saturate(145%)',
        WebkitBackdropFilter: 'blur(18px) saturate(145%)',
        ...style,
      } as React.CSSProperties}
      onPointerMove={move}
      onPointerLeave={leave}
      {...props}
    />
  );
}