import { useEffect, useRef, useState } from 'react'
import {
  MapPin, Path, MagnifyingGlass, FileArrowDown,
  TelegramLogo, UsersThree, CurrencyDollar, Lightbulb,
  CaretDown,
} from '@phosphor-icons/react'
import { useT, type Translations } from '../../i18n/useT'
import styles from './AppInfo.module.css'

interface AppInfoProps {
  onClose: () => void
}

interface InfoSection {
  id: string
  icon: React.ReactNode
  title: string
  items: string[]
}

function buildSections(t: Translations): InfoSection[] {
  return [
    {
      id: 'routing',
      icon: <Path size={15} weight="fill" />,
      title: t.appInfo.sections.routing.title,
      items: t.appInfo.sections.routing.items,
    },
    {
      id: 'profiles',
      icon: <MapPin size={15} weight="fill" />,
      title: t.appInfo.sections.profiles.title,
      items: t.appInfo.sections.profiles.items,
    },
    {
      id: 'poi',
      icon: <MagnifyingGlass size={15} weight="fill" />,
      title: t.appInfo.sections.poi.title,
      items: t.appInfo.sections.poi.items,
    },
    {
      id: 'export',
      icon: <FileArrowDown size={15} weight="fill" />,
      title: t.appInfo.sections.export.title,
      items: t.appInfo.sections.export.items,
    },
    {
      id: 'telegram',
      icon: <TelegramLogo size={15} weight="fill" />,
      title: t.appInfo.sections.telegram.title,
      items: t.appInfo.sections.telegram.items,
    },
    {
      id: 'group',
      icon: <UsersThree size={15} weight="fill" />,
      title: t.appInfo.sections.group.title,
      items: t.appInfo.sections.group.items,
    },
    {
      id: 'subscription',
      icon: <CurrencyDollar size={15} weight="fill" />,
      title: t.appInfo.sections.subscription.title,
      items: t.appInfo.sections.subscription.items,
    },
    {
      id: 'shortcuts',
      icon: <Lightbulb size={15} weight="fill" />,
      title: t.appInfo.sections.shortcuts.title,
      items: t.appInfo.sections.shortcuts.items,
    },
  ]
}

export function AppInfo({ onClose }: AppInfoProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  const t = useT()
  const sections = buildSections(t)
  const [openId, setOpenId] = useState<string | null>('routing')

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) onClose()
    }
    const keyHandler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('mousedown', handler)
    document.addEventListener('keydown', keyHandler)
    return () => {
      document.removeEventListener('mousedown', handler)
      document.removeEventListener('keydown', keyHandler)
    }
  }, [onClose])

  return (
    <div ref={panelRef} className={styles.panel}>
      <div className={styles.header}>
        <div className={styles.headerText}>
          <span className={styles.title}>TrailX</span>
          <span className={styles.subtitle}>{t.appInfo.subtitle}</span>
        </div>
      </div>

      <div className={styles.scroll}>
        {sections.map((section) => {
          const isOpen = openId === section.id
          return (
            <div key={section.id} className={styles.accordion}>
              <button
                className={`${styles.accordionBtn} ${isOpen ? styles.accordionBtnOpen : ''}`}
                onClick={() => setOpenId(isOpen ? null : section.id)}
              >
                <span className={styles.sectionIcon}>{section.icon}</span>
                <span className={styles.sectionTitle}>{section.title}</span>
                <span className={`${styles.caret} ${isOpen ? styles.caretOpen : ''}`}>
                  <CaretDown size={12} weight="bold" />
                </span>
              </button>
              {isOpen && (
                <ul className={styles.list}>
                  {section.items.map((item, i) => (
                    <li key={i} className={styles.item}>
                      <span className={styles.bullet} />
                      {item}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )
        })}

        <div className={styles.footer}>
          <span>{t.appInfo.footer}</span>
          <span className={styles.attribution}>
            {t.appInfo.mapAttribution} © <a href="https://openfreemap.org" target="_blank" rel="noreferrer">OpenFreeMap</a>
            {' · '}© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors
          </span>
        </div>
      </div>
    </div>
  )
}
