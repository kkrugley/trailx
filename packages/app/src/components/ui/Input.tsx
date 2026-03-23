import type { InputHTMLAttributes, ReactNode } from 'react'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  icon?: ReactNode
}

export function Input({ icon, style, ...rest }: InputProps) {
  return (
    <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
      {icon && (
        <span
          style={{
            position: 'absolute',
            left: '0.75rem',
            display: 'flex',
            alignItems: 'center',
            pointerEvents: 'none',
            color: 'var(--primary)',
            opacity: 0.5,
          }}
        >
          {icon}
        </span>
      )}
      <input
        style={{
          width: '100%',
          background: 'var(--surface-container)',
          border: 'none',
          borderRadius: 'var(--radius-md)',
          padding: icon ? '0.5rem 0.75rem 0.5rem 2.25rem' : '0.5rem 0.75rem',
          fontFamily: 'var(--font-family)',
          fontSize: '1rem',
          color: 'var(--primary)',
          outline: 'none',
          ...style,
        }}
        {...rest}
      />
    </div>
  )
}
