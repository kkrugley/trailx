import Dexie from 'dexie'
import type { Feature, Point } from 'geojson'

class TrailxDB extends Dexie {
  overpasstiles!: Dexie.Table<
    { query: string; x: number; y: number; time: number },
    [string, number, number]
  >
  overpassdata!: Dexie.Table<
    { query: string; id: number; poi: Feature<Point> },
    [string, number]
  >

  constructor() {
    super('TrailxDB')
    this.version(1).stores({
      overpasstiles: '[query+x+y],[x+y]',
      overpassdata: '[query+id]',
    })
    // v2: add standalone indexes needed for .where('query') and .where('time')
    this.version(2).stores({
      overpasstiles: '[query+x+y],[x+y],time',
      overpassdata: '[query+id],query',
    })
  }
}

export const TILE_EXPIRY_MS = 7 * 24 * 3600 * 1000 // 7 days

let dbInstance: TrailxDB | null = null
export let dbAvailable = false

function createDB(): TrailxDB {
  const db = new TrailxDB()
  return db
}

export function getDB(): TrailxDB | null {
  return dbInstance
}

/** Open the database. Call once on app startup. */
export async function initDB(): Promise<void> {
  try {
    dbInstance = createDB()
    await dbInstance.open()
    dbAvailable = true
    // Clean up expired tiles on startup
    await dbInstance.overpasstiles
      .where('time')
      .below(Date.now() - TILE_EXPIRY_MS)
      .delete()
  } catch (err) {
    console.warn('[db] IndexedDB unavailable, caching disabled:', err)
    dbInstance = null
    dbAvailable = false
  }
}
