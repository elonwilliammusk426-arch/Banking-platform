import * as React from 'react';
import { cn } from '@/lib/utils';

type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'ghost' | 'danger'; size?: 'sm' | 'md' | 'icon' };

export const Button = React.forwardRef<HTMLButtonElement, Props>(({ className, variant = 'primary', size = 'md', ...props }, ref) => (
  <button ref={ref} className={cn(
    'inline-flex items-center justify-center gap-2 rounded-[10px] font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cobalt/40 disabled:pointer-events-none disabled:opacity-50',
    variant === 'primary' && 'bg-cobalt text-white shadow-[0_5px_16px_rgba(73,99,232,.22)] hover:bg-[#3c55d5]',
    variant === 'secondary' && 'border border-slate-200 bg-white text-ink hover:bg-slate-50',
    variant === 'ghost' && 'bg-transparent text-slate-500 hover:bg-slate-100 hover:text-ink',
    variant === 'danger' && 'bg-red-600 text-white hover:bg-red-700',
    size === 'md' && 'h-10 px-4 text-xs', size === 'sm' && 'h-8 px-3 text-[11px]', size === 'icon' && 'size-9 p-0',
    className,
  )} {...props} />
));
Button.displayName = 'Button';
