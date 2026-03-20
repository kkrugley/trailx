import type { GPXFile } from '../types/gpx'

export function serializeGPX(_file: GPXFile): string {
  // TODO: implement GPX 1.1 serialization
  return ''
}

export function parseGPX(_xml: string): GPXFile {
  // TODO: implement GPX parsing
  return { tracks: [], waypoints: [] }
}
