import { Component, type ErrorInfo, type ReactNode } from 'react'
import * as Sentry from '@sentry/react'
import styles from './ErrorBoundary.module.css'

interface Props {
  children: ReactNode
}

interface State {
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    Sentry.captureException(error, { extra: { componentStack: info.componentStack } })
  }

  render() {
    const { error } = this.state
    if (error) {
      return (
        <div className={styles.root}>
          <p className={styles.title}>Что-то пошло не так</p>
          <button
            className={styles.reloadBtn}
            onClick={() => window.location.reload()}
          >
            Перезагрузить страницу
          </button>
          <details className={styles.details}>
            <summary className={styles.summary}>Подробности</summary>
            <pre className={styles.message}>{error.message}</pre>
          </details>
        </div>
      )
    }
    return this.props.children
  }
}
