const negotiationChannelNameCache = new Map<string, string | null>()

export function getNegotiationChannelNameCache(userId: string) {
  return negotiationChannelNameCache.get(userId)
}

export function hasNegotiationChannelNameCache(userId: string) {
  return negotiationChannelNameCache.has(userId)
}

export function setNegotiationChannelNameCache(userId: string, channelName: string | null) {
  negotiationChannelNameCache.set(userId, channelName)
}

export function invalidateNegotiationChannelNameCache(userId: string) {
  negotiationChannelNameCache.delete(userId)
}
