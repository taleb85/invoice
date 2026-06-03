import type { OperatorDashboardKpis } from '@/lib/dashboard-operator-kpis'
import type { InboxHubNavItem } from '@/components/inbox/InboxOperationalHub'
import { withFiscalYearQuery } from '@/lib/fiscal-link'

type BuildHubItemsOpts = {
  fy: number | null | undefined
  kpis: OperatorDashboardKpis
  emailQueueCount: number
  labels: {
    emailQueue: string
    docQueue: string
    priceAnomalies: string
    dupInvoices: string
    dupBolle: string
    dupOrdini: string
  }
}

/** Voci panoramica Inbox operativo (conteggi FY + coda email sede). */
export function buildInboxOperationalHubItems(opts: BuildHubItemsOpts): InboxHubNavItem[] {
  const { fy, kpis, emailQueueCount, labels } = opts
  return [
    {
      key: 'email-ai',
      label: labels.emailQueue,
      count: emailQueueCount,
      inboxTab: 'docs',
      always: true,
    },
    {
      key: 'doc-queue',
      label: labels.docQueue,
      count: kpis.documentiPending,
      href: withFiscalYearQuery('/statements/da-processare', fy),
    },
    {
      key: 'rekki',
      label: labels.priceAnomalies,
      count: kpis.anomaliePrezziCount,
      href: withFiscalYearQuery('/statements/verifica', fy, { stato: 'anomalia' }),
    },
    {
      key: 'dup-inv',
      label: labels.dupInvoices,
      count: kpis.duplicatiCount,
      inboxTab: 'duplicati',
      inboxDup: 'fatture',
    },
    {
      key: 'dup-bol',
      label: labels.dupBolle,
      count: kpis.duplicatiBolleCount,
      inboxTab: 'duplicati',
      inboxDup: 'bolle',
    },
    {
      key: 'dup-ord',
      label: labels.dupOrdini,
      count: kpis.duplicatiOrdiniCount,
      href: withFiscalYearQuery('/ordini', fy),
    },
  ]
}
