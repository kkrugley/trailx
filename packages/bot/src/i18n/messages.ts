export type Language = 'ru' | 'en'

const messages = {
  ru: {
    // /settings
    settingsTitle: '⚙️ Настройки',
    settingsLangLabel: '🌐 Язык',
    settingsProfileLabel: '🚴 Профиль маршрута',
    settingsBtnLang: 'Сменить язык',
    settingsBtnProfile: 'Сменить профиль',
    settingsLangMenu: '🌐 Выбери язык:',
    settingsProfileMenu: '🚴 Выбери профиль маршрута:',
    settingsSaved: 'Сохранено ✓',

    // /add
    addUsage:
      'Использование:\n/add <место> — поиск по названию\n/add <широта> <долгота> — добавить по координатам\n\nПример: /add Брест вокзал\nПример: /add 52.0977 23.7341',
    addNoRoute: 'Нет активного маршрута. Создай через /plan <название>.',
    addRouteNotFound: 'Активный маршрут не найден.',
    addFreeTierLimit:
      '⚠️ Бесплатный план позволяет добавить до {limit} точек в маршрут.\n\nОформи TrailX Pro через /upgrade для неограниченного количества точек.',
    addNotFound: 'Место "{place}" не найдено. Попробуй /add с более точным запросом.',
    addFound: 'Найдено {count} {word}. Выбери нужное:',
    addFoundWord1: 'место',
    addFoundWord234: 'места',
    addFoundWordMany: 'мест',
    addRefinePrompt: 'Введи уточнённый запрос для поиска:',
    addRefinePlaceholder: 'Например: Брест, ул. Ленина',
    addRefineBtn: '🔍 Уточнить поиск',
    addAdded: '✅ *{name}* добавлен в маршрут!\nТочек в маршруте: {count}',
    addExpired: 'Время поиска истекло. Повтори /add.',
    addRouteNotFoundCb: 'Маршрут не найден.',
    addError: 'Произошла ошибка. Попробуй позже.',

    // /gpx
    gpxNoRoute: 'Нет активного маршрута. Создай через /plan <название>.',
    gpxRouteNotFound: 'Маршрут не найден.',
    gpxEmpty: 'Маршрут пуст. Добавь точки через /add <место>.',
    gpxCaption: '🗺 {name} — {count} точек',
    gpxCaptionRouted: '🗺 {name} · {distance} км · ↑{ascent} м · профиль: {profile}',
    gpxCaptionFallback: '⚠️ Не удалось построить маршрут — файл с прямыми линиями',
    gpxError: 'Произошла ошибка. Попробуй позже.',
  },
  en: {
    // /settings
    settingsTitle: '⚙️ Settings',
    settingsLangLabel: '🌐 Language',
    settingsProfileLabel: '🚴 Route profile',
    settingsBtnLang: 'Change language',
    settingsBtnProfile: 'Change profile',
    settingsLangMenu: '🌐 Choose language:',
    settingsProfileMenu: '🚴 Choose route profile:',
    settingsSaved: 'Saved ✓',

    // /add
    addUsage:
      'Usage:\n/add <place> — search by name\n/add <lat> <lon> — add by coordinates\n\nExample: /add Brest station\nExample: /add 52.0977 23.7341',
    addNoRoute: 'No active route. Create one with /plan <name>.',
    addRouteNotFound: 'Active route not found.',
    addFreeTierLimit:
      '⚠️ Free plan allows up to {limit} waypoints.\n\nUpgrade to TrailX Pro via /upgrade for unlimited waypoints.',
    addNotFound: 'Place "{place}" not found. Try /add with a more specific query.',
    addFound: 'Found {count} {word}. Choose one:',
    addFoundWord1: 'place',
    addFoundWord234: 'places',
    addFoundWordMany: 'places',
    addRefinePrompt: 'Enter a refined search query:',
    addRefinePlaceholder: 'e.g. Brest, Lenin St.',
    addRefineBtn: '🔍 Refine search',
    addAdded: '✅ *{name}* added to route!\nWaypoints: {count}',
    addExpired: 'Search expired. Try /add again.',
    addRouteNotFoundCb: 'Route not found.',
    addError: 'An error occurred. Please try again.',

    // /gpx
    gpxNoRoute: 'No active route. Create one with /plan <name>.',
    gpxRouteNotFound: 'Route not found.',
    gpxEmpty: 'Route is empty. Add waypoints with /add <place>.',
    gpxCaption: '🗺 {name} — {count} waypoints',
    gpxCaptionRouted: '🗺 {name} · {distance} km · ↑{ascent} m · profile: {profile}',
    gpxCaptionFallback: '⚠️ Could not build route — file contains straight lines',
    gpxError: 'An error occurred. Please try again.',
  },
} as const

type MessageKey = keyof (typeof messages)['ru']

export function t(
  lang: Language,
  key: MessageKey,
  vars?: Record<string, string | number>,
): string {
  const dict = messages[lang] ?? messages.ru
  let str = (dict as Record<string, string>)[key] ?? (messages.ru as Record<string, string>)[key] ?? key
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      str = str.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v))
    }
  }
  return str
}

export function pluralRu(
  lang: Language,
  count: number,
  key1: MessageKey,
  key234: MessageKey,
  keyMany: MessageKey,
): string {
  if (lang === 'en') return t(lang, key1)
  const mod10 = count % 10
  const mod100 = count % 100
  if (mod100 >= 11 && mod100 <= 14) return t(lang, keyMany)
  if (mod10 === 1) return t(lang, key1)
  if (mod10 >= 2 && mod10 <= 4) return t(lang, key234)
  return t(lang, keyMany)
}
