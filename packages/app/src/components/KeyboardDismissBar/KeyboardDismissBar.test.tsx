import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act, fireEvent } from '@testing-library/react'
import { KeyboardDismissBar } from './KeyboardDismissBar'

// Mock usePlatform so we can control isTMA in each test
vi.mock('../../hooks/usePlatform', () => ({
  usePlatform: vi.fn(),
}))

import { usePlatform } from '../../hooks/usePlatform'
const mockUsePlatform = vi.mocked(usePlatform)

function simulateFocusIn(tag: 'INPUT' | 'TEXTAREA' | 'DIV' = 'INPUT') {
  const el = { tagName: tag } as EventTarget & { tagName: string }
  act(() => {
    document.dispatchEvent(new FocusEvent('focusin', { bubbles: true, relatedTarget: null }))
    // Override target via Object.defineProperty since FocusEvent target is read-only
    Object.defineProperty(document.createEvent('Event'), 'target', { value: el })
    // Dispatch with a real element so the listener sees e.target.tagName
    const input = document.createElement(tag.toLowerCase() as 'input' | 'textarea' | 'div')
    document.body.appendChild(input)
    input.dispatchEvent(new FocusEvent('focusin', { bubbles: true }))
    document.body.removeChild(input)
  })
}


describe('KeyboardDismissBar', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.clearAllMocks()
  })

  it('renders nothing outside TMA', () => {
    mockUsePlatform.mockReturnValue({ isTMA: false, isMobile: true, showBottomNav: true })
    const { container } = render(<KeyboardDismissBar />)
    expect(container.firstChild).toBeNull()
  })

  it('renders nothing in TMA before any input is focused', () => {
    mockUsePlatform.mockReturnValue({ isTMA: true, isMobile: true, showBottomNav: true })
    render(<KeyboardDismissBar />)
    expect(screen.queryByRole('button', { name: /done/i })).toBeNull()
  })

  it('shows Done button in TMA when an input is focused', async () => {
    mockUsePlatform.mockReturnValue({ isTMA: true, isMobile: true, showBottomNav: true })
    render(<KeyboardDismissBar />)

    simulateFocusIn('INPUT')

    expect(screen.getByRole('button', { name: /done.*dismiss keyboard/i })).toBeInTheDocument()
  })

  it('shows Done button in TMA when a textarea is focused', () => {
    mockUsePlatform.mockReturnValue({ isTMA: true, isMobile: true, showBottomNav: true })
    render(<KeyboardDismissBar />)

    simulateFocusIn('TEXTAREA')

    expect(screen.getByRole('button', { name: /done.*dismiss keyboard/i })).toBeInTheDocument()
  })

  it('does not show Done button when a non-input element is focused', () => {
    mockUsePlatform.mockReturnValue({ isTMA: true, isMobile: true, showBottomNav: true })
    render(<KeyboardDismissBar />)

    simulateFocusIn('DIV')

    expect(screen.queryByRole('button', { name: /done.*dismiss keyboard/i })).toBeNull()
  })

  it('hides Done button after blur when focus moves to non-input element', async () => {
    mockUsePlatform.mockReturnValue({ isTMA: true, isMobile: true, showBottomNav: true })
    render(<KeyboardDismissBar />)

    simulateFocusIn('INPUT')
    expect(screen.getByRole('button', { name: /done.*dismiss keyboard/i })).toBeInTheDocument()

    // Move focus to a non-input element (document.activeElement will be body)
    act(() => {
      document.body.focus()
      document.dispatchEvent(new FocusEvent('focusout', { bubbles: true }))
    })
    act(() => { vi.advanceTimersByTime(150) })

    expect(screen.queryByRole('button', { name: /done.*dismiss keyboard/i })).toBeNull()
  })

  it('calls blur on active element when Done is clicked', async () => {
    mockUsePlatform.mockReturnValue({ isTMA: true, isMobile: true, showBottomNav: true })
    render(<KeyboardDismissBar />)

    // Create and focus a real input so document.activeElement is set
    const input = document.createElement('input')
    document.body.appendChild(input)
    act(() => { input.focus() })
    // Trigger the focusin listener
    act(() => { input.dispatchEvent(new FocusEvent('focusin', { bubbles: true })) })

    const blurSpy = vi.spyOn(input, 'blur')
    const btn = screen.getByRole('button', { name: /done.*dismiss keyboard/i })
    fireEvent.click(btn)

    expect(blurSpy).toHaveBeenCalled()
    document.body.removeChild(input)
  })
})
