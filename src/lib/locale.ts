/**
 * Client-safe locale helpers (no `next/headers`).
 * For Server Components / Route Handlers use `@/lib/locale-server` (getT, getLocale, …).
 */
export {
  LOCALE_COOKIE,
  CURRENCY_COOKIE,
  TIMEZONE_COOKIE,
  formatDate,
  formatCurrency,
} from './locale-shared'
