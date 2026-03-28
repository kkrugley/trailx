import {
  Drop,
  Wrench,
  House,
  Bicycle,
  Tent,
  ForkKnife,
  CastleTurret,
  Binoculars,
  GridFour,
  MapPin,
} from '@phosphor-icons/react'
import type { POICategory } from '@trailx/shared'
import { POI_CATEGORIES, POI_LABELS, POI_COLORS } from '@trailx/shared'
import { useMapStore } from '../../store/useMapStore'
import styles from './FilterBar.module.css'

const CATEGORY_ICONS: Record<POICategory, React.ReactNode> = {
  drinking_water: <Drop size={15} weight="fill" />,
  bicycle_repair: <Wrench size={15} weight="fill" />,
  shelter: <House size={15} weight="fill" />,
  bicycle_shop: <Bicycle size={15} weight="fill" />,
  camp_site: <Tent size={15} weight="fill" />,
  food: <ForkKnife size={15} weight="fill" />,
  historic: <CastleTurret size={15} weight="fill" />,
  viewpoint: <Binoculars size={15} weight="fill" />,
  custom: <MapPin size={15} weight="fill" />,
}

export function FilterBar() {
  const pois = useMapStore((s) => s.pois)
  const activeCategories = useMapStore((s) => s.activeCategories)
  const { toggleCategory, setActiveCategories } = useMapStore((s) => s.actions)

  const allActive = activeCategories.length === POI_CATEGORIES.length

  function handleAllToggle() {
    setActiveCategories(allActive ? [] : [...POI_CATEGORIES])
  }

  function getCount(cat: POICategory): number {
    return pois.filter((p) => p.category === cat).length
  }

  return (
    <div className={styles.bar}>
      <button
        className={`${styles.chip} ${allActive ? styles.chipAllActive : ''}`}
        onClick={handleAllToggle}
        aria-pressed={allActive}
        aria-label="Toggle all categories"
      >
        <span className={styles.chipIcon}>
          <GridFour size={15} weight="fill" />
        </span>
        <span className={styles.chipLabel}>Все</span>
      </button>

      {POI_CATEGORIES.map((cat) => {
        const isActive = activeCategories.includes(cat)
        const count = getCount(cat)
        return (
          <button
            key={cat}
            className={`${styles.chip} ${isActive ? styles.chipActive : ''}`}
            style={{ '--chip-color': POI_COLORS[cat] } as React.CSSProperties}
            onClick={() => toggleCategory(cat)}
            aria-pressed={isActive}
            aria-label={POI_LABELS[cat]}
          >
            <span className={styles.chipIcon}>{CATEGORY_ICONS[cat]}</span>
            <span className={styles.chipLabel}>{POI_LABELS[cat]}</span>
            {count > 0 && <span className={styles.chipCount}>{count}</span>}
          </button>
        )
      })}
    </div>
  )
}
