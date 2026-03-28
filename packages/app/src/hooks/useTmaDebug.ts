import { useEffect, useRef, useState } from 'react'

export interface TmaDebugSnapshot {
  timestamp: string
  event: string
  innerWidth: number
  innerHeight: number
  isExpanded: boolean | undefined
  viewportHeight: number | undefined
  viewportStableHeight: number | undefined
  tgViewportStableHeight: string | null
  tmaVh: string | null
  initDataLength: number
  rootHeight: string
  rootOffsetHeight: number
  mobileBottomBar: string
  mobileMapRow: string
  mobileGrid: string
  bottomSheet: string
  appShellLayout: string
}

function describeFound(el: Element | undefined): string {
  if (!el) return 'not-found'
  const r = el.getBoundingClientRect()
  return `${Math.round(r.width)}×${Math.round(r.height)} @y${Math.round(r.top)}`
}

function takeSnapshot(event: string): TmaDebugSnapshot {
  const webApp = window.Telegram?.WebApp
  const root = document.getElementById('root')

  const allDivs = Array.from(document.querySelectorAll('div'))
  const findByClass = (fragment: string) =>
    allDivs.find((d) => Array.from(d.classList).some((c) => c.includes(fragment)))

  const mobileGridEl = findByClass('mobileGrid')
  const mobileMapRowEl = findByClass('mobileMapRow')
  const mobileBottomBarEl = findByClass('mobileBottomBar')
  const desktopGridEl = findByClass('desktopGrid')
  const sheetEl = findByClass('sheet')

  return {
    timestamp: new Date().toISOString().slice(11, 23),
    event,
    innerWidth: window.innerWidth,
    innerHeight: window.innerHeight,
    isExpanded: webApp?.isExpanded,
    viewportHeight: webApp?.viewportHeight,
    viewportStableHeight: webApp?.viewportStableHeight,
    tgViewportStableHeight: getComputedStyle(document.documentElement).getPropertyValue('--tg-viewport-stable-height') || null,
    tmaVh: getComputedStyle(document.documentElement).getPropertyValue('--tma-vh') || null,
    initDataLength: webApp?.initData?.length ?? -1,
    rootHeight: root ? getComputedStyle(root).height : 'N/A',
    rootOffsetHeight: root?.offsetHeight ?? -1,
    mobileBottomBar: describeFound(mobileBottomBarEl),
    mobileMapRow: describeFound(mobileMapRowEl),
    mobileGrid: describeFound(mobileGridEl),
    bottomSheet: describeFound(sheetEl),
    appShellLayout: desktopGridEl ? 'desktop' : mobileGridEl ? 'mobile' : 'unknown',
  }
}

export function useTmaDebug() {
  const [logs, setLogs] = useState<TmaDebugSnapshot[]>([])
  const attached = useRef(false)

  useEffect(() => {
    if (attached.current) return
    attached.current = true

    const push = (event: string) => {
      const snap = takeSnapshot(event)
      console.log('[TMA-DEBUG]', event, snap)
      setLogs((prev) => [...prev.slice(-29), snap]) // keep last 30
    }

    // Initial snapshot
    push('mount')

    // Resize
    const onResize = () => push('resize')
    window.addEventListener('resize', onResize)

    // TMA viewportChanged
    const webApp = window.Telegram?.WebApp
    if (webApp) {
      const onViewport = (evt?: { isStateStable?: boolean }) => {
        push(`viewportChanged(stable=${evt?.isStateStable})`)
      }
      webApp.onEvent('viewportChanged', onViewport as () => void)
    }

    // Periodic check every 2s for 30s after mount (catches delayed expand)
    let ticks = 0
    const interval = setInterval(() => {
      ticks++
      push(`tick-${ticks}`)
      if (ticks >= 15) clearInterval(interval)
    }, 2000)

    return () => {
      window.removeEventListener('resize', onResize)
      clearInterval(interval)
    }
  }, [])

  return logs
}
