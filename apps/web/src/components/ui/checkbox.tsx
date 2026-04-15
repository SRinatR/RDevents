import * as React from 'react';
import { cn } from '@/lib/utils';

export type CheckboxProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'>;

const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      type="checkbox"
      className={cn(
        'h-4 w-4 cursor-pointer rounded-[6px] border border-input bg-[var(--color-surface)] text-primary shadow-[var(--shadow-xs)] focus:ring-2 focus:ring-primary/70 focus:ring-offset-2',
        className,
      )}
      {...props}
    />
  ),
);
Checkbox.displayName = 'Checkbox';

export { Checkbox };
