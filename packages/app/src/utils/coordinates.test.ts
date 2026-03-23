import { describe, it, expect } from 'vitest'
import { parseCoordinates } from '@trailx/shared'

describe('parseCoordinates', () => {
  describe('decimal format', () => {
    it('parses comma-separated decimal coordinates', () => {
      expect(parseCoordinates('50.45, 30.52')).toEqual({ lat: 50.45, lng: 30.52 })
    })

    it('parses space-separated decimal coordinates', () => {
      expect(parseCoordinates('50.45 30.52')).toEqual({ lat: 50.45, lng: 30.52 })
    })

    it('parses negative coordinates', () => {
      expect(parseCoordinates('-33.87, 151.21')).toEqual({ lat: -33.87, lng: 151.21 })
    })

    it('parses integer coordinates', () => {
      expect(parseCoordinates('0, 0')).toEqual({ lat: 0, lng: 0 })
    })

    it('parses boundary coordinates (poles)', () => {
      expect(parseCoordinates('90, 0')).toEqual({ lat: 90, lng: 0 })
      expect(parseCoordinates('-90, 0')).toEqual({ lat: -90, lng: 0 })
    })

    it('parses boundary longitude', () => {
      expect(parseCoordinates('0, 180')).toEqual({ lat: 0, lng: 180 })
      expect(parseCoordinates('0, -180')).toEqual({ lat: 0, lng: -180 })
    })

    it('returns null for out-of-range latitude', () => {
      expect(parseCoordinates('91, 0')).toBeNull()
      expect(parseCoordinates('-91, 0')).toBeNull()
    })

    it('returns null for out-of-range longitude', () => {
      expect(parseCoordinates('0, 181')).toBeNull()
      expect(parseCoordinates('0, -181')).toBeNull()
    })

    it('strips leading/trailing whitespace', () => {
      expect(parseCoordinates('  50.45,30.52  ')).toEqual({ lat: 50.45, lng: 30.52 })
    })
  })

  describe('DMS format', () => {
    it('parses degrees and minutes with N/E', () => {
      const result = parseCoordinates("50°27'N 30°31'E")
      expect(result).not.toBeNull()
      expect(result!.lat).toBeCloseTo(50 + 27 / 60, 4)
      expect(result!.lng).toBeCloseTo(30 + 31 / 60, 4)
    })

    it('parses degrees and minutes with S/W', () => {
      const result = parseCoordinates("33°52'S 151°12'W")
      expect(result).not.toBeNull()
      expect(result!.lat).toBeLessThan(0)
      expect(result!.lng).toBeLessThan(0)
    })

    it('parses degrees, minutes, and seconds', () => {
      const result = parseCoordinates('50°27\'12"N 30°31\'45"E')
      expect(result).not.toBeNull()
      expect(result!.lat).toBeCloseTo(50 + 27 / 60 + 12 / 3600, 4)
      expect(result!.lng).toBeCloseTo(30 + 31 / 60 + 45 / 3600, 4)
    })

    it('is case-insensitive for direction letters', () => {
      const upper = parseCoordinates("50°27'N 30°31'E")
      const lower = parseCoordinates("50°27'n 30°31'e")
      expect(upper).toEqual(lower)
    })
  })

  describe('invalid inputs', () => {
    it('returns null for empty string', () => {
      expect(parseCoordinates('')).toBeNull()
    })

    it('returns null for plain text', () => {
      expect(parseCoordinates('New York')).toBeNull()
    })

    it('returns null for a single number', () => {
      expect(parseCoordinates('50.45')).toBeNull()
    })

    it('returns null for three numbers', () => {
      expect(parseCoordinates('50.45, 30.52, 100')).toBeNull()
    })
  })
})
