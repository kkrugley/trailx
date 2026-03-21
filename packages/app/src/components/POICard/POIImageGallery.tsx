import { useState } from 'react'
import type { POI } from '@trailx/shared'
import { usePOIImages } from '../../hooks/usePOIImages'
import { getCategoryPlaceholder } from '../../services/poiImage'
import styles from './POIImageGallery.module.css'

export interface POIImageGalleryProps {
  poi: POI
}

export function POIImageGallery({ poi }: POIImageGalleryProps) {
  const [activeIdx, setActiveIdx] = useState(0)

  // POI uses lat/lng — map to the hook's lat/lon shape
  const hookPoi = { id: poi.id, lat: poi.lat, lon: poi.lng, tags: poi.tags }
  const { images, isLoading, isPlaceholder } = usePOIImages(hookPoi)

  // Reset active index when POI changes
  // (effect would be overkill — just clamp on render)
  const clampedIdx = Math.min(activeIdx, Math.max(0, images.length - 1))

  const showDots = images.length > 1 || isLoading

  // ── Case 1: skeleton ────────────────────────────────────────────────────────
  if (isLoading && images.length === 0) {
    return (
      <div className={styles.gallery}>
        <div className={styles.skeleton} />
      </div>
    )
  }

  // ── Case 2: placeholder ─────────────────────────────────────────────────────
  if (isPlaceholder) {
    return (
      <div className={styles.gallery}>
        <div className={styles.imageWrap}>
          <img
            className={styles.image}
            src={getCategoryPlaceholder(poi.tags)}
            alt={poi.name ?? poi.category}
          />
          <span className={styles.badge}>generic</span>
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
      </div>

      {showDots && (
        <div className={styles.dots}>
          {images.map((img, i) => (
            <button
              key={img.url}
              className={`${styles.dot} ${i === clampedIdx ? styles.dotActive : ''}`}
              onClick={() => setActiveIdx(i)}
              aria-label={`Image ${i + 1}`}
            />
          ))}
          {isLoading && <span className={styles.dotLoading} aria-hidden="true" />}
        </div>
      )}
    </div>
  )
}
