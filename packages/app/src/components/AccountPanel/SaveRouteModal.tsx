import { useState } from 'react'
import { X } from '@phosphor-icons/react'
import styles from './AccountPanel.module.css'

interface SaveRouteModalProps {
  onSave: (name: string) => Promise<void>
  onClose: () => void
}

export function SaveRouteModal({ onSave, onClose }: SaveRouteModalProps) {
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setSaving(true)
    try {
      await onSave(name.trim())
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className={styles.modalBackdrop} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <span className={styles.modalTitle}>Save Route</span>
          <button className={styles.iconBtn} onClick={onClose} aria-label="Close">
            <X size={16} weight="regular" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className={styles.modalBody}>
          <input
            className={styles.nameInput}
            type="text"
            placeholder="Route name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
            maxLength={80}
          />
          <button
            type="submit"
            className={styles.saveBtn}
            disabled={!name.trim() || saving}
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </form>
      </div>
    </div>
  )
}
