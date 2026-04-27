/**
 * Metadati build esposti da `next.config` (`NEXT_PUBLIC_*`).
 * In locale senza Vercel, commit e env risultano vuoti → etichette «locale» / em dash.
 */

export const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION ?? '0.0.0'

/** Solo etichetta versione (es. `v0.1.0`) per la rail sidebar — niente commit/env. */
export function formatAppVersionLabel(): string {
  return `v${APP_VERSION}`
}

export const VERCEL_GIT_COMMIT_SHA = process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA ?? ''

export const VERCEL_ENV = process.env.NEXT_PUBLIC_VERCEL_ENV ?? ''

export type DeployEnvKind = 'local' | 'production' | 'preview' | 'development'

export function getDeployEnvKind(): DeployEnvKind {
  const e = VERCEL_ENV
  if (e === 'production') return 'production'
  if (e === 'preview') return 'preview'
  if (e === 'development') return 'development'
  return 'local'
}

export type AppBuildUiKeys = {
  appBuildLine: string
  appBuildLineLocal: string
  appBuildNoCommit: string
  deployEnvLocal: string
  deployEnvProduction: string
  deployEnvPreview: string
  deployEnvDevelopment: string
}

/** Riga: versione · commit; su Vercel anche · ambiente (no suffisso «local» in dev). */
export function formatAppBuildLine(ui: AppBuildUiKeys): string {
  const commit = VERCEL_GIT_COMMIT_SHA ? VERCEL_GIT_COMMIT_SHA.slice(0, 7) : ui.appBuildNoCommit
  const kind = getDeployEnvKind()
  if (kind === 'local') {
    return ui.appBuildLineLocal.replaceAll('{version}', APP_VERSION).replaceAll('{commit}', commit)
  }
  const env =
    kind === 'production'
      ? ui.deployEnvProduction
      : kind === 'preview'
        ? ui.deployEnvPreview
        : ui.deployEnvDevelopment

  return ui.appBuildLine.replaceAll('{version}', APP_VERSION).replaceAll('{commit}', commit).replaceAll('{env}', env)
}
