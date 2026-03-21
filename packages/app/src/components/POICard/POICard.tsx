import { useEffect, useState } from 'react'
import {
  X,
  Drop,
  Wrench,
  House,
  Bicycle,
  Tent,
  ForkKnife,
  CastleTurret,
  Binoculars,
  MapPin,
} from '@phosphor-icons/react'
import type { POI, POICategory } from '@trailx/shared'
import { POI_LABELS, POI_COLORS } from '@trailx/shared'
import { useMapStore } from '../../store/useMapStore'
import styles from './POICard.module.css'

// ── Category icon map ─────────────────────────────────────────────────────────

const CATEGORY_ICONS: Record<POICategory, React.ReactNode> = {
  drinking_water: <Drop size={18} weight="fill" />,
  bicycle_repair: <Wrench size={18} weight="fill" />,
  shelter: <House size={18} weight="fill" />,
  bicycle_shop: <Bicycle size={18} weight="fill" />,
  camp_site: <Tent size={18} weight="fill" />,
  food: <ForkKnife size={18} weight="fill" />,
  historic: <CastleTurret size={18} weight="fill" />,
  viewpoint: <Binoculars size={18} weight="fill" />,
}

// ── Wikidata image fetch ──────────────────────────────────────────────────────

interface WikidataImageClaim {
  mainsnak: { datavalue: { value: string } }
}
interface WikidataEntity {
  claims?: { P18?: WikidataImageClaim[] }
}
interface WikidataResponse {
  entities?: Record<string, WikidataEntity>
}

async function fetchWikidataImage(qid: string): Promise<string | null> {
  try {
    const url = `https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${qid}&props=claims&format=json&origin=*`
    const res = await fetch(url)
    const data = (await res.json()) as WikidataResponse
    const filename = data.entities?.[qid]?.claims?.P18?.[0]?.mainsnak?.datavalue?.value
    if (!filename) return null
    return `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(filename)}?width=300`
  } catch {
    return null
  }
}

// ── POICard ───────────────────────────────────────────────────────────────────

export interface POICardProps {
  poi: POI | null
  onClose: () => void
}

export function POICard({ poi, onClose }: POICardProps) {
  // Keep last non-null poi so the card content stays visible during the slide-out animation
  const [displayPoi, setDisplayPoi] = useState<POI | null>(null)
  const [photoUrl, setPhotoUrl] = useState<string | null>(null)
  const standalonePois = useMapStore((s) => s.standalonePois)
  const { addStandalonePoi, removeStandalonePoi, insertWaypointNear } = useMapStore((s) => s.actions)

  useEffect(() => {
    if (poi) setDisplayPoi(poi)
  }, [poi])

  // Fetch Wikidata image when POI changes
  useEffect(() => {
    setPhotoUrl(null)
    if (!poi?.tags?.wikidata) return
    fetchWikidataImage(poi.tags.wikidata).then(setPhotoUrl)
  }, [poi?.id, poi?.tags?.wikidata])

  function handleAddToRoute() {
    if (!displayPoi) return
    insertWaypointNear(displayPoi.lat, displayPoi.lng, displayPoi.name)
    onClose()
  }

  const isSaved = displayPoi ? standalonePois.some((p) => p.id === displayPoi.id) : false

  function handleSaveAsPOI() {
    if (!displayPoi) return
    addStandalonePoi(displayPoi)
  }

  function handleRemovePOI() {
    if (!displayPoi) return
    removeStandalonePoi(displayPoi.id)
  }

  const isVisible = poi !== null

  return (
    <div
      className={`${styles.overlay} ${isVisible ? styles.overlayActive : ''}`}
      onClick={isVisible ? onClose : undefined}
    >
      <div className={styles.card} onClick={(e) => e.stopPropagation()}>
        {displayPoi && (
          <>
            {/* ── Header ── */}
            <div className={styles.header}>
              <div className={styles.titleRow}>
                <span
                  className={styles.categoryBadge}
                  style={{ backgroundColor: POI_COLORS[displayPoi.category] }}
                >
                  {CATEGORY_ICONS[displayPoi.category]}
                </span>
                <div className={styles.titleGroup}>
                  <span className={styles.title}>
                    {displayPoi.name || 'Без названия'}
                  </span>
                  <span className={styles.categoryLabel}>
                    {POI_LABELS[displayPoi.category]}
                  </span>
                </div>
              </div>
              <button className={styles.closeButton} onClick={onClose} aria-label="Close">
                <X size={16} weight="bold" />
              </button>
            </div>

            {/* ── Photo ── */}
            <div className={styles.photoWrap}>
              {photoUrl ? (
                <img className={styles.photo} src={photoUrl} alt={displayPoi.name ?? 'POI'} />
              ) : (
                <div
                  className={styles.photoPlaceholder}
                  style={{ backgroundColor: `${POI_COLORS[displayPoi.category]}18` }}
                >
                  <span style={{ color: POI_COLORS[displayPoi.category] }}>
                    {CATEGORY_ICONS[displayPoi.category]}
                  </span>
                </div>
              )}
            </div>

            {/* ── Details ── */}
            <div className={styles.details}>
              <div className={styles.coordRow}>
                <MapPin size={13} weight="fill" className={styles.coordIcon} />
                <span>
                  {displayPoi.lat.toFixed(5)}, {displayPoi.lng.toFixed(5)}
                </span>
              </div>
              {displayPoi.tags.opening_hours && (
                <div className={styles.tag}>
                  <span className={styles.tagKey}>Часы работы:</span>
                  <span className={styles.tagVal}>{displayPoi.tags.opening_hours}</span>
                </div>
              )}
              {displayPoi.tags.phone && (
                <div className={styles.tag}>
                  <span className={styles.tagKey}>Тел.</span>
                  <span className={styles.tagVal}>{displayPoi.tags.phone}</span>
                </div>
              )}
              {displayPoi.tags.website && (
                <div className={styles.tag}>
                  <span className={styles.tagKey}>Сайт</span>
                  <a
                    className={styles.tagLink}
                    href={displayPoi.tags.website}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {displayPoi.tags.website.replace(/^https?:\/\//, '')}
                  </a>
                </div>
              )}
            </div>

            {/* ── Actions ── */}
            <div className={styles.actions}>
              {isSaved ? (
                <button className={styles.btnDanger} onClick={handleRemovePOI}>
                  Удалить POI
                </button>
              ) : (
                <button className={styles.btnSecondary} onClick={handleSaveAsPOI}>
                  Сохранить как POI
                </button>
              )}
              <button className={styles.btnPrimary} onClick={handleAddToRoute}>
                Добавить в маршрут
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
