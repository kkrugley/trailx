import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { POICard } from './POICard'
import type { POI } from '@trailx/shared'

// Mock the store
vi.mock('../../store/useMapStore', () => ({
  useMapStore: vi.fn((selector: (s: unknown) => unknown) => {
    const state = {
      standalonePois: [],
      actions: {
        addStandalonePoi: vi.fn(),
        removeStandalonePoi: vi.fn(),
        insertWaypointNear: vi.fn(),
      },
    }
    return selector(state)
  }),
}))

const mockPoi: POI = {
  id: 'poi-1',
  lat: 52.12345,
  lng: 23.67890,
  name: 'Test Water Point',
  category: 'drinking_water',
  osmId: 123,
  osmType: 'node',
  tags: {},
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('POICard — view mode (existing POI)', () => {
  it('renders POI name when poi is provided', () => {
    render(<POICard poi={mockPoi} onClose={vi.fn()} />)
    expect(screen.getByText('Test Water Point')).toBeDefined()
  })

  it('renders category label', () => {
    render(<POICard poi={mockPoi} onClose={vi.fn()} />)
    expect(screen.getByText('Вода')).toBeDefined()
  })

  it('renders coordinates', () => {
    render(<POICard poi={mockPoi} onClose={vi.fn()} />)
    expect(screen.getByText(/52\.12345/)).toBeDefined()
  })

  it('calls onClose when close button is clicked', () => {
    const onClose = vi.fn()
    render(<POICard poi={mockPoi} onClose={onClose} />)
    const closeBtn = screen.getByLabelText('Close')
    fireEvent.click(closeBtn)
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('renders nothing visible when poi is null and no draft', () => {
    const { container } = render(<POICard poi={null} onClose={vi.fn()} />)
    // Overlay is present but not active (no pointer events)
    const overlay = container.firstChild as HTMLElement
    expect(overlay.style.pointerEvents).not.toBe('auto')
  })
})

describe('POICard — create mode (draft)', () => {
  it('renders "Новая метка" heading in draft mode', () => {
    render(<POICard poi={null} onClose={vi.fn()} draft={{ lat: 52.1, lng: 23.5 }} />)
    expect(screen.getByText('Новая метка')).toBeDefined()
  })

  it('renders name input and category select', () => {
    render(<POICard poi={null} onClose={vi.fn()} draft={{ lat: 52.1, lng: 23.5 }} />)
    expect(screen.getByPlaceholderText('Название метки')).toBeDefined()
    expect(screen.getByRole('combobox')).toBeDefined()
  })

  it('renders "Сохранить метку" save button', () => {
    render(<POICard poi={null} onClose={vi.fn()} draft={{ lat: 52.1, lng: 23.5 }} />)
    expect(screen.getByText('Сохранить метку')).toBeDefined()
  })

  it('renders draft coordinates in header', () => {
    render(<POICard poi={null} onClose={vi.fn()} draft={{ lat: 52.1, lng: 23.5 }} />)
    expect(screen.getByText(/52\.10000/)).toBeDefined()
  })

  it('calls addStandalonePoi with correct shape and closes on save', async () => {
    const storeModule = await import('../../store/useMapStore')
    const mockAddStandalonePoi = vi.fn()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(storeModule.useMapStore).mockImplementation((selector: (s: any) => any) => {
      return selector({
        standalonePois: [],
        actions: { addStandalonePoi: mockAddStandalonePoi, removeStandalonePoi: vi.fn(), insertWaypointNear: vi.fn() },
      })
    })

    const onClose = vi.fn()
    render(<POICard poi={null} onClose={onClose} draft={{ lat: 52.1, lng: 23.5 }} />)

    const nameInput = screen.getByPlaceholderText('Название метки')
    fireEvent.change(nameInput, { target: { value: 'My Custom Marker' } })
    fireEvent.click(screen.getByText('Сохранить метку'))

    expect(mockAddStandalonePoi).toHaveBeenCalledOnce()
    const savedPoi = mockAddStandalonePoi.mock.calls[0][0] as POI
    expect(savedPoi.name).toBe('My Custom Marker')
    expect(savedPoi.lat).toBe(52.1)
    expect(savedPoi.lng).toBe(23.5)
    expect(savedPoi.category).toBe('custom')
    expect(savedPoi.osmType).toBe('node')
    expect(savedPoi.id).toMatch(/^manual-/)
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('uses coordinates as fallback name when name input is empty', async () => {
    const storeModule = await import('../../store/useMapStore')
    const mockAddStandalonePoi = vi.fn()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(storeModule.useMapStore).mockImplementation((selector: (s: any) => any) => {
      return selector({
        standalonePois: [],
        actions: { addStandalonePoi: mockAddStandalonePoi, removeStandalonePoi: vi.fn(), insertWaypointNear: vi.fn() },
      })
    })

    const onClose = vi.fn()
    render(<POICard poi={null} onClose={onClose} draft={{ lat: 52.1, lng: 23.5 }} />)
    fireEvent.click(screen.getByText('Сохранить метку'))

    const savedPoi = mockAddStandalonePoi.mock.calls[0][0] as POI
    expect(savedPoi.name).toBe('52.10000, 23.50000')
  })
})
