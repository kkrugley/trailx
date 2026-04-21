import { useMapStore } from '../store/useMapStore'
import { ru } from './ru'
import { en } from './en'
import type { Translations } from './ru'

export type { Translations }

const DICTIONARIES = { ru, en } as const

export function useT(): Translations {
  const language = useMapStore((s) => s.appSettings.language)
  return DICTIONARIES[language]
}
