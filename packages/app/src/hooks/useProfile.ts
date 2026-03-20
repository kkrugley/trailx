import { useMapStore } from '../store/useMapStore'

export function useProfile() {
  const profile = useMapStore((s) => s.profile)
  const setProfile = useMapStore((s) => s.actions.setProfile)
  return { profile, setProfile }
}
