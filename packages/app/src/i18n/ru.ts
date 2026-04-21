import type { POICategory } from '@trailx/shared'

export interface Translations {
  units: {
    speedKmh: string
    hourShort: string
    minuteShort: string
    durationHM: (h: number, m: number) => string
    durationM: (m: number) => string
    durationCompactH: (h: string) => string
    durationCompactM: (m: number) => string
  }
  poi: Record<POICategory, string>
  profileTabs: {
    foot: string
    bike: string
    mtb: string
    racingbike: string
  }
  appSettings: {
    title: string
    resetTitle: string
    resetLabel: string
    sectionLanguage: string
    langRu: string
    langEn: string
    sectionUnits: string
    unitKm: string
    unitMi: string
    sectionMap: string
    autoFit: string
    sectionSpeeds: string
    speedFoot: string
    speedBike: string
    speedMtb: string
    speedRacingbike: string
    sectionGpx: string
    gpxIncludeTrk: string
    gpxIncludeRte: string
    gpxIncludeWpt: string
    footer: string
  }
  routePanel: {
    emptyText: string
    clearRoute: string
  }
  waypointInputList: {
    placeholderStart: string
    placeholderIntermediate: string
    placeholderEnd: string
    addStop: string
    settingsAriaLabel: string
    settingsTitle: string
    clearAriaLabel: string
    clearTitle: string
  }
  routeSettings: {
    sectionFoot: string
    preferFootpaths: string
    avoidRoads: string
    sectionBike: string
    routeFastest: string
    routeSafest: string
    routeShort: string
    avoidHighways: string
    sectionMtb: string
    terrainEasy: string
    terrainMedium: string
    terrainHard: string
    avoidPaved: string
    sectionRacing: string
    avoidCobblestones: string
  }
  routeResults: {
    label: string
    tooltipDuration: (speed: string) => string
    tooltipDistance: string
    tooltipGain: string
    tooltipLoss: string
  }
  elevationBar: {
    viewElevation: string
    viewSurface: string
    viewRoadclass: string
    chipGain: string
    chipMinAlt: string
    chipMaxAlt: string
    noSurfaceData: string
    noRoadclassData: string
  }
  bottomSheet: {
    pullHint: string
    accordionElevation: string
    accordionPoi: string
    sliderSearchRadius: string
    noRouteData: string
    noSurfaceData: string
    noRoadclassData: string
    chipGain: string
    chipMinAlt: string
    chipMaxAlt: string
  }
  mapContextMenu: {
    setStart: string
    addIntermediate: string
    setEnd: string
    addMarker: string
    copyCoords: string
    openOsm: string
  }
  poiCard: {
    newMarker: string
    markerNamePlaceholder: string
    saveMarker: string
    noName: string
    hoursLabel: string
    phoneLabel: string
    websiteLabel: string
    removePoi: string
    saveAsPoi: string
    addToRoute: string
  }
  poiFilter: {
    title: string
    hideAll: string
    showAll: string
    selectAll: string
    searchRadius: string
  }
  filterBar: {
    all: string
  }
  toolsPanel: {
    title: string
    fitRouteTitle: string
    fitRouteAction: string
    fitRouteDisabledHint: string
    reverseTitle: string
    reverseAction: string
    reverseDisabledHint: string
    clearTitle: string
    clearAction: string
    clearDisabledHint: string
    confirmYes: string
    confirmCancel: string
    measureTitle: string
    measureHint: string
    sessionName: (n: number) => string
    measureNewSession: string
    measureDeleteAll: string
    measureDeleteAriaLabel: string
  }
  mobileHeader: {
    hintText: string
    shareAriaLabel: string
    shareTitle: string
    downloadAriaLabel: string
    downloadTitle: string
  }
  exportPanel: {
    copied: string
    share: string
    exportGpx: string
    closeErrorAriaLabel: string
  }
  searchBar: {
    placeholder: string
    coordError: string
  }
  mapControls: {
    infoAriaLabel: string
    settingsAriaLabel: string
    layersAriaLabel: string
    toolsAriaLabel: string
  }
  mapLayers: {
    panelTitle: string
    sectionStyle: string
    labelSatellite: string
    labelTopo: string
  }
  mapView: {
    buildingRoute: string
    searchingPoi: string
  }
  appShell: {
    filterAriaLabel: string
    filterLabel: string
  }
  appInfo: {
    subtitle: string
    footer: string
    mapAttribution: string
    sections: {
      routing: { title: string; items: string[] }
      profiles: { title: string; items: string[] }
      poi: { title: string; items: string[] }
      export: { title: string; items: string[] }
      telegram: { title: string; items: string[] }
      group: { title: string; items: string[] }
      subscription: { title: string; items: string[] }
      shortcuts: { title: string; items: string[] }
    }
  }
}

export const ru: Translations = {
  units: {
    speedKmh: 'км/ч',
    hourShort: 'ч',
    minuteShort: 'мин',
    durationHM: (h, m) => `${h} ч ${m} мин`,
    durationM: (m) => `${m} мин`,
    durationCompactH: (h) => `${h} ч`,
    durationCompactM: (m) => `${m} мин`,
  },
  poi: {
    drinking_water: 'Вода',
    bicycle_repair: 'Ремонт',
    shelter: 'Укрытие',
    bicycle_shop: 'Веломагазин',
    camp_site: 'Кемпинг',
    food: 'Еда',
    historic: 'История',
    viewpoint: 'Обзор',
    custom: 'Метка',
  },
  profileTabs: {
    foot: 'Пеший',
    bike: 'Велосипед',
    mtb: 'Горный',
    racingbike: 'Шоссе',
  },
  appSettings: {
    title: 'Настройки',
    resetTitle: 'Сбросить к стандартным',
    resetLabel: 'Сброс',
    sectionLanguage: 'Язык интерфейса',
    langRu: 'Русский',
    langEn: 'English',
    sectionUnits: 'Единицы расстояния',
    unitKm: 'Километры',
    unitMi: 'Мили',
    sectionMap: 'Карта',
    autoFit: 'Авто-центрирование на маршруте',
    sectionSpeeds: 'Скорость движения',
    speedFoot: 'Пеший',
    speedBike: 'Велосипед',
    speedMtb: 'Горный',
    speedRacingbike: 'Шоссейный',
    sectionGpx: 'Настройки экспорта GPX',
    gpxIncludeTrk: 'Включить трек (trk)',
    gpxIncludeRte: 'Включить маршрут (rte)',
    gpxIncludeWpt: 'Включить точки POI (wpt)',
    footer: 'TrailX — планировщик велосипедных маршрутов',
  },
  routePanel: {
    emptyText: 'Добавь точки на карте',
    clearRoute: 'Очистить маршрут',
  },
  waypointInputList: {
    placeholderStart: 'Начальная точка',
    placeholderIntermediate: 'Промежуточная точка',
    placeholderEnd: 'Конечная точка',
    addStop: 'Добавить остановку',
    settingsAriaLabel: 'Настройки маршрута',
    settingsTitle: 'Настройки',
    clearAriaLabel: 'Очистить маршрут',
    clearTitle: 'Очистить маршрут',
  },
  routeSettings: {
    sectionFoot: 'Пеший маршрут',
    preferFootpaths: 'Предпочитать пешеходные дорожки',
    avoidRoads: 'Избегать проезжих дорог',
    sectionBike: 'Велосипед',
    routeFastest: 'Быстрейший',
    routeSafest: 'Безопасный',
    routeShort: 'Кратчайший',
    avoidHighways: 'Избегать автомагистралей',
    sectionMtb: 'Горный велосипед',
    terrainEasy: 'Лёгкий рельеф',
    terrainMedium: 'Средний рельеф',
    terrainHard: 'Сложный рельеф',
    avoidPaved: 'Избегать асфальтированных дорог',
    sectionRacing: 'Шоссейный велосипед',
    avoidCobblestones: 'Избегать брусчатки',
  },
  routeResults: {
    label: 'Маршрут',
    tooltipDuration: (speed) => `Расчётное время при скорости ${speed}`,
    tooltipDistance: 'Общая длина маршрута',
    tooltipGain: 'Суммарный набор высоты',
    tooltipLoss: 'Суммарный сброс высоты',
  },
  elevationBar: {
    viewElevation: 'Набор высоты',
    viewSurface: 'Покрытие',
    viewRoadclass: 'Тип дороги',
    chipGain: 'Набор высоты',
    chipMinAlt: 'Мин. высота',
    chipMaxAlt: 'Макс. высота',
    noSurfaceData: 'Нет данных о покрытии',
    noRoadclassData: 'Нет данных о типе дороги',
  },
  bottomSheet: {
    pullHint: 'Потяните вверх для управления маршрутом',
    accordionElevation: 'Высоты и покрытие',
    accordionPoi: 'Фильтр точек POI',
    sliderSearchRadius: 'Радиус поиска',
    noRouteData: 'Постройте маршрут для отображения данных',
    noSurfaceData: 'Нет данных о покрытии',
    noRoadclassData: 'Нет данных о типе дороги',
    chipGain: 'Набор высоты',
    chipMinAlt: 'Мин. высота',
    chipMaxAlt: 'Макс. высота',
  },
  mapContextMenu: {
    setStart: 'Установить начало',
    addIntermediate: 'Добавить промежуточную',
    setEnd: 'Установить конец',
    addMarker: 'Добавить метку',
    copyCoords: 'Копировать координаты',
    openOsm: 'Открыть в OSM',
  },
  poiCard: {
    newMarker: 'Новая метка',
    markerNamePlaceholder: 'Название метки',
    saveMarker: 'Сохранить метку',
    noName: 'Без названия',
    hoursLabel: 'Часы работы:',
    phoneLabel: 'Тел.',
    websiteLabel: 'Сайт',
    removePoi: 'Удалить POI',
    saveAsPoi: 'Сохранить как POI',
    addToRoute: 'Добавить в маршрут',
  },
  poiFilter: {
    title: 'Фильтр POI',
    hideAll: 'Скрыть все',
    showAll: 'Показать все',
    selectAll: 'Выбрать все',
    searchRadius: 'Радиус поиска',
  },
  filterBar: {
    all: 'Все',
  },
  toolsPanel: {
    title: 'Инструменты',
    fitRouteTitle: 'По маршруту',
    fitRouteAction: 'Центрировать',
    fitRouteDisabledHint: 'Сначала постройте маршрут',
    reverseTitle: 'Развернуть маршрут',
    reverseAction: 'Развернуть',
    reverseDisabledHint: 'Добавьте точки маршрута',
    clearTitle: 'Очистить маршрут',
    clearAction: 'Очистить',
    clearDisabledHint: 'Маршрут уже пустой',
    confirmYes: 'Да!',
    confirmCancel: 'Отмена',
    measureTitle: 'Измерение расстояний',
    measureHint: 'Начните новое измерение, а затем кликните по карте, чтобы добавить точку',
    sessionName: (n) => `Замер ${n}`,
    measureNewSession: 'Начать новое',
    measureDeleteAll: 'Стереть все',
    measureDeleteAriaLabel: 'Удалить замер',
  },
  mobileHeader: {
    hintText: 'Добавьте точки маршрута в выдвижном меню',
    shareAriaLabel: 'Поделиться',
    shareTitle: 'Поделиться',
    downloadAriaLabel: 'Скачать GPX',
    downloadTitle: 'Скачать GPX',
  },
  exportPanel: {
    copied: 'Скопировано!',
    share: 'Поделиться',
    exportGpx: 'Экспорт GPX',
    closeErrorAriaLabel: 'Закрыть',
  },
  searchBar: {
    placeholder: 'Поиск места или координат…',
    coordError: 'Координаты вне диапазона. Широта: −90..90, Долгота: −180..180',
  },
  mapControls: {
    infoAriaLabel: 'Справка',
    settingsAriaLabel: 'Настройки',
    layersAriaLabel: 'Слои карты',
    toolsAriaLabel: 'Инструменты',
  },
  mapLayers: {
    panelTitle: 'Слои карты',
    sectionStyle: 'Стиль',
    labelSatellite: 'Спутник',
    labelTopo: 'Топо',
  },
  mapView: {
    buildingRoute: 'Строю маршрут…',
    searchingPoi: 'Ищу POI…',
  },
  appShell: {
    filterAriaLabel: 'Фильтр POI',
    filterLabel: 'Фильтр',
  },
  appInfo: {
    subtitle: 'Справка по сервису',
    footer: 'TrailX v1.0 · Планировщик велосипедных маршрутов',
    mapAttribution: 'Карта:',
    sections: {
      routing: {
        title: 'Планирование маршрута',
        items: [
          'Введите адрес в поле поиска для добавления точки',
          'Перетаскивайте точки в списке для изменения порядка',
          'Нажмите «Добавить остановку» для добавления промежуточных точек',
          'Все точки маршрута можно удалить кнопкой × справа',
          'Кнопка корзины очищает весь маршрут',
        ],
      },
      profiles: {
        title: 'Виды транспорта',
        items: [
          'Пеший — предпочитает пешеходные дорожки и тропы',
          'Велосипед — оптимальный маршрут по дорогам и велодорожкам',
          'Горный велосипед — учитывает бездорожье и сложный рельеф',
          'Шоссейный велосипед — быстрые дороги с гладким покрытием',
          'В шестерёнке у каждого профиля есть дополнительные настройки',
        ],
      },
      poi: {
        title: 'Поиск POI',
        items: [
          'POI (точки интереса) ищутся автоматически вдоль проложенного маршрута',
          'Кнопка «Фильтр» внизу справа управляет отображаемыми категориями',
          'Кликните на POI, чтобы просмотреть информацию и добавить в маршрут',
          'POI можно добавить как точку маршрута или сохранить отдельно в GPX',
          'Радиус поиска настраивается в разделе «Настройки»',
        ],
      },
      export: {
        title: 'Экспорт GPX',
        items: [
          'Экспорт доступен после построения маршрута',
          'GPX включает трек с высотными данными (elevation)',
          'Сохранённые POI экспортируются как точки <wpt>',
          'Параметры экспорта настраиваются в разделе «Настройки»',
        ],
      },
      telegram: {
        title: 'Telegram Mini App',
        items: [
          'Команда /app открывает приложение с активным маршрутом группы',
          'Команда /add [место] добавляет точку без голосования',
          'Команда /vote [место] создаёт голосование в чате',
          'Команда /gpx отправляет готовый файл маршрута в чат',
          'Команда /weather [дата] строит прогноз погоды вдоль маршрута при скорости 25 км/ч',
        ],
      },
      group: {
        title: 'Групповые маршруты',
        items: [
          'Бесплатно: каждый участник чата видит только свой маршрут',
          'С подпиской: один общий маршрут для всей группы',
          'Все изменения одного участника сразу видны другим (real-time sync)',
          'Достаточно подписки одного участника для активации для всей группы',
        ],
      },
      subscription: {
        title: 'Подписка',
        items: [
          'Команда /upgrade в боте — управление подпиской',
          'Групповые маршруты с синхронизацией в реальном времени',
          'Полный доступ ко всем командам бота для всех участников группы',
        ],
      },
      shortcuts: {
        title: 'Советы',
        items: [
          'Двойной клик по карте — быстрое приближение',
          'Кнопка прицела — центрирование на вашем местоположении',
          'Кнопка слоёв — смена стиля карты',
          'Маршрут строится автоматически при добавлении двух и более точек',
        ],
      },
    },
  },
}
