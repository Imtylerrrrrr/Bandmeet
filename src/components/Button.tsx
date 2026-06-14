import Link from 'next/link';
import type { ComponentProps, ReactNode } from 'react';

// Vercel 대시보드 결의 버튼 시스템. 텍스트만 있던 링크/액션을 일관된 버튼으로.
// variant: primary(솔리드 인디고) · secondary(보더+surface) · ghost(텍스트+hover) · danger(보더 빨강)
// size: sm(컴팩트) · md(기본)

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md';

const BASE =
  'inline-flex items-center justify-center gap-1.5 rounded-lg font-medium ' +
  'transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-50 ' +
  'whitespace-nowrap select-none';

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-primary text-white hover:bg-primary-ink',
  secondary: 'border bg-surface text-ink hover:bg-hover hover:border-line-strong',
  ghost: 'text-mut hover:bg-hover hover:text-ink',
  danger:
    'border border-danger-bg bg-surface text-danger-text hover:bg-danger-bg',
};

const SIZES: Record<Size, string> = {
  sm: 'h-8 px-2.5 text-xs',
  md: 'h-9 px-3.5 text-sm',
};

export function buttonClasses(
  variant: Variant = 'secondary',
  size: Size = 'md',
  className = '',
): string {
  return `${BASE} ${VARIANTS[variant]} ${SIZES[size]} ${className}`.trim();
}

type ButtonProps = ComponentProps<'button'> & {
  variant?: Variant;
  size?: Size;
  children: ReactNode;
};

export function Button({
  variant = 'secondary',
  size = 'md',
  className = '',
  children,
  ...rest
}: ButtonProps) {
  return (
    <button className={buttonClasses(variant, size, className)} {...rest}>
      {children}
    </button>
  );
}

type ButtonLinkProps = ComponentProps<typeof Link> & {
  variant?: Variant;
  size?: Size;
  children: ReactNode;
};

export function ButtonLink({
  variant = 'secondary',
  size = 'md',
  className = '',
  children,
  ...rest
}: ButtonLinkProps) {
  return (
    <Link className={buttonClasses(variant, size, className)} {...rest}>
      {children}
    </Link>
  );
}
