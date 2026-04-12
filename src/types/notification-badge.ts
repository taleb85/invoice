export type NotificationBadgePayload = {
  isAdmin: boolean
  adminLogErrors24h: number
  operatorPendingDocs: number
  /** Errori log 24h visibili all’operatore (stessa query, RLS). */
  operatorLogErrors24h: number
}
