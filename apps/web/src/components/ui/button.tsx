import * as React from "react";
import { cn } from "@/lib/utils";

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'outline' | 'secondary' | 'ghost' | 'destructive';
  size?: 'default' | 'sm' | 'lg' | 'icon';
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'default', size = 'default', ...props }, ref) => {
    return (
      <button
        className={cn(
          "inline-flex items-center justify-center gap-2 rounded-md border text-sm font-semibold tracking-[0.01em] transition-[background-color,color,border-color,box-shadow,transform] duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/70 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-55",
          {
            'border-primary bg-primary text-primary-foreground shadow-primary hover:-translate-y-0.5 hover:bg-[#1947b3] hover:shadow-[var(--shadow-primary-lg)] active:translate-y-0': variant === 'default',
            'border-input bg-background text-foreground shadow-xs hover:-translate-y-0.5 hover:border-primary/35 hover:bg-card': variant === 'outline',
            'border-[var(--color-border-soft)] bg-[var(--color-surface-elevated)] text-secondary-foreground shadow-xs hover:-translate-y-0.5 hover:border-primary/25 hover:text-[var(--color-text-primary)]': variant === 'secondary',
            'border-transparent bg-transparent text-[var(--color-text-secondary)] hover:border-[var(--color-border-soft)] hover:bg-[var(--color-surface-overlay)] hover:text-foreground': variant === 'ghost',
            'border-destructive bg-destructive text-destructive-foreground shadow-[0_10px_24px_rgba(176,51,51,0.24)] hover:-translate-y-0.5 hover:bg-[#9f2d2d]': variant === 'destructive',
            'h-10 px-4 py-2': size === 'default',
            'h-9 rounded-md px-3 text-[0.82rem]': size === 'sm',
            'h-11 rounded-lg px-8 text-[0.98rem]': size === 'lg',
            'h-10 w-10': size === 'icon',
          },
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button };
