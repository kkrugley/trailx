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
import { POI_COLORS, POI_CATEGORIES } from '@trailx/shared'
import { useMapStore } from '../../store/useMapStore'
import { useT } from '../../i18n/useT'
import { POIImageGallery } from './POIImageGallery'
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
  custom: <MapPin size={18} weight="fill" />,
}

// POI images are now fetched via POIImageGallery component (Wikidata → Mapillary → placeholder)

// ── POICard ───────────────────────────────────────────────────────────────────

export interface POICardProps {
  poi: POI | null
  onClose: () => void
  draft?: { lat: number; lng: number }
}

export function POICard({ poi, onClose, draft }: POICardProps) {
  // Keep last non-null poi so the card content stays visible during the slide-out animation
  const [displayPoi, setDisplayPoi] = useState<POI | null>(null)
  // Draft form state
  const [displayDraft, setDisplayDraft] = useState<{ lat: number; lng: number } | null>(null)
  const [draftName, setDraftName] = useState('')
  const [draftCategory, setDraftCategory] = useState<POICategory>('custom')

  const standalonePois = useMapStore((s) => s.standalonePois)
  const { addStandalonePoi, removeStandalonePoi, insertWaypointNear } = useMapStore((s) => s.actions)
  const t = useT()

  useEffect(() => {
    if (poi) setDisplayPoi(poi)
  }, [poi])

  useEffect(() => {
    if (draft) {
      setDisplayDraft(draft)
      setDraftName('')
      setDraftCategory('custom')
    }
  }, [draft])



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

  function handleSaveDraft() {
    if (!displayDraft) return
    const name = draftName.trim() || `${displayDraft.lat.toFixed(5)}, ${displayDraft.lng.toFixed(5)}`
    addStandalonePoi({
      id: `manual-${Date.now()}`,
      lat: displayDraft.lat,
      lng: displayDraft.lng,
      name,
      category: draftCategory,
      osmId: 0,
      osmType: 'node',
      tags: {},
    })
    onClose()
  }

  const isDraftMode = draft !== undefined
  const isVisible = poi !== null || isDraftMode

  return (
    <div
      className={`${styles.overlay} ${isVisible ? styles.overlayActive : ''}`}
      onClick={isVisible ? onClose : undefined}
    >
      <div className={styles.card} onClick={(e) => e.stopPropagation()}>
        {/* ── Create mode (draft) ── */}
        {isDraftMode && displayDraft && (
          <>
            <div className={styles.header}>
              <div className={styles.titleRow}>
                <span
                  className={styles.categoryBadge}
                  style={{ backgroundColor: POI_COLORS[draftCategory] }}
                >
                  {CATEGORY_ICONS[draftCategory]}
                </span>
                <div className={styles.titleGroup}>
                  <span className={styles.title}>{t.poiCard.newMarker}</span>
                  <span className={styles.categoryLabel}>
                    {displayDraft.lat.toFixed(5)}, {displayDraft.lng.toFixed(5)}
                  </span>
                </div>
              </div>
              <button className={styles.closeButton} onClick={onClose} aria-label="Close">
                <X size={16} weight="bold" />
              </button>
            </div>

            <div className={styles.draftForm}>
              <input
                className={styles.draftInput}
                type="text"
                placeholder={t.poiCard.markerNamePlaceholder}
                value={draftName}
                onChange={(e) => setDraftName(e.target.value)}
              />
              <select
                className={styles.draftSelect}
                value={draftCategory}
                onChange={(e) => setDraftCategory(e.target.value as POICategory)}
              >
                {POI_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>{t.poi[cat]}</option>
                ))}
              </select>
            </div>

            <div className={styles.draftActionsRow}>
              <button className={styles.btnPrimary} onClick={handleSaveDraft}>
                {t.poiCard.saveMarker}
              </button>
            </div>
          </>
        )}

        {/* ── View mode (existing POI) ── */}
        {!isDraftMode && displayPoi && (
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
                    {displayPoi.name || t.poiCard.noName}
                  </span>
                  <span className={styles.categoryLabel}>
                    {t.poi[displayPoi.category]}
                  </span>
                </div>
              </div>
              <button className={styles.closeButton} onClick={onClose} aria-label="Close">
                <X size={16} weight="bold" />
              </button>
            </div>

{/* ── Photo ── */}
      <POIImageGallery poi={displayPoi} />

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
                  <span className={styles.tagKey}>{t.poiCard.hoursLabel}</span>
                  <span className={styles.tagVal}>{displayPoi.tags.opening_hours}</span>
                </div>
              )}
              {displayPoi.tags.phone && (
                <div className={styles.tag}>
                  <span className={styles.tagKey}>{t.poiCard.phoneLabel}</span>
                  <span className={styles.tagVal}>{displayPoi.tags.phone}</span>
                </div>
              )}
              {displayPoi.tags.website && (
                <div className={styles.tag}>
                  <span className={styles.tagKey}>{t.poiCard.websiteLabel}</span>
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
                  {t.poiCard.removePoi}
                </button>
              ) : (
                <button className={styles.btnSecondary} onClick={handleSaveAsPOI}>
                  {t.poiCard.saveAsPoi}
                </button>
              )}
              <button className={styles.btnPrimary} onClick={handleAddToRoute}>
                {t.poiCard.addToRoute}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
