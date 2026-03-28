import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { MapContextMenu } from './MapContextMenu'

const defaultProps = {
  lat: 52.12345,
  lng: 23.67890,
  x: 100,
  y: 150,
  onClose: vi.fn(),
  onSetStart: vi.fn(),
  onAddIntermediate: vi.fn(),
  onSetEnd: vi.fn(),
  onAddPoi: vi.fn(),
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.clearAllMocks()
  // Mock clipboard API
  Object.assign(navigator, {
    clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
  })
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

/** Render the menu and flush the setTimeout(0) that arms outside-click listeners */
function renderMenu(props = defaultProps) {
  const result = render(<MapContextMenu {...props} />)
  act(() => { vi.runAllTimers() })
  return result
}

describe('MapContextMenu — rendering', () => {
  it('renders coordinate row', () => {
    renderMenu()
    expect(screen.getByText(/52\.12345,\s*23\.6789/)).toBeDefined()
  })

  it('positions menu via inline style', () => {
    const { container } = renderMenu({ ...defaultProps, x: 120, y: 80 })
    const menu = container.firstChild as HTMLElement
    expect(menu.style.left).toBe('120px')
    expect(menu.style.top).toBe('80px')
  })

  it('renders all action buttons', () => {
    renderMenu()
    expect(screen.getAllByRole('button').length).toBe(6)
  })
})

describe('MapContextMenu — route actions', () => {
  it('calls onSetStart and onClose when start button is clicked', () => {
    renderMenu()
    fireEvent.click(screen.getByText(/Установить начало/i))
    expect(defaultProps.onSetStart).toHaveBeenCalledOnce()
    expect(defaultProps.onClose).toHaveBeenCalledOnce()
  })

  it('calls onAddIntermediate and onClose when intermediate button is clicked', () => {
    renderMenu()
    fireEvent.click(screen.getByText(/Добавить промежуточную/i))
    expect(defaultProps.onAddIntermediate).toHaveBeenCalledOnce()
    expect(defaultProps.onClose).toHaveBeenCalledOnce()
  })

  it('calls onSetEnd and onClose when end button is clicked', () => {
    renderMenu()
    fireEvent.click(screen.getByText(/Установить конец/i))
    expect(defaultProps.onSetEnd).toHaveBeenCalledOnce()
    expect(defaultProps.onClose).toHaveBeenCalledOnce()
  })
})

describe('MapContextMenu — POI action', () => {
  it('renders Add POI button', () => {
    renderMenu()
    expect(screen.getByText(/Добавить метку/i)).toBeDefined()
  })

  it('calls onAddPoi and onClose when Add POI button is clicked', () => {
    renderMenu()
    fireEvent.click(screen.getByText(/Добавить метку/i))
    expect(defaultProps.onAddPoi).toHaveBeenCalledOnce()
    expect(defaultProps.onClose).toHaveBeenCalledOnce()
  })
})

describe('MapContextMenu — utility actions', () => {
  it('copies coordinates to clipboard and closes', () => {
    renderMenu()
    fireEvent.click(screen.getByText(/Копировать координаты/i))
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      `${defaultProps.lat.toFixed(6)}, ${defaultProps.lng.toFixed(6)}`,
    )
    expect(defaultProps.onClose).toHaveBeenCalledOnce()
  })

  it('opens OSM link and closes', () => {
    const openSpy = vi.spyOn(window, 'open').mockReturnValue(null)
    renderMenu()
    fireEvent.click(screen.getByText(/Открыть в OSM/i))
    expect(openSpy).toHaveBeenCalledWith(
      expect.stringContaining('openstreetmap.org'),
      '_blank',
      'noreferrer',
    )
    expect(defaultProps.onClose).toHaveBeenCalledOnce()
  })
})

describe('MapContextMenu — close behaviour', () => {
  it('closes on Escape key', () => {
    renderMenu()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(defaultProps.onClose).toHaveBeenCalledOnce()
  })

  it('closes on mousedown outside the menu', () => {
    renderMenu()
    fireEvent.mouseDown(document.body)
    expect(defaultProps.onClose).toHaveBeenCalledOnce()
  })

  it('closes on touchstart outside the menu', () => {
    renderMenu()
    fireEvent.touchStart(document.body)
    expect(defaultProps.onClose).toHaveBeenCalledOnce()
  })

  it('does NOT close on mousedown inside the menu', () => {
    renderMenu()
    const coordRow = screen.getByText(/52\.12345/)
    fireEvent.mouseDown(coordRow)
    expect(defaultProps.onClose).not.toHaveBeenCalled()
  })

  it('does NOT close on touchstart inside the menu', () => {
    renderMenu()
    const coordRow = screen.getByText(/52\.12345/)
    fireEvent.touchStart(coordRow)
    expect(defaultProps.onClose).not.toHaveBeenCalled()
  })

  it('suppresses native contextmenu inside the menu', () => {
    const { container } = renderMenu()
    const menu = container.firstChild as HTMLElement
    const event = new MouseEvent('contextmenu', { bubbles: true, cancelable: true })
    menu.dispatchEvent(event)
    expect(event.defaultPrevented).toBe(true)
  })
})

describe('MapContextMenu — overflow prevention', () => {
  beforeEach(() => {
    Object.defineProperty(HTMLElement.prototype, 'offsetWidth', {
      configurable: true,
      get() { return 210 },
    })
    Object.defineProperty(HTMLElement.prototype, 'offsetHeight', {
      configurable: true,
      get() { return 200 },
    })
    Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 800 })
    Object.defineProperty(window, 'innerHeight', { writable: true, configurable: true, value: 600 })
  })

  afterEach(() => {
    Object.defineProperty(HTMLElement.prototype, 'offsetWidth', { configurable: true, get() { return 0 } })
    Object.defineProperty(HTMLElement.prototype, 'offsetHeight', { configurable: true, get() { return 0 } })
  })

  it('clamps left when menu would overflow right edge', () => {
    // x=700, menu=210, margin=8 → 800-210-8=582
    const { container } = renderMenu({ ...defaultProps, x: 700, y: 100 })
    const menu = container.firstChild as HTMLElement
    expect(menu.style.left).toBe('582px')
  })

  it('clamps top when menu would overflow bottom edge', () => {
    // y=500, menu=200, margin=8 → 600-200-8=392
    const { container } = renderMenu({ ...defaultProps, x: 100, y: 500 })
    const menu = container.firstChild as HTMLElement
    expect(menu.style.top).toBe('392px')
  })

  it('clamps left when menu would overflow left edge', () => {
    // x=2 < margin=8 → 8
    const { container } = renderMenu({ ...defaultProps, x: 2, y: 100 })
    const menu = container.firstChild as HTMLElement
    expect(menu.style.left).toBe('8px')
  })

  it('clamps top when menu would overflow top edge', () => {
    // y=3 < margin=8 → 8
    const { container } = renderMenu({ ...defaultProps, x: 100, y: 3 })
    const menu = container.firstChild as HTMLElement
    expect(menu.style.top).toBe('8px')
  })

  it('does not move menu when it fits within viewport', () => {
    const { container } = renderMenu({ ...defaultProps, x: 100, y: 100 })
    const menu = container.firstChild as HTMLElement
    expect(menu.style.left).toBe('100px')
    expect(menu.style.top).toBe('100px')
  })
})
