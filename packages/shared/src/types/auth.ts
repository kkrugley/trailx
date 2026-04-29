export interface AuthUser {
  id: string
  telegramId: string
  name: string
  username?: string
  avatarUrl?: string
}

export interface LocalRoute {
  id: string
  name: string
  waypoints: unknown[]
  createdAt: string
}

export interface SavedRouteDTO {
  id: string
  name: string
  waypoints: unknown[]
  distanceKm: number | null
  elevationM: number | null
  profileId: string
  createdAt: string
  updatedAt: string
}

export interface SaveRoutePayload {
  name: string
  waypoints: unknown[]
  distanceKm?: number
  elevationM?: number
  profileId: string
}

export interface BotRouteDTO {
  id: string
  name: string
  waypoints: unknown[]
  distanceKm: number | null
  elevationM: number | null
  groupId: string
  createdAt: string
  updatedAt: string
}

export interface GroupRouteDTO extends BotRouteDTO {
  groupChatId: string
  isOwner: boolean
}
