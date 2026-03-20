import type { ReactNode } from 'react'

interface ChipProps {
  icon?: ReactNode
  label: string
  title?: string
  className?: string
}

export function Chip({ icon, label, title, className }: ChipProps) {
  return (
    <span
      title={title}
      className={className}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.3rem',
        background: 'var(--surface-container-high)',
        borderRadius: 'var(--radius-full)',
        padding: '0.3rem 0.7rem',
        fontSize: '0.75rem',
        fontWeight: 600,
        color: 'var(--primary)',
        fontFamily: 'var(--font-family)',
        whiteSpace: 'nowrap',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.55)',
        letterSpacing: '0.01em',
      }}
    >
      {icon}
      {label}
    </span>
  )
}
