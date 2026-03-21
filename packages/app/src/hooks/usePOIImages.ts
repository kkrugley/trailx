import { useEffect, useRef, useState } from 'react'
import { streamPOIImages } from '../services/poiImage'
import type { POIImageResult } from '../services/poiImage'

export interface UsePOIImagesResult {
  images: POIImageResult[]
  isLoading: boolean
  isPlaceholder: boolean
}

export function usePOIImages(
  poi: { id?: string; lat: number; lon: number; tags: Record<string, string> } | null
): UsePOIImagesResult {
  const [images, setImages] = useState<POIImageResult[]>([])
  // Start as loading if we already have a POI — avoids flash of placeholder before effect fires
  const [isLoading, setIsLoading] = useState(poi !== null)
  const abortRef = useRef(false)

  useEffect(() => {
    if (!poi) return

    abortRef.current = false
    setImages([])
    setIsLoading(true)

    void (async () => {
      for await (const img of streamPOIImages(poi)) {
        if (abortRef.current) break
        setImages((prev) => (prev.length < 6 ? [...prev, img] : prev))
      }
      if (!abortRef.current) setIsLoading(false)
    })()

    return () => {
      abortRef.current = true
    }
    // Re-run when POI identity changes (id preferred, coordinates as fallback)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [poi?.id, poi?.lat, poi?.lon])

  if (!poi) {
    return { images: [], isLoading: false, isPlaceholder: false }
  }

  const isPlaceholder = !isLoading && images.length === 0

  return { images, isLoading, isPlaceholder }
}
