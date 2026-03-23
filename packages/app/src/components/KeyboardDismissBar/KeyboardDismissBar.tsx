import { useEffect, useState } from 'react'
import { CheckSquare } from '@phosphor-icons/react'
import { usePlatform } from '../../hooks/usePlatform'
import styles from './KeyboardDismissBar.module.css'

/**
 * TMA-only floating "Done" button that dismisses the virtual keyboard.
 *
 * In Telegram Mini App the OS keyboard toolbar (with checkmark/done) is not
 * rendered, so users have no way to close the keyboard without accidentally
 * tapping the map. This component listens globally for input focus and renders
 * a small dismiss button while the keyboard is visible.
 */
export function KeyboardDismissBar() {
  const { isTMA } = usePlatform()
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (!isTMA) return

    function handleFocusIn(e: FocusEvent) {
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') {
        setVisible(true)
      }
    }

    function handleFocusOut() {
      // Small delay so the button doesn't flicker when moving between inputs
      setTimeout(() => {
        const tag = (document.activeElement as HTMLElement)?.tagName
        if (tag !== 'INPUT' && tag !== 'TEXTAREA') {
          setVisible(false)
        }
      }, 100)
    }

    document.addEventListener('focusin', handleFocusIn)
    document.addEventListener('focusout', handleFocusOut)
    return () => {
      document.removeEventListener('focusin', handleFocusIn)
      document.removeEventListener('focusout', handleFocusOut)
    }
  }, [isTMA])

  if (!isTMA || !visible) return null

  function dismiss() {
    ;(document.activeElement as HTMLElement | null)?.blur()
    setVisible(false)
  }

  return (
    <button className={styles.bar} onClick={dismiss} aria-label="Done — dismiss keyboard">
      <CheckSquare size={18} weight="regular" aria-hidden />
      <span>Done</span>
    </button>
  )
}
