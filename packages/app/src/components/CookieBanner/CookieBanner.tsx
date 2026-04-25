import { useState } from 'react'
import { usePlatform } from '../../hooks/usePlatform'
import styles from './CookieBanner.module.css'

export function CookieBanner() {
  const { isTMA } = usePlatform()
  const [dismissed, setDismissed] = useState(() =>
    localStorage.getItem('cookie_consent') === 'accepted'
  )

  if (isTMA || dismissed) return null

  return (
    <div className={styles.banner} role="region" aria-label="Cookie consent">
      <p className={styles.text}>
        We use cookies for authentication. By continuing to use the site, you agree to their use.
      </p>
      <button
        className={styles.btn}
        onClick={() => {
          localStorage.setItem('cookie_consent', 'accepted')
          setDismissed(true)
        }}
      >
        Accept
      </button>
    </div>
  )
}
