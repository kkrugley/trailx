export type POICategory =
  | 'drinking_water'
  | 'bicycle_repair'
  | 'shelter'
  | 'bicycle_shop'
  | 'camp_site'
  | 'food'
  | 'historic'
  | 'viewpoint'

export interface POI {
  id: string
  lat: number
  lng: number
  name?: string
  category: POICategory
  tags: Record<string, string>
  osmId: number
  osmType: 'node' | 'way' | 'relation'
}
