import { useState } from 'react'
import {
  CaretLeft,
  CaretRight,
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
import { POI_COLORS } from '@trailx/shared'
import { usePOIImages } from '../../hooks/usePOIImages'
import styles from './POIImageGallery.module.css'

const CATEGORY_ICONS: Record<POICategory, React.ReactNode> = {
  drinking_water: <Drop size={48} weight="fill" />,
  bicycle_repair: <Wrench size={48} weight="fill" />,
  shelter: <House size={48} weight="fill" />,
  bicycle_shop: <Bicycle size={48} weight="fill" />,
  camp_site: <Tent size={48} weight="fill" />,
  food: <ForkKnife size={48} weight="fill" />,
  historic: <CastleTurret size={48} weight="fill" />,
  viewpoint: <Binoculars size={48} weight="fill" />,
  custom: <MapPin size={48} weight="fill" />,
}

export interface POIImageGalleryProps {
  poi: POI
}

export function POIImageGallery({ poi }: POIImageGalleryProps) {
  const [activeIdx, setActiveIdx] = useState(0)

  // POI uses lat/lng — map to the hook's lat/lon shape
  const hookPoi = { id: poi.id, lat: poi.lat, lon: poi.lng, tags: poi.tags }
  const { images, isLoading, isPlaceholder } = usePOIImages(hookPoi)

  // Reset active index when POI changes
  const clampedIdx = Math.min(activeIdx, Math.max(0, images.length - 1))

  const hasMultipleImages = images.length > 1

  function goPrev() {
    setActiveIdx((prev) => (prev > 0 ? prev - 1 : images.length - 1))
  }

  function goNext() {
    setActiveIdx((prev) => (prev < images.length - 1 ? prev + 1 : 0))
  }

  // ── Case 1: skeleton ────────────────────────────────────────────────────────
  if (isLoading && images.length === 0) {
    return (
      <div className={styles.gallery}>
        <div className={styles.skeleton} />
      </div>
    )
  }

  // ── Case 2: no images — show category icon ──────────────────────────────────
  if (isPlaceholder) {
    return (
      <div className={styles.gallery}>
        <div
          className={styles.iconPlaceholder}
          style={{ backgroundColor: `${POI_COLORS[poi.category]}18` }}
        >
          <span style={{ color: POI_COLORS[poi.category] }}>
            {CATEGORY_ICONS[poi.category]}
          </span>
        </div>
      </div>
    )
  }

  // ── Case 3: images present ──────────────────────────────────────────────────
  const current = images[clampedIdx]

  return (
    <div className={styles.gallery}>
      <div className={styles.imageWrap}>
        <img
          key={current.url}
          className={styles.image}
          src={current.url}
          alt={poi.name ?? poi.category}
        />
        <span className={styles.badge}>{current.source}</span>

        {/* Navigation arrows */}
        {hasMultipleImages && (
          <>
            <button
              className={`${styles.navArrow} ${styles.navArrowLeft}`}
              onClick={goPrev}
              aria-label="Previous image"
            >
              <CaretLeft size={24} weight="bold" />
            </button>
            <button
              className={`${styles.navArrow} ${styles.navArrowRight}`}
              onClick={goNext}
              aria-label="Next image"
            >
              <CaretRight size={24} weight="bold" />
            </button>
          </>
        )}

        {/* Image counter */}
        {hasMultipleImages && (
          <span className={styles.imageCounter}>
            {clampedIdx + 1} / {images.length}
          </span>
        )}
      </div>
    </div>
  )
}
