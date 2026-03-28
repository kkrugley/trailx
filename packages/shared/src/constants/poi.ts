import type { POICategory } from '../types/poi'

export const POI_CATEGORIES: POICategory[] = [
  'drinking_water',
  'bicycle_repair',
  'shelter',
  'bicycle_shop',
  'camp_site',
  'food',
  'historic',
  'viewpoint',
]

/** Overpass QL tag filter expression for each category */
export const POI_OVERPASS_FILTER: Record<POICategory, string> = {
  drinking_water: '[amenity=drinking_water]',
  bicycle_repair: '[amenity=bicycle_repair_station]',
  shelter: '[amenity=shelter]',
  bicycle_shop: '[shop=bicycle]',
  camp_site: '[tourism=camp_site]',
  food: '[amenity~"^(cafe|restaurant|fast_food)$"]',
  historic: '[historic]',
  viewpoint: '[tourism=viewpoint]',
}

/** Display labels in Russian */
export const POI_LABELS: Record<POICategory, string> = {
  drinking_water: 'Вода',
  bicycle_repair: 'Ремонт',
  shelter: 'Укрытие',
  bicycle_shop: 'Веломагазин',
  camp_site: 'Кемпинг',
  food: 'Еда',
  historic: 'История',
  viewpoint: 'Обзор',
}

/** Tier 1: survival-critical POIs — fetched first, always shown */
export const POI_TIER1: POICategory[] = ['drinking_water', 'bicycle_repair', 'food', 'shelter']

/** Tier 2: informational POIs — fetched after Tier 1 succeeds */
export const POI_TIER2: POICategory[] = ['bicycle_shop', 'camp_site', 'historic', 'viewpoint']

/** Map marker fill colors */
export const POI_COLORS: Record<POICategory, string> = {
  drinking_water: '#2196F3',
  bicycle_repair: '#FF9800',
  shelter: '#9C27B0',
  bicycle_shop: '#4CAF50',
  camp_site: '#795548',
  food: '#F44336',
  historic: '#607D8B',
  viewpoint: '#00BCD4',
}
