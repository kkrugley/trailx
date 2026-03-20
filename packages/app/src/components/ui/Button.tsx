import type { ButtonHTMLAttributes, ReactNode } from 'react'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'ghost' | 'icon'
  size?: 'sm' | 'md'
  children?: ReactNode
}

export function Button({ variant = 'ghost', size = 'md', children, style, ...rest }: ButtonProps) {
  const base: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.375rem',
    border: 'none',
    cursor: 'pointer',
    fontFamily: 'var(--font-family)',
    fontWeight: 500,
    transition: 'opacity 0.15s ease',
  }

  const variants: Record<string, React.CSSProperties> = {
    primary: {
      background: 'linear-gradient(145deg, #151415, #2a2829)',
      color: 'var(--on-primary)',
      borderRadius: 'var(--radius-xl)',
      padding: size === 'sm' ? '0.4rem 0.875rem' : '0.625rem 1.25rem',
      fontSize: size === 'sm' ? '0.8125rem' : '0.9375rem',
    },
    ghost: {
      background: 'transparent',
      color: 'var(--primary)',
      borderRadius: 'var(--radius-md)',
      padding: size === 'sm' ? '0.375rem 0.625rem' : '0.5rem 0.875rem',
      fontSize: size === 'sm' ? '0.8125rem' : '0.875rem',
    },
    icon: {
      background: 'var(--surface-variant)',
      backdropFilter: 'blur(20px)',
      WebkitBackdropFilter: 'blur(20px)',
      color: 'var(--primary)',
      borderRadius: 'var(--radius-full)',
      width: size === 'sm' ? '36px' : '44px',
      height: size === 'sm' ? '36px' : '44px',
      padding: 0,
      fontSize: '1rem',
    },
  }

  return (
    <button style={{ ...base, ...variants[variant], ...style }} {...rest}>
      {children}
    </button>
  )
}
