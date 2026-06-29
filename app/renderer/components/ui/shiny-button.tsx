import React from 'react';
import { cn } from '@/lib/utils';

export type ShinyButtonProps = React.ComponentPropsWithoutRef<'button'>;

export const ShinyButton = React.forwardRef<HTMLButtonElement, ShinyButtonProps>(
  ({ children, className, ...props }, ref) => (
    <button ref={ref} className={cn('shiny-button', className)} {...props}>
      <span className="shiny-button-label">{children}</span>
    </button>
  )
);

ShinyButton.displayName = 'ShinyButton';