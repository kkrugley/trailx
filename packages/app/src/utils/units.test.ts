import { describe, it, expect } from 'vitest'
import { fmtDist, fmtElev, fmtSpeed, displayToKph, kphToDisplay, speedUnit } from './units'

describe('fmtDist', () => {
  describe('km unit', () => {
    it('formats metres below 1000 as "m"', () => {
      expect(fmtDist(500, 'km')).toBe('500 m')
    })

    it('rounds sub-km values', () => {
      expect(fmtDist(750, 'km')).toBe('750 m')
    })

    it('formats values >= 1000 as km with one decimal', () => {
      expect(fmtDist(1000, 'km')).toBe('1.0 km')
      expect(fmtDist(1500, 'km')).toBe('1.5 km')
      expect(fmtDist(12345, 'km')).toBe('12.3 km')
    })
  })

  describe('mi unit', () => {
    it('formats short distances as feet', () => {
      // 50m → ~164 ft
      const result = fmtDist(50, 'mi')
      expect(result).toMatch(/ft$/)
    })

    it('formats distances >= 0.1 mi as miles', () => {
      // 1000m = 0.621 mi
      expect(fmtDist(1000, 'mi')).toBe('0.6 mi')
    })

    it('formats longer distances with one decimal', () => {
      // 10000m = 6.21 mi
      expect(fmtDist(10000, 'mi')).toBe('6.2 mi')
    })
  })
})

describe('fmtElev', () => {
  it('formats metres in km mode', () => {
    expect(fmtElev(100, 'km')).toBe('100 m')
    expect(fmtElev(1234, 'km')).toBe('1234 m')
  })

  it('converts to feet in mi mode', () => {
    // 100m * 3.28084 ≈ 328 ft
    expect(fmtElev(100, 'mi')).toBe('328 ft')
  })

  it('rounds to integer', () => {
    expect(fmtElev(0, 'km')).toBe('0 m')
    expect(fmtElev(0, 'mi')).toBe('0 ft')
  })
})

describe('fmtSpeed', () => {
  it('formats km/h in km mode', () => {
    expect(fmtSpeed(20, 'km')).toBe('20 км/ч')
  })

  it('converts to mph in mi mode and rounds', () => {
    // 20 kph * 0.621371 ≈ 12.4 → 12 mph
    expect(fmtSpeed(20, 'mi')).toBe('12 mph')
  })
})

describe('displayToKph', () => {
  it('returns value unchanged in km mode', () => {
    expect(displayToKph(20, 'km')).toBe(20)
  })

  it('converts mph to kph in mi mode', () => {
    // 12 mph / 0.621371 ≈ 19.3 → 19
    expect(displayToKph(12, 'mi')).toBe(19)
  })
})

describe('kphToDisplay', () => {
  it('returns kph unchanged in km mode', () => {
    expect(kphToDisplay(20, 'km')).toBe(20)
  })

  it('converts kph to mph in mi mode', () => {
    // 20 kph * 0.621371 ≈ 12.4 → 12
    expect(kphToDisplay(20, 'mi')).toBe(12)
  })
})

describe('speedUnit', () => {
  it('returns km/h label in km mode', () => {
    expect(speedUnit('km')).toBe('км/ч')
  })

  it('returns mph label in mi mode', () => {
    expect(speedUnit('mi')).toBe('mph')
  })
})
