/** Vetro satinato condiviso tra dock inferiore e topbar mobile (blur 24px + saturate). */
export const MOBILE_GLASS_SATIN_CLASS =
  'app-glass-satin backdrop-blur-xl [-webkit-backdrop-filter:blur(24px)] backdrop-saturate-150'

/** Bordo + alone come `DashboardMobileBottomNav` (`border-app-line-28`, ring cyan). */
export const MOBILE_GLASS_CHROME_FRAME_CLASS =
  'border border-app-line-28 ring-1 ring-inset ring-app-a-35'

/** Ombra verso il basso (topbar); il dock usa la variante speculare `MOBILE_GLASS_CHROME_SHADOW_BOTTOM`. */
export const MOBILE_GLASS_CHROME_SHADOW_TOP =
  'shadow-[0_8px_32px_-8px_rgba(0,0,0,0.55),inset_0_1px_0_rgba(255,255,255,0.07)]'

/** Ombra verso l’alto (dock). */
export const MOBILE_GLASS_CHROME_SHADOW_BOTTOM =
  'shadow-[0_-8px_32px_-8px_rgba(0,0,0,0.55),inset_0_1px_0_rgba(255,255,255,0.07)]'

export const MOBILE_TOPBAR_GLASS_BAR_CLASS = [
  MOBILE_GLASS_SATIN_CLASS,
  MOBILE_GLASS_CHROME_FRAME_CLASS,
  MOBILE_GLASS_CHROME_SHADOW_TOP,
].join(' ')
