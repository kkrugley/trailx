import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { createRef } from 'react'

// ── Mocks ─────────────────────────────────────────────────────────────────────

const { MockMap } = vi.hoisted(() => ({ MockMap: vi.fn() }))

vi.mock('maplibre-gl', () => ({
  default: { Map: MockMap },
  setWorkerUrl: vi.fn(),
  Map: MockMap,
}))

vi.mock('maplibre-gl/dist/maplibre-gl.css', () => ({}))

vi.mock('../../store/useMapStore', () => ({
  useMapStore: vi.fn((selector: (s: unknown) => unknown) => {
    const state = {
      waypoints: [],
      routeResult: null,
      isRouting: false,
      hoveredRoutePosition: null,
      pois: [],
      standalonePois: [],
      isSearchingPOI: false,
      appSettings: { mapStyle: 'liberty', language: 'ru' },
      actions: {
        setSelectedPOI: vi.fn(),
        updateWaypoint: vi.fn(),
        addIntermediateAt: vi.fn(),
        setNewPoiDraft: vi.fn(),
      },
    }
    return selector(state)
  }),
}))

vi.mock('../../hooks/usePOISearch', () => ({ usePOISearch: vi.fn() }))
vi.mock('../../hooks/useMeasureSync', () => ({ useMeasureSync: vi.fn() }))
vi.mock('../../hooks/useTelegramWebApp', () => ({
  useTelegramWebApp: vi.fn(() => ({ haptic: { impactOccurred: vi.fn() } })),
}))
vi.mock('../../services/nominatim', () => ({ reverseGeocode: vi.fn() }))
vi.mock('../../i18n/useT', () => ({
  useT: vi.fn(() => ({
    mapView: {
      buildingRoute: 'Building route…',
      searchingPoi: 'Searching POI…',
      webglUnavailableTitle: 'Map cannot load',
      webglUnavailableBody: 'WebGL is not available.',
      webglUnavailableLink: 'How to enable WebGL',
      webglUnavailableReload: 'Reload',
    },
  })),
}))

// ── Helpers ───────────────────────────────────────────────────────────────────

/** jsdom already returns null for getContext('webgl'), so WebGL is disabled by default.
 *  This helper makes it explicit in tests that rely on the no-WebGL path. */
function disableWebGL() {
  const original = document.createElement.bind(document)
  vi.spyOn(document, 'createElement').mockImplementation((tag: string, ...args) => {
    const el = original(tag, ...args)
    if (tag === 'canvas') {
      vi.spyOn(el as HTMLCanvasElement, 'getContext').mockReturnValue(null)
    }
    return el
  })
}

/** Patch document.createElement so that <canvas>.getContext() returns a truthy stub (WebGL available). */
function enableWebGL() {
  const original = document.createElement.bind(document)
  vi.spyOn(document, 'createElement').mockImplementation((tag: string, ...args) => {
    const el = original(tag, ...args)
    if (tag === 'canvas') {
      vi.spyOn(el as HTMLCanvasElement, 'getContext').mockReturnValue({} as unknown as RenderingContext)
    }
    return el
  })
}

// ── Tests ──────────────────────────────────────────────────────────────────────

import type { MapViewHandle } from './MapView'
import { MapView } from './MapView'

describe('MapView — WebGL fallback', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renders fallback UI when WebGL is unavailable', () => {
    disableWebGL()

    render(<MapView ref={createRef<MapViewHandle>()} />)

    expect(screen.getByText('Map cannot load')).toBeDefined()
    expect(screen.getByText('WebGL is not available.')).toBeDefined()
    expect(screen.getByRole('button', { name: 'Reload' })).toBeDefined()
    expect(screen.getByRole('link', { name: 'How to enable WebGL' })).toBeDefined()
  })

  it('does not call new maplibregl.Map when WebGL is unavailable', () => {
    disableWebGL()

    render(<MapView ref={createRef<MapViewHandle>()} />)

    expect(MockMap).not.toHaveBeenCalled()
  })

  it('renders fallback when Map constructor throws despite WebGL being available', () => {
    enableWebGL()
    MockMap.mockImplementationOnce(() => {
      throw new Error('WebGL creation failed')
    })

    render(<MapView ref={createRef<MapViewHandle>()} />)

    expect(screen.getByText('Map cannot load')).toBeDefined()
  })
})
