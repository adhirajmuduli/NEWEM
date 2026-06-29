import React from 'react';
import { cn } from '@/lib/utils';
import { BorderBeam } from './border-beam';
import { ShimmerButton } from './shimmer-button';
import { ShinyButton } from './shiny-button';

export type DigitalButtonEffect = 'plain' | 'shiny' | 'shimmer' | 'neon' | 'beam';

export type DigitalButtonProps = React.ComponentPropsWithoutRef<'button'> & {
  effect?: DigitalButtonEffect;
};

export function DigitalButton({ effect = 'plain', className, children, ...props }: DigitalButtonProps) {
  if (effect === 'shiny') {
    return <ShinyButton className={cn('digital-button digital-button-shiny', className)} {...props}>{children}</ShinyButton>;
  }
  if (effect === 'shimmer') {
    return (
      <ShimmerButton
        borderRadius="6px"
        background="var(--control-bg)"
        shimmerColor="var(--accent-contrast)"
        className={cn('digital-button digital-button-shimmer', className)}
        {...props}
      >
        {children}
      </ShimmerButton>
    );
  }

  return (
    <button className={cn('digital-button', effect !== 'plain' && 'digital-button-' + effect, className)} {...props}>
      <span className="digital-button-content">{children}</span>
      {effect === 'beam' ? <BorderBeam size={32} duration={4} colorFrom="var(--accent)" colorTo="var(--accent-2)" /> : null}
    </button>
  );
}