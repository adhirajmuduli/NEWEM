import React from 'react';
import { cn } from '@/lib/utils';

export type BorderBeamProps = {
  size?: number;
  duration?: number;
  delay?: number;
  colorFrom?: string;
  colorTo?: string;
  className?: string;
  reverse?: boolean;
  initialOffset?: number;
  borderWidth?: number;
};

export function BorderBeam({
  className,
  size = 50,
  delay = 0,
  duration = 6,
  colorFrom = '#ffaa40',
  colorTo = '#9c40ff',
  reverse = false,
  initialOffset = 0,
  borderWidth = 1,
}: BorderBeamProps) {
  return (
    <span
      aria-hidden="true"
      className="border-beam"
      style={{ '--beam-width': String(borderWidth) + 'px' } as React.CSSProperties}
    >
      <span
        className={cn('border-beam-runner', className)}
        style={{
          width: size,
          height: size,
          background: 'linear-gradient(90deg, transparent, ' + colorFrom + ', ' + colorTo + ', transparent)',
          animationDuration: String(duration) + 's',
          animationDelay: String(-delay) + 's',
          animationDirection: reverse ? 'reverse' : 'normal',
          offsetDistance: String(initialOffset) + '%',
        }}
      />
    </span>
  );
}