import { useEffect, useRef, useState } from 'react'
import {
  MapPin, Path, MagnifyingGlass, FileArrowDown,
  TelegramLogo, UsersThree, CurrencyDollar, Lightbulb,
  CaretDown,
} from '@phosphor-icons/react'
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

const SECTIONS: InfoSection[] = [
  {
    id: 'routing',
    icon: <Path size={15} weight="fill" />,
    title: 'Планирование маршрута',
    items: [
      'Введите адрес в поле поиска для добавления точки',
      'Перетаскивайте точки в списке для изменения порядка',
      'Нажмите «Добавить остановку» для добавления промежуточных точек',
      'Все точки маршрута можно удалить кнопкой × справа',
      'Кнопка корзины очищает весь маршрут',
    ],
  },
  {
    id: 'profiles',
    icon: <MapPin size={15} weight="fill" />,
    title: 'Виды транспорта',
    items: [
      'Пеший — предпочитает пешеходные дорожки и тропы',
      'Велосипед — оптимальный маршрут по дорогам и велодорожкам',
      'Горный велосипед — учитывает бездорожье и сложный рельеф',
      'Шоссейный велосипед — быстрые дороги с гладким покрытием',
      'В шестерёнке у каждого профиля есть дополнительные настройки',
    ],
  },
  {
    id: 'poi',
    icon: <MagnifyingGlass size={15} weight="fill" />,
    title: 'Поиск POI',
    items: [
      'POI (точки интереса) ищутся автоматически вдоль проложенного маршрута',
      'Кнопка «Фильтр» внизу справа управляет отображаемыми категориями',
      'Кликните на POI, чтобы просмотреть информацию и добавить в маршрут',
      'POI можно добавить как точку маршрута или сохранить отдельно в GPX',
      'Радиус поиска настраивается в разделе «Настройки»',
    ],
  },
  {
    id: 'export',
    icon: <FileArrowDown size={15} weight="fill" />,
    title: 'Экспорт GPX',
    items: [
      'Экспорт доступен после построения маршрута',
      'GPX включает трек с высотными данными (elevation)',
      'Сохранённые POI экспортируются как точки <wpt>',
      'Параметры экспорта настраиваются в разделе «Настройки»',
    ],
  },
  {
    id: 'telegram',
    icon: <TelegramLogo size={15} weight="fill" />,
    title: 'Telegram Mini App',
    items: [
      'Команда /app открывает приложение с активным маршрутом группы',
      'Команда /add [место] добавляет точку без голосования',
      'Команда /vote [место] создаёт голосование в чате',
      'Команда /gpx отправляет готовый файл маршрута в чат',
      'Команда /weather [дата] строит прогноз погоды вдоль маршрута при скорости 25 км/ч',
    ],
  },
  {
    id: 'group',
    icon: <UsersThree size={15} weight="fill" />,
    title: 'Групповые маршруты',
    items: [
      'Бесплатно: каждый участник чата видит только свой маршрут',
      'С подпиской: один общий маршрут для всей группы',
      'Все изменения одного участника сразу видны другим (real-time sync)',
      'Достаточно подписки одного участника для активации для всей группы',
    ],
  },
  {
    id: 'subscription',
    icon: <CurrencyDollar size={15} weight="fill" />,
    title: 'Подписка',
    items: [
      'Команда /upgrade в боте — управление подпиской',
      'Групповые маршруты с синхронизацией в реальном времени',
      'Полный доступ ко всем командам бота для всех участников группы',
    ],
  },
  {
    id: 'shortcuts',
    icon: <Lightbulb size={15} weight="fill" />,
    title: 'Советы',
    items: [
      'Двойной клик по карте — быстрое приближение',
      'Кнопка прицела — центрирование на вашем местоположении',
      'Кнопка слоёв — смена стиля карты',
      'Маршрут строится автоматически при добавлении двух и более точек',
    ],
  },
]

export function AppInfo({ onClose }: AppInfoProps) {
  const panelRef = useRef<HTMLDivElement>(null)
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
          <span className={styles.subtitle}>Справка по сервису</span>
        </div>
      </div>

      <div className={styles.scroll}>
        {SECTIONS.map((section) => {
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
          <span>TrailX v1.0 · Планировщик велосипедных маршрутов</span>
          <span className={styles.attribution}>
            Карта: © <a href="https://openfreemap.org" target="_blank" rel="noreferrer">OpenFreeMap</a>
            {' · '}© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors
          </span>
        </div>
      </div>
    </div>
  )
}
