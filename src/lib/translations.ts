export type Locale = 'it' | 'en' | 'es' | 'fr' | 'de'

/** Maps a sede country_code to the best UI Locale. Falls back to 'en'. */
export const COUNTRY_TO_LOCALE: Record<string, Locale> = {
  IT: 'it', it: 'it',
  UK: 'en', GB: 'en', uk: 'en', gb: 'en',
  ES: 'es', es: 'es',
  FR: 'fr', fr: 'fr',
  DE: 'de', de: 'de',
  AT: 'de', CH: 'de',
  MX: 'es', AR: 'es',
  CA: 'fr', BE: 'fr',
}

export function localeFromCountryCode(cc: string | null | undefined): Locale {
  return COUNTRY_TO_LOCALE[cc?.trim() ?? ''] ?? 'en'
}

export const LOCALES: { code: Locale; label: string; flag: string }[] = [
  { code: 'it', label: 'Italiano', flag: '🇮🇹' },
  { code: 'en', label: 'English', flag: '🇬🇧' },
  { code: 'es', label: 'Español', flag: '🇪🇸' },
  { code: 'fr', label: 'Français', flag: '🇫🇷' },
  { code: 'de', label: 'Deutsch', flag: '🇩🇪' },
]

export const CURRENCIES = [
  { code: 'EUR', symbol: '€', label: 'Euro' },
  { code: 'USD', symbol: '$', label: 'US Dollar' },
  { code: 'GBP', symbol: '£', label: 'British Pound' },
  { code: 'CHF', symbol: 'CHF', label: 'Swiss Franc' },
  { code: 'JPY', symbol: '¥', label: 'Japanese Yen' },
  { code: 'CAD', symbol: 'CA$', label: 'Canadian Dollar' },
  { code: 'AUD', symbol: 'A$', label: 'Australian Dollar' },
]

export const TIMEZONES = [
  { value: 'Europe/Rome', label: 'Rome (CET/CEST)' },
  { value: 'Europe/London', label: 'London (GMT/BST)' },
  { value: 'Europe/Paris', label: 'Paris (CET/CEST)' },
  { value: 'Europe/Berlin', label: 'Berlin (CET/CEST)' },
  { value: 'Europe/Madrid', label: 'Madrid (CET/CEST)' },
  { value: 'America/New_York', label: 'New York (EST/EDT)' },
  { value: 'America/Chicago', label: 'Chicago (CST/CDT)' },
  { value: 'America/Los_Angeles', label: 'Los Angeles (PST/PDT)' },
  { value: 'America/Sao_Paulo', label: 'São Paulo (BRT)' },
  { value: 'Asia/Tokyo', label: 'Tokyo (JST)' },
  { value: 'Asia/Dubai', label: 'Dubai (GST)' },
  { value: 'Australia/Sydney', label: 'Sydney (AEST/AEDT)' },
]

type Translations = {
  ui: {
    tagline:          string   // sidebar app subtitle
    closeMenu:        string
    expandSidebar:    string
    /** Bottom nav: opens full sidebar (Sedi, impostazioni, ecc.) */
    navMore:          string
    collapseSidebar:  string
    changeOperator:   string
    /** Etichetta compatta (pulsanti stretti, mobile). */
    changeOperatorShort: string
    selectOperator:   string
    activeOperator:   string   // "Attivo" badge
    noOperator:       string   // "Nessuno"
    operatorLabel:    string   // "Operatore" label
    operatorChanged:  string   // success message
    noOperatorsFound: string
    /** Admin: nessuna sede sul profilo e nessuna sede in anagrafica → non si può caricare la lista */
    noSedeForOperators: string
    currentlyActive:  string   // "Attivo:" prefix
    languageTooltip:  string
    syncError:        string
    syncSuccess:      string
    networkError:     string
    connectionOnline: string
    connectionOffline: string
    /** Rete tornata ma fase di stabilizzazione (pallino arancione). */
    connectionReconnecting: string
    emailSyncResumed: string
    /** Stream NDJSON chiuso senza evento `done` (timeout proxy, errore server, ecc.). */
    emailSyncStreamIncomplete: string
    /** Secondo avvio sync mentre è già in corso (blocco heartbeat). */
    emailSyncAlreadyRunning: string
    /** Toast dopo stop manuale sincronizzazione email. */
    emailSyncCancelled: string
    reminderError:    string
    noReminders:      string
    remindersCount:   string   // "{n} sent of {total}" — built in code
    pinError:         string
    /** Admin: confirm supplier card actions with operator PIN */
    operatorPinStepUpTitle: string
    operatorPinStepUpHint: string
    /** Step-up PIN: nessun operatore attivo in sessione */
    operatorPinStepUpNoActive: string
    /** Step-up PIN: apre il modal «Cambio operatore» */
    operatorPinStepUpChooseOperator: string
    verifyAndContinue: string
    /** Modal cambio operatore: timeout inattività */
    operatorAutoLockLabel: string
    operatorAutoLockNever: string
    /** "{n}" = minuti, es. "5 min" */
    operatorAutoLockMinutes: string
    /** Batch reminder API: 1 vs N sent (proper plural per language) */
    remindersSentOne: string
    remindersSentMany: string
    /** Sidebar — tooltip: active location badge "{name}" */
    sidebarSedeActive: string
    /** Sidebar — tooltip: switch to location "{name}" */
    sidebarSedeSwitchTo: string
    /** Sidebar — tooltip: settings for location "{name}" */
    sidebarSedeSettings: string
    /** Con deploy Vercel: {version} · {commit} · {env} */
    appBuildLine: string
    /** Sviluppo locale / senza Vercel: niente etichetta ambiente (niente “local” in coda) */
    appBuildLineLocal: string
    /** Commit assente (build senza Vercel / locale) */
    appBuildNoCommit: string
    /** accessibile: riga versione + build */
    appBuildAria: string
    deployEnvLocal: string
    deployEnvProduction: string
    deployEnvPreview: string
    deployEnvDevelopment: string
  }
  login: {
    /** Sotto il logo Smart Pair (maiuscole via CSS) */
    brandTagline: string
    subtitle: string
    /** Titolo sotto il logo in modalità admin */
    adminSubtitle: string
    /** Chiarimento (riga secondaria, più discreta) */
    adminSubtitleHint: string
    nameLabel: string
    namePlaceholder: string
    /** Etichetta codice sede (ex PIN) */
    pinLabel: string
    pinDigits: string
    lookingUp: string
    enterFirstName: string
    emailLabel: string
    emailPlaceholder: string
    passwordLabel: string
    passwordPlaceholder: string
    loginBtn: string
    adminLink: string
    operatorLink: string
    pinIncorrect: string
    invalidCredentials: string
    verifying: string
    accessing: string
    notFound: string
    /** Email/password login is reserved for administrators */
    adminOnlyEmail: string
    /** PIN per sbloccare il form admin (se configurato in server) */
    adminGateLabel: string
    adminGateHint: string
    adminGateWrong: string
    /** Schermata /accesso: nuova sessione browser */
    sessionGateTitle: string
    sessionGateSubtitle: string
    sessionGateWrongUser: string
    /** Redirect da UserProvider se /api/me resta in caricamento oltre il limite (splash infinita). */
    sessionBootStuck: string
    /** Griglia operatori stile Netflix (pagina login sede) */
    netflixTitle: string
    netflixSubtitle: string
    netflixManualLogin: string
    netflixChangeOperator: string
    /** PWA /accesso: fiducia dispositivo */
    deviceTrustTitle: string
    deviceTrustYes: string
    deviceTrustNo: string
    /** Saluto dopo restore sessione dispositivo; sostituire {name} */
    deviceWelcomeBack: string
    /** Sotto Bentornato: invito esplicito a toccare Accedi prima del PIN */
    deviceWelcomeAccediHint: string
    /** Link in alto: nuova selezione operatore (reset device locale) */
    accessoSwitchOperator: string
  }
  nav: {
    dashboard: string
    /** First hub tab label when user is administrator (mobile bottom bar). */
    dashboardAdmin: string
    /** Sede context: bottom bar link to operators section on branch profile. */
    operatori: string
    fornitori: string
    bolle: string
    fatture: string
    /** Voce nav + pagina /ordini — conferme d'ordine */
    ordini: string
    archivio: string
    logEmail: string
    sedi: string
    sediTitle: string
    /** Gruppo sedi in sidebar (solo master admin / Portale Gestionale) */
    sediNavGroupMaster: string
    /** Link /sedi con sede associata: sostituire `{name}` */
    gestisciSedeNamed: string
    /** Link /sedi senza sede sul profilo (fallback) */
    gestisciSedi: string
    tuttiFornitori: string
    cerca: string
    nessunRisultato: string
    altriRisultati: string
    impostazioni: string
    nuovaBolla: string
    /** Short label: scroll to digital receipt form (mobile dashboard). */
    ricevuto: string
    /** Mobile bottom bar: nessun operatore — invito a indicare chi è operativo. */
    operatorActiveHint: string
    esci: string
    guida: string
    /** Admin sidebar: nessuna sede selezionata — dashboard aggregata */
    sedeGlobalOverview: string
    /** Mobile bottom nav — supplier mode: exit to branch / suppliers */
    bottomNavBackToSede: string
    /** Mobile bottom nav — operator home: AI / reconciliation entry */
    bottomNavScannerAi: string
    /** Mobile bottom nav — settings shortcut */
    bottomNavProfile: string
    /** Mobile bottom nav — admin: branches */
    bottomNavSediMap: string
    /** Mobile bottom nav — admin: global dashboard */
    bottomNavGlobalReports: string
    /** Mobile bottom nav — supplier: new delivery note / order */
    bottomNavNewOrder: string
    /** Mobile bottom nav — supplier: price list tab */
    bottomNavPriceHistory: string
    /** Mobile bottom nav — supplier: open summary / contact context */
    bottomNavContact: string
    /** Supplier profile bottom bar: open new delivery note (supplier pre-selected). */
    addNewDelivery: string
    /** Supplier profile bottom bar: open Rekki in a new tab. */
    openRekki: string
    /** Bottom nav landmark — operator main */
    ariaMain: string
    /** Bottom nav landmark — admin */
    ariaAdmin: string
    /** Bottom nav landmark — supplier detail */
    ariaFornitore: string
    /** Call button on supplier mobile bar */
    ariaCallSupplier: string
    /** Notification bell / menu title */
    notifications: string
    /** No items to show in notification menu */
    noNotifications: string
    /** Link label: sync log errors (24h) */
    errorAlert: string
    /** Sidebar — analytics dashboard link */
    analytics: string
    /** Sidebar — invoice approval queue link */
    approvazioni: string
    /** Sidebar — operator activity log link */
    attivita: string
    /** Sidebar — CSV backup manager link */
    backup: string
    /** Sidebar — Gemini AI usage dashboard (master admin only) */
    consumiAi: string
    /** Sidebar / breadcrumb — hub strumenti amministrativi */
    strumenti: string
  }
  common: {
    save: string
    cancel: string
    delete: string
    edit: string
    new: string
    loading: string
    error: string
    success: string
    noData: string
    document: string
    actions: string
    date: string
    status: string
    supplier: string
    notes: string
    phone: string
    saving: string
    attachment: string
    openAttachment: string
    detail: string
    add: string
    rename: string
    role: string
    aiExtracted: string
    matched: string
    notMatched: string
    /** Badge dati IA: fornitore già scelto in anagrafica anche se OCR non ha auto-match */
    recordSupplierLinked: string
    company: string
    invoiceNum: string
    /** Riga IA coda: numero estratto quando non è (ancora) classificato come fattura */
    documentRef: string
    total: string
    /** Badge elenco fatture/bolle: stessa chiave logica di un altro documento */
    duplicateBadge: string
    /** OCR email: registrazione automatica senza revisione obbligatoria */
    emailSyncAutoSavedBadge: string
    viewerZoomIn: string
    viewerZoomOut: string
    viewerZoomReset: string
    /** Anteprima documenti inline */
    viewerZoomHint: string
  }
  status: {
    inAttesa: string
    completato: string
    completata: string
  }
  dashboard: {
    title: string
    suppliers: string
    totalBills: string
    pendingBills: string
    invoices: string
    recentBills: string
    /** Dashboard mobile operatore: elenco bolle nascosto */
    recentBillsMobileListDisabled: string
    viewAll: string
    syncEmail: string
    /** Periodo sync: lookback da impostazioni sede */
    emailSyncScopeLookback: string
    /** Periodo sync: anno fiscale (etichetta dipende dal paese sede) */
    emailSyncScopeFiscal: string
    emailSyncFiscalYearSelectAria: string
    emailSyncScopeHint: string
    /** Lookback: usa impostazione IMAP della sede */
    emailSyncLookbackSedeDefault: string
    /** Lookback: etichetta con segnaposto `{n}` (giorni) */
    emailSyncLookbackDaysN: string
    emailSyncLookbackDaysAria: string
    emailSyncLookbackDaysHint: string
    emailSyncDocumentKindAria: string
    emailSyncDocumentKindHint: string
    emailSyncDocumentKindAll: string
    emailSyncDocumentKindFornitore: string
    emailSyncDocumentKindBolla: string
    emailSyncDocumentKindFattura: string
    emailSyncDocumentKindEstratto: string
    syncing: string
    sendReminders: string
    sending: string
    viewLog: string
    sedeOverview: string
    /** CTA con sede associata: sostituire `{name}` */
    manageSedeNamed: string
    /** CTA senza sede associata (fallback) */
    manageSedi: string
    /** Short badge when sede IMAP is configured */
    sedeImapOn: string
    /** Mobile dashboard: manual digital receipt section title */
    digitalizzaRicevuto: string
    /** Dashboard: card riepilogo flusso Scanner (eventi sede, non liste bolle/fatture) */
    scannerFlowCardTitle: string
    scannerFlowCardHint: string
    scannerFlowAiElaborate: string
    scannerFlowArchived: string
    scannerFlowOpenScanner: string
    /** Sotto la card Scanner: titolo sezione bolle quando l’elenco è nascosto (mobile/stack) */
    scannerFlowBolleHubTitle: string
    /** Card lista eventi Scanner (stile bolle recenti) */
    scannerFlowRecentTitle: string
    scannerFlowNoRecent: string
    /** Oggi: {ai} … {arch} … */
    scannerFlowTodayCounts: string
    /** Riga sotto il titolo card Scanner (dashboard): {year} = etichetta anno fiscale (es. 2026 o 2025/26) */
    scannerFlowFiscalPeriodLine: string
    /** Sottotitolo card quando i KPI sono sull’anno fiscale selezionato */
    scannerFlowCardHintFiscal: string
    /** Modal dettaglio: conteggio documenti, periodo fiscale / custom */
    scannerFlowDetailListCountRange: string
    /** Modal dettaglio: conteggio documenti, solo oggi (stesso fuso del server) */
    scannerFlowDetailListCountToday: string
    /** Modal elenco vuoto, periodo non giornaliero */
    scannerFlowDetailEmptyRange: string
    /** Descrizione evento `ai_elaborata` nella timeline giornaliera */
    scannerFlowStepAiElaborata: string
    scannerFlowStepArchiviataBolla: string
    scannerFlowStepArchiviataFattura: string
    scannerFlowTodayActivityTitle: string
    scannerFlowNoEventsToday: string
    /** Dashboard: link a pagina elenco eventi scanner */
    scannerFlowEventsAllLink: string
    /** Pagina /scanner/eventi */
    scannerFlowEventsPageTitle: string
    scannerFlowEventsEmpty: string
    scannerFlowEventsPrev: string
    scannerFlowEventsNext: string
    /** Segnaposto {current} {pages} */
    scannerFlowEventsPageOf: string
    /** Dashboard mobile: invito al tap sull’intera card verso /bolle/new */
    scannerMobileTileTap: string
    /** Dashboard: pulsante ricerca fatture duplicate (stesso fornitore/data/numero) */
    duplicateFattureScanButton: string
    /** Barra operatore desktop/header: label breve su viewport stretta */
    duplicateFattureToolbarShort: string
    sendRemindersToolbarShort: string
    syncEmailToolbarShort: string
    /** Barra: sync automatica + tempo relativo `{relative}` */
    emailSyncCronLine: string
    emailSyncCronIssueLine: string
    emailSyncCronNever: string
    emailSyncCronJustNow: string
    /** Segnaposto `{n}` minuti */
    emailSyncCronMinutesAgo: string
    /** Segnaposto `{n}` ore */
    emailSyncCronHoursAgo: string
    /** `last_imap_sync_at` ritardo (>30 min) */
    emailSyncCronLateLine: string
    /** `last_imap_sync_at` assente o >60 min */
    emailSyncCronStoppedLine: string
    emailSyncForceSync: string
    emailSyncEmergencyToolsAria: string
    duplicateFattureModalTitle: string
    duplicateFattureScanning: string
    /** Anteprima durante lo scan NDJSON: ultimo lotto letto */
    duplicateFattureScanningBatch: string
    /** Elenco ancora vuoto: primo blocco Supabase in arrivo */
    duplicateFattureScanningAwaitingRows: string
    duplicateFattureNone: string
    duplicateFattureError: string
    /** Segnaposto {n} = numero copie nel gruppo */
    duplicateFattureGroupCount: string
    duplicateFattureSedeUnassigned: string
    duplicateFattureTruncated: string
    duplicateFattureClose: string
    /** Segnaposto {n} = conteggio fatture lette per il report duplicati */
    duplicateFattureRowsAnalyzed: string
    /** Conferma eliminazione una copia dal modal duplicati */
    duplicateFattureDeleteConfirm: string
    duplicateFattureDeleteAria: string
    /** Banner dashboard: segnalazione duplicati globali. Segnaposto {n} */
    duplicateDashboardBanner_one: string
    duplicateDashboardBanner_other: string
    /** KPI operatore: filtro anno fiscale per i conteggi delle schede */
    kpiFiscalYearFilter: string
    kpiFiscalYearFilterAria: string
    /** Barra desktop dashboard: link rapidi alle sezioni (stesse destinazioni delle tile KPI) */
    workspaceQuickNavAria: string
    /** Dashboard header: apre il pannello duplicati / solleciti / sync email */
    desktopHeaderSedeToolsMenuTrigger: string
    desktopHeaderSedeToolsMenuAria: string
    /** Segnaposto {n} = fornitori distinti con bolla in attesa in scadenza (stesso conteggio del badge sul trigger). */
    desktopHeaderSedeToolsMenuTriggerAriaReminders: string
    /** KPI sheet: lista bolle in attesa vuota */
    kpiNoPendingBills: string
    /** Overlay griglia KPI quando il client è offline */
    kpiOperatorOfflineOverlayTitle: string
    kpiOperatorOfflineOverlayHint: string
    /** Card listino con anomalie: sottotitolo con {n} */
    kpiListinoAnomaliesCountLine: string
    /** Link/badge sotto la card Bolle: elenco filtrato pending=1 */
    kpiBollePendingListCta: string
    /** KPI fatturato: avviso copie in eccesso (stesso fornitore/numero/importo). Segnaposto {n}. */
    kpiDuplicateInvoicesDetected: string
    /** KPI bolle: avviso stesso fornitore/numero bolla. Segnaposto {n}. */
    kpiDuplicateBolleDetected: string
    /** KPI: duplicati + sconosciuti + anomalie Rekki (stesso conteggio della tile cliccabile). */
    kpiDocumentiDaRevisionareTitle: string
    kpiDocumentiDaRevisionareSub: string
    /** Pagina hub criticità operative. */
    inboxUrgentePageTitle: string
    inboxUrgentePageIntro: string
    inboxUrgenteNavDocQueue: string
    inboxUrgenteNavPriceAnomalies: string
    inboxUrgenteNavInvoices: string
    inboxUrgenteNavBolle: string
    inboxUrgenteNavOrdini: string
    /** Hub AI inbox: classificazione e duplicati */
    inboxUrgenteNavAiInbox: string
    /** Dashboard header: suffisso dopo il numero (es. "3 errori") */
    errorCountSuffix: string
    /** Manual digital receipt form (mobile) */
    manualReceiptLabel: string
    manualReceiptPlaceholder: string
    manualReceiptRegister: string
    manualReceiptRegistering: string
    manualReceiptSaved: string
    manualReceiptNeedTextOrPhoto: string
    manualReceiptRemovePhoto: string
    manualReceiptNeedSupplier: string
    /** Errore generico API ricevuta digitale (corpo risposta assente) */
    manualReceiptRegisterFailed: string
    /** Checkbox: dopo “ricevuto senza bolla”, chiedi ordine + DDT via email */
    manualReceiptEmailSupplierLabel: string
    manualReceiptEmailSupplierHint: string
    manualReceiptEmailSent: string
    manualReceiptEmailFailed: string
    /** Testo incluso nell’email se l’operatore ha solo la foto, senza testo */
    manualReceiptEmailDescPhotoOnly: string
    /** Admin: titolo dashboard senza sede operativa selezionata */
    adminGlobalTitle: string
    adminGlobalSubtitle: string
    /** Riga riepilogo totali multi-sede */
    adminGlobalTotalsLabel: string
    /** CTA card sede: apri vista operativa su questa filiale */
    adminOpenBranchDashboard: string
    /** Link scheda sede (impostazioni filiale) */
    adminSedeSettingsLink: string
    /** Badge sintetico documenti in coda */
    adminDocQueueShort: string
    /** Quick action: open Rekki ordering (external) */
    rekkiOrder: string
    /** Manual delivery sheet: no sede / operator context */
    manualDeliveryNeedSede: string
    /** Operator dashboard KPI — listino card subtitle */
    kpiPriceListSub: string
    /** Pagina /listino — descrizione */
    listinoOverviewHint: string
    /** Pagina /listino — vuoto */
    listinoOverviewEmpty: string
    /** Pagina /listino — link scheda fornitore */
    listinoOverviewOpenSupplier: string
    /** Pagina /listino — nota limite righe {n} */
    listinoOverviewLimitNote: string
    /** Pagina /fatture/riepilogo — titolo */
    fattureRiepilogoTitle: string
    /** Pagina /fatture/riepilogo — descrizione */
    fattureRiepilogoHint: string
    /** Pagina /fatture/riepilogo — vuoto */
    fattureRiepilogoEmpty: string
    /** Pagina /fatture/riepilogo — nota limite tabella {n} */
    fattureRiepilogoLimitNote: string
    /** Pagina /fatture/riepilogo — link dettaglio fattura */
    fattureRiepilogoOpenInvoice: string
    /** Pagina /fatture/riepilogo — sottotitolo totale, {n} = conteggio fatture */
    fattureRiepilogoCountLabel: string
    /** Pagina /fatture/riepilogo — link elenco completo */
    fattureRiepilogoLinkAll: string
    /** Operator dashboard — no statements in scope */
    kpiStatementNone: string
    /** Operator dashboard — all statements OK */
    kpiStatementAllOk: string
    /** Operator dashboard — {t} = total statements in scope (footer when there are anomalies) */
    kpiStatementIssuesFooter: string
    /** Card Da processare: sottotitolo sotto il conteggio (coda documenti) */
    kpiDaProcessareSub: string
    /** Card Ordini (KPI dashboard): sottotitolo */
    kpiOrdiniSub: string
    /** Pagina /ordini — descrizione */
    ordiniOverviewHint: string
    ordiniOverviewEmpty: string
    ordiniOverviewOpenSupplier: string
    ordiniOverviewLimitNote: string
    ordiniColSupplier: string
    ordiniColTitle: string
    ordiniColOrderDate: string
    ordiniColRegistered: string
    ordiniOpenPdf: string
    /** Menu PDF ordini / conferme: anteprima in-app */
    ordiniPdfPreview: string
    ordiniPdfOpenNewTab: string
    ordiniPdfCopyLink: string
    ordiniPdfLinkCopied: string
    /** Operatore: profilo senza sede assegnata */
    operatorNoSede: string
    /** Banner: OCR ha proposto un fornitore non in rubrica — {name} = nome estratto */
    suggestedSupplierBanner: string
    suggestedSupplierAdd: string
    /** Conferma immediata sulla dashboard senza navigare */
    suggestedSupplierConfirm: string
    /** Secondario: vai al modulo compilato come fallback */
    suggestedSupplierOpenForm: string
    suggestedSupplierSavedToast: string
    /** Suggerimento successivo (cookie: documento ignorato temporaneamente) */
    suggestedSupplierSkip: string
    /** Banner click: una voce in coda — invito ad aprire drawer */
    suggestedSupplierBannerTeaser_one: string
    /** Banner click: più voci — {n} = numero intero */
    suggestedSupplierBannerTeaser_many: string
    suggestedSupplierDrawerTitle: string
    suggestedSupplierSenderLabel: string
    suggestedSupplierFirstContactLabel: string
    suggestedSupplierIgnore: string
    suggestedSupplierDrawerCloseScrimAria: string
    enterAsSede: string
    syncHealthAlert: string
    syncHealthOcrCount: string
    viewingAsSedeBanner: string
    exitSedeView: string
    emailSyncQueued: string
    emailSyncPhaseConnect: string
    emailSyncConnectToServer: string
    emailSyncConnectOpeningMailbox: string
    emailSyncPhaseSearch: string
    emailSyncPhaseProcess: string
    emailSyncPhasePersist: string
    emailSyncPhaseDone: string
    emailSyncStalled: string
    /** Chiarimento: stall = assenza heartbeat stream, non retry IMAP (quelli in rosso in connect). */
    emailSyncStalledHint: string
    /** Retry connessione IMAP — {current} {max} */
    emailSyncImapRetryLine: string
    /** title tooltip sui numeri nella barra di sync */
    emailSyncCountsHint: string
    /** Casella IMAP globale (variabili d’ambiente) */
    emailSyncMailboxGlobal: string
    /** Casella sede — {name} */
    emailSyncMailboxSede: string
    /** Filtro fornitore in scansione mirata — {name} */
    emailSyncSupplierFilterLine: string
    /** Email rilevate in casella nel periodo (lette e non lette) — {found} */
    emailSyncStatFoundLine: string
    /** Documenti nuovi salvati in app — {imported} (= ricevuti API) */
    emailSyncStatImportedLine: string
    /** Email passate per intero in elaborazione — {processed} */
    emailSyncStatProcessedLine: string
    /** Opzionale se > 0 — {n} unità già in log da sync precedente */
    emailSyncStatAlreadyLine: string
    /** Opzionale se > 0 — {ignored} */
    emailSyncStatIgnoredLine: string
    /** Opzionale se > 0 — {drafts} */
    emailSyncStatDraftsLine: string
    /** Unità = allegati PDF/immagine + corpi email idonei — {done}, {total} */
    emailSyncStatUnitsLine: string
    /** Pulsante dettagli sync nell’header (aria-label) */
    emailSyncStripDetailsExpandAria: string
    emailSyncStripDetailsCollapseAria: string
    emailSyncStop: string
    emailSyncStopAria: string
    emailSyncDismiss: string
    emailSyncDismissAria: string
    /** Admin: nome estratto ripetutamente dal corpo email — placeholder {name} */
    potentialSupplierFromEmailBodyBanner: string
    potentialSupplierFromEmailBodyCta: string
  }
  fornitori: {
    title: string
    new: string
    nome: string
    email: string
    piva: string
    noSuppliers: string
    addFirst: string
    editTitle: string
    /** Mobile senza permessi modifica: banner scheda fornitore */
    profileViewOnlyBanner: string
    saveChanges: string
    notFound: string
    deleteConfirm: string
    importaDaFattura: string
    countLabel: string
    namePlaceholder: string
    emailPlaceholder: string
    pivaLabel: string
    pivaPlaceholder: string
    addressLabel: string
    addressPlaceholder: string
    rekkiLinkLabel: string
    rekkiLinkPlaceholder: string
    rekkiIdLabel: string
    rekkiIdPlaceholder: string
    rekkiIntegrationTitle: string
    /** Apre profilo Rekki o ricerca Google site:rekki nell’overlay (iframe). */
    rekkiOpenInApp: string
    /** Titolo pannello slide-over Rekki / ricerca. */
    rekkiEmbedPanelTitle: string
    /** Sheet Rekki: messaggio con `{name}` = fornitore. */
    rekkiSheetOpeningLine: string
    rekkiSheetGoCta: string
    rekkiSheetEmbedHint: string
    rekkiSheetPopupButton: string
    /** Titolo sezione anteprima (OG) nel foglio Rekki */
    rekkiSheetPagePreviewCaption: string
    rekkiSheetPagePreviewLoading: string
    rekkiSheetPagePreviewUnavailable: string
    rekkiLookupByVat: string
    /** Link secondario: ricerca ID Rekki via API (POST /api/fornitore-rekki) */
    rekkiLookupApiLink: string
    rekkiSaveRekkiMapping: string
    /** Salvataggio rapido mapping Rekki (link + ID) dalla scheda fornitore */
    rekkiSaveMapping: string
    /** Header card Rekki — nessun link/ID (stato pulito, non dirty) */
    rekkiStatusNotConnected: string
    /** Header card Rekki — mapping salvato (non dirty) */
    rekkiStatusConnected: string
    /** Header card Rekki — modifiche locali non ancora salvate */
    rekkiStatusPending: string
    rekkiConnectedBadge: string
    rekkiCachedListBanner: string
    /** Griglia fornitori: footer con lucchetto prima del PIN (Modifica / Elimina) */
    cardFooterUnlockPin: string
    rekkiLookupNeedVat: string
    /** Dopo incolla link Rekki e blur */
    rekkiIdExtractedFromLink: string
    /** Un solo risultato API P.IVA → salvataggio automatico */
    rekkiAutoLinkedSingle: string
    /** Apre Google site:rekki.com + P.IVA (nuova scheda) */
    rekkiSearchOnRekkiGoogle: string
    /** Seconda ricerca per ragione sociale */
    rekkiSearchOnRekkiGoogleByName: string
    /** Dopo ricerca fallita / senza API */
    rekkiGuidedPasteHint: string
    /** ID field still looks like URL after parsing attempt */
    rekkiIdUrlNotParsed: string
    saving: string
    // supplier detail page tabs & KPIs
    tabRiepilogo: string
    tabListino: string
    tabAuditPrezzi: string
    /** Archivio conferme d'ordine (PDF) sulla scheda fornitore */
    tabConfermeOrdine: string
    tabStrategyConto: string
    kpiBolleTotal: string
    kpiFatture: string
    /** KPI scheda fornitore — conferme ordine nel mese */
    kpiOrdini: string
    kpiPending: string
    kpiReconciliation: string
    subAperte: string
    subConfermate: string
    subDaAbbinare: string
    subChiuse: string
    /** KPI Riepilogo fornitore — sottotitolo card listino */
    subListinoRows: string
    /** KPI scheda fornitore — importo fatture nel periodo (valore principale = valuta) */
    kpiFatturatoPeriodo: string
    subFatturatoPeriodoZero: string
    subFatturatoPeriodoCount_one: string
    /** Placeholder `{n}` = numero fatture */
    subFatturatoPeriodoCount_other: string
    /** Segnaposto `{amount}` = importo lordo formattato (tutte le fatture incl. duplicati). */
    subFatturatoTotaleLordoMicro: string
    /** KPI listino — titolo: numero = prodotti distinti nel periodo */
    kpiListinoProdottiPeriodo: string
    /** Placeholders `{p}` prodotti distinti, `{u}` righe/aggiornamenti */
    subListinoProdottiEAggiornamenti: string
    subListinoPeriodoVuoto: string
    /** Segnaposto `{n}` = `anomaliePrezziCount` (dashboard KPI listino). */
    subListinoPriceAnomalies: string
    /** Micro-testo card Bolle: risparmi stimati vs Rekki. */
    subBolleRekkiSavingsMicro: string
    subBollePeriodoVuoto: string
    /** Placeholders `{open}` bolle in attesa, `{total}` bolle totali periodo */
    subBollePeriodoRiepilogo: string
    /** KPI Documenti: documenti da email nel periodo filtrato */
    subDocumentiCodaEmailPeriodo: string
    /** KPI Ordini — sottotitolo (conferme salvate nel periodo) */
    subOrdiniPeriodo: string
    /** Nessuno statement nel mese selezionato */
    subStatementsNoneInMonth: string
    /** Statement nel mese senza anomalie */
    subStatementsAllVerified: string
    /** Suffisso dopo il numero di statement con anomalie (es. "3 con anomalie") */
    subStatementsWithIssues: string
    helpText: string
    // listino tab
    listinoSetupTitle: string
    listinoSetupSubtitle: string
    listinoSetupStep1: string
    listinoSetupStep2: string
    listinoSetupShowSQL: string
    listinoCopySQL: string
    listinoCopied: string
    listinoProdotti: string
    listinoProdottiTracked: string
    listinoNoData: string
    listinoNoDataHint: string
    listinoTotale: string
    listinoDaBolle: string
    listinoDaFatture: string
    listinoStorico: string
    listinoDocs: string
    listinoNoDocs: string
    listinoColData: string
    listinoColTipo: string
    listinoColNumero: string
    listinoColImporto: string
    listinoColTotale: string
    /** Badge compatto accanto al prezzo se il fornitore ha collegamento Rekki */
    listinoRekkiListBadge: string
    listinoVerifyAnomalies: string
    listinoVerifyAnomaliesTitle: string
    /** Badge stato riga listino (prezzo vs riferimento) */
    listinoRowBadgeOk: string
    listinoRowBadgeAnomaly: string
    /** Etichetta colonna azioni (cestino / verifica) */
    listinoRowActionsLabel: string
    /** Segnaposto `{delta}` importo formattato, `{pct}` es. +6,2% */
    listinoLastIncrease: string
    listinoLastDecrease: string
    listinoLastFlat: string
    listinoVsReferenceHint: string
    /** `{inv}` numero doc, `{data}` formattata, `{supplier}` ragione sociale */
    listinoOriginInvoice: string
    listinoFilterEmptyKpi: string
    listinoClearKpiFilter: string
    listinoKpiAriaAll: string
    listinoKpiAriaFatture: string
    listinoKpiAriaBolle: string
    /** `{n}` = numero di aggiornamenti precedenti */
    listinoHistoryDepth: string
    listinoPriceStaleBadge: string
    listinoPriceStaleHint: string
    preferredLanguageEmail: string
    languageInheritSede: string
    recognizedEmailsTitle: string
    recognizedEmailsHint: string
    recognizedEmailPlaceholder: string
    recognizedEmailLabelOptional: string
    /** Nome breve in barra mobile / elenchi compatti */
    displayNameLabel: string
    displayNameHint: string
    displayNamePlaceholder: string
    /** Sincronizzazione email mirata: manca sede sul fornitore */
    syncEmailNeedSede: string
    /** Sticky header: avvia controllo OCR su tutte le bolle/fatture sospette del fornitore */
    ocrControllaFornitore: string
    ocrControllaFornitoreTitle: string
    /** Toast dopo controllo: `{corrected}` `{scanned}` `{total}` = numeri API */
    ocrControllaFornitoreResult: string
    /** Desktop: tabella riepilogo documenti per mese (sotto KPI) */
    supplierMonthlyDocTitle: string
    supplierMonthlyDocColMonth: string
    supplierMonthlyDocColBolle: string
    supplierMonthlyDocColFatture: string
    supplierMonthlyDocColSpesa: string
    supplierMonthlyDocColOrdini: string
    supplierMonthlyDocColStatements: string
    supplierMonthlyDocColPending: string
    supplierMonthlyDocColFiscalYear: string
    /** `{year}` = etichetta sede (UK 2025/26, altri anni civili) */
    supplierMonthlyDocFiscalSelected: string
    /** aria su celle che aprono un tab: `{tab}` nome sezione, `{month}` etichetta mese */
    supplierMonthlyDocAriaGoToTabMonth: string
    /** Landmark screen reader: colonna desktop scheda fornitore (header, KPI, contenuto tab). */
    supplierDesktopRegionAria: string
    /** Attesa caricamento scheda fornitore (logo + messaggio) */
    loadingProfile: string
    logoUrlLabel: string
    logoUrlPlaceholder: string
    logoUrlHint: string
    confermeOrdineIntro: string
    confermeOrdineOptionalTitle: string
    confermeOrdineOptionalTitlePh: string
    confermeOrdineOptionalOrderDate: string
    confermeOrdineOptionalNotePh: string
    confermeOrdineAdd: string
    confermeOrdineEmpty: string
    confermeOrdineColFile: string
    confermeOrdineColRecorded: string
    confermeOrdineOpen: string
    confermeOrdineDeleteConfirm: string
    /** Elimina solo una copia duplicata (stesso fornitore/numero/data). */
    confermeOrdineDuplicateCopyDeleteConfirm: string
    confermeOrdineErrPdf: string
    confermeOrdineErrNeedFile: string
    confermeOrdineErrUpload: string
    confermeOrdineErrSave: string
    confermeOrdineErrDelete: string
    confermeOrdineMigrationTitle: string
    confermeOrdineMigrationHint: string
    listinoPeriodLabel: string
    listinoPeriodAll: string
    listinoPeriodCurrentMonth: string
    listinoPeriodPreviousMonth: string
    listinoPeriodLast3Months: string
    listinoPeriodFiscalYear: string
  }
  bolle: {
    title: string
    new: string
    uploadInvoice: string
    viewDocument: string
    noBills: string
    addFirst: string
    deleteConfirm: string
    /** Conferma eliminazione solo copia duplicata (non la bolla «canonica»). */
    duplicateCopyDeleteConfirm: string
    /** Tooltip / aria: bolla in attesa fattura da oltre 7 giorni. */
    pendingInvoiceOverdueHint: string
    ocrScanning: string
    ocrMatched: string
    ocrNotFound: string
    ocrAnalyzing: string
    ocrAutoRecognized: string
    ocrRead: string
    selectManually: string
    saveNote: string
    savingNote: string
    analyzingNote: string
    takePhotoOrFile: string
    ocrHint: string
    cameraBtn: string
    fileBtn: string
    countSingolo: string
    countPlural: string
    /** List page: count for current calendar day (user timezone) */
    countTodaySingolo: string
    countTodayPlural: string
    /** List page: empty when no bolle for today */
    noBillsToday: string
    /** Bolle list: switch from today-only to full list */
    listShowAll: string
    /** Bolle list: switch back to today-only */
    listShowToday: string
    /** Bolle list: filter to pending only (full list mode) */
    listAllPending: string
    fotoLabel: string
    fornitoreLabel: string
    dataLabel: string
    dettaglio: string
    fattureCollegate: string
    aggiungi: string
    nessunaFatturaCollegata: string
    allegatoLink: string
    /** Status badge — delivery note is complete */
    statoCompletato: string
    /** Status badge — delivery note is pending / awaiting invoice */
    statoInAttesa: string
    /** Mobile table: open file link */
    apri: string
    /** Column: delivery note number */
    colNumero: string
    /** Column: attachment file kind (PDF / image) from URL */
    colAttachmentKind: string
    /** Admin: re-run Gemini on attachment to fill number / amount (fix-ocr-dates?bolla_id=) */
    riannalizzaOcr: string
    /** After Re-run OCR: row moved to invoices (Gemini classified as fattura) */
    ocrRerunMovedToInvoices: string
    /** After Re-run OCR: bolla row updated but still classified as DDT */
    ocrRerunUpdatedStaysBolla: string
    /** After Re-run OCR: no field changes; still a delivery note */
    ocrRerunUnchangedStaysBolla: string
    /** Re-run OCR could not read or update the attachment */
    ocrRerunFailed: string
    /** During Re-run: progress header + three steps (client-side; mirrors server work) */
    ocrRerunProgressTitle: string
    ocrRerunStep1: string
    ocrRerunStep2: string
    ocrRerunStep3: string
    /** Manually move bolla row to fatture (no OCR) */
    convertiInFattura: string
    convertiInFatturaTitle: string
    convertiInFatturaConfirm: string
    convertiInFatturaOk: string
    convertiInFatturaErrLinked: string
    convertiInFatturaErrGeneric: string
    attachmentKindPdf: string
    attachmentKindImage: string
    attachmentKindOther: string
    /** Empty state: no bolle registered yet */
    nessunaBollaRegistrata: string
    /** Empty state: CTA link */
    creaLaPrimaBolla: string
    /** Table link: view document */
    vediDocumento: string
    /** Hint accanto alla data se non da OCR (nuova bolla) */
    dateFromDocumentHint: string
    /** Rekki: prezzo letto dall’app (indicativo) */
    prezzoDaApp: string
    /** Rekki: invito a confrontare con il prezzo in fattura */
    verificaPrezzoFornitore: string
    /** Badge dettaglio bolla se collegata a statement Rekki */
    rekkiPrezzoIndicativoBadge: string
    listinoRekkiRefTitle: string
    listinoRekkiRefHint: string
    listinoRekkiRefEmpty: string
    /** Hub Scanner AI — page title */
    scannerTitle: string
    scannerWhatLabel: string
    scannerModeAuto: string
    scannerModeBolla: string
    scannerModeFattura: string
    scannerModeSupplier: string
    scannerFlowBolla: string
    scannerFlowFattura: string
    scannerSaveFattura: string
    scannerSavingFattura: string
    scannerCreateSupplierCta: string
    /** Scanner: documento non classificato — seconda passata OCR per anagrafica */
    scannerCreateSupplierFromUnrecognized: string
    scannerPdfPreview: string
    /** Scanner: pulsante scatto nella modale fotocamera */
    scannerCameraCapture: string
    /** Scanner: permesso fotocamera negato o errore getUserMedia */
    scannerCameraPermissionDenied: string
    /** Scanner: file picker — tipo file non accettato */
    scannerFileScanTypeError: string
    /** Scanner: anteprima dopo acquisizione foto (non PDF) */
    scannerImageAttached: string
  }
  fatture: {
    title: string
    new: string
    noInvoices: string
    addFirst: string
    invoice: string
    openBill: string
    deleteConfirm: string
    countLabel: string
    headerBolla: string
    headerAllegato: string
    apri: string
    caricaFatturaTitle: string
    bollaMarkata: string
    collegataABolla: string
    bollaPasseraCompletato: string
    dataFattura: string
    fileFattura: string
    caricaPdfFoto: string
    maxSize: string
    savingInProgress: string
    salvaChiudiBolla: string
    dettaglio: string
    bollaCollegata: string
    /** Status badge — invoice has a linked delivery note */
    statusAssociata: string
    /** Status badge — invoice has no delivery note */
    statusSenzaBolla: string
    /** Column header: invoice number */
    colNumFattura: string
    /** Empty state label */
    nessunaFatturaRegistrata: string
    /** Elenco fatture tab: nessun risultato nel periodo filtrato (date in alto) */
    nessunaFatturaNelPeriodo: string
    /** N righe: total in archivio >0 ma 0 nel periodo — placeholder `{n}` */
    fattureInArchivioAllargaFiltroData: string
    /** Pulsante: allarga filtro data per mostrare tutte le fatture del fornitore */
    fattureExpandDateRangeCta: string
    /** Salvataggio bloccato: stesso fornitore + data + numero già in archivio (stessa sede) */
    duplicateInvoiceSameSupplierDateNumber: string
    /** Borderline: stesso fornitore + data + importo senza numero documento (stessa sede) */
    duplicateInvoiceSameSupplierDateAmountNoNumber: string
    /** Conferma eliminazione copia duplicata; segnaposto `{numero}` */
    duplicateDeleteConfirm: string
    /** Pulsante compatto su riga copia in eccesso */
    duplicateRemoveCopy: string
    /** Evidenziata quando il gruppo duplicato è selezionato dal badge */
    duplicateRemoveThisCopy: string
    /** aria-label sul badge DUPLICATO (lista fatture) */
    duplicatePairBadgeAria: string
    /** Pulsante riga: rileggere data da OCR sul file */
    refreshDateFromDoc: string
    /** title sul pulsante ricontrollo data */
    refreshDateFromDocTitle: string
    /** Toast dopo aggiornamento; placeholder `{data}` = data formattata */
    refreshDateFromDocSuccess: string
    /** Toast se OCR coincide col DB */
    refreshDateFromDocUnchanged: string
  }
  archivio: {
    title: string
    subtitle: string
    noBills: string
    noInvoices: string
    withBill: string
    noEmail: string
    bollaS: string
    bollaP: string
    fatturaS: string
    fatturaP: string
    editLink: string
    nuova: string
    nuovaFattura: string
    documento: string
    /** Parentesi dopo il conteggio fatture: «(2 in attesa)» — placeholder `{n}` */
    pendingDocCount: string
    /** Link verso /statements per documenti email in coda */
    linkAssociateStatements: string
    /** DocumentiQueue section header */
    queueTitle?: string
    queueSubtitle?: string
    unknownSender?: string
    statusDaAssociare?: string
    noQueue?: string
    noQueueHint?: string
    receivedOn?: string
    docDate?: string
  }
  impostazioni: {
    title: string
    subtitle: string
    lingua: string
    valuta: string
    fuso: string
    preview: string
    saved: string
    sectionLocalisation: string
    /** Mobile profilo: intestazione blocco account */
    accountSection: string
    /** Link verso gestione sedi (admin con più filiali) */
    changeSede: string
    /** Admin senza sede attiva: hint sotto Profilo mobile prima di creare operatori */
    addOperatorsPickSede: string
    /** Sezione IMAP nella pagina impostazioni */
    imapSection: string
  }
  strumentiCentroOperazioni: {
    pageTitle: string
    pageSubtitle: string
    breadcrumbTools: string
    sectionOcr: string
    sectionDup: string
    sectionListino: string
    cardReanalyzeTitle: string
    cardReanalyzeDesc: string
    cardOpenInbox: string
    cardRefreshDateTitle: string
    cardRefreshDateDesc: string
    cardOpenFatture: string
    cardOcrCheckTitle: string
    cardOcrCheckDesc: string
    cardOpenFornitoreSheet: string
    cardDupScanTitle: string
    cardDupScanDesc: string
    cardDupManageTitle: string
    cardDupManageDesc: string
    cardDupManageCta: string
    cardAuditTitle: string
    cardAuditDesc: string
    cardOpenAudit: string
    cardListinoAutoTitle: string
    cardListinoAutoDesc: string
    cardListinoFromInvTitle: string
    cardListinoFromInvDesc: string
    cardListinoAddTitle: string
    cardListinoAddDesc: string
    cardListinoCta: string
    /** Centro operazioni: titolo card sync email manuale (24 h) */
    manualImapSyncTitle: string
    manualImapSyncDesc: string
    /** Centro operazioni: sync IMAP storica (lookback sede, es. 365 gg) */
    historicSyncSectionLabel: string
    historicSyncTitle: string
    historicSyncDesc: string
    historicSyncWarning: string
    historicSyncCta: string
    /** Segnaposto `{n}` = documenti ricevuti dall’API scan-emails */
    historicSyncResult: string
    /** Segnaposto `{label}` = mese/anno UTC del batch storico corrente */
    historicSyncProgress: string
    historicSyncCompleted: string
    hintContextualShortcuts: string
  }
  log: {
    title: string
    subtitle: string
    sender: string
    subject: string
    stato: string
    detail: string
    retry: string
    retrying: string
    success: string
    bollaNotFound: string
    supplierNotFound: string
    noLogs: string
    emptyHint: string
    totalLogs: string
    linkedInvoices: string
    withErrors: string
    vediFile: string
    supplierSuggested: string
    aiSuggest: string
    aiSuggestTitle: string
    aiSuggestLoading: string
    aiSuggestError: string
    openCreateSupplier: string
    associateRememberHint: string
    colAttachment: string
    colSede: string
    colLogId: string
    /** Timestamp creazione riga log (elab. registrata in app) */
    colRegistered: string
    /** Tab pagina log */
    tabEmailLog: string
    tabBlacklist: string
    blacklistSubtitle: string
    blacklistColMittente: string
    blacklistColMotivo: string
    blacklistColDate: string
    blacklistPlaceholder: string
    blacklistAdd: string
    blacklistRemove: string
    blacklistFilterAll: string
    blacklistEmpty: string
    blacklistError: string
    logIgnoreAlways: string
    logBlacklistAdded: string
    blacklistMotivoNewsletter: string
    blacklistMotivoSpam: string
    blacklistMotivoNonFornitore: string
    blacklistMotivoSistema: string
    blacklistMotivoSocial: string
    /** Riga riepilogo: usare `{n}` per il conteggio */
    activitySummaryToday: string
    activityEmpty: string
    activityColTipo: string
    activityColSupplier: string
    activityColAmount: string
    activityColStatus: string
    activityOpenDocument: string
    activityTipoInvoice: string
    activityTipoDdt: string
    activityTipoStatement: string
    activityTipoQueue: string
    activityTipoOrdine: string
    activityTipoResume: string
    activityStatusSaved: string
    activityStatusNeedsSupplier: string
    activityStatusIgnored: string
    /** Coda elaborazione documenti dall’elenco log (OCR/abbinamento) */
    activityProcessDocumentsCta: string
    activityProcessDocumentsBusy: string
    activityProcessDocumentsNoEligibleInLog: string
    /** Segnaposti `{runs}`, `{processed}`, `{skipped}` */
    activityProcessDocumentsSummary: string
    activityProcessDocumentsApiError: string
    activityProcColumn: string
    activityProcSpinAria: string
    activityProcProcessedAuto: string
    activityProcProcessedRevision: string
    activityProcProcessedOther: string
    activityProcOutcomeError: string
    activityProcSkippedScartato: string
    activityProcSkippedNoRowOrSede: string
    activityProcSkippedNoMittente: string
    activityProcSkippedNoSupplier: string
    activityProcSkippedHasOcr: string
    activityProcPendingBatch: string
    activityProcRejectedCv: string
    activityProcDash: string
  }
  sedi: {
    /** Contesto singola sede (es. copy IMAP / admin_sede); non usare per la lista `/sedi` (solo master email/password). */
    title: string
    subtitle: string
    /** Lista `/sedi` e dashboard globale: solo `role === 'admin'` (accesso email/password), mai `admin_sede` (nome+PIN). */
    titleGlobalAdmin: string
    subtitleGlobalAdmin: string
    newSede: string
    noSedi: string
    users: string
    imap: string
    imapSubtitle: string
    imapHost: string
    imapHostPlaceholder: string
    imapPort: string
    imapUser: string
    imapPassword: string
    imapPasswordPlaceholder: string
    testConnection: string
    saveConfig: string
    notConfigured: string
    accessDenied: string
    accessDeniedHint: string
    creatingBtn: string
    createBtn: string
    nomePlaceholder: string
    nessunUtente: string
    emailHeader: string
    sedeHeader: string
    ruoloHeader: string
    nessunaSedeOption: string
    operatoreRole: string
    adminRole: string
    adminSedeRole: string
    /** Etichetta per `profiles.role === 'admin'` in elenco operatori (≠ badge Amministratore in sidebar) */
    profileRoleAdmin: string
    /** Admin con sede sul profilo: vista limitata su /sedi */
    adminScopedSediHint: string
    renameTitle: string
    deleteTitle: string
    addOperatorSedeTitle: string
    addOperatorSedeDesc: string
    operatorDisplayNameLabel: string
    operatorPinMinLabel: string
    operatorNameRequired: string
    operatorPinTooShort: string
    wizardOperatorHint: string
    /** "{operatori}" = n operators, "{fornitori}" = n suppliers */
    sedeStats: string
    /** "{n}" = count */
    operatoriHeader: string
    sedeAccessCodeLabel: string
    sedePinHint: string
    sedePinError4Digits: string
    changePinTitle: string
    /** "{name}" = operator's display name */
    newPinFor: string
    operatoreRoleShort: string
    adminSedeRoleShort: string
    valutaFuso: string
  }
  approvalSettings: {
    autoRegisterTitle: string
    autoRegisterDescription: string
  }
  statements: {
    // page heading
    heading: string
    // tabs
    tabVerifica: string
    tabDocumenti: string
    /** Sottotitolo scheda nav — documenti in coda email */
    schedaNavDaProcessareDesc: string
    /** Sottotitolo scheda nav — triple-check estratti */
    schedaNavVerificaDesc: string
    // check status badge labels
    statusOk: string
    statusFatturaMancante: string
    statusBolleManc: string
    statusErrImporto: string
    /** Triple-check: fattura/bolle OK ma importo Rekki (app) ≠ fattura */
    statusRekkiPrezzo: string
    // statement inbox
    stmtReceived: string
    stmtProcessing: string
    stmtEmpty: string
    stmtEmptyHint: string
    // buttons
    btnSendReminder: string
    btnSending: string
    btnSent: string
    btnClose: string
    btnRefresh: string
    btnAssign: string
    btnDiscard: string
    btnAssigning: string
    // columns
    colDate: string
    colRef: string
    colAmount: string
    colStatus: string
    colAction: string
    colInvoice: string
    colNotes: string
    // classic reconcile view
    classicHeading: string
    classicComplete: string
    classicMissing: string
    classicRequestAll: string
    classicRequesting: string
    classicSent: string
    classicRequestSingle: string
    // migration card
    migrationTitle: string
    migrationSubtitle: string
    migrationStep1: string
    migrationStep2: string
    migrationShowSQL: string
    migrationCopySQL: string
    migrationCopied: string
    // summary KPIs
    kpiOk: string
    kpiMissing: string
    kpiAmount: string
    kpiTotal: string
    // months
    months: string[]
    // misc
    unknownSupplier: string
    loadError: string
    sendError: string
    // PendingMatchesTab — filter bar
    tabPending: string
    tabAll: string
    /** Barra sopra la lista: documenti in coda senza fornitore — titolo con `{n}` */
    unknownSenderQuickStripTitle: string
    /** `aria-label` della regione accesso rapido */
    unknownSenderQuickStripAria: string
    /** `title` su ogni chip (scroll alla riga) */
    unknownSenderQuickStripChipTitle: string
    /** Contatore salvataggi OCR email (oggi) */
    emailSyncAutoSavedToday: string
    bolleAperteOne: string
    bolleApertePlural: string
    // PendingMatchesTab — status badges
    tagStatement: string
    tagStatementOk: string
    tagPending: string
    tagBozzaCreata: string
    tagAssociated: string
    tagDiscarded: string
    // PendingMatchesTab — doc meta
    labelReceived: string
    labelDocDate: string
    openFile: string
    /** PendingMatchesTab — riesegue OCR e abbinamento fornitore */
    reanalyzeDocButton: string
    reanalyzeDocTitle: string
    reanalyzeDocSuccess: string
    gotoFatturaDraft: string
    gotoBollaDraft: string
    toggleAddStatement: string
    toggleRemoveStatement: string
    /** Chip corto: tipo documento in coda */
    docKindEstratto: string
    docKindBolla: string
    docKindFattura: string
    docKindOrdine: string
    docKindHintBolla: string
    docKindHintFattura: string
    docKindHintOrdine: string
    docKindGroupAria: string
    finalizeNeedsSupplier: string
    btnFinalizeFattura: string
    btnFinalizeBolla: string
    btnFinalizeOrdine: string
    btnFinalizeStatement: string
    btnFinalizing: string
    finalizeSuccess: string
    /** Toast dopo registrazione automatica fattura AI; `{numero}` `{fornitore}` */
    autoRegisterFatturaToast: string
    // PendingMatchesTab — empty states
    noPendingDocs: string
    noDocsFound: string
    noBolleAttesa: string
    /** Coda abbina bolle-fattura: titolo lista stesso fornitore */
    bolleDaCollegamentiSectionTitle: string
    /** Nessuna bolla aperta sul fornitore collegato al documento */
    bollePendingNoneForThisSupplier: string
    /** Pulsante: mostra anche bolle degli altri fornitori (stessa sede) */
    bollesSearchAcrossAllSuppliers: string
    /** Pulsante: torna alla lista solo fornitore del documento */
    bollesShowOnlyThisSupplier: string
    /** Sotto-lista quando si espande la ricerca: bolle di altri fornitori */
    bollesExtendedOtherSuppliersSubtitle: string
    /** Nessun fornitore sul doc: suggerisce di scegliere fornitore o espandere */
    bollesMatchAssociateSupplierHint: string
    /** Lista bolle da tutti i fornitore quando non c'è fornitore sul doc e lista espansa */
    bollesFullSiteListSubtitle: string
    unknownSender: string
    /** Pending queue: same normalized address as other docs, different OCR company names; `{names}` = joined labels */
    sameAddressClusterHint: string
    /** AiDataCard: apre /fornitori/new con dati OCR in query */
    btnCreateSupplierFromAi: string
    // PendingMatchesTab — matching
    docTotalLabel: string
    exactAmount: string
    exceeds: string
    missingAmt: string
    doneStatus: string
    errorStatus: string
    noBolleDelivery: string
    // PendingMatchesTab — bozza banner
    bozzaCreataOne: string
    bozzeCreatePlural: string
    bozzaBannerSuffix: string
    // VerificationStatusTab — KPI bar
    kpiVerifiedOk: string
    // VerificationStatusTab — reconcile tab
    noEmailForSupplier: string
    reconcileCorrette: string
    reconcileDiscrepanza: string
    reconcileMancanti: string
    reconcileHeading: string
    statusMatch: string
    statusMismatch: string
    statusMissingDB: string
    reconcileStatement: string
    reconcileDB: string
    loadingResults: string
    editSupplierTitle: string
    supplierLinkFailed: string
    assignFailed: string
    /** Toast dopo auto-link fornitore da OCR (placeholder `{name}`) */
    autoLinkedSupplierOne: string
    /** Toast se più documenti collegati in un solo passaggio (placeholder `{count}`) */
    autoLinkedSupplierMany: string
    /** Toast dopo Refresh: abbinamento massivo (`{linked}` fornitori, `{associated}` fatture da bolle) */
    bulkAutoMatchSummary: string
    /** Toast se nessun abbinamento automatico applicabile */
    bulkAutoMatchNone: string
    /** Testo visibile pulsante abbinamento massivo (coda documenti) */
    bulkAutoMatchButtonLabel: string
    /** Title / descrizione lunga (tooltip) */
    bulkAutoMatchButtonTitle: string
    /** Toolbar: gruppo pulsanti conferma tutti per tipo `{kind}`, `{n}` documenti idonei */
    bulkFinalizeToolbarGroupAria: string
    bulkFinalizeKindTooltip: string
    bulkFinalizeBulkOk: string
    bulkFinalizeBulkPartial: string
    ocrFormatToggleTitle: string
    allBolleInvoicedOk: string
    aiStatementTotalLabel: string
    statementLinkedBolleLine: string
    selectedSumLabel: string
    selectedBolle_one: string
    selectedBolle_other: string
    receivedOn: string
    /** Intestazione estratti: date lette dal PDF (≠ data ricezione email) */
    stmtPdfDatesPrefix: string
    stmtPdfIssuedLabel: string
    stmtPdfLastPaymentLabel: string
    /** Titolo blocco tabellare metadati estratti dal PDF (account, plafond, …) */
    stmtPdfSummaryTitle: string
    stmtPdfMetaAccountNo: string
    stmtPdfMetaIssuedDate: string
    stmtPdfMetaCreditLimit: string
    stmtPdfMetaAvailableCredit: string
    stmtPdfMetaPaymentTerms: string
    stmtPdfMetaLastPaymentAmt: string
    stmtPdfMetaLastPaymentDate: string
    openPdf: string
    reanalyze: string
    stmtListProcessing: string
    stmtListParseError: string
    stmtRowsCount: string
    stmtAnomalies_one: string
    stmtAnomalies_other: string
    stmtBackToList: string
    needsMigrationTitle: string
    needsMigrationBody: string
    stmtInboxEmailScanning: string
    stmtInboxEmptyDetail: string
    bolleSummaryByPeriod: string
    /** VerificationStatusTab: nessuna bolla nel mese/anno selezionato (non estratti conto) */
    bollePeriodEmpty: string
    /** Triple-check tabella desktop */
    clearFilter: string
    rekkiCheckSegmentTooltip: string
    tripleColStmtDate: string
    tripleColSysDate: string
    tripleColStmtAmount: string
    tripleColSysAmount: string
    tripleColChecks: string
    /** Riga triple-check in attesa di verifica (DB / legacy) */
    statusCheckPending: string
    /** Banner compatto (scheda fornitore / documenti) */
    statementVerifyBanner: string
    /** Badge: AI ha estratto dati e fornitore noto / abbinabile */
    badgeAiRecognized: string
    /** Tooltip lungo sul badge sopra — non è l’abbrina bolle già risolta */
    badgeAiRecognizedTitle: string
    /** Badge: serve associazione fornitore umana */
    badgeNeedsHuman: string
    rememberAssociationTitle: string
    rememberAssociationSave: string
    rekkiDocumentLink: string
  }
  /** Cross-page UI strings (audit: avoid hardcoded copy) */
  appStrings: {
    brandFooter: string
    pageNotFoundTitle: string
    pageNotFoundDesc: string
    /** 404 dentro l’area app (es. bolla/fattura assente o RLS) */
    notFoundInAppTitle: string
    notFoundInAppDesc: string
    docUnavailableBollaTitle: string
    docUnavailableBollaDesc: string
    docUnavailableFatturaTitle: string
    docUnavailableFatturaDesc: string
    backToHome: string
    sedeLockTitle: string
    /** Una riga con segnaposto `{name}` per il nome sede (es. «La sede {name} richiede…») */
    sedeLockDescription: string
    sedeLockCodeLabel: string
    sedeLockPlaceholder: string
    /** Errore validazione lunghezza PIN (client + allineato a API) */
    sedeLockPinLengthError: string
    sectionDates: string
    sectionCurrencyLabel: string
    loadingBolle: string
    noOpenBolle: string
    invoiceNumOptional: string
    uploadDateLabel: string
    /** Etichetta “automatica” accanto alla data di registrazione (nuova bolla) */
    uploadDateAutomatic: string
    registeredByFattura: string
    registeredByBolla: string
    saveCloseNBolle: string
    colDeliveryNoteNum: string
    colAmountShort: string
    labelImportoTotale: string
    labelPrezzoUnitario: string
    loadingPage: string
    noAttachment: string
    camera: string
    chooseFile: string
    uploading: string
    deleteLogConfirm: string
    imapConfigTitle: string
    imapLookbackLabel: string
    imapLookbackLastDays: string
    imapLookbackUnlimited: string
    imapLookbackFootnote: string
    emailSaved: string
    addOperatorsTitle: string
    addOperatorBtn: string
    savingShort: string
    newSedeShort: string
    deleteUserConfirm: string
    deleteSedeConfirm: string
    deleteFornitoreConfirm: string
    contactsHeading: string
    contactNew: string
    contactEdit: string
    contactRemove: string
    contactRemovePrice: string
    noContacts: string
    infoSupplierCard: string
    contactsLegal: string
    contactsFiscal: string
    contactsPeople: string
    noContactRegistered: string
    noEmailSyncHint: string
    noEmailSyncWarning: string
    filterNoEmail: string
    suggestEmailBtn: string
    suggestEmailSearching: string
    suggestEmailNoResults: string
    suggestEmailSave: string
    suggestEmailSaved: string
    suggestEmailSourceLog: string
    suggestEmailSourceQueue: string
    suggestEmailSourceUnmatched: string
    suggestEmailTitle: string
    noAddressRegistered: string
    noFiscalRegistered: string
    clientSince: string
    fromInvoiceBtn: string
    listinoAnalyze: string
    listinoAnalyzing: string
    /** Badge sotto il select listino quando la fattura è già stata analizzata */
    listinoInvoiceAnalyzedBadge: string
    listinoNoInvoicesFile: string
    listinoNoProducts: string
    saveNProducts: string
    clickAddFirst: string
    monthNavResetTitle: string
    monthNavPrevMonthTitle: string
    monthNavNextMonthTitle: string
    monthNavPrevYearTitle: string
    monthNavNextYearTitle: string
    /** Desktop scheda fornitore — popover selettore periodo (date Da / A per KPI e tab). */
    supplierDesktopPeriodPickerTitle: string
    supplierDesktopPeriodPickerButtonAria: string
    supplierDesktopPeriodFromLabel: string
    supplierDesktopPeriodToLabel: string
    supplierDesktopPeriodApply: string
    addingAlias: string
    addEmailAlias: string
    listinoImportPanelTitle: string
    listinoImportSelectInvoiceLabel: string
    listinoImportProductsSelected: string
    listinoImportPriceListDateLabel: string
    listinoImportColListinoDate: string
    listinoImportDateOlderThanListinoHint: string
    listinoImportApplyOutdatedAdmin: string
    listinoImportApplyOutdatedAdminActive: string
    /** Import da fattura: applica forzatura data a tutte le righe già selezionate che sono bloccate. */
    listinoImportForceAllSelected: string
    /** `{inserted}` righe ok, `{skipped}` conteggio, `{products}` elenco nomi */
    listinoImportPartialSaved: string
    listinoManualDateBlockedHint: string
    listinoManualDateBlockedNoAdmin: string
    listinoImportSaveBlockedHintAdmin: string
    listinoImportSaveBlockedHintOperator: string
    listinoDocDetailImportHint: string
    listinoDocDetailImportHintAdmin: string
    listinoDocRowBlockedBadge: string
    listinoDocForceButton: string
    listinoDocForceWorking: string
    listinoDocForceOk: string
    listinoDocForceErr: string
    discoveryCreateSupplier: string
    discoveryCompanyName: string
    discoveryEmailDiscovered: string
    discoveryVat: string
    discoveryBranch: string
    discoveryBreadcrumbSettings: string
    discoveryTitle: string
    discoveryNoImap: string
    discoveryNoImapHint: string
    discoveryPartialScan: string
    discoveryAllRegistered: string
    discoveryNoUnknown: string
    discoveryReady: string
    discoveryReadyHint: string
    discoveryScanBtn: string
    toastDismiss: string
    countrySaving: string
    countrySaved: string
    sidebarSediTitle: string
    deleteGenericConfirm: string
    deleteFailed: string
    errorGenericTitle: string
    errorGenericBody: string
    tryAgain: string
    errorCodeLabel: string
    /** In-app route error boundary (segment failed to load) */
    errorSegmentTitle: string
    errorSegmentBody: string
    errorDevDetailsSummary: string
    /** Root layout failure (global-error.tsx) */
    errorFatalTitle: string
    errorFatalBody: string
    /** Approvals page subtitle */
    approvazioni_pageSub: string
    /** Analytics page subtitle */
    analyticsPageSub: string
    /** Analytics period selector — replace {n} with the number */
    analyticsMonths: string
    /** Activity log page title */
    attivitaPageTitle: string
    /** Activity log page subtitle */
    attivitaPageSub: string
    /** Activity log export button */
    attivitaExportCsv: string
    /** Activity log operator filter — empty option */
    attivitaAllOperators: string
    /** Activity log — clear filters button */
    attivitaRemoveFilters: string
    // Analytics
    analyticsErrorLoading: string
    analyticsNoData: string
    analyticsKpiTotalInvoiced: string
    analyticsKpiNFatture: string
    analyticsKpiReconciliation: string
    analyticsKpiCompleted: string
    analyticsKpiAvgTime: string
    analyticsKpiDays: string
    analyticsKpiDaysFrom: string
    analyticsKpiSlow: string
    analyticsKpiOk: string
    analyticsKpiPriceAnomalies: string
    analyticsKpiResolvedOf: string
    analyticsKpiToCheck: string
    analyticsKpiAllOk: string
    analyticsChartMonthlySpend: string
    analyticsChartAmount: string
    analyticsChartInvoices: string
    analyticsChartTopSuppliers: string
    analyticsChartNoData: string
    analyticsChartBolleVsFatture: string
    analyticsChartDeliveryNotes: string
    analyticsSummaryPendingDocs: string
    analyticsSummaryPendingNotes: string
    analyticsSummaryArchivedInvoices: string
    // Approvals
    approvazioni_noPending: string
    approvazioni_allReviewed: string
    approvazioni_viewInvoice: string
    approvazioni_rejectReason: string
    approvazioni_rejectPlaceholder: string
    approvazioni_confirmReject: string
    approvazioni_approve: string
    approvazioni_reject: string
    approvazioni_threshold: string
    // Activity
    attivitaFilterAll: string
    attivitaFilterBolle: string
    attivitaFilterFatture: string
    attivitaFilterDocumenti: string
    attivitaFilterOperatori: string
    attivitaError: string
    attivitaNoRecent: string
    attivitaRecentTitle: string
    // StatoSincronizzazioneIntelligente
    rekkiSyncTitle: string
    rekkiSyncDesc: string
    rekkiSyncMobileTap: string
    rekkiSyncNeverRun: string
    rekkiSyncTapUpdate: string
    rekkiSyncTapStart: string
    rekkiSyncButtonLabel: string
    rekkiSyncInProgress: string
    rekkiSyncProcessing: string
    rekkiSyncStop: string
    rekkiSyncCheckNow: string
    rekkiSyncStarting: string
    rekkiSyncDays: string
    rekkiSyncLastScan: string
    rekkiSyncEmails: string
    rekkiSyncDocuments: string
    rekkiSyncMatched: string
    rekkiSyncUnmatched: string
    rekkiSyncRecentEmails: string
    rekkiSyncNoData: string
    rekkiSyncNoDataDesc: string
    rekkiImapNotConfigured: string
    rekkiImapNotConfiguredDesc: string
    rekkiPhaseQueued: string
    rekkiPhaseConnect: string
    rekkiPhaseSearch: string
    rekkiPhaseProcess: string
    rekkiPhasePersist: string
    rekkiPhaseDone: string
    rekkiPhaseError: string
    rekkiDoneResult: string
    rekkiErrUnknown: string
    rekkiErrNetwork: string
    /** Analytics — short label next to FY period button ("da inizio FY") */
    analyticsSinceFY: string
    /** Backup page — title and description */
    backupPageTitle: string
    backupPageDesc: string
    // RecuperoCreditiAudit component
    auditTitle: string
    auditDesc: string
    auditDateFrom: string
    auditDateTo: string
    auditRunBtn: string
    auditRunning: string
    auditSyncConfirm: string
    auditSyncTitle: string
    auditSyncDesc: string
    auditSyncBtn: string
    auditSyncing: string
    auditKpiSpreco: string
    auditKpiAnomalies: string
    auditKpiProducts: string
    auditKpiFatture: string
    auditNoOvercharges: string
    auditNoOverchargesDesc: string
    auditColFattura: string
    auditColProdotto: string
    auditColPagato: string
    auditColPattuito: string
    auditColSpreco: string
    auditHelpTitle: string
    auditHelpP1: string
    auditHelpLi1: string
    auditHelpLi2: string
    auditHelpLi3: string
    auditHelpLi4: string
    auditHelpCta: string
    auditErrStatus: string
    auditErrGeneric: string
    auditErrSync: string
    auditCsvDate: string
    auditCsvInvoiceNum: string
    auditCsvProduct: string
    auditCsvRekkiId: string
    auditCsvPaid: string
    auditCsvAgreed: string
    auditCsvDiffPct: string
    auditCsvQty: string
    auditCsvWaste: string
    // sedi/page.tsx — toast messages and wizard labels
    sedeErrCreating: string
    sedeErrSavingProfile: string
    sedePinUpdated: string
    sedeErrUpdatingPin: string
    sedeErrSavingPin: string
    sedeLocSaved: string
    sedeErrLoadData: string
    sedeErrUpdating: string
    sedeUpdated: string
    sedeDeleted: string
    sedeErrSavingImap: string
    sedeWizardStepOf: string
    sedeWizardNext: string
    sedeWizardBack: string
    sedeWizardSkip: string
    sedeWizardNameLabel: string
    sedeWizardEmailConfigTitle: string
    sedeWizardEmailConfigDesc: string
    sedeWizardAppPassRequired: string
    sedeWizardAddOperatorsTitle: string
    sedeWizardAddOperatorsDesc: string
    sedeWizardCreateBtn: string
    sedeWizardCreatingBtn: string
    sedeWizardStartSetup: string
    sedeEmailNotConfigured: string
    /** "{nome}" = name of the new sede */
    sedeCreatedSuccess: string
    // Gmail Audit Ready Badge
    gmailBadgeTitle: string
    gmailBadgeDescConfigured: string
    gmailBadgeDescNotConfigured: string
    gmailBadgeCTAConnect: string
    gmailBadgeCTASetup: string
    gmailBadgeDismiss: string
    gmailBadgeAPIConfigured: string
    gmailBadgeConnectAccount: string
    gmailBadgePriceCheck: string
    gmailBadgePriceCheckSub: string
    gmailBadgeRecoverySub: string
    // Auto-Sync Invoice
    autoSyncTitle: string
    autoSyncDesc: string
    autoSyncBtn: string
    autoSyncBtnLoading: string
    autoSyncTotal: string
    autoSyncAnomalies: string
    autoSyncNewItems: string
    autoSyncProduct: string
    autoSyncPrice: string
    autoSyncNewItem: string
    /** "{n}" = count, "{s}" = plural suffix */
    autoSyncAnomalyWarning: string
    /** "{n}" = count */
    autoSyncConfirmBtn: string
    autoSyncImporting: string
    autoSyncErrAnalysis: string
    autoSyncErrImport: string
  }
}

const it: Translations = {
  ui: {
    tagline:          'Gestione Acquisti',
    closeMenu:        'Chiudi menu',
    expandSidebar:    'Espandi sidebar',
    navMore:            'Altro',
    collapseSidebar:  'Comprimi sidebar',
    changeOperator:   'Cambia operatore',
    changeOperatorShort: 'Cambia',
    selectOperator:   'Seleziona operatore',
    activeOperator:   'Attivo',
    noOperator:       'Nessuno',
    operatorLabel:    'Chi sta operando',
    operatorChanged:  'Operatore cambiato con successo',
    noOperatorsFound: 'Nessun operatore trovato per questa sede.',
    noSedeForOperators: 'Non risulta una sede associata. Aggiungi una sede in Gestione sedi o collega il profilo admin a una sede.',
    currentlyActive:  'Attivo:',
    languageTooltip:  'Lingua',
    syncError:        'Errore durante la scansione.',
    syncSuccess:      'Sincronizzazione completata.',
    networkError:     'Errore di rete. Riprova.',
    connectionOnline: 'Online',
    connectionOffline: 'Offline',
    connectionReconnecting: 'Riconnessione…',
    emailSyncResumed: 'Connessione ripristinata: sincronizzazione email ripresa.',
    emailSyncStreamIncomplete:
      'La sincronizzazione non è stata completata (risposta interrotta). Riprova.',
    emailSyncAlreadyRunning:
      'Sincronizzazione già in corso. Aspetta il completamento o interrompi dalla barra in alto.',
    emailSyncCancelled: 'Sincronizzazione email interrotta.',
    reminderError:    'Errore durante l\'invio.',
    noReminders:      'Nessun sollecito da inviare (fornitori senza email?).',
    remindersCount:   'sollecit',
    remindersSentOne: '1 sollecito inviato su {total}.',
    remindersSentMany: '{n} solleciti inviati su {total}.',
    pinError:         'Codice non corretto.',
    operatorPinStepUpTitle: 'Conferma operatore',
    operatorPinStepUpHint: 'Inserisci il codice a 4 cifre dell’operatore attivo per autorizzare questa modifica.',
    operatorPinStepUpNoActive:
      'Nessun operatore attivo in questa sessione. Usa il pulsante qui sotto (o la barra in basso su mobile / voce nel menu laterale), scegli chi sta operando e poi inserisci il PIN.',
    operatorPinStepUpChooseOperator: 'Scegli operatore',
    verifyAndContinue: 'Continua',
    operatorAutoLockLabel: 'Blocco automatico dopo',
    operatorAutoLockNever: 'Mai',
    operatorAutoLockMinutes: '{n} min',
    sidebarSedeActive: 'Sede attiva: {name}',
    sidebarSedeSwitchTo: 'Passa a: {name}',
    sidebarSedeSettings: 'Impostazioni {name}',
    appBuildLine: 'v{version} · {commit} · {env}',
    appBuildLineLocal: 'v{version} · {commit}',
    appBuildNoCommit: '—',
    appBuildAria: 'Versione app e build di deploy',
    deployEnvLocal: 'locale',
    deployEnvProduction: 'produzione',
    deployEnvPreview: 'anteprima',
    deployEnvDevelopment: 'sviluppo',
  },
  login: {
    brandTagline: 'Gestione fatture',
    subtitle: 'Accesso sede: il tuo nome e codice a 4 cifre',
    adminSubtitle: 'Portale Gestionale',
    adminSubtitleHint:
      'Email e password per il Portale Gestionale. Per nome operatore e codice usa «Accesso Sede» (responsabile sede e operatori).',
    nameLabel: 'Nome Operatore',
    namePlaceholder: '',
    pinLabel: 'Codice Accesso Sede',
    pinDigits: '(4 cifre)',
    lookingUp: 'Verifica nome…',
    enterFirstName: 'Inserisci solo il nome e premi Tab',
    emailLabel: 'Email',
    emailPlaceholder: 'admin@azienda.it',
    passwordLabel: 'Password',
    passwordPlaceholder: 'Minimo 6 caratteri',
    loginBtn: 'Accedi',
    adminLink: 'Portale Gestionale →',
    operatorLink: '← Accesso Sede',
    pinIncorrect: 'Codice non corretto. Riprova.',
    invalidCredentials: 'Credenziali non valide.',
    verifying: 'Verifica credenziali…',
    accessing: 'Accesso in corso…',
    notFound: 'Utente non trovato.',
    adminOnlyEmail:
      'Questo accesso è riservato agli amministratori. Usa Accesso Sede oppure chiedi il ruolo admin.',
    adminGateLabel: 'Codice accesso schermata admin',
    adminGateHint: 'Inserisci il PIN per sbloccare email e password.',
    adminGateWrong: 'Codice non valido.',
    sessionGateTitle: 'Conferma accesso',
    sessionGateSubtitle:
      'Nuova sessione: inserisci di nuovo il tuo nome e il PIN a 4 cifre per continuare.',
    sessionGateWrongUser: 'Questo nome non corrisponde all’account con cui hai effettuato l’accesso.',
    sessionBootStuck: 'Il profilo non si è caricato in tempo. Accedi di nuovo.',
    netflixTitle: 'Chi è di turno?',
    netflixSubtitle: 'Tocca il tuo nome per accedere',
    netflixManualLogin: 'Non trovi il tuo nome? Accedi manualmente →',
    netflixChangeOperator: '← Cambia operatore',
    deviceTrustTitle: 'Accedere automaticamente su questo dispositivo la prossima volta?',
    deviceTrustYes: 'Sì, ricordami',
    deviceTrustNo: 'No grazie',
    deviceWelcomeBack: 'Bentornato, {name}!',
    deviceWelcomeAccediHint: 'Dispositivo riconosciuto. Continua quando sei pronto.',
    accessoSwitchOperator: 'Cambia operatore',
  },
  nav: {
    dashboard: 'Riepilogo',
    dashboardAdmin: 'Profilo admin',
    operatori: 'Operatori',
    fornitori: 'Fornitori',
    bolle: 'Bolle',
    fatture: 'Fatture',
    ordini: 'Ordini',
    archivio: 'Archivio',
    logEmail: 'Email Log',
    sedi: 'Sede e Utenti',
    sediTitle: 'Sede',
    sediNavGroupMaster: 'Sedi',
    gestisciSedeNamed: 'Gestisci {name}',
    gestisciSedi: 'Gestisci sedi',
    tuttiFornitori: 'Tutti i fornitori',
    cerca: 'Cerca…',
    nessunRisultato: 'Nessun risultato',
    altriRisultati: 'altri — cerca sopra',
    impostazioni: 'Impostazioni',
    nuovaBolla: 'Nuova Bolla',
    ricevuto: 'Ricevuto',
    operatorActiveHint: 'Indica chi sta operando',
    esci: 'Esci',
    guida: 'Guida',
    sedeGlobalOverview: 'Panoramica globale',
    bottomNavBackToSede: 'Torna alla sede',
    bottomNavScannerAi: 'Scanner AI',
    bottomNavProfile: 'Profilo',
    bottomNavSediMap: 'Mappa sedi',
    bottomNavGlobalReports: 'Report globali',
    bottomNavNewOrder: 'Nuovo ordine',
    bottomNavPriceHistory: 'Storico prezzi',
    bottomNavContact: 'Contatta',
    addNewDelivery: 'Nuova bolla',
    openRekki: 'Rekki',
    ariaMain: 'Navigazione principale',
    ariaAdmin: 'Navigazione amministratore',
    ariaFornitore: 'Navigazione fornitore',
    ariaCallSupplier: 'Chiama il fornitore',
    notifications: 'Notifiche',
    noNotifications: 'Nessuna notifica',
    errorAlert: 'Errori sincronizzazione (24h)',
    analytics: 'Analitiche',
    approvazioni: 'Approvazioni',
    attivita: 'Attività',
    backup: 'Backup',
    consumiAi: 'Consumi AI',
    strumenti: 'Strumenti',
  },
  strumentiCentroOperazioni: {
    pageTitle: 'Centro operazioni',
    pageSubtitle:
      'Accesso rapido a OCR, duplicati, abbinamenti fornitore e listino. I pulsanti sulle singole schede documento restano disponibili.',
    breadcrumbTools: 'Strumenti',
    sectionOcr: 'OCR & documenti',
    sectionDup: 'Duplicati & pulizia',
    sectionListino: 'Listino & prezzi',
    cardReanalyzeTitle: 'Rianalizza OCR (coda e AI)',
    cardReanalyzeDesc:
      'Documenti in attesa, classificazione AI e suggerimenti Gemini — come in AI Inbox. Sulle bolle/fatture continua l’azione «Rianalizza» sulla riga.',
    cardOpenInbox: 'Apri AI Inbox',
    cardRefreshDateTitle: 'Rileggi data da allegato',
    cardRefreshDateDesc: 'Su una fattura aperta usa «Rileggi data» accanto alla data documento (serve un allegato).',
    cardOpenFatture: 'Apri archivio fatture',
    cardOcrCheckTitle: 'Controllo OCR fornitore',
    cardOcrCheckDesc:
      'Nella scheda fornitore (desktop) il pulsante «Controllo OCR» esegue la stessa verifica massiva sulle date sospette.',
    cardOpenFornitoreSheet: 'Apri fornitori',
    cardDupScanTitle: 'Cerca duplicati fatture',
    cardDupScanDesc: 'Stessa scansione della toolbar del riepilogo: stesso fornitore, stessa data e stesso numero fattura.',
    cardDupManageTitle: 'Gestione duplicati',
    cardDupManageDesc: 'Bolle, fatture e fornitori: analizza gruppi e unifica o elimina copie.',
    cardDupManageCta: 'Apri gestione duplicati',
    cardAuditTitle: 'Audit abbinamenti fornitore',
    cardAuditDesc: 'Allinea email mittente e fornitori assegnati — scheda Abbinamenti in AI Inbox.',
    cardOpenAudit: 'Apri tab Abbinamenti',
    cardListinoAutoTitle: 'Aggiornamento automatico listino (Auto)',
    cardListinoAutoDesc: 'Sulla scheda Listino di un fornitore: analizza automaticamente le fatture non ancora elaborate.',
    cardListinoFromInvTitle: 'Importa prezzi «Da fattura»',
    cardListinoFromInvDesc:
      'Sulla scheda Listino: scegli una fattura con PDF e conferma i prodotti da importare nel listino.',
    cardListinoAddTitle: 'Aggiungi prodotto al listino',
    cardListinoAddDesc:
      'Sulla scheda Listino: pulsante Aggiungi per inserimento manuale (desktop).',
    cardListinoCta: 'Vai ai fornitori — scheda Listino',
    manualImapSyncTitle: 'Sync email — finestra 24 ore',
    manualImapSyncDesc:
      'Cerca nella casella gli ultimi 24 ore di messaggi. Il cron automatico usa invece le ultime 3 ore per limitare il carico.',
    historicSyncSectionLabel: 'Sync storica (anno precedente)',
    historicSyncTitle: 'Importa dati anno precedente',
    historicSyncDesc:
      'Scarica tutte le email degli ultimi 365 giorni per avere il confronto con l’anno fiscale 2025/26.',
    historicSyncWarning:
      '⚠️ Operazione lenta — può richiedere diversi minuti. Esegui solo una volta.',
    historicSyncCta: 'Avvia sync storica',
    historicSyncResult: '{n} documenti importati dall’anno precedente',
    historicSyncProgress: 'Elaborazione: {label}…',
    historicSyncCompleted: 'Completato!',
    hintContextualShortcuts:
      'Promemoria: rianalisi OCR sulla singola riga bolla/fattura, «Sposta in fattura» sulla bolla, «Da fattura» / «Auto» / «Aggiungi» restano sulla scheda listino.',
  },
  common: {
    save: 'Salva',
    cancel: 'Annulla',
    delete: 'Elimina',
    edit: 'Modifica',
    new: 'Nuovo',
    loading: 'Caricamento...',
    error: 'Errore',
    success: 'Successo',
    noData: 'Nessun dato',
    document: 'Documento',
    actions: 'Azioni',
    date: 'Data',
    status: 'Stato',
    supplier: 'Fornitore',
    notes: 'Note',
    phone: 'Telefono',
    saving: 'Salvataggio...',
    attachment: 'Allegato',
    openAttachment: 'Apri allegato',
    detail: 'Dettaglio',
    add: 'Aggiungi',
    rename: 'Rinomina',
    role: 'Ruolo',
    aiExtracted: 'Dati estratti dall\'IA',
    matched: 'Associato',
    notMatched: 'Non associato',
    recordSupplierLinked: 'Collegato',
    company: 'Azienda',
    invoiceNum: 'N. Fattura',
    documentRef: 'Riferimento',
    total: 'Totale',
    duplicateBadge: 'DUPLICATO',
    emailSyncAutoSavedBadge: 'Salvato automaticamente',
    viewerZoomIn: 'Ingrandisci',
    viewerZoomOut: 'Riduci',
    viewerZoomReset: '100%',
    viewerZoomHint: 'Ctrl + rotellina o pulsanti',
  },
  status: {
    inAttesa: 'In attesa',
    completato: 'Completato',
    completata: 'Completata',
  },
  dashboard: {
    title: 'Riepilogo',
    suppliers: 'Fornitori',
    totalBills: 'Bolle totali',
    pendingBills: 'Bolle in attesa',
    invoices: 'Fatture',
    recentBills: 'Bolle recenti',
    recentBillsMobileListDisabled:
      'L’elenco delle bolle non è mostrato su questo schermo. Usa «Vedi tutte» per aprire l’archivio o passa a un display più largo.',
    viewAll: 'Vedi tutte →',
    syncEmail: 'Sincronizza Email',
    emailSyncScopeLookback: 'Finestra giorni (sede)',
    emailSyncScopeFiscal: 'Anno fiscale',
    emailSyncFiscalYearSelectAria: 'Periodo per la sincronizzazione email',
    emailSyncScopeHint:
      'IT, FR, DE, ES: anno civile. UK: anno fiscale che termina il 5 aprile (tax year). Ogni sede usa il proprio paese.',
    emailSyncLookbackSedeDefault: 'Default sede (IMAP)',
    emailSyncLookbackDaysN: 'Ultimi {n} giorni',
    emailSyncLookbackDaysAria: 'Quanti giorni indietro cercare le email',
    emailSyncLookbackDaysHint:
      'Default sede: usa i giorni impostati sulla sede. Altrimenti limita la ricerca IMAP agli ultimi N giorni (lette e non lette).',
    emailSyncDocumentKindAria: 'Tipologia documenti da importare con la sincronizzazione email',
    emailSyncDocumentKindHint:
      'Tutto: comportamento predefinito. Nuovo fornitore: solo mittenti non in rubrica. Bolla / Fattura: forza il tipo di bozza creata. Estratto conto: solo messaggi con oggetto da estratto (statement).',
    emailSyncDocumentKindAll: 'Tutti i documenti',
    emailSyncDocumentKindFornitore: 'Nuovo fornitore',
    emailSyncDocumentKindBolla: 'Bolla (DDT)',
    emailSyncDocumentKindFattura: 'Fattura',
    emailSyncDocumentKindEstratto: 'Estratto conto',
    syncing: 'Sincronizzazione...',
    sendReminders: 'Invia Solleciti',
    sending: 'Invio in corso...',
    viewLog: 'Vedi Log',
    sedeOverview: 'Panoramica per Sede',
    manageSedeNamed: 'Gestisci {name} →',
    manageSedi: 'Gestisci sedi →',
    sedeImapOn: 'Email attiva',
    digitalizzaRicevuto: 'Ricevuta digitale',
    scannerFlowCardTitle: 'Scanner — oggi',
    scannerFlowCardHint:
      'PDF analizzati dall’AI e documenti salvati da questa sede nella giornata (fuso orario delle impostazioni).',
    scannerFlowAiElaborate: 'Elaborate (AI)',
    scannerFlowArchived: 'Archiviate',
    scannerFlowOpenScanner: 'Nuova scansione',
    scannerFlowBolleHubTitle: 'Archivio bolle',
    scannerFlowRecentTitle: 'Scansioni Scanner AI',
    scannerFlowNoRecent:
      'Nessun evento di scansione di recente. Usa Scanner AI nella barra in basso o apri una nuova scansione.',
    scannerFlowTodayCounts: 'Oggi: {ai} elaborate (AI) · {arch} archiviate',
    scannerFlowFiscalPeriodLine: 'Anno fiscale {year}',
    scannerFlowCardHintFiscal:
      'I numeri contano gli eventi registrati in app in questo anno fiscale (come il selettore in alto), non solo oggi.',
    scannerFlowDetailListCountRange: '{n} documenti nel periodo',
    scannerFlowDetailListCountToday: '{n} documenti oggi',
    scannerFlowDetailEmptyRange: 'Nessun documento in questo periodo.',
    scannerFlowStepAiElaborata: 'PDF analizzato dall’AI — lettura di testo e dati (OCR)',
    scannerFlowStepArchiviataBolla: 'Bolla (DDT) registrata e salvata in archivio',
    scannerFlowStepArchiviataFattura: 'Fattura registrata e salvata in archivio',
    scannerFlowTodayActivityTitle: 'Cosa è stato fatto oggi',
    scannerFlowNoEventsToday: 'Nessun passaggio Scanner AI registrato oggi per questa sede.',
    scannerFlowEventsAllLink: 'Elenco completo eventi →',
    scannerFlowEventsPageTitle: 'Scanner AI — eventi',
    scannerFlowEventsEmpty: 'Nessun evento Scanner registrato.',
    scannerFlowEventsPrev: 'Precedente',
    scannerFlowEventsNext: 'Successiva',
    scannerFlowEventsPageOf: 'Pagina {current} di {pages}',
    scannerMobileTileTap: 'Tocca per iniziare',
    duplicateFattureScanButton: 'Cerca duplicati fatture',
    duplicateFattureToolbarShort: 'Duplicati',
    sendRemindersToolbarShort: 'Solleciti',
    syncEmailToolbarShort: 'Sync Email',
    emailSyncCronLine: '🟢 Sync automatica — ultima: {relative}',
    emailSyncCronIssueLine: '⚠️ Problema IMAP — ultima: {relative}',
    emailSyncCronNever: 'mai',
    emailSyncCronJustNow: 'proprio ora',
    emailSyncCronMinutesAgo: '{n} minuti fa',
    emailSyncCronHoursAgo: '{n} ore fa',
    emailSyncCronLateLine: '🟡 Sync in ritardo — ultima: {relative}',
    emailSyncCronStoppedLine: '🔴 Sync ferma — ultima: {relative}',
    emailSyncForceSync: 'Forza sync',
    emailSyncEmergencyToolsAria: 'Strumenti — sincronizza email manualmente (emergenza)',
    duplicateFattureModalTitle: 'Fatture duplicate',
    duplicateFattureScanning: 'Analisi delle fatture in corso…',
    duplicateFattureScanningBatch: 'Ultimo lotto letto dal database',
    duplicateFattureScanningAwaitingRows:
      'In attesa delle prime righe dal database (con molte fatture il primo blocco può richiedere tempo).',
    duplicateFattureNone:
      'Nessun duplicato trovato. Il controllo considera stesso fornitore, stessa data documento e stesso numero fattura (solo righe con numero valorizzato).',
    duplicateFattureError: 'Impossibile completare la ricerca. Riprova tra poco.',
    duplicateFattureGroupCount: '{n} copie',
    duplicateFattureSedeUnassigned: 'Senza sede',
    duplicateFattureTruncated:
      'Analisi limitata alle prime 50.000 fatture visibili: il risultato potrebbe essere incompleto.',
    duplicateFattureClose: 'Chiudi',
    duplicateFattureRowsAnalyzed: '{n} fatture analizzate',
    duplicateFattureDeleteConfirm:
      'Eliminare questa fattura? Le altre copie nel gruppo restano in archivio. Operazione irreversibile.',
    duplicateFattureDeleteAria: 'Elimina questa copia duplicata',
    duplicateDashboardBanner_one: 'Rilevato {n} duplicato — Clicca per gestirlo',
    duplicateDashboardBanner_other: 'Rilevati {n} duplicati — Clicca per gestirli',
    kpiFiscalYearFilter: 'Periodo KPI (anno fiscale)',
    kpiFiscalYearFilterAria: 'Filtra conteggi bolle, fatture, ordini, listino ed estratti per anno fiscale',
    workspaceQuickNavAria:
      'Collegamenti rapidi alle sezioni sede (stesse destinazioni delle schede sotto alle tile KPI)',
    desktopHeaderSedeToolsMenuTrigger: 'Strumenti',
    desktopHeaderSedeToolsMenuAria:
      'Pannello con ricerca duplicati fatture, invio solleciti e sincronizzazione email dalla casella',
    desktopHeaderSedeToolsMenuTriggerAriaReminders: 'Solleciti: {n} fornitori con bolle in scadenza',
    kpiNoPendingBills: 'Nessuna bolla in attesa.',
    kpiOperatorOfflineOverlayTitle: 'Sincronizzazione in pausa',
    kpiOperatorOfflineOverlayHint: 'Sei offline: i collegamenti delle schede KPI sono disattivati fino al ripristino della connessione.',
    kpiListinoAnomaliesCountLine: '{n} anomalie prezzo rilevate',
    kpiBollePendingListCta: 'Vedi {n} in attesa →',
    kpiDuplicateInvoicesDetected: '⚠️ {n} Duplicati rilevati',
    kpiDuplicateBolleDetected: '⚠️ {n} Bolle duplicate rilevate',
    kpiDocumentiDaRevisionareTitle: 'Documenti da revisionare',
    kpiDocumentiDaRevisionareSub: 'Duplicati, mittenti sconosciuti e anomalie prezzo Rekki',
    inboxUrgentePageTitle: 'Inbox urgente',
    inboxUrgentePageIntro:
      'Punto unico per le criticità operative: documenti da associare, anomalie prezzo e duplicati da verificare nelle liste.',
    inboxUrgenteNavDocQueue: 'Coda documenti da email',
    inboxUrgenteNavPriceAnomalies: 'Verifica — anomalie prezzo Rekki',
    inboxUrgenteNavInvoices: 'Fatture (duplicati)',
    inboxUrgenteNavBolle: 'Bolle (duplicati)',
    inboxUrgenteNavOrdini: 'Ordini (duplicati)',
    inboxUrgenteNavAiInbox: 'AI Inbox (coda + duplicati)',
    errorCountSuffix: 'errori',
    manualReceiptLabel: 'Ricevuto (senza bolla)',
    manualReceiptPlaceholder: 'es. 5 kg calamari, 2 casse limoni',
    manualReceiptRegister: 'Registra Consegna',
    manualReceiptRegistering: 'Registrazione…',
    manualReceiptSaved: 'Consegna registrata.',
    manualReceiptNeedTextOrPhoto: 'Inserisci una descrizione o allega una foto.',
    manualReceiptRemovePhoto: 'Rimuovi foto',
    manualReceiptNeedSupplier: 'Seleziona un fornitore.',
    manualReceiptRegisterFailed: 'Registrazione non riuscita.',
    manualReceiptEmailSupplierLabel:
      'Invia email al fornitore per chiedere copia dell’ordine e della bolla di consegna (DDT)',
    manualReceiptEmailSupplierHint:
      'Aggiungi l’email del fornitore in anagrafica per abilitare l’invio.',
    manualReceiptEmailSent: 'Email di richiesta inviata al fornitore.',
    manualReceiptEmailFailed: 'Consegna registrata, ma l’email non è stata inviata.',
    manualReceiptEmailDescPhotoOnly:
      'È stata allegata una foto alla registrazione della consegna (nessun testo descrittivo).',
    adminGlobalTitle: 'Riepilogo globale',
    adminGlobalSubtitle: 'Riepilogo di tutte le sedi. Seleziona una filiale dal menu o dalla card per la vista operativa.',
    adminGlobalTotalsLabel: 'Totali rete',
    adminOpenBranchDashboard: 'Vista operativa',
    adminSedeSettingsLink: 'Scheda sede',
    adminDocQueueShort: 'In coda',
    rekkiOrder: 'Ordina su Rekki',
    manualDeliveryNeedSede:
      'Seleziona un operatore attivo o assicurati che il tuo profilo sia associato a una sede per registrare una consegna.',
    kpiPriceListSub: 'righe nel listino',
    listinoOverviewHint:
      'Righe listino prezzi dei fornitori nel tuo ambito. Apri la scheda fornitore per modificare o importare da fattura.',
    listinoOverviewEmpty: 'Nessuna riga listino in questo ambito.',
    listinoOverviewOpenSupplier: 'Apri fornitore →',
    listinoOverviewLimitNote: 'Mostrate le ultime {n} righe.',
    fattureRiepilogoTitle: 'Totale fatture',
    fattureRiepilogoHint:
      'Somma degli importi nel tuo ambito. La tabella elenca le ultime fatture per data; apri la scheda per allegato e collegamenti.',
    fattureRiepilogoEmpty: 'Nessuna fattura in questo ambito.',
    fattureRiepilogoLimitNote: 'Mostrate le ultime {n} fatture (per data).',
    fattureRiepilogoOpenInvoice: 'Apri fattura →',
    fattureRiepilogoCountLabel: '{n} fatture',
    fattureRiepilogoLinkAll: 'Tutte le fatture →',
    kpiStatementNone: 'Nessun estratto conto',
    kpiStatementAllOk: 'Nessuna anomalia',
    kpiStatementIssuesFooter: 'su {t} estratti controllati',
    kpiDaProcessareSub: 'documenti in coda',
    kpiOrdiniSub: 'conferme d’ordine registrate',
    ordiniOverviewHint:
      'PDF di conferma ordine archiviati per fornitore. Apri la scheda fornitore (tab Ordini) per caricare o gestire i file.',
    ordiniOverviewEmpty: 'Nessuna conferma ordine in questo ambito.',
    ordiniOverviewOpenSupplier: 'Apri fornitore →',
    ordiniOverviewLimitNote: 'Mostrate le ultime {n} conferme.',
    ordiniColSupplier: 'Fornitore',
    ordiniColTitle: 'Titolo',
    ordiniColOrderDate: 'Data ordine',
    ordiniColRegistered: 'Registrata',
    ordiniOpenPdf: 'Apri PDF',
    ordiniPdfPreview: 'Anteprima',
    ordiniPdfOpenNewTab: 'Apri in nuova scheda',
    ordiniPdfCopyLink: 'Copia link',
    ordiniPdfLinkCopied: 'Link copiato',
    operatorNoSede:
      'Nessuna sede associata al tuo profilo. Contatta l’amministratore per collegarti alla filiale corretta.',
    suggestedSupplierBanner: 'Rilevato nuovo fornitore: {name}. Vuoi aggiungerlo?',
    suggestedSupplierAdd: 'Nuovo fornitore',
    suggestedSupplierConfirm: 'Aggiungi in rubrica',
    suggestedSupplierOpenForm: 'Apri modulo',
    suggestedSupplierSavedToast: 'Fornitore aggiunto',
    suggestedSupplierSkip: 'Prossimo',
    suggestedSupplierBannerTeaser_one: 'Rilevato 1 nuovo fornitore — Clicca per gestirlo',
    suggestedSupplierBannerTeaser_many: 'Rilevati {n} nuovi fornitori — Clicca per gestirli',
    suggestedSupplierDrawerTitle: 'Nuovi fornitori rilevati',
    suggestedSupplierSenderLabel: 'Mittente',
    suggestedSupplierFirstContactLabel: 'Primo contatto',
    suggestedSupplierIgnore: 'Ignora',
    suggestedSupplierDrawerCloseScrimAria: 'Chiudi il pannello nuovi fornitori',
    enterAsSede: 'Entra come sede',
    syncHealthAlert: 'Problema sincronizzazione (IMAP o OCR)',
    syncHealthOcrCount: 'Fallimenti OCR (48h): {n}',
    viewingAsSedeBanner: 'Stai visualizzando il riepilogo come:',
    exitSedeView: 'Torna alla vista admin',
    emailSyncQueued: 'In coda — un\'altra sincronizzazione sta terminando…',
    emailSyncPhaseConnect: 'Connessione…',
    emailSyncConnectToServer: 'Collegamento al server IMAP (rete, crittografia, accesso)…',
    emailSyncConnectOpeningMailbox: 'Apertura della cartella In arrivo…',
    emailSyncPhaseSearch: 'Scansione testi…',
    emailSyncPhaseProcess: 'Analisi allegati con Vision AI…',
    emailSyncPhasePersist: 'Registrazione dati nel database…',
    emailSyncPhaseDone: 'Sincronizzazione completata.',
    emailSyncStalled:
      'Nessun aggiornamento da un po’ — con molti allegati la Vision può impiegare diversi minuti. Attendere…',
    emailSyncStalledHint:
      'Significa solo che non arrivano messaggi sul flusso (normale con OCR lungo). I tentativi reali sulla casella email compaiono sopra in rosso durante «Connessione».',
    emailSyncImapRetryLine: 'Connessione IMAP: tentativo {current} di {max}',
    emailSyncCountsHint: 'Trovate · nuove in app · elaborate · unità PDF o corpo email',
    emailSyncMailboxGlobal: 'Casella IMAP globale (variabili d’ambiente)',
    emailSyncMailboxSede: 'Casella: {name}',
    emailSyncSupplierFilterLine: 'Filtro fornitore: {name}',
    emailSyncStatFoundLine: 'Trovate in casella: {found}',
    emailSyncStatImportedLine: 'Nuove in app (documenti importati): {imported}',
    emailSyncStatProcessedLine: 'Email elaborate (lette e analizzate): {processed}',
    emailSyncStatAlreadyLine: 'Già elaborate in sync precedente (nessun nuovo import): {n}',
    emailSyncStatIgnoredLine: 'Senza esito o ignorate: {ignored}',
    emailSyncStatDraftsLine: 'Bozze create automaticamente: {drafts}',
    emailSyncStatUnitsLine:
      'Unità da analizzare (allegati PDF/immagine o corpo email lungo): {done} / {total}',
    emailSyncStripDetailsExpandAria: 'Mostra dettagli sincronizzazione email',
    emailSyncStripDetailsCollapseAria: 'Nascondi dettagli sincronizzazione email',
    emailSyncStop: 'Stop',
    emailSyncStopAria: 'Interrompi sincronizzazione email',
    emailSyncDismiss: 'Chiudi',
    emailSyncDismissAria: 'Chiudi riepilogo sincronizzazione email',
    potentialSupplierFromEmailBodyBanner:
      'Trovato potenziale fornitore (da testo email): {name}. Vuoi associarlo?',
    potentialSupplierFromEmailBodyCta: 'Apri creazione fornitore',
  },
  fornitori: {
    title: 'Fornitori',
    new: 'Nuovo Fornitore',
    nome: 'Nome / Ragione Sociale',
    email: 'Email',
    piva: 'Partita IVA',
    noSuppliers: 'Nessun fornitore ancora.',
    addFirst: 'Aggiungi il primo fornitore →',
    editTitle: 'Modifica Fornitore',
    profileViewOnlyBanner:
      'Sola visualizzazione su mobile: consulta dati e documenti; per modificare anagrafica, listino o coda usa un desktop o chiedi al responsabile sede.',
    saveChanges: 'Salva Modifiche',
    notFound: 'Fornitore non trovato.',
    deleteConfirm: 'Eliminare questo fornitore? Verranno eliminate anche tutte le bolle e fatture collegate.',
    importaDaFattura: 'Importa da Fattura',
    countLabel: 'fornitori registrati',
    namePlaceholder: 'Es. Mario Rossi Srl',
    emailPlaceholder: 'fornitore@esempio.com',
    pivaLabel: 'Partita IVA',
    pivaPlaceholder: 'IT12345678901',
    addressLabel: 'Indirizzo (opz.)',
    addressPlaceholder: 'Via, CAP, Città',
    rekkiLinkLabel: 'Link Rekki (opz.)',
    rekkiLinkPlaceholder: 'https://…',
    rekkiIdLabel: 'ID Rekki (opz.)',
    rekkiIdPlaceholder: 'es. ID fornitore su Rekki',
    rekkiIntegrationTitle: 'Integrazione Rekki',
    rekkiOpenInApp: 'Apri Rekki',
    rekkiEmbedPanelTitle: 'Rekki',
    rekkiSheetOpeningLine: 'Stai aprendo il listino di {name}',
    rekkiSheetGoCta: 'Vai al listino',
    rekkiSheetEmbedHint:
      'Il sito Rekki non può essere incastonato qui (sicurezza). Controlla titolo e testo sopra per confermare; per la pagina completa usa il pulsante sotto.',
    rekkiSheetPopupButton: 'Apri in finestra (1000×900)',
    rekkiSheetPagePreviewCaption: 'Anteprima pagina',
    rekkiSheetPagePreviewLoading: 'Caricamento anteprima…',
    rekkiSheetPagePreviewUnavailable: 'Anteprima non disponibile. Apri Rekki con il pulsante sotto.',
    rekkiLookupByVat: 'Cerca su Rekki (P.IVA)',
    rekkiLookupApiLink: 'Ricerca automatica ID Rekki (API)',
    rekkiSaveRekkiMapping: 'Salva collegamento Rekki',
    rekkiSaveMapping: 'Salva mapping',
    rekkiStatusNotConnected: 'Non collegato',
    rekkiStatusConnected: 'Collegato',
    rekkiStatusPending: 'Modifiche da salvare',
    rekkiConnectedBadge: 'Rekki',
    rekkiCachedListBanner: 'Dati in cache (connessione assente). Le modifiche potrebbero non essere aggiornate.',
    cardFooterUnlockPin: 'Sblocca con PIN',
    rekkiLookupNeedVat: 'Aggiungi la P.IVA al fornitore per cercare su Rekki.',
    rekkiIdExtractedFromLink: 'ID fornitore ricavato dal link Rekki.',
    rekkiAutoLinkedSingle: 'Un solo fornitore trovato per questa P.IVA — collegamento Rekki salvato.',
    rekkiSearchOnRekkiGoogle: 'Cerca su Rekki',
    rekkiSearchOnRekkiGoogleByName: 'Cerca su Google (nome)',
    rekkiGuidedPasteHint:
      'Si apre Google con ricerca su rekki.com. Apri il profilo fornitore, copia l’URL dalla barra indirizzi, incollalo nel campo Link: l’ID viene estratto subito; poi Salva per attivare il confronto prezzi.',
    rekkiIdUrlNotParsed:
      'Il campo ID contiene un URL Rekki non riconosciuto. Incolla il profilo nel campo Link o solo l’ID fornitore.',
    saving: 'Salvataggio...',
    tabRiepilogo: 'Riepilogo',
    tabListino: 'Listino / Prezzi',
    tabAuditPrezzi: 'Audit Prezzi',
    tabConfermeOrdine: 'Conferme ordine',
    tabStrategyConto: 'Estratto Conto',
    kpiBolleTotal: 'Bolle Totali',
    kpiFatture: 'Fatture Registrate',
    kpiOrdini: 'Ordini',
    kpiPending: 'Documenti in attesa',
    kpiReconciliation: 'Riconciliazione',
    subAperte: 'aperte',
    subConfermate: 'confermate',
    subDaAbbinare: 'in coda',
    subChiuse: 'bolle chiuse',
    subListinoRows: 'righe listino',
    kpiFatturatoPeriodo: 'Fatturato (fatture)',
    subFatturatoPeriodoZero: 'Nessuna fattura con data nel periodo',
    subFatturatoPeriodoCount_one: '1 fattura inclusa nella somma',
    subFatturatoPeriodoCount_other: '{n} fatture incluse nella somma',
    subFatturatoTotaleLordoMicro: 'Totale lordo (tutte le fatture): {amount}',
    kpiListinoProdottiPeriodo: 'Prodotti listino',
    subListinoProdottiEAggiornamenti: '{p} prodotti distinti · {u} aggiornamenti di prezzo',
    subListinoPeriodoVuoto: 'Nessun aggiornamento listino nel periodo',
    subListinoPriceAnomalies: 'Attenzione: {n} variazioni di prezzo rilevate',
    subBolleRekkiSavingsMicro: 'Risparmi Rekki stimati: prezzi di riferimento più bassi su alcune consegne.',
    subBollePeriodoVuoto: 'Nessuna bolla con data nel periodo',
    subBollePeriodoRiepilogo: '{open} su {total} senza fattura collegata',
    subDocumentiCodaEmailPeriodo: 'Documenti da email da lavorare (stesso periodo)',
    subOrdiniPeriodo: 'nel periodo',
    subStatementsNoneInMonth: 'nessuno nel mese',
    subStatementsAllVerified: 'tutti OK',
    subStatementsWithIssues: 'anomalie',
    helpText: 'Vai alla tab <b>Estratto Conto</b> per abbinare documenti e bolle, o a <b>Bolle</b> e <b>Fatture</b> per vedere lo storico completo.',
    listinoSetupTitle: 'Tabella Listino non ancora creata',
    listinoSetupSubtitle: 'Attiva il tracking prezzi per prodotto in 2 click:',
    listinoSetupStep1: 'Clicca <strong class="font-bold text-app-fg">"Copia SQL"</strong> qui sotto',
    listinoSetupStep2: 'Apri <a href="https://supabase.com/dashboard/project/dubocvwsdzrqrrxsedas/sql/new" target="_blank" rel="noopener noreferrer" class="font-semibold text-amber-200 underline decoration-amber-200/50 transition-colors hover:text-app-fg">SQL Editor ↗</a>, incolla e clicca <strong class="font-bold text-app-fg">"Run"</strong>',
    listinoSetupShowSQL: 'Mostra SQL completo ▸',
    listinoCopySQL: 'Copia SQL',
    listinoCopied: 'Copiato!',
    listinoProdotti: 'Listino Prodotti',
    listinoProdottiTracked: 'prodotti tracciati',
    listinoNoData: 'Nessun prezzo prodotto registrato',
    listinoNoDataHint: 'Inserisci i prezzi direttamente nella tabella <code class="font-mono text-app-fg-muted">listino_prezzi</code> su Supabase.',
    listinoTotale: 'Totale speso',
    listinoDaBolle: 'Da bolle',
    listinoDaFatture: 'Da fatture',
    listinoStorico: 'Storico documenti',
    listinoDocs: 'documenti',
    listinoNoDocs: 'Nessun documento con importo registrato',
    listinoColData: 'Data',
    listinoColTipo: 'Tipo',
    listinoColNumero: 'Numero',
    listinoColImporto: 'Importo',
    listinoColTotale: 'Totale',
    listinoRekkiListBadge: '[Rekki]',
    listinoVerifyAnomalies: 'Anomalie',
    listinoVerifyAnomaliesTitle: 'Apri la tab Verifica con filtro anomalie prezzo Rekki per questo prodotto',
    listinoRowBadgeOk: 'OK',
    listinoRowBadgeAnomaly: 'Anomalie',
    listinoRowActionsLabel: 'Azioni',
    listinoLastIncrease: 'Ultimo aumento: {delta} ({pct})',
    listinoLastDecrease: 'Ultimo ribasso: {delta} ({pct})',
    listinoLastFlat: 'Prezzo in linea col riferimento ({pct})',
    listinoVsReferenceHint: 'rispetto al mese precedente o all’aggiornamento precedente.',
    listinoOriginInvoice: 'Origine ultimo prezzo: fattura {inv} del {data} · {supplier}',
    listinoFilterEmptyKpi: 'Nessun prodotto corrisponde al filtro KPI selezionato.',
    listinoClearKpiFilter: 'Mostra tutti i prodotti',
    listinoKpiAriaAll: 'Mostra tutti i prodotti nel listino',
    listinoKpiAriaFatture: 'Filtra i prodotti importati dalle fatture considerate in «Da fatture»',
    listinoKpiAriaBolle: 'Filtra i prodotti la cui data prezzo coincide con una bolla in elenco',
    listinoHistoryDepth: '{n} aggiornamenti precedenti',
    listinoPriceStaleBadge: 'Prezzo storico/scaduto',
    listinoPriceStaleHint: 'Ultimo aggiornamento da oltre 60 giorni.',
    preferredLanguageEmail: 'Lingua preferita (per email)',
    languageInheritSede: '— Eredita dalla sede —',
    recognizedEmailsTitle: 'Email riconosciute',
    recognizedEmailsHint:
      'Indirizzi aggiuntivi da cui questo fornitore può inviare documenti. La scansione email li abbina automaticamente.',
    recognizedEmailPlaceholder: 'es. fatture@fornitore.it',
    recognizedEmailLabelOptional: 'Etichetta (opz.)',
    displayNameLabel: 'Nome visualizzato (breve)',
    displayNameHint:
      'Opzionale. Se compilato, viene usato nella barra in basso su mobile e negli elenchi compatti al posto del nome completo.',
    displayNamePlaceholder: 'es. Amalfi',
    syncEmailNeedSede: 'Assegna una sede al fornitore per sincronizzare le email.',
    ocrControllaFornitore: 'Controllo OCR',
    ocrControllaFornitoreTitle:
      'Rilegge con l’AI bolle e fatture con data sospetta (come in Impostazioni — Fix date OCR). Per singolo documento usa il pulsante nella tab Bolle.',
    ocrControllaFornitoreResult: 'Completato: {corrected} documenti corretti, elaborate {scanned} di {total} in coda.',
    supplierMonthlyDocTitle: 'Riepilogo Fatture per l\'anno fiscale selezionato',
    supplierMonthlyDocColMonth: 'Mese',
    supplierMonthlyDocColBolle: 'Bolle',
    supplierMonthlyDocColFatture: 'Fatture',
    supplierMonthlyDocColSpesa: 'Totale fatture',
    supplierMonthlyDocColOrdini: 'Ordini',
    supplierMonthlyDocColStatements: 'Estratti',
    supplierMonthlyDocColPending: 'In coda',
    supplierMonthlyDocColFiscalYear: 'Anno fiscale',
    supplierMonthlyDocFiscalSelected: '{year}',
    supplierMonthlyDocAriaGoToTabMonth: 'Apri {tab} per il periodo {month}',
    supplierDesktopRegionAria: 'Scheda fornitore, vista desktop',
    listinoPeriodLabel: 'Periodo',
    listinoPeriodAll: 'Tutto',
    listinoPeriodCurrentMonth: 'Mese corrente',
    listinoPeriodPreviousMonth: 'Mese precedente',
    listinoPeriodLast3Months: 'Ultimi 3 mesi',
    listinoPeriodFiscalYear: 'Anno fiscale',
    loadingProfile: 'Stiamo caricando anagrafica, documenti e riepilogo del fornitore…',
    logoUrlLabel: 'Logo fornitore (URL)',
    logoUrlPlaceholder: 'https://esempio.it/logo.png',
    logoUrlHint:
      'Indirizzo HTTPS di un’immagine (PNG, JPG o SVG). Se il link non è valido o non si carica, restano le iniziali del nome.',
    confermeOrdineIntro:
      'Archivia qui le conferme d’ordine e PDF commerciali non fiscali. Non sostituiscono DDT o fatture nel flusso contabile.',
    confermeOrdineOptionalTitle: 'Titolo (opz.)',
    confermeOrdineOptionalTitlePh: 'es. Ordine 4582',
    confermeOrdineOptionalOrderDate: 'Data ordine',
    confermeOrdineOptionalNotePh: 'Note interne',
    confermeOrdineAdd: 'Salva conferma',
    confermeOrdineEmpty: 'Nessuna conferma d’ordine salvata per questo fornitore.',
    confermeOrdineColFile: 'Documento',
    confermeOrdineColRecorded: 'Caricato il',
    confermeOrdineOpen: 'Apri PDF',
    confermeOrdineDeleteConfirm: 'Eliminare questa conferma d’ordine e il file associato?',
    confermeOrdineDuplicateCopyDeleteConfirm:
      'Eliminare questa copia duplicata della conferma d’ordine? Le altre copie del gruppo restano in archivio.',
    confermeOrdineErrPdf: 'Carica un file PDF.',
    confermeOrdineErrNeedFile: 'Seleziona un PDF da caricare.',
    confermeOrdineErrUpload: 'Errore caricamento file',
    confermeOrdineErrSave: 'Errore salvataggio',
    confermeOrdineErrDelete: 'Errore eliminazione',
    confermeOrdineMigrationTitle: 'Tabella conferme ordine non attiva',
    confermeOrdineMigrationHint:
      'Esegui la migration SQL `add-conferme-ordine.sql` nel progetto Supabase (SQL Editor) per creare la tabella `conferme_ordine` e le policy RLS.',
  },
  bolle: {
    title: 'Bolle',
    new: 'Nuova Bolla',
    uploadInvoice: 'Carica Fattura',
    viewDocument: 'Vedi Documento',
    noBills: 'Nessuna bolla ancora.',
    addFirst: 'Registra la prima bolla →',
    deleteConfirm: 'Eliminare questa bolla? Verranno eliminate anche le fatture collegate.',
    duplicateCopyDeleteConfirm:
      'Eliminare questa copia duplicata del DDT? Le altre righe del gruppo restano in archivio.',
    pendingInvoiceOverdueHint: 'In attesa da oltre 7 giorni senza fattura: verifica il documento contabile.',
    ocrScanning: 'Riconoscimento fornitore…',
    ocrMatched: 'Fornitore riconosciuto',
    ocrNotFound: 'Seleziona fornitore manualmente',
    ocrAnalyzing: 'Analisi in corso…',
    ocrAutoRecognized: 'Riconosciuto automaticamente',
    ocrRead: 'Letto:',
    selectManually: 'Seleziona fornitore',
    saveNote: 'Salva Bolla',
    savingNote: 'Salvataggio in corso…',
    analyzingNote: 'Analisi documento…',
    takePhotoOrFile: 'Scatta foto o scegli file',
    ocrHint: 'L\'AI estrae automaticamente i dati del fornitore',
    cameraBtn: 'Fotocamera',
    fileBtn: 'Scegli file',
    countSingolo: 'bolla registrata',
    countPlural: 'bolle registrate',
    countTodaySingolo: 'bolla oggi',
    countTodayPlural: 'bolle oggi',
    noBillsToday: 'Nessuna bolla per oggi.',
    listShowAll: 'Tutte le bolle',
    listShowToday: 'Solo oggi',
    listAllPending: 'Solo in attesa',
    fotoLabel: 'Foto / Allegato Bolla',
    fornitoreLabel: 'Fornitore',
    dataLabel: 'Data Consegna',
    dettaglio: 'Dettaglio Bolla / Consegna',
    fattureCollegate: 'Fatture collegate',
    aggiungi: '+ Aggiungi',
    nessunaFatturaCollegata: 'Nessuna fattura collegata.',
    allegatoLink: 'Allegato →',
    statoCompletato: 'Completato',
    statoInAttesa: 'In attesa',
    apri: 'Apri',
    colNumero: 'Numero',
    colAttachmentKind: 'Allegato',
    riannalizzaOcr: 'Rianalizza (OCR)',
    ocrRerunMovedToInvoices:
      'Classificato come fattura: il documento è stato spostato nella tab Fatture.',
    ocrRerunUpdatedStaysBolla: 'Dati della bolla aggiornati. Classificazione: ancora DDT / bolla.',
    ocrRerunUnchangedStaysBolla:
      'Nessun campo modificato. Classificazione: ancora DDT / bolla (controlla il file o riprova).',
    ocrRerunFailed: 'OCR non completato: verifica l’allegato o riprova.',
    ocrRerunProgressTitle: 'Rianalisi in corso',
    ocrRerunStep1: '1. Caricamento allegato dallo storage',
    ocrRerunStep2: '2. Analisi IA (Gemini): classificazione fattura/DDT, numero, importo, data',
    ocrRerunStep3: '3. Salvataggio bolla o spostamento in Fatture se applicabile',
    convertiInFattura: 'Sposta in Fatture',
    convertiInFatturaTitle: 'Registra come fattura (senza OCR)',
    convertiInFatturaConfirm:
      'Spostare questo documento dalla tab Bolle alla tab Fatture? Il numero e l’importo attuali verranno usati come numero fattura e totale.',
    convertiInFatturaOk: 'Documento spostato in Fatture.',
    convertiInFatturaErrLinked:
      'Operazione non possibile: esiste già una fattura collegata a questa bolla o un collegamento in fattura_bolle.',
    convertiInFatturaErrGeneric: 'Operazione non riuscita.',
    attachmentKindPdf: 'PDF',
    attachmentKindImage: 'Immagine',
    attachmentKindOther: 'File',
    nessunaBollaRegistrata: 'Nessuna bolla registrata',
    creaLaPrimaBolla: 'Crea la prima bolla →',
    vediDocumento: 'Vedi documento',
    dateFromDocumentHint: 'Dal documento',
    prezzoDaApp: 'Prezzo da app',
    verificaPrezzoFornitore: 'Verifica prezzo fornitore',
    rekkiPrezzoIndicativoBadge: '⚠️ Prezzo indicativo da app Rekki',
    listinoRekkiRefTitle: 'Listino di riferimento (Rekki)',
    listinoRekkiRefHint:
      'Con ID Rekki configurato sul fornitore confronta l’importo della bolla con gli ultimi prezzi listino importati.',
    listinoRekkiRefEmpty: 'Nessuna riga listino per questo fornitore.',
    scannerTitle: 'Scanner AI',
    scannerWhatLabel: 'Cosa stai caricando?',
    scannerModeAuto: 'Automatico',
    scannerModeBolla: 'Bolla / DDT',
    scannerModeFattura: 'Fattura',
    scannerModeSupplier: 'Nuovo fornitore',
    scannerFlowBolla: 'Registrazione bolla',
    scannerFlowFattura: 'Registrazione fattura',
    scannerSaveFattura: 'Salva fattura',
    scannerSavingFattura: 'Salvataggio fattura…',
    scannerCreateSupplierCta: 'Crea fornitore con dati letti',
    scannerCreateSupplierFromUnrecognized: 'Crea fornitore da questo documento',
    scannerPdfPreview: 'PDF allegato — anteprima non disponibile',
    scannerCameraCapture: 'Scatta',
    scannerCameraPermissionDenied:
      'Impossibile accedere alla fotocamera. Controlla i permessi del browser o del dispositivo.',
    scannerFileScanTypeError: 'Carica un PDF oppure una foto (JPEG, PNG o WebP).',
    scannerImageAttached: 'Foto allegata',
  },
  fatture: {
    title: 'Fatture',
    new: 'Nuova Fattura',
    noInvoices: 'Nessuna fattura ancora.',
    addFirst: 'Aggiungi la prima fattura →',
    invoice: 'Fattura',
    openBill: 'Apri bolla →',
    deleteConfirm: 'Eliminare questa fattura? L\'operazione è irreversibile.',
    countLabel: 'fatture ricevute',
    headerBolla: 'Bolla',
    headerAllegato: 'Allegato',
    apri: 'Apri →',
    caricaFatturaTitle: 'Carica Fattura',
    bollaMarkata: 'La bolla verrà marcata come completata',
    collegataABolla: 'Collegata a una bolla',
    bollaPasseraCompletato: 'Al salvataggio la bolla passerà a "completato"',
    dataFattura: 'Data Fattura',
    fileFattura: 'File Fattura',
    caricaPdfFoto: 'Carica PDF o scatta foto',
    maxSize: 'PDF, JPG, PNG, WebP — max 10 MB',
    savingInProgress: 'Salvataggio in corso...',
    salvaChiudiBolla: 'Salva e Chiudi Bolla',
    dettaglio: 'Dettaglio',
    bollaCollegata: 'Bolla collegata',
    statusAssociata: 'Associata',
    statusSenzaBolla: 'Senza bolla',
    colNumFattura: 'N° Fattura',
    nessunaFatturaRegistrata: 'Nessuna fattura registrata',
    nessunaFatturaNelPeriodo: 'Nessuna fattura con data in questo periodo',
    fattureInArchivioAllargaFiltroData:
      'Sono registrate {n} fatture su questo fornitore, ma nessuna ha la data fattura nell’intervallo mostrato (sopra a destra). Allarga le date: l’elenco filtra per data documento, non per giorno di scansione.',
    fattureExpandDateRangeCta: 'Mostra tutte le fatture (2000 – oggi)',
    duplicateInvoiceSameSupplierDateNumber:
      'Questa fattura è già registrata: stesso fornitore, stessa data e stesso numero documento. Per sostituire il PDF apri la fattura esistente e usa «Sostituisci file».',
    duplicateInvoiceSameSupplierDateAmountNoNumber:
      'Questa fattura è già registrata: stesso fornitore, stessa data e stesso importo (nessun numero documento). Per sostituire il PDF apri la fattura esistente e usa «Sostituisci file».',
    duplicateDeleteConfirm:
      "Vuoi eliminare questa copia della fattura {numero}? L'originale verrà mantenuto.",
    duplicateRemoveCopy: 'Elimina duplicato',
    duplicateRemoveThisCopy: 'Rimuovi questa copia',
    duplicatePairBadgeAria: 'Evidenzia le fatture gemelle duplicate',
    refreshDateFromDoc: 'Rileggi data',
    refreshDateFromDocTitle: 'Rileggi la data dal documento (OCR) e aggiorna la fattura',
    refreshDateFromDocSuccess: 'Data aggiornata a {data}.',
    refreshDateFromDocUnchanged: 'La data è già allineata a quella letta dal documento.',
  },
  archivio: {
    title: 'Archivio',
    subtitle: 'fornitori',
    noBills: 'Nessuna bolla',
    noInvoices: 'Nessuna fattura',
    withBill: 'Con bolla',
    noEmail: 'Nessuna email',
    bollaS: 'bolla',
    bollaP: 'bolle',
    fatturaS: 'fattura',
    fatturaP: 'fatture',
    editLink: 'Modifica →',
    nuova: '+ Nuova',
    nuovaFattura: '+ Fattura',
    documento: 'Documento',
    pendingDocCount: '({n} in attesa)',
    linkAssociateStatements: 'Associa →',
    queueTitle: 'Documenti in coda',
    queueSubtitle: 'da elaborare o da associare a una bolla',
    unknownSender: 'Mittente sconosciuto',
    statusDaAssociare: 'Da associare',
    noQueue: 'Nessun documento in coda',
    noQueueHint: 'I documenti ricevuti via email appariranno qui.',
    receivedOn: 'Ricevuto:',
    docDate: 'Data doc:',
  },
  impostazioni: {
    title: 'Impostazioni',
    subtitle: 'Personalizza valuta e fuso orario',
    lingua: 'Lingua',
    valuta: 'Valuta',
    fuso: 'Fuso orario',
    preview: 'Anteprima',
    saved: 'Impostazioni salvate — aggiornamento in corso…',
    sectionLocalisation: 'Localizzazione',
    accountSection: 'Account',
    changeSede: 'Cambio sede',
    addOperatorsPickSede:
      'Scegli la sede attiva da Gestione sedi: poi potrai creare operatori (nome + PIN) da qui.',
    imapSection: 'Email IMAP',
  },
  log: {
    title: 'Attività email',
    subtitle: 'Documenti elaborati automaticamente dalla posta in arrivo.',
    sender: 'Mittente',
    subject: 'Oggetto',
    stato: 'Stato',
    detail: 'Dettaglio',
    retry: 'Riprova',
    retrying: 'Riprovando…',
    success: 'Successo',
    bollaNotFound: 'Documento Ricevuto',
    supplierNotFound: 'Mittente sconosciuto',
    noLogs: 'Nessun log ancora.',
    emptyHint: 'Esegui una sincronizzazione email dal Riepilogo.',
    totalLogs: 'Totale log',
    linkedInvoices: 'Documenti ricevuti',
    withErrors: 'Con errori',
    vediFile: 'Vedi file',
    supplierSuggested: 'Fornitore suggerito',
    aiSuggest: 'Suggerimento AI',
    aiSuggestTitle: 'Anagrafica suggerita (OCR)',
    aiSuggestLoading: 'Analisi in corso…',
    aiSuggestError: 'Impossibile analizzare il documento.',
    openCreateSupplier: 'Apri creazione fornitore',
    associateRememberHint:
      'Dopo il salvataggio l’email del mittente verrà associata al fornitore per le prossime sincronizzazioni.',
    colAttachment: 'Allegato',
    colSede: 'Sede',
    colLogId: 'ID log',
    colRegistered: 'Registrato',
    tabEmailLog: 'Attività email',
    tabBlacklist: 'Blacklist email',
    blacklistSubtitle:
      'Mittenti esclusi dalla scansione OCR (newsletter, account non-fornitore, ecc.).',
    blacklistColMittente: 'Mittente',
    blacklistColMotivo: 'Motivo',
    blacklistColDate: 'Aggiunto',
    blacklistPlaceholder: 'es. newsletter@servizio.it',
    blacklistAdd: 'Aggiungi',
    blacklistRemove: 'Rimuovi',
    blacklistFilterAll: 'Tutti i motivi',
    blacklistEmpty: 'Nessun mittente in blacklist.',
    blacklistError: 'Impossibile caricare la blacklist.',
    logIgnoreAlways: 'Ignora sempre questo mittente',
    logBlacklistAdded: 'Mittente aggiunto alla blacklist.',
    blacklistMotivoNewsletter: 'Newsletter',
    blacklistMotivoSpam: 'Spam',
    blacklistMotivoNonFornitore: 'Non fornitore',
    blacklistMotivoSistema: 'Sistema',
    blacklistMotivoSocial: 'Social',
    activitySummaryToday: '{n} documenti processati automaticamente oggi',
    activityEmpty: 'Nessuna attività registrata per oggi.',
    activityColTipo: 'Tipo',
    activityColSupplier: 'Fornitore',
    activityColAmount: 'Importo',
    activityColStatus: 'Stato',
    activityOpenDocument: 'Apri documento',
    activityTipoInvoice: 'Fattura',
    activityTipoDdt: 'Bolla',
    activityTipoStatement: 'Statement',
    activityTipoQueue: 'In coda',
    activityTipoOrdine: 'Ordine',
    activityTipoResume: 'CV / curriculum',
    activityStatusSaved: '✅ Salvato',
    activityStatusNeedsSupplier: '⚠️ Fornitore da aggiungere',
    activityStatusIgnored: '⏭️ Ignorato',
    activityProcessDocumentsCta: 'Elabora documenti in coda',
    activityProcessDocumentsBusy: 'Elaborazione…',
    activityProcessDocumentsNoEligibleInLog:
      'In automatico è possibile solo se il mittente è già un fornitore in rubrica o manca OCR sulla riga. Aggiungi il fornitore o usa AI Inbox.',
    activityProcessDocumentsSummary:
      'Elaborati {runs}: {processed} aggiornati, {skipped} non applicabili in questo passaggio.',
    activityProcessDocumentsApiError: 'Elaborazione non riuscita',
    activityProcColumn: 'Elaborazione',
    activityProcSpinAria: 'Elaborazione OCR in corso',
    activityProcProcessedAuto: '✓ Salvato automaticamente',
    activityProcProcessedRevision: 'In revisione',
    activityProcProcessedOther: 'Aggiornato',
    activityProcOutcomeError: 'Errore',
    activityProcSkippedScartato: 'Ignorato — non ripreso',
    activityProcSkippedNoRowOrSede: 'Non accessibile',
    activityProcSkippedNoMittente: 'Mittente non valido',
    activityProcSkippedNoSupplier: 'Fornitore da collegare',
    activityProcSkippedHasOcr: 'Già con OCR — usa Inbox',
    activityProcPendingBatch: 'In attesa (max 5 per passaggio)',
    activityProcRejectedCv: 'Scartato (CV / curriculum)',
    activityProcDash: '—',
  },
  sedi: {
    title: 'Sede e Utenti',
    subtitle: 'Gestisci la sede, la sincronizzazione email e gli operatori',
    titleGlobalAdmin: 'Sedi',
    subtitleGlobalAdmin: 'Gestisci le sedi, la sincronizzazione email e gli operatori',
    newSede: 'Nuova Sede',
    noSedi: 'Nessuna sede creata. Inizia aggiungendo la prima sede.',
    users: 'Utenti',
    imap: 'Configurazione Email (IMAP)',
    imapSubtitle: 'Configura la casella email di questa sede. Le fatture ricevute qui verranno associate automaticamente ai fornitori della sede.',
    imapHost: 'Host IMAP',
    imapHostPlaceholder: 'imap.gmail.com',
    imapPort: 'Porta',
    imapUser: 'Email / Utente',
    imapPassword: 'Password',
    imapPasswordPlaceholder: 'Password o App Password',
    testConnection: 'Testa connessione',
    saveConfig: 'Salva configurazione',
    notConfigured: 'Email non configurata',
    accessDenied: 'Accesso riservato agli amministratori',
    accessDeniedHint: 'Contatta l\'admin per ottenere l\'accesso.',
    creatingBtn: 'Creazione...',
    createBtn: 'Crea',
    nomePlaceholder: 'Es. Sede di Milano',
    nessunUtente: 'Nessun utente trovato.',
    emailHeader: 'Email',
    sedeHeader: 'Sede',
    ruoloHeader: 'Ruolo',
    nessunaSedeOption: '— Nessuna sede —',
    operatoreRole: 'Operatore',
    adminRole: 'Portale Gestionale',
    adminSedeRole: 'Amministratore Sede',
    profileRoleAdmin: 'Portale Gestionale',
    adminScopedSediHint:
      'Vedi solo la sede collegata al tuo profilo. Nuove sedi e la sezione «Utenti senza sede» sono riservate all’amministratore principale (profilo admin senza sede).',
    renameTitle: 'Rinomina',
    deleteTitle: 'Elimina',
    addOperatorSedeTitle: 'Nuovo operatore',
    addOperatorSedeDesc: 'L’operatore accede con nome e PIN (min. 4 caratteri). L’email è generata automaticamente.',
    operatorDisplayNameLabel: 'Nome visualizzato',
    operatorPinMinLabel: 'PIN (min. 4 caratteri)',
    operatorNameRequired: 'Inserisci il nome dell’operatore.',
    operatorPinTooShort: 'Il PIN deve essere di almeno 4 caratteri.', wizardOperatorHint: 'Gli operatori accedono con nome + PIN. Puoi aggiungerne altri dopo.', sedeStats: '{operatori} operatori · {fornitori} fornitori', operatoriHeader: 'Operatori ({n})', sedeAccessCodeLabel: 'Codice accesso sede', sedePinHint: 'PIN numerico di 4 cifre. Lascia vuoto per disabilitare.', sedePinError4Digits: 'Il PIN di accesso sede deve essere di 4 cifre oppure vuoto.', changePinTitle: 'Cambia PIN', newPinFor: 'Nuovo PIN per {name}', operatoreRoleShort: 'Op.', adminSedeRoleShort: 'Resp.',     valutaFuso: 'Valuta e Fuso orario',
  },
  approvalSettings: {
    autoRegisterTitle: 'Registrazione automatica fatture AI',
    autoRegisterDescription:
      'Le fatture riconosciute con certezza dall’AI vengono registrate automaticamente senza conferma manuale.',
  },
  statements: {
    heading: 'Verifica Estratti Conto Mensili',
    tabVerifica: 'Estratti Conto',
    tabDocumenti: 'Documenti in attesa',
    schedaNavDaProcessareDesc: 'Allegati in arrivo: associa fornitori, bolle e fatture.',
    schedaNavVerificaDesc: 'Controllo mensile estratti conto vs bolle e fatture.',
    statusOk: 'OK',
    statusFatturaMancante: 'Fattura mancante',
    statusBolleManc: 'Bolle mancanti',
    statusErrImporto: 'Errore importo',
    statusRekkiPrezzo: 'Prezzo Rekki vs fattura',
    stmtReceived: 'Estratti conto ricevuti',
    stmtProcessing: 'Statement ancora in elaborazione — riprova tra qualche secondo.',
    stmtEmpty: 'Nessun estratto conto ricevuto',
    stmtEmptyHint: 'Gli estratti conto arrivano automaticamente via email.',
    btnSendReminder: 'Invia Sollecito',
    btnSending: 'Invio…',
    btnSent: 'Sollecitato ✓',
    btnClose: 'Chiudi',
    btnRefresh: 'Ricarica',
    btnAssign: 'Associa',
    btnDiscard: 'Scarta',
    btnAssigning: 'Associando…',
    colDate: 'Data',
    colRef: 'Rif. Documento',
    colAmount: 'Importo',
    colStatus: 'Stato',
    colAction: 'Azione',
    colInvoice: 'Fattura',
    colNotes: 'Bolle',
    classicHeading: 'Verifica Bolle/Fatture',
    classicComplete: 'Con Fattura',
    classicMissing: 'Senza Fattura',
    classicRequestAll: 'Richiedi tutte le fatture mancanti',
    classicRequesting: 'Invio in corso…',
    classicSent: 'Inviate ✓',
    classicRequestSingle: 'Richiedi fattura',
    migrationTitle: 'Come attivare la ricezione automatica degli Statement',
    migrationSubtitle: 'Crea le tabelle statements e statement_rows in 2 click:',
    migrationStep1: 'Clicca "Copia SQL" qui a destra',
    migrationStep2: 'Apri SQL Editor, incolla e clicca "Run"',
    migrationShowSQL: 'Mostra SQL completo ▸',
    migrationCopySQL: 'Copia SQL',
    migrationCopied: 'Copiato!',
    kpiOk: 'Verificati OK',
    kpiMissing: 'Con anomalie',
    kpiAmount: 'Importo totale',
    kpiTotal: 'Righe totali',
    months: ['Gennaio','Febbraio','Marzo','Aprile','Maggio','Giugno','Luglio','Agosto','Settembre','Ottobre','Novembre','Dicembre'],
    unknownSupplier: 'Fornitore sconosciuto',
    loadError: 'Impossibile caricare i risultati dello statement.',
    sendError: "Errore durante l'invio del sollecito.",
    tabPending: 'Da confermare',
    tabAll: 'Tutti',
    unknownSenderQuickStripTitle: 'Priorità: collega fornitore ({n})',
    unknownSenderQuickStripAria: 'Accesso rapido ai documenti senza fornitore collegato',
    unknownSenderQuickStripChipTitle: 'Vai al documento nella lista',
    emailSyncAutoSavedToday: '{n} salvati automaticamente oggi',
    bolleAperteOne: 'bolla aperta disponibile',
    bolleApertePlural: 'bolle aperte disponibili',
    tagStatement: 'Estratto mensile',
    tagStatementOk: 'Estratto ✓',
    tagPending: 'In attesa',
    tagBozzaCreata: '✦ Bozza creata',
    tagAssociated: 'Verificato',
    tagDiscarded: 'Scartato',
    labelReceived: 'Ricevuto:',
    labelDocDate: 'Data doc.:',
    openFile: 'Apri file →',
    reanalyzeDocButton: 'Rianalizza',
    reanalyzeDocTitle: 'Riesegue la lettura del documento e l’abbinamento al fornitore (email, P.IV.A, ragione sociale).',
    reanalyzeDocSuccess: 'Analisi aggiornata.',
    gotoFatturaDraft: 'Vai alla fattura bozza →',
    gotoBollaDraft: 'Vai alla bolla bozza →',
    toggleAddStatement: 'Aggiungi a estratto conto',
    toggleRemoveStatement: 'Rimuovi da estratto conto',
    docKindEstratto: 'Estratto',
    docKindBolla: 'Bolla',
    docKindFattura: 'Fattura',
    docKindOrdine: 'Ordine',
    docKindHintBolla: 'Segna come bolla di consegna (DDT), non estratto conto né fattura da incrociare',
    docKindHintFattura: 'Segna come fattura da associare alle bolle in attesa',
    docKindHintOrdine: 'Conferma d’ordine o documento commerciale: viene salvata nelle conferme ordine del fornitore (non bolla/fattura)',
    docKindGroupAria: 'Tipo di documento',
    finalizeNeedsSupplier: 'Associa un fornitore per finalizzare.',
    btnFinalizeFattura: 'Registra fattura (senza bolla)',
    btnFinalizeBolla: 'Crea bolla da allegato',
    btnFinalizeOrdine: 'Salva su fornitore (ordine)',
    btnFinalizeStatement: 'Archivia estratto',
    btnFinalizing: 'Finalizzazione…',
    finalizeSuccess: 'Documento registrato.',
    autoRegisterFatturaToast: 'Fattura #{numero} di {fornitore} registrata automaticamente',
    noPendingDocs: 'Nessun documento da esaminare',
    noDocsFound: 'Nessun documento trovato',
    noBolleAttesa: 'Nessuna bolla in attesa disponibile',
    bolleDaCollegamentiSectionTitle: 'Bolle da collegare',
    bollePendingNoneForThisSupplier: 'Nessuna bolla in sospeso per questo fornitore.',
    bollesSearchAcrossAllSuppliers: 'Cerca tra tutti i fornitori',
    bollesShowOnlyThisSupplier: 'Solo questo fornitore',
    bollesExtendedOtherSuppliersSubtitle: 'Altre bolle aperte (altri fornitori)',
    bollesMatchAssociateSupplierHint:
      'Associa un fornitore al documento per vedere qui le sue bolle in sospeso, oppure cerca nell’intera sede.',
    /** Lista bolle espansa senza fornitore sul documento: ricerca globale sede */
    bollesFullSiteListSubtitle: 'Tutta la sede',
    unknownSender: 'Mittente sconosciuto',
    sameAddressClusterHint:
      'Stesso indirizzo su altri documenti in coda. Nomi azienda letti dall’IA sulle altre righe: {names}. Probabile stesso fornitore (ragioni sociali diverse sul documento): associa la stessa anagrafica.',
    btnCreateSupplierFromAi: 'Crea fornitore →',
    docTotalLabel: 'Totale documento:',
    exactAmount: 'Importo esatto',
    exceeds: 'Eccedenza',
    missingAmt: 'Mancano',
    doneStatus: 'Completato ✓',
    errorStatus: 'Errore ✗',
    noBolleDelivery: 'Nessuna bolla di consegna trovata per questa fattura',
    bozzaCreataOne: 'bozza creata',
    bozzeCreatePlural: 'bozze create',
    bozzaBannerSuffix: "automaticamente dall'IA a partire dagli allegati email. Verifica i dati e conferma ogni documento.",
    kpiVerifiedOk: 'Verificate ✓',
    noEmailForSupplier: 'Nessuna email configurata per questo fornitore',
    reconcileCorrette: 'Corrette',
    reconcileDiscrepanza: 'Discrepanza',
    reconcileMancanti: 'Mancanti',
    reconcileHeading: 'Confronto estratto vs database',
    statusMatch: 'Corrispondente',
    statusMismatch: 'Discrepanza',
    statusMissingDB: 'Mancante nel DB',
    reconcileStatement: 'Estratto:',
    reconcileDB: 'DB:',
    loadingResults: 'Caricamento risultati…',
    editSupplierTitle: 'Modifica fornitore',
    supplierLinkFailed: 'Impossibile collegare il fornitore al documento.',
    assignFailed: 'Associazione alle bolle non riuscita.',
    autoLinkedSupplierOne: 'Fornitore collegato automaticamente: {name}.',
    autoLinkedSupplierMany: '{count} documenti collegati automaticamente ai fornitori.',
    bulkAutoMatchSummary:
      'Analisi completata: {linked} fornitore/i collegati, {associated} documento/i associati alle bolle.',
    bulkAutoMatchNone: 'Nessun abbinamento automatico applicabile ai documenti in elenco.',
    bulkAutoMatchButtonLabel: 'Abbina tutto',
    bulkAutoMatchButtonTitle:
      'Ricarica l’elenco e collega fornitori univoci; associa alle bolle quando l’importo del documento coincide con una o più bolle aperte.',
    bulkFinalizeToolbarGroupAria:
      'Conferma in blocco i documenti con tipo selezionato e fornitore collegato',
    bulkFinalizeKindTooltip:
      'Come il pulsante Conferma sulla riga: registra tutti i documenti in lista con tipo «{kind}» e fornitore già associato ({n}).',
    bulkFinalizeBulkOk: '{n} documenti confermati ({kind}).',
    bulkFinalizeBulkPartial: '{ok} confermati, {fail} non riusciti ({kind}).',
    ocrFormatToggleTitle: 'Forza interpretazione numerica alternativa',
    allBolleInvoicedOk: 'Tutte le bolle hanno una fattura corrispondente — estratto verificato ✓',
    aiStatementTotalLabel: 'Totale estratto (IA):',
    statementLinkedBolleLine: '{matched}/{total} bolle associate',
    selectedSumLabel: 'Selezionate:',
    selectedBolle_one: '({n} bolla)',
    selectedBolle_other: '({n} bolle)',
    receivedOn: 'Ricevuto il',
    stmtPdfDatesPrefix: 'Sul PDF',
    stmtPdfIssuedLabel: 'Emesso',
    stmtPdfLastPaymentLabel: 'Ultimo pagamento',
    stmtPdfSummaryTitle: 'Dati riportati sul PDF',
    stmtPdfMetaAccountNo: 'N. conto / codice',
    stmtPdfMetaIssuedDate: 'Data emissione',
    stmtPdfMetaCreditLimit: 'Plafond credito',
    stmtPdfMetaAvailableCredit: 'Credito disponibile',
    stmtPdfMetaPaymentTerms: 'Termini di pagamento',
    stmtPdfMetaLastPaymentAmt: 'Ultimo pagamento',
    stmtPdfMetaLastPaymentDate: 'Data ultimo pagamento',
    openPdf: 'Apri PDF ↗',
    reanalyze: 'Rianalizza',
    stmtListProcessing: 'Elaborazione…',
    stmtListParseError: 'Errore parsing',
    stmtRowsCount: '{n} righe',
    stmtAnomalies_one: '{n} anomalia',
    stmtAnomalies_other: '{n} anomalie',
    stmtBackToList: 'Torna alla lista',
    needsMigrationTitle: 'Tabelle non ancora create',
    needsMigrationBody:
      'Per attivare la ricezione automatica degli statement, esegui la migrazione SQL. Le istruzioni sono nella sezione Come attivare qui sotto.',
    stmtInboxEmailScanning: 'Analisi email in corso…',
    stmtInboxEmptyDetail:
      'Gli statement vengono rilevati automaticamente quando arriva una email con oggetto «Statement» o «Estratto Conto» con un allegato PDF.',
    bolleSummaryByPeriod: 'Riepilogo bolle per periodo',
    bollePeriodEmpty: 'Nessuna bolla nel periodo',
    clearFilter: 'Rimuovi filtro',
    rekkiCheckSegmentTooltip: 'Il prezzo fatturato non coincide con l\'ordine Rekki',
    tripleColStmtDate: 'Data estratto',
    tripleColSysDate: 'Data sistema',
    tripleColStmtAmount: 'Importo estratto',
    tripleColSysAmount: 'Importo sistema',
    tripleColChecks: 'Controlli',
    statusCheckPending: 'In attesa',
    statementVerifyBanner: 'Verifica estratto conto',
    badgeAiRecognized: 'AI OK',
    badgeAiRecognizedTitle:
      'Fornitore collegato. L’abbinamento automatico alle bolle richiede importi coerenti e date nei ±30 giorni dalla data documento oppure dalla data di ricezione in coda.',
    badgeNeedsHuman: 'Serve abbinamento',
    rememberAssociationTitle: 'Ricordare questa associazione per il futuro?',
    rememberAssociationSave: 'Salva email mittente',
    rekkiDocumentLink: 'Rekki',
  },
  appStrings: {
    brandFooter: 'Smart Pair · Gestione Acquisti',
    pageNotFoundTitle: 'Pagina non trovata',
    pageNotFoundDesc: 'Il collegamento potrebbe essere errato o la pagina è stata rimossa.',
    notFoundInAppTitle: 'Contenuto non disponibile',
    notFoundInAppDesc:
      'Il link non è valido, oppure la bolla o la fattura non esiste più o non è visibile con il tuo account (permessi o sede).',
    docUnavailableBollaTitle: 'Bolla non trovata',
    docUnavailableBollaDesc:
      'Non risulta alcuna bolla con questo link. Potrebbe essere stata eliminata, il link è errato, oppure non hai permesso di vederla da questa sede o con questo profilo.',
    docUnavailableFatturaTitle: 'Fattura non trovata',
    docUnavailableFatturaDesc:
      'Non risulta alcuna fattura con questo link. Potrebbe essere stata eliminata, il link è errato, oppure non hai permesso di vederla da questa sede o con questo profilo.',
    backToHome: 'Torna al riepilogo',
    sedeLockTitle: 'Accesso protetto',
    sedeLockDescription: 'La sede {name} richiede un PIN numerico a 4 cifre.',
    sedeLockCodeLabel: 'PIN (4 cifre)',
    sedeLockPlaceholder: '••••',
    sedeLockPinLengthError: 'Inserisci un PIN di 4 cifre.',
    sectionDates: 'Date',
    sectionCurrencyLabel: 'Valuta',
    loadingBolle: 'Caricamento bolle…',
    noOpenBolle: 'Nessuna bolla aperta per questo fornitore.',
    invoiceNumOptional: 'N° Fattura (opzionale)',
    uploadDateLabel: 'Data Registrazione',
    uploadDateAutomatic: 'automatica',
    registeredByFattura: 'Nome di chi ha registrato la fattura…',
    registeredByBolla: 'Nome di chi ha registrato la bolla…',
    saveCloseNBolle: 'Salva e chiudi {n} bolle',
    colDeliveryNoteNum: 'N° Bolla / DDT',
    colAmountShort: 'Importo',
    labelImportoTotale: 'Importo totale',
    labelPrezzoUnitario: 'Prezzo unitario',
    loadingPage: 'Caricamento…',
    noAttachment: 'Nessun allegato',
    camera: 'Fotocamera',
    chooseFile: 'Scegli file',
    uploading: 'Caricamento…',
    deleteLogConfirm: 'Eliminare questo log? L\'operazione è irreversibile.',
    imapConfigTitle: 'Configurazione email',
    imapLookbackLabel: 'Giorni di lookback email',
    imapLookbackLastDays: 'Legge email (lette e non lette) degli ultimi {n} giorni',
    imapLookbackUnlimited: 'Legge tutte le email in Posta in arrivo (lette e non lette, nessun limite di giorni)',
    imapLookbackFootnote: 'Lascia vuoto per nessun limite. Consigliato: 30–90 giorni.',
    emailSaved: 'Configurazione email salvata.',
    addOperatorsTitle: 'Aggiungi operatori',
    addOperatorBtn: 'Aggiungi operatore',
    savingShort: 'Salvo…',
    newSedeShort: 'Nuova',
    deleteUserConfirm: 'Eliminare l\'utente {email}? Questa azione è irreversibile.',
    deleteSedeConfirm: 'Elimina la sede "{nome}"? I dati collegati rimarranno ma perderanno il riferimento alla sede.',
    deleteFornitoreConfirm: 'Eliminare il fornitore "{nome}"? L\'operazione non è reversibile.',
    contactsHeading: 'Contatti',
    contactNew: 'Nuovo contatto',
    contactEdit: 'Modifica contatto',
    contactRemove: 'Rimuovi',
    contactRemovePrice: 'Rimuovi ultimo prezzo',
    noContacts: 'Nessun contatto registrato',
    infoSupplierCard: 'Scheda fornitore',
    contactsLegal: 'Sede legale',
    contactsFiscal: 'Dati fiscali',
    contactsPeople: 'Contatti',
    noContactRegistered: 'Nessun contatto registrato',
    noEmailSyncHint: 'Senza email lo scanner non potrà abbinare automaticamente i documenti di questo fornitore.',
    noEmailSyncWarning: 'Nessuna email associata — i documenti non saranno riconosciuti automaticamente.',
    filterNoEmail: 'Senza email',
    suggestEmailBtn: 'Cerca email',
    suggestEmailSearching: 'Ricerca in corso…',
    suggestEmailNoResults: 'Nessuna email trovata nei log esistenti.',
    suggestEmailSave: 'Aggiungi',
    suggestEmailSaved: 'Salvata',
    suggestEmailSourceLog: 'da log sync',
    suggestEmailSourceQueue: 'da coda documenti',
    suggestEmailSourceUnmatched: 'da P.IVA non abbinata',
    suggestEmailTitle: 'Email trovate nei documenti ricevuti',
    noAddressRegistered: 'Nessun indirizzo registrato',
    noFiscalRegistered: 'Nessun dato fiscale registrato',
    clientSince: 'Cliente dal',
    fromInvoiceBtn: 'Da Fattura',
    listinoAnalyze: 'Analizza',
    listinoAnalyzing: 'Analisi AI…',
    listinoInvoiceAnalyzedBadge: 'Analizzata',
    listinoNoInvoicesFile: 'Nessuna fattura con file allegato trovata per questo fornitore.',
    listinoNoProducts: 'Nessun prodotto trovato in questa fattura. Prova con un\'altra.',
    saveNProducts: 'Salva {n} prodotti',
    clickAddFirst: 'Clicca «Aggiungi» per inserire il primo prodotto.',
    monthNavResetTitle: 'Torna al mese corrente',
    monthNavPrevMonthTitle: 'Mese precedente',
    monthNavNextMonthTitle: 'Mese successivo',
    monthNavPrevYearTitle: 'Anno precedente',
    monthNavNextYearTitle: 'Anno successivo',
    supplierDesktopPeriodPickerTitle: 'Periodo (date)',
    supplierDesktopPeriodPickerButtonAria: 'Apri per impostare le date Da / A del periodo',
    supplierDesktopPeriodFromLabel: 'Da',
    supplierDesktopPeriodToLabel: 'A',
    supplierDesktopPeriodApply: 'Applica',
    addingAlias: 'Aggiunta…',
    addEmailAlias: '+ Aggiungi email',
    listinoImportPanelTitle: 'Importa prodotti da fattura',
    listinoImportSelectInvoiceLabel: 'Seleziona fattura',
    listinoImportProductsSelected: '{selected} / {total} prodotti selezionati',
    listinoImportPriceListDateLabel: 'Data listino',
    listinoImportColListinoDate: 'Ult. agg. listino',
    listinoImportDateOlderThanListinoHint:
      'Data documento anteriore all’ultimo aggiornamento: la riga non viene importata senza forzatura.',
    listinoImportApplyOutdatedAdmin: 'Applica come prezzo attuale',
    listinoImportApplyOutdatedAdminActive: 'Forzatura attiva',
    listinoImportForceAllSelected: 'Forza importazione per tutte le righe selezionate',
    listinoImportPartialSaved:
      'Salvate {inserted} righe; {skipped} non importate (prodotti: {products}). Controlla le date o usa la forzatura su ciascuna riga.',
    listinoManualDateBlockedHint:
      'La data scelta è precedente all’ultimo aggiornamento listino registrato per questo nome prodotto.',
    listinoManualDateBlockedNoAdmin: 'Solo un amministratore può forzare l’inserimento con data antecedente.',
    listinoImportSaveBlockedHintAdmin:
      'Attiva «Applica come prezzo attuale» sulle righe evidenziate per includerle nel salvataggio.',
    listinoImportSaveBlockedHintOperator:
      'Alcune righe selezionate hanno data documento anteriore al listino: attiva «Applica come prezzo attuale» riga per riga, oppure «Forza importazione per tutte le righe selezionate», oppure deselezionale.',
    listinoDocDetailImportHint:
      'L’import listino (tab Listino del fornitore) confronta la data documento con l’ultimo aggiornamento salvato per ogni prodotto: date più vecchie non sostituiscono automaticamente il prezzo corrente.',
    listinoDocDetailImportHintAdmin:
      'In import da fattura puoi forzare l’inserimento riga per riga con il pulsante dedicato.',
    listinoDocRowBlockedBadge: 'Listino più recente',
    listinoDocForceButton: 'Forza aggiornamento listino',
    listinoDocForceWorking: 'Salvataggio…',
    listinoDocForceOk: 'Prezzo registrato con la data del documento.',
    listinoDocForceErr: 'Impossibile applicare la forzatura.',
    discoveryCreateSupplier: 'Crea nuovo fornitore',
    discoveryCompanyName: 'Ragione sociale *',
    discoveryEmailDiscovered: 'Email (rilevata)',
    discoveryVat: 'Partita IVA',
    discoveryBranch: 'Sede',
    discoveryBreadcrumbSettings: 'Impostazioni',
    discoveryTitle: 'Esplora posta in arrivo',
    discoveryNoImap: 'Nessun account IMAP configurato',
    discoveryNoImapHint: 'Configura le credenziali IMAP nelle impostazioni della sede',
    discoveryPartialScan: 'Scansione parziale — alcune caselle hanno avuto errori:',
    discoveryAllRegistered: 'Tutti i mittenti sono già registrati',
    discoveryNoUnknown: 'Nessun mittente sconosciuto con allegati negli ultimi 30 giorni.',
    discoveryReady: 'Pronto per la scansione',
    discoveryReadyHint: 'Clicca Scansione posta per analizzare gli ultimi 30 giorni di email e scoprire potenziali nuovi fornitori.',
    discoveryScanBtn: 'Scansione posta',
    toastDismiss: 'Chiudi notifica',
    countrySaving: 'Salvataggio…',
    countrySaved: 'Salvato',
    sidebarSediTitle: 'Sedi',
    deleteGenericConfirm: 'Eliminare questo elemento? L\'operazione è irreversibile.',
    deleteFailed: 'Errore durante l\'eliminazione:',
    errorGenericTitle: 'Si è verificato un errore',
    errorGenericBody: 'Un errore imprevisto ha interrotto l\'applicazione. Riprova o torna alla home.',
    tryAgain: 'Riprova',
    errorCodeLabel: 'Codice errore:',
    errorSegmentTitle: 'Errore durante il caricamento',
    errorSegmentBody: 'Non è stato possibile caricare questa sezione. Riprova o torna alla pagina precedente.',
    errorDevDetailsSummary: 'Dettagli errore (solo sviluppo)',
    errorFatalTitle: 'Errore critico',
    errorFatalBody: 'L\'applicazione ha riscontrato un problema imprevisto.',
    approvazioni_pageSub: 'Fatture in attesa di approvazione sopra soglia',
    analyticsPageSub: 'Panoramica acquisti e riconciliazione',
    analyticsMonths: '{n} mesi',
    attivitaPageTitle: 'Registro Attività',
    attivitaPageSub: 'Storico completo delle operazioni degli operatori',
    attivitaExportCsv: 'Esporta CSV',
    attivitaAllOperators: 'Tutti gli operatori',
    attivitaRemoveFilters: 'Rimuovi filtri',
    analyticsErrorLoading: 'Errore caricamento dati',
    analyticsNoData: 'Nessun dato disponibile.',
    analyticsKpiTotalInvoiced: 'Totale fatturato',
    analyticsKpiNFatture: '{n} fatture',
    analyticsKpiReconciliation: 'Riconciliazione',
    analyticsKpiCompleted: '{n} completate',
    analyticsKpiAvgTime: 'Tempo medio riconciliazione',
    analyticsKpiDays: '{n} gg',
    analyticsKpiDaysFrom: 'giorni dalla bolla alla fattura',
    analyticsKpiSlow: 'lento',
    analyticsKpiOk: 'ok',
    analyticsKpiPriceAnomalies: 'Anomalie prezzi',
    analyticsKpiResolvedOf: '{n} risolte su {total}',
    analyticsKpiToCheck: 'da verificare',
    analyticsKpiAllOk: 'tutto ok',
    analyticsChartMonthlySpend: 'Spesa mensile',
    analyticsChartAmount: 'Importo',
    analyticsChartInvoices: 'Fatture',
    analyticsChartTopSuppliers: 'Top fornitori',
    analyticsChartNoData: 'Nessun dato',
    analyticsChartBolleVsFatture: 'Bolle vs Fatture',
    analyticsChartDeliveryNotes: 'Bolle',
    analyticsSummaryPendingDocs: 'Documenti pendenti',
    analyticsSummaryPendingNotes: 'Bolle in attesa',
    analyticsSummaryArchivedInvoices: 'Fatture archiviate',
    approvazioni_noPending: 'Nessuna fattura in attesa',
    approvazioni_allReviewed: 'Tutte le fatture sopra soglia sono state revisionate.',
    approvazioni_viewInvoice: 'Vedi fattura →',
    approvazioni_rejectReason: 'Motivo rifiuto (opzionale)',
    approvazioni_rejectPlaceholder: 'Es: importo non corrisponde alla bolla...',
    approvazioni_confirmReject: 'Conferma rifiuto',
    approvazioni_approve: 'Approva',
    approvazioni_reject: 'Rifiuta',
    approvazioni_threshold: 'soglia',
    attivitaFilterAll: 'Tutti',
    attivitaFilterBolle: 'Bolle',
    attivitaFilterFatture: 'Fatture',
    attivitaFilterDocumenti: 'Documenti',
    attivitaFilterOperatori: 'Operatori',
    attivitaError: 'Impossibile caricare le attività.',
    attivitaNoRecent: 'Nessuna attività recente',
    attivitaRecentTitle: 'Attività recente',
    rekkiSyncTitle: 'Sincronizzazione Email Rekki',
    rekkiSyncDesc: 'Scansiona la casella email della sede e abbina automaticamente gli ordini Rekki',
    rekkiSyncMobileTap: 'Sincronizza Email Rekki',
    rekkiSyncNeverRun: 'Mai eseguita',
    rekkiSyncTapUpdate: 'tocca per aggiornare',
    rekkiSyncTapStart: 'tocca per avviare',
    rekkiSyncButtonLabel: 'SCANSIONA BOLLA / FATTURA',
    rekkiSyncInProgress: 'Scansione in corso',
    rekkiSyncProcessing: 'Elaborazione email Rekki…',
    rekkiSyncStop: 'Stop',
    rekkiSyncCheckNow: 'Controlla ora',
    rekkiSyncStarting: 'Avvio scansione...',
    rekkiSyncDays: '{n} giorni',
    rekkiSyncLastScan: 'Ultima scansione',
    rekkiSyncEmails: 'Email',
    rekkiSyncDocuments: 'Documenti',
    rekkiSyncMatched: 'Abbinati',
    rekkiSyncUnmatched: 'Da abbinare',
    rekkiSyncRecentEmails: 'Ultime email elaborate',
    rekkiSyncNoData: 'Nessun prezzo rilevato',
    rekkiSyncNoDataDesc: 'Premi «Controlla ora» per scansionare le email Rekki di {nome}',
    rekkiImapNotConfigured: 'Casella email non configurata',
    rekkiImapNotConfiguredDesc: 'Configura le credenziali IMAP in Impostazioni → Sede per abilitare la sincronizzazione.',
    rekkiPhaseQueued: 'In coda...',
    rekkiPhaseConnect: 'Connessione alla casella email...',
    rekkiPhaseSearch: 'Ricerca email Rekki...',
    rekkiPhaseProcess: 'Elaborazione email...',
    rekkiPhasePersist: 'Salvataggio dati...',
    rekkiPhaseDone: 'Completato',
    rekkiPhaseError: 'Errore',
    rekkiDoneResult: 'Completato — {n} email elaborate',
    rekkiErrUnknown: 'Errore sconosciuto',
    rekkiErrNetwork: 'Errore di rete',
    analyticsSinceFY: 'da inizio FY',
    backupPageTitle: 'Backup Dati',
    backupPageDesc: 'Esportazioni CSV automatiche settimanali · Ogni lunedì alle 02:00 UTC',
    auditTitle: 'Audit Recupero Crediti',
    auditDesc: 'Analizza tutte le fatture storiche per identificare sovraprezzi rispetto ai prezzi Rekki pattuiti',
    auditDateFrom: 'Da',
    auditDateTo: 'A',
    auditRunBtn: 'Esegui Audit',
    auditRunning: 'Analisi in corso...',
    auditSyncConfirm: 'Questa operazione analizzerà tutte le fatture storiche e aggiornerà le date di riferimento nel listino. Procedere?',
    auditSyncTitle: 'Sincronizza Storico con Rekki',
    auditSyncDesc: 'Analizza tutte le fatture passate e aggiorna automaticamente le date di riferimento per eliminare i blocchi «Data documento anteriore»',
    auditSyncBtn: 'Sincronizza',
    auditSyncing: 'Sync...',
    auditKpiSpreco: 'Spreco Totale',
    auditKpiAnomalies: 'Anomalie',
    auditKpiProducts: 'Prodotti',
    auditKpiFatture: 'Fatture',
    auditNoOvercharges: 'Nessun sovrapprezzo rilevato!',
    auditNoOverchargesDesc: 'Tutti i prezzi fatturati sono in linea o inferiori a quelli Rekki pattuiti',
    auditColFattura: 'Fattura',
    auditColProdotto: 'Prodotto',
    auditColPagato: 'Pagato',
    auditColPattuito: 'Pattuito',
    auditColSpreco: 'Spreco',
    auditHelpTitle: "Come funziona l'audit?",
    auditHelpP1: "L'audit analizza tutte le fatture nel periodo selezionato e:",
    auditHelpLi1: 'Estrae i line items da ogni fattura usando AI',
    auditHelpLi2: 'Confronta i prezzi pagati con i prezzi Rekki pattuiti (listino)',
    auditHelpLi3: 'Identifica tutti i casi in cui è stato pagato un prezzo superiore',
    auditHelpLi4: 'Calcola lo spreco totale basandosi sulla quantità acquistata',
    auditHelpCta: '💡 Usa questo report per richiedere note di credito al fornitore',
    auditErrStatus: 'Errore {status}',
    auditErrGeneric: "Errore durante l'audit",
    auditErrSync: 'Errore durante la sincronizzazione',
    auditCsvDate: 'Data',
    auditCsvInvoiceNum: 'Numero Fattura',
    auditCsvProduct: 'Prodotto',
    auditCsvRekkiId: 'Rekki ID',
    auditCsvPaid: 'Pagato',
    auditCsvAgreed: 'Pattuito',
    auditCsvDiffPct: 'Differenza %',
    auditCsvQty: 'Quantità',
    auditCsvWaste: 'Spreco',
    sedeErrCreating: 'Errore nella creazione della sede.',
    sedeErrSavingProfile: 'Errore salvataggio profilo.',
    sedePinUpdated: 'PIN aggiornato.',
    sedeErrUpdatingPin: "Errore durante l'aggiornamento del PIN.",
    sedeErrSavingPin: 'Errore salvataggio PIN sede.',
    sedeLocSaved: 'Localizzazione salvata.',
    sedeErrLoadData: 'Errore caricamento dati.',
    sedeErrUpdating: 'Errore aggiornamento sede.',
    sedeUpdated: 'Sede aggiornata.',
    sedeDeleted: 'Sede eliminata.',
    sedeErrSavingImap: 'Errore salvataggio IMAP.',
    sedeWizardStepOf: 'Passo {step} di 3',
    sedeWizardNext: 'Avanti',
    sedeWizardBack: '← Indietro',
    sedeWizardSkip: 'Salta',
    sedeWizardNameLabel: 'Nome della sede',
    sedeWizardEmailConfigTitle: 'Configurazione email',
    sedeWizardEmailConfigDesc: 'Per ricevere fatture via email. Puoi configurarla anche dopo.',
    sedeWizardAppPassRequired: 'App Password richiesta.',
    sedeWizardAddOperatorsTitle: 'Aggiungi operatori',
    sedeWizardAddOperatorsDesc: 'Gli operatori accedono con nome + PIN (min. 4 cifre).',
    sedeWizardCreateBtn: 'Crea sede + {n} operatori',
    sedeWizardCreatingBtn: 'Creazione…',
    sedeWizardStartSetup: 'Avvia setup guidato',
    sedeEmailNotConfigured: 'Email non config.',
    sedeCreatedSuccess: 'Sede "{nome}" creata con successo.',
    gmailBadgeTitle: '💡 Pronto per l\'audit dei prezzi?',
    gmailBadgeDescConfigured: 'Gmail API è configurato! Connetti il tuo account per attivare lo scanner automatico e recuperare potenziali rimborsi su {nome}.',
    gmailBadgeDescNotConfigured: 'Configura Gmail (2 minuti) per analizzare automaticamente le email di {nome} e identificare overcharges non autorizzati.',
    gmailBadgeCTAConnect: 'Connetti e Scansiona',
    gmailBadgeCTASetup: 'Configura Ora',
    gmailBadgeDismiss: 'Nascondi',
    gmailBadgeAPIConfigured: 'API Configurato',
    gmailBadgeConnectAccount: 'Connetti Account',
    gmailBadgePriceCheck: 'Controllo Prezzi',
    gmailBadgePriceCheckSub: 'Auto anomalie',
    gmailBadgeRecoverySub: 'Storico 2 anni',
    autoSyncTitle: 'Auto-Sync Fattura',
    autoSyncDesc: 'Estrai e confronta automaticamente i prodotti dalla fattura con il listino',
    autoSyncBtn: 'Analizza Fattura',
    autoSyncBtnLoading: 'Analisi in corso...',
    autoSyncTotal: 'Totale',
    autoSyncAnomalies: 'Anomalie',
    autoSyncNewItems: 'Nuovi',
    autoSyncProduct: 'Prodotto',
    autoSyncPrice: 'Prezzo',
    autoSyncNewItem: 'Nuovo',
    autoSyncAnomalyWarning: '{n} prodotto{s} con rincaro anomalo',
    autoSyncConfirmBtn: 'Conferma {n} prodotti',
    autoSyncImporting: 'Importazione...',
    autoSyncErrAnalysis: "Errore durante l'analisi",
    autoSyncErrImport: "Errore durante l'importazione",
  },
}

const en: Translations = {
  ui: {
    tagline:          'Purchase Management',
    closeMenu:        'Close menu',
    expandSidebar:    'Expand sidebar',
    navMore:            'More',
    collapseSidebar:  'Collapse sidebar',
    changeOperator:   'Change operator',
    changeOperatorShort: 'Switch',
    selectOperator:   'Select operator',
    activeOperator:   'Active',
    noOperator:       'None',
    operatorLabel:    'Active user',
    operatorChanged:  'Operator switched successfully',
    noOperatorsFound: 'No operators found for this location.',
    noSedeForOperators: 'No location is linked. Add a location under Locations or link your admin profile to a location.',
    currentlyActive:  'Active:',
    languageTooltip:  'Language',
    syncError:        'Error during email scan.',
    syncSuccess:      'Sync completed.',
    networkError:     'Network error. Please try again.',
    connectionOnline: 'Online',
    connectionOffline: 'Offline',
    connectionReconnecting: 'Reconnecting…',
    emailSyncResumed: 'Back online — email sync restarted.',
    emailSyncStreamIncomplete:
      'Sync did not finish (connection closed early). Please try again.',
    emailSyncAlreadyRunning:
      'Sync is already running. Wait for it to finish or cancel it from the bar at the top.',
    emailSyncCancelled: 'Email sync stopped.',
    reminderError:    'Error sending reminders.',
    noReminders:      'No reminders to send (suppliers without email?).',
    remindersCount:   'reminder',
    remindersSentOne: '1 reminder sent out of {total}.',
    remindersSentMany: '{n} reminders sent out of {total}.',
    pinError:         'Incorrect code.',
    operatorPinStepUpTitle: 'Operator confirmation',
    operatorPinStepUpHint: 'Enter the active operator’s 4-digit code to authorise this change.',
    operatorPinStepUpNoActive:
      'No active operator in this session. Use the button below (or the bottom bar on mobile / sidebar menu), pick who is operating, then enter the PIN.',
    operatorPinStepUpChooseOperator: 'Choose operator',
    verifyAndContinue: 'Continue',
    operatorAutoLockLabel: 'Auto-lock after',
    operatorAutoLockNever: 'Off',
    operatorAutoLockMinutes: '{n} min',
    sidebarSedeActive: 'Active location: {name}',
    sidebarSedeSwitchTo: 'Switch to: {name}',
    sidebarSedeSettings: '{name} settings',
    appBuildLine: 'v{version} · {commit} · {env}',
    appBuildLineLocal: 'v{version} · {commit}',
    appBuildNoCommit: '—',
    appBuildAria: 'App version and deployment build',
    deployEnvLocal: 'local',
    deployEnvProduction: 'production',
    deployEnvPreview: 'preview',
    deployEnvDevelopment: 'development',
  },
  login: {
    brandTagline: 'Branch Management',
    subtitle: 'Branch Access · enter your name and 4-digit PIN',
    adminSubtitle: 'Management Portal',
    adminSubtitleHint:
      'Admin email & password for the Management Portal. For staff access use Branch Access below.',
    nameLabel: 'Staff Name',
    namePlaceholder: '',
    pinLabel: 'Staff PIN',
    pinDigits: '(4 digits)',
    lookingUp: 'Looking up…',
    enterFirstName: 'Enter name and press Tab',
    emailLabel: 'Email',
    emailPlaceholder: 'admin@company.com',
    passwordLabel: 'Password',
    passwordPlaceholder: 'Min. 6 characters',
    loginBtn: 'Sign In',
    adminLink: 'Management Portal →',
    operatorLink: '← Branch Access',
    pinIncorrect: 'Incorrect PIN. Please try again.',
    invalidCredentials: 'Invalid credentials.',
    verifying: 'Verifying…',
    accessing: 'Signing in…',
    notFound: 'Staff member not found.',
    adminOnlyEmail: 'Management Portal is for administrators only. Use Branch Access or request an admin account.',
    adminGateLabel: 'Admin Access Code',
    adminGateHint: 'Enter your access code to unlock the login fields.',
    adminGateWrong: 'Invalid code.',
    sessionGateTitle: 'Confirm Access',
    sessionGateSubtitle: 'New browser session — re-enter your name and 4-digit PIN to continue.',
    sessionGateWrongUser: 'This name does not match the signed-in account.',
    sessionBootStuck: 'The session did not load in time. Please sign in again.',
    netflixTitle: "Who's on shift?",
    netflixSubtitle: 'Tap your name to sign in',
    netflixManualLogin: "Can't find your name? Sign in manually →",
    netflixChangeOperator: '← Change operator',
    deviceTrustTitle: 'Sign in automatically on this device next time?',
    deviceTrustYes: 'Yes, remember me',
    deviceTrustNo: 'No thanks',
    deviceWelcomeBack: 'Welcome back, {name}!',
    deviceWelcomeAccediHint: 'Device recognised — continue when you are ready.',
    accessoSwitchOperator: 'Switch operator',
  },
  nav: {
    dashboard: 'Dashboard',
    dashboardAdmin: 'Admin',
    operatori: 'Operators',
    fornitori: 'Suppliers',
    bolle: 'Delivery Notes',
    fatture: 'Invoices',
    ordini: 'Orders',
    archivio: 'Archive',
    logEmail: 'Email Log',
    sedi: 'Location & Users',
    sediTitle: 'Branch',
    sediNavGroupMaster: 'Locations',
    gestisciSedeNamed: 'Manage {name}',
    gestisciSedi: 'Manage locations',
    tuttiFornitori: 'All suppliers',
    cerca: 'Search…',
    nessunRisultato: 'No results',
    altriRisultati: 'more — search above',
    impostazioni: 'Settings',
    nuovaBolla: 'New Delivery Note',
    ricevuto: 'Receipt',
    operatorActiveHint: "Who's operating? Tap to set",
    esci: 'Sign Out',
    guida: 'Help',
    sedeGlobalOverview: 'Global overview',
    bottomNavBackToSede: 'Back to branch',
    bottomNavScannerAi: 'AI Scanner',
    bottomNavProfile: 'Profile',
    bottomNavSediMap: 'Branch map',
    bottomNavGlobalReports: 'Global reports',
    bottomNavNewOrder: 'New order',
    bottomNavPriceHistory: 'Price history',
    bottomNavContact: 'Contact',
    addNewDelivery: 'New delivery note',
    openRekki: 'Rekki',
    ariaMain: 'Main navigation',
    ariaAdmin: 'Administrator navigation',
    ariaFornitore: 'Supplier navigation',
    ariaCallSupplier: 'Call supplier',
    notifications: 'Notifications',
    noNotifications: 'No notifications',
    errorAlert: 'Sync errors (24h)',
    analytics: 'Analytics',
    approvazioni: 'Approvals',
    attivita: 'Activity',
    backup: 'Backup',
    consumiAi: 'AI Usage',
    strumenti: 'Tools',
  },
  strumentiCentroOperazioni: {
    pageTitle: 'Operations hub',
    pageSubtitle:
      'Quick access to OCR, duplicates, supplier matching and price list tools. Buttons on individual document pages remain available.',
    breadcrumbTools: 'Tools',
    sectionOcr: 'OCR & documents',
    sectionDup: 'Duplicates & cleanup',
    sectionListino: 'Price list & prices',
    cardReanalyzeTitle: 'Re-run OCR (queue & AI)',
    cardReanalyzeDesc:
      'Pending documents, AI classification and Gemini suggestions — same as AI Inbox. On a single delivery note or invoice, use “Re-run (OCR)” on the row.',
    cardOpenInbox: 'Open AI Inbox',
    cardRefreshDateTitle: 'Re-read date from attachment',
    cardRefreshDateDesc: 'Open an invoice and use “Re-read date” next to the document date (needs an attachment).',
    cardOpenFatture: 'Open invoices',
    cardOcrCheckTitle: 'Supplier OCR check',
    cardOcrCheckDesc:
      'On a supplier profile (desktop) the “OCR check” button bulk re-checks OCR for suspicious-looking dates.',
    cardOpenFornitoreSheet: 'Open suppliers',
    cardDupScanTitle: 'Find duplicate invoices',
    cardDupScanDesc: 'Same scan as the dashboard toolbar: same supplier, same date and same invoice number.',
    cardDupManageTitle: 'Duplicate management',
    cardDupManageDesc: 'Delivery notes, invoices and suppliers: scan groups and merge or delete copies.',
    cardDupManageCta: 'Open duplicate manager',
    cardAuditTitle: 'Supplier attachment audit',
    cardAuditDesc: 'Align sender email with assigned suppliers — “Matching” tab in AI Inbox.',
    cardOpenAudit: 'Open Matching tab',
    cardListinoAutoTitle: 'Automatic list price refresh (Auto)',
    cardListinoAutoDesc: 'On the supplier Price list tab: automatically analyse invoices not processed yet.',
    cardListinoFromInvTitle: 'Import prices “From invoice”',
    cardListinoFromInvDesc: 'On the Price list tab: pick an invoice with a PDF and confirm items to import.',
    cardListinoAddTitle: 'Add product to price list',
    cardListinoAddDesc: 'On the Price list tab: Add button for manual entry (desktop).',
    cardListinoCta: 'Go to suppliers — Price list tab',
    manualImapSyncTitle: 'Email sync — 24 h window',
    manualImapSyncDesc:
      'Searches the inbox for roughly the last 24 hours of messages. The scheduled cron uses a 3-hour window instead.',
    historicSyncSectionLabel: 'Historic sync (previous year)',
    historicSyncTitle: 'Import previous-year data',
    historicSyncDesc:
      'Downloads mail from roughly the last 365 days so you can compare with fiscal year 2025/26.',
    historicSyncWarning: '⚠️ Slow operation — may take several minutes. Run only once.',
    historicSyncCta: 'Start historic sync',
    historicSyncResult: '{n} documents imported from the previous year',
    historicSyncProgress: 'Processing: {label}…',
    historicSyncCompleted: 'Completed!',
    hintContextualShortcuts:
      'Reminder: row-level “Re-run (OCR)” on a delivery note / invoice, “Move to Invoices” on a note, “From invoice” / “Auto” / “Add” stay on the price list.',
  },
  common: { save: 'Save', cancel: 'Cancel', delete: 'Delete', edit: 'Edit', new: 'New', loading: 'Loading...', error: 'Error', success: 'Success', noData: 'No data', document: 'Document', actions: 'Actions', date: 'Date', status: 'Status', supplier: 'Supplier', notes: 'Notes', phone: 'Phone', saving: 'Saving...', attachment: 'Attachment', openAttachment: 'Open attachment', detail: 'Detail', add: 'Add', rename: 'Rename', role: 'Role', aiExtracted: 'AI Extracted Data', matched: 'Matched', notMatched: 'Not matched', recordSupplierLinked: 'Linked', company: 'Company', invoiceNum: 'Invoice No.', documentRef: 'Reference', total: 'Total', duplicateBadge: 'DUPLICATE', emailSyncAutoSavedBadge: 'Auto-saved', viewerZoomIn: 'Zoom in', viewerZoomOut: 'Zoom out', viewerZoomReset: '100%', viewerZoomHint: 'Ctrl+scroll or buttons' },
  status: { inAttesa: 'Pending', completato: 'Completed', completata: 'Completed' },
  dashboard: { title: 'Dashboard', suppliers: 'Suppliers', totalBills: 'Total delivery notes', pendingBills: 'Pending notes', invoices: 'Invoices', recentBills: 'Recent delivery notes', recentBillsMobileListDisabled: 'The detailed list is not shown on this screen. Use “View all” to open the archive or switch to a larger display.', viewAll: 'View all →', syncEmail: 'Sync Email', emailSyncScopeLookback: 'Recent days (location lookback)', emailSyncScopeFiscal: 'Fiscal year', emailSyncFiscalYearSelectAria: 'Email sync period', emailSyncScopeHint: 'IT, FR, DE, ES: calendar year. UK: tax year ending 5 April. Each location uses its own country.', emailSyncLookbackSedeDefault: 'Location default (IMAP)', emailSyncLookbackDaysN: 'Last {n} days', emailSyncLookbackDaysAria: 'How far back to search the mailbox', emailSyncLookbackDaysHint: 'Location default uses the days set on the branch. Otherwise limit the IMAP search to the last N days (read and unread).', emailSyncDocumentKindAria: 'Document types to import when syncing email', emailSyncDocumentKindHint: 'All: default. New supplier: only senders not in your directory. Delivery note / Invoice: force draft type. Statement: only emails whose subject looks like a bank/supplier statement.', emailSyncDocumentKindAll: 'All documents', emailSyncDocumentKindFornitore: 'New supplier', emailSyncDocumentKindBolla: 'Delivery note (DDT)', emailSyncDocumentKindFattura: 'Invoice', emailSyncDocumentKindEstratto: 'Statement', syncing: 'Syncing...', sendReminders: 'Send reminders', sending: 'Sending...', viewLog: 'View Log', sedeOverview: 'Overview by Location', manageSedeNamed: 'Manage {name} →', manageSedi: 'Manage locations →', sedeImapOn: 'Email active', digitalizzaRicevuto: 'Digital receipt', scannerFlowCardTitle: 'Scanner — today', scannerFlowCardHint: 'PDFs processed by AI and documents saved from this branch today (your timezone).', scannerFlowAiElaborate: 'AI processed', scannerFlowArchived: 'Archived', scannerFlowOpenScanner: 'New scan', scannerFlowBolleHubTitle: 'Delivery notes archive', scannerFlowRecentTitle: 'Recent Scanner AI activity', scannerFlowNoRecent: 'No recent scan events. Use Scanner AI in the bottom bar or start a new scan.', scannerFlowTodayCounts: 'Today: {ai} AI processed · {arch} archived', scannerFlowFiscalPeriodLine: 'Fiscal year {year}', scannerFlowCardHintFiscal: 'Counts use events recorded in app for this fiscal year (same as the selector at the top), not only today.', scannerFlowDetailListCountRange: '{n} documents in the period', scannerFlowDetailListCountToday: '{n} documents today', scannerFlowDetailEmptyRange: 'No documents in this period.', scannerFlowStepAiElaborata: 'PDF processed by AI — text and fields extracted (OCR)', scannerFlowStepArchiviataBolla: 'Delivery note saved to the archive', scannerFlowStepArchiviataFattura: 'Invoice saved to the archive', scannerFlowTodayActivityTitle: 'What happened today', scannerFlowNoEventsToday: 'No Scanner AI activity recorded for this branch today yet.', scannerFlowEventsAllLink: 'Full event log →', scannerFlowEventsPageTitle: 'Scanner AI — events', scannerFlowEventsEmpty: 'No Scanner events recorded yet.', scannerFlowEventsPrev: 'Previous', scannerFlowEventsNext: 'Next', scannerFlowEventsPageOf: 'Page {current} of {pages}', scannerMobileTileTap: 'Tap to start', duplicateFattureScanButton: 'Find duplicate invoices', duplicateFattureToolbarShort: 'Duplicates', sendRemindersToolbarShort: 'Reminders', syncEmailToolbarShort: 'Sync Email', emailSyncCronLine: '🟢 Auto sync — last: {relative}', emailSyncCronIssueLine: '⚠️ IMAP issue — last: {relative}', emailSyncCronNever: 'never yet', emailSyncCronJustNow: 'just now', emailSyncCronMinutesAgo: '{n} min ago', emailSyncCronHoursAgo: '{n} h ago', emailSyncCronLateLine: '🟡 Sync behind — last: {relative}', emailSyncCronStoppedLine: '🔴 Sync stalled — last: {relative}', emailSyncForceSync: 'Force sync', emailSyncEmergencyToolsAria: 'Tools — run manual email sync (emergency)', duplicateFattureModalTitle: 'Duplicate invoices', duplicateFattureScanning: 'Scanning invoices…',
    duplicateFattureScanningBatch: 'Latest batch read from the database',
    duplicateFattureScanningAwaitingRows: 'Waiting for the first rows from the database (the first batch can take a while with many invoices).', duplicateFattureNone: 'No duplicates found. We match same supplier, same document date and same invoice number (only rows with a number).', duplicateFattureError: 'Could not complete the scan. Try again shortly.', duplicateFattureGroupCount: '{n} copies', duplicateFattureSedeUnassigned: 'No branch', duplicateFattureTruncated: 'Scan limited to the first 50,000 visible invoices; the result may be incomplete.', duplicateFattureClose: 'Close', duplicateFattureRowsAnalyzed: '{n} invoices analyzed', duplicateFattureDeleteConfirm: 'Delete this invoice? Other copies in this group stay saved. This cannot be undone.', duplicateFattureDeleteAria: 'Delete this duplicate copy', duplicateDashboardBanner_one: 'Detected {n} duplicate — Click to manage', duplicateDashboardBanner_other: 'Detected {n} duplicates — Click to manage', kpiFiscalYearFilter: 'KPI period (fiscal year)', kpiFiscalYearFilterAria: 'Filter counts for delivery notes, invoices, orders, price list and statements by fiscal year', workspaceQuickNavAria: 'Quick links to branch workspace sections (same destinations as the KPI tiles below)', desktopHeaderSedeToolsMenuTrigger: 'Tools', desktopHeaderSedeToolsMenuAria: 'Panel: find duplicate invoices, send reminders and sync email from the mailbox', desktopHeaderSedeToolsMenuTriggerAriaReminders: 'Reminders: {n} suppliers with delivery notes due soon', kpiNoPendingBills: 'No pending delivery notes.', kpiOperatorOfflineOverlayTitle: 'Sync paused', kpiOperatorOfflineOverlayHint: 'You appear offline: KPI card links are disabled until the connection is back.', kpiListinoAnomaliesCountLine: '{n} price anomalies detected', kpiBollePendingListCta: 'View {n} pending →', kpiDuplicateInvoicesDetected: '⚠️ {n} duplicate invoices detected',
    kpiDuplicateBolleDetected: '⚠️ {n} duplicate delivery notes detected',
    kpiDocumentiDaRevisionareTitle: 'Documents to review',
    kpiDocumentiDaRevisionareSub: 'Duplicates, unknown senders and Rekki price anomalies',
    inboxUrgentePageTitle: 'Urgent inbox',
    inboxUrgentePageIntro:
      'One place for operational issues: documents to match, price anomalies and duplicates to check in your lists.',
    inboxUrgenteNavDocQueue: 'Email document queue',
    inboxUrgenteNavPriceAnomalies: 'Verification — Rekki price anomalies',
    inboxUrgenteNavInvoices: 'Invoices (duplicates)',
    inboxUrgenteNavBolle: 'Delivery notes (duplicates)',
    inboxUrgenteNavOrdini: 'Orders (duplicates)',
    inboxUrgenteNavAiInbox: 'AI Inbox (queue + duplicates)',
    errorCountSuffix: 'errors', manualReceiptLabel: 'Received (no delivery note)', manualReceiptPlaceholder: 'e.g. 5 kg squid, 2 crates lemons', manualReceiptRegister: 'Register delivery', manualReceiptRegistering: 'Saving…', manualReceiptSaved: 'Delivery registered.', manualReceiptNeedTextOrPhoto: 'Enter a description or attach a photo.', manualReceiptRemovePhoto: 'Remove photo', manualReceiptNeedSupplier: 'Select a supplier.', manualReceiptRegisterFailed: 'Registration failed.', manualReceiptEmailSupplierLabel: 'Email the supplier to request the purchase order and delivery note (DDT)', manualReceiptEmailSupplierHint: 'Add the supplier’s email on their profile to enable.', manualReceiptEmailSent: 'Request email sent to the supplier.', manualReceiptEmailFailed: 'Delivery saved, but the email could not be sent.', manualReceiptEmailDescPhotoOnly: 'A photo was attached to this delivery registration (no text description).', adminGlobalTitle: 'Global dashboard', adminGlobalSubtitle: 'Summary of all locations. Pick a branch from the menu or a card for the operational view.', adminGlobalTotalsLabel: 'Network totals', adminOpenBranchDashboard: 'Operational view', adminSedeSettingsLink: 'Branch page', adminDocQueueShort: 'In queue', rekkiOrder: 'Order on Rekki', manualDeliveryNeedSede: 'Select an active operator or ensure your profile is linked to a location to register a delivery.', kpiPriceListSub: 'rows in price list', listinoOverviewHint: 'Price list lines for suppliers in your scope. Open a supplier to edit or import from an invoice.', listinoOverviewEmpty: 'No price list rows in this scope.', listinoOverviewOpenSupplier: 'Open supplier →', listinoOverviewLimitNote: 'Showing the latest {n} rows.', fattureRiepilogoTitle: 'Invoice totals', fattureRiepilogoHint: 'Sum of amounts in your scope. The table lists the latest invoices by date; open one for attachment and links.', fattureRiepilogoEmpty: 'No invoices in this scope.', fattureRiepilogoLimitNote: 'Showing the latest {n} invoices (by date).', fattureRiepilogoOpenInvoice: 'Open invoice →', fattureRiepilogoCountLabel: '{n} invoices', fattureRiepilogoLinkAll: 'All invoices →', kpiStatementNone: 'No statements yet', kpiStatementAllOk: 'No anomalies', kpiStatementIssuesFooter: 'of {t} statements checked', kpiDaProcessareSub: 'documents in queue',
    kpiOrdiniSub: 'archived order confirmations',
    ordiniOverviewHint:
      'Order confirmation PDFs by supplier. Open the supplier profile (Orders tab) to upload or manage files.',
    ordiniOverviewEmpty: 'No order confirmations in this scope.',
    ordiniOverviewOpenSupplier: 'Open supplier →',
    ordiniOverviewLimitNote: 'Showing the latest {n} confirmations.',
    ordiniColSupplier: 'Supplier',
    ordiniColTitle: 'Title',
    ordiniColOrderDate: 'Order date',
    ordiniColRegistered: 'Registered',
    ordiniOpenPdf: 'Open PDF', ordiniPdfPreview: 'Preview', ordiniPdfOpenNewTab: 'Open in new tab', ordiniPdfCopyLink: 'Copy link', ordiniPdfLinkCopied: 'Link copied', operatorNoSede: 'No branch is linked to your profile. Ask an administrator to assign you to the correct location.', suggestedSupplierBanner: 'New supplier detected: {name}. Add them?', suggestedSupplierAdd: 'New supplier', suggestedSupplierConfirm: 'Add to directory', suggestedSupplierOpenForm: 'Open form', suggestedSupplierSavedToast: 'Supplier added', suggestedSupplierSkip: 'Next', suggestedSupplierBannerTeaser_one: '1 new supplier detected — Click to manage', suggestedSupplierBannerTeaser_many: '{n} new suppliers detected — Click to manage', suggestedSupplierDrawerTitle: 'Detected new suppliers', suggestedSupplierSenderLabel: 'Sender', suggestedSupplierFirstContactLabel: 'First contact', suggestedSupplierIgnore: 'Dismiss', suggestedSupplierDrawerCloseScrimAria: 'Close detected suppliers panel', enterAsSede: 'Enter as location', syncHealthAlert: 'Sync issue (IMAP or OCR)', syncHealthOcrCount: 'OCR failures (48h): {n}', viewingAsSedeBanner: 'You are viewing the dashboard as:', exitSedeView: 'Back to admin overview', emailSyncQueued: 'Queued — another sync is finishing…', emailSyncPhaseConnect: 'Connecting…', emailSyncConnectToServer: 'Connecting to IMAP (network, TLS, sign-in)…', emailSyncConnectOpeningMailbox: 'Opening the Inbox…', emailSyncPhaseSearch: 'Scanning message text…', emailSyncPhaseProcess: 'Attachment analysis with Vision AI…', emailSyncPhasePersist: 'Saving to database…', emailSyncPhaseDone: 'Sync completed.', emailSyncStalled: 'No updates for a while — Vision AI can take several minutes on many attachments. Please wait…', emailSyncStalledHint: 'This only means the live sync stream is quiet — normal during long OCR. Real IMAP retry counts appear in the red banner above during the connect phase.', emailSyncImapRetryLine: 'IMAP connection: attempt {current} of {max}', emailSyncCountsHint: 'Found · new in app · processed · PDF/body units', emailSyncMailboxGlobal: 'Global IMAP inbox (environment variables)', emailSyncMailboxSede: 'Inbox: {name}', emailSyncSupplierFilterLine: 'Supplier filter: {name}', emailSyncStatFoundLine: 'Found in mailbox: {found}', emailSyncStatImportedLine: 'New in app (documents imported): {imported}', emailSyncStatProcessedLine: 'Emails fully processed: {processed}', emailSyncStatIgnoredLine: 'Skipped or no result: {ignored}', emailSyncStatDraftsLine: 'Auto-created delivery note drafts: {drafts}', emailSyncStatAlreadyLine: 'Already processed in a past sync (not imported again): {n}', emailSyncStatUnitsLine: 'Units to scan (PDF/image attachments + eligible email bodies): {done} / {total}', emailSyncStripDetailsExpandAria: 'Show email sync details', emailSyncStripDetailsCollapseAria: 'Hide email sync details', emailSyncStop: 'Stop', emailSyncStopAria: 'Stop email sync', emailSyncDismiss: 'Dismiss', emailSyncDismissAria: 'Dismiss email sync summary', potentialSupplierFromEmailBodyBanner: 'Potential supplier from email text: {name}. Associate them?', potentialSupplierFromEmailBodyCta: 'Open new supplier' },
  fornitori: { title: 'Suppliers', new: 'New Supplier', nome: 'Name / Company', email: 'Email', piva: 'VAT Number', noSuppliers: 'No suppliers yet.', addFirst: 'Add the first supplier →', editTitle: 'Edit Supplier', profileViewOnlyBanner: 'View only on mobile: browse data and documents. To edit the profile, price list, or document queue, use a desktop or ask your branch manager.', saveChanges: 'Save Changes', notFound: 'Supplier not found.', deleteConfirm: 'Delete this supplier? All linked delivery notes and invoices will also be deleted.', importaDaFattura: 'Import from Invoice', countLabel: 'suppliers registered', namePlaceholder: 'e.g. Smith & Co Ltd', emailPlaceholder: 'supplier@example.com', pivaLabel: 'VAT Number', pivaPlaceholder: 'GB123456789', addressLabel: 'Address (optional)', addressPlaceholder: 'Street, postcode, city', rekkiLinkLabel: 'Rekki link (optional)', rekkiLinkPlaceholder: 'https://…', rekkiIdLabel: 'Rekki ID (optional)', rekkiIdPlaceholder: 'e.g. supplier ID on Rekki', rekkiIntegrationTitle: 'Rekki integration', rekkiOpenInApp: 'Open Rekki', rekkiEmbedPanelTitle: 'Rekki', rekkiSheetOpeningLine: 'You are opening the listino for {name}', rekkiSheetGoCta: 'Go to listino', rekkiSheetEmbedHint: 'Rekki cannot be embedded in this window for security reasons. Use the title and summary above to confirm the page, then open Rekki in your browser with the button below.', rekkiSheetPopupButton: 'Open in window (1000×900)', rekkiSheetPagePreviewCaption: 'Page preview', rekkiSheetPagePreviewLoading: 'Loading preview…', rekkiSheetPagePreviewUnavailable: 'No preview available; open Rekki with the button below.', rekkiLookupByVat: 'Search Rekki (VAT)', rekkiLookupApiLink: 'Automatic Rekki ID lookup (API)', rekkiSaveRekkiMapping: 'Save Rekki link', rekkiSaveMapping: 'Save mapping', rekkiStatusNotConnected: 'Not linked', rekkiStatusConnected: 'Linked', rekkiStatusPending: 'Unsaved changes', rekkiConnectedBadge: 'Rekki', rekkiCachedListBanner: 'Cached data (offline). Updates may be stale.', cardFooterUnlockPin: 'Unlock with PIN', rekkiLookupNeedVat: 'Add the VAT number on the supplier record to search Rekki.', rekkiIdExtractedFromLink: 'Supplier ID extracted from the Rekki link.', rekkiAutoLinkedSingle: 'Only one Rekki supplier matched this VAT — Rekki link saved.', rekkiSearchOnRekkiGoogle: 'Search on Rekki', rekkiSearchOnRekkiGoogleByName: 'Google (company name)', rekkiGuidedPasteHint: 'Opens Google scoped to rekki.com. Open the supplier profile, copy the URL from the address bar, paste it in the Link field — the ID is extracted immediately; then Save to enable price checks.', rekkiIdUrlNotParsed: 'The ID field contains a Rekki URL we could not parse. Paste the profile URL in the Link field, or only the supplier ID.', saving: 'Saving...', tabRiepilogo: 'Overview', tabListino: 'Price List', tabAuditPrezzi: 'Price Audit', tabConfermeOrdine: 'Order confirmations', tabStrategyConto: 'Statement', kpiBolleTotal: 'Total Delivery Notes', kpiFatture: 'Registered Invoices', kpiOrdini: 'Orders', kpiPending: 'Pending documents', kpiReconciliation: 'Reconciliation', subAperte: 'open', subConfermate: 'confirmed', subDaAbbinare: 'in queue', subChiuse: 'notes closed', subListinoRows: 'list rows', kpiFatturatoPeriodo: 'Invoiced amount', subFatturatoPeriodoZero: 'No invoices dated in this period', subFatturatoPeriodoCount_one: '1 invoice included in the total', subFatturatoPeriodoCount_other: '{n} invoices included in the total', subFatturatoTotaleLordoMicro: 'Gross total (all invoices): {amount}', kpiListinoProdottiPeriodo: 'Price list products', subListinoProdottiEAggiornamenti: '{p} distinct products · {u} price updates', subListinoPeriodoVuoto: 'No price list updates in this period', subListinoPriceAnomalies: 'Attention: {n} price variations detected', subBolleRekkiSavingsMicro: 'Estimated Rekki savings: Rekki reference prices are lower on some deliveries.', subBollePeriodoVuoto: 'No delivery notes dated in this period', subBollePeriodoRiepilogo: '{open} of {total} without a linked invoice', subDocumentiCodaEmailPeriodo: 'Email documents to process (same period)', subOrdiniPeriodo: 'in period', subStatementsNoneInMonth: 'none', subStatementsAllVerified: 'all OK', subStatementsWithIssues: 'issues', helpText: 'Go to the <b>Statement</b> tab to match documents and delivery notes, or to <b>Delivery Notes</b> and <b>Invoices</b> for the full history.', listinoSetupTitle: 'Price list table not yet created', listinoSetupSubtitle: 'Activate per-product price tracking in 2 clicks:', listinoSetupStep1: 'Click <strong class="font-bold text-app-fg">"Copy SQL"</strong> below', listinoSetupStep2: 'Open the <a href="https://supabase.com/dashboard/project/dubocvwsdzrqrrxsedas/sql/new" target="_blank" rel="noopener noreferrer" class="font-semibold text-amber-200 underline decoration-amber-200/50 transition-colors hover:text-app-fg">SQL Editor ↗</a>, paste and click <strong class="font-bold text-app-fg">"Run"</strong>', listinoSetupShowSQL: 'Show full SQL ▸', listinoCopySQL: 'Copy SQL', listinoCopied: 'Copied!', listinoProdotti: 'Products Price List', listinoProdottiTracked: 'products tracked', listinoNoData: 'No product prices recorded', listinoNoDataHint: 'Enter prices directly in the <code class="font-mono text-app-fg-muted">listino_prezzi</code> table on Supabase.', listinoTotale: 'Total spent', listinoDaBolle: 'From delivery notes', listinoDaFatture: 'From invoices', listinoStorico: 'Document history', listinoDocs: 'documents', listinoNoDocs: 'No documents with amount recorded', listinoColData: 'Date', listinoColTipo: 'Type', listinoColNumero: 'Number', listinoColImporto: 'Amount', listinoColTotale: 'Total', listinoRekkiListBadge: '[Rekki]', listinoVerifyAnomalies: 'Check prices', listinoVerifyAnomaliesTitle: 'Open Verification tab with Rekki price filter for this product', listinoRowBadgeOk: 'OK', listinoRowBadgeAnomaly: 'Anomaly', listinoRowActionsLabel: 'Actions', listinoLastIncrease: 'Last increase: {delta} ({pct})', listinoLastDecrease: 'Last decrease: {delta} ({pct})', listinoLastFlat: 'Price aligned with reference ({pct})', listinoVsReferenceHint: 'vs previous calendar month or prior price update.', listinoOriginInvoice: 'Last price from invoice {inv} on {date} · {supplier}', listinoFilterEmptyKpi: 'No products match this KPI filter.', listinoClearKpiFilter: 'Show all products', listinoKpiAriaAll: 'Show all products in the price list', listinoKpiAriaFatture: 'Filter to products last imported from the invoices in this spend summary', listinoKpiAriaBolle: 'Filter to products whose last price date matches a delivery note in this summary', listinoHistoryDepth: '{n} prior price updates', listinoPriceStaleBadge: 'Stale / outdated price', listinoPriceStaleHint: 'Last listino update over 60 days ago.', preferredLanguageEmail: 'Preferred language (for emails)', languageInheritSede: '— Inherit from location —', recognizedEmailsTitle: 'Recognized emails', recognizedEmailsHint: 'Additional addresses from which this supplier may send documents. Email scanning matches them automatically.', recognizedEmailPlaceholder: 'e.g. invoices@supplier.example.com', recognizedEmailLabelOptional: 'Label (optional)', displayNameLabel: 'Short display name', displayNameHint: 'Optional. Shown in the mobile bottom bar and compact lists instead of the full legal name.', displayNamePlaceholder: 'e.g. Amalfi', loadingProfile: 'Loading supplier profile, documents and summary…', logoUrlLabel: 'Supplier logo (URL)', logoUrlPlaceholder: 'https://example.com/logo.png', logoUrlHint: 'HTTPS image (PNG, JPG or SVG). If it fails to load, initials are shown.', confermeOrdineIntro: 'Store order confirmations and other non-fiscal commercial PDFs here. They are not part of the delivery-note or invoice workflow.', confermeOrdineOptionalTitle: 'Title (optional)', confermeOrdineOptionalTitlePh: 'e.g. Order 4582', confermeOrdineOptionalOrderDate: 'Order date', confermeOrdineOptionalNotePh: 'Internal notes', confermeOrdineAdd: 'Save confirmation', confermeOrdineEmpty: 'No order confirmations saved for this supplier yet.', confermeOrdineColFile: 'Document', confermeOrdineColRecorded: 'Uploaded', confermeOrdineOpen: 'Open PDF', confermeOrdineDeleteConfirm: 'Delete this order confirmation and its file?', confermeOrdineDuplicateCopyDeleteConfirm: 'Delete this duplicate order confirmation? Other copies in the group stay saved.', confermeOrdineErrPdf: 'Please upload a PDF file.', confermeOrdineErrNeedFile: 'Choose a PDF to upload.', confermeOrdineErrUpload: 'Upload error', confermeOrdineErrSave: 'Save error', confermeOrdineErrDelete: 'Delete error', confermeOrdineMigrationTitle: 'Order confirmations table not set up', confermeOrdineMigrationHint: 'Run the SQL migration add-conferme-ordine.sql in your Supabase project to create table conferme_ordine and RLS policies.', syncEmailNeedSede: 'Assign a location to the supplier to sync email.', ocrControllaFornitore: 'OCR check', ocrControllaFornitoreTitle: 'Re-runs AI on this supplier’s delivery notes and invoices with a suspicious date (same as Settings — Fix date OCR). Use the action in the Bolle tab for a single document.', ocrControllaFornitoreResult: 'Done: {corrected} updated, processed {scanned} of {total} in queue.', supplierMonthlyDocTitle: 'By month', supplierMonthlyDocColMonth: 'Month', supplierMonthlyDocColBolle: 'Delivery notes', supplierMonthlyDocColFatture: 'Invoices', supplierMonthlyDocColSpesa: 'Invoice total', supplierMonthlyDocColOrdini: 'Orders', supplierMonthlyDocColStatements: 'Statements', supplierMonthlyDocColPending: 'In queue', supplierMonthlyDocColFiscalYear: 'Fiscal year', supplierMonthlyDocFiscalSelected: 'The branch fiscal year for the selected month is {year}.', supplierMonthlyDocAriaGoToTabMonth: 'Open {tab} for period {month}', supplierDesktopRegionAria: 'Supplier profile, desktop layout', listinoPeriodLabel: 'Period', listinoPeriodAll: 'All', listinoPeriodCurrentMonth: 'Current month', listinoPeriodPreviousMonth: 'Previous month', listinoPeriodLast3Months: 'Last 3 months', listinoPeriodFiscalYear: 'Fiscal year', },
  bolle: { title: 'Delivery Notes', new: 'New Delivery Note', uploadInvoice: 'Upload Invoice', viewDocument: 'View Document', noBills: 'No delivery notes yet.', addFirst: 'Register the first delivery note →', deleteConfirm: 'Delete this delivery note? Linked invoices will also be deleted.', duplicateCopyDeleteConfirm: 'Delete this duplicate delivery note copy? Other rows in the group stay saved.', pendingInvoiceOverdueHint: 'Pending for more than 7 days with no invoice — follow up on the accounting document.', ocrScanning: 'Recognizing supplier…', ocrMatched: 'Supplier recognized', ocrNotFound: 'Select supplier manually', ocrAnalyzing: 'Analyzing…', ocrAutoRecognized: 'Recognized automatically', ocrRead: 'Read:', selectManually: 'Select supplier', saveNote: 'Save Delivery Note', savingNote: 'Saving…', analyzingNote: 'Analyzing document…', takePhotoOrFile: 'Take photo or choose file', ocrHint: 'Supplier will be recognized automatically', cameraBtn: 'Camera', fileBtn: 'Choose file', countSingolo: 'delivery note registered', countPlural: 'delivery notes registered', countTodaySingolo: 'delivery note today', countTodayPlural: 'delivery notes today', noBillsToday: 'No delivery notes for today.', listShowAll: 'All delivery notes', listShowToday: 'Today only', listAllPending: 'Pending only', fotoLabel: 'Photo / Delivery Note File', fornitoreLabel: 'Supplier', dataLabel: 'Delivery Note Date', dettaglio: 'Delivery Note Detail', fattureCollegate: 'Linked invoices', aggiungi: '+ Add', nessunaFatturaCollegata: 'No linked invoices.', allegatoLink: 'Attachment →', statoCompletato: 'Completed', statoInAttesa: 'Pending', apri: 'Open', colNumero: 'Number', colAttachmentKind: 'Attachment', riannalizzaOcr: 'Re-run (OCR)', ocrRerunMovedToInvoices: 'Classified as invoice: the document was moved to the Invoices tab.', ocrRerunUpdatedStaysBolla: 'Delivery note fields updated. Classification: still a DDT / delivery note.', ocrRerunUnchangedStaysBolla: 'No fields changed. Classification: still a delivery note (check the file or try again).', ocrRerunFailed: 'OCR could not finish: check the attachment or try again.', ocrRerunProgressTitle: 'Re-analysing document', ocrRerunStep1: '1. Loading attachment from storage', ocrRerunStep2: '2. AI (Gemini): invoice vs delivery note, number, amount, date', ocrRerunStep3: '3. Saving row or moving to Invoices if applicable', convertiInFattura: 'Move to Invoices', convertiInFatturaTitle: 'Register as invoice (without OCR)', convertiInFatturaConfirm: 'Move this document from the Delivery notes tab to the Invoices tab? The current number and amount will be used as the invoice number and total.', convertiInFatturaOk: 'Document moved to Invoices.', convertiInFatturaErrLinked: 'Not possible: an invoice is already linked to this delivery note or there is a link in fattura_bolle.', convertiInFatturaErrGeneric: 'The operation could not be completed.', attachmentKindPdf: 'PDF', attachmentKindImage: 'Image', attachmentKindOther: 'File', nessunaBollaRegistrata: 'No delivery notes registered', creaLaPrimaBolla: 'Create the first delivery note →', vediDocumento: 'View document', dateFromDocumentHint: 'From document', prezzoDaApp: 'App price', verificaPrezzoFornitore: 'Verify supplier price', rekkiPrezzoIndicativoBadge: '⚠️ Indicative price from Rekki app', listinoRekkiRefTitle: 'Reference price list (Rekki)', listinoRekkiRefHint: 'With Rekki ID set on the supplier, compare this delivery note total with the latest imported list prices.', listinoRekkiRefEmpty: 'No price list rows for this supplier.', scannerTitle: 'AI Scanner', scannerWhatLabel: 'What are you uploading?', scannerModeAuto: 'Automatic', scannerModeBolla: 'Delivery note / DDT', scannerModeFattura: 'Invoice', scannerModeSupplier: 'New supplier', scannerFlowBolla: 'Delivery note registration', scannerFlowFattura: 'Invoice registration', scannerSaveFattura: 'Save invoice', scannerSavingFattura: 'Saving invoice…', scannerCreateSupplierCta: 'Create supplier from extracted data', scannerCreateSupplierFromUnrecognized: 'Create supplier from this document', scannerPdfPreview: 'PDF attached — preview not available', scannerCameraCapture: 'Capture', scannerCameraPermissionDenied: 'Could not access the camera. Check browser or device permissions.', scannerFileScanTypeError: 'Upload a PDF or a photo (JPEG, PNG or WebP).', scannerImageAttached: 'Photo attached' },
  fatture: { title: 'Invoices', new: 'New Invoice', noInvoices: 'No invoices yet.', addFirst: 'Add the first invoice →', invoice: 'Invoice', openBill: 'Open delivery note →', deleteConfirm: 'Delete this invoice? This action is irreversible.', countLabel: 'invoices received', headerBolla: 'Delivery Note', headerAllegato: 'Attachment', apri: 'Open →', caricaFatturaTitle: 'Upload Invoice', bollaMarkata: 'The delivery note will be marked as complete', collegataABolla: 'Linked to a delivery note', bollaPasseraCompletato: 'On save the delivery note will be set to "completed"', dataFattura: 'Invoice Date', fileFattura: 'Invoice File', caricaPdfFoto: 'Upload PDF or take photo', maxSize: 'PDF, JPG, PNG, WebP — max 10 MB', savingInProgress: 'Saving...', salvaChiudiBolla: 'Save and Close Delivery Note', dettaglio: 'Detail', bollaCollegata: 'Linked delivery note', statusAssociata: 'Matched', statusSenzaBolla: 'No delivery note', colNumFattura: 'Invoice No.', nessunaFatturaRegistrata: 'No invoices registered', nessunaFatturaNelPeriodo: 'No invoice dated in this period', fattureInArchivioAllargaFiltroData: 'You have {n} saved invoice(s) for this supplier, but none have an invoice date in the selected range (top right). Widen the dates: the list uses the document date, not the day you scanned.', fattureExpandDateRangeCta: 'Show all invoices (2000 – today)', duplicateInvoiceSameSupplierDateNumber: 'This invoice is already registered: same supplier, date and document number. To replace the PDF, open the existing invoice and use “Replace attachment”.', duplicateInvoiceSameSupplierDateAmountNoNumber: 'This invoice is already registered: same supplier and date, same amount, and no invoice number on file. To replace the PDF, open the existing invoice and use “Replace attachment”.', duplicateDeleteConfirm: 'Delete this copy of invoice {numero}? The original will be kept.', duplicateRemoveCopy: 'Delete duplicate', duplicateRemoveThisCopy: 'Remove this copy', duplicatePairBadgeAria: 'Highlight the duplicate invoice pair', refreshDateFromDoc: 'Re-read date', refreshDateFromDocTitle: 'Re-read the date from the document (OCR) and update the invoice', refreshDateFromDocSuccess: 'Date updated to {data}.', refreshDateFromDocUnchanged: 'The date already matches the one read from the document.' },
  archivio: { title: 'Archive', subtitle: 'suppliers', noBills: 'No delivery notes', noInvoices: 'No invoices', withBill: 'With note', noEmail: 'No email', bollaS: 'note', bollaP: 'notes', fatturaS: 'invoice', fatturaP: 'invoices', editLink: 'Edit →', nuova: '+ New', nuovaFattura: '+ Invoice', documento: 'Document', pendingDocCount: '({n} pending)', linkAssociateStatements: 'Match →', queueTitle: 'Documents in queue', queueSubtitle: 'awaiting processing or matching to a delivery note', unknownSender: 'Unknown sender', statusDaAssociare: 'To match', noQueue: 'No documents in queue', noQueueHint: 'Documents received via email will appear here.', receivedOn: 'Received:', docDate: 'Doc date:' },
  impostazioni: { title: 'Settings', subtitle: 'Customize currency and timezone', lingua: 'Language', valuta: 'Currency', fuso: 'Timezone', preview: 'Preview', saved: 'Settings saved — reloading…', sectionLocalisation: 'Localisation', accountSection: 'Account', changeSede: 'Switch branch', addOperatorsPickSede: 'Choose the active branch under Locations first — then you can add operators (name + PIN) here.', imapSection: 'IMAP Email' },
  log: { title: 'Email activity', subtitle: 'Documents processed automatically from incoming mail.', sender: 'Sender', subject: 'Subject', stato: 'Status', detail: 'Detail', retry: 'Retry', retrying: 'Retrying…', success: 'Success', bollaNotFound: 'Document Received', supplierNotFound: 'Unknown sender', noLogs: 'No logs yet.', emptyHint: 'Run an email sync from the Dashboard.', totalLogs: 'Total logs', linkedInvoices: 'Documents received', withErrors: 'With errors', vediFile: 'View file', supplierSuggested: 'Suggested supplier', aiSuggest: 'AI suggestion', aiSuggestTitle: 'Suggested company data (OCR)', aiSuggestLoading: 'Analyzing…', aiSuggestError: 'Could not analyze the document.', openCreateSupplier: 'Open create supplier', associateRememberHint: 'After saving, the sender email will be linked to this supplier for future syncs.', colAttachment: 'Attachment', colSede: 'Location', colLogId: 'Log ID', colRegistered: 'Registered', tabEmailLog: 'Email activity', tabBlacklist: 'Email blocklist', blacklistSubtitle: 'Senders excluded from OCR email scanning (newsletters, non-supplier accounts, etc.).', blacklistColMittente: 'Sender', blacklistColMotivo: 'Reason', blacklistColDate: 'Added', blacklistPlaceholder: 'e.g. newsletter@vendor.com', blacklistAdd: 'Add', blacklistRemove: 'Remove', blacklistFilterAll: 'All reasons', blacklistEmpty: 'No senders on the blocklist.', blacklistError: 'Could not load blocklist.', logIgnoreAlways: 'Always ignore this sender', logBlacklistAdded: 'Sender added to blocklist.', blacklistMotivoNewsletter: 'Newsletter', blacklistMotivoSpam: 'Spam', blacklistMotivoNonFornitore: 'Non-supplier', blacklistMotivoSistema: 'System', blacklistMotivoSocial: 'Social', activitySummaryToday: '{n} documents auto-processed today', activityEmpty: 'No activity recorded for today yet.', activityColTipo: 'Type', activityColSupplier: 'Supplier', activityColAmount: 'Amount', activityColStatus: 'Status', activityOpenDocument: 'Open document', activityTipoInvoice: 'Invoice', activityTipoDdt: 'Delivery note', activityTipoStatement: 'Statement', activityTipoQueue: 'In queue', activityTipoOrdine: 'Order', activityTipoResume: 'Résumé / CV', activityStatusSaved: '✅ Saved', activityStatusNeedsSupplier: '⚠️ Add supplier', activityStatusIgnored: '⏭️ Ignored', activityProcessDocumentsCta: 'Process queued documents', activityProcessDocumentsBusy: 'Processing…', activityProcessDocumentsNoEligibleInLog: 'Nothing in this list can be auto-processed yet (supplier must be matchable from sender email, or OCR pass is missing). Use AI Inbox for the rest.', activityProcessDocumentsSummary: 'Processed {runs}: {processed} updated, {skipped} skipped this round.', activityProcessDocumentsApiError: 'Could not finish processing', activityProcColumn: 'Processing', activityProcSpinAria: 'Running OCR…', activityProcProcessedAuto: '✓ Auto-saved', activityProcProcessedRevision: 'Needs review', activityProcProcessedOther: 'Updated', activityProcOutcomeError: 'Error', activityProcSkippedScartato: 'Discarded — skipped', activityProcSkippedNoRowOrSede: 'Not accessible', activityProcSkippedNoMittente: 'Invalid sender', activityProcSkippedNoSupplier: 'Link supplier first', activityProcSkippedHasOcr: 'Already has OCR — use Inbox', activityProcPendingBatch: '{n} more after this batch', activityProcRejectedCv: 'Marked as discarded (résumé / CV)', activityProcDash: '—', },
  sedi: { title: 'Location & Users', titleGlobalAdmin: 'Locations', subtitle: 'Manage your location, email sync and operators', subtitleGlobalAdmin: 'Manage locations, email sync and operators', newSede: 'New Location', noSedi: 'No locations yet. Start by adding the first one.', users: 'Users', imap: 'Email Configuration (IMAP)', imapSubtitle: "Configure this location's email inbox. Invoices received here will be automatically matched to this location's suppliers.", imapHost: 'IMAP Host', imapHostPlaceholder: 'imap.gmail.com', imapPort: 'Port', imapUser: 'Email / Username', imapPassword: 'Password', imapPasswordPlaceholder: 'Password or App Password', testConnection: 'Test connection', saveConfig: 'Save configuration', notConfigured: 'Email not configured', accessDenied: 'Access restricted to administrators', accessDeniedHint: 'Contact your admin to get access.', creatingBtn: 'Creating...', createBtn: 'Create', nomePlaceholder: 'e.g. London Office', nessunUtente: 'No users found.', emailHeader: 'Email', sedeHeader: 'Location', ruoloHeader: 'Role', nessunaSedeOption: '— No location —', operatoreRole: 'Operator', adminRole: 'Management portal', adminSedeRole: 'Branch administrator', profileRoleAdmin: 'Management portal', adminScopedSediHint: 'You only see the location linked to your profile. New locations and the “Unassigned users” section are for the main administrator (admin with no location on profile).', renameTitle: 'Rename', deleteTitle: 'Delete', addOperatorSedeTitle: 'New operator', addOperatorSedeDesc: 'They sign in with name and PIN (min. 4 characters). Email is generated automatically.', operatorDisplayNameLabel: 'Display name', operatorPinMinLabel: 'PIN (min. 4 characters)', operatorNameRequired: 'Enter the operator’s name.', operatorPinTooShort: 'PIN must be at least 4 characters.', wizardOperatorHint: 'Operators sign in with name + PIN. You can add more later.', sedeStats: '{operatori} operators · {fornitori} suppliers', operatoriHeader: 'Operators ({n})', sedeAccessCodeLabel: 'Branch access code', sedePinHint: '4-digit numeric PIN. Leave blank to disable.', sedePinError4Digits: 'Branch access PIN must be 4 digits or left empty.', changePinTitle: 'Change PIN', newPinFor: 'New PIN for {name}', operatoreRoleShort: 'Op.', adminSedeRoleShort: 'Br. Adm.', valutaFuso: 'Currency & Timezone', },
  approvalSettings: {
    autoRegisterTitle: 'Automatic AI invoice registration',
    autoRegisterDescription:
      'Invoices the AI is confident about are saved automatically without manual confirmation.',
  },
  statements: {
    heading: 'Monthly Statement Verification',
    tabVerifica: 'Statement',
    tabDocumenti: 'Pending documents',
    schedaNavDaProcessareDesc: 'Incoming attachments: link suppliers, delivery notes and invoices.',
    schedaNavVerificaDesc: 'Monthly statement check vs delivery notes and invoices.',

    statusOk: 'OK',
    statusFatturaMancante: 'Missing Invoice',
    statusBolleManc: 'Missing Delivery Notes',
    statusErrImporto: 'Amount Mismatch',
    statusRekkiPrezzo: 'Rekki price vs invoice',
    stmtReceived: 'Received Statements',
    stmtProcessing: 'Statement still processing — please try again in a moment.',
    stmtEmpty: 'No statements received yet',
    stmtEmptyHint: 'Statements arrive automatically by email.',
    btnSendReminder: 'Send Reminder',
    btnSending: 'Sending…',
    btnSent: 'Sent ✓',
    btnClose: 'Close',
    btnRefresh: 'Refresh',
    btnAssign: 'Assign',
    btnDiscard: 'Discard',
    btnAssigning: 'Assigning…',
    colDate: 'Date',
    colRef: 'Document Ref.',
    colAmount: 'Amount',
    colStatus: 'Status',
    colAction: 'Action',
    colInvoice: 'Invoice',
    colNotes: 'Delivery Notes',
    classicHeading: 'Delivery Notes / Invoice Check',
    classicComplete: 'With Invoice',
    classicMissing: 'Without Invoice',
    classicRequestAll: 'Request all missing invoices',
    classicRequesting: 'Sending…',
    classicSent: 'Sent ✓',
    classicRequestSingle: 'Request invoice',
    migrationTitle: 'How to enable automatic Statement reception',
    migrationSubtitle: 'Create the statements and statement_rows tables in 2 clicks:',
    migrationStep1: 'Click "Copy SQL" on the right',
    migrationStep2: 'Open SQL Editor, paste and click "Run"',
    migrationShowSQL: 'Show full SQL ▸',
    migrationCopySQL: 'Copy SQL',
    migrationCopied: 'Copied!',
    kpiOk: 'Verified OK',
    kpiMissing: 'With anomalies',
    kpiAmount: 'Total amount',
    kpiTotal: 'Total rows',
    months: ['January','February','March','April','May','June','July','August','September','October','November','December'],
    unknownSupplier: 'Unknown supplier',
    loadError: 'Unable to load statement results.',
    sendError: 'Error sending the reminder.',
    tabPending: 'To Confirm',
    tabAll: 'All',
    unknownSenderQuickStripTitle: 'Priority: link supplier ({n})',
    unknownSenderQuickStripAria: 'Quick access to documents without a linked supplier',
    unknownSenderQuickStripChipTitle: 'Scroll to this document in the list',
    emailSyncAutoSavedToday: '{n} auto-saved today',
    bolleAperteOne: 'open delivery note available',
    bolleApertePlural: 'open delivery notes available',
    tagStatement: 'Monthly Statement',
    tagStatementOk: 'Statement ✓',
    tagPending: 'Pending',
    tagBozzaCreata: '✦ Draft created',
    tagAssociated: 'Verified',
    tagDiscarded: 'Discarded',
    labelReceived: 'Received:',
    labelDocDate: 'Doc. date:',
    openFile: 'Open file →',
    reanalyzeDocButton: 'Re-analyse',
    reanalyzeDocTitle: 'Re-run document extraction and supplier matching (email, VAT, company name).',
    reanalyzeDocSuccess: 'Analysis updated.',
    gotoFatturaDraft: 'Go to invoice draft →',
    gotoBollaDraft: 'Go to delivery note draft →',
    toggleAddStatement: 'Add to statement',
    toggleRemoveStatement: 'Remove from statement',
    docKindEstratto: 'Statement',
    docKindBolla: 'Delivery note',
    docKindFattura: 'Invoice',
    docKindOrdine: 'Order',
    docKindHintBolla: 'Mark as delivery note (GRN), not a monthly statement or invoice to match',
    docKindHintFattura: 'Mark as invoice to match with pending delivery notes',
    docKindHintOrdine: 'Order confirmation or commercial PDF: saved to the supplier’s order confirmations (not a delivery note or invoice)',
    docKindGroupAria: 'Document type',
    finalizeNeedsSupplier: 'Link a supplier to finalize.',
    btnFinalizeFattura: 'Save invoice (no delivery note)',
    btnFinalizeBolla: 'Create delivery note from file',
    btnFinalizeOrdine: 'Save to supplier (order)',
    btnFinalizeStatement: 'Archive statement',
    btnFinalizing: 'Saving…',
    finalizeSuccess: 'Document saved.',
    autoRegisterFatturaToast: 'Invoice #{numero} from {fornitore} registered automatically',
    noPendingDocs: 'No documents to review',
    noDocsFound: 'No documents found',
    noBolleAttesa: 'No pending delivery notes available',
    bolleDaCollegamentiSectionTitle: 'Delivery notes to link',
    bollePendingNoneForThisSupplier: 'No pending delivery notes for this supplier.',
    bollesSearchAcrossAllSuppliers: 'Search across all suppliers',
    bollesShowOnlyThisSupplier: 'This supplier only',
    bollesExtendedOtherSuppliersSubtitle: 'Other open delivery notes (other suppliers)',
    bollesMatchAssociateSupplierHint:
      'Link a supplier to see their pending notes here, or search the whole warehouse.',
    bollesFullSiteListSubtitle: 'Entire warehouse',
    unknownSender: 'Unknown sender',
    sameAddressClusterHint:
      'Same address as other queued documents. OCR company names on those rows: {names}. Likely the same supplier — link the same contact.',
    btnCreateSupplierFromAi: 'Create supplier →',
    docTotalLabel: 'Document total:',
    exactAmount: 'Exact amount',
    exceeds: 'Exceeds',
    missingAmt: 'Missing',
    doneStatus: 'Completed ✓',
    errorStatus: 'Error ✗',
    noBolleDelivery: 'No delivery notes found for this invoice',
    bozzaCreataOne: 'draft created',
    bozzeCreatePlural: 'drafts created',
    bozzaBannerSuffix: 'automatically by AI from email attachments. Please verify the data and confirm each document.',
    kpiVerifiedOk: 'Verified ✓',
    noEmailForSupplier: 'No email configured for this supplier',
    reconcileCorrette: 'Correct',
    reconcileDiscrepanza: 'Discrepancy',
    reconcileMancanti: 'Missing',
    reconcileHeading: 'Statement vs database comparison',
    statusMatch: 'Matched',
    statusMismatch: 'Amount mismatch',
    statusMissingDB: 'Not in database',
    reconcileStatement: 'Statement:',
    reconcileDB: 'DB:',
    loadingResults: 'Loading results…',
    editSupplierTitle: 'Edit supplier',
    supplierLinkFailed: 'Could not link the supplier to this document.',
    assignFailed: 'Could not assign to delivery notes.',
    autoLinkedSupplierOne: 'Supplier linked automatically: {name}.',
    autoLinkedSupplierMany: '{count} documents linked to suppliers automatically.',
    bulkAutoMatchSummary:
      'Analysis complete: {linked} supplier(s) linked, {associated} document(s) matched to delivery notes.',
    bulkAutoMatchNone: 'No automatic matches applied to the documents in this list.',
    bulkAutoMatchButtonLabel: 'Match all',
    bulkAutoMatchButtonTitle:
      'Reload the list, link unique suppliers, and match delivery notes when the document total equals one or more open notes.',
    bulkFinalizeToolbarGroupAria: 'Confirm all queued documents by selected document type',
    bulkFinalizeKindTooltip:
      'Same as the row Confirm button: finalize every visible document labeled “{kind}” with supplier already linked ({n}).',
    bulkFinalizeBulkOk: '{n} documents confirmed ({kind}).',
    bulkFinalizeBulkPartial: '{ok} confirmed, {fail} failed ({kind}).',
    ocrFormatToggleTitle: 'Force alternate numeric format interpretation',
    allBolleInvoicedOk: 'Every delivery note has a matching invoice — statement verified ✓',
    aiStatementTotalLabel: 'AI-extracted statement total:',
    statementLinkedBolleLine: '{matched}/{total} delivery notes matched',
    selectedSumLabel: 'Selected:',
    selectedBolle_one: '({n} delivery note)',
    selectedBolle_other: '({n} delivery notes)',
    receivedOn: 'Received on',
    stmtPdfDatesPrefix: 'On document (PDF)',
    stmtPdfIssuedLabel: 'Issued',
    stmtPdfLastPaymentLabel: 'Last payment',
    stmtPdfSummaryTitle: 'Details from the PDF',
    stmtPdfMetaAccountNo: 'Account No.',
    stmtPdfMetaIssuedDate: 'Issued date',
    stmtPdfMetaCreditLimit: 'Credit limit',
    stmtPdfMetaAvailableCredit: 'Available credit',
    stmtPdfMetaPaymentTerms: 'Payment terms',
    stmtPdfMetaLastPaymentAmt: 'Last payment',
    stmtPdfMetaLastPaymentDate: 'Last payment date',
    openPdf: 'Open PDF ↗',
    reanalyze: 'Re-analyse',
    stmtListProcessing: 'Processing…',
    stmtListParseError: 'Parse error',
    stmtRowsCount: '{n} rows',
    stmtAnomalies_one: '{n} issue',
    stmtAnomalies_other: '{n} issues',
    stmtBackToList: 'Back to list',
    needsMigrationTitle: 'Database tables not created yet',
    needsMigrationBody:
      'To enable automatic statement reception, run the SQL migration. Instructions are in the How to enable section below.',
    stmtInboxEmailScanning: 'Scanning email…',
    stmtInboxEmptyDetail:
      'Statements are detected when an email arrives with subject “Statement” or “Account statement” and a PDF attachment.',
    bolleSummaryByPeriod: 'Delivery note summary by period',
    bollePeriodEmpty: 'No delivery notes in this period',
    clearFilter: 'Clear filter',
    rekkiCheckSegmentTooltip: 'The invoiced amount does not match the Rekki order',
    tripleColStmtDate: 'Stmt date',
    tripleColSysDate: 'System date',
    tripleColStmtAmount: 'Stmt amount',
    tripleColSysAmount: 'System amount',
    tripleColChecks: 'Checks',
    statusCheckPending: 'Pending',
    statementVerifyBanner: 'Statement verification',
    badgeAiRecognized: 'AI OK',
    badgeAiRecognizedTitle:
      'Supplier linked. Auto-matching delivery notes still needs aligned amounts and dates within ±30 days of document date or of queue receipt date.',
    badgeNeedsHuman: 'Needs match',
    rememberAssociationTitle: 'Remember this sender–supplier link for next time?',
    rememberAssociationSave: 'Save sender email',
    rekkiDocumentLink: 'Rekki',
  },
  appStrings: {
    brandFooter: 'Smart Pair · Purchase Management',
    pageNotFoundTitle: 'Page not found',
    pageNotFoundDesc: 'The link may be wrong or the page was removed.',
    notFoundInAppTitle: 'Content unavailable',
    notFoundInAppDesc:
      'The link may be wrong, or the delivery note or invoice no longer exists or is not visible for your account (permissions or branch).',
    docUnavailableBollaTitle: 'Delivery note not found',
    docUnavailableBollaDesc:
      'No delivery note matches this link. It may have been deleted, the link may be wrong, or your account or branch may not have access.',
    docUnavailableFatturaTitle: 'Invoice not found',
    docUnavailableFatturaDesc:
      'No invoice matches this link. It may have been deleted, the link may be wrong, or your account or branch may not have access.',
    backToHome: 'Back to dashboard',
    sedeLockTitle: 'Protected access',
    sedeLockDescription: 'The branch {name} requires a 4-digit numeric PIN.',
    sedeLockCodeLabel: 'PIN (4 digits)',
    sedeLockPlaceholder: '••••',
    sedeLockPinLengthError: 'Enter a 4-digit PIN.',
    sectionDates: 'Dates',
    sectionCurrencyLabel: 'Currency',
    loadingBolle: 'Loading delivery notes…',
    noOpenBolle: 'No open delivery note for this supplier.',
    invoiceNumOptional: 'Invoice no. (optional)',
    uploadDateLabel: 'Upload date',
    uploadDateAutomatic: 'automatic',
    registeredByFattura: 'Name of person who registered the invoice…',
    registeredByBolla: 'Name of person who registered the delivery note…',
    saveCloseNBolle: 'Save and close {n} delivery notes',
    colDeliveryNoteNum: 'Delivery note no.',
    colAmountShort: 'Amount',
    labelImportoTotale: 'Total amount',
    labelPrezzoUnitario: 'Unit price',
    loadingPage: 'Loading…',
    noAttachment: 'No attachment',
    camera: 'Camera',
    chooseFile: 'Choose file',
    uploading: 'Uploading…',
    deleteLogConfirm: 'Delete this log? This cannot be undone.',
    imapConfigTitle: 'Email configuration',
    imapLookbackLabel: 'Email lookback (days)',
    imapLookbackLastDays: 'Reads mail (read and unread) from the last {n} days',
    imapLookbackUnlimited: 'Reads all mail in the Inbox (read and unread, no day limit)',
    imapLookbackFootnote: 'Leave empty for no limit. Recommended: 30–90 days.',
    emailSaved: 'Email settings saved.',
    addOperatorsTitle: 'Add operators',
    addOperatorBtn: 'Add operator',
    savingShort: 'Saving…',
    newSedeShort: 'New',
    deleteUserConfirm: 'Delete user {email}? This cannot be undone.',
    deleteSedeConfirm: 'Delete branch "{nome}"? Linked data will remain but lose the branch link.',
    deleteFornitoreConfirm: 'Delete supplier "{nome}"? This cannot be undone.',
    contactsHeading: 'Contacts',
    contactNew: 'New contact',
    contactEdit: 'Edit contact',
    contactRemove: 'Remove',
    contactRemovePrice: 'Remove latest price',
    noContacts: 'No contacts saved',
    infoSupplierCard: 'Supplier profile',
    contactsLegal: 'Registered office',
    contactsFiscal: 'Tax details',
    contactsPeople: 'Contacts',
    noContactRegistered: 'No contact on file',
    noEmailSyncHint: 'Without an email, the scanner cannot automatically match documents from this supplier.',
    noEmailSyncWarning: 'No email linked — documents from this supplier will not be recognised automatically.',
    filterNoEmail: 'No email',
    suggestEmailBtn: 'Find email',
    suggestEmailSearching: 'Searching…',
    suggestEmailNoResults: 'No emails found in existing logs.',
    suggestEmailSave: 'Add',
    suggestEmailSaved: 'Saved',
    suggestEmailSourceLog: 'from sync log',
    suggestEmailSourceQueue: 'from document queue',
    suggestEmailSourceUnmatched: 'from unmatched VAT',
    suggestEmailTitle: 'Emails found in received documents',
    noAddressRegistered: 'No address on file',
    noFiscalRegistered: 'No tax data on file',
    clientSince: 'Customer since',
    fromInvoiceBtn: 'From invoice',
    listinoAnalyze: 'Analyse',
    listinoAnalyzing: 'AI analysis…',
    listinoInvoiceAnalyzedBadge: 'Analysed',
    listinoNoInvoicesFile: 'No invoice with an attachment for this supplier.',
    listinoNoProducts: 'No line items found on this invoice. Try another.',
    saveNProducts: 'Save {n} products',
    clickAddFirst: 'Click Add to enter the first product.',
    monthNavResetTitle: 'Jump to current month',
    monthNavPrevMonthTitle: 'Previous month',
    monthNavNextMonthTitle: 'Next month',
    monthNavPrevYearTitle: 'Previous year',
    monthNavNextYearTitle: 'Next year',
    supplierDesktopPeriodPickerTitle: 'Period (dates)',
    supplierDesktopPeriodPickerButtonAria: 'Open to set the From / To dates for the period',
    supplierDesktopPeriodFromLabel: 'From',
    supplierDesktopPeriodToLabel: 'To',
    supplierDesktopPeriodApply: 'Apply',
    addingAlias: 'Adding…',
    addEmailAlias: '+ Add email',
    listinoImportPanelTitle: 'Import products from invoice',
    listinoImportSelectInvoiceLabel: 'Select invoice',
    listinoImportProductsSelected: '{selected} / {total} products selected',
    listinoImportPriceListDateLabel: 'Price list date',
    listinoImportColListinoDate: 'Last listino date',
    listinoImportDateOlderThanListinoHint:
      'Document date is older than the latest saved listino row for this product; it will not import unless you override.',
    listinoImportApplyOutdatedAdmin: 'Apply as current price',
    listinoImportApplyOutdatedAdminActive: 'Override on',
    listinoImportForceAllSelected: 'Force import for all selected rows',
    listinoImportPartialSaved:
      'Saved {inserted} rows; {skipped} not imported (products: {products}). Check dates or use per-row override.',
    listinoManualDateBlockedHint:
      'The chosen date is older than the latest listino update for this exact product name.',
    listinoManualDateBlockedNoAdmin: 'Only an administrator can force this insert.',
    listinoImportSaveBlockedHintAdmin:
      'Use «Apply as current price» on highlighted rows to include them in the save.',
    listinoImportSaveBlockedHintOperator:
      'Some selected rows have a document date older than the listino: use per-row «Apply as current price», or «Force import for all selected rows», or deselect them.',
    listinoDocDetailImportHint:
      'Listino import (supplier → Price list) compares the document date with each product’s last saved update; older dates do not replace the current price automatically.',
    listinoDocDetailImportHintAdmin:
      'When importing from an invoice, use per-row «Apply as current price» if you need to override.',
    listinoDocRowBlockedBadge: 'Newer listino',
    listinoDocForceButton: 'Force listino update',
    listinoDocForceWorking: 'Saving…',
    listinoDocForceOk: 'Price saved using the document date.',
    listinoDocForceErr: 'Could not apply override.',
    discoveryCreateSupplier: 'Create new supplier',
    discoveryCompanyName: 'Company name *',
    discoveryEmailDiscovered: 'Email (discovered)',
    discoveryVat: 'VAT',
    discoveryBranch: 'Branch',
    discoveryBreadcrumbSettings: 'Settings',
    discoveryTitle: 'Inbox explorer',
    discoveryNoImap: 'No IMAP accounts configured',
    discoveryNoImapHint: 'Configure IMAP in branch settings (Branches) to enable inbox scanning.',
    discoveryPartialScan: 'Partial scan — some mailboxes had errors:',
    discoveryAllRegistered: 'All senders are already registered',
    discoveryNoUnknown: 'No unknown senders with attachments in the last 30 days.',
    discoveryReady: 'Ready to scan',
    discoveryReadyHint: 'Click Scan inbox to analyse the last 30 days and discover potential new suppliers.',
    discoveryScanBtn: 'Scan inbox',
    toastDismiss: 'Dismiss',
    countrySaving: 'Saving…',
    countrySaved: 'Saved',
    sidebarSediTitle: 'Locations',
    deleteGenericConfirm: 'Delete this item? This cannot be undone.',
    deleteFailed: 'Error while deleting:',
    errorGenericTitle: 'Something went wrong',
    errorGenericBody: 'An unexpected error occurred. Please try again or return home.',
    tryAgain: 'Try again',
    errorCodeLabel: 'Error code:',
    errorSegmentTitle: 'Couldn’t load this section',
    errorSegmentBody: 'This section could not be loaded. Try again or go back to the previous page.',
    errorDevDetailsSummary: 'Error details (development only)',
    errorFatalTitle: 'Critical error',
    errorFatalBody: 'The application hit an unexpected problem.',
    approvazioni_pageSub: 'Invoices pending approval above threshold',
    analyticsPageSub: 'Purchases and reconciliation overview',
    analyticsMonths: '{n} months',
    attivitaPageTitle: 'Activity Log',
    attivitaPageSub: 'Complete history of operator actions',
    attivitaExportCsv: 'Export CSV',
    attivitaAllOperators: 'All operators',
    attivitaRemoveFilters: 'Remove filters',
    analyticsErrorLoading: 'Error loading data',
    analyticsNoData: 'No data available.',
    analyticsKpiTotalInvoiced: 'Total invoiced',
    analyticsKpiNFatture: '{n} invoices',
    analyticsKpiReconciliation: 'Reconciliation',
    analyticsKpiCompleted: '{n} completed',
    analyticsKpiAvgTime: 'Avg. reconciliation time',
    analyticsKpiDays: '{n} days',
    analyticsKpiDaysFrom: 'days from delivery note to invoice',
    analyticsKpiSlow: 'slow',
    analyticsKpiOk: 'ok',
    analyticsKpiPriceAnomalies: 'Price anomalies',
    analyticsKpiResolvedOf: '{n} resolved of {total}',
    analyticsKpiToCheck: 'to check',
    analyticsKpiAllOk: 'all ok',
    analyticsChartMonthlySpend: 'Monthly spend',
    analyticsChartAmount: 'Amount',
    analyticsChartInvoices: 'Invoices',
    analyticsChartTopSuppliers: 'Top suppliers',
    analyticsChartNoData: 'No data',
    analyticsChartBolleVsFatture: 'Delivery Notes vs Invoices',
    analyticsChartDeliveryNotes: 'Delivery Notes',
    analyticsSummaryPendingDocs: 'Pending documents',
    analyticsSummaryPendingNotes: 'Pending delivery notes',
    analyticsSummaryArchivedInvoices: 'Archived invoices',
    approvazioni_noPending: 'No invoices pending',
    approvazioni_allReviewed: 'All invoices above threshold have been reviewed.',
    approvazioni_viewInvoice: 'View invoice →',
    approvazioni_rejectReason: 'Rejection reason (optional)',
    approvazioni_rejectPlaceholder: 'E.g.: amount does not match delivery note...',
    approvazioni_confirmReject: 'Confirm rejection',
    approvazioni_approve: 'Approve',
    approvazioni_reject: 'Reject',
    approvazioni_threshold: 'threshold',
    attivitaFilterAll: 'All',
    attivitaFilterBolle: 'Delivery Notes',
    attivitaFilterFatture: 'Invoices',
    attivitaFilterDocumenti: 'Documents',
    attivitaFilterOperatori: 'Operators',
    attivitaError: 'Unable to load activity.',
    attivitaNoRecent: 'No recent activity',
    attivitaRecentTitle: 'Recent activity',
    rekkiSyncTitle: 'Rekki Email Sync',
    rekkiSyncDesc: 'Scan the venue email inbox and automatically match Rekki orders',
    rekkiSyncMobileTap: 'Sync Rekki Emails',
    rekkiSyncNeverRun: 'Never run',
    rekkiSyncTapUpdate: 'tap to update',
    rekkiSyncTapStart: 'tap to start',
    rekkiSyncButtonLabel: 'SCAN DELIVERY NOTE / INVOICE',
    rekkiSyncInProgress: 'Scan in progress',
    rekkiSyncProcessing: 'Processing Rekki emails…',
    rekkiSyncStop: 'Stop',
    rekkiSyncCheckNow: 'Check now',
    rekkiSyncStarting: 'Starting scan...',
    rekkiSyncDays: '{n} days',
    rekkiSyncLastScan: 'Last scan',
    rekkiSyncEmails: 'Emails',
    rekkiSyncDocuments: 'Documents',
    rekkiSyncMatched: 'Matched',
    rekkiSyncUnmatched: 'Unmatched',
    rekkiSyncRecentEmails: 'Recent processed emails',
    rekkiSyncNoData: 'No prices detected',
    rekkiSyncNoDataDesc: 'Press “Check now” to scan Rekki emails from {nome}',
    rekkiImapNotConfigured: 'Email inbox not configured',
    rekkiImapNotConfiguredDesc: 'Configure IMAP credentials in Settings → Venue to enable sync.',
    rekkiPhaseQueued: 'Queued...',
    rekkiPhaseConnect: 'Connecting to email inbox...',
    rekkiPhaseSearch: 'Searching Rekki emails...',
    rekkiPhaseProcess: 'Processing emails...',
    rekkiPhasePersist: 'Saving data...',
    rekkiPhaseDone: 'Completed',
    rekkiPhaseError: 'Error',
    rekkiDoneResult: 'Completed — {n} emails processed',
    rekkiErrUnknown: 'Unknown error',
    rekkiErrNetwork: 'Network error',
    analyticsSinceFY: 'since FY start',
    backupPageTitle: 'Data Backup',
    backupPageDesc: 'Automatic weekly CSV exports · Every Monday at 02:00 UTC',
    auditTitle: 'Price Recovery Audit',
    auditDesc: 'Analyse all historical invoices to identify overcharges vs agreed Rekki prices',
    auditDateFrom: 'From',
    auditDateTo: 'To',
    auditRunBtn: 'Run Audit',
    auditRunning: 'Running...',
    auditSyncConfirm: 'This will analyse all historical invoices and update the reference dates in the price list. Continue?',
    auditSyncTitle: 'Sync History with Rekki',
    auditSyncDesc: 'Analyse all past invoices and automatically update reference dates to remove «Document date earlier» blocks',
    auditSyncBtn: 'Sync',
    auditSyncing: 'Syncing...',
    auditKpiSpreco: 'Total Waste',
    auditKpiAnomalies: 'Anomalies',
    auditKpiProducts: 'Products',
    auditKpiFatture: 'Invoices',
    auditNoOvercharges: 'No overcharges detected!',
    auditNoOverchargesDesc: 'All invoiced prices are in line with or below the agreed Rekki prices',
    auditColFattura: 'Invoice',
    auditColProdotto: 'Product',
    auditColPagato: 'Paid',
    auditColPattuito: 'Agreed',
    auditColSpreco: 'Waste',
    auditHelpTitle: 'How does the audit work?',
    auditHelpP1: 'The audit analyses all invoices in the selected period and:',
    auditHelpLi1: 'Extracts line items from each invoice using AI',
    auditHelpLi2: 'Compares paid prices with the agreed Rekki prices (price list)',
    auditHelpLi3: 'Identifies all cases where a higher price was paid',
    auditHelpLi4: 'Calculates total waste based on quantity purchased',
    auditHelpCta: '💡 Use this report to request credit notes from the supplier',
    auditErrStatus: 'Error {status}',
    auditErrGeneric: 'Error running audit',
    auditErrSync: 'Error during synchronisation',
    auditCsvDate: 'Date',
    auditCsvInvoiceNum: 'Invoice Number',
    auditCsvProduct: 'Product',
    auditCsvRekkiId: 'Rekki ID',
    auditCsvPaid: 'Paid',
    auditCsvAgreed: 'Agreed',
    auditCsvDiffPct: 'Difference %',
    auditCsvQty: 'Quantity',
    auditCsvWaste: 'Waste',
    sedeErrCreating: 'Error creating location.',
    sedeErrSavingProfile: 'Error saving profile.',
    sedePinUpdated: 'PIN updated.',
    sedeErrUpdatingPin: 'Error updating PIN.',
    sedeErrSavingPin: 'Error saving location PIN.',
    sedeLocSaved: 'Localisation saved.',
    sedeErrLoadData: 'Error loading data.',
    sedeErrUpdating: 'Error updating location.',
    sedeUpdated: 'Location updated.',
    sedeDeleted: 'Location deleted.',
    sedeErrSavingImap: 'Error saving IMAP settings.',
    sedeWizardStepOf: 'Step {step} of 3',
    sedeWizardNext: 'Next',
    sedeWizardBack: '← Back',
    sedeWizardSkip: 'Skip',
    sedeWizardNameLabel: 'Location name',
    sedeWizardEmailConfigTitle: 'Email setup',
    sedeWizardEmailConfigDesc: 'To receive invoices by email. You can set this up later too.',
    sedeWizardAppPassRequired: 'App Password required.',
    sedeWizardAddOperatorsTitle: 'Add operators',
    sedeWizardAddOperatorsDesc: 'Operators sign in with name + PIN (min. 4 digits).',
    sedeWizardCreateBtn: 'Create location + {n} operators',
    sedeWizardCreatingBtn: 'Creating…',
    sedeWizardStartSetup: 'Start guided setup',
    sedeEmailNotConfigured: 'Email not set.',
    sedeCreatedSuccess: 'Location "{nome}" created successfully.',
    gmailBadgeTitle: '💡 Ready for the price audit?',
    gmailBadgeDescConfigured: 'Gmail API is configured! Connect your account to activate the automatic scanner and recover potential refunds on {nome}.',
    gmailBadgeDescNotConfigured: 'Set up Gmail (2 min) to automatically scan emails from {nome} and identify unauthorised overcharges.',
    gmailBadgeCTAConnect: 'Connect & Scan',
    gmailBadgeCTASetup: 'Set Up Now',
    gmailBadgeDismiss: 'Dismiss',
    gmailBadgeAPIConfigured: 'API Configured',
    gmailBadgeConnectAccount: 'Connect Account',
    gmailBadgePriceCheck: 'Price Check',
    gmailBadgePriceCheckSub: 'Auto anomalies',
    gmailBadgeRecoverySub: '2yr history',
    autoSyncTitle: 'Auto-Sync Invoice',
    autoSyncDesc: 'Automatically extract and compare invoice products with the price list',
    autoSyncBtn: 'Analyse Invoice',
    autoSyncBtnLoading: 'Analysing...',
    autoSyncTotal: 'Total',
    autoSyncAnomalies: 'Anomalies',
    autoSyncNewItems: 'New',
    autoSyncProduct: 'Product',
    autoSyncPrice: 'Price',
    autoSyncNewItem: 'New',
    autoSyncAnomalyWarning: '{n} item{s} with abnormal price increase',
    autoSyncConfirmBtn: 'Confirm {n} items',
    autoSyncImporting: 'Importing...',
    autoSyncErrAnalysis: 'Error during analysis',
    autoSyncErrImport: 'Error during import',
  },
}

const es: Translations = {
  ui: {
    tagline:          'Gestión de Compras',
    closeMenu:        'Cerrar menú',
    expandSidebar:    'Expandir barra lateral',
    navMore:            'Más',
    collapseSidebar:  'Contraer barra lateral',
    changeOperator:   'Cambiar operador',
    changeOperatorShort: 'Cambiar',
    selectOperator:   'Seleccionar operador',
    activeOperator:   'Activo',
    noOperator:       'Ninguno',
    operatorLabel:    'Operador',
    operatorChanged:  'Operador cambiado con éxito',
    noOperatorsFound: 'No se encontraron operadores para esta sede.',
    noSedeForOperators: 'No hay sede vinculada. Añade una sede o vincula tu perfil de administrador a una sede.',
    currentlyActive:  'Activo:',
    languageTooltip:  'Idioma',
    syncError:        'Error durante el escaneo.',
    syncSuccess:      'Sincronización completada.',
    networkError:     'Error de red. Inténtalo de nuevo.',
    connectionOnline: 'En línea',
    connectionOffline: 'Sin conexión',
    connectionReconnecting: 'Reconectando…',
    emailSyncResumed: 'Conexión restablecida: reanudando sincronización de correo.',
    emailSyncStreamIncomplete:
      'La sincronización no terminó (conexión cerrada antes de tiempo). Inténtalo de nuevo.',
    emailSyncAlreadyRunning:
      'La sincronización ya está en curso. Espera a que termine o cancélala en la barra superior.',
    emailSyncCancelled: 'Sincronización de correo detenida.',
    reminderError:    'Error al enviar recordatorios.',
    noReminders:      'No hay recordatorios que enviar (¿proveedores sin email?).',
    remindersCount:   'recordatorio',
    remindersSentOne: '1 recordatorio enviado de {total}.',
    remindersSentMany: '{n} recordatorios enviados de {total}.',
    pinError:         'PIN incorrecto.',
    operatorPinStepUpTitle: 'Confirmación de operador',
    operatorPinStepUpHint: 'Introduce el PIN de 4 dígitos del operador activo para autorizar este cambio.',
    operatorPinStepUpNoActive:
      'No hay operador activo en esta sesión. Usa el botón de abajo (o la barra inferior en móvil / menú lateral), elige quién opera e introduce el PIN.',
    operatorPinStepUpChooseOperator: 'Elegir operador',
    verifyAndContinue: 'Continuar',
    operatorAutoLockLabel: 'Bloqueo automático tras',
    operatorAutoLockNever: 'Nunca',
    operatorAutoLockMinutes: '{n} min',
    sidebarSedeActive: 'Sede activa: {name}',
    sidebarSedeSwitchTo: 'Cambiar a: {name}',
    sidebarSedeSettings: 'Ajustes de {name}',
    appBuildLine: 'v{version} · {commit} · {env}',
    appBuildLineLocal: 'v{version} · {commit}',
    appBuildNoCommit: '—',
    appBuildAria: 'Versión de la app y despliegue',
    deployEnvLocal: 'local',
    deployEnvProduction: 'producción',
    deployEnvPreview: 'previsualización',
    deployEnvDevelopment: 'desarrollo',
  },
  login: {
    brandTagline: 'Gestión de facturas',
    subtitle: 'Acceso: tu nombre y PIN de 4 cifras',
    adminSubtitle: 'Portal de gestión',
    adminSubtitleHint:
      'Correo y contraseña para el portal de gestión. Para nombre de operador y PIN, usa «Acceso operador» (admins de sede y operadores).',
    nameLabel: 'Nombre',
    namePlaceholder: '',
    pinLabel: 'PIN',
    pinDigits: '(4 dígitos)',
    lookingUp: 'Comprobando nombre…',
    enterFirstName: 'Introduce solo el nombre y pulsa Tab',
    emailLabel: 'Email',
    emailPlaceholder: 'admin@empresa.com',
    passwordLabel: 'Contraseña',
    passwordPlaceholder: 'Mínimo 6 caracteres',
    loginBtn: 'Entrar',
    adminLink: 'Portal de gestión →',
    operatorLink: '← Acceso operador',
    pinIncorrect: 'PIN incorrecto. Inténtalo de nuevo.',
    invalidCredentials: 'Credenciales no válidas.',
    verifying: 'Verificando…',
    accessing: 'Accediendo…',
    notFound: 'Usuario no encontrado.',
    adminOnlyEmail: 'Este acceso es solo para administradores. Usa nombre y PIN o pide una cuenta de administrador.',
    adminGateLabel: 'Código de desbloqueo (admin)',
    adminGateHint: 'Introduce el PIN para desbloquear correo y contraseña.',
    adminGateWrong: 'Código no válido.',
    sessionGateTitle: 'Confirmar acceso',
    sessionGateSubtitle: 'Nueva sesión: introduce de nuevo tu nombre y el PIN de 4 dígitos para continuar.',
    sessionGateWrongUser: 'Este nombre no coincide con la cuenta con la que iniciaste sesión.',
    sessionBootStuck: 'El perfil no cargó a tiempo. Vuelve a iniciar sesión.',
    netflixTitle: '¿Quién está de turno?',
    netflixSubtitle: 'Toca tu nombre para entrar',
    netflixManualLogin: '¿No encuentras tu nombre? Accede manualmente →',
    netflixChangeOperator: '← Cambiar operador',
    deviceTrustTitle: '¿Acceder automáticamente en este dispositivo la próxima vez?',
    deviceTrustYes: 'Sí, recordarme',
    deviceTrustNo: 'No, gracias',
    deviceWelcomeBack: '¡Bienvenido/a, {name}!',
    deviceWelcomeAccediHint: 'Dispositivo reconocido — continúa cuando estés listo/a.',
    accessoSwitchOperator: 'Cambiar operador',
  },
  nav: { dashboard: 'Panel', dashboardAdmin: 'Admin', operatori: 'Operadores', fornitori: 'Proveedores', bolle: 'Albaranes', fatture: 'Facturas', ordini: 'Pedidos', archivio: 'Archivo', logEmail: 'Registro de email', sedi: 'Sede y Usuarios', sediTitle: 'Sede', sediNavGroupMaster: 'Sedes', gestisciSedeNamed: 'Gestionar {name}', gestisciSedi: 'Gestionar sedes', tuttiFornitori: 'Todos los proveedores', cerca: 'Buscar…', nessunRisultato: 'Sin resultados', altriRisultati: 'más — busca arriba', impostazioni: 'Configuración', nuovaBolla: 'Nuevo Albarán', ricevuto: 'Recibo', operatorActiveHint: 'Indica quién está operando', esci: 'Cerrar sesión', guida: 'Ayuda', sedeGlobalOverview: 'Vista global', bottomNavBackToSede: 'Volver a la sede', bottomNavScannerAi: 'Escáner IA', bottomNavProfile: 'Perfil', bottomNavSediMap: 'Mapa de sedes', bottomNavGlobalReports: 'Informes globales', bottomNavNewOrder: 'Nuevo pedido', bottomNavPriceHistory: 'Historial de precios', bottomNavContact: 'Contactar', addNewDelivery: 'Nuevo albarán', openRekki: 'Rekki', ariaMain: 'Navegación principal', ariaAdmin: 'Navegación de administrador', ariaFornitore: 'Navegación de proveedor', ariaCallSupplier: 'Llamar al proveedor', notifications: 'Notificaciones', noNotifications: 'Sin notificaciones', errorAlert: 'Errores de sincronización (24h)', analytics: 'Analytics', approvazioni: 'Aprobaciones', attivita: 'Actividad', backup: 'Copia de seguridad', consumiAi: 'Consumo IA', strumenti: 'Herramientas' },
  strumentiCentroOperazioni: {
    pageTitle: 'Centro de operaciones',
    pageSubtitle:
      'Accesos rápidos a OCR, duplicados, conciliaciones de proveedor y listín. Los botones en cada documento siguen disponibles.',
    breadcrumbTools: 'Herramientas',
    sectionOcr: 'OCR y documentos',
    sectionDup: 'Duplicados y limpieza',
    sectionListino: 'Listín y precios',
    cardReanalyzeTitle: 'Volver a analizar OCR (cola e IA)',
    cardReanalyzeDesc:
      'Documentos pendientes, clasificación IA y sugerencias Gemini — igual que en AI Inbox. En cada albarán o factura puedes usar «Volver a analizar» en la fila.',
    cardOpenInbox: 'Abrir AI Inbox',
    cardRefreshDateTitle: 'Releer fecha desde el adjunto',
    cardRefreshDateDesc: 'Abre una factura y usa «Releer fecha» junto a la fecha (hace falta adjunto).',
    cardOpenFatture: 'Abrir facturas',
    cardOcrCheckTitle: 'Comprobación OCR del proveedor',
    cardOcrCheckDesc:
      'En la ficha del proveedor (escritorio) el botón «Comprobación OCR» vuelve a analizar masivamente las fechas dudosas.',
    cardOpenFornitoreSheet: 'Abrir proveedores',
    cardDupScanTitle: 'Buscar facturas duplicadas',
    cardDupScanDesc: 'Mismo análisis que la barra del panel: mismo proveedor, misma fecha y mismo número.',
    cardDupManageTitle: 'Gestión de duplicados',
    cardDupManageDesc: 'Albaranes, facturas y proveedores: agrupa copias y unifica o borra.',
    cardDupManageCta: 'Abrir gestión de duplicados',
    cardAuditTitle: 'Auditoría de abonos de proveedor',
    cardAuditDesc: 'Alinear email remitente y proveedor asignado — pestaña Abonaciones en AI Inbox.',
    cardOpenAudit: 'Abrir pestaña Abonaciones',
    cardListinoAutoTitle: 'Actualización automática del listín (Auto)',
    cardListinoAutoDesc: 'En la pestaña Listín del proveedor: analiza automáticamente facturas pendientes.',
    cardListinoFromInvTitle: 'Importar precios «Desde factura»',
    cardListinoFromInvDesc:
      'En la pestaña Listín: elige una factura con PDF y confirma productos.',
    cardListinoAddTitle: 'Añadir producto al listín',
    cardListinoAddDesc: 'En la pestaña Listín: botón Añadir para alta manual (escritorio).',
    cardListinoCta: 'Ir a proveedores — pestaña Listín',
    manualImapSyncTitle: 'Sincronizar email — ventana 24 h',
    manualImapSyncDesc:
      'Busca en la bandeja de entrada los últimos 24 horas. El cron automático usa solo 3 horas para aligerar la carga.',
    historicSyncSectionLabel: 'Sync histórica (año anterior)',
    historicSyncTitle: 'Importar datos del año anterior',
    historicSyncDesc:
      'Descarga el correo de los últimos 365 días aproximadamente para comparar con el ejercicio fiscal 2025/26.',
    historicSyncWarning: '⚠️ Operación lenta — puede tardar varios minutos. Ejecútala solo una vez.',
    historicSyncCta: 'Iniciar sync histórica',
    historicSyncResult: '{n} documentos importados del año anterior',
    historicSyncProgress: 'Procesando: {label}…',
    historicSyncCompleted: '¡Listo!',
    hintContextualShortcuts:
      'Recuerda: «Volver a analizar» en cada fila de albarán/factura, «Mover a facturas», «Desde factura» / «Auto» / «Añadir» siguen en el listín.',
  },
  common: { save: 'Guardar', cancel: 'Cancelar', delete: 'Eliminar', edit: 'Editar', new: 'Nuevo', loading: 'Cargando...', error: 'Error', success: 'Éxito', noData: 'Sin datos', document: 'Documento', actions: 'Acciones', date: 'Fecha', status: 'Estado', supplier: 'Proveedor', notes: 'Notas', phone: 'Teléfono', saving: 'Guardando...', attachment: 'Adjunto', openAttachment: 'Abrir adjunto', detail: 'Detalle', add: 'Añadir', rename: 'Renombrar', role: 'Rol', aiExtracted: 'Datos extraídos por IA', matched: 'Asociado', notMatched: 'No asociado', recordSupplierLinked: 'Vinculado', company: 'Empresa', invoiceNum: 'N.º Factura', documentRef: 'Referencia', total: 'Total', duplicateBadge: 'DUPLICADO', emailSyncAutoSavedBadge: 'Guardado automático', viewerZoomIn: 'Aumentar zoom', viewerZoomOut: 'Reducir zoom', viewerZoomReset: '100 %', viewerZoomHint: 'Ctrl + rueda o botones' },
  status: { inAttesa: 'Pendiente', completato: 'Completado', completata: 'Completada' },
  dashboard: { title: 'Panel', suppliers: 'Proveedores', totalBills: 'Total albaranes', pendingBills: 'Albaranes pendientes', invoices: 'Facturas', recentBills: 'Albaranes recientes', recentBillsMobileListDisabled: 'El listado detallado no se muestra en esta pantalla. Usa «Ver todos» para abrir el listado de albaranes o cambia a una pantalla más grande.', viewAll: 'Ver todos →', syncEmail: 'Sincronizar Email', emailSyncScopeLookback: 'Días recientes (sede)', emailSyncScopeFiscal: 'Año fiscal', emailSyncFiscalYearSelectAria: 'Periodo de sincronización de email', emailSyncScopeHint: 'IT, FR, DE, ES: año civil. UK: año fiscal que termina el 5 abr. Cada sede usa su país.', emailSyncLookbackSedeDefault: 'Predeterminado de sede (IMAP)', emailSyncLookbackDaysN: 'Últimos {n} días', emailSyncLookbackDaysAria: 'Cuántos días atrás buscar en el buzón', emailSyncLookbackDaysHint: 'Predeterminado de sede: usa los días configurados en la sede. Si no, limita la búsqueda IMAP a los últimos N días (leídos y no leídos).', emailSyncDocumentKindAria: 'Tipo de documentos a importar al sincronizar el correo', emailSyncDocumentKindHint: 'Todos: predeterminado. Nuevo proveedor: solo remitentes no dados de alta. Albarán / Factura: fuerza el tipo de borrador. Extracto: solo correos cuyo asunto parece un extracto (statement).', emailSyncDocumentKindAll: 'Todos los documentos', emailSyncDocumentKindFornitore: 'Nuevo proveedor', emailSyncDocumentKindBolla: 'Albarán (DDT)', emailSyncDocumentKindFattura: 'Factura', emailSyncDocumentKindEstratto: 'Extracto de cuenta', syncing: 'Sincronizando...', sendReminders: 'Enviar recordatorios', sending: 'Enviando...', viewLog: 'Ver Log', sedeOverview: 'Resumen por Sede', manageSedeNamed: 'Gestionar {name} →', manageSedi: 'Gestionar sedes →', sedeImapOn: 'Email activa', digitalizzaRicevuto: 'Digitalizar recibo', scannerFlowCardTitle: 'Escáner — hoy', scannerFlowCardHint: 'PDF analizados por IA y documentos guardados hoy en esta sede (tu zona horaria).', scannerFlowAiElaborate: 'Procesadas (IA)', scannerFlowArchived: 'Archivadas', scannerFlowOpenScanner: 'Nuevo escaneo', scannerFlowBolleHubTitle: 'Archivo de albaranes', scannerFlowRecentTitle: 'Actividad reciente del escáner IA', scannerFlowNoRecent: 'Sin eventos de escaneo recientes. Usa el escáner IA en la barra inferior o inicia un escaneo nuevo.', scannerFlowTodayCounts: 'Hoy: {ai} procesadas (IA) · {arch} archivadas', scannerFlowFiscalPeriodLine: 'Año fiscal {year}', scannerFlowCardHintFiscal: 'Los totales usan el año fiscal seleccionado (igual que el selector superior), no solo hoy.', scannerFlowDetailListCountRange: '{n} documentos en el periodo', scannerFlowDetailListCountToday: '{n} documentos hoy', scannerFlowDetailEmptyRange: 'Ningún documento en este periodo.', scannerFlowStepAiElaborata: 'PDF analizado por IA — texto y datos extraídos (OCR)', scannerFlowStepArchiviataBolla: 'Albarán registrado y guardado en el archivo', scannerFlowStepArchiviataFattura: 'Factura registrada y guardada en el archivo', scannerFlowTodayActivityTitle: 'Actividad de hoy', scannerFlowNoEventsToday: 'No hay actividad del escáner IA hoy en esta sede.', scannerFlowEventsAllLink: 'Registro completo de eventos →', scannerFlowEventsPageTitle: 'Escáner IA — eventos', scannerFlowEventsEmpty: 'No hay eventos del escáner registrados.', scannerFlowEventsPrev: 'Anterior', scannerFlowEventsNext: 'Siguiente', scannerFlowEventsPageOf: 'Página {current} de {pages}', scannerMobileTileTap: 'Toca para empezar', duplicateFattureScanButton: 'Buscar facturas duplicadas', duplicateFattureToolbarShort: 'Duplicados', sendRemindersToolbarShort: 'Recordatorios', syncEmailToolbarShort: 'Sync email', emailSyncCronLine: '🟢 Sincronización automática — última: {relative}', emailSyncCronIssueLine: '⚠️ Problema IMAP — última: {relative}', emailSyncCronNever: 'nunca', emailSyncCronJustNow: 'ahora mismo', emailSyncCronMinutesAgo: 'hace {n} min', emailSyncCronHoursAgo: 'hace {n} h', emailSyncCronLateLine: '🟡 Sincronización retrasada — última: {relative}', emailSyncCronStoppedLine: '🔴 Sincronización parada — última: {relative}', emailSyncForceSync: 'Forzar sync', emailSyncEmergencyToolsAria: 'Herramientas — sincronizar correo manualmente (emergencia)', duplicateFattureModalTitle: 'Facturas duplicadas', duplicateFattureScanning: 'Analizando facturas…',
    duplicateFattureScanningBatch: 'Último lote leído de la base de datos',
    duplicateFattureScanningAwaitingRows: 'Esperando las primeras filas de la base de datos (el primer bloque puede tardar si hay muchas facturas).', duplicateFattureNone: 'No se encontraron duplicados. Se comparan mismo proveedor, misma fecha de documento y mismo número de factura (solo filas con número).', duplicateFattureError: 'No se pudo completar el análisis. Inténtalo de nuevo.', duplicateFattureGroupCount: '{n} copias', duplicateFattureSedeUnassigned: 'Sin sede', duplicateFattureTruncated: 'Análisis limitado a las primeras 50.000 facturas visibles; el resultado puede estar incompleto.', duplicateFattureClose: 'Cerrar', duplicateFattureRowsAnalyzed: '{n} facturas analizadas', duplicateFattureDeleteConfirm: '¿Eliminar esta factura? Las demás copias del grupo siguen guardadas. Acción irreversible.', duplicateFattureDeleteAria: 'Eliminar esta copia duplicada', duplicateDashboardBanner_one: 'Se detectó {n} duplicado — Pulsa para gestionarlo', duplicateDashboardBanner_other: 'Se detectaron {n} duplicados — Pulsa para gestionarlos', kpiFiscalYearFilter: 'Periodo KPI (año fiscal)', kpiFiscalYearFilterAria: 'Filtrar conteos de albaranes, facturas, pedidos, listino y extractos por año fiscal', workspaceQuickNavAria: 'Accesos rápidos a las secciones de la sede (mismos destinos que las tarjetas KPI de abajo)', desktopHeaderSedeToolsMenuTrigger: 'Herramientas', desktopHeaderSedeToolsMenuTriggerAriaReminders: 'Recordatorios: {n} proveedores con albaranes próximos a vencer', desktopHeaderSedeToolsMenuAria: 'Panel: duplicados de facturas, recordatorios y sincronización de correo', kpiNoPendingBills: 'No hay albaranes pendientes.', kpiOperatorOfflineOverlayTitle: 'Sincronización en pausa', kpiOperatorOfflineOverlayHint: 'Sin conexión: los enlaces de las tarjetas KPI están desactivados hasta recuperar la red.', kpiListinoAnomaliesCountLine: '{n} anomalías de precio detectadas', kpiBollePendingListCta: 'Ver {n} pendientes →', kpiDuplicateInvoicesDetected: '⚠️ {n} facturas duplicadas detectadas',
    kpiDuplicateBolleDetected: '⚠️ {n} albaranes duplicados detectados',
    kpiDocumentiDaRevisionareTitle: 'Documentos a revisar',
    kpiDocumentiDaRevisionareSub: 'Duplicados, remitentes desconocidos y anomalías de precio Rekki',
    inboxUrgentePageTitle: 'Bandeja urgente',
    inboxUrgentePageIntro:
      'Punto único para incidencias: documentos por asociar, anomalías de precio y duplicados en tus listas.',
    inboxUrgenteNavDocQueue: 'Cola de documentos de correo',
    inboxUrgenteNavPriceAnomalies: 'Verificación — anomalías de precio Rekki',
    inboxUrgenteNavInvoices: 'Facturas (duplicados)',
    inboxUrgenteNavBolle: 'Albaranes (duplicados)',
    inboxUrgenteNavOrdini: 'Pedidos (duplicados)',
    inboxUrgenteNavAiInbox: 'AI Inbox (cola + duplicados)',
    errorCountSuffix: 'errores', manualReceiptLabel: 'Recibido (sin albarán)', manualReceiptPlaceholder: 'p. ej. 5 kg calamares, 2 cajas limones', manualReceiptRegister: 'Registrar entrega', manualReceiptRegistering: 'Registrando…', manualReceiptSaved: 'Entrega registrada.', manualReceiptNeedTextOrPhoto: 'Introduce una descripción o adjunta una foto.', manualReceiptRemovePhoto: 'Quitar foto', manualReceiptNeedSupplier: 'Selecciona un proveedor.', manualReceiptRegisterFailed: 'No se pudo registrar.', manualReceiptEmailSupplierLabel: 'Enviar email al proveedor para pedir el pedido y el albarán (DDT)', manualReceiptEmailSupplierHint: 'Añade el email del proveedor en su ficha.', manualReceiptEmailSent: 'Email de solicitud enviado al proveedor.', manualReceiptEmailFailed: 'Entrega guardada, pero no se pudo enviar el email.', manualReceiptEmailDescPhotoOnly: 'Foto adjunta al registro de entrega (sin texto).', adminGlobalTitle: 'Panel global', adminGlobalSubtitle: 'Resumen de todas las sedes. Elige una filial en el menú o en la tarjeta para la vista operativa.', adminGlobalTotalsLabel: 'Totales de la red', adminOpenBranchDashboard: 'Vista operativa', adminSedeSettingsLink: 'Ficha sede', adminDocQueueShort: 'En cola', rekkiOrder: 'Pedir en Rekki', manualDeliveryNeedSede: 'Selecciona un operador activo o asegúrate de que tu perfil esté vinculado a una sede para registrar una entrega.', kpiPriceListSub: 'líneas en el listino', listinoOverviewHint: 'Líneas de listín de precios de los proveedores en tu ámbito. Abre un proveedor para editar o importar desde factura.', listinoOverviewEmpty: 'Sin líneas de listín en este ámbito.', listinoOverviewOpenSupplier: 'Abrir proveedor →', listinoOverviewLimitNote: 'Mostrando las últimas {n} filas.', fattureRiepilogoTitle: 'Total facturas', fattureRiepilogoHint: 'Suma de importes en tu ámbito. La tabla muestra las últimas facturas por fecha; abre una para el adjunto y enlaces.', fattureRiepilogoEmpty: 'No hay facturas en este ámbito.', fattureRiepilogoLimitNote: 'Mostrando las últimas {n} facturas (por fecha).', fattureRiepilogoOpenInvoice: 'Abrir factura →', fattureRiepilogoCountLabel: '{n} facturas', fattureRiepilogoLinkAll: 'Todas las facturas →', kpiStatementNone: 'Sin extractos', kpiStatementAllOk: 'Sin anomalías', kpiStatementIssuesFooter: 'de {t} extractos revisados', kpiDaProcessareSub: 'documentos en cola',
    kpiOrdiniSub: 'confirmaciones de pedido registradas',
    ordiniOverviewHint: 'PDF de confirmación de pedido por proveedor. Abre la ficha del proveedor (pestaña Pedidos) para subir o gestionar archivos.',
    ordiniOverviewEmpty: 'No hay confirmaciones de pedido en este ámbito.',
    ordiniOverviewOpenSupplier: 'Abrir proveedor →',
    ordiniOverviewLimitNote: 'Se muestran las últimas {n} confirmaciones.',
    ordiniColSupplier: 'Proveedor',
    ordiniColTitle: 'Título',
    ordiniColOrderDate: 'Fecha pedido',
    ordiniColRegistered: 'Registrada',
    ordiniOpenPdf: 'Abrir PDF', ordiniPdfPreview: 'Vista previa', ordiniPdfOpenNewTab: 'Abrir en pestaña nueva', ordiniPdfCopyLink: 'Copiar enlace', ordiniPdfLinkCopied: 'Enlace copiado', operatorNoSede: 'Tu perfil no tiene sede asignada. Pide a un administrador que te vincule a la filial correcta.', suggestedSupplierBanner: 'Nuevo proveedor detectado: {name}. ¿Añadirlo?', suggestedSupplierAdd: 'Nuevo proveedor', suggestedSupplierConfirm: 'Añadir a la agenda', suggestedSupplierOpenForm: 'Abrir formulario', suggestedSupplierSavedToast: 'Proveedor añadido', suggestedSupplierSkip: 'Siguiente', suggestedSupplierBannerTeaser_one: 'Detectado 1 nuevo proveedor — Clic para gestionarlo', suggestedSupplierBannerTeaser_many: 'Detectados {n} nuevos proveedores — Clic para gestionarlos', suggestedSupplierDrawerTitle: 'Nuevos proveedores detectados', suggestedSupplierSenderLabel: 'Remitente', suggestedSupplierFirstContactLabel: 'Primer contacto', suggestedSupplierIgnore: 'Descartar', suggestedSupplierDrawerCloseScrimAria: 'Cerrar el panel de proveedores nuevos', enterAsSede: 'Entrar como sede', syncHealthAlert: 'Problema de sincronización (IMAP u OCR)', syncHealthOcrCount: 'Fallos OCR (48h): {n}', viewingAsSedeBanner: 'Estás viendo el panel como:', exitSedeView: 'Volver a vista admin', emailSyncQueued: 'En cola — otra sincronización está terminando…', emailSyncPhaseConnect: 'Conectando…', emailSyncConnectToServer: 'Conexión al servidor IMAP (red, cifrado, acceso)…', emailSyncConnectOpeningMailbox: 'Abriendo la carpeta Bandeja de entrada…', emailSyncPhaseSearch: 'Escaneando textos…', emailSyncPhaseProcess: 'Análisis de adjuntos con Vision IA…', emailSyncPhasePersist: 'Guardando en la base de datos…', emailSyncPhaseDone: 'Sincronización completada.', emailSyncStalled: 'Sin novedades — con muchos adjuntos la visión puede tardar varios minutos. Espera…', emailSyncStalledHint: 'Solo indica que el flujo no envía novedades (normal con OCR largo). Los reintentos reales de IMAP aparecen arriba en rojo en la fase de conexión.', emailSyncImapRetryLine: 'Conexión IMAP: intento {current} de {max}', emailSyncCountsHint: 'Encontradas · nuevas en app · procesadas · unidades PDF/texto', emailSyncMailboxGlobal: 'Bandeja IMAP global (variables de entorno)', emailSyncMailboxSede: 'Bandeja: {name}', emailSyncSupplierFilterLine: 'Filtro proveedor: {name}', emailSyncStatFoundLine: 'Encontradas en el buzón: {found}', emailSyncStatImportedLine: 'Nuevas en la app (documentos importados): {imported}', emailSyncStatProcessedLine: 'Correos procesados (leídos y analizados): {processed}', emailSyncStatIgnoredLine: 'Omitidas o sin resultado: {ignored}', emailSyncStatDraftsLine: 'Borradores de albarán creados: {drafts}', emailSyncStatAlreadyLine: 'Ya procesadas en una sincronización anterior (sin importar de nuevo): {n}', emailSyncStatUnitsLine: 'Unidades a analizar (adjuntos PDF/imagen o cuerpo largo): {done} / {total}', emailSyncStripDetailsExpandAria: 'Mostrar detalles de sincronización de correo', emailSyncStripDetailsCollapseAria: 'Ocultar detalles de sincronización de correo', emailSyncStop: 'Detener', emailSyncStopAria: 'Detener sincronización de correo', emailSyncDismiss: 'Cerrar', emailSyncDismissAria: 'Cerrar resumen de sincronización de correo', potentialSupplierFromEmailBodyBanner: 'Posible proveedor (texto del correo): {name}. ¿Asociarlo?', potentialSupplierFromEmailBodyCta: 'Abrir nuevo proveedor' },
  fornitori: { title: 'Proveedores', new: 'Nuevo Proveedor', nome: 'Nombre / Empresa', email: 'Email', piva: 'NIF/CIF', noSuppliers: 'Sin proveedores.', addFirst: 'Añadir el primero →', editTitle: 'Editar Proveedor', profileViewOnlyBanner: 'Solo lectura en móvil: consulta datos y documentos. Para editar ficha, listino o cola de documentos usa un ordenador o pide al responsable de sede.', saveChanges: 'Guardar Cambios', notFound: 'Proveedor no encontrado.', deleteConfirm: '¿Eliminar este proveedor? También se eliminarán todos los albaranes y facturas vinculados.', importaDaFattura: 'Importar de Factura', countLabel: 'proveedores registrados', namePlaceholder: 'Ej. Empresa S.L.', emailPlaceholder: 'proveedor@ejemplo.com', pivaLabel: 'NIF/CIF', pivaPlaceholder: 'A12345678', addressLabel: 'Dirección (opc.)', addressPlaceholder: 'Calle, CP, ciudad', rekkiLinkLabel: 'Enlace Rekki (opc.)', rekkiLinkPlaceholder: 'https://…', rekkiIdLabel: 'ID Rekki (opc.)', rekkiIdPlaceholder: 'ej. ID proveedor en Rekki', rekkiIntegrationTitle: 'Integración Rekki', rekkiOpenInApp: 'Abrir Rekki', rekkiEmbedPanelTitle: 'Rekki', rekkiSheetOpeningLine: 'Vas a abrir el listino de {name}', rekkiSheetGoCta: 'Ir al listino', rekkiSheetEmbedHint: 'Rekki no puede incrustarse aquí por seguridad. Revisa el título y el resumen de arriba para confirmar; abre el sitio completo con el botón inferior.', rekkiSheetPopupButton: 'Abrir en ventana (1000×900)', rekkiSheetPagePreviewCaption: 'Vista previa de la página', rekkiSheetPagePreviewLoading: 'Cargando vista previa…', rekkiSheetPagePreviewUnavailable: 'Sin vista previa; abre Rekki con el botón de abajo.', rekkiLookupByVat: 'Buscar en Rekki (IVA)', rekkiLookupApiLink: 'Búsqueda automática de ID Rekki (API)', rekkiSaveRekkiMapping: 'Guardar enlace Rekki', rekkiSaveMapping: 'Guardar mapping', rekkiStatusNotConnected: 'Sin conexión', rekkiStatusConnected: 'Conectado', rekkiStatusPending: 'Cambios sin guardar', rekkiConnectedBadge: 'Rekki', rekkiCachedListBanner: 'Datos en caché (sin conexión).', cardFooterUnlockPin: 'Desbloquear con PIN', rekkiLookupNeedVat: 'Añade el NIF/CIF del proveedor para buscar en Rekki.', rekkiIdExtractedFromLink: 'ID de proveedor extraído del enlace Rekki.', rekkiAutoLinkedSingle: 'Solo un proveedor Rekki coincide con este NIF/CIF — enlace guardado.', rekkiSearchOnRekkiGoogle: 'Buscar en Rekki', rekkiSearchOnRekkiGoogleByName: 'Google (nombre)', rekkiGuidedPasteHint: 'Se abre Google limitado a rekki.com. Abre el perfil del proveedor, copia la URL, pégala en Enlace: el ID se extrae al instante; luego Guardar para activar el control de precios.', rekkiIdUrlNotParsed: 'El campo ID contiene una URL de Rekki que no reconocimos. Pega la URL del perfil en el campo Enlace o solo el ID del proveedor.', saving: 'Guardando...', tabRiepilogo: 'Resumen', tabListino: 'Lista de Precios', tabAuditPrezzi: 'Auditoría de Precios', tabConfermeOrdine: 'Confirmaciones de pedido', tabStrategyConto: 'Extracto', kpiBolleTotal: 'Total albaranes', kpiFatture: 'Facturas recibidas', kpiOrdini: 'Pedidos', kpiPending: 'Documentos pendientes', kpiReconciliation: 'Conciliación', subAperte: 'abiertos', subConfermate: 'confirmadas', subDaAbbinare: 'en cola', subChiuse: 'albaranes cerrados', subListinoRows: 'líneas lista', kpiFatturatoPeriodo: 'Facturación (facturas)', subFatturatoPeriodoZero: 'Ninguna factura con fecha en el periodo', subFatturatoPeriodoCount_one: '1 factura incluida en el total', subFatturatoPeriodoCount_other: '{n} facturas incluidas en el total', subFatturatoTotaleLordoMicro: 'Total bruto (todas las facturas): {amount}', kpiListinoProdottiPeriodo: 'Productos del tarifario', subListinoProdottiEAggiornamenti: '{p} productos distintos · {u} actualizaciones de precio', subListinoPeriodoVuoto: 'Sin cambios de tarifario en el periodo', subListinoPriceAnomalies: 'Atención: {n} variaciones de precio detectadas', subBolleRekkiSavingsMicro: 'Ahorro Rekki estimado: precios de referencia más bajos en algunas entregas.', subBollePeriodoVuoto: 'Ningún albarán con fecha en el periodo', subBollePeriodoRiepilogo: '{open} de {total} sin factura vinculada', subDocumentiCodaEmailPeriodo: 'Documentos de correo por procesar (mismo periodo)', subOrdiniPeriodo: 'en el período', subStatementsNoneInMonth: 'ninguno', subStatementsAllVerified: 'todos OK', subStatementsWithIssues: 'incidencias', helpText: 'Ve a la pestaña <b>Extracto</b> para asociar documentos y albaranes, o a <b>Albaranes</b> y <b>Facturas</b> para ver el historial completo.', listinoSetupTitle: 'Tabla de precios no creada aún', listinoSetupSubtitle: 'Activa el seguimiento de precios por producto en 2 clics:', listinoSetupStep1: 'Haz clic en <strong class="font-bold text-app-fg">"Copiar SQL"</strong> abajo', listinoSetupStep2: 'Abre el <a href="https://supabase.com/dashboard/project/dubocvwsdzrqrrxsedas/sql/new" target="_blank" rel="noopener noreferrer" class="font-semibold text-amber-200 underline decoration-amber-200/50 transition-colors hover:text-app-fg">SQL Editor ↗</a>, pega y haz clic en <strong class="font-bold text-app-fg">"Run"</strong>', listinoSetupShowSQL: 'Ver SQL completo ▸', listinoCopySQL: 'Copiar SQL', listinoCopied: '¡Copiado!', listinoProdotti: 'Lista de Precios', listinoProdottiTracked: 'productos seguidos', listinoNoData: 'Sin precios de producto registrados', listinoNoDataHint: 'Introduce los precios directamente en la tabla <code class="font-mono text-app-fg-muted">listino_prezzi</code> en Supabase.', listinoTotale: 'Total gastado', listinoDaBolle: 'De albaranes', listinoDaFatture: 'De facturas', listinoStorico: 'Historial de documentos', listinoDocs: 'documentos', listinoNoDocs: 'Sin documentos con importe registrado', listinoColData: 'Fecha', listinoColTipo: 'Tipo', listinoColNumero: 'Número', listinoColImporto: 'Importe', listinoColTotale: 'Total', listinoRekkiListBadge: '[Rekki]', listinoVerifyAnomalies: 'Anomalías', listinoVerifyAnomaliesTitle: 'Abrir Verificación con filtro Rekki para este producto', listinoRowBadgeOk: 'OK', listinoRowBadgeAnomaly: 'Anomalía', listinoRowActionsLabel: 'Acciones', listinoLastIncrease: 'Última subida: {delta} ({pct})', listinoLastDecrease: 'Última bajada: {delta} ({pct})', listinoLastFlat: 'Precio alineado con la referencia ({pct})', listinoVsReferenceHint: 'respecto al mes anterior o al precio previo.', listinoOriginInvoice: 'Último precio desde factura {inv} del {data} · {supplier}', listinoFilterEmptyKpi: 'Ningún producto coincide con este filtro.', listinoClearKpiFilter: 'Mostrar todos', listinoKpiAriaAll: 'Mostrar todos los productos del listino', listinoKpiAriaFatture: 'Filtrar productos importados desde las facturas del resumen', listinoKpiAriaBolle: 'Filtrar por fecha de precio coincidente con un albarán del resumen', listinoHistoryDepth: '{n} actualizaciones anteriores', listinoPriceStaleBadge: 'Precio anticuado', listinoPriceStaleHint: 'Sin actualización de tarifa en más de 60 días.', preferredLanguageEmail: 'Idioma preferido (para correos)', languageInheritSede: '— Heredar de la sede —', recognizedEmailsTitle: 'Correos reconocidos', recognizedEmailsHint: 'Direcciones adicionales desde las que este proveedor puede enviar documentos. El escaneo de correo las empareja automáticamente.', recognizedEmailPlaceholder: 'ej. facturas@proveedor.es', recognizedEmailLabelOptional: 'Etiqueta (opc.)', displayNameLabel: 'Nombre corto (lista y barra)', displayNameHint: 'Opcional. Si lo rellenas, se usa en la barra inferior en móvil y en listas compactas en lugar del nombre completo.', displayNamePlaceholder: 'ej. Amalfi', loadingProfile: 'Cargando ficha, documentos y resumen del proveedor…', logoUrlLabel: 'Logo del proveedor (URL)', logoUrlPlaceholder: 'https://ejemplo.com/logo.png', logoUrlHint: 'Imagen HTTPS (PNG, JPG o SVG). Si no carga, se muestran las iniciales.', confermeOrdineIntro: 'Archiva confirmaciones de pedido y otros PDF comerciales no fiscales. No forman parte del flujo de albaranes o facturas.', confermeOrdineOptionalTitle: 'Título (opc.)', confermeOrdineOptionalTitlePh: 'ej. Pedido 4582', confermeOrdineOptionalOrderDate: 'Fecha del pedido', confermeOrdineOptionalNotePh: 'Notas internas', confermeOrdineAdd: 'Guardar confirmación', confermeOrdineEmpty: 'Sin confirmaciones de pedido para este proveedor.', confermeOrdineColFile: 'Documento', confermeOrdineColRecorded: 'Subido el', confermeOrdineOpen: 'Abrir PDF', confermeOrdineDeleteConfirm: '¿Eliminar esta confirmación y su archivo?', confermeOrdineDuplicateCopyDeleteConfirm: '¿Eliminar esta copia duplicada de la confirmación? Las demás copias del grupo se conservan.', confermeOrdineErrPdf: 'Sube un archivo PDF.', confermeOrdineErrNeedFile: 'Elige un PDF para subir.', confermeOrdineErrUpload: 'Error al subir', confermeOrdineErrSave: 'Error al guardar', confermeOrdineErrDelete: 'Error al eliminar', confermeOrdineMigrationTitle: 'Tabla de confirmaciones no configurada', confermeOrdineMigrationHint: 'Ejecuta la migración SQL add-conferme-ordine.sql en Supabase para crear la tabla conferme_ordine y las políticas RLS.', syncEmailNeedSede: 'Asigna una sede al proveedor para sincronizar el correo.', ocrControllaFornitore: 'Control OCR', ocrControllaFornitoreTitle: 'Vuelve a leer con IA albaranes y facturas con fecha sospechosa (como en Ajustes). Usa la acción en la pestaña Bolle para un solo documento.', ocrControllaFornitoreResult: 'Listo: {corrected} actualizados, procesados {scanned} de {total} en cola.', supplierMonthlyDocTitle: 'Por mes', supplierMonthlyDocColMonth: 'Mes', supplierMonthlyDocColBolle: 'Albaranes', supplierMonthlyDocColFatture: 'Facturas', supplierMonthlyDocColSpesa: 'Total facturas', supplierMonthlyDocColOrdini: 'Pedidos', supplierMonthlyDocColStatements: 'Extractos', supplierMonthlyDocColPending: 'En cola', supplierMonthlyDocColFiscalYear: 'Ejercicio fiscal', supplierMonthlyDocFiscalSelected: 'El ejercicio fiscal de la sede para el mes seleccionado es {year}.', supplierMonthlyDocAriaGoToTabMonth: 'Abrir {tab} para el periodo {month}', supplierDesktopRegionAria: 'Perfil del proveedor, vista de escritorio', listinoPeriodLabel: 'Período', listinoPeriodAll: 'Todo', listinoPeriodCurrentMonth: 'Mes actual', listinoPeriodPreviousMonth: 'Mes anterior', listinoPeriodLast3Months: 'Últimos 3 meses', listinoPeriodFiscalYear: 'Año fiscal', },
  bolle: { title: 'Albaranes', new: 'Nuevo Albarán', uploadInvoice: 'Subir Factura', viewDocument: 'Ver Documento', noBills: 'Sin albaranes.', addFirst: 'Registrar el primero →', deleteConfirm: '¿Eliminar este albarán? También se eliminarán las facturas vinculadas.', duplicateCopyDeleteConfirm: '¿Eliminar esta copia duplicada del albarán? Las demás filas del grupo se conservan.', pendingInvoiceOverdueHint: 'Pendiente más de 7 días sin factura: revisa el documento contable.', ocrScanning: 'Reconociendo proveedor…', ocrMatched: 'Proveedor reconocido', ocrNotFound: 'Seleccionar proveedor manualmente', ocrAnalyzing: 'Analizando…', ocrAutoRecognized: 'Reconocido automáticamente', ocrRead: 'Leído:', selectManually: 'Seleccionar proveedor', saveNote: 'Guardar Albarán', savingNote: 'Guardando…', analyzingNote: 'Analizando documento…', takePhotoOrFile: 'Tomar foto o elegir archivo', ocrHint: 'El proveedor se reconocerá automáticamente', cameraBtn: 'Cámara', fileBtn: 'Elegir archivo', countSingolo: 'albarán registrado', countPlural: 'albaranes registrados', countTodaySingolo: 'albarán hoy', countTodayPlural: 'albaranes hoy', noBillsToday: 'Sin albaranes para hoy.', listShowAll: 'Todos los albaranes', listShowToday: 'Solo hoy', listAllPending: 'Solo pendientes', fotoLabel: 'Foto / Archivo Albarán', fornitoreLabel: 'Proveedor', dataLabel: 'Fecha Albarán', dettaglio: 'Detalle Albarán', fattureCollegate: 'Facturas vinculadas', aggiungi: '+ Añadir', nessunaFatturaCollegata: 'Sin facturas vinculadas.', allegatoLink: 'Adjunto →', statoCompletato: 'Completado', statoInAttesa: 'En espera', apri: 'Abrir', colNumero: 'Número', colAttachmentKind: 'Adjunto', riannalizzaOcr: 'Volver a analizar (OCR)', ocrRerunMovedToInvoices: 'Clasificado como factura: el documento se movió a la pestaña Facturas.', ocrRerunUpdatedStaysBolla: 'Datos del albarán actualizados. Clasificación: sigue siendo albarán / DDT.', ocrRerunUnchangedStaysBolla: 'Sin cambios. Clasificación: sigue siendo albarán (revisa el archivo o reintenta).' , ocrRerunFailed: 'OCR no completado: revisa el adjunto o reintenta.', ocrRerunProgressTitle: 'Reanálisis en curso', ocrRerunStep1: '1. Carga del adjunto desde el almacenamiento', ocrRerunStep2: '2. IA (Gemini): factura vs albarán, número, importe, fecha', ocrRerunStep3: '3. Guardar fila o mover a Facturas si aplica', convertiInFattura: 'Mover a facturas', convertiInFatturaTitle: 'Registrar como factura (sin OCR)', convertiInFatturaConfirm: '¿Mover este documento de Albaranes a Facturas? El número y el importe actuales se usarán como nº e importe de factura.', convertiInFatturaOk: 'Documento movido a Facturas.', convertiInFatturaErrLinked: 'No es posible: ya hay una factura vinculada a este albarán o un enlace en fattura_bolle.', convertiInFatturaErrGeneric: 'No se pudo completar la operación.', attachmentKindPdf: 'PDF', attachmentKindImage: 'Imagen', attachmentKindOther: 'Archivo', nessunaBollaRegistrata: 'Sin albaranes registrados', creaLaPrimaBolla: 'Crear el primer albarán →', vediDocumento: 'Ver documento', dateFromDocumentHint: 'Del documento', prezzoDaApp: 'Precio de la app', verificaPrezzoFornitore: 'Verificar precio del proveedor', rekkiPrezzoIndicativoBadge: '⚠️ Precio orientativo de la app Rekki', listinoRekkiRefTitle: 'Lista de precios de referencia (Rekki)', listinoRekkiRefHint: 'Con ID Rekki en el proveedor, compara el total del albarán con los últimos precios importados.', listinoRekkiRefEmpty: 'Sin líneas de listino para este proveedor.', scannerTitle: 'Escáner IA', scannerWhatLabel: '¿Qué estás subiendo?', scannerModeAuto: 'Automático', scannerModeBolla: 'Albarán / DDT', scannerModeFattura: 'Factura', scannerModeSupplier: 'Nuevo proveedor', scannerFlowBolla: 'Registro de albarán', scannerFlowFattura: 'Registro de factura', scannerSaveFattura: 'Guardar factura', scannerSavingFattura: 'Guardando factura…', scannerCreateSupplierCta: 'Crear proveedor con datos leídos', scannerCreateSupplierFromUnrecognized: 'Crear proveedor desde este documento', scannerPdfPreview: 'PDF adjunto — vista previa no disponible', scannerCameraCapture: 'Capturar', scannerCameraPermissionDenied: 'No se pudo acceder a la cámara. Comprueba los permisos del navegador o del dispositivo.', scannerFileScanTypeError: 'Sube un PDF o una foto (JPEG, PNG o WebP).', scannerImageAttached: 'Foto adjunta' },
  fatture: { title: 'Facturas', new: 'Nueva Factura', noInvoices: 'Sin facturas.', addFirst: 'Añadir la primera →', invoice: 'Factura', openBill: 'Abrir albarán →', deleteConfirm: '¿Eliminar esta factura? La operación es irreversible.', countLabel: 'facturas recibidas', headerBolla: 'Albarán', headerAllegato: 'Adjunto', apri: 'Abrir →', caricaFatturaTitle: 'Subir Factura', bollaMarkata: 'El albarán se marcará como completado', collegataABolla: 'Vinculada a un albarán', bollaPasseraCompletato: 'Al guardar el albarán pasará a "completado"', dataFattura: 'Fecha Factura', fileFattura: 'Archivo Factura', caricaPdfFoto: 'Subir PDF o tomar foto', maxSize: 'PDF, JPG, PNG, WebP — máx 10 MB', savingInProgress: 'Guardando...', salvaChiudiBolla: 'Guardar y Cerrar Albarán', dettaglio: 'Detalle', bollaCollegata: 'Albarán vinculado', statusAssociata: 'Asociada', statusSenzaBolla: 'Sin albarán', colNumFattura: 'N.º Factura', nessunaFatturaRegistrata: 'Sin facturas registradas', nessunaFatturaNelPeriodo: 'Ninguna factura con fecha en este periodo', fattureInArchivioAllargaFiltroData: 'Hay {n} factura(s) guardada(s), pero ninguna tiene la fecha en el intervalo mostrado (arriba a la derecha). Amplía las fechas: el listado filtra por la fecha del documento, no por el día del escaneo.', fattureExpandDateRangeCta: 'Ver todas las facturas (2000 – hoy)', duplicateInvoiceSameSupplierDateNumber: 'Esta factura ya está registrada: mismo proveedor, misma fecha y mismo número de documento. Para sustituir el PDF, abre la factura existente y usa «Sustituir adjunto».', duplicateInvoiceSameSupplierDateAmountNoNumber: 'Esta factura ya está registrada: mismo proveedor y fecha, mismo importe y sin número de documento en archivo. Para sustituir el PDF, abre la factura existente y usa «Sustituir adjunto».', duplicateDeleteConfirm: '¿Eliminar esta copia de la factura {numero}? Se conservará el original.', duplicateRemoveCopy: 'Eliminar duplicado', duplicateRemoveThisCopy: 'Quitar esta copia', duplicatePairBadgeAria: 'Resaltar el par de facturas duplicadas', refreshDateFromDoc: 'Releer fecha', refreshDateFromDocTitle: 'Volver a leer la fecha del documento (OCR) y actualizar la factura', refreshDateFromDocSuccess: 'Fecha actualizada: {data}.', refreshDateFromDocUnchanged: 'La fecha ya coincide con el documento.' },
  archivio: { title: 'Archivo', subtitle: 'proveedores', noBills: 'Sin albaranes', noInvoices: 'Sin facturas', withBill: 'Con albarán', noEmail: 'Sin email', bollaS: 'albarán', bollaP: 'albaranes', fatturaS: 'factura', fatturaP: 'facturas', editLink: 'Editar →', nuova: '+ Nuevo', nuovaFattura: '+ Factura', documento: 'Documento', pendingDocCount: '({n} en cola)', linkAssociateStatements: 'Asociar →', queueTitle: 'Documentos en cola', queueSubtitle: 'pendientes de procesar o asociar a un albarán', unknownSender: 'Remitente desconocido', statusDaAssociare: 'Por asociar', noQueue: 'Sin documentos en cola', noQueueHint: 'Los documentos recibidos por email aparecerán aquí.', receivedOn: 'Recibido:', docDate: 'Fecha doc:' },
  impostazioni: { title: 'Configuración', subtitle: 'Personalizar moneda y zona horaria', lingua: 'Idioma', valuta: 'Moneda', fuso: 'Zona horaria', preview: 'Vista previa', saved: 'Configuración guardada — actualizando…', sectionLocalisation: 'Localización', accountSection: 'Cuenta', changeSede: 'Cambiar sede', addOperatorsPickSede: 'Elige la sede activa en Sedes — luego podrás crear operadores (nombre + PIN) aquí.', imapSection: 'Email IMAP' },
  log: { title: 'Actividad de correo', subtitle: 'Documentos procesados automáticamente desde la bandeja entrante.', sender: 'Remitente', subject: 'Asunto', stato: 'Estado', detail: 'Detalle', retry: 'Reintentar', retrying: 'Reintentando…', success: 'Éxito', bollaNotFound: 'Documento Recibido', supplierNotFound: 'Remitente desconocido', noLogs: 'Sin logs.', emptyHint: 'Ejecuta una sincronización de email desde el Panel.', totalLogs: 'Total logs', linkedInvoices: 'Documentos recibidos', withErrors: 'Con errores', vediFile: 'Ver archivo', supplierSuggested: 'Proveedor sugerido', aiSuggest: 'Sugerencia IA', aiSuggestTitle: 'Datos sugeridos (OCR)', aiSuggestLoading: 'Analizando…', aiSuggestError: 'No se pudo analizar el documento.', openCreateSupplier: 'Abrir alta de proveedor', associateRememberHint: 'Tras guardar, el email del remitente quedará vinculado para futuras sincronizaciones.', colAttachment: 'Adjunto', colSede: 'Sede', colLogId: 'ID log', colRegistered: 'Registrado', tabEmailLog: 'Actividad de correo', tabBlacklist: 'Lista de bloqueo', blacklistSubtitle: 'Remitentes excluidos del escaneo OCR (boletines, cuentas que no son proveedores, etc.).', blacklistColMittente: 'Remitente', blacklistColMotivo: 'Motivo', blacklistColDate: 'Añadido', blacklistPlaceholder: 'ej. boletin@servicio.com', blacklistAdd: 'Añadir', blacklistRemove: 'Quitar', blacklistFilterAll: 'Todos los motivos', blacklistEmpty: 'Ningún remitente en lista.', blacklistError: 'No se pudo cargar la lista.', logIgnoreAlways: 'Ignorar siempre este remitente', logBlacklistAdded: 'Remitente añadido a la lista.', blacklistMotivoNewsletter: 'Newsletter', blacklistMotivoSpam: 'Spam', blacklistMotivoNonFornitore: 'No proveedor', blacklistMotivoSistema: 'Sistema', blacklistMotivoSocial: 'Social', activitySummaryToday: '{n} documentos procesados automáticamente hoy', activityEmpty: 'Sin actividad registrada hoy.', activityColTipo: 'Tipo', activityColSupplier: 'Proveedor', activityColAmount: 'Importe', activityColStatus: 'Estado', activityOpenDocument: 'Abrir documento', activityTipoInvoice: 'Factura', activityTipoDdt: 'Albarán', activityTipoStatement: 'Extracto', activityTipoQueue: 'En cola', activityTipoOrdine: 'Pedido', activityTipoResume: 'CV / currículum', activityStatusSaved: '✅ Guardado', activityStatusNeedsSupplier: '⚠️ Añadir proveedor', activityStatusIgnored: '⏭️ Ignorado', activityProcessDocumentsCta: 'Procesar documentos en cola', activityProcessDocumentsBusy: 'Procesando…', activityProcessDocumentsNoEligibleInLog: 'Aún no se puede automatizar (falta proveedor en agenda u OCR). Usa AI Inbox para el resto.', activityProcessDocumentsSummary: 'Procesados {runs}: {processed} actualizados, {skipped} omitidos.', activityProcessDocumentsApiError: 'No se pudo procesar', activityProcColumn: 'Elaboración', activityProcSpinAria: 'Ejecutando OCR…', activityProcProcessedAuto: '✓ Guardado automático', activityProcProcessedRevision: 'En revisión', activityProcProcessedOther: 'Actualizado', activityProcOutcomeError: 'Error', activityProcSkippedScartato: 'Descartado', activityProcSkippedNoRowOrSede: 'Sin acceso', activityProcSkippedNoMittente: 'Remitente no válido', activityProcSkippedNoSupplier: 'Vincula proveedor', activityProcSkippedHasOcr: 'Ya con OCR — Inbox', activityProcPendingBatch: 'Pendiente (máx. 5 por vez)', activityProcRejectedCv: 'Descartado (CV)', activityProcDash: '—', },
  sedi: { title: 'Sede y Usuarios', titleGlobalAdmin: 'Sedes', subtitle: 'Gestionar la sede, la sincronización de email y los operadores', subtitleGlobalAdmin: 'Gestionar las sedes, la sincronización de email y los operadores', newSede: 'Nueva Sede', noSedi: 'Sin sedes. Empieza añadiendo la primera.', users: 'Usuarios', imap: 'Configuración Email (IMAP)', imapSubtitle: 'Configura el buzón de esta sede. Las facturas recibidas aquí se asociarán automáticamente a los proveedores de la sede.', imapHost: 'Host IMAP', imapHostPlaceholder: 'imap.gmail.com', imapPort: 'Puerto', imapUser: 'Email / Usuario', imapPassword: 'Contraseña', imapPasswordPlaceholder: 'Contraseña o Contraseña de aplicación', testConnection: 'Probar conexión', saveConfig: 'Guardar configuración', notConfigured: 'Email no configurado', accessDenied: 'Acceso restringido a administradores', accessDeniedHint: 'Contacta al admin para obtener acceso.', creatingBtn: 'Creando...', createBtn: 'Crear', nomePlaceholder: 'Ej. Oficina Madrid', nessunUtente: 'No se encontraron usuarios.', emailHeader: 'Email', sedeHeader: 'Sede', ruoloHeader: 'Rol', nessunaSedeOption: '— Sin sede —', operatoreRole: 'Operador', adminRole: 'Portal de gestión', adminSedeRole: 'Administrador de sede', profileRoleAdmin: 'Portal de gestión', adminScopedSediHint: 'Solo ves la sede vinculada a tu perfil. Las sedes nuevas y «Usuarios sin sede» los gestiona el administrador principal (admin sin sede en el perfil).', renameTitle: 'Renombrar', deleteTitle: 'Eliminar', addOperatorSedeTitle: 'Nuevo operador', addOperatorSedeDesc: 'Accede con nombre y PIN (mín. 4 caracteres). El email se genera automáticamente.', operatorDisplayNameLabel: 'Nombre mostrado', operatorPinMinLabel: 'PIN (mín. 4 caracteres)', operatorNameRequired: 'Introduce el nombre del operador.', operatorPinTooShort: 'El PIN debe tener al menos 4 caracteres.', wizardOperatorHint: 'Los operadores acceden con nombre + PIN. Puedes añadir más después.', sedeStats: '{operatori} operadores · {fornitori} proveedores', operatoriHeader: 'Operadores ({n})', sedeAccessCodeLabel: 'Código de acceso sede', sedePinHint: 'PIN numérico de 4 dígitos. Deja vacío para desactivar.', sedePinError4Digits: 'El PIN de acceso debe tener 4 dígitos o estar vacío.', changePinTitle: 'Cambiar PIN', newPinFor: 'Nuevo PIN para {name}', operatoreRoleShort: 'Op.', adminSedeRoleShort: 'Resp.', valutaFuso: 'Moneda y Zona horaria', },
  approvalSettings: {
    autoRegisterTitle: 'Registro automático de facturas por IA',
    autoRegisterDescription:
      'Las facturas que la IA identifica con certeza se registran automáticamente sin confirmación manual.',
  },
  statements: {
    heading: 'Verificación de Extractos Mensuales',
    tabVerifica: 'Estado de cuenta',
    tabDocumenti: 'Documentos pendientes',
    schedaNavDaProcessareDesc: 'Adjuntos entrantes: vincula proveedores, albaranes y facturas.',
    schedaNavVerificaDesc: 'Revisión mensual del extracto frente a albaranes y facturas.',
    statusOk: 'OK',
    statusFatturaMancante: 'Factura faltante',
    statusBolleManc: 'Albaranes faltantes',
    statusErrImporto: 'Error de importe',
    statusRekkiPrezzo: 'Precio Rekki vs factura',
    stmtReceived: 'Extractos recibidos',
    stmtProcessing: 'Extracto en procesamiento — inténtalo de nuevo en unos segundos.',
    stmtEmpty: 'No se han recibido extractos',
    stmtEmptyHint: 'Los extractos llegan automáticamente por email.',
    btnSendReminder: 'Enviar Recordatorio',
    btnSending: 'Enviando…',
    btnSent: 'Enviado ✓',
    btnClose: 'Cerrar',
    btnRefresh: 'Actualizar',
    btnAssign: 'Asociar',
    btnDiscard: 'Descartar',
    btnAssigning: 'Asociando…',
    colDate: 'Fecha',
    colRef: 'Ref. Documento',
    colAmount: 'Importe',
    colStatus: 'Estado',
    colAction: 'Acción',
    colInvoice: 'Factura',
    colNotes: 'Albaranes',
    classicHeading: 'Verificación Albaranes/Facturas',
    classicComplete: 'Con Factura',
    classicMissing: 'Sin Factura',
    classicRequestAll: 'Solicitar todas las facturas faltantes',
    classicRequesting: 'Enviando…',
    classicSent: 'Enviadas ✓',
    classicRequestSingle: 'Solicitar factura',
    migrationTitle: 'Cómo activar la recepción automática de Extractos',
    migrationSubtitle: 'Crea las tablas statements y statement_rows en 2 clics:',
    migrationStep1: 'Haz clic en "Copiar SQL" a la derecha',
    migrationStep2: 'Abre SQL Editor, pega y haz clic en "Run"',
    migrationShowSQL: 'Mostrar SQL completo ▸',
    migrationCopySQL: 'Copiar SQL',
    migrationCopied: '¡Copiado!',
    kpiOk: 'Verificados OK',
    kpiMissing: 'Con anomalías',
    kpiAmount: 'Importe total',
    kpiTotal: 'Filas totales',
    months: ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'],
    unknownSupplier: 'Proveedor desconocido',
    loadError: 'No se pudieron cargar los resultados del extracto.',
    sendError: 'Error al enviar el recordatorio.',
    tabPending: 'Por confirmar',
    tabAll: 'Todos',
    unknownSenderQuickStripTitle: 'Prioridad: vincular proveedor ({n})',
    unknownSenderQuickStripAria: 'Acceso rápido a documentos sin proveedor vinculado',
    unknownSenderQuickStripChipTitle: 'Ir a este documento en la lista',
    emailSyncAutoSavedToday: '{n} guardados automáticamente hoy',
    bolleAperteOne: 'albarán abierto disponible',
    bolleApertePlural: 'albaranes abiertos disponibles',
    tagStatement: 'Extracto mensual',
    tagStatementOk: 'Extracto ✓',
    tagPending: 'Por procesar',
    tagBozzaCreata: '✦ Borrador creado',
    tagAssociated: 'Verificado',
    tagDiscarded: 'Descartado',
    labelReceived: 'Recibido:',
    labelDocDate: 'Fecha doc.:',
    openFile: 'Abrir archivo →',
    reanalyzeDocButton: 'Volver a analizar',
    reanalyzeDocTitle: 'Vuelve a leer el documento y emparejar el proveedor (correo, NIF/CIF, razón social).',
    reanalyzeDocSuccess: 'Análisis actualizado.',
    gotoFatturaDraft: 'Ir al borrador de factura →',
    gotoBollaDraft: 'Ir al borrador de albarán →',
    toggleAddStatement: 'Añadir al extracto',
    toggleRemoveStatement: 'Quitar del extracto',
    docKindEstratto: 'Extracto',
    docKindBolla: 'Albarán',
    docKindFattura: 'Factura',
    docKindOrdine: 'Pedido',
    docKindHintBolla: 'Marcar como albarán de entrega, no extracto ni factura a cruzar',
    docKindHintFattura: 'Marcar como factura para asociar con albaranes pendientes',
    docKindHintOrdine: 'Confirmación de pedido o PDF comercial: se guarda en las confirmaciones del proveedor (no albarán ni factura)',
    docKindGroupAria: 'Tipo de documento',
    finalizeNeedsSupplier: 'Vincula un proveedor para finalizar.',
    btnFinalizeFattura: 'Registrar factura (sin albarán)',
    btnFinalizeBolla: 'Crear albarán desde el archivo',
    btnFinalizeOrdine: 'Guardar en proveedor (pedido)',
    btnFinalizeStatement: 'Archivar extracto',
    btnFinalizing: 'Guardando…',
    finalizeSuccess: 'Documento registrado.',
    autoRegisterFatturaToast: 'Factura #{numero} de {fornitore} registrada automáticamente',
    noPendingDocs: 'No hay documentos para revisar',
    noDocsFound: 'No se encontraron documentos',
    noBolleAttesa: 'No hay albaranes pendientes disponibles',
    bolleDaCollegamentiSectionTitle: 'Albaranes por vincular',
    bollePendingNoneForThisSupplier: 'No hay albaranes pendientes para este proveedor.',
    bollesSearchAcrossAllSuppliers: 'Buscar en todos los proveedores',
    bollesShowOnlyThisSupplier: 'Solo este proveedor',
    bollesExtendedOtherSuppliersSubtitle: 'Otros albaranes (otros proveedores)',
    bollesMatchAssociateSupplierHint:
      'Vincula un proveedor para ver aquí sus albaranes pendientes, o busca en todo el sitio.',
    bollesFullSiteListSubtitle: 'Toda la sede',
    unknownSender: 'Remitente desconocido',
    sameAddressClusterHint:
      'Misma dirección que otros documentos en cola. Nombres de empresa (IA) en esas filas: {names}. Probablemente el mismo proveedor: vincula el mismo contacto.',
    btnCreateSupplierFromAi: 'Crear proveedor →',
    docTotalLabel: 'Total del documento:',
    exactAmount: 'Importe exacto',
    exceeds: 'Excedente',
    missingAmt: 'Faltan',
    doneStatus: 'Completado ✓',
    errorStatus: 'Error ✗',
    noBolleDelivery: 'No se encontraron albaranes para esta factura',
    bozzaCreataOne: 'borrador creado',
    bozzeCreatePlural: 'borradores creados',
    bozzaBannerSuffix: 'automáticamente por IA a partir de los archivos adjuntos. Verifica los datos y confirma cada documento.',
    kpiVerifiedOk: 'Verificados ✓',
    noEmailForSupplier: 'No hay email configurado para este proveedor',
    reconcileCorrette: 'Correctos',
    reconcileDiscrepanza: 'Discrepancia',
    reconcileMancanti: 'Faltantes',
    reconcileHeading: 'Comparación extracto vs base de datos',
    statusMatch: 'Coincide',
    statusMismatch: 'Importe distinto',
    statusMissingDB: 'No está en la BD',
    reconcileStatement: 'Extracto:',
    reconcileDB: 'BD:',
    loadingResults: 'Cargando resultados…',
    editSupplierTitle: 'Editar proveedor',
    supplierLinkFailed: 'No se pudo vincular el proveedor al documento.',
    assignFailed: 'No se pudo asignar a los albaranes.',
    autoLinkedSupplierOne: 'Proveedor vinculado automáticamente: {name}.',
    autoLinkedSupplierMany: '{count} documentos vinculados automáticamente a proveedores.',
    bulkAutoMatchSummary:
      'Análisis completado: {linked} proveedor(es) vinculado(s), {associated} documento(s) asociado(s) a albaranes.',
    bulkAutoMatchNone: 'No se pudo aplicar ningún emparejamiento automático a los documentos de la lista.',
    bulkAutoMatchButtonLabel: 'Emparejar todo',
    bulkAutoMatchButtonTitle:
      'Recarga la lista, vincula proveedores únicos y asocia albaranes cuando el total del documento coincide con uno o más albaranes abiertos.',
    bulkFinalizeToolbarGroupAria: 'Confirmar en bloque por tipo de documento seleccionado',
    bulkFinalizeKindTooltip:
      'Igual que Confirmar en la fila: registra todos los documentos del listado con tipo «{kind}» y proveedor ya asociado ({n}).',
    bulkFinalizeBulkOk: '{n} documentos confirmados ({kind}).',
    bulkFinalizeBulkPartial: '{ok} confirmados, {fail} no realizados ({kind}).',
    ocrFormatToggleTitle: 'Forzar interpretación numérica alternativa',
    allBolleInvoicedOk: 'Todos los albaranes tienen factura correspondiente — extracto verificado ✓',
    aiStatementTotalLabel: 'Total del extracto (IA):',
    statementLinkedBolleLine: '{matched}/{total} albaranes asociados',
    selectedSumLabel: 'Seleccionadas:',
    selectedBolle_one: '({n} albarán)',
    selectedBolle_other: '({n} albaranes)',
    receivedOn: 'Recibido el',
    stmtPdfDatesPrefix: 'En el PDF',
    stmtPdfIssuedLabel: 'Emitido',
    stmtPdfLastPaymentLabel: 'Último pago',
    stmtPdfSummaryTitle: 'Datos del PDF',
    stmtPdfMetaAccountNo: 'N.º de cuenta',
    stmtPdfMetaIssuedDate: 'Fecha de emisión',
    stmtPdfMetaCreditLimit: 'Límite de crédito',
    stmtPdfMetaAvailableCredit: 'Crédito disponible',
    stmtPdfMetaPaymentTerms: 'Condiciones de pago',
    stmtPdfMetaLastPaymentAmt: 'Último pago',
    stmtPdfMetaLastPaymentDate: 'Fecha del último pago',
    openPdf: 'Abrir PDF ↗',
    reanalyze: 'Volver a analizar',
    stmtListProcessing: 'Procesando…',
    stmtListParseError: 'Error de análisis',
    stmtRowsCount: '{n} filas',
    stmtAnomalies_one: '{n} anomalía',
    stmtAnomalies_other: '{n} anomalías',
    stmtBackToList: 'Volver a la lista',
    needsMigrationTitle: 'Tablas aún no creadas',
    needsMigrationBody:
      'Para activar la recepción automática de extractos, ejecuta la migración SQL. Las instrucciones están en la sección Cómo activar más abajo.',
    stmtInboxEmailScanning: 'Analizando el correo…',
    stmtInboxEmptyDetail:
      'Los extractos se detectan cuando llega un correo con asunto «Statement» o «Extracto de cuenta» y un PDF adjunto.',
    bolleSummaryByPeriod: 'Resumen de albaranes por periodo',
    bollePeriodEmpty: 'No hay albaranes en este periodo',
    clearFilter: 'Quitar filtro',
    rekkiCheckSegmentTooltip: 'El importe facturado no coincide con el pedido Rekki',
    tripleColStmtDate: 'Fecha extracto',
    tripleColSysDate: 'Fecha sistema',
    tripleColStmtAmount: 'Importe extracto',
    tripleColSysAmount: 'Importe sistema',
    tripleColChecks: 'Comprobaciones',
    statusCheckPending: 'Pendiente',
    statementVerifyBanner: 'Verificación de extracto',
    badgeAiRecognized: 'IA OK',
    badgeAiRecognizedTitle:
      'Proveedor enlazado. El emparejamiento automático con albaranes requiere importes coherentes y fechas dentro de ±30 días desde la fecha del documento o la recepción en la lista.',
    badgeNeedsHuman: 'Requiere asociación',
    rememberAssociationTitle: '¿Recordar esta asociación remitente–proveedor?',
    rememberAssociationSave: 'Guardar email del remitente',
    rekkiDocumentLink: 'Rekki',
  },
  appStrings: {
    brandFooter: 'Smart Pair · Gestión de compras',
    pageNotFoundTitle: 'Página no encontrada',
    pageNotFoundDesc: 'El enlace puede ser incorrecto o la página ya no existe.',
    notFoundInAppTitle: 'Contenido no disponible',
    notFoundInAppDesc:
      'El enlace no es válido, o el albarán o la factura ya no existe o no es visible con tu cuenta (permisos o sede).',
    docUnavailableBollaTitle: 'Albarán no encontrado',
    docUnavailableBollaDesc:
      'No hay ningún albarán con este enlace. Puede haberse eliminado, el enlace puede ser incorrecto o tu cuenta o sede no tienen acceso.',
    docUnavailableFatturaTitle: 'Factura no encontrada',
    docUnavailableFatturaDesc:
      'No hay ninguna factura con este enlace. Puede haberse eliminado, el enlace puede ser incorrecto o tu cuenta o sede no tienen acceso.',
    backToHome: 'Volver al panel',
    sedeLockTitle: 'Acceso protegido',
    sedeLockDescription: 'La sede {name} requiere un PIN numérico de 4 cifras.',
    sedeLockCodeLabel: 'PIN (4 cifras)',
    sedeLockPlaceholder: '••••',
    sedeLockPinLengthError: 'Introduce un PIN de 4 cifras.',
    sectionDates: 'Fechas',
    sectionCurrencyLabel: 'Moneda',
    loadingBolle: 'Cargando albaranes…',
    noOpenBolle: 'No hay albarán abierto para este proveedor.',
    invoiceNumOptional: 'N.º factura (opcional)',
    uploadDateLabel: 'Fecha de carga',
    uploadDateAutomatic: 'automática',
    registeredByFattura: 'Nombre de quien registró la factura…',
    registeredByBolla: 'Nombre de quien registró el albarán…',
    saveCloseNBolle: 'Guardar y cerrar {n} albaranes',
    colDeliveryNoteNum: 'N.º albarán',
    colAmountShort: 'Importe',
    labelImportoTotale: 'Importe total',
    labelPrezzoUnitario: 'Precio unitario',
    loadingPage: 'Cargando…',
    noAttachment: 'Sin adjunto',
    camera: 'Cámara',
    chooseFile: 'Elegir archivo',
    uploading: 'Subiendo…',
    deleteLogConfirm: '¿Eliminar este registro? No se puede deshacer.',
    imapConfigTitle: 'Configuración de correo',
    imapLookbackLabel: 'Días de retroceso (email)',
    imapLookbackLastDays: 'Lee correo (leído y no leído) de los últimos {n} días',
    imapLookbackUnlimited: 'Lee todo el correo de la bandeja de entrada (leído y no leído, sin límite de días)',
    imapLookbackFootnote: 'Vacío = sin límite. Recomendado: 30–90 días.',
    emailSaved: 'Configuración de correo guardada.',
    addOperatorsTitle: 'Añadir operadores',
    addOperatorBtn: 'Añadir operador',
    savingShort: 'Guardando…',
    newSedeShort: 'Nueva',
    deleteUserConfirm: '¿Eliminar al usuario {email}? No se puede deshacer.',
    deleteSedeConfirm: '¿Eliminar la sede "{nome}"? Los datos vinculados perderán la referencia a la sede.',
    deleteFornitoreConfirm: '¿Eliminar el proveedor "{nome}"? No se puede deshacer.',
    contactsHeading: 'Contactos',
    contactNew: 'Nuevo contacto',
    contactEdit: 'Editar contacto',
    contactRemove: 'Eliminar',
    contactRemovePrice: 'Quitar último precio',
    noContacts: 'Sin contactos',
    infoSupplierCard: 'Ficha del proveedor',
    contactsLegal: 'Domicilio social',
    contactsFiscal: 'Datos fiscales',
    contactsPeople: 'Contactos',
    noContactRegistered: 'Sin contacto registrado',
    noEmailSyncHint: 'Sin email, el escáner no podrá asociar automáticamente los documentos de este proveedor.',
    noEmailSyncWarning: 'Sin email asociado — los documentos no se reconocerán automáticamente.',
    filterNoEmail: 'Sin email',
    suggestEmailBtn: 'Buscar email',
    suggestEmailSearching: 'Buscando…',
    suggestEmailNoResults: 'No se encontraron emails en los registros existentes.',
    suggestEmailSave: 'Agregar',
    suggestEmailSaved: 'Guardado',
    suggestEmailSourceLog: 'del log de sync',
    suggestEmailSourceQueue: 'de la cola de documentos',
    suggestEmailSourceUnmatched: 'de NIF no asociado',
    suggestEmailTitle: 'Emails encontrados en documentos recibidos',
    noAddressRegistered: 'Sin dirección registrada',
    noFiscalRegistered: 'Sin datos fiscales',
    clientSince: 'Cliente desde',
    fromInvoiceBtn: 'Desde factura',
    listinoAnalyze: 'Analizar',
    listinoAnalyzing: 'Análisis con IA…',
    listinoInvoiceAnalyzedBadge: 'Analizada',
    listinoNoInvoicesFile: 'Ninguna factura con archivo adjunto para este proveedor.',
    listinoNoProducts: 'No se encontraron líneas en esta factura. Prueba otra.',
    saveNProducts: 'Guardar {n} productos',
    clickAddFirst: 'Pulsa Añadir para introducir el primer producto.',
    monthNavResetTitle: 'Ir al mes actual',
    monthNavPrevMonthTitle: 'Mes anterior',
    monthNavNextMonthTitle: 'Mes siguiente',
    monthNavPrevYearTitle: 'Año anterior',
    monthNavNextYearTitle: 'Año siguiente',
    supplierDesktopPeriodPickerTitle: 'Periodo (fechas)',
    supplierDesktopPeriodPickerButtonAria: 'Abrir para definir las fechas Desde / Hasta del periodo',
    supplierDesktopPeriodFromLabel: 'Desde',
    supplierDesktopPeriodToLabel: 'Hasta',
    supplierDesktopPeriodApply: 'Aplicar',
    addingAlias: 'Añadiendo…',
    addEmailAlias: '+ Añadir email',
    listinoImportPanelTitle: 'Importar productos desde factura',
    listinoImportSelectInvoiceLabel: 'Seleccionar factura',
    listinoImportProductsSelected: '{selected} / {total} productos seleccionados',
    listinoImportPriceListDateLabel: 'Fecha del tarifario',
    listinoImportColListinoDate: 'Últ. actualización listino',
    listinoImportDateOlderThanListinoHint:
      'La fecha del documento es anterior al último listino guardado; no se importa sin forzar.',
    listinoImportApplyOutdatedAdmin: 'Aplicar como precio actual',
    listinoImportApplyOutdatedAdminActive: 'Forzado activo',
    listinoImportForceAllSelected: 'Forzar importación en todas las filas seleccionadas',
    listinoImportPartialSaved:
      'Guardadas {inserted} filas; {skipped} no importadas (productos: {products}).',
    listinoManualDateBlockedHint: 'La fecha es anterior al último listino para este nombre de producto.',
    listinoManualDateBlockedNoAdmin: 'Solo un administrador puede forzar la inserción.',
    listinoImportSaveBlockedHintAdmin: 'Activa «Aplicar como precio actual» en las filas resaltadas.',
    listinoImportSaveBlockedHintOperator:
      'Algunas filas tienen fecha anterior al listino: usa «Aplicar como precio actual» fila a fila, o «Forzar importación en todas las filas seleccionadas», o desmárcalas.',
    listinoDocDetailImportHint:
      'El import de listino (proveedor → Listino) compara la fecha del documento con el último guardado por producto.',
    listinoDocDetailImportHintAdmin: 'En import desde factura puedes forzar fila a fila.',
    listinoDocRowBlockedBadge: 'Listino más reciente',
    listinoDocForceButton: 'Forzar actualización listino',
    listinoDocForceWorking: 'Guardando…',
    listinoDocForceOk: 'Precio guardado con la fecha del documento.',
    listinoDocForceErr: 'No se pudo forzar.',
    discoveryCreateSupplier: 'Crear nuevo proveedor',
    discoveryCompanyName: 'Razón social *',
    discoveryEmailDiscovered: 'Email (detectado)',
    discoveryVat: 'NIF/CIF',
    discoveryBranch: 'Sede',
    discoveryBreadcrumbSettings: 'Configuración',
    discoveryTitle: 'Explorador de bandeja',
    discoveryNoImap: 'No hay cuentas IMAP configuradas',
    discoveryNoImapHint: 'Configura IMAP en la sede (Sedes) para activar el escaneo.',
    discoveryPartialScan: 'Escaneo parcial — algunos buzones tuvieron errores:',
    discoveryAllRegistered: 'Todos los remitentes ya están registrados',
    discoveryNoUnknown: 'Sin remitentes desconocidos con adjuntos en los últimos 30 días.',
    discoveryReady: 'Listo para escanear',
    discoveryReadyHint: 'Pulsa Escanear bandeja para analizar los últimos 30 días y descubrir proveedores.',
    discoveryScanBtn: 'Escanear bandeja',
    toastDismiss: 'Cerrar aviso',
    countrySaving: 'Guardando…',
    countrySaved: 'Guardado',
    sidebarSediTitle: 'Sedes',
    deleteGenericConfirm: '¿Eliminar este elemento? No se puede deshacer.',
    deleteFailed: 'Error al eliminar:',
    errorGenericTitle: 'Se ha producido un error',
    errorGenericBody: 'Un error inesperado ha interrumpido la aplicación. Inténtalo de nuevo o vuelve al inicio.',
    tryAgain: 'Reintentar',
    errorCodeLabel: 'Código de error:',
    errorSegmentTitle: 'Error al cargar esta sección',
    errorSegmentBody: 'No se pudo cargar esta sección. Inténtalo de nuevo o vuelve atrás.',
    errorDevDetailsSummary: 'Detalles del error (solo desarrollo)',
    errorFatalTitle: 'Error crítico',
    errorFatalBody: 'La aplicación encontró un problema inesperado.',
    approvazioni_pageSub: 'Facturas pendientes de aprobación por encima del umbral',
    analyticsPageSub: 'Resumen de compras y conciliación',
    analyticsMonths: '{n} meses',
    attivitaPageTitle: 'Registro de Actividad',
    attivitaPageSub: 'Historial completo de operaciones de los operadores',
    attivitaExportCsv: 'Exportar CSV',
    attivitaAllOperators: 'Todos los operadores',
    attivitaRemoveFilters: 'Quitar filtros',
    analyticsErrorLoading: 'Error al cargar datos',
    analyticsNoData: 'Sin datos disponibles.',
    analyticsKpiTotalInvoiced: 'Total facturado',
    analyticsKpiNFatture: '{n} facturas',
    analyticsKpiReconciliation: 'Conciliación',
    analyticsKpiCompleted: '{n} completadas',
    analyticsKpiAvgTime: 'Tiempo medio de conciliación',
    analyticsKpiDays: '{n} días',
    analyticsKpiDaysFrom: 'días desde el albarán hasta la factura',
    analyticsKpiSlow: 'lento',
    analyticsKpiOk: 'ok',
    analyticsKpiPriceAnomalies: 'Anomalías de precios',
    analyticsKpiResolvedOf: '{n} resueltas de {total}',
    analyticsKpiToCheck: 'a verificar',
    analyticsKpiAllOk: 'todo ok',
    analyticsChartMonthlySpend: 'Gasto mensual',
    analyticsChartAmount: 'Importe',
    analyticsChartInvoices: 'Facturas',
    analyticsChartTopSuppliers: 'Top proveedores',
    analyticsChartNoData: 'Sin datos',
    analyticsChartBolleVsFatture: 'Albaranes vs Facturas',
    analyticsChartDeliveryNotes: 'Albaranes',
    analyticsSummaryPendingDocs: 'Documentos pendientes',
    analyticsSummaryPendingNotes: 'Albaranes en espera',
    analyticsSummaryArchivedInvoices: 'Facturas archivadas',
    approvazioni_noPending: 'Sin facturas pendientes',
    approvazioni_allReviewed: 'Todas las facturas por encima del umbral han sido revisadas.',
    approvazioni_viewInvoice: 'Ver factura →',
    approvazioni_rejectReason: 'Motivo de rechazo (opcional)',
    approvazioni_rejectPlaceholder: 'Ej: importe no coincide con el albarán...',
    approvazioni_confirmReject: 'Confirmar rechazo',
    approvazioni_approve: 'Aprobar',
    approvazioni_reject: 'Rechazar',
    approvazioni_threshold: 'umbral',
    attivitaFilterAll: 'Todos',
    attivitaFilterBolle: 'Albaranes',
    attivitaFilterFatture: 'Facturas',
    attivitaFilterDocumenti: 'Documentos',
    attivitaFilterOperatori: 'Operadores',
    attivitaError: 'No se pueden cargar las actividades.',
    attivitaNoRecent: 'Sin actividad reciente',
    attivitaRecentTitle: 'Actividad reciente',
    rekkiSyncTitle: 'Sincronización Email Rekki',
    rekkiSyncDesc: 'Escanea el correo de la sede y asocia automáticamente los pedidos Rekki',
    rekkiSyncMobileTap: 'Sincronizar Emails Rekki',
    rekkiSyncNeverRun: 'Nunca ejecutado',
    rekkiSyncTapUpdate: 'toca para actualizar',
    rekkiSyncTapStart: 'toca para iniciar',
    rekkiSyncButtonLabel: 'ESCANEAR ALBARÁN / FACTURA',
    rekkiSyncInProgress: 'Escaneo en curso',
    rekkiSyncProcessing: 'Procesando emails Rekki…',
    rekkiSyncStop: 'Detener',
    rekkiSyncCheckNow: 'Comprobar ahora',
    rekkiSyncStarting: 'Iniciando escaneo...',
    rekkiSyncDays: '{n} días',
    rekkiSyncLastScan: 'Último escaneo',
    rekkiSyncEmails: 'Emails',
    rekkiSyncDocuments: 'Documentos',
    rekkiSyncMatched: 'Asociados',
    rekkiSyncUnmatched: 'Por asociar',
    rekkiSyncRecentEmails: 'Últimos emails procesados',
    rekkiSyncNoData: 'Sin precios detectados',
    rekkiSyncNoDataDesc: 'Pulsa “Comprobar ahora” para escanear los emails Rekki de {nome}',
    rekkiImapNotConfigured: 'Correo no configurado',
    rekkiImapNotConfiguredDesc: 'Configura las credenciales IMAP en Configuración → Sede para activar la sincronización.',
    rekkiPhaseQueued: 'En cola...',
    rekkiPhaseConnect: 'Conectando al correo...',
    rekkiPhaseSearch: 'Buscando emails Rekki...',
    rekkiPhaseProcess: 'Procesando emails...',
    rekkiPhasePersist: 'Guardando datos...',
    rekkiPhaseDone: 'Completado',
    rekkiPhaseError: 'Error',
    rekkiDoneResult: 'Completado — {n} emails procesados',
    rekkiErrUnknown: 'Error desconocido',
    rekkiErrNetwork: 'Error de red',
    analyticsSinceFY: 'desde inicio del EF',
    backupPageTitle: 'Copia de Seguridad',
    backupPageDesc: 'Exportaciones CSV automáticas semanales · Cada lunes a las 02:00 UTC',
    auditTitle: 'Auditoría de Recuperación',
    auditDesc: 'Analiza todas las facturas históricas para identificar sobreprecios respecto a los precios Rekki acordados',
    auditDateFrom: 'Desde',
    auditDateTo: 'Hasta',
    auditRunBtn: 'Ejecutar Auditoría',
    auditRunning: 'Analizando...',
    auditSyncConfirm: 'Esta operación analizará todas las facturas históricas y actualizará las fechas de referencia en el tarifario. ¿Continuar?',
    auditSyncTitle: 'Sincronizar Historial con Rekki',
    auditSyncDesc: 'Analiza todas las facturas pasadas y actualiza automáticamente las fechas de referencia para eliminar los bloqueos «Fecha de documento anterior»',
    auditSyncBtn: 'Sincronizar',
    auditSyncing: 'Sincronizando...',
    auditKpiSpreco: 'Derroche Total',
    auditKpiAnomalies: 'Anomalías',
    auditKpiProducts: 'Productos',
    auditKpiFatture: 'Facturas',
    auditNoOvercharges: '¡Sin sobreprecios detectados!',
    auditNoOverchargesDesc: 'Todos los precios facturados están en línea o por debajo de los precios Rekki acordados',
    auditColFattura: 'Factura',
    auditColProdotto: 'Producto',
    auditColPagato: 'Pagado',
    auditColPattuito: 'Acordado',
    auditColSpreco: 'Derroche',
    auditHelpTitle: '¿Cómo funciona la auditoría?',
    auditHelpP1: 'La auditoría analiza todas las facturas del periodo seleccionado y:',
    auditHelpLi1: 'Extrae las líneas de cada factura usando IA',
    auditHelpLi2: 'Compara los precios pagados con los precios Rekki acordados (tarifario)',
    auditHelpLi3: 'Identifica todos los casos en que se pagó un precio superior',
    auditHelpLi4: 'Calcula el derroche total en base a la cantidad comprada',
    auditHelpCta: '💡 Usa este informe para solicitar notas de crédito al proveedor',
    auditErrStatus: 'Error {status}',
    auditErrGeneric: 'Error durante la auditoría',
    auditErrSync: 'Error durante la sincronización',
    auditCsvDate: 'Fecha',
    auditCsvInvoiceNum: 'Número de factura',
    auditCsvProduct: 'Producto',
    auditCsvRekkiId: 'ID Rekki',
    auditCsvPaid: 'Pagado',
    auditCsvAgreed: 'Acordado',
    auditCsvDiffPct: 'Diferencia %',
    auditCsvQty: 'Cantidad',
    auditCsvWaste: 'Derroche',
    sedeErrCreating: 'Error al crear la sede.',
    sedeErrSavingProfile: 'Error al guardar el perfil.',
    sedePinUpdated: 'PIN actualizado.',
    sedeErrUpdatingPin: 'Error al actualizar el PIN.',
    sedeErrSavingPin: 'Error al guardar el PIN de sede.',
    sedeLocSaved: 'Localización guardada.',
    sedeErrLoadData: 'Error al cargar los datos.',
    sedeErrUpdating: 'Error al actualizar la sede.',
    sedeUpdated: 'Sede actualizada.',
    sedeDeleted: 'Sede eliminada.',
    sedeErrSavingImap: 'Error al guardar la configuración IMAP.',
    sedeWizardStepOf: 'Paso {step} de 3',
    sedeWizardNext: 'Siguiente',
    sedeWizardBack: '← Atrás',
    sedeWizardSkip: 'Omitir',
    sedeWizardNameLabel: 'Nombre de la sede',
    sedeWizardEmailConfigTitle: 'Configuración de email',
    sedeWizardEmailConfigDesc: 'Para recibir facturas por email. Puedes configurarlo después.',
    sedeWizardAppPassRequired: 'Contraseña de aplicación requerida.',
    sedeWizardAddOperatorsTitle: 'Añadir operadores',
    sedeWizardAddOperatorsDesc: 'Los operadores acceden con nombre + PIN (mín. 4 cifras).',
    sedeWizardCreateBtn: 'Crear sede + {n} operadores',
    sedeWizardCreatingBtn: 'Creando…',
    sedeWizardStartSetup: 'Iniciar configuración guiada',
    sedeEmailNotConfigured: 'Email no configurado.',
    sedeCreatedSuccess: 'Sede "{nome}" creada con éxito.',
    gmailBadgeTitle: '💡 ¿Listo para la auditoría de precios?',
    gmailBadgeDescConfigured: '¡Gmail API está configurado! Conecta tu cuenta para activar el escáner automático y recuperar posibles reembolsos en {nome}.',
    gmailBadgeDescNotConfigured: 'Configura Gmail (2 min) para analizar automáticamente los correos de {nome} e identificar cobros no autorizados.',
    gmailBadgeCTAConnect: 'Conectar y Escanear',
    gmailBadgeCTASetup: 'Configurar Ahora',
    gmailBadgeDismiss: 'Ocultar',
    gmailBadgeAPIConfigured: 'API Configurado',
    gmailBadgeConnectAccount: 'Conectar Cuenta',
    gmailBadgePriceCheck: 'Control de Precios',
    gmailBadgePriceCheckSub: 'Anomalías auto',
    gmailBadgeRecoverySub: 'Historial 2 años',
    autoSyncTitle: 'Auto-Sync Factura',
    autoSyncDesc: 'Extrae y compara automáticamente los productos de la factura con el listino',
    autoSyncBtn: 'Analizar Factura',
    autoSyncBtnLoading: 'Analizando...',
    autoSyncTotal: 'Total',
    autoSyncAnomalies: 'Anomalías',
    autoSyncNewItems: 'Nuevos',
    autoSyncProduct: 'Producto',
    autoSyncPrice: 'Precio',
    autoSyncNewItem: 'Nuevo',
    autoSyncAnomalyWarning: '{n} producto{s} con aumento anómalo',
    autoSyncConfirmBtn: 'Confirmar {n} productos',
    autoSyncImporting: 'Importando...',
    autoSyncErrAnalysis: 'Error durante el análisis',
    autoSyncErrImport: 'Error durante la importación',
  },
}

const fr: Translations = {
  ui: {
    tagline:          'Gestion des Achats',
    closeMenu:        'Fermer le menu',
    expandSidebar:    'Développer la barre',
    navMore:            'Plus',
    collapseSidebar:  'Réduire la barre',
    changeOperator:   'Changer d\'opérateur',
    changeOperatorShort: 'Changer',
    selectOperator:   'Sélectionner un opérateur',
    activeOperator:   'Actif',
    noOperator:       'Aucun',
    operatorLabel:    'Opérateur',
    operatorChanged:  'Opérateur changé avec succès',
    noOperatorsFound: 'Aucun opérateur trouvé pour ce site.',
    noSedeForOperators: 'Aucun site n’est associé. Ajoutez un site ou liez votre profil admin à un site.',
    currentlyActive:  'Actif :',
    languageTooltip:  'Langue',
    syncError:        'Erreur lors de l\'analyse.',
    syncSuccess:      'Synchronisation terminée.',
    networkError:     'Erreur réseau. Réessayez.',
    connectionOnline: 'En ligne',
    connectionOffline: 'Hors ligne',
    connectionReconnecting: 'Reconnexion…',
    emailSyncResumed: 'Connexion rétablie — reprise de la synchronisation e-mail.',
    emailSyncStreamIncomplete:
      'La synchronisation n’a pas abouti (connexion interrompue). Réessayez.',
    emailSyncAlreadyRunning:
      'Une synchronisation est déjà en cours. Attendez la fin ou annulez-la depuis la barre en haut.',
    emailSyncCancelled: 'Synchronisation e-mail interrompue.',
    reminderError:    'Erreur lors de l\'envoi des rappels.',
    noReminders:      'Aucun rappel à envoyer (fournisseurs sans email ?).',
    remindersCount:   'rappel',
    remindersSentOne: '1 relance envoyée sur {total}.',
    remindersSentMany: '{n} relances envoyées sur {total}.',
    pinError:         'PIN incorrect.',
    operatorPinStepUpTitle: 'Confirmation opérateur',
    operatorPinStepUpHint: 'Saisissez le PIN à 4 chiffres de l’opérateur actif pour autoriser cette modification.',
    operatorPinStepUpNoActive:
      'Aucun opérateur actif pour cette session. Utilisez le bouton ci-dessous (barre du bas sur mobile ou menu latéral), choisissez qui opère, puis saisissez le PIN.',
    operatorPinStepUpChooseOperator: 'Choisir l’opérateur',
    verifyAndContinue: 'Continuer',
    operatorAutoLockLabel: 'Verrouillage auto après',
    operatorAutoLockNever: 'Jamais',
    operatorAutoLockMinutes: '{n} min',
    sidebarSedeActive: 'Site actif : {name}',
    sidebarSedeSwitchTo: 'Passer à : {name}',
    sidebarSedeSettings: 'Paramètres de {name}',
    appBuildLine: 'v{version} · {commit} · {env}',
    appBuildLineLocal: 'v{version} · {commit}',
    appBuildNoCommit: '—',
    appBuildAria: "Version de l'app et build de déploiement",
    deployEnvLocal: 'local',
    deployEnvProduction: 'production',
    deployEnvPreview: 'prévisualisation',
    deployEnvDevelopment: 'développement',
  },
  login: {
    brandTagline: 'Gestion des factures',
    subtitle: 'Accès : votre nom et code à 4 chiffres',
    adminSubtitle: 'Portail de gestion',
    adminSubtitleHint:
      'E-mail et mot de passe pour le portail de gestion. Pour le nom d’opérateur et le PIN, utilisez « Accès opérateur » (admins de site et opérateurs).',
    nameLabel: 'Nom',
    namePlaceholder: '',
    pinLabel: 'PIN',
    pinDigits: '(4 chiffres)',
    lookingUp: 'Vérification du nom…',
    enterFirstName: 'Saisissez le nom et appuyez sur Tab',
    emailLabel: 'Email',
    emailPlaceholder: 'admin@entreprise.fr',
    passwordLabel: 'Mot de passe',
    passwordPlaceholder: '6 caractères minimum',
    loginBtn: 'Se connecter',
    adminLink: 'Portail de gestion →',
    operatorLink: '← Accès opérateur',
    pinIncorrect: 'PIN incorrect. Réessayez.',
    invalidCredentials: 'Identifiants invalides.',
    verifying: 'Vérification…',
    accessing: 'Connexion…',
    notFound: 'Utilisateur introuvable.',
    adminOnlyEmail: 'Cet accès est réservé aux administrateurs. Utilisez nom et PIN ou demandez un compte admin.',
    adminGateLabel: 'Code de déverrouillage admin',
    adminGateHint: 'Saisissez le PIN pour déverrouiller e-mail et mot de passe.',
    adminGateWrong: 'Code invalide.',
    sessionGateTitle: 'Confirmer l’accès',
    sessionGateSubtitle: 'Nouvelle session : saisissez à nouveau votre nom et le PIN à 4 chiffres pour continuer.',
    sessionGateWrongUser: 'Ce nom ne correspond pas au compte avec lequel vous êtes connecté.',
    sessionBootStuck: 'Le profil n’a pas chargé à temps. Veuillez vous reconnecter.',
    netflixTitle: 'Qui est de service ?',
    netflixSubtitle: 'Appuyez sur votre nom pour vous connecter',
    netflixManualLogin: 'Nom introuvable ? Connexion manuelle →',
    netflixChangeOperator: '← Changer d’opérateur',
    deviceTrustTitle: 'Se connecter automatiquement sur cet appareil la prochaine fois ?',
    deviceTrustYes: 'Oui, se souvenir de moi',
    deviceTrustNo: 'Non merci',
    deviceWelcomeBack: 'Bon retour, {name} !',
    deviceWelcomeAccediHint: 'Appareil reconnu — continuez lorsque vous êtes prêt(e).',
    accessoSwitchOperator: 'Changer d’opérateur',
  },
  nav: { dashboard: 'Tableau de bord', dashboardAdmin: 'Admin', operatori: 'Opérateurs', fornitori: 'Fournisseurs', bolle: 'Bons de livraison', fatture: 'Factures', ordini: 'Commandes', archivio: 'Archive', logEmail: 'Journal email', sedi: 'Site et Utilisateurs', sediTitle: 'Site', sediNavGroupMaster: 'Sites', gestisciSedeNamed: 'Gérer {name}', gestisciSedi: 'Gérer les sites', tuttiFornitori: 'Tous les fournisseurs', cerca: 'Rechercher…', nessunRisultato: 'Aucun résultat', altriRisultati: 'de plus — cherchez ci-dessus', impostazioni: 'Paramètres', nuovaBolla: 'Nouveau BL', ricevuto: 'Reçu', operatorActiveHint: 'Indiquez qui est actif', esci: 'Déconnexion', guida: 'Aide', sedeGlobalOverview: 'Vue globale', bottomNavBackToSede: 'Retour au site', bottomNavScannerAi: 'Scanner IA', bottomNavProfile: 'Profil', bottomNavSediMap: 'Carte des sites', bottomNavGlobalReports: 'Rapports globaux', bottomNavNewOrder: 'Nouvelle commande', bottomNavPriceHistory: 'Historique des prix', bottomNavContact: 'Contacter', addNewDelivery: 'Nouveau BL', openRekki: 'Rekki', ariaMain: 'Navigation principale', ariaAdmin: 'Navigation administrateur', ariaFornitore: 'Navigation fournisseur', ariaCallSupplier: 'Appeler le fournisseur', notifications: 'Notifications', noNotifications: 'Aucune notification', errorAlert: 'Erreurs de synchro (24h)', analytics: 'Analytics', approvazioni: 'Approbations', attivita: 'Activité', backup: 'Sauvegarde', consumiAi: 'Consommation IA', strumenti: 'Outils' },
  strumentiCentroOperazioni: {
    pageTitle: 'Centre des opérations',
    pageSubtitle:
      'Raccourcis OCR, doublons, rattachements fournisseur et tarifs. Les boutons sur chaque document restent disponibles.',
    breadcrumbTools: 'Outils',
    sectionOcr: 'OCR & documents',
    sectionDup: 'Doublons & nettoyage',
    sectionListino: 'Tarifs & prix',
    cardReanalyzeTitle: 'Relancer l’OCR (file & IA)',
    cardReanalyzeDesc:
      'Documents en attente, classification IA et suggestions Gemini — comme AI Inbox. Sur un BL ou une facture utilisez aussi « Réanalyse (OCR) » sur la ligne.',
    cardOpenInbox: 'Ouvrir AI Inbox',
    cardRefreshDateTitle: 'Relire la date depuis la PJ',
    cardRefreshDateDesc: 'Sur une facture utilisez « Relire la date » à côté de la date (PJ requise).',
    cardOpenFatture: 'Ouvrir les factures',
    cardOcrCheckTitle: 'Contrôle OCR fournisseur',
    cardOcrCheckDesc:
      'Sur la fiche fournisseur (bureau) le bouton « Contrôle OCR » relance massivement les dates suspectes.',
    cardOpenFornitoreSheet: 'Ouvrir les fournisseurs',
    cardDupScanTitle: 'Rechercher les factures en double',
    cardDupScanDesc: 'Même analyse que la barre du tableau : même fournisseur, même date et même numéro.',
    cardDupManageTitle: 'Gestion des doublons',
    cardDupManageDesc: 'BL, factures et fournisseurs : analyser les groupes et fusionner ou supprimer les copies.',
    cardDupManageCta: 'Ouvrir la gestion des doublons',
    cardAuditTitle: 'Audit des rattachements fournisseur',
    cardAuditDesc: 'Aligner les e-mails expéditeurs et les fournisseurs — onglet Rattachements dans AI Inbox.',
    cardOpenAudit: 'Ouvrir l’onglet Rattachements',
    cardListinoAutoTitle: 'Mise à jour auto du tarif (Auto)',
    cardListinoAutoDesc: 'Onglet Tarifs du fournisseur : analyse automatiquement les factures non encore traitées.',
    cardListinoFromInvTitle: 'Importer depuis une facture',
    cardListinoFromInvDesc:
      'Onglet Tarifs : choisir une facture avec PDF et valider les lignes à importer.',
    cardListinoAddTitle: 'Ajouter un produit au tarif',
    cardListinoAddDesc: 'Onglet Tarifs : bouton Ajouter pour saisie manuelle (bureau).',
    cardListinoCta: 'Aller aux fournisseurs — onglet Tarifs',
    manualImapSyncTitle: 'Sync e-mail — fenêtre 24 h',
    manualImapSyncDesc:
      'Recherche les messages des dernières ~24 heures. Le cron planifié n’indexe que 3 heures pour limiter la charge.',
    historicSyncSectionLabel: 'Sync historique (année précédente)',
    historicSyncTitle: 'Importer les données de l’année précédente',
    historicSyncDesc:
      'Télécharge les e-mails des derniers ~365 jours pour comparer avec l’exercice fiscal 2025/26.',
    historicSyncWarning: '⚠️ Opération lente — peut prendre plusieurs minutes. À lancer une seule fois.',
    historicSyncCta: 'Démarrer la sync historique',
    historicSyncResult: '{n} documents importés pour l’année précédente',
    historicSyncProgress: 'Traitement : {label}…',
    historicSyncCompleted: 'Terminé !',
    hintContextualShortcuts:
      'Les actions ligne par ligne (réanalyse OCR sur BL/facture), « Vers factures », « Import auto / depuis facture / Ajouter » restent dans le tarif.',
  },
  common: { save: 'Enregistrer', cancel: 'Annuler', delete: 'Supprimer', edit: 'Modifier', new: 'Nouveau', loading: 'Chargement...', error: 'Erreur', success: 'Succès', noData: 'Aucune donnée', document: 'Document', actions: 'Actions', date: 'Date', status: 'Statut', supplier: 'Fournisseur', notes: 'Notes', phone: 'Téléphone', saving: 'Enregistrement...', attachment: 'Pièce jointe', openAttachment: 'Ouvrir la pièce jointe', detail: 'Détail', add: 'Ajouter', rename: 'Renommer', role: 'Rôle', aiExtracted: 'Données extraites par IA', matched: 'Associé', notMatched: 'Non associé', recordSupplierLinked: 'Lié', company: 'Société', invoiceNum: 'N° Facture', documentRef: 'Référence', total: 'Total', duplicateBadge: 'DOUBLON', emailSyncAutoSavedBadge: 'Enregistrement automatique', viewerZoomIn: 'Zoom +', viewerZoomOut: 'Zoom −', viewerZoomReset: '100 %', viewerZoomHint: 'Ctrl + molette ou boutons' },
  status: { inAttesa: 'En attente', completato: 'Complété', completata: 'Complétée' },
  dashboard: { title: 'Tableau de bord', suppliers: 'Fournisseurs', totalBills: 'Total BL', pendingBills: 'BL en attente', invoices: 'Factures', recentBills: 'BL récents', recentBillsMobileListDisabled: 'La liste détaillée n’est pas affichée sur cet écran. Utilisez « Voir tout » pour ouvrir l’archive ou passez à un affichage plus large.', viewAll: 'Voir tout →', syncEmail: 'Sync Email', emailSyncScopeLookback: 'Jours récents (site)', emailSyncScopeFiscal: 'Exercice fiscal', emailSyncFiscalYearSelectAria: 'Période de synchronisation e-mail', emailSyncScopeHint: 'IT, FR, DE, ES : année civile. UK : exercice se terminant le 5 avr. Chaque site utilise son pays.', emailSyncLookbackSedeDefault: 'Défaut du site (IMAP)', emailSyncLookbackDaysN: '{n} derniers jours', emailSyncLookbackDaysAria: 'Combien de jours en arrière chercher dans la boîte', emailSyncLookbackDaysHint: 'Défaut du site : utilise les jours définis sur la fiche site. Sinon limite la recherche IMAP aux N derniers jours (lus et non lus).', emailSyncDocumentKindAria: 'Type de documents à importer lors de la synchro e-mail', emailSyncDocumentKindHint: 'Tout : défaut. Nouveau fournisseur : expéditeurs absents de l’annuaire. BL / Facture : force le type de brouillon. Relevé : e-mails dont l’objet ressemble à un relevé (statement).', emailSyncDocumentKindAll: 'Tous les documents', emailSyncDocumentKindFornitore: 'Nouveau fournisseur', emailSyncDocumentKindBolla: 'Bon de livraison (BL)', emailSyncDocumentKindFattura: 'Facture', emailSyncDocumentKindEstratto: 'Relevé / extrait', syncing: 'Synchronisation...', sendReminders: 'Envoyer les relances', sending: 'Envoi en cours...', viewLog: 'Voir Log', sedeOverview: 'Vue par Site', manageSedeNamed: 'Gérer {name} →', manageSedi: 'Gérer les sites →', sedeImapOn: 'E-mail active', digitalizzaRicevuto: 'Numériser le reçu', scannerFlowCardTitle: 'Scanner — aujourd’hui', scannerFlowCardHint: 'PDF traités par l’IA et documents enregistrés aujourd’hui pour ce site (fuseau des réglages).', scannerFlowAiElaborate: 'Traitées (IA)', scannerFlowArchived: 'Archivées', scannerFlowOpenScanner: 'Nouveau scan', scannerFlowBolleHubTitle: 'Archive des BL', scannerFlowRecentTitle: 'Activité Scanner AI récente', scannerFlowNoRecent: 'Aucun scan récent. Utilisez Scanner AI (barre du bas) ou lancez un nouveau scan.', scannerFlowTodayCounts: 'Aujourd’hui : {ai} traitées (IA) · {arch} archivées', scannerFlowFiscalPeriodLine: 'Exercice {year}', scannerFlowCardHintFiscal: 'Les totaux suivent l’exercice sélectionné en tête de page (pas seulement aujourd’hui).', scannerFlowDetailListCountRange: '{n} documents sur la période', scannerFlowDetailListCountToday: '{n} documents aujourd’hui', scannerFlowDetailEmptyRange: 'Aucun document sur cette période.', scannerFlowStepAiElaborata: 'PDF analysé par l’IA — texte et données extraits (OCR)', scannerFlowStepArchiviataBolla: 'Bon de livraison enregistré et archivé', scannerFlowStepArchiviataFattura: 'Facture enregistrée et archivée', scannerFlowTodayActivityTitle: 'Activité du jour', scannerFlowNoEventsToday: 'Aucune activité Scanner IA enregistrée aujourd’hui pour ce site.', scannerFlowEventsAllLink: 'Journal complet des événements →', scannerFlowEventsPageTitle: 'Scanner IA — événements', scannerFlowEventsEmpty: 'Aucun événement Scanner enregistré.', scannerFlowEventsPrev: 'Précédent', scannerFlowEventsNext: 'Suivant', scannerFlowEventsPageOf: 'Page {current} sur {pages}', scannerMobileTileTap: 'Touchez pour commencer', duplicateFattureScanButton: 'Rechercher factures en double', duplicateFattureToolbarShort: 'Doublons', sendRemindersToolbarShort: 'Relances', syncEmailToolbarShort: 'Sync mail', emailSyncCronLine: '🟢 Sync auto — dernière : {relative}', emailSyncCronIssueLine: '⚠️ Problème IMAP — dernière : {relative}', emailSyncCronNever: 'jamais', emailSyncCronJustNow: 'à l’instant', emailSyncCronMinutesAgo: 'il y a {n} min', emailSyncCronHoursAgo: 'il y a {n} h', emailSyncCronLateLine: '🟡 Sync en retard — dernière : {relative}', emailSyncCronStoppedLine: '🔴 Sync à l’arrêt — dernière : {relative}', emailSyncForceSync: 'Forcer la sync', emailSyncEmergencyToolsAria: 'Outils — lancer une sync e-mail manuelle (urgence)', duplicateFattureModalTitle: 'Factures en double', duplicateFattureScanning: 'Analyse des factures…',
    duplicateFattureScanningBatch: 'Dernier lot lu depuis la base',
    duplicateFattureScanningAwaitingRows: 'En attente des premières lignes depuis la base (le premier lot peut être long s’il y a beaucoup de factures).', duplicateFattureNone: 'Aucun doublon. Critères : même fournisseur, même date de document et même numéro de facture (lignes avec numéro uniquement).', duplicateFattureError: 'Analyse impossible. Réessayez plus tard.', duplicateFattureGroupCount: '{n} exemplaires', duplicateFattureSedeUnassigned: 'Sans site', duplicateFattureTruncated: 'Analyse limitée aux 50 000 premières factures visibles ; résultat peut être incomplet.', duplicateFattureClose: 'Fermer', duplicateFattureRowsAnalyzed: '{n} factures analysées', duplicateFattureDeleteConfirm: 'Supprimer cette facture ? Les autres exemplaires du groupe restent enregistrés. Action irréversible.', duplicateFattureDeleteAria: 'Supprimer cet exemplaire en double', duplicateDashboardBanner_one: '{n} doublon détecté — Cliquer pour gérer', duplicateDashboardBanner_other: '{n} doublons détectés — Cliquer pour gérer', kpiFiscalYearFilter: 'Période KPI (exercice fiscal)', kpiFiscalYearFilterAria: 'Filtrer les totaux BL, factures, commandes, listino et relevés par exercice fiscal', workspaceQuickNavAria: 'Raccourcis vers les sections du site (mêmes destinations que les tuiles KPI ci-dessous)', desktopHeaderSedeToolsMenuTrigger: 'Outils', desktopHeaderSedeToolsMenuTriggerAriaReminders: 'Relances : {n} fournisseurs avec BL à échéance proche', desktopHeaderSedeToolsMenuAria: 'Panneau : doublons de factures, relances et synchronisation e-mail', kpiNoPendingBills: 'Aucun BL en attente.', kpiOperatorOfflineOverlayTitle: 'Synchronisation en pause', kpiOperatorOfflineOverlayHint: 'Hors ligne : les liens des cartes KPI sont désactivés jusqu’au retour du réseau.', kpiListinoAnomaliesCountLine: '{n} anomalies de prix détectées', kpiBollePendingListCta: 'Voir {n} en attente →', kpiDuplicateInvoicesDetected: '⚠️ {n} factures en double détectées',
    kpiDuplicateBolleDetected: '⚠️ {n} BL en double détectés',
    kpiDocumentiDaRevisionareTitle: 'Documents à revoir',
    kpiDocumentiDaRevisionareSub: 'Doublons, expéditeurs inconnus et anomalies de prix Rekki',
    inboxUrgentePageTitle: 'Boîte urgente',
    inboxUrgentePageIntro:
      'Point unique pour les incidents : documents à rattacher, anomalies de prix et doublons dans vos listes.',
    inboxUrgenteNavDocQueue: 'File documents e-mail',
    inboxUrgenteNavPriceAnomalies: 'Vérification — anomalies de prix Rekki',
    inboxUrgenteNavInvoices: 'Factures (doublons)',
    inboxUrgenteNavBolle: 'BL (doublons)',
    inboxUrgenteNavOrdini: 'Commandes (doublons)',
    inboxUrgenteNavAiInbox: 'AI Inbox (file + doublons)',
    errorCountSuffix: 'erreurs', manualReceiptLabel: 'Reçu (sans bon de livraison)', manualReceiptPlaceholder: 'ex. 5 kg calamars, 2 caisses citrons', manualReceiptRegister: 'Enregistrer la livraison', manualReceiptRegistering: 'Enregistrement…', manualReceiptSaved: 'Livraison enregistrée.', manualReceiptNeedTextOrPhoto: 'Saisissez une description ou ajoutez une photo.', manualReceiptRemovePhoto: 'Retirer la photo', manualReceiptNeedSupplier: 'Sélectionnez un fournisseur.', manualReceiptRegisterFailed: 'Enregistrement impossible.', manualReceiptEmailSupplierLabel: 'Envoyer un e-mail au fournisseur pour demander le bon de commande et le BL', manualReceiptEmailSupplierHint: 'Ajoutez l’e-mail du fournisseur sur sa fiche.', manualReceiptEmailSent: 'E-mail de demande envoyé au fournisseur.', manualReceiptEmailFailed: 'Réception enregistrée, mais l’e-mail n’a pas pu être envoyé.', manualReceiptEmailDescPhotoOnly: 'Photo jointe à l’enregistrement du reçu (sans texte).', adminGlobalTitle: 'Tableau global', adminGlobalSubtitle: 'Synthèse de tous les sites. Choisissez une filiale dans le menu ou sur la carte pour la vue opérationnelle.', adminGlobalTotalsLabel: 'Totaux réseau', adminOpenBranchDashboard: 'Vue opérationnelle', adminSedeSettingsLink: 'Fiche site', adminDocQueueShort: 'En file', rekkiOrder: 'Commander sur Rekki', manualDeliveryNeedSede: 'Sélectionnez un opérateur actif ou assurez-vous que votre profil est rattaché à un site pour enregistrer une livraison.', kpiPriceListSub: 'lignes au tarif', listinoOverviewHint: 'Lignes de tarifs des fournisseurs visibles. Ouvrez une fiche fournisseur pour modifier ou importer depuis une facture.', listinoOverviewEmpty: 'Aucune ligne tarif dans ce périmètre.', listinoOverviewOpenSupplier: 'Ouvrir le fournisseur →', listinoOverviewLimitNote: 'Affichage des {n} dernières lignes.', fattureRiepilogoTitle: 'Total factures', fattureRiepilogoHint: 'Somme des montants dans votre périmètre. Le tableau liste les dernières factures par date; ouvrez une fiche pour la pièce jointe et les liens.', fattureRiepilogoEmpty: 'Aucune facture dans ce périmètre.', fattureRiepilogoLimitNote: 'Affichage des {n} dernières factures (par date).', fattureRiepilogoOpenInvoice: 'Ouvrir la facture →', fattureRiepilogoCountLabel: '{n} factures', fattureRiepilogoLinkAll: 'Toutes les factures →', kpiStatementNone: 'Aucun relevé', kpiStatementAllOk: 'Aucune anomalie', kpiStatementIssuesFooter: 'sur {t} relevés vérifiés', kpiDaProcessareSub: 'documents en attente',
    kpiOrdiniSub: 'confirmations de commande enregistrées',
    ordiniOverviewHint: 'PDF de confirmation de commande par fournisseur. Ouvrez la fiche fournisseur (onglet Commandes) pour déposer ou gérer les fichiers.',
    ordiniOverviewEmpty: 'Aucune confirmation de commande dans ce périmètre.',
    ordiniOverviewOpenSupplier: 'Ouvrir fournisseur →',
    ordiniOverviewLimitNote: 'Affichage des {n} dernières confirmations.',
    ordiniColSupplier: 'Fournisseur',
    ordiniColTitle: 'Titre',
    ordiniColOrderDate: 'Date commande',
    ordiniColRegistered: 'Enregistrée',
    ordiniOpenPdf: 'Ouvrir PDF', ordiniPdfPreview: 'Aperçu', ordiniPdfOpenNewTab: 'Ouvrir dans un nouvel onglet', ordiniPdfCopyLink: 'Copier le lien', ordiniPdfLinkCopied: 'Lien copié', operatorNoSede: 'Aucun site n’est lié à votre profil. Demandez à un administrateur de vous affecter à la bonne filiale.', suggestedSupplierBanner: 'Nouveau fournisseur détecté : {name}. L’ajouter ?', suggestedSupplierAdd: 'Nouveau fournisseur', suggestedSupplierConfirm: 'Ajouter à la base', suggestedSupplierOpenForm: 'Ouvrir le formulaire', suggestedSupplierSavedToast: 'Fournisseur ajouté', suggestedSupplierSkip: 'Suivant', suggestedSupplierBannerTeaser_one: '1 nouveau fournisseur détecté — Cliquez pour le traiter', suggestedSupplierBannerTeaser_many: '{n} nouveaux fournisseurs détectés — Cliquez pour les traiter', suggestedSupplierDrawerTitle: 'Nouveaux fournisseurs détectés', suggestedSupplierSenderLabel: 'Expéditeur', suggestedSupplierFirstContactLabel: 'Premier contact', suggestedSupplierIgnore: 'Ignorer', suggestedSupplierDrawerCloseScrimAria: 'Fermer le panneau des nouveaux fournisseurs', enterAsSede: 'Entrer comme site', syncHealthAlert: 'Problème de synchronisation (IMAP ou OCR)', syncHealthOcrCount: 'Échecs OCR (48h) : {n}', viewingAsSedeBanner: 'Vous consultez le tableau de bord comme :', exitSedeView: 'Retour vue admin', emailSyncQueued: 'En file — une autre synchronisation se termine…', emailSyncPhaseConnect: 'Connexion…', emailSyncConnectToServer: 'Connexion au serveur IMAP (réseau, chiffrement, authentification)…', emailSyncConnectOpeningMailbox: 'Ouverture du dossier Boîte de réception…', emailSyncPhaseSearch: 'Analyse des textes…', emailSyncPhaseProcess: 'Analyse des pièces jointes (Vision IA)…', emailSyncPhasePersist: 'Enregistrement en base…', emailSyncPhaseDone: 'Synchronisation terminée.', emailSyncStalled: 'Pas de nouvelles — avec beaucoup de pièces jointes, la Vision peut prendre plusieurs minutes. Patience…', emailSyncStalledHint: 'Cela signifie seulement qu’aucune mise à jour du flux n’arrive (fréquent pendant un OCR long). Les vraies tentatives IMAP s’affichent en rouge ci-dessus pendant la phase de connexion.', emailSyncImapRetryLine: 'Connexion IMAP : tentative {current} sur {max}', emailSyncCountsHint: 'Trouvées · nouveaux dans l’app · traités · unités PDF/texte', emailSyncMailboxGlobal: 'Boîte IMAP globale (variables d\'environnement)', emailSyncMailboxSede: 'Boîte : {name}', emailSyncSupplierFilterLine: 'Filtre fournisseur : {name}', emailSyncStatFoundLine: 'Trouvées en boîte : {found}', emailSyncStatImportedLine: 'Nouveaux dans l’app (documents importés) : {imported}', emailSyncStatProcessedLine: 'E-mails traités (lus et analysés) : {processed}', emailSyncStatIgnoredLine: 'Ignorés ou sans résultat : {ignored}', emailSyncStatDraftsLine: 'Brouillons de BL créés : {drafts}', emailSyncStatAlreadyLine: 'Déjà traitées lors d’une synchro précédente (pas réimportées) : {n}', emailSyncStatUnitsLine: 'Unités à analyser (pièces PDF/image ou corps de mail éligible) : {done} / {total}', emailSyncStripDetailsExpandAria: 'Afficher les détails de la synchronisation e-mail', emailSyncStripDetailsCollapseAria: 'Masquer les détails de la synchronisation e-mail', emailSyncStop: 'Arrêter', emailSyncStopAria: 'Interrompre la synchronisation e-mail', emailSyncDismiss: 'Fermer', emailSyncDismissAria: 'Fermer le récapitulatif de synchronisation e-mail', potentialSupplierFromEmailBodyBanner: 'Fournisseur potentiel (texte e-mail) : {name}. L’associer ?', potentialSupplierFromEmailBodyCta: 'Ouvrir nouveau fournisseur' },
  fornitori: { title: 'Fournisseurs', new: 'Nouveau Fournisseur', nome: 'Nom / Société', email: 'Email', piva: 'N° TVA', noSuppliers: 'Aucun fournisseur.', addFirst: 'Ajouter le premier →', editTitle: 'Modifier Fournisseur', profileViewOnlyBanner: 'Consultation seule sur mobile : parcourez les données et documents. Pour modifier la fiche, le listino ou la file, utilisez un ordinateur ou demandez au responsable du site.', saveChanges: 'Enregistrer', notFound: 'Fournisseur introuvable.', deleteConfirm: 'Supprimer ce fournisseur ? Tous les BL et factures liés seront supprimés.', importaDaFattura: 'Importer depuis Facture', countLabel: 'fournisseurs enregistrés', namePlaceholder: 'Ex. Dupont & Fils SARL', emailPlaceholder: 'fournisseur@exemple.fr', pivaLabel: 'N° TVA', pivaPlaceholder: 'FR12345678901', addressLabel: 'Adresse (facultatif)', addressPlaceholder: 'Rue, CP, ville', rekkiLinkLabel: 'Lien Rekki (facultatif)', rekkiLinkPlaceholder: 'https://…', rekkiIdLabel: 'ID Rekki (facultatif)', rekkiIdPlaceholder: 'ex. ID fournisseur sur Rekki', rekkiIntegrationTitle: 'Intégration Rekki', rekkiOpenInApp: 'Ouvrir Rekki', rekkiEmbedPanelTitle: 'Rekki', rekkiSheetOpeningLine: 'Vous ouvrez le listino de {name}', rekkiSheetGoCta: 'Aller au listino', rekkiSheetEmbedHint: 'Rekki ne peut pas être intégré ici (sécurité). Vérifiez le titre et le résumé ci-dessus ; ouvrez le site complet avec le bouton ci-dessous.', rekkiSheetPopupButton: 'Ouvrir dans une fenêtre (1000×900)', rekkiSheetPagePreviewCaption: 'Aperçu de la page', rekkiSheetPagePreviewLoading: 'Chargement de l’aperçu…', rekkiSheetPagePreviewUnavailable: 'Aperçu indisponible ; ouvrez Rekki avec le bouton ci-dessous.', rekkiLookupByVat: 'Rechercher Rekki (TVA)', rekkiLookupApiLink: 'Recherche automatique d’ID Rekki (API)', rekkiSaveRekkiMapping: 'Enregistrer le lien Rekki', rekkiSaveMapping: 'Enregistrer le mapping', rekkiStatusNotConnected: 'Non connecté', rekkiStatusConnected: 'Connecté', rekkiStatusPending: 'Modifications à enregistrer', rekkiConnectedBadge: 'Rekki', rekkiCachedListBanner: 'Données en cache (hors ligne).', cardFooterUnlockPin: 'Déverrouiller (PIN)', rekkiLookupNeedVat: 'Ajoutez le numéro de TVA du fournisseur pour rechercher sur Rekki.', rekkiIdExtractedFromLink: 'ID fournisseur extrait du lien Rekki.', rekkiAutoLinkedSingle: 'Un seul fournisseur Rekki correspond à cette TVA — lien enregistré.', rekkiSearchOnRekkiGoogle: 'Rechercher sur Rekki', rekkiSearchOnRekkiGoogleByName: 'Google (nom)', rekkiGuidedPasteHint: 'Ouvre Google limité à rekki.com. Ouvrez la fiche fournisseur, copiez l’URL, collez-la dans Lien : l’ID est extrait tout de suite ; puis Enregistrer pour activer le contrôle des prix.', rekkiIdUrlNotParsed: 'Le champ ID contient une URL Rekki non reconnue. Collez l’URL du profil dans le champ Lien, ou uniquement l’ID fournisseur.', saving: 'Enregistrement...', tabRiepilogo: 'Résumé', tabListino: 'Tarifs', tabAuditPrezzi: 'Audit des Prix', tabConfermeOrdine: 'Confirmations de commande', tabStrategyConto: 'Relevé', kpiBolleTotal: 'Total BL', kpiFatture: 'Factures reçues', kpiOrdini: 'Commandes', kpiPending: 'Documents en attente', kpiReconciliation: 'Rapprochement', subAperte: 'ouverts', subConfermate: 'confirmées', subDaAbbinare: 'en attente', subChiuse: 'BL clôturés', subListinoRows: 'lignes tarif', kpiFatturatoPeriodo: 'Montant facturé', subFatturatoPeriodoZero: 'Aucune facture datée sur la période', subFatturatoPeriodoCount_one: '1 facture incluse dans le total', subFatturatoPeriodoCount_other: '{n} factures incluses dans le total', subFatturatoTotaleLordoMicro: 'Total brut (toutes les factures) : {amount}', kpiListinoProdottiPeriodo: 'Produits tarif', subListinoProdottiEAggiornamenti: '{p} produits distincts · {u} mises à jour de prix', subListinoPeriodoVuoto: 'Aucune mise à jour tarif sur la période', subListinoPriceAnomalies: 'Attention : {n} variations de prix détectées', subBolleRekkiSavingsMicro: 'Économies Rekki estimées : prix de référence plus bas sur certaines livraisons.', subBollePeriodoVuoto: 'Aucun bon de livraison daté sur la période', subBollePeriodoRiepilogo: '{open} sur {total} sans facture associée', subDocumentiCodaEmailPeriodo: 'Documents e-mail à traiter (même période)', subOrdiniPeriodo: 'sur la période', subStatementsNoneInMonth: 'aucun', subStatementsAllVerified: 'tous OK', subStatementsWithIssues: 'anomalies', helpText: 'Allez dans l\'onglet <b>Relevé</b> pour associer documents et BL, ou dans <b>BL</b> et <b>Factures</b> pour l\'historique complet.', listinoSetupTitle: 'Table de prix pas encore créée', listinoSetupSubtitle: 'Activez le suivi des prix par produit en 2 clics :', listinoSetupStep1: 'Cliquez sur <strong class="font-bold text-app-fg">"Copier SQL"</strong> ci-dessous', listinoSetupStep2: 'Ouvrez le <a href="https://supabase.com/dashboard/project/dubocvwsdzrqrrxsedas/sql/new" target="_blank" rel="noopener noreferrer" class="font-semibold text-amber-200 underline decoration-amber-200/50 transition-colors hover:text-app-fg">SQL Editor ↗</a>, collez et cliquez sur <strong class="font-bold text-app-fg">"Run"</strong>', listinoSetupShowSQL: 'Afficher le SQL complet ▸', listinoCopySQL: 'Copier SQL', listinoCopied: 'Copié !', listinoProdotti: 'Liste des Prix', listinoProdottiTracked: 'produits suivis', listinoNoData: 'Aucun prix de produit enregistré', listinoNoDataHint: 'Saisissez les prix directement dans la table <code class="font-mono text-app-fg-muted">listino_prezzi</code> sur Supabase.', listinoTotale: 'Total dépensé', listinoDaBolle: 'Des BL', listinoDaFatture: 'Des factures', listinoStorico: 'Historique des documents', listinoDocs: 'documents', listinoNoDocs: 'Aucun document avec montant enregistré', listinoColData: 'Date', listinoColTipo: 'Type', listinoColNumero: 'Numéro', listinoColImporto: 'Montant', listinoColTotale: 'Total', listinoRekkiListBadge: '[Rekki]', listinoVerifyAnomalies: 'Anomalies', listinoVerifyAnomaliesTitle: 'Ouvrir Vérification avec filtre prix Rekki pour ce produit', listinoRowBadgeOk: 'OK', listinoRowBadgeAnomaly: 'Anomalie', listinoRowActionsLabel: 'Actions', listinoLastIncrease: 'Dernière hausse : {delta} ({pct})', listinoLastDecrease: 'Dernière baisse : {delta} ({pct})', listinoLastFlat: 'Prix aligné sur la référence ({pct})', listinoVsReferenceHint: 'par rapport au mois civil précédent ou au prix précédent.', listinoOriginInvoice: 'Dernier prix depuis facture {inv} du {data} · {supplier}', listinoFilterEmptyKpi: 'Aucun produit ne correspond à ce filtre.', listinoClearKpiFilter: 'Tout afficher', listinoKpiAriaAll: 'Afficher tous les produits du tarif', listinoKpiAriaFatture: 'Filtrer les produits importés depuis les factures du résumé', listinoKpiAriaBolle: 'Filtrer les produits dont la date de prix correspond à un BL du résumé', listinoHistoryDepth: '{n} mises à jour de prix précédentes', listinoPriceStaleBadge: 'Prix ancien / périmé', listinoPriceStaleHint: 'Dernière mise à jour tarif il y a plus de 60 jours.', preferredLanguageEmail: 'Langue préférée (e-mails)', languageInheritSede: '— Hériter du site —', recognizedEmailsTitle: 'E-mails reconnus', recognizedEmailsHint: 'Adresses supplémentaires à partir desquelles ce fournisseur peut envoyer des documents. La synchronisation e-mail les associe automatiquement.', recognizedEmailPlaceholder: 'ex. factures@fournisseur.fr', recognizedEmailLabelOptional: 'Libellé (facultatif)', displayNameLabel: 'Nom court (liste & barre)', displayNameHint: 'Facultatif. Affiché dans la barre du bas sur mobile et les listes compactes à la place du nom légal complet.', displayNamePlaceholder: 'ex. Amalfi', loadingProfile: 'Chargement de la fiche, des documents et du récapitulatif fournisseur…', logoUrlLabel: 'Logo fournisseur (URL)', logoUrlPlaceholder: 'https://exemple.fr/logo.png', logoUrlHint: 'Image HTTPS (PNG, JPG ou SVG). En cas d’échec, les initiales s’affichent.', confermeOrdineIntro: 'Conservez ici les confirmations de commande et autres PDF commerciaux non fiscaux. Elles ne font pas partie du flux BL / factures.', confermeOrdineOptionalTitle: 'Titre (facultatif)', confermeOrdineOptionalTitlePh: 'ex. Commande 4582', confermeOrdineOptionalOrderDate: 'Date de commande', confermeOrdineOptionalNotePh: 'Notes internes', confermeOrdineAdd: 'Enregistrer', confermeOrdineEmpty: 'Aucune confirmation de commande pour ce fournisseur.', confermeOrdineColFile: 'Document', confermeOrdineColRecorded: 'Ajouté le', confermeOrdineOpen: 'Ouvrir le PDF', confermeOrdineDeleteConfirm: 'Supprimer cette confirmation et son fichier ?', confermeOrdineDuplicateCopyDeleteConfirm: 'Supprimer cet exemplaire en double de la confirmation ? Les autres copies du groupe restent enregistrées.', confermeOrdineErrPdf: 'Chargez un fichier PDF.', confermeOrdineErrNeedFile: 'Choisissez un PDF à téléverser.', confermeOrdineErrUpload: 'Erreur de téléversement', confermeOrdineErrSave: 'Erreur d’enregistrement', confermeOrdineErrDelete: 'Erreur de suppression', confermeOrdineMigrationTitle: 'Table des confirmations non configurée', confermeOrdineMigrationHint: 'Exécutez la migration SQL add-conferme-ordine.sql sur Supabase pour créer la table conferme_ordine et les politiques RLS.', syncEmailNeedSede: 'Associez un site au fournisseur pour synchroniser les e-mails.', ocrControllaFornitore: 'Contrôle OCR', ocrControllaFornitoreTitle: 'Relit avec l’IA les BL et factures à date suspecte (comme dans Paramètres). Utilisez l’action dans l’onglet Bolle pour un document.', ocrControllaFornitoreResult: 'Terminé : {corrected} mis à jour, {scanned}/{total} traités.', supplierMonthlyDocTitle: 'Par mois', supplierMonthlyDocColMonth: 'Mois', supplierMonthlyDocColBolle: 'BL', supplierMonthlyDocColFatture: 'Factures', supplierMonthlyDocColSpesa: 'Total factures', supplierMonthlyDocColOrdini: 'Commandes', supplierMonthlyDocColStatements: 'Relevés', supplierMonthlyDocColPending: 'En attente', supplierMonthlyDocColFiscalYear: 'Exercice fiscal', supplierMonthlyDocFiscalSelected: "L'exercice fiscal du site pour le mois sélectionné est {year}.", supplierMonthlyDocAriaGoToTabMonth: 'Ouvrir {tab} pour la période {month}', supplierDesktopRegionAria: 'Fiche fournisseur, affichage bureau', listinoPeriodLabel: 'Période', listinoPeriodAll: 'Tout', listinoPeriodCurrentMonth: 'Mois en cours', listinoPeriodPreviousMonth: 'Mois précédent', listinoPeriodLast3Months: '3 derniers mois', listinoPeriodFiscalYear: 'Année fiscale', },
  bolle: { title: 'Bons de livraison', new: 'Nouveau BL', uploadInvoice: 'Uploader Facture', viewDocument: 'Voir Document', noBills: 'Aucun BL.', addFirst: 'Créer le premier →', deleteConfirm: 'Supprimer ce BL ? Les factures liées seront supprimées.', duplicateCopyDeleteConfirm: 'Supprimer cet exemplaire en double du BL ? Les autres lignes du groupe restent enregistrées.', pendingInvoiceOverdueHint: 'En attente depuis plus de 7 jours sans facture — relancer le document comptable.', ocrScanning: 'Reconnaissance fournisseur…', ocrMatched: 'Fournisseur reconnu', ocrNotFound: 'Sélectionner manuellement', ocrAnalyzing: 'Analyse en cours…', ocrAutoRecognized: 'Reconnu automatiquement', ocrRead: 'Lu :', selectManually: 'Sélectionner fournisseur', saveNote: 'Enregistrer BL', savingNote: 'Enregistrement…', analyzingNote: 'Analyse du document…', takePhotoOrFile: 'Prendre photo ou choisir fichier', ocrHint: 'Le fournisseur sera reconnu automatiquement', cameraBtn: 'Caméra', fileBtn: 'Choisir fichier', countSingolo: 'bon de livraison enregistré', countPlural: 'bons de livraison enregistrés', countTodaySingolo: 'BL aujourd’hui', countTodayPlural: 'BL aujourd’hui', noBillsToday: 'Aucun BL pour aujourd’hui.', listShowAll: 'Tous les BL', listShowToday: 'Aujourd’hui seulement', listAllPending: 'En attente seulement', fotoLabel: 'Photo / Fichier BL', fornitoreLabel: 'Fournisseur', dataLabel: 'Date BL', dettaglio: 'Détail BL', fattureCollegate: 'Factures liées', aggiungi: '+ Ajouter', nessunaFatturaCollegata: 'Aucune facture liée.', allegatoLink: 'Pièce jointe →', statoCompletato: 'Complété', statoInAttesa: 'En attente', apri: 'Ouvrir', colNumero: 'Numéro', colAttachmentKind: 'Pièce jointe', riannalizzaOcr: 'Réanalyser (OCR)', ocrRerunMovedToInvoices: 'Classé comme facture : le document a été déplacé dans l’onglet Factures.', ocrRerunUpdatedStaysBolla: 'Champs du BL mis à jour. Classification : toujours un bon de livraison / DDT.', ocrRerunUnchangedStaysBolla: 'Aucun champ modifié. Classification : toujours un BL (vérifiez le fichier ou réessayez).', ocrRerunFailed: 'OCR impossible : vérifiez la pièce jointe ou réessayez.', ocrRerunProgressTitle: 'Nouvelle analyse en cours', ocrRerunStep1: '1. Téléchargement de la pièce jointe', ocrRerunStep2: '2. IA (Gemini) : facture vs BL, numéro, montant, date', ocrRerunStep3: '3. Enregistrement ou déplacement vers Factures', convertiInFattura: 'Déplacer vers Factures', convertiInFatturaTitle: 'Enregistrer comme facture (sans OCR)', convertiInFatturaConfirm: 'Déplacer ce document de l’onglet Bons de livraison vers Factures ? Le numéro et le montant actuels seront utilisés comme n° et total de facture.', convertiInFatturaOk: 'Document déplacé vers Factures.', convertiInFatturaErrLinked: 'Impossible : une facture est déjà liée à ce BL ou il existe un lien dans fattura_bolle.', convertiInFatturaErrGeneric: 'L’opération n’a pas pu aboutir.', attachmentKindPdf: 'PDF', attachmentKindImage: 'Image', attachmentKindOther: 'Fichier', nessunaBollaRegistrata: 'Aucun BL enregistré', creaLaPrimaBolla: 'Créer le premier BL →', vediDocumento: 'Voir le document', dateFromDocumentHint: 'Issu du document', prezzoDaApp: 'Prix issu de l’app', verificaPrezzoFornitore: 'Vérifier le prix fournisseur', rekkiPrezzoIndicativoBadge: '⚠️ Prix indicatif depuis l’app Rekki', listinoRekkiRefTitle: 'Tarif de référence (Rekki)', listinoRekkiRefHint: 'Avec l’ID Rekki sur le fournisseur, comparez le total du BL aux derniers prix importés.', listinoRekkiRefEmpty: 'Aucune ligne de tarif pour ce fournisseur.', scannerTitle: 'Scanner IA', scannerWhatLabel: 'Que chargez-vous ?', scannerModeAuto: 'Automatique', scannerModeBolla: 'Bon de livraison / DDT', scannerModeFattura: 'Facture', scannerModeSupplier: 'Nouveau fournisseur', scannerFlowBolla: 'Enregistrement BL', scannerFlowFattura: 'Enregistrement facture', scannerSaveFattura: 'Enregistrer la facture', scannerSavingFattura: 'Enregistrement facture…', scannerCreateSupplierCta: 'Créer le fournisseur avec les données lues', scannerCreateSupplierFromUnrecognized: 'Créer le fournisseur depuis ce document', scannerPdfPreview: 'PDF joint — aperçu non disponible', scannerCameraCapture: 'Capturer', scannerCameraPermissionDenied: 'Impossible d’accéder à la caméra. Vérifiez les autorisations du navigateur ou de l’appareil.', scannerFileScanTypeError: 'Chargez un PDF ou une photo (JPEG, PNG ou WebP).', scannerImageAttached: 'Photo jointe' },
  fatture: { title: 'Factures', new: 'Nouvelle Facture', noInvoices: 'Aucune facture.', addFirst: 'Ajouter la première →', invoice: 'Facture', openBill: 'Ouvrir BL →', deleteConfirm: 'Supprimer cette facture ? Action irréversible.', countLabel: 'factures reçues', headerBolla: 'Bon de livraison', headerAllegato: 'Pièce jointe', apri: 'Ouvrir →', caricaFatturaTitle: 'Uploader Facture', bollaMarkata: 'Le BL sera marqué comme complété', collegataABolla: 'Liée à un bon de livraison', bollaPasseraCompletato: 'À l\'enregistrement le BL passera à "complété"', dataFattura: 'Date Facture', fileFattura: 'Fichier Facture', caricaPdfFoto: 'Uploader PDF ou prendre photo', maxSize: 'PDF, JPG, PNG, WebP — max 10 Mo', savingInProgress: 'Enregistrement...', salvaChiudiBolla: 'Enregistrer et Clôturer BL', dettaglio: 'Détail', bollaCollegata: 'BL lié', statusAssociata: 'Associée', statusSenzaBolla: 'Sans BL', colNumFattura: 'N° Facture', nessunaFatturaRegistrata: 'Aucune facture enregistrée', nessunaFatturaNelPeriodo: 'Aucune facture datée dans cette période', fattureInArchivioAllargaFiltroData: 'Vous avez {n} facture(s) enregistrée(s), mais aucune n’a sa date dans l’intervalle affiché (en haut à droite). Élargissez les dates : la liste filtre sur la date du document, pas le jour du scan.', fattureExpandDateRangeCta: 'Afficher toutes les factures (2000 – aujourd’hui)', duplicateInvoiceSameSupplierDateNumber: 'Cette facture est déjà enregistrée : même fournisseur, même date et même numéro de document. Pour remplacer le PDF, ouvrez la facture existante et utilisez « Remplacer la pièce jointe ».', duplicateInvoiceSameSupplierDateAmountNoNumber: 'Cette facture est déjà enregistrée : même fournisseur et date, même montant, sans numéro de document en base. Pour remplacer le PDF, ouvrez la facture existante et utilisez « Remplacer la pièce jointe ».', duplicateDeleteConfirm: 'Supprimer cette copie de la facture {numero} ? L’original sera conservé.', duplicateRemoveCopy: 'Supprimer le doublon', duplicateRemoveThisCopy: 'Retirer cette copie', duplicatePairBadgeAria: 'Mettre en surbrillance la paire de factures en double', refreshDateFromDoc: 'Relire la date', refreshDateFromDocTitle: 'Relire la date sur le document (OCR) et mettre à jour la facture', refreshDateFromDocSuccess: 'Date mise à jour : {data}.', refreshDateFromDocUnchanged: 'La date correspond déjà au document.' },
  archivio: { title: 'Archive', subtitle: 'fournisseurs', noBills: 'Aucun BL', noInvoices: 'Aucune facture', withBill: 'Avec BL', noEmail: 'Aucun email', bollaS: 'bon', bollaP: 'bons', fatturaS: 'facture', fatturaP: 'factures', editLink: 'Modifier →', nuova: '+ Nouveau', nuovaFattura: '+ Facture', documento: 'Document', pendingDocCount: '({n} en attente)', linkAssociateStatements: 'Associer →', queueTitle: 'Documents en file', queueSubtitle: 'en attente de traitement ou d\'association à un BL', unknownSender: 'Expéditeur inconnu', statusDaAssociare: 'À associer', noQueue: 'Aucun document en file', noQueueHint: 'Les documents reçus par email apparaîtront ici.', receivedOn: 'Reçu :', docDate: 'Date doc :' },
  impostazioni: { title: 'Paramètres', subtitle: 'Devise et fuseau horaire', lingua: 'Langue', valuta: 'Devise', fuso: 'Fuseau horaire', preview: 'Aperçu', saved: 'Paramètres sauvegardés — rechargement…', sectionLocalisation: 'Localisation', accountSection: 'Compte', changeSede: 'Changer de site', addOperatorsPickSede: 'Choisissez d’abord le site actif dans Sites — puis vous pourrez créer des opérateurs (nom + PIN) ici.', imapSection: 'Email IMAP' },
  log: { title: 'Activité e-mail', subtitle: 'Documents traités automatiquement depuis la boîte entrante.', sender: 'Expéditeur', subject: 'Objet', stato: 'Statut', detail: 'Détail', retry: 'Réessayer', retrying: 'Réessai…', success: 'Succès', bollaNotFound: 'Document Reçu', supplierNotFound: 'Expéditeur inconnu', noLogs: 'Aucun log.', emptyHint: 'Lancez une synchronisation email depuis le Tableau de bord.', totalLogs: 'Total logs', linkedInvoices: 'Documents reçus', withErrors: 'Avec erreurs', vediFile: 'Voir fichier', supplierSuggested: 'Fournisseur suggéré', aiSuggest: 'Suggestion IA', aiSuggestTitle: 'Données suggérées (OCR)', aiSuggestLoading: 'Analyse…', aiSuggestError: 'Impossible d’analyser le document.', openCreateSupplier: 'Ouvrir création fournisseur', associateRememberHint: 'Après enregistrement, l’e-mail de l’expéditeur sera lié pour les prochaines synchronisations.', colAttachment: 'Pièce jointe', colSede: 'Site', colLogId: 'ID log', colRegistered: 'Enregistré', tabEmailLog: 'Activité e-mail', tabBlacklist: 'Liste de blocage', blacklistSubtitle: 'Expéditeurs exclus du scan OCR (newsletters, comptes hors fournisseurs, etc.).', blacklistColMittente: 'Expéditeur', blacklistColMotivo: 'Motif', blacklistColDate: 'Ajouté', blacklistPlaceholder: 'ex. newsletter@service.com', blacklistAdd: 'Ajouter', blacklistRemove: 'Retirer', blacklistFilterAll: 'Tous les motifs', blacklistEmpty: 'Aucun expéditeur sur la liste.', blacklistError: 'Impossible de charger la liste.', logIgnoreAlways: 'Toujours ignorer cet expéditeur', logBlacklistAdded: 'Expéditeur ajouté à la liste.', blacklistMotivoNewsletter: 'Newsletter', blacklistMotivoSpam: 'Spam', blacklistMotivoNonFornitore: 'Non-fournisseur', blacklistMotivoSistema: 'Système', blacklistMotivoSocial: 'Social', activitySummaryToday: '{n} documents traités automatiquement aujourd’hui', activityEmpty: 'Aucune activité pour aujourd’hui.', activityColTipo: 'Type', activityColSupplier: 'Fournisseur', activityColAmount: 'Montant', activityColStatus: 'Statut', activityOpenDocument: 'Ouvrir le document', activityTipoInvoice: 'Facture', activityTipoDdt: 'Bon de livraison', activityTipoStatement: 'Relevé', activityTipoQueue: 'En attente', activityTipoOrdine: 'Commande', activityTipoResume: 'CV', activityStatusSaved: '✅ Enregistré', activityStatusNeedsSupplier: '⚠️ Fournisseur à créer', activityStatusIgnored: '⏭️ Ignoré', activityProcessDocumentsCta: 'Traiter la file documents', activityProcessDocumentsBusy: 'Traitement…', activityProcessDocumentsNoEligibleInLog: 'Rien de traitable automatiquement (fournisseur ou OCR). Utilisez AI Inbox pour la suite.', activityProcessDocumentsSummary: 'Traités {runs} : {processed} mis à jour, {skipped} ignorés.', activityProcessDocumentsApiError: 'Échec du traitement', activityProcColumn: 'Traitement', activityProcSpinAria: 'OCR…', activityProcProcessedAuto: '✓ Auto-enreg.', activityProcProcessedRevision: 'À réviser', activityProcProcessedOther: 'Mis à jour', activityProcOutcomeError: 'Erreur', activityProcSkippedScartato: 'Ignoré', activityProcSkippedNoRowOrSede: 'Pas accessible', activityProcSkippedNoMittente: 'Expéditeur invalide', activityProcSkippedNoSupplier: 'À rattacher fournisseur', activityProcSkippedHasOcr: 'Déjà OCR — Inbox', activityProcPendingBatch: 'Lot suivant (max 5)', activityProcRejectedCv: 'Ignoré (CV)', activityProcDash: '—', },
  sedi: { title: 'Site et Utilisateurs', titleGlobalAdmin: 'Sites', subtitle: 'Gérer le site, la sync e-mail et les opérateurs', subtitleGlobalAdmin: 'Gérer les sites, la sync e-mail et les opérateurs', newSede: 'Nouveau Site', noSedi: 'Aucun site. Commencez par en ajouter un.', users: 'Utilisateurs', imap: 'Configuration Email (IMAP)', imapSubtitle: "Configurez la boîte mail de ce site. Les factures reçues ici seront associées automatiquement aux fournisseurs du site.", imapHost: 'Hôte IMAP', imapHostPlaceholder: 'imap.gmail.com', imapPort: 'Port', imapUser: 'Email / Utilisateur', imapPassword: 'Mot de passe', imapPasswordPlaceholder: 'Mot de passe ou Mot de passe d\'application', testConnection: 'Tester la connexion', saveConfig: 'Enregistrer la configuration', notConfigured: 'Email non configuré', accessDenied: 'Accès réservé aux administrateurs', accessDeniedHint: 'Contactez votre admin pour obtenir l\'accès.', creatingBtn: 'Création...', createBtn: 'Créer', nomePlaceholder: 'Ex. Bureau Paris', nessunUtente: 'Aucun utilisateur trouvé.', emailHeader: 'Email', sedeHeader: 'Site', ruoloHeader: 'Rôle', nessunaSedeOption: '— Aucun site —', operatoreRole: 'Opérateur', adminRole: 'Portail de gestion', adminSedeRole: 'Administrateur de site', profileRoleAdmin: 'Portail de gestion', adminScopedSediHint: 'Vous ne voyez que le site lié à votre profil. Les nouveaux sites et les « Utilisateurs sans site » sont réservés à l’administrateur principal (admin sans site sur le profil).', renameTitle: 'Renommer', deleteTitle: 'Supprimer', addOperatorSedeTitle: 'Nouvel opérateur', addOperatorSedeDesc: 'Connexion avec nom et PIN (min. 4 caractères). L’e-mail est généré automatiquement.', operatorDisplayNameLabel: 'Nom affiché', operatorPinMinLabel: 'PIN (min. 4 caractères)', operatorNameRequired: 'Saisissez le nom de l’opérateur.', operatorPinTooShort: 'Le PIN doit comporter au moins 4 caractères.', wizardOperatorHint: "Les opérateurs se connectent avec nom + PIN. Vous pouvez en ajouter d'autres après.", sedeStats: '{operatori} opérateurs · {fornitori} fournisseurs', operatoriHeader: 'Opérateurs ({n})', sedeAccessCodeLabel: "Code d'accès site", sedePinHint: 'Code PIN à 4 chiffres. Laisser vide pour désactiver.', sedePinError4Digits: "Le code PIN d'accès doit contenir 4 chiffres ou être vide.", changePinTitle: 'Modifier le PIN', newPinFor: 'Nouveau PIN pour {name}', operatoreRoleShort: 'Op.', adminSedeRoleShort: 'Resp.', valutaFuso: 'Devise et Fuseau horaire', },
  approvalSettings: {
    autoRegisterTitle: 'Enregistrement automatique des factures IA',
    autoRegisterDescription:
      'Les factures reconnues avec certitude par l’IA sont enregistrées automatiquement sans confirmation manuelle.',
  },
  statements: {
    heading: 'Vérification des Relevés Mensuels',
    tabVerifica: 'Relevé de Compte',
    tabDocumenti: 'Documents en attente',
    schedaNavDaProcessareDesc: 'Pièces jointes reçues : liez fournisseurs, BL et factures.',
    schedaNavVerificaDesc: 'Contrôle mensuel du relevé par rapport aux BL et factures.',
    statusOk: 'OK',
    statusFatturaMancante: 'Facture manquante',
    statusBolleManc: 'BL manquants',
    statusErrImporto: 'Erreur de montant',
    statusRekkiPrezzo: 'Prix Rekki vs facture',
    stmtReceived: 'Relevés reçus',
    stmtProcessing: 'Relevé en cours de traitement — réessayez dans quelques secondes.',
    stmtEmpty: 'Aucun relevé reçu',
    stmtEmptyHint: 'Les relevés arrivent automatiquement par email.',
    btnSendReminder: 'Envoyer une relance',
    btnSending: 'Envoi…',
    btnSent: 'Envoyé ✓',
    btnClose: 'Fermer',
    btnRefresh: 'Actualiser',
    btnAssign: 'Associer',
    btnDiscard: 'Ignorer',
    btnAssigning: 'Association…',
    colDate: 'Date',
    colRef: 'Réf. Document',
    colAmount: 'Montant',
    colStatus: 'Statut',
    colAction: 'Action',
    colInvoice: 'Facture',
    colNotes: 'Bons de livraison',
    classicHeading: 'Vérification BL / Factures',
    classicComplete: 'Avec Facture',
    classicMissing: 'Sans Facture',
    classicRequestAll: 'Demander toutes les factures manquantes',
    classicRequesting: 'Envoi…',
    classicSent: 'Envoyées ✓',
    classicRequestSingle: 'Demander facture',
    migrationTitle: 'Comment activer la réception automatique des Relevés',
    migrationSubtitle: 'Créez les tables statements et statement_rows en 2 clics :',
    migrationStep1: 'Cliquez sur "Copier SQL" à droite',
    migrationStep2: 'Ouvrez SQL Editor, collez et cliquez "Run"',
    migrationShowSQL: 'Afficher le SQL complet ▸',
    migrationCopySQL: 'Copier SQL',
    migrationCopied: 'Copié !',
    kpiOk: 'Vérifiés OK',
    kpiMissing: 'Avec anomalies',
    kpiAmount: 'Montant total',
    kpiTotal: 'Lignes totales',
    months: ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'],
    unknownSupplier: 'Fournisseur inconnu',
    loadError: 'Impossible de charger les résultats du relevé.',
    sendError: "Erreur lors de l'envoi de la relance.",
    tabPending: 'À confirmer',
    tabAll: 'Tous',
    unknownSenderQuickStripTitle: 'Priorité : lier le fournisseur ({n})',
    unknownSenderQuickStripAria: 'Accès rapide aux documents sans fournisseur lié',
    unknownSenderQuickStripChipTitle: 'Aller à ce document dans la liste',
    emailSyncAutoSavedToday: '{n} enregistrés automatiquement aujourd’hui',
    bolleAperteOne: 'bon de livraison ouvert disponible',
    bolleApertePlural: 'bons de livraison ouverts disponibles',
    tagStatement: 'Relevé mensuel',
    tagStatementOk: 'Relevé ✓',
    tagPending: 'À traiter',
    tagBozzaCreata: '✦ Brouillon créé',
    tagAssociated: 'Vérifié',
    tagDiscarded: 'Ignoré',
    labelReceived: 'Reçu :',
    labelDocDate: 'Date doc. :',
    openFile: 'Ouvrir le fichier →',
    reanalyzeDocButton: 'Réanalyser',
    reanalyzeDocTitle: 'Relance la lecture du document et la correspondance fournisseur (email, TVA, raison sociale).',
    reanalyzeDocSuccess: 'Analyse mise à jour.',
    gotoFatturaDraft: 'Voir le brouillon facture →',
    gotoBollaDraft: 'Voir le brouillon BL →',
    toggleAddStatement: 'Ajouter au relevé',
    toggleRemoveStatement: 'Retirer du relevé',
    docKindEstratto: 'Relevé',
    docKindBolla: 'BL',
    docKindFattura: 'Facture',
    docKindOrdine: 'Commande',
    docKindHintBolla: 'Marquer comme bon de livraison, pas relevé mensuel ni facture à rapprocher',
    docKindHintFattura: 'Marquer comme facture à rapprocher avec les BL en attente',
    docKindHintOrdine: 'Confirmation de commande ou PDF commercial : enregistré dans les confirmations du fournisseur (pas BL ni facture)',
    docKindGroupAria: 'Type de document',
    finalizeNeedsSupplier: 'Associez un fournisseur pour finaliser.',
    btnFinalizeFattura: 'Enregistrer la facture (sans BL)',
    btnFinalizeBolla: 'Créer un BL à partir du fichier',
    btnFinalizeOrdine: 'Enregistrer chez le fournisseur (commande)',
    btnFinalizeStatement: 'Archiver le relevé',
    btnFinalizing: 'Enregistrement…',
    finalizeSuccess: 'Document enregistré.',
    autoRegisterFatturaToast: 'Facture #{numero} — {fornitore} enregistrée automatiquement',
    noPendingDocs: 'Aucun document à examiner',
    noDocsFound: 'Aucun document trouvé',
    noBolleAttesa: 'Aucun bon de livraison en attente disponible',
    bolleDaCollegamentiSectionTitle: 'BL à associer',
    bollePendingNoneForThisSupplier: 'Aucun BL en attente pour ce fournisseur.',
    bollesSearchAcrossAllSuppliers: 'Rechercher tous les fournisseurs',
    bollesShowOnlyThisSupplier: 'Ce fournisseur seulement',
    bollesExtendedOtherSuppliersSubtitle: 'Autres BL ouverts (autres fournisseurs)',
    bollesMatchAssociateSupplierHint:
      'Associez un fournisseur pour voir ici ses BL en attente, ou recherche sur tout le site.',
    bollesFullSiteListSubtitle: 'Tout le site',
    unknownSender: 'Expéditeur inconnu',
    sameAddressClusterHint:
      'Même adresse que d’autres documents en file. Noms d’entreprise (IA) sur ces lignes : {names}. Probablement le même fournisseur : associez le même contact.',
    btnCreateSupplierFromAi: 'Créer le fournisseur →',
    docTotalLabel: 'Total du document :',
    exactAmount: 'Montant exact',
    exceeds: 'Excédent',
    missingAmt: 'Manquant',
    doneStatus: 'Complété ✓',
    errorStatus: 'Erreur ✗',
    noBolleDelivery: 'Aucun bon de livraison trouvé pour cette facture',
    bozzaCreataOne: 'brouillon créé',
    bozzeCreatePlural: 'brouillons créés',
    bozzaBannerSuffix: "automatiquement par l'IA à partir des pièces jointes. Vérifiez les données et confirmez chaque document.",
    kpiVerifiedOk: 'Vérifiés ✓',
    noEmailForSupplier: 'Aucun email configuré pour ce fournisseur',
    reconcileCorrette: 'Corrects',
    reconcileDiscrepanza: 'Écart',
    reconcileMancanti: 'Manquants',
    reconcileHeading: 'Comparaison relevé vs base de données',
    statusMatch: 'Correspondant',
    statusMismatch: 'Montant différent',
    statusMissingDB: 'Absent de la BD',
    reconcileStatement: 'Relevé :',
    reconcileDB: 'BD :',
    loadingResults: 'Chargement des résultats…',
    editSupplierTitle: 'Modifier le fournisseur',
    supplierLinkFailed: 'Impossible de lier le fournisseur au document.',
    assignFailed: 'Échec de l’association aux bons de livraison.',
    autoLinkedSupplierOne: 'Fournisseur associé automatiquement : {name}.',
    autoLinkedSupplierMany: '{count} documents associés automatiquement à des fournisseurs.',
    bulkAutoMatchSummary:
      'Analyse terminée : {linked} fournisseur(s) lié(s), {associated} document(s) associé(s) aux bons de livraison.',
    bulkAutoMatchNone: 'Aucun rapprochement automatique applicable aux documents de la liste.',
    bulkAutoMatchButtonLabel: 'Tout rapprocher',
    bulkAutoMatchButtonTitle:
      'Recharge la liste, lie les fournisseurs uniques et associe les bons de livraison lorsque le total du document correspond à un ou plusieurs BL ouverts.',
    bulkFinalizeToolbarGroupAria: 'Confirmer en masse par type de document sélectionné',
    bulkFinalizeKindTooltip:
      'Comme Confirmer sur la ligne : enregistre tous les documents listés comme « {kind} » avec fournisseur déjà lié ({n}).',
    bulkFinalizeBulkOk: '{n} documents confirmés ({kind}).',
    bulkFinalizeBulkPartial: '{ok} confirmés, {fail} échoués ({kind}).',
    ocrFormatToggleTitle: 'Forcer l’interprétation numérique alternative',
    allBolleInvoicedOk: 'Tous les bons de livraison ont une facture correspondante — relevé vérifié ✓',
    aiStatementTotalLabel: 'Total extrait du relevé (IA) :',
    statementLinkedBolleLine: '{matched}/{total} BL associés',
    selectedSumLabel: 'Sélection :',
    selectedBolle_one: '({n} BL)',
    selectedBolle_other: '({n} BL)',
    receivedOn: 'Reçu le',
    stmtPdfDatesPrefix: 'Sur le PDF',
    stmtPdfIssuedLabel: 'Émis le',
    stmtPdfLastPaymentLabel: 'Dernier paiement',
    stmtPdfSummaryTitle: 'Données extraites du PDF',
    stmtPdfMetaAccountNo: 'Nº de compte',
    stmtPdfMetaIssuedDate: 'Date d’émission',
    stmtPdfMetaCreditLimit: 'Plafond de crédit',
    stmtPdfMetaAvailableCredit: 'Crédit disponible',
    stmtPdfMetaPaymentTerms: 'Conditions de paiement',
    stmtPdfMetaLastPaymentAmt: 'Dernier paiement',
    stmtPdfMetaLastPaymentDate: 'Date du dernier paiement',
    openPdf: 'Ouvrir le PDF ↗',
    reanalyze: 'Réanalyser',
    stmtListProcessing: 'Traitement…',
    stmtListParseError: 'Erreur d’analyse',
    stmtRowsCount: '{n} lignes',
    stmtAnomalies_one: '{n} anomalie',
    stmtAnomalies_other: '{n} anomalies',
    stmtBackToList: 'Retour à la liste',
    needsMigrationTitle: 'Tables pas encore créées',
    needsMigrationBody:
      'Pour activer la réception automatique des relevés, exécutez la migration SQL. Les instructions figurent dans la section Comment activer ci-dessous.',
    stmtInboxEmailScanning: 'Analyse des e-mails…',
    stmtInboxEmptyDetail:
      'Les relevés sont détectés lorsqu’un e-mail arrive avec l’objet « Statement » ou « Relevé de compte » et une pièce jointe PDF.',
    bolleSummaryByPeriod: 'Synthèse des bons par période',
    bollePeriodEmpty: 'Aucun bon pour cette période',
    clearFilter: 'Effacer le filtre',
    rekkiCheckSegmentTooltip: 'Le montant facturé ne correspond pas à la commande Rekki',
    tripleColStmtDate: 'Date relevé',
    tripleColSysDate: 'Date système',
    tripleColStmtAmount: 'Montant relevé',
    tripleColSysAmount: 'Montant système',
    tripleColChecks: 'Contrôles',
    statusCheckPending: 'En attente',
    statementVerifyBanner: 'Vérification du relevé',
    badgeAiRecognized: 'IA OK',
    badgeAiRecognizedTitle:
      'Fournisseur associé. Le rapprochement automatique des bons nécessite des montants cohérents et des dates dans une fenêtre ±30 j par rapport au document ou à la réception en file.',
    badgeNeedsHuman: 'Association requise',
    rememberAssociationTitle: 'Mémoriser cette association expéditeur–fournisseur ?',
    rememberAssociationSave: 'Enregistrer l’e-mail de l’expéditeur',
    rekkiDocumentLink: 'Rekki',
  },
  appStrings: {
    brandFooter: 'Smart Pair · Gestion des achats',
    pageNotFoundTitle: 'Page introuvable',
    pageNotFoundDesc: 'Le lien est peut-être incorrect ou la page a été supprimée.',
    notFoundInAppTitle: 'Contenu indisponible',
    notFoundInAppDesc:
      'Le lien est invalide, ou le bon de livraison ou la facture n’existe plus ou n’est pas visible avec votre compte (droits ou site).',
    docUnavailableBollaTitle: 'Bon de livraison introuvable',
    docUnavailableBollaDesc:
      'Aucun bon de livraison ne correspond à ce lien. Il a peut-être été supprimé, le lien est erroné, ou votre compte ou site n’y a pas accès.',
    docUnavailableFatturaTitle: 'Facture introuvable',
    docUnavailableFatturaDesc:
      'Aucune facture ne correspond à ce lien. Elle a peut-être été supprimée, le lien est erroné, ou votre compte ou site n’y a pas accès.',
    backToHome: 'Retour au tableau de bord',
    sedeLockTitle: 'Accès protégé',
    sedeLockDescription: 'Le site {name} nécessite un PIN numérique à 4 chiffres.',
    sedeLockCodeLabel: 'PIN (4 chiffres)',
    sedeLockPlaceholder: '••••',
    sedeLockPinLengthError: 'Saisissez un PIN à 4 chiffres.',
    sectionDates: 'Dates',
    sectionCurrencyLabel: 'Devise',
    loadingBolle: 'Chargement des bons…',
    noOpenBolle: 'Aucun bon de livraison ouvert pour ce fournisseur.',
    invoiceNumOptional: 'N° facture (facultatif)',
    uploadDateLabel: 'Date de chargement',
    uploadDateAutomatic: 'automatique',
    registeredByFattura: 'Nom de la personne ayant enregistré la facture…',
    registeredByBolla: 'Nom de la personne ayant enregistré le bon…',
    saveCloseNBolle: 'Enregistrer et fermer {n} bons',
    colDeliveryNoteNum: 'N° bon de livraison',
    colAmountShort: 'Montant',
    labelImportoTotale: 'Montant total',
    labelPrezzoUnitario: 'Prix unitaire',
    loadingPage: 'Chargement…',
    noAttachment: 'Aucune pièce jointe',
    camera: 'Appareil photo',
    chooseFile: 'Choisir un fichier',
    uploading: 'Téléversement…',
    deleteLogConfirm: 'Supprimer ce journal ? Action irréversible.',
    imapConfigTitle: 'Configuration e-mail',
    imapLookbackLabel: 'Jours de rétroaction (e-mail)',
    imapLookbackLastDays: 'Lit les e-mails (lus et non lus) des {n} derniers jours',
    imapLookbackUnlimited: 'Lit tous les e-mails de la boîte de réception (lus et non lus, sans limite de jours)',
    imapLookbackFootnote: 'Vide = sans limite. Recommandé : 30–90 jours.',
    emailSaved: 'Configuration e-mail enregistrée.',
    addOperatorsTitle: 'Ajouter des opérateurs',
    addOperatorBtn: 'Ajouter un opérateur',
    savingShort: 'Enregistrement…',
    newSedeShort: 'Nouveau',
    deleteUserConfirm: 'Supprimer l’utilisateur {email} ? Action irréversible.',
    deleteSedeConfirm: 'Supprimer le site « {nome} » ? Les données liées perdront le lien avec le site.',
    deleteFornitoreConfirm: 'Supprimer le fournisseur « {nome} » ? Action irréversible.',
    contactsHeading: 'Contacts',
    contactNew: 'Nouveau contact',
    contactEdit: 'Modifier le contact',
    contactRemove: 'Supprimer',
    contactRemovePrice: 'Supprimer le dernier prix',
    noContacts: 'Aucun contact',
    infoSupplierCard: 'Fiche fournisseur',
    contactsLegal: 'Siège social',
    contactsFiscal: 'Données fiscales',
    contactsPeople: 'Contacts',
    noContactRegistered: 'Aucun contact enregistré',
    noEmailSyncHint: 'Sans email, le scanner ne pourra pas associer automatiquement les documents de ce fournisseur.',
    noEmailSyncWarning: 'Aucun email associé — les documents ne seront pas reconnus automatiquement.',
    filterNoEmail: 'Sans email',
    suggestEmailBtn: 'Chercher email',
    suggestEmailSearching: 'Recherche…',
    suggestEmailNoResults: 'Aucun email trouvé dans les journaux existants.',
    suggestEmailSave: 'Ajouter',
    suggestEmailSaved: 'Enregistré',
    suggestEmailSourceLog: 'du journal sync',
    suggestEmailSourceQueue: "de la file d'attente",
    suggestEmailSourceUnmatched: 'de TVA non associée',
    suggestEmailTitle: 'Emails trouvés dans les documents reçus',
    noAddressRegistered: 'Aucune adresse enregistrée',
    noFiscalRegistered: 'Aucune donnée fiscale',
    clientSince: 'Client depuis',
    fromInvoiceBtn: 'Depuis facture',
    listinoAnalyze: 'Analyser',
    listinoAnalyzing: 'Analyse IA…',
    listinoInvoiceAnalyzedBadge: 'Analysée',
    listinoNoInvoicesFile: 'Aucune facture avec pièce jointe pour ce fournisseur.',
    listinoNoProducts: 'Aucune ligne trouvée sur cette facture. Essayez une autre.',
    saveNProducts: 'Enregistrer {n} produits',
    clickAddFirst: 'Cliquez sur Ajouter pour saisir le premier produit.',
    monthNavResetTitle: 'Aller au mois en cours',
    monthNavPrevMonthTitle: 'Mois précédent',
    monthNavNextMonthTitle: 'Mois suivant',
    monthNavPrevYearTitle: 'Année précédente',
    monthNavNextYearTitle: 'Année suivante',
    supplierDesktopPeriodPickerTitle: 'Période (dates)',
    supplierDesktopPeriodPickerButtonAria: 'Ouvrir pour définir les dates Du / Au de la période',
    supplierDesktopPeriodFromLabel: 'Du',
    supplierDesktopPeriodToLabel: 'Au',
    supplierDesktopPeriodApply: 'Appliquer',
    addingAlias: 'Ajout…',
    addEmailAlias: '+ Ajouter un e-mail',
    listinoImportPanelTitle: 'Importer les produits depuis une facture',
    listinoImportSelectInvoiceLabel: 'Sélectionner la facture',
    listinoImportProductsSelected: '{selected} / {total} produits sélectionnés',
    listinoImportPriceListDateLabel: 'Date du tarif',
    listinoImportColListinoDate: 'Dernier listino',
    listinoImportDateOlderThanListinoHint:
      'Date document antérieure au dernier tarif enregistré : non importé sans forçage.',
    listinoImportApplyOutdatedAdmin: 'Appliquer comme prix actuel',
    listinoImportApplyOutdatedAdminActive: 'Forçage actif',
    listinoImportForceAllSelected: 'Forcer l’import pour toutes les lignes sélectionnées',
    listinoImportPartialSaved:
      '{inserted} lignes enregistrées ; {skipped} non importées (produits : {products}).',
    listinoManualDateBlockedHint: 'La date est antérieure au dernier tarif pour ce produit.',
    listinoManualDateBlockedNoAdmin: 'Seul un administrateur peut forcer l’insertion.',
    listinoImportSaveBlockedHintAdmin: 'Activez « Appliquer comme prix actuel » sur les lignes concernées.',
    listinoImportSaveBlockedHintOperator:
      'Certaines lignes ont une date antérieure au listino : utilisez « Appliquer comme prix actuel » ligne par ligne, ou « Forcer l’import pour toutes les lignes sélectionnées », ou désélectionnez-les.',
    listinoDocDetailImportHint:
      'L’import listino (fournisseur → Listino) compare la date du document au dernier enregistrement par produit.',
    listinoDocDetailImportHintAdmin: 'À l’import facture, utilisez le forçage ligne par ligne.',
    listinoDocRowBlockedBadge: 'Listino plus récent',
    listinoDocForceButton: 'Forcer mise à jour listino',
    listinoDocForceWorking: 'Enregistrement…',
    listinoDocForceOk: 'Prix enregistré avec la date du document.',
    listinoDocForceErr: 'Impossible d’appliquer le forçage.',
    discoveryCreateSupplier: 'Créer un fournisseur',
    discoveryCompanyName: 'Raison sociale *',
    discoveryEmailDiscovered: 'E-mail (détecté)',
    discoveryVat: 'TVA / SIRET',
    discoveryBranch: 'Site',
    discoveryBreadcrumbSettings: 'Paramètres',
    discoveryTitle: 'Explorateur de boîte',
    discoveryNoImap: 'Aucun compte IMAP configuré',
    discoveryNoImapHint: 'Configurez l’IMAP dans les paramètres du site pour activer la numérisation.',
    discoveryPartialScan: 'Numérisation partielle — erreurs sur certaines boîtes :',
    discoveryAllRegistered: 'Tous les expéditeurs sont déjà enregistrés',
    discoveryNoUnknown: 'Aucun expéditeur inconnu avec pièces jointes sur les 30 derniers jours.',
    discoveryReady: 'Prêt à numériser',
    discoveryReadyHint: 'Cliquez sur Numériser la boîte pour analyser les 30 derniers jours.',
    discoveryScanBtn: 'Numériser la boîte',
    toastDismiss: 'Fermer la notification',
    countrySaving: 'Enregistrement…',
    countrySaved: 'Enregistré',
    sidebarSediTitle: 'Sites',
    deleteGenericConfirm: 'Supprimer cet élément ? Action irréversible.',
    deleteFailed: 'Erreur lors de la suppression :',
    errorGenericTitle: 'Une erreur s’est produite',
    errorGenericBody: 'Une erreur inattendue s’est produite. Réessayez ou revenez à l’accueil.',
    tryAgain: 'Réessayer',
    errorCodeLabel: 'Code d’erreur :',
    errorSegmentTitle: 'Impossible de charger cette section',
    errorSegmentBody: 'Cette section n’a pas pu être chargée. Réessayez ou revenez en arrière.',
    errorDevDetailsSummary: 'Détails de l’erreur (développement uniquement)',
    errorFatalTitle: 'Erreur critique',
    errorFatalBody: 'L’application a rencontré un problème inattendu.',
    approvazioni_pageSub: 'Factures en attente d\'approbation au-dessus du seuil',
    analyticsPageSub: 'Vue d\'ensemble des achats et de la réconciliation',
    analyticsMonths: '{n} mois',
    attivitaPageTitle: 'Journal d\'activité',
    attivitaPageSub: 'Historique complet des opérations des opérateurs',
    attivitaExportCsv: 'Exporter CSV',
    attivitaAllOperators: 'Tous les opérateurs',
    attivitaRemoveFilters: 'Supprimer les filtres',
    analyticsErrorLoading: 'Erreur de chargement des données',
    analyticsNoData: 'Aucune donnée disponible.',
    analyticsKpiTotalInvoiced: 'Total facturé',
    analyticsKpiNFatture: '{n} factures',
    analyticsKpiReconciliation: 'Rapprochement',
    analyticsKpiCompleted: '{n} complétées',
    analyticsKpiAvgTime: 'Temps moyen de rapprochement',
    analyticsKpiDays: '{n} j',
    analyticsKpiDaysFrom: 'jours du bon de livraison à la facture',
    analyticsKpiSlow: 'lent',
    analyticsKpiOk: 'ok',
    analyticsKpiPriceAnomalies: 'Anomalies de prix',
    analyticsKpiResolvedOf: '{n} résolues sur {total}',
    analyticsKpiToCheck: 'à vérifier',
    analyticsKpiAllOk: 'tout ok',
    analyticsChartMonthlySpend: 'Dépenses mensuelles',
    analyticsChartAmount: 'Montant',
    analyticsChartInvoices: 'Factures',
    analyticsChartTopSuppliers: 'Top fournisseurs',
    analyticsChartNoData: 'Aucune donnée',
    analyticsChartBolleVsFatture: 'BL vs Factures',
    analyticsChartDeliveryNotes: 'Bons de livraison',
    analyticsSummaryPendingDocs: 'Documents en attente',
    analyticsSummaryPendingNotes: 'BL en attente',
    analyticsSummaryArchivedInvoices: 'Factures archivées',
    approvazioni_noPending: 'Aucune facture en attente',
    approvazioni_allReviewed: 'Toutes les factures au-dessus du seuil ont été examinées.',
    approvazioni_viewInvoice: 'Voir la facture →',
    approvazioni_rejectReason: 'Motif de rejet (optionnel)',
    approvazioni_rejectPlaceholder: 'Ex : montant ne correspond pas au BL...',
    approvazioni_confirmReject: 'Confirmer le rejet',
    approvazioni_approve: 'Approuver',
    approvazioni_reject: 'Rejeter',
    approvazioni_threshold: 'seuil',
    attivitaFilterAll: 'Tous',
    attivitaFilterBolle: 'Bons de livraison',
    attivitaFilterFatture: 'Factures',
    attivitaFilterDocumenti: 'Documents',
    attivitaFilterOperatori: 'Opérateurs',
    attivitaError: 'Impossible de charger les activités.',
    attivitaNoRecent: 'Aucune activité récente',
    attivitaRecentTitle: 'Activité récente',
    rekkiSyncTitle: 'Synchronisation Email Rekki',
    rekkiSyncDesc: 'Scanne la boîte mail du site et associe automatiquement les commandes Rekki',
    rekkiSyncMobileTap: 'Synchroniser Emails Rekki',
    rekkiSyncNeverRun: 'Jamais exécuté',
    rekkiSyncTapUpdate: 'appuyer pour mettre à jour',
    rekkiSyncTapStart: 'appuyer pour démarrer',
    rekkiSyncButtonLabel: 'SCANNER BON / FACTURE',
    rekkiSyncInProgress: 'Scan en cours',
    rekkiSyncProcessing: 'Traitement des emails Rekki…',
    rekkiSyncStop: 'Arrêter',
    rekkiSyncCheckNow: 'Vérifier maintenant',
    rekkiSyncStarting: 'Démarrage du scan...',
    rekkiSyncDays: '{n} jours',
    rekkiSyncLastScan: 'Dernier scan',
    rekkiSyncEmails: 'Emails',
    rekkiSyncDocuments: 'Documents',
    rekkiSyncMatched: 'Associés',
    rekkiSyncUnmatched: 'À associer',
    rekkiSyncRecentEmails: 'Derniers emails traités',
    rekkiSyncNoData: 'Aucun prix détecté',
    rekkiSyncNoDataDesc: 'Appuyez sur «Vérifier maintenant» pour scanner les emails Rekki de {nome}',
    rekkiImapNotConfigured: 'Boîte mail non configurée',
    rekkiImapNotConfiguredDesc: 'Configurez les identifiants IMAP dans Paramètres → Site pour activer la synchronisation.',
    rekkiPhaseQueued: 'En file...',
    rekkiPhaseConnect: 'Connexion à la boîte mail...',
    rekkiPhaseSearch: 'Recherche des emails Rekki...',
    rekkiPhaseProcess: 'Traitement des emails...',
    rekkiPhasePersist: 'Enregistrement des données...',
    rekkiPhaseDone: 'Terminé',
    rekkiPhaseError: 'Erreur',
    rekkiDoneResult: 'Terminé — {n} emails traités',
    rekkiErrUnknown: 'Erreur inconnue',
    rekkiErrNetwork: 'Erreur réseau',
    analyticsSinceFY: 'depuis début EX',
    backupPageTitle: 'Sauvegarde des données',
    backupPageDesc: 'Exports CSV automatiques hebdomadaires · Chaque lundi à 02h00 UTC',
    auditTitle: 'Audit de récupération de créances',
    auditDesc: 'Analyse toutes les factures historiques pour identifier les surfacturations par rapport aux prix Rekki convenus',
    auditDateFrom: 'Du',
    auditDateTo: 'Au',
    auditRunBtn: "Lancer l'audit",
    auditRunning: 'Analyse en cours...',
    auditSyncConfirm: 'Cette opération analysera toutes les factures historiques et mettra à jour les dates de référence dans le tarif. Continuer ?',
    auditSyncTitle: "Synchroniser l'historique avec Rekki",
    auditSyncDesc: 'Analyse toutes les factures passées et met à jour automatiquement les dates de référence pour lever les blocages «Date de document antérieure»',
    auditSyncBtn: 'Synchroniser',
    auditSyncing: 'Synchro...',
    auditKpiSpreco: 'Gaspillage total',
    auditKpiAnomalies: 'Anomalies',
    auditKpiProducts: 'Produits',
    auditKpiFatture: 'Factures',
    auditNoOvercharges: 'Aucune surfacturation détectée !',
    auditNoOverchargesDesc: 'Tous les prix facturés sont conformes ou inférieurs aux prix Rekki convenus',
    auditColFattura: 'Facture',
    auditColProdotto: 'Produit',
    auditColPagato: 'Payé',
    auditColPattuito: 'Convenu',
    auditColSpreco: 'Gaspillage',
    auditHelpTitle: "Comment fonctionne l'audit ?",
    auditHelpP1: "L'audit analyse toutes les factures de la période sélectionnée et :",
    auditHelpLi1: "Extrait les lignes de chaque facture grâce à l'IA",
    auditHelpLi2: 'Compare les prix payés avec les prix Rekki convenus (tarif)',
    auditHelpLi3: 'Identifie tous les cas où un prix supérieur a été payé',
    auditHelpLi4: 'Calcule le gaspillage total en fonction des quantités achetées',
    auditHelpCta: '💡 Utilisez ce rapport pour demander des avoirs au fournisseur',
    auditErrStatus: 'Erreur {status}',
    auditErrGeneric: "Erreur lors de l'audit",
    auditErrSync: 'Erreur lors de la synchronisation',
    auditCsvDate: 'Date',
    auditCsvInvoiceNum: 'Numéro de facture',
    auditCsvProduct: 'Produit',
    auditCsvRekkiId: 'ID Rekki',
    auditCsvPaid: 'Payé',
    auditCsvAgreed: 'Convenu',
    auditCsvDiffPct: 'Différence %',
    auditCsvQty: 'Quantité',
    auditCsvWaste: 'Gaspillage',
    sedeErrCreating: 'Erreur lors de la création du site.',
    sedeErrSavingProfile: "Erreur lors de l'enregistrement du profil.",
    sedePinUpdated: 'PIN mis à jour.',
    sedeErrUpdatingPin: 'Erreur lors de la mise à jour du PIN.',
    sedeErrSavingPin: "Erreur lors de l'enregistrement du PIN du site.",
    sedeLocSaved: 'Localisation enregistrée.',
    sedeErrLoadData: 'Erreur lors du chargement des données.',
    sedeErrUpdating: 'Erreur lors de la mise à jour du site.',
    sedeUpdated: 'Site mis à jour.',
    sedeDeleted: 'Site supprimé.',
    sedeErrSavingImap: "Erreur lors de l'enregistrement IMAP.",
    sedeWizardStepOf: 'Étape {step} sur 3',
    sedeWizardNext: 'Suivant',
    sedeWizardBack: '← Retour',
    sedeWizardSkip: 'Passer',
    sedeWizardNameLabel: 'Nom du site',
    sedeWizardEmailConfigTitle: 'Configuration e-mail',
    sedeWizardEmailConfigDesc: 'Pour recevoir les factures par e-mail. Vous pouvez le configurer plus tard.',
    sedeWizardAppPassRequired: "Mot de passe d'application requis.",
    sedeWizardAddOperatorsTitle: 'Ajouter des opérateurs',
    sedeWizardAddOperatorsDesc: 'Les opérateurs se connectent avec leur nom + PIN (min. 4 chiffres).',
    sedeWizardCreateBtn: 'Créer le site + {n} opérateurs',
    sedeWizardCreatingBtn: 'Création…',
    sedeWizardStartSetup: 'Démarrer la configuration guidée',
    sedeEmailNotConfigured: 'E-mail non configuré.',
    sedeCreatedSuccess: 'Site "{nome}" créé avec succès.',
    gmailBadgeTitle: "💡 Prêt pour l'audit des prix ?",
    gmailBadgeDescConfigured: "Gmail API est configuré ! Connectez votre compte pour activer le scanner automatique et récupérer des remboursements potentiels sur {nome}.",
    gmailBadgeDescNotConfigured: "Configurez Gmail (2 min) pour analyser automatiquement les emails de {nome} et identifier les surfacturations non autorisées.",
    gmailBadgeCTAConnect: "Connecter et Scanner",
    gmailBadgeCTASetup: "Configurer maintenant",
    gmailBadgeDismiss: "Masquer",
    gmailBadgeAPIConfigured: "API Configuré",
    gmailBadgeConnectAccount: "Connecter le compte",
    gmailBadgePriceCheck: "Contrôle des prix",
    gmailBadgePriceCheckSub: "Anomalies auto",
    gmailBadgeRecoverySub: "Historique 2 ans",
    autoSyncTitle: "Auto-Sync Facture",
    autoSyncDesc: "Extrayez et comparez automatiquement les produits de la facture avec le listino",
    autoSyncBtn: "Analyser la Facture",
    autoSyncBtnLoading: "Analyse en cours...",
    autoSyncTotal: "Total",
    autoSyncAnomalies: "Anomalies",
    autoSyncNewItems: "Nouveaux",
    autoSyncProduct: "Produit",
    autoSyncPrice: "Prix",
    autoSyncNewItem: "Nouveau",
    autoSyncAnomalyWarning: "{n} produit{s} avec hausse anormale",
    autoSyncConfirmBtn: "Confirmer {n} produits",
    autoSyncImporting: "Importation...",
    autoSyncErrAnalysis: "Erreur lors de l'analyse",
    autoSyncErrImport: "Erreur lors de l'importation",
  },
}

const de: Translations = {
  ui: {
    tagline:          'Einkaufsverwaltung',
    closeMenu:        'Menü schließen',
    expandSidebar:    'Seitenleiste aufklappen',
    navMore:            'Mehr',
    collapseSidebar:  'Seitenleiste einklappen',
    changeOperator:   'Operator wechseln',
    changeOperatorShort: 'Wechseln',
    selectOperator:   'Operator auswählen',
    activeOperator:   'Aktiv',
    noOperator:       'Keiner',
    operatorLabel:    'Aktiver Benutzer',
    operatorChanged:  'Operator erfolgreich gewechselt',
    noOperatorsFound: 'Keine Operatoren für diesen Standort gefunden.',
    noSedeForOperators: 'Kein Standort verknüpft. Legen Sie einen Standort an oder verknüpfen Sie Ihr Admin-Profil mit einem Standort.',
    currentlyActive:  'Aktiv:',
    languageTooltip:  'Sprache',
    syncError:        'Fehler beim E-Mail-Scan.',
    syncSuccess:      'Synchronisierung abgeschlossen.',
    networkError:     'Netzwerkfehler. Bitte erneut versuchen.',
    connectionOnline: 'Online',
    connectionOffline: 'Offline',
    connectionReconnecting: 'Verbindung wird wiederhergestellt…',
    emailSyncResumed: 'Verbindung wiederhergestellt — E-Mail-Sync wird fortgesetzt.',
    emailSyncStreamIncomplete:
      'Synchronisation unvollständig (Verbindung vorzeitig beendet). Bitte erneut versuchen.',
    emailSyncAlreadyRunning:
      'Synchronisation läuft bereits. Warten Sie auf Abschluss oder brechen Sie oben ab.',
    emailSyncCancelled: 'E-Mail-Synchronisation abgebrochen.',
    reminderError:    'Fehler beim Senden der Mahnungen.',
    noReminders:      'Keine Mahnungen zu senden (Lieferanten ohne E-Mail?).',
    remindersCount:   'Mahnung',
    remindersSentOne: '1 Zahlungserinnerung von {total} gesendet.',
    remindersSentMany: '{n} Zahlungserinnerungen von {total} gesendet.',
    pinError:         'Falscher PIN.',
    operatorPinStepUpTitle: 'Operator bestätigen',
    operatorPinStepUpHint: 'Geben Sie die 4-stellige PIN des aktiven Operators ein, um diese Änderung zu bestätigen.',
    operatorPinStepUpNoActive:
      'Kein aktiver Operator in dieser Sitzung. Nutzen Sie die Schaltfläche unten (untere Leiste auf dem Handy oder Seitenmenü), wählen Sie den Operator, dann die PIN.',
    operatorPinStepUpChooseOperator: 'Operator wählen',
    verifyAndContinue: 'Weiter',
    operatorAutoLockLabel: 'Auto-Sperre nach',
    operatorAutoLockNever: 'Aus',
    operatorAutoLockMinutes: '{n} Min',
    sidebarSedeActive: 'Aktiver Standort: {name}',
    sidebarSedeSwitchTo: 'Wechseln zu: {name}',
    sidebarSedeSettings: 'Einstellungen {name}',
    appBuildLine: 'v{version} · {commit} · {env}',
    appBuildLineLocal: 'v{version} · {commit}',
    appBuildNoCommit: '—',
    appBuildAria: 'App-Version und Deployment-Build',
    deployEnvLocal: 'lokal',
    deployEnvProduction: 'Produktion',
    deployEnvPreview: 'Vorschau',
    deployEnvDevelopment: 'Entwicklung',
  },
  login: {
    brandTagline: 'Rechnungsverwaltung',
    subtitle: 'Zugang: Ihr Name und 4-stelliger PIN',
    adminSubtitle: 'Verwaltungsportal',
    adminSubtitleHint:
      'E-Mail und Passwort für das Verwaltungsportal. Für Operatorenname und PIN nutzen Sie «Operator-Zugang» (Standort-Admins und Operatoren).',
    nameLabel: 'Name',
    namePlaceholder: '',
    pinLabel: 'PIN',
    pinDigits: '(4 Ziffern)',
    lookingUp: 'Name wird geprüft…',
    enterFirstName: 'Namen eingeben und Tab drücken',
    emailLabel: 'E-Mail',
    emailPlaceholder: 'admin@firma.de',
    passwordLabel: 'Passwort',
    passwordPlaceholder: 'Mindestens 6 Zeichen',
    loginBtn: 'Anmelden',
    adminLink: 'Verwaltungsportal →',
    operatorLink: '← Operator-Zugang',
    pinIncorrect: 'Falscher PIN. Bitte erneut versuchen.',
    invalidCredentials: 'Ungültige Anmeldedaten.',
    verifying: 'Überprüfung…',
    accessing: 'Anmeldung läuft…',
    notFound: 'Benutzer nicht gefunden.',
    adminOnlyEmail: 'Diese Anmeldung ist nur für Administratoren. Nutzen Sie Name und PIN oder bitten Sie um ein Admin-Konto.',
    adminGateLabel: 'Admin-Entsperrcode',
    adminGateHint: 'PIN eingeben, um E-Mail und Passwort freizuschalten.',
    adminGateWrong: 'Ungültiger Code.',
    sessionGateTitle: 'Zugang bestätigen',
    sessionGateSubtitle: 'Neue Sitzung: geben Sie erneut Ihren Namen und die 4-stellige PIN ein.',
    sessionGateWrongUser: 'Dieser Name passt nicht zum angemeldeten Konto.',
    sessionBootStuck: 'Profil hat nicht rechtzeitig geladen. Bitte erneut anmelden.',
    netflixTitle: 'Wer hat Dienst?',
    netflixSubtitle: 'Tippe deinen Namen zum Einloggen',
    netflixManualLogin: 'Namen nicht gefunden? Manuell einloggen →',
    netflixChangeOperator: '← Operator wechseln',
    deviceTrustTitle: 'Beim nächsten Mal automatisch auf diesem Gerät anmelden?',
    deviceTrustYes: 'Ja, merken',
    deviceTrustNo: 'Nein danke',
    deviceWelcomeBack: 'Willkommen zurück, {name}!',
    deviceWelcomeAccediHint: 'Gerät erkannt — wenn Sie bereit sind, weiter.',
    accessoSwitchOperator: 'Benutzer wechseln',
  },
  nav: { dashboard: 'Dashboard', dashboardAdmin: 'Admin', operatori: 'Operatoren', fornitori: 'Lieferanten', bolle: 'Lieferscheine', fatture: 'Rechnungen', ordini: 'Bestellungen', archivio: 'Archiv', logEmail: 'E-Mail-Log', sedi: 'Standort & Nutzer', sediTitle: 'Standort', sediNavGroupMaster: 'Standorte', gestisciSedeNamed: '{name} verwalten', gestisciSedi: 'Standorte verwalten', tuttiFornitori: 'Alle Lieferanten', cerca: 'Suchen…', nessunRisultato: 'Keine Ergebnisse', altriRisultati: 'weitere — suche oben', impostazioni: 'Einstellungen', nuovaBolla: 'Neuer Lieferschein', ricevuto: 'Beleg', operatorActiveHint: 'Wer ist gerade aktiv?', esci: 'Abmelden', guida: 'Hilfe', sedeGlobalOverview: 'Globale Übersicht', bottomNavBackToSede: 'Zurück zum Standort', bottomNavScannerAi: 'KI-Scanner', bottomNavProfile: 'Profil', bottomNavSediMap: 'Standortkarte', bottomNavGlobalReports: 'Globale Berichte', bottomNavNewOrder: 'Neue Bestellung', bottomNavPriceHistory: 'Preisverlauf', bottomNavContact: 'Kontakt', addNewDelivery: 'Neuer Lieferschein', openRekki: 'Rekki', ariaMain: 'Hauptnavigation', ariaAdmin: 'Administrator-Navigation', ariaFornitore: 'Lieferanten-Navigation', ariaCallSupplier: 'Lieferanten anrufen', notifications: 'Benachrichtigungen', noNotifications: 'Keine Benachrichtigungen', errorAlert: 'Sync-Fehler (24h)', analytics: 'Analytics', approvazioni: 'Genehmigungen', attivita: 'Aktivität', backup: 'Sicherung', consumiAi: 'KI-Verbrauch', strumenti: 'Werkzeuge' },
  strumentiCentroOperazioni: {
    pageTitle: 'Operationszentrale',
    pageSubtitle:
      'Schnellzugriff auf OCR, Dubletten, Lieferanten-Zuordnung und Preisliste. Buttons auf einzelnen Dokumenten bleiben erhalten.',
    breadcrumbTools: 'Werkzeuge',
    sectionOcr: 'OCR & Dokumente',
    sectionDup: 'Duplikate & Bereinigung',
    sectionListino: 'Preisliste',
    cardReanalyzeTitle: 'OCR erneut ausführen (Warteschlange & KI)',
    cardReanalyzeDesc:
      'Ausstehende Dokumente, KI-Klassifizierung und Gemini-Vorschläge wie in AI Inbox — auf einem Lieferschein oder einer Rechnung gibt es weiter „OCR neu“.',
    cardOpenInbox: 'AI Inbox öffnen',
    cardRefreshDateTitle: 'Datum aus Anhang neu lesen',
    cardRefreshDateDesc: 'In einer Rechnung auf „Datum neu lesen“ neben dem Datum klicken (Anhang erforderlich).',
    cardOpenFatture: 'Rechnungen öffnen',
    cardOcrCheckTitle: 'OCR-Prüfung Lieferant',
    cardOcrCheckDesc:
      'Am Lieferantenprofil (Desktop): „OCR prüfen“ wirft die Massenprüfung für verdächtige Daten an.',
    cardOpenFornitoreSheet: 'Lieferanten öffnen',
    cardDupScanTitle: 'Rechnungs-Duplikate finden',
    cardDupScanDesc: 'Wie die Symbolleiste: gleicher Lieferant, gleiches Datum und gleiche Rechnungsnummer.',
    cardDupManageTitle: 'Duplikatverwaltung',
    cardDupManageDesc: 'Lieferscheine, Rechnungen und Lieferanten — Gruppen prüfen und zusammenführen oder löschen.',
    cardDupManageCta: 'Duplikatverwaltung öffnen',
    cardAuditTitle: 'Audit Lieferanten-Zuordnung',
    cardAuditDesc: 'Absender-E-Mail und zugewiesenen Lieferanten abstimmen — Register „Zuordnungen“ in AI Inbox.',
    cardOpenAudit: 'Register Zuordnungen öffnen',
    cardListinoAutoTitle: 'Preisliste automatisch aktualisieren (Auto)',
    cardListinoAutoDesc:
      'Auf dem Preislisten-Tab: nicht verarbeitete Rechnungen automatisch auswerten.',
    cardListinoFromInvTitle: 'Preise „Aus Rechnung“ importieren',
    cardListinoFromInvDesc: 'Preislisten-Tab: Rechnung mit PDF wählen und Positionen bestätigen.',
    cardListinoAddTitle: 'Produkt zur Preisliste hinzufügen',
    cardListinoAddDesc: 'Preislisten-Tab: Schaltfläche Hinzufügen für manuelle Eingabe (Desktop).',
    cardListinoCta: 'Zu Lieferanten — Preislisten-Tab',
    manualImapSyncTitle: 'E-Mail-Sync — 24 h-Fenster',
    manualImapSyncDesc:
      'Durchsucht das Postfach nach den letzten ca. 24 Stunden. Der geplante Cron nutzt 3 Stunden, um die Last zu begrenzen.',
    historicSyncSectionLabel: 'Historischer Sync (Vorjahr)',
    historicSyncTitle: 'Daten des Vorjahrs importieren',
    historicSyncDesc:
      'Lädt E-Mails der letzten ~365 Tage herunter, um mit dem Geschäftsjahr 2025/26 zu vergleichen.',
    historicSyncWarning: '⚠️ Langsame Aktion — kann mehrere Minuten dauern. Nur einmal ausführen.',
    historicSyncCta: 'Historischen Sync starten',
    historicSyncResult: '{n} Dokumente aus dem Vorjahr importiert',
    historicSyncProgress: 'Verarbeitung: {label}…',
    historicSyncCompleted: 'Fertig!',
    hintContextualShortcuts:
      'Hinweis: Zeilenaktionen „OCR neu“ auf Schein/Rechnung; Auto/Import/Hinzufügen bleiben auf der Preisliste.',
  },
  common: { save: 'Speichern', cancel: 'Abbrechen', delete: 'Löschen', edit: 'Bearbeiten', new: 'Neu', loading: 'Laden...', error: 'Fehler', success: 'Erfolg', noData: 'Keine Daten', document: 'Dokument', actions: 'Aktionen', date: 'Datum', status: 'Status', supplier: 'Lieferant', notes: 'Notizen', phone: 'Telefon', saving: 'Speichern...', attachment: 'Anhang', openAttachment: 'Anhang öffnen', detail: 'Detail', add: 'Hinzufügen', rename: 'Umbenennen', role: 'Rolle', aiExtracted: 'KI-extrahierte Daten', matched: 'Zugeordnet', notMatched: 'Nicht zugeordnet', recordSupplierLinked: 'Verknüpft', company: 'Unternehmen', invoiceNum: 'Rechnungs-Nr.', documentRef: 'Referenz', total: 'Gesamt', duplicateBadge: 'DUPLIKAT', emailSyncAutoSavedBadge: 'Automatisch gespeichert', viewerZoomIn: 'Vergrößern', viewerZoomOut: 'Verkleinern', viewerZoomReset: '100 %', viewerZoomHint: 'Strg+Mausrad oder Tasten' },
  status: { inAttesa: 'Ausstehend', completato: 'Abgeschlossen', completata: 'Abgeschlossen' },
  dashboard: { title: 'Dashboard', suppliers: 'Lieferanten', totalBills: 'Lieferscheine gesamt', pendingBills: 'Ausstehende Scheine', invoices: 'Rechnungen', recentBills: 'Aktuelle Lieferscheine', recentBillsMobileListDisabled: 'Die detaillierte Liste wird auf diesem Bildschirm nicht angezeigt. Nutzen Sie „Alle anzeigen“ für das Archiv oder wechseln Sie zu einem größeren Display.', viewAll: 'Alle anzeigen →', syncEmail: 'E-Mail synchronisieren', emailSyncScopeLookback: 'Letzte Tage (Standort)', emailSyncScopeFiscal: 'Geschäftsjahr', emailSyncFiscalYearSelectAria: 'Zeitraum für E-Mail-Sync', emailSyncScopeHint: 'IT, FR, DE, ES: Kalenderjahr. UK: Steuerjahr bis 5. Apr. Jeder Standort nutzt sein Land.', emailSyncLookbackSedeDefault: 'Standort-Standard (IMAP)', emailSyncLookbackDaysN: 'Letzte {n} Tage', emailSyncLookbackDaysAria: 'Wie weit zurück im Postfach suchen', emailSyncLookbackDaysHint: 'Standort-Standard: nutzt die auf dem Standort hinterlegten Tage. Sonst IMAP-Suche auf die letzten N Tage begrenzen (gelesen und ungelesen).', emailSyncDocumentKindAria: 'Dokumenttyp für den E-Mail-Import', emailSyncDocumentKindHint: 'Alle: Standard. Neuer Lieferant: nur Absender ohne Eintrag. Lieferschein / Rechnung: Entwurfstyp erzwingen. Kontoauszug: nur Mails mit Betreff wie Statement/Auszug.', emailSyncDocumentKindAll: 'Alle Dokumente', emailSyncDocumentKindFornitore: 'Neuer Lieferant', emailSyncDocumentKindBolla: 'Lieferschein (DDT)', emailSyncDocumentKindFattura: 'Rechnung', emailSyncDocumentKindEstratto: 'Kontoauszug', syncing: 'Synchronisierung...', sendReminders: 'Zahlungserinnerungen senden', sending: 'Senden...', viewLog: 'Log anzeigen', sedeOverview: 'Übersicht nach Standort', manageSedeNamed: '{name} verwalten →', manageSedi: 'Standorte verwalten →', sedeImapOn: 'E-Mail aktiv', digitalizzaRicevuto: 'Beleg digitalisieren', scannerFlowCardTitle: 'Scanner — heute', scannerFlowCardHint: 'PDF mit KI verarbeitet und heute an diesem Standort gespeichert (Zeitzone der Einstellungen).', scannerFlowAiElaborate: 'KI verarbeitet', scannerFlowArchived: 'Archiviert', scannerFlowOpenScanner: 'Neuer Scan', scannerFlowBolleHubTitle: 'Lieferschein-Archiv', scannerFlowRecentTitle: 'Aktuelle Scanner-KI-Aktivität', scannerFlowNoRecent: 'Keine kürzlichen Scan-Ereignisse. Nutzen Sie Scanner KI in der unteren Leiste oder starten Sie einen neuen Scan.', scannerFlowTodayCounts: 'Heute: {ai} KI-verarbeitet · {arch} archiviert', scannerFlowFiscalPeriodLine: 'Geschäftsjahr {year}', scannerFlowCardHintFiscal: 'Die Zahlen beziehen sich auf das im Kopf ausgewählte Geschäftsjahr, nicht nur auf heute.', scannerFlowDetailListCountRange: '{n} Dokumente im Zeitraum', scannerFlowDetailListCountToday: '{n} Dokumente heute', scannerFlowDetailEmptyRange: 'Keine Dokumente in diesem Zeitraum.', scannerFlowStepAiElaborata: 'PDF von KI verarbeitet — Text und Felder ausgelesen (OCR)', scannerFlowStepArchiviataBolla: 'Lieferschein gespeichert und archiviert', scannerFlowStepArchiviataFattura: 'Rechnung gespeichert und archiviert', scannerFlowTodayActivityTitle: 'Aktivität heute', scannerFlowNoEventsToday: 'Heute keine Scanner-KI-Aktivität für diesen Standort.', scannerFlowEventsAllLink: 'Vollständiges Ereignisprotokoll →', scannerFlowEventsPageTitle: 'Scanner KI — Ereignisse', scannerFlowEventsEmpty: 'Keine Scanner-Ereignisse erfasst.', scannerFlowEventsPrev: 'Zurück', scannerFlowEventsNext: 'Weiter', scannerFlowEventsPageOf: 'Seite {current} von {pages}', scannerMobileTileTap: 'Tippen zum Start', duplicateFattureScanButton: 'Doppelte Rechnungen finden', duplicateFattureToolbarShort: 'Duplikate', sendRemindersToolbarShort: 'Mahnungen', syncEmailToolbarShort: 'E-Mail', emailSyncCronLine: '🟢 Auto-Sync — zuletzt: {relative}', emailSyncCronIssueLine: '⚠️ IMAP-Problem — zuletzt: {relative}', emailSyncCronNever: 'noch nie', emailSyncCronJustNow: 'gerade eben', emailSyncCronMinutesAgo: 'vor {n} Min.', emailSyncCronHoursAgo: 'vor {n} Std.', emailSyncCronLateLine: '🟡 Sync verzögert — zuletzt: {relative}', emailSyncCronStoppedLine: '🔴 Sync gestoppt — zuletzt: {relative}', emailSyncForceSync: 'Sync erzwingen', emailSyncEmergencyToolsAria: 'Werkzeuge — E-Mail manuell synchronisieren (Notfall)', duplicateFattureModalTitle: 'Doppelte Rechnungen', duplicateFattureScanning: 'Rechnungen werden geprüft…',
    duplicateFattureScanningBatch: 'Zuletzt gelesener Datenbank‑Batch',
    duplicateFattureScanningAwaitingRows: 'Warte auf die ersten Zeilen aus der Datenbank (der erste Block kann bei vielen Rechnungen dauern).', duplicateFattureNone: 'Keine Duplikate. Gleicher Lieferant, gleiches Belegdatum und gleiche Rechnungsnummer (nur Zeilen mit Nummer).', duplicateFattureError: 'Prüfung fehlgeschlagen. Bitte später erneut versuchen.', duplicateFattureGroupCount: '{n} Kopien', duplicateFattureSedeUnassigned: 'Ohne Standort', duplicateFattureTruncated: 'Auswertung auf die ersten 50.000 sichtbaren Rechnungen begrenzt; Ergebnis ggf. unvollständig.', duplicateFattureClose: 'Schließen', duplicateFattureRowsAnalyzed: '{n} Rechnungen ausgewertet', duplicateFattureDeleteConfirm: 'Diese Rechnung löschen? Die anderen Kopien in der Gruppe bleiben gespeichert. Nicht rückgängig zu machen.', duplicateFattureDeleteAria: 'Diese Duplikat-Kopie löschen', duplicateDashboardBanner_one: '{n} Duplikat erkannt — Zum Verwalten klicken', duplicateDashboardBanner_other: '{n} Duplikate erkannt — Zum Verwalten klicken', kpiFiscalYearFilter: 'KPI-Zeitraum (Geschäftsjahr)', kpiFiscalYearFilterAria: 'Zahlen zu Lieferscheinen, Rechnungen, Bestellungen, Listino und Kontoauszügen nach Geschäftsjahr filtern', workspaceQuickNavAria: 'Schnellzugriff auf die Standort-Bereiche (gleiche Ziele wie die KPI-Kacheln unten)', desktopHeaderSedeToolsMenuTrigger: 'Werkzeuge', desktopHeaderSedeToolsMenuTriggerAriaReminders: 'Mahnungen: {n} Lieferanten mit bald fälligen Lieferscheinen', desktopHeaderSedeToolsMenuAria: 'Panel: doppelte Rechnungen, Zahlungserinnerungen und E-Mail-Synchronisation', kpiNoPendingBills: 'Keine ausstehenden Lieferscheine.', kpiOperatorOfflineOverlayTitle: 'Synchronisation pausiert', kpiOperatorOfflineOverlayHint: 'Offline: KPI-Kartenlinks sind deaktiviert, bis die Verbindung wiederhergestellt ist.', kpiListinoAnomaliesCountLine: '{n} Preisanomalien erkannt', kpiBollePendingListCta: '{n} ausstehend anzeigen →', kpiDuplicateInvoicesDetected: '⚠️ {n} doppelte Rechnungen erkannt',
    kpiDuplicateBolleDetected: '⚠️ {n} doppelte Lieferscheine erkannt',
    kpiDocumentiDaRevisionareTitle: 'Zu prüfende Dokumente',
    kpiDocumentiDaRevisionareSub: 'Duplikate, unbekannte Absender und Rekki-Preisanomalien',
    inboxUrgentePageTitle: 'Dringendes Postfach',
    inboxUrgentePageIntro: 'Zentral für Vorgänge: zuzuordnende Dokumente, Preisanomalien und Duplikate in Ihren Listen.',
    inboxUrgenteNavDocQueue: 'E-Mail-Dokumentwarteschlange',
    inboxUrgenteNavPriceAnomalies: 'Prüfung — Rekki-Preisanomalien',
    inboxUrgenteNavInvoices: 'Rechnungen (Duplikate)',
    inboxUrgenteNavBolle: 'Lieferscheine (Duplikate)',
    inboxUrgenteNavOrdini: 'Bestellungen (Duplikate)',
    inboxUrgenteNavAiInbox: 'KI-Posteingang (Warteschlange + Duplikate)',
    errorCountSuffix: 'Fehler', manualReceiptLabel: 'Eingang (ohne Lieferschein)', manualReceiptPlaceholder: 'z. B. 5 kg Tintenfisch, 2 Kisten Zitronen', manualReceiptRegister: 'Lieferung erfassen', manualReceiptRegistering: 'Wird gespeichert…', manualReceiptSaved: 'Lieferung erfasst.', manualReceiptNeedTextOrPhoto: 'Beschreibung eingeben oder Foto anhängen.', manualReceiptRemovePhoto: 'Foto entfernen', manualReceiptNeedSupplier: 'Bitte einen Lieferanten wählen.', manualReceiptRegisterFailed: 'Registrierung fehlgeschlagen.', manualReceiptEmailSupplierLabel: 'E-Mail an Lieferanten: Bestellung und Lieferschein anfordern', manualReceiptEmailSupplierHint: 'E-Mail des Lieferanten im Profil hinterlegen.', manualReceiptEmailSent: 'Anfrage-E-Mail an Lieferanten gesendet.', manualReceiptEmailFailed: 'Eingang gespeichert, E-Mail konnte nicht gesendet werden.', manualReceiptEmailDescPhotoOnly: 'Foto zur Eingangsregistrierung beigefügt (ohne Text).', adminGlobalTitle: 'Globales Dashboard', adminGlobalSubtitle: 'Überblick über alle Standorte. Wählen Sie eine Filiale im Menü oder auf der Karte für die operative Ansicht.', adminGlobalTotalsLabel: 'Netzwerk-Gesamtwerte', adminOpenBranchDashboard: 'Operative Ansicht', adminSedeSettingsLink: 'Standort-Seite', adminDocQueueShort: 'In Warteschlange', rekkiOrder: 'Bei Rekki bestellen', manualDeliveryNeedSede: 'Wählen Sie einen aktiven Operator oder stellen Sie sicher, dass Ihr Profil mit einem Standort verknüpft ist, um eine Lieferung zu erfassen.', kpiPriceListSub: 'Zeilen in der Preisliste', listinoOverviewHint: 'Preislistenzeilen für Lieferanten in Ihrem Bereich. Lieferant öffnen zum Bearbeiten oder Import aus Rechnung.', listinoOverviewEmpty: 'Keine Preislistenzeilen in diesem Bereich.', listinoOverviewOpenSupplier: 'Lieferant öffnen →', listinoOverviewLimitNote: 'Die letzten {n} Zeilen.', fattureRiepilogoTitle: 'Rechnungssummen', fattureRiepilogoHint: 'Summe der Beträge in Ihrem Bereich. Die Tabelle zeigt die neuesten Rechnungen nach Datum; öffnen Sie eine für Anhang und Verknüpfungen.', fattureRiepilogoEmpty: 'Keine Rechnungen in diesem Bereich.', fattureRiepilogoLimitNote: 'Die letzten {n} Rechnungen (nach Datum).', fattureRiepilogoOpenInvoice: 'Rechnung öffnen →', fattureRiepilogoCountLabel: '{n} Rechnungen', fattureRiepilogoLinkAll: 'Alle Rechnungen →', kpiStatementNone: 'Kein Kontoauszug', kpiStatementAllOk: 'Keine Auffälligkeiten', kpiStatementIssuesFooter: 'von {t} geprüften Auszügen', kpiDaProcessareSub: 'Dokumente in Warteschlange',
    kpiOrdiniSub: 'gespeicherte Auftragsbestätigungen',
    ordiniOverviewHint: 'PDF-Auftragsbestätigungen je Lieferant. Lieferantenprofil (Register Bestellungen) öffnen, um Dateien hochzuladen oder zu verwalten.',
    ordiniOverviewEmpty: 'Keine Auftragsbestätigungen in diesem Bereich.',
    ordiniOverviewOpenSupplier: 'Lieferant öffnen →',
    ordiniOverviewLimitNote: 'Die letzten {n} Bestätigungen werden angezeigt.',
    ordiniColSupplier: 'Lieferant',
    ordiniColTitle: 'Titel',
    ordiniColOrderDate: 'Auftragsdatum',
    ordiniColRegistered: 'Erfasst',
    ordiniOpenPdf: 'PDF öffnen', ordiniPdfPreview: 'Vorschau', ordiniPdfOpenNewTab: 'In neuem Tab öffnen', ordiniPdfCopyLink: 'Link kopieren', ordiniPdfLinkCopied: 'Link kopiert', operatorNoSede: 'Ihrem Profil ist kein Standort zugeordnet. Bitte einen Administrator, Sie der richtigen Filiale zuzuweisen.', suggestedSupplierBanner: 'Neuer Lieferant erkannt: {name}. Hinzufügen?', suggestedSupplierAdd: 'Neuer Lieferant', suggestedSupplierConfirm: 'Zur Liste hinzufügen', suggestedSupplierOpenForm: 'Formular öffnen', suggestedSupplierSavedToast: 'Lieferant hinzugefügt', suggestedSupplierSkip: 'Weiter', suggestedSupplierBannerTeaser_one: '1 neuer Lieferant erkannt — Klicken zur Bearbeitung', suggestedSupplierBannerTeaser_many: '{n} neue Lieferanten erkannt — Klicken zur Bearbeitung', suggestedSupplierDrawerTitle: 'Neu erkannte Lieferanten', suggestedSupplierSenderLabel: 'Absender', suggestedSupplierFirstContactLabel: 'Erster Kontakt', suggestedSupplierIgnore: 'Verwerfen', suggestedSupplierDrawerCloseScrimAria: 'Panel schließen', enterAsSede: 'Als Standort ansehen', syncHealthAlert: 'Synchronisationsproblem (IMAP oder OCR)', syncHealthOcrCount: 'OCR-Fehler (48h): {n}', viewingAsSedeBanner: 'Sie sehen das Dashboard als:', exitSedeView: 'Zurück zur Admin-Übersicht', emailSyncQueued: 'In Warteschlange — eine andere Synchronisation läuft…', emailSyncPhaseConnect: 'Verbindung…', emailSyncConnectToServer: 'Verbindung zum IMAP-Server (Netzwerk, TLS, Anmeldung)…', emailSyncConnectOpeningMailbox: 'Posteingangsordner wird geöffnet…', emailSyncPhaseSearch: 'Texte einlesen…', emailSyncPhaseProcess: 'Anhang-Analyse mit Vision-KI…', emailSyncPhasePersist: 'Speichern in der Datenbank…', emailSyncPhaseDone: 'Synchronisation abgeschlossen.', emailSyncStalled: 'Keine Updates — bei vielen Anhängen kann die Vision mehrere Minuten brauchen. Bitte warten…', emailSyncStalledHint: 'Hier fehlen nur Stream-Updates (bei langer Texterkennung normal). Echte IMAP-Wiederholungen siehst du oben im roten Banner in der Verbindungsphase.', emailSyncImapRetryLine: 'IMAP-Verbindung: Versuch {current} von {max}', emailSyncCountsHint: 'Gefunden · neu in der App · verarbeitet · PDF/Text-Einheiten', emailSyncMailboxGlobal: 'Globales IMAP-Postfach (Umgebungsvariablen)', emailSyncMailboxSede: 'Postfach: {name}', emailSyncSupplierFilterLine: 'Lieferantenfilter: {name}', emailSyncStatFoundLine: 'Im Postfach gefunden: {found}', emailSyncStatImportedLine: 'Neu in der App (importierte Dokumente): {imported}', emailSyncStatProcessedLine: 'E-Mails vollständig verarbeitet: {processed}', emailSyncStatIgnoredLine: 'Übersprungen / ohne Ergebnis: {ignored}', emailSyncStatDraftsLine: 'Autom. erstellte Lieferschein-Entwürfe: {drafts}', emailSyncStatAlreadyLine: 'Bereits in einer früheren Synchronisation verarbeitet (kein erneuter Import): {n}', emailSyncStatUnitsLine: 'Zu analysierende Einheiten (PDF/Bild-Anhänge oder langer Mailtext): {done} / {total}', emailSyncStripDetailsExpandAria: 'E-Mail-Sync-Details anzeigen', emailSyncStripDetailsCollapseAria: 'E-Mail-Sync-Details ausblenden', emailSyncStop: 'Stoppen', emailSyncStopAria: 'E-Mail-Synchronisation abbrechen', emailSyncDismiss: 'Schließen', emailSyncDismissAria: 'E-Mail-Sync-Zusammenfassung schließen', potentialSupplierFromEmailBodyBanner: 'Möglicher Lieferant (E-Mail-Text): {name}. Zuordnen?', potentialSupplierFromEmailBodyCta: 'Neuen Lieferanten anlegen' },
  fornitori: { title: 'Lieferanten', new: 'Neuer Lieferant', nome: 'Name / Firma', email: 'E-Mail', piva: 'USt-IdNr.', noSuppliers: 'Keine Lieferanten.', addFirst: 'Ersten hinzufügen →', editTitle: 'Lieferant bearbeiten', profileViewOnlyBanner: 'Nur Ansicht auf dem Handy: Daten und Dokumente ansehen. Zum Bearbeiten von Stammdaten, Listino oder Warteschlange Desktop nutzen oder die Sitzleitung fragen.', saveChanges: 'Änderungen speichern', notFound: 'Lieferant nicht gefunden.', deleteConfirm: 'Diesen Lieferanten löschen? Alle verknüpften Lieferscheine und Rechnungen werden ebenfalls gelöscht.', importaDaFattura: 'Aus Rechnung importieren', countLabel: 'Lieferanten registriert', namePlaceholder: 'z.B. Müller GmbH', emailPlaceholder: 'lieferant@beispiel.de', pivaLabel: 'USt-IdNr.', pivaPlaceholder: 'DE123456789', addressLabel: 'Adresse (optional)', addressPlaceholder: 'Straße, PLZ, Ort', rekkiLinkLabel: 'Rekki-Link (optional)', rekkiLinkPlaceholder: 'https://…', rekkiIdLabel: 'Rekki-ID (optional)', rekkiIdPlaceholder: 'z. B. Lieferanten-ID bei Rekki', rekkiIntegrationTitle: 'Rekki-Integration', rekkiOpenInApp: 'Rekki öffnen', rekkiEmbedPanelTitle: 'Rekki', rekkiSheetOpeningLine: 'Du öffnest das Listino von {name}', rekkiSheetGoCta: 'Zum Listino', rekkiSheetEmbedHint: 'Rekki kann hier aus Sicherheitsgründen nicht eingebettet werden. Prüfen Sie Titel und Text oben; öffnen Sie die vollständige Seite über die Schaltfläche unten.', rekkiSheetPopupButton: 'In Fenster öffnen (1000×900)', rekkiSheetPagePreviewCaption: 'Seitenvorschau', rekkiSheetPagePreviewLoading: 'Vorschau wird geladen…', rekkiSheetPagePreviewUnavailable: 'Keine Vorschau; Rekki über die Schaltfläche unten öffnen.', rekkiLookupByVat: 'Bei Rekki suchen (USt-IdNr.)', rekkiLookupApiLink: 'Automatische Rekki-ID-Suche (API)', rekkiSaveRekkiMapping: 'Rekki-Verknüpfung speichern', rekkiSaveMapping: 'Mapping speichern', rekkiStatusNotConnected: 'Nicht verknüpft', rekkiStatusConnected: 'Verknüpft', rekkiStatusPending: 'Ungespeicherte Änderungen', rekkiConnectedBadge: 'Rekki', rekkiCachedListBanner: 'Zwischengespeicherte Daten (offline).', cardFooterUnlockPin: 'Mit PIN entsperren', rekkiLookupNeedVat: 'Tragen Sie die USt-IdNr. des Lieferanten ein, um bei Rekki zu suchen.', rekkiIdExtractedFromLink: 'Lieferanten-ID aus dem Rekki-Link übernommen.', rekkiAutoLinkedSingle: 'Nur ein Rekki-Lieferant passt zu dieser USt-IdNr. — Verknüpfung gespeichert.', rekkiSearchOnRekkiGoogle: 'Auf Rekki suchen', rekkiSearchOnRekkiGoogleByName: 'Google (Firmenname)', rekkiGuidedPasteHint: 'Öffnet Google auf rekki.com. Lieferantenprofil öffnen, URL kopieren, im Feld Link einfügen — die ID wird sofort erkannt; dann Speichern für Preisabgleich.', rekkiIdUrlNotParsed: 'Im ID-Feld steht eine Rekki-URL, die wir nicht erkennen konnten. Profil-URL ins Link-Feld einfügen oder nur die Lieferanten-ID.', saving: 'Speichern...', tabRiepilogo: 'Übersicht', tabListino: 'Preisliste', tabAuditPrezzi: 'Preisaudit', tabConfermeOrdine: 'Auftragsbestätigungen', tabStrategyConto: 'Kontoauszug', kpiBolleTotal: 'Lieferscheine gesamt', kpiFatture: 'Rechnungen eingegangen', kpiOrdini: 'Aufträge', kpiPending: 'Ausstehende Dokumente', kpiReconciliation: 'Abstimmung', subAperte: 'offen', subConfermate: 'bestätigt', subDaAbbinare: 'in Warteschlange', subChiuse: 'Scheine geschlossen', subListinoRows: 'Listeneinträge', kpiFatturatoPeriodo: 'Rechnungsbetrag', subFatturatoPeriodoZero: 'Keine Rechnung mit Datum im Zeitraum', subFatturatoPeriodoCount_one: '1 Rechnung in der Summe enthalten', subFatturatoPeriodoCount_other: '{n} Rechnungen in der Summe enthalten', subFatturatoTotaleLordoMicro: 'Bruttosumme (alle Rechnungen): {amount}', kpiListinoProdottiPeriodo: 'Preislisten-Produkte', subListinoProdottiEAggiornamenti: '{p} verschiedene Produkte · {u} Preisaktualisierungen', subListinoPeriodoVuoto: 'Keine Preislisten-Updates im Zeitraum', subListinoPriceAnomalies: 'Hinweis: {n} Preisabweichungen erkannt', subBolleRekkiSavingsMicro: 'Geschätzte Rekki-Ersparnis: Referenzpreise bei einigen Lieferungen niedriger.', subBollePeriodoVuoto: 'Kein Lieferschein mit Datum im Zeitraum', subBollePeriodoRiepilogo: '{open} von {total} ohne verknüpfte Rechnung', subDocumentiCodaEmailPeriodo: 'E-Mail-Dokumente zur Bearbeitung (gleicher Zeitraum)', subOrdiniPeriodo: 'im Zeitraum', subStatementsNoneInMonth: 'keiner', subStatementsAllVerified: 'alle OK', subStatementsWithIssues: 'Abweichungen', helpText: 'Gehe zum Tab <b>Kontoauszug</b>, um Dokumente und Lieferscheine zuzuordnen, oder zu <b>Lieferscheine</b> und <b>Rechnungen</b> für den vollständigen Verlauf.', listinoSetupTitle: 'Preisliste noch nicht erstellt', listinoSetupSubtitle: 'Produktpreise in 2 Klicks aktivieren:', listinoSetupStep1: 'Klicke auf <strong class="font-bold text-app-fg">"SQL kopieren"</strong> unten', listinoSetupStep2: 'Öffne den <a href="https://supabase.com/dashboard/project/dubocvwsdzrqrrxsedas/sql/new" target="_blank" rel="noopener noreferrer" class="font-semibold text-amber-200 underline decoration-amber-200/50 transition-colors hover:text-app-fg">SQL Editor ↗</a>, füge ein und klicke <strong class="font-bold text-app-fg">"Run"</strong>', listinoSetupShowSQL: 'Vollständiges SQL anzeigen ▸', listinoCopySQL: 'SQL kopieren', listinoCopied: 'Kopiert!', listinoProdotti: 'Produktpreisliste', listinoProdottiTracked: 'Produkte verfolgt', listinoNoData: 'Keine Produktpreise erfasst', listinoNoDataHint: 'Preise direkt in der Tabelle <code class="font-mono text-app-fg-muted">listino_prezzi</code> auf Supabase eingeben.', listinoTotale: 'Gesamtausgaben', listinoDaBolle: 'Aus Lieferscheinen', listinoDaFatture: 'Aus Rechnungen', listinoStorico: 'Dokumentenverlauf', listinoDocs: 'Dokumente', listinoNoDocs: 'Keine Dokumente mit Betrag erfasst', listinoColData: 'Datum', listinoColTipo: 'Typ', listinoColNumero: 'Nummer', listinoColImporto: 'Betrag', listinoColTotale: 'Gesamt', listinoRekkiListBadge: '[Rekki]', listinoVerifyAnomalies: 'Prüfen', listinoVerifyAnomaliesTitle: 'Registerkarte Prüfung mit Rekki-Preisfilter für dieses Produkt öffnen', listinoRowBadgeOk: 'OK', listinoRowBadgeAnomaly: 'Anomalie', listinoRowActionsLabel: 'Aktionen', listinoLastIncrease: 'Letzte Erhöhung: {delta} ({pct})', listinoLastDecrease: 'Letzte Senkung: {delta} ({pct})', listinoLastFlat: 'Preis entspricht Referenz ({pct})', listinoVsReferenceHint: 'im Vergleich zum Vormonat oder zum vorherigen Preis.', listinoOriginInvoice: 'Letzter Preis aus Rechnung {inv} vom {data} · {supplier}', listinoFilterEmptyKpi: 'Kein Produkt entspricht diesem Filter.', listinoClearKpiFilter: 'Alle anzeigen', listinoKpiAriaAll: 'Alle Listino-Produkte anzeigen', listinoKpiAriaFatture: 'Nur Produkte aus den Rechnungen dieser Summe', listinoKpiAriaBolle: 'Nur Produkte, deren Preisdatum zu einem Lieferschein passt', listinoHistoryDepth: '{n} frühere Preisaktualisierungen', listinoPriceStaleBadge: 'Veralteter Preis', listinoPriceStaleHint: 'Letzte Preisliste-Aktualisierung vor über 60 Tagen.', preferredLanguageEmail: 'Bevorzugte Sprache (für E-Mails)', languageInheritSede: '— Vom Standort übernehmen —', recognizedEmailsTitle: 'Erkannte E-Mail-Adressen', recognizedEmailsHint: 'Zusätzliche Adressen, von denen dieser Lieferant Dokumente senden darf. Der E-Mail-Scan ordnet sie automatisch zu.', recognizedEmailPlaceholder: 'z. B. rechnungen@lieferant.de', recognizedEmailLabelOptional: 'Bezeichnung (optional)', displayNameLabel: 'Kurzname (Liste & Leiste)', displayNameHint: 'Optional. Wird in der mobilen unteren Leiste und kompakten Listen statt des vollen Namens angezeigt.', displayNamePlaceholder: 'z. B. Amalfi', loadingProfile: 'Lieferantenprofil, Belege und Übersicht werden geladen…', logoUrlLabel: 'Lieferantenlogo (URL)', logoUrlPlaceholder: 'https://beispiel.de/logo.png', logoUrlHint: 'HTTPS-Bild (PNG, JPG oder SVG). Bei Ladefehler werden Initialen angezeigt.', confermeOrdineIntro: 'Hier können Sie Auftragsbestätigungen und andere nicht-fiskalische PDFs ablegen. Sie gehören nicht zum Lieferschein-/Rechnungsfluss.', confermeOrdineOptionalTitle: 'Titel (optional)', confermeOrdineOptionalTitlePh: 'z. B. Auftrag 4582', confermeOrdineOptionalOrderDate: 'Auftragsdatum', confermeOrdineOptionalNotePh: 'Interne Notizen', confermeOrdineAdd: 'Speichern', confermeOrdineEmpty: 'Keine Auftragsbestätigungen für diesen Lieferanten.', confermeOrdineColFile: 'Dokument', confermeOrdineColRecorded: 'Hochgeladen am', confermeOrdineOpen: 'PDF öffnen', confermeOrdineDeleteConfirm: 'Diese Bestätigung und die Datei löschen?', confermeOrdineDuplicateCopyDeleteConfirm: 'Diese doppelte Kopie der Auftragsbestätigung löschen? Die übrigen Kopien der Gruppe bleiben gespeichert.', confermeOrdineErrPdf: 'Bitte eine PDF-Datei hochladen.', confermeOrdineErrNeedFile: 'Wählen Sie eine PDF-Datei.', confermeOrdineErrUpload: 'Upload-Fehler', confermeOrdineErrSave: 'Speicherfehler', confermeOrdineErrDelete: 'Löschfehler', confermeOrdineMigrationTitle: 'Tabelle für Auftragsbestätigungen fehlt', confermeOrdineMigrationHint: 'Führen Sie die SQL-Migration add-conferme-ordine.sql in Supabase aus, um die Tabelle conferme_ordine und RLS-Richtlinien anzulegen.', syncEmailNeedSede: 'Weisen Sie dem Lieferanten einen Standort zu, um E-Mails zu synchronisieren.', ocrControllaFornitore: 'OCR-Prüfung', ocrControllaFornitoreTitle: 'Liest Lieferscheine und Rechnungen mit verdächtigem Datum erneut per KI (wie in den Einstellungen). Einzeldokument: Aktion im Tab „Bolle“.', ocrControllaFornitoreResult: 'Fertig: {corrected} aktualisiert, {scanned} von {total} verarbeitet.', supplierMonthlyDocTitle: 'Pro Monat', supplierMonthlyDocColMonth: 'Monat', supplierMonthlyDocColBolle: 'Lieferscheine', supplierMonthlyDocColFatture: 'Rechnungen', supplierMonthlyDocColSpesa: 'Rechnungssumme', supplierMonthlyDocColOrdini: 'Bestellungen', supplierMonthlyDocColStatements: 'Kontoauszüge', supplierMonthlyDocColPending: 'In Warteschlange', supplierMonthlyDocColFiscalYear: 'Geschäftsjahr', supplierMonthlyDocFiscalSelected: 'Das Geschäftsjahr der Niederlassung für den ausgewählten Monat ist {year}.', supplierMonthlyDocAriaGoToTabMonth: '{tab} für den Zeitraum {month} öffnen', supplierDesktopRegionAria: 'Lieferantenprofil, Desktop-Ansicht', listinoPeriodLabel: 'Zeitraum', listinoPeriodAll: 'Alle', listinoPeriodCurrentMonth: 'Aktueller Monat', listinoPeriodPreviousMonth: 'Vormonat', listinoPeriodLast3Months: 'Letzte 3 Monate', listinoPeriodFiscalYear: 'Geschäftsjahr', },
  bolle: { title: 'Lieferscheine', new: 'Neuer Lieferschein', uploadInvoice: 'Rechnung hochladen', viewDocument: 'Dokument anzeigen', noBills: 'Keine Lieferscheine.', addFirst: 'Ersten erstellen →', deleteConfirm: 'Diesen Lieferschein löschen? Verknüpfte Rechnungen werden ebenfalls gelöscht.', duplicateCopyDeleteConfirm: 'Diese doppelte Lieferschein-Kopie löschen? Die übrigen Zeilen der Gruppe bleiben gespeichert.', pendingInvoiceOverdueHint: 'Seit über 7 Tagen ohne Rechnung ausstehend — Buchungsbeleg nachverfolgen.', ocrScanning: 'Lieferant wird erkannt…', ocrMatched: 'Lieferant erkannt', ocrNotFound: 'Lieferant manuell auswählen', ocrAnalyzing: 'Analyse läuft…', ocrAutoRecognized: 'Automatisch erkannt', ocrRead: 'Gelesen:', selectManually: 'Lieferant auswählen', saveNote: 'Lieferschein speichern', savingNote: 'Wird gespeichert…', analyzingNote: 'Dokument wird analysiert…', takePhotoOrFile: 'Foto aufnehmen oder Datei wählen', ocrHint: 'Lieferant wird automatisch erkannt', cameraBtn: 'Kamera', fileBtn: 'Datei wählen', countSingolo: 'Lieferschein registriert', countPlural: 'Lieferscheine registriert', countTodaySingolo: 'Lieferschein heute', countTodayPlural: 'Lieferscheine heute', noBillsToday: 'Keine Lieferscheine für heute.', listShowAll: 'Alle Lieferscheine', listShowToday: 'Nur heute', listAllPending: 'Nur ausstehend', fotoLabel: 'Foto / Lieferschein-Datei', fornitoreLabel: 'Lieferant', dataLabel: 'Lieferscheindatum', dettaglio: 'Lieferschein-Details', fattureCollegate: 'Zugeordnete Rechnungen', aggiungi: '+ Hinzufügen', nessunaFatturaCollegata: 'Keine zugeordneten Rechnungen.', allegatoLink: 'Anhang →', statoCompletato: 'Abgeschlossen', statoInAttesa: 'Ausstehend', apri: 'Öffnen', colNumero: 'Nummer', colAttachmentKind: 'Anhang', riannalizzaOcr: 'Neu mit OCR', ocrRerunMovedToInvoices: 'Als Rechnung erkannt: der Datensatz wurde in den Reiter Rechnungen verschoben.', ocrRerunUpdatedStaysBolla: 'Lieferschein-Felder aktualisiert. Klassifizierung: weiterhin Lieferschein / DDT.', ocrRerunUnchangedStaysBolla: 'Keine Felder geändert. Klassifizierung: weiterhin Lieferschein (Datei prüfen oder erneut versuchen).', ocrRerunFailed: 'OCR fehlgeschlagen: Anhang prüfen oder erneut versuchen.', ocrRerunProgressTitle: 'Dokument wird erneut ausgewertet', ocrRerunStep1: '1. Anhang aus dem Speicher laden', ocrRerunStep2: '2. KI (Gemini): Rechnung vs. Lieferschein, Nummer, Betrag, Datum', ocrRerunStep3: '3. Zeile speichern oder ggf. nach Rechnungen verschieben', convertiInFattura: 'Zu Rechnungen', convertiInFatturaTitle: 'Als Rechnung buchen (ohne OCR)', convertiInFatturaConfirm: 'Dieses Dokument von Lieferscheinen zu Rechnungen verschieben? Aktuelle Nummer und Betrag werden als Rechnungsnummer und -betrag übernommen.', convertiInFatturaOk: 'Dokument zu Rechnungen verschoben.', convertiInFatturaErrLinked: 'Nicht möglich: Es ist bereits eine Rechnung mit diesem Lieferschein verknüpft oder ein Eintrag in fattura_bolle.', convertiInFatturaErrGeneric: 'Vorgang konnte nicht abgeschlossen werden.', attachmentKindPdf: 'PDF', attachmentKindImage: 'Bild', attachmentKindOther: 'Datei', nessunaBollaRegistrata: 'Keine Lieferscheine registriert', creaLaPrimaBolla: 'Ersten Lieferschein erstellen →', vediDocumento: 'Dokument anzeigen', dateFromDocumentHint: 'Aus Dokument', prezzoDaApp: 'Preis aus der App', verificaPrezzoFornitore: 'Lieferantenpreis prüfen', rekkiPrezzoIndicativoBadge: '⚠️ Richtpreis aus der Rekki-App', listinoRekkiRefTitle: 'Referenz-Preisliste (Rekki)', listinoRekkiRefHint: 'Mit Rekki-ID beim Lieferanten vergleichen Sie den Lieferschein-Gesamtbetrag mit den zuletzt importierten Preisen.', listinoRekkiRefEmpty: 'Keine Preislistenzeilen für diesen Lieferanten.', scannerTitle: 'KI-Scanner', scannerWhatLabel: 'Was laden Sie hoch?', scannerModeAuto: 'Automatisch', scannerModeBolla: 'Lieferschein / DDT', scannerModeFattura: 'Rechnung', scannerModeSupplier: 'Neuer Lieferant', scannerFlowBolla: 'Lieferschein erfassen', scannerFlowFattura: 'Rechnung erfassen', scannerSaveFattura: 'Rechnung speichern', scannerSavingFattura: 'Rechnung wird gespeichert…', scannerCreateSupplierCta: 'Lieferant aus gelesenen Daten anlegen', scannerCreateSupplierFromUnrecognized: 'Lieferant aus diesem Dokument anlegen', scannerPdfPreview: 'PDF angehängt — keine Vorschau', scannerCameraCapture: 'Aufnehmen', scannerCameraPermissionDenied: 'Kamera nicht verfügbar. Prüfen Sie die Berechtigungen im Browser oder auf dem Gerät.', scannerFileScanTypeError: 'PDF oder Foto (JPEG, PNG oder WebP) hochladen.', scannerImageAttached: 'Foto angehängt' },
  fatture: { title: 'Rechnungen', new: 'Neue Rechnung', noInvoices: 'Keine Rechnungen.', addFirst: 'Erste hinzufügen →', invoice: 'Rechnung', openBill: 'Lieferschein öffnen →', deleteConfirm: 'Diese Rechnung löschen? Aktion kann nicht rückgängig gemacht werden.', countLabel: 'eingegangene Rechnungen', headerBolla: 'Lieferschein', headerAllegato: 'Anhang', apri: 'Öffnen →', caricaFatturaTitle: 'Rechnung hochladen', bollaMarkata: 'Der Lieferschein wird als abgeschlossen markiert', collegataABolla: 'Mit Lieferschein verknüpft', bollaPasseraCompletato: 'Beim Speichern wird der Lieferschein auf "abgeschlossen" gesetzt', dataFattura: 'Rechnungsdatum', fileFattura: 'Rechnungsdatei', caricaPdfFoto: 'PDF hochladen oder Foto aufnehmen', maxSize: 'PDF, JPG, PNG, WebP — max 10 MB', savingInProgress: 'Wird gespeichert...', salvaChiudiBolla: 'Speichern und Lieferschein schließen', dettaglio: 'Details', bollaCollegata: 'Verknüpfter Lieferschein', statusAssociata: 'Zugeordnet', statusSenzaBolla: 'Kein Lieferschein', colNumFattura: 'Rechnungs-Nr.', nessunaFatturaRegistrata: 'Keine Rechnungen registriert', nessunaFatturaNelPeriodo: 'Keine Rechnung mit Datum in diesem Zeitraum', fattureInArchivioAllargaFiltroData: 'Es sind {n} Rechnung(en) gespeichert, aber keine hat ein Rechnungsdatum im gewählten Bereich (oben rechts). Zeitraum vergrößern: Die Liste filtert nach Belegdatum, nicht nach Scan-Tag.', fattureExpandDateRangeCta: 'Alle Rechnungen anzeigen (2000 – heute)', duplicateInvoiceSameSupplierDateNumber: 'Diese Rechnung ist bereits erfasst: gleicher Lieferant, gleiches Datum und gleiche Dokumentennummer. Zum Ersetzen der PDF-Datei die bestehende Rechnung öffnen und „Anhang ersetzen“ verwenden.', duplicateInvoiceSameSupplierDateAmountNoNumber: 'Diese Rechnung ist bereits erfasst: gleicher Lieferant und Tag, gleicher Betrag, ohne Rechnungsnummer in der Datenbank. Zum Ersetzen der PDF-Datei die bestehende Rechnung öffnen und „Anhang ersetzen“ verwenden.', duplicateDeleteConfirm: 'Diese Kopie der Rechnung {numero} löschen? Das Original bleibt erhalten.', duplicateRemoveCopy: 'Duplikat löschen', duplicateRemoveThisCopy: 'Diese Kopie entfernen', duplicatePairBadgeAria: 'Das doppelte Rechnungspaar hervorheben', refreshDateFromDoc: 'Datum neu lesen', refreshDateFromDocTitle: 'Datum aus dem Dokument (OCR) erneut lesen und Rechnung aktualisieren', refreshDateFromDocSuccess: 'Datum auf {data} aktualisiert.', refreshDateFromDocUnchanged: 'Das Datum entspricht bereits dem Dokument.' },
  archivio: { title: 'Archiv', subtitle: 'Lieferanten', noBills: 'Keine Lieferscheine', noInvoices: 'Keine Rechnungen', withBill: 'Mit Schein', noEmail: 'Keine E-Mail', bollaS: 'Schein', bollaP: 'Scheine', fatturaS: 'Rechnung', fatturaP: 'Rechnungen', editLink: 'Bearbeiten →', nuova: '+ Neu', nuovaFattura: '+ Rechnung', documento: 'Dokument', pendingDocCount: '({n} ausstehend)', linkAssociateStatements: 'Zuordnen →', queueTitle: 'Dokumente in der Warteschlange', queueSubtitle: 'ausstehend oder einem Lieferschein zuzuordnen', unknownSender: 'Unbekannter Absender', statusDaAssociare: 'Zuzuordnen', noQueue: 'Keine Dokumente in der Warteschlange', noQueueHint: 'Per E-Mail empfangene Dokumente erscheinen hier.', receivedOn: 'Eingegangen:', docDate: 'Dok.-Datum:' },
  impostazioni: { title: 'Einstellungen', subtitle: 'Währung und Zeitzone', lingua: 'Sprache', valuta: 'Währung', fuso: 'Zeitzone', preview: 'Vorschau', saved: 'Einstellungen gespeichert — wird neu geladen…', sectionLocalisation: 'Lokalisierung', accountSection: 'Konto', changeSede: 'Standort wechseln', addOperatorsPickSede: 'Wählen Sie zuerst den aktiven Standort unter Standorte — dann können Sie hier Operatoren anlegen (Name + PIN).', imapSection: 'E-Mail IMAP' },
  log: { title: 'E-Mail-Aktivität', subtitle: 'Automatisch verarbeitete Dokumente aus dem Posteingang.', sender: 'Absender', subject: 'Betreff', stato: 'Status', detail: 'Detail', retry: 'Erneut versuchen', retrying: 'Versuche erneut…', success: 'Erfolg', bollaNotFound: 'Dokument Empfangen', supplierNotFound: 'Unbekannter Absender', noLogs: 'Keine Logs.', emptyHint: 'Führen Sie eine E-Mail-Synchronisierung vom Dashboard aus durch.', totalLogs: 'Logs gesamt', linkedInvoices: 'Empfangene Dokumente', withErrors: 'Mit Fehlern', vediFile: 'Datei anzeigen', supplierSuggested: 'Vorgeschlagener Lieferant', aiSuggest: 'KI-Vorschlag', aiSuggestTitle: 'Vorgeschlagene Stammdaten (OCR)', aiSuggestLoading: 'Analyse…', aiSuggestError: 'Dokument konnte nicht analysiert werden.', openCreateSupplier: 'Lieferant anlegen öffnen', associateRememberHint: 'Nach dem Speichern wird die Absender-E-Mail für künftige Synchronisierungen verknüpft.', colAttachment: 'Anhang', colSede: 'Standort', colLogId: 'Log-ID', colRegistered: 'Erfasst', tabEmailLog: 'E-Mail-Aktivität', tabBlacklist: 'Sperrliste', blacklistSubtitle: 'Absender ohne OCR-Scan (Newsletter, Nicht-Lieferanten-Konten usw.).', blacklistColMittente: 'Absender', blacklistColMotivo: 'Grund', blacklistColDate: 'Hinzugefügt', blacklistPlaceholder: 'z. B. newsletter@firma.de', blacklistAdd: 'Hinzufügen', blacklistRemove: 'Entfernen', blacklistFilterAll: 'Alle Gründe', blacklistEmpty: 'Keine gesperrten Absender.', blacklistError: 'Sperrliste konnte nicht geladen werden.', logIgnoreAlways: 'Absender immer ignorieren', logBlacklistAdded: 'Absender zur Sperrliste hinzugefügt.', blacklistMotivoNewsletter: 'Newsletter', blacklistMotivoSpam: 'Spam', blacklistMotivoNonFornitore: 'Kein Lieferant', blacklistMotivoSistema: 'System', blacklistMotivoSocial: 'Social', activitySummaryToday: 'Heute {n} Dokumente automatisch verarbeitet', activityEmpty: 'Heute noch keine Aktivität.', activityColTipo: 'Typ', activityColSupplier: 'Lieferant', activityColAmount: 'Betrag', activityColStatus: 'Status', activityOpenDocument: 'Dokument öffnen', activityTipoInvoice: 'Rechnung', activityTipoDdt: 'Lieferschein', activityTipoStatement: 'Auszug', activityTipoQueue: 'In Warteschlange', activityTipoOrdine: 'Bestellung', activityTipoResume: 'CV / Lebenslauf', activityStatusSaved: '✅ Gespeichert', activityStatusNeedsSupplier: '⚠️ Lieferant ergänzen', activityStatusIgnored: '⏭️ Ignoriert', activityProcessDocumentsCta: 'Warteschlange verarbeiten', activityProcessDocumentsBusy: 'Wird verarbeitet…', activityProcessDocumentsNoEligibleInLog: 'Automatisch nicht möglich (Lieferant/OCR). Nutzen Sie die KI-Inbox.', activityProcessDocumentsSummary: '{runs} verarbeitet: {processed} aktualisiert, {skipped} übersprungen.', activityProcessDocumentsApiError: 'Verarbeitung fehlgeschlagen', activityProcColumn: 'Bearbeitung', activityProcSpinAria: 'OCR…', activityProcProcessedAuto: '✓ Gespeichert', activityProcProcessedRevision: 'In Prüfung', activityProcProcessedOther: 'Aktualisiert', activityProcOutcomeError: 'Fehler', activityProcSkippedScartato: 'Ausgeschlossen', activityProcSkippedNoRowOrSede: 'Kein Zugriff', activityProcSkippedNoMittente: 'Absender ungültig', activityProcSkippedNoSupplier: 'Lieferant verknüpfen', activityProcSkippedHasOcr: 'OCR schon — Inbox', activityProcPendingBatch: 'Weitere (max. 5)', activityProcRejectedCv: 'Verworfen (Lebenslauf/CV)', activityProcDash: '—', },
  sedi: { title: 'Standort & Nutzer', titleGlobalAdmin: 'Standorte', subtitle: 'Standort, E-Mail-Sync und Operatoren verwalten', subtitleGlobalAdmin: 'Standorte, E-Mail-Synchronisation und Operatoren verwalten', newSede: 'Neuer Standort', noSedi: 'Keine Standorte. Fügen Sie den ersten hinzu.', users: 'Nutzer', imap: 'E-Mail-Konfiguration (IMAP)', imapSubtitle: 'Konfigurieren Sie das E-Mail-Postfach dieses Standorts. Eingehende Rechnungen werden automatisch den Lieferanten des Standorts zugeordnet.', imapHost: 'IMAP-Host', imapHostPlaceholder: 'imap.gmail.com', imapPort: 'Port', imapUser: 'E-Mail / Nutzer', imapPassword: 'Passwort', imapPasswordPlaceholder: 'Passwort oder App-Passwort', testConnection: 'Verbindung testen', saveConfig: 'Konfiguration speichern', notConfigured: 'E-Mail nicht konfiguriert', accessDenied: 'Zugang nur für Administratoren', accessDeniedHint: 'Wenden Sie sich an Ihren Administrator, um Zugang zu erhalten.', creatingBtn: 'Erstellen...', createBtn: 'Erstellen', nomePlaceholder: 'z.B. Büro Berlin', nessunUtente: 'Keine Nutzer gefunden.', emailHeader: 'E-Mail', sedeHeader: 'Standort', ruoloHeader: 'Rolle', nessunaSedeOption: '— Kein Standort —', operatoreRole: 'Operator', adminRole: 'Verwaltungsportal', adminSedeRole: 'Standort-Administrator', profileRoleAdmin: 'Verwaltungsportal', adminScopedSediHint: 'Sie sehen nur den Standort, der mit Ihrem Profil verknüpft ist. Neue Standorte und «Benutzer ohne Standort» verwaltet der Hauptadministrator (Admin ohne Standort im Profil).', renameTitle: 'Umbenennen', deleteTitle: 'Löschen', addOperatorSedeTitle: 'Neuer Operator', addOperatorSedeDesc: 'Anmeldung mit Name und PIN (mind. 4 Zeichen). E-Mail wird automatisch erzeugt.', operatorDisplayNameLabel: 'Anzeigename', operatorPinMinLabel: 'PIN (mind. 4 Zeichen)', operatorNameRequired: 'Geben Sie den Namen des Operators ein.', operatorPinTooShort: 'Der PIN muss mindestens 4 Zeichen haben.', wizardOperatorHint: 'Mitarbeiter melden sich mit Name + PIN an. Sie können später weitere hinzufügen.', sedeStats: '{operatori} Mitarbeiter · {fornitori} Lieferanten', operatoriHeader: 'Mitarbeiter ({n})', sedeAccessCodeLabel: 'Standort-Zugangscode', sedePinHint: '4-stellige numerische PIN. Leer lassen zum Deaktivieren.', sedePinError4Digits: 'Der Zugangs-PIN muss 4 Ziffern lang sein oder leer bleiben.', changePinTitle: 'PIN ändern', newPinFor: 'Neuer PIN für {name}', operatoreRoleShort: 'Op.', adminSedeRoleShort: 'Filial-Adm.', valutaFuso: 'Währung & Zeitzone', },
  approvalSettings: {
    autoRegisterTitle: 'Automatische KI-Rechnungsregistrierung',
    autoRegisterDescription:
      'Rechnungen, die die KI zuverlässig erkennt, werden ohne manuelle Bestätigung gespeichert.',
  },
  statements: {
    heading: 'Monatliche Kontoauszugs-Prüfung',
    tabVerifica: 'Kontoauszug',
    tabDocumenti: 'Ausstehende Dokumente',
    schedaNavDaProcessareDesc: 'Eingehende Anhänge: Lieferanten, Lieferscheine und Rechnungen zuordnen.',
    schedaNavVerificaDesc: 'Monatliche Kontoauszugsprüfung gegen Lieferscheine und Rechnungen.',
    statusOk: 'OK',
    statusFatturaMancante: 'Rechnung fehlt',
    statusBolleManc: 'Lieferscheine fehlen',
    statusErrImporto: 'Betragsfehler',
    statusRekkiPrezzo: 'Rekki-Preis vs Rechnung',
    stmtReceived: 'Empfangene Kontoauszüge',
    stmtProcessing: 'Kontoauszug wird noch verarbeitet — bitte in wenigen Sekunden erneut versuchen.',
    stmtEmpty: 'Noch keine Kontoauszüge empfangen',
    stmtEmptyHint: 'Kontoauszüge kommen automatisch per E-Mail.',
    btnSendReminder: 'Zahlungserinnerung senden',
    btnSending: 'Senden…',
    btnSent: 'Gesendet ✓',
    btnClose: 'Schließen',
    btnRefresh: 'Aktualisieren',
    btnAssign: 'Zuordnen',
    btnDiscard: 'Verwerfen',
    btnAssigning: 'Zuordnen…',
    colDate: 'Datum',
    colRef: 'Dok.-Referenz',
    colAmount: 'Betrag',
    colStatus: 'Status',
    colAction: 'Aktion',
    colInvoice: 'Rechnung',
    colNotes: 'Lieferscheine',
    classicHeading: 'Lieferschein / Rechnungsprüfung',
    classicComplete: 'Mit Rechnung',
    classicMissing: 'Ohne Rechnung',
    classicRequestAll: 'Alle fehlenden Rechnungen anfordern',
    classicRequesting: 'Senden…',
    classicSent: 'Gesendet ✓',
    classicRequestSingle: 'Rechnung anfordern',
    migrationTitle: 'Automatischen Kontoauszugsempfang aktivieren',
    migrationSubtitle: 'Tabellen statements und statement_rows in 2 Klicks erstellen:',
    migrationStep1: 'Klicken Sie auf "SQL kopieren" rechts',
    migrationStep2: 'Öffnen Sie den SQL Editor, fügen Sie ein und klicken Sie "Run"',
    migrationShowSQL: 'Vollständiges SQL anzeigen ▸',
    migrationCopySQL: 'SQL kopieren',
    migrationCopied: 'Kopiert!',
    kpiOk: 'Geprüft OK',
    kpiMissing: 'Mit Abweichungen',
    kpiAmount: 'Gesamtbetrag',
    kpiTotal: 'Zeilen gesamt',
    months: ['Januar','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember'],
    unknownSupplier: 'Unbekannter Lieferant',
    loadError: 'Kontoauszugsergebnisse konnten nicht geladen werden.',
    sendError: 'Fehler beim Senden der Erinnerung.',
    tabPending: 'Zu bestätigen',
    tabAll: 'Alle',
    unknownSenderQuickStripTitle: 'Priorität: Lieferant verknüpfen ({n})',
    unknownSenderQuickStripAria: 'Schnellzugriff auf Dokumente ohne verknüpften Lieferanten',
    unknownSenderQuickStripChipTitle: 'Zu diesem Dokument in der Liste springen',
    emailSyncAutoSavedToday: '{n} heute automatisch gespeichert',
    bolleAperteOne: 'offener Lieferschein verfügbar',
    bolleApertePlural: 'offene Lieferscheine verfügbar',
    tagStatement: 'Monatsauszug',
    tagStatementOk: 'Auszug ✓',
    tagPending: 'In Bearbeitung',
    tagBozzaCreata: '✦ Entwurf erstellt',
    tagAssociated: 'Geprüft',
    tagDiscarded: 'Verworfen',
    labelReceived: 'Erhalten:',
    labelDocDate: 'Dok.-Datum:',
    openFile: 'Datei öffnen →',
    reanalyzeDocButton: 'Erneut analysieren',
    reanalyzeDocTitle: 'Erneut auslesen und Lieferanten zuordnen (E-Mail, USt-IdNr., Firma).',
    reanalyzeDocSuccess: 'Analyse aktualisiert.',
    gotoFatturaDraft: 'Zum Rechnungsentwurf →',
    gotoBollaDraft: 'Zum Lieferschein-Entwurf →',
    toggleAddStatement: 'Zum Auszug hinzufügen',
    toggleRemoveStatement: 'Aus Auszug entfernen',
    docKindEstratto: 'Auszug',
    docKindBolla: 'Lieferschein',
    docKindFattura: 'Rechnung',
    docKindOrdine: 'Auftrag',
    docKindHintBolla: 'Als Lieferschein markieren, kein Monatsauszug und keine zu zuordnende Rechnung',
    docKindHintFattura: 'Als Rechnung markieren, mit offenen Lieferscheinen abgleichen',
    docKindHintOrdine: 'Auftragsbestätigung oder kommerzielles PDF: wird bei den Auftragsbestätigungen des Lieferanten gespeichert (kein Lieferschein/Rechnung)',
    docKindGroupAria: 'Dokumenttyp',
    finalizeNeedsSupplier: 'Lieferanten zuordnen, um abzuschließen.',
    btnFinalizeFattura: 'Rechnung speichern (ohne Lieferschein)',
    btnFinalizeBolla: 'Lieferschein aus Datei anlegen',
    btnFinalizeOrdine: 'Beim Lieferanten speichern (Auftrag)',
    btnFinalizeStatement: 'Auszug archivieren',
    btnFinalizing: 'Wird gespeichert…',
    finalizeSuccess: 'Dokument gespeichert.',
    autoRegisterFatturaToast: 'Rechnung #{numero} von {fornitore} automatisch registriert',
    noPendingDocs: 'Keine Dokumente zu prüfen',
    noDocsFound: 'Keine Dokumente gefunden',
    noBolleAttesa: 'Keine ausstehenden Lieferscheine verfügbar',
    bolleDaCollegamentiSectionTitle: 'Zu verknüpfende Lieferscheine',
    bollePendingNoneForThisSupplier: 'Keine offenen Lieferscheine für diesen Lieferanten.',
    bollesSearchAcrossAllSuppliers: 'Alle Lieferanten durchsuchen',
    bollesShowOnlyThisSupplier: 'Nur diesen Lieferanten',
    bollesExtendedOtherSuppliersSubtitle: 'Weitere offene Lieferscheine (andere Lieferanten)',
    bollesMatchAssociateSupplierHint:
      'Verknüpfen Sie einen Lieferanten, um hier seine offenen Lieferscheine zu sehen, oder suchen Sie standortweit.',
    bollesFullSiteListSubtitle: 'Gesamter Standort',
    unknownSender: 'Unbekannter Absender',
    sameAddressClusterHint:
      'Gleiche Adresse wie bei anderen Dokumenten in der Warteschlange. Von der KI erkannte Firmennamen in den anderen Zeilen: {names}. Vermutlich derselbe Lieferant — verknüpfen Sie denselben Kontakt.',
    btnCreateSupplierFromAi: 'Lieferant anlegen →',
    docTotalLabel: 'Dokumentgesamtbetrag:',
    exactAmount: 'Genauer Betrag',
    exceeds: 'Überschuss',
    missingAmt: 'Fehlend',
    doneStatus: 'Abgeschlossen ✓',
    errorStatus: 'Fehler ✗',
    noBolleDelivery: 'Keine Lieferscheine für diese Rechnung gefunden',
    bozzaCreataOne: 'Entwurf erstellt',
    bozzeCreatePlural: 'Entwürfe erstellt',
    bozzaBannerSuffix: 'automatisch von KI aus E-Mail-Anhängen. Bitte überprüfen Sie die Daten und bestätigen Sie jedes Dokument.',
    kpiVerifiedOk: 'Geprüft ✓',
    noEmailForSupplier: 'Keine E-Mail für diesen Lieferanten konfiguriert',
    reconcileCorrette: 'Korrekt',
    reconcileDiscrepanza: 'Abweichung',
    reconcileMancanti: 'Fehlend',
    reconcileHeading: 'Kontoauszug vs. Datenbankvergleich',
    statusMatch: 'Übereinstimmend',
    statusMismatch: 'Betrag abweichend',
    statusMissingDB: 'Nicht in der DB',
    reconcileStatement: 'Auszug:',
    reconcileDB: 'DB:',
    loadingResults: 'Ergebnisse werden geladen…',
    editSupplierTitle: 'Lieferant bearbeiten',
    supplierLinkFailed: 'Lieferant konnte nicht mit dem Dokument verknüpft werden.',
    assignFailed: 'Zuordnung zu Lieferscheinen fehlgeschlagen.',
    autoLinkedSupplierOne: 'Lieferant automatisch verknüpft: {name}.',
    autoLinkedSupplierMany: '{count} Dokumente automatisch mit Lieferanten verknüpft.',
    bulkAutoMatchSummary:
      'Analyse abgeschlossen: {linked} Lieferant(en) verknüpft, {associated} Dokument(e) mit Lieferscheinen abgeglichen.',
    bulkAutoMatchNone: 'Für die Dokumente in der Liste war kein automatischer Abgleich möglich.',
    bulkAutoMatchButtonLabel: 'Alles abgleichen',
    bulkAutoMatchButtonTitle:
      'Liste neu laden, eindeutige Lieferanten verknüpfen und Lieferscheine zuordnen, wenn der Dokumentenbetrag einem oder mehreren offenen Lieferscheinen entspricht.',
    bulkFinalizeToolbarGroupAria: 'Alle Dokumente nach gewähltem Typ bestätigen',
    bulkFinalizeKindTooltip:
      'Wie „Bestätigen“ in der Zeile: schließt alle sichtbaren Dokumente mit Typ „{kind}“ und verknüpftem Lieferanten ab ({n}).',
    bulkFinalizeBulkOk: '{n} Dokumente bestätigt ({kind}).',
    bulkFinalizeBulkPartial: '{ok} bestätigt, {fail} fehlgeschlagen ({kind}).',
    ocrFormatToggleTitle: 'Alternative Zahleninterpretation erzwingen',
    allBolleInvoicedOk: 'Alle Lieferscheine haben eine passende Rechnung — Auszug geprüft ✓',
    aiStatementTotalLabel: 'Auszugssumme (KI):',
    statementLinkedBolleLine: '{matched}/{total} Lieferscheine zugeordnet',
    selectedSumLabel: 'Ausgewählt:',
    selectedBolle_one: '({n} Lieferschein)',
    selectedBolle_other: '({n} Lieferscheine)',
    receivedOn: 'Empfangen am',
    stmtPdfDatesPrefix: 'Im PDF',
    stmtPdfIssuedLabel: 'Ausgestellt',
    stmtPdfLastPaymentLabel: 'Letzte Zahlung',
    stmtPdfSummaryTitle: 'Angaben aus dem PDF',
    stmtPdfMetaAccountNo: 'Kontonummer',
    stmtPdfMetaIssuedDate: 'Ausstellungsdatum',
    stmtPdfMetaCreditLimit: 'Kreditlimit',
    stmtPdfMetaAvailableCredit: 'Verfügbares Kreditvolumen',
    stmtPdfMetaPaymentTerms: 'Zahlungsbedingungen',
    stmtPdfMetaLastPaymentAmt: 'Letzte Zahlung',
    stmtPdfMetaLastPaymentDate: 'Datum letzte Zahlung',
    openPdf: 'PDF öffnen ↗',
    reanalyze: 'Erneut analysieren',
    stmtListProcessing: 'Wird verarbeitet…',
    stmtListParseError: 'Analysefehler',
    stmtRowsCount: '{n} Zeilen',
    stmtAnomalies_one: '{n} Auffälligkeit',
    stmtAnomalies_other: '{n} Auffälligkeiten',
    stmtBackToList: 'Zurück zur Liste',
    needsMigrationTitle: 'Tabellen noch nicht angelegt',
    needsMigrationBody:
      'Führen Sie die SQL-Migration aus, um den automatischen Empfang von Kontoauszügen zu aktivieren. Anweisungen finden Sie unten im Abschnitt zur Aktivierung.',
    stmtInboxEmailScanning: 'E-Mails werden ausgewertet…',
    stmtInboxEmptyDetail:
      'Kontoauszüge werden erkannt, wenn eine E-Mail mit Betreff „Statement“ oder „Kontoauszug“ und einem PDF-Anhang eintrifft.',
    bolleSummaryByPeriod: 'Lieferscheinübersicht nach Zeitraum',
    bollePeriodEmpty: 'Keine Lieferscheine in diesem Zeitraum',
    clearFilter: 'Filter zurücksetzen',
    rekkiCheckSegmentTooltip: 'Der Rechnungsbetrag stimmt nicht mit der Rekki-Bestellung überein',
    tripleColStmtDate: 'Auszugsdatum',
    tripleColSysDate: 'Systemdatum',
    tripleColStmtAmount: 'Auszugsbetrag',
    tripleColSysAmount: 'Systembetrag',
    tripleColChecks: 'Prüfungen',
    statusCheckPending: 'Ausstehend',
    statementVerifyBanner: 'Kontoauszugsprüfung',
    badgeAiRecognized: 'KI OK',
    badgeAiRecognizedTitle:
      'Lieferant verknüpft. Automatischer Abgleich mit Lieferscheinen erfordert passende Beträge und Daten innerhalb von ±30 Tagen zum Belegdatum oder zum Eingang in der Liste.',
    badgeNeedsHuman: 'Zuordnung nötig',
    rememberAssociationTitle: 'Diese Absender–Lieferant-Zuordnung merken?',
    rememberAssociationSave: 'Absender-E-Mail speichern',
    rekkiDocumentLink: 'Rekki',
  },
  appStrings: {
    brandFooter: 'Smart Pair · Einkaufsverwaltung',
    pageNotFoundTitle: 'Seite nicht gefunden',
    pageNotFoundDesc: 'Der Link ist ungültig oder die Seite wurde entfernt.',
    notFoundInAppTitle: 'Inhalt nicht verfügbar',
    notFoundInAppDesc:
      'Der Link ist ungültig, oder der Lieferschein bzw. die Rechnung existiert nicht mehr oder ist für Ihr Konto nicht sichtbar (Berechtigungen oder Standort).',
    docUnavailableBollaTitle: 'Lieferschein nicht gefunden',
    docUnavailableBollaDesc:
      'Zu diesem Link gibt es keinen Lieferschein. Er wurde evtl. gelöscht, der Link ist falsch, oder Ihr Konto/Standort hat keinen Zugriff.',
    docUnavailableFatturaTitle: 'Rechnung nicht gefunden',
    docUnavailableFatturaDesc:
      'Zu diesem Link gibt es keine Rechnung. Sie wurde evtl. gelöscht, der Link ist falsch, oder Ihr Konto/Standort hat keinen Zugriff.',
    backToHome: 'Zurück zum Dashboard',
    sedeLockTitle: 'Geschützter Zugang',
    sedeLockDescription: 'Der Standort {name} erfordert eine 4-stellige numerische PIN.',
    sedeLockCodeLabel: 'PIN (4 Ziffern)',
    sedeLockPlaceholder: '••••',
    sedeLockPinLengthError: 'Bitte eine 4-stellige PIN eingeben.',
    sectionDates: 'Daten',
    sectionCurrencyLabel: 'Währung',
    loadingBolle: 'Lieferscheine werden geladen…',
    noOpenBolle: 'Kein offener Lieferschein für diesen Lieferanten.',
    invoiceNumOptional: 'Rechnungsnr. (optional)',
    uploadDateLabel: 'Upload-Datum',
    uploadDateAutomatic: 'automatisch',
    registeredByFattura: 'Name der Person, die die Rechnung erfasst hat…',
    registeredByBolla: 'Name der Person, die den Lieferschein erfasst hat…',
    saveCloseNBolle: '{n} Lieferscheine speichern und schließen',
    colDeliveryNoteNum: 'Lieferschein-Nr.',
    colAmountShort: 'Betrag',
    labelImportoTotale: 'Gesamtbetrag',
    labelPrezzoUnitario: 'Stückpreis',
    loadingPage: 'Laden…',
    noAttachment: 'Kein Anhang',
    camera: 'Kamera',
    chooseFile: 'Datei wählen',
    uploading: 'Hochladen…',
    deleteLogConfirm: 'Diesen Log-Eintrag löschen? Nicht rückgängig zu machen.',
    imapConfigTitle: 'E-Mail-Konfiguration',
    imapLookbackLabel: 'E-Mail-Rückblick (Tage)',
    imapLookbackLastDays: 'Liest Mails (gelesen und ungelesen) der letzten {n} Tage',
    imapLookbackUnlimited: 'Liest alle Mails im Posteingang (gelesen und ungelesen, ohne Tageslimit)',
    imapLookbackFootnote: 'Leer = kein Limit. Empfohlen: 30–90 Tage.',
    emailSaved: 'E-Mail-Einstellungen gespeichert.',
    addOperatorsTitle: 'Operatoren hinzufügen',
    addOperatorBtn: 'Operator hinzufügen',
    savingShort: 'Speichern…',
    newSedeShort: 'Neu',
    deleteUserConfirm: 'Benutzer {email} löschen? Nicht rückgängig zu machen.',
    deleteSedeConfirm: 'Standort „{nome}“ löschen? Verknüpfte Daten verlieren den Standortbezug.',
    deleteFornitoreConfirm: 'Lieferant „{nome}“ löschen? Nicht rückgängig zu machen.',
    contactsHeading: 'Kontakte',
    contactNew: 'Neuer Kontakt',
    contactEdit: 'Kontakt bearbeiten',
    contactRemove: 'Entfernen',
    contactRemovePrice: 'Letzten Preis entfernen',
    noContacts: 'Keine Kontakte',
    infoSupplierCard: 'Lieferantenprofil',
    contactsLegal: 'Firmensitz',
    contactsFiscal: 'Steuerdaten',
    contactsPeople: 'Kontakte',
    noContactRegistered: 'Kein Kontakt hinterlegt',
    noEmailSyncHint: 'Ohne E-Mail kann der Scanner die Dokumente dieses Lieferanten nicht automatisch zuordnen.',
    noEmailSyncWarning: 'Keine E-Mail hinterlegt — Dokumente werden nicht automatisch erkannt.',
    filterNoEmail: 'Ohne E-Mail',
    suggestEmailBtn: 'E-Mail suchen',
    suggestEmailSearching: 'Suche…',
    suggestEmailNoResults: 'Keine E-Mails in vorhandenen Logs gefunden.',
    suggestEmailSave: 'Hinzufügen',
    suggestEmailSaved: 'Gespeichert',
    suggestEmailSourceLog: 'aus Sync-Log',
    suggestEmailSourceQueue: 'aus Dokumenten-Warteschlange',
    suggestEmailSourceUnmatched: 'aus nicht zugeordneter USt-IdNr.',
    suggestEmailTitle: 'E-Mails in empfangenen Dokumenten gefunden',
    noAddressRegistered: 'Keine Adresse hinterlegt',
    noFiscalRegistered: 'Keine Steuerdaten',
    clientSince: 'Kunde seit',
    fromInvoiceBtn: 'Aus Rechnung',
    listinoAnalyze: 'Analysieren',
    listinoAnalyzing: 'KI-Analyse…',
    listinoInvoiceAnalyzedBadge: 'Analysiert',
    listinoNoInvoicesFile: 'Keine Rechnung mit Anhang für diesen Lieferanten.',
    listinoNoProducts: 'Keine Positionen auf dieser Rechnung. Andere versuchen.',
    saveNProducts: '{n} Produkte speichern',
    clickAddFirst: 'Klicken Sie auf Hinzufügen für das erste Produkt.',
    monthNavResetTitle: 'Zum aktuellen Monat',
    monthNavPrevMonthTitle: 'Vorheriger Monat',
    monthNavNextMonthTitle: 'Nächster Monat',
    monthNavPrevYearTitle: 'Vorheriges Jahr',
    monthNavNextYearTitle: 'Nächstes Jahr',
    supplierDesktopPeriodPickerTitle: 'Zeitraum (Daten)',
    supplierDesktopPeriodPickerButtonAria: 'Öffnen, um Von- und Bis-Datum des Zeitraums festzulegen',
    supplierDesktopPeriodFromLabel: 'Von',
    supplierDesktopPeriodToLabel: 'Bis',
    supplierDesktopPeriodApply: 'Übernehmen',
    addingAlias: 'Wird hinzugefügt…',
    addEmailAlias: '+ E-Mail hinzufügen',
    listinoImportPanelTitle: 'Produkte aus Rechnung importieren',
    listinoImportSelectInvoiceLabel: 'Rechnung auswählen',
    listinoImportProductsSelected: '{selected} / {total} Produkte ausgewählt',
    listinoImportPriceListDateLabel: 'Preislistendatum',
    listinoImportColListinoDate: 'Letzte Listino-Datum',
    listinoImportDateOlderThanListinoHint:
      'Belegdatum liegt vor dem letzten gespeicherten Listino — ohne Override wird nicht importiert.',
    listinoImportApplyOutdatedAdmin: 'Als aktuellen Preis übernehmen',
    listinoImportApplyOutdatedAdminActive: 'Override aktiv',
    listinoImportForceAllSelected: 'Import für alle ausgewählten Zeilen erzwingen',
    listinoImportPartialSaved:
      '{inserted} Zeilen gespeichert; {skipped} nicht importiert (Produkte: {products}).',
    listinoManualDateBlockedHint: 'Das Datum liegt vor dem letzten Listino-Update für diesen Produktnamen.',
    listinoManualDateBlockedNoAdmin: 'Nur Administratoren können das erzwingen.',
    listinoImportSaveBlockedHintAdmin: '«Als aktuellen Preis übernehmen» bei markierten Zeilen aktivieren.',
    listinoImportSaveBlockedHintOperator:
      'Einige Zeilen haben ein älteres Belegdatum als das Listino: zeilenweise «Als aktuellen Preis übernehmen», oder «Import für alle ausgewählten Zeilen erzwingen», oder abwählen.',
    listinoDocDetailImportHint:
      'Listino-Import (Lieferant → Listino) vergleicht das Belegdatum mit dem letzten gespeicherten Stand je Produkt.',
    listinoDocDetailImportHintAdmin: 'Bei Rechnungsimport kannst du zeilenweise erzwingen.',
    listinoDocRowBlockedBadge: 'Neueres Listino',
    listinoDocForceButton: 'Listino-Update erzwingen',
    listinoDocForceWorking: 'Speichern…',
    listinoDocForceOk: 'Preis mit Belegdatum gespeichert.',
    listinoDocForceErr: 'Override fehlgeschlagen.',
    discoveryCreateSupplier: 'Neuen Lieferanten anlegen',
    discoveryCompanyName: 'Firmenname *',
    discoveryEmailDiscovered: 'E-Mail (erkannt)',
    discoveryVat: 'USt-IdNr.',
    discoveryBranch: 'Standort',
    discoveryBreadcrumbSettings: 'Einstellungen',
    discoveryTitle: 'Posteingang erkunden',
    discoveryNoImap: 'Kein IMAP-Konto konfiguriert',
    discoveryNoImapHint: 'IMAP in den Standorteinstellungen konfigurieren, um den Scan zu aktivieren.',
    discoveryPartialScan: 'Teilscan — Fehler bei einigen Postfächern:',
    discoveryAllRegistered: 'Alle Absender sind bereits registriert',
    discoveryNoUnknown: 'Keine unbekannten Absender mit Anhängen in den letzten 30 Tagen.',
    discoveryReady: 'Bereit zum Scannen',
    discoveryReadyHint: 'Klicken Sie auf Postfach scannen, um die letzten 30 Tage zu analysieren.',
    discoveryScanBtn: 'Postfach scannen',
    toastDismiss: 'Hinweis schließen',
    countrySaving: 'Speichern…',
    countrySaved: 'Gespeichert',
    sidebarSediTitle: 'Standorte',
    deleteGenericConfirm: 'Dieses Element löschen? Nicht rückgängig zu machen.',
    deleteFailed: 'Fehler beim Löschen:',
    errorGenericTitle: 'Ein Fehler ist aufgetreten',
    errorGenericBody: 'Ein unerwarteter Fehler ist aufgetreten. Bitte erneut versuchen oder zur Startseite.',
    tryAgain: 'Erneut versuchen',
    errorCodeLabel: 'Fehlercode:',
    errorSegmentTitle: 'Dieser Bereich konnte nicht geladen werden',
    errorSegmentBody: 'Dieser Bereich ließ sich nicht laden. Bitte erneut versuchen oder zurückgehen.',
    errorDevDetailsSummary: 'Fehlerdetails (nur Entwicklung)',
    errorFatalTitle: 'Kritischer Fehler',
    errorFatalBody: 'Die Anwendung ist auf ein unerwartetes Problem gestoßen.',
    approvazioni_pageSub: 'Rechnungen zur Genehmigung über dem Schwellenwert',
    analyticsPageSub: 'Einkaufs- und Abstimmungsübersicht',
    analyticsMonths: '{n} Monate',
    attivitaPageTitle: 'Aktivitätsprotokoll',
    attivitaPageSub: 'Vollständige Geschichte der Operatorenaktionen',
    attivitaExportCsv: 'CSV exportieren',
    attivitaAllOperators: 'Alle Operatoren',
    attivitaRemoveFilters: 'Filter entfernen',
    analyticsErrorLoading: 'Fehler beim Laden der Daten',
    analyticsNoData: 'Keine Daten verfügbar.',
    analyticsKpiTotalInvoiced: 'Gesamt fakturiert',
    analyticsKpiNFatture: '{n} Rechnungen',
    analyticsKpiReconciliation: 'Abstimmung',
    analyticsKpiCompleted: '{n} abgeschlossen',
    analyticsKpiAvgTime: 'Durchschn. Abstimmungszeit',
    analyticsKpiDays: '{n} Tage',
    analyticsKpiDaysFrom: 'Tage vom Lieferschein zur Rechnung',
    analyticsKpiSlow: 'langsam',
    analyticsKpiOk: 'ok',
    analyticsKpiPriceAnomalies: 'Preisanomalien',
    analyticsKpiResolvedOf: '{n} gelöst von {total}',
    analyticsKpiToCheck: 'zu prüfen',
    analyticsKpiAllOk: 'alles ok',
    analyticsChartMonthlySpend: 'Monatliche Ausgaben',
    analyticsChartAmount: 'Betrag',
    analyticsChartInvoices: 'Rechnungen',
    analyticsChartTopSuppliers: 'Top Lieferanten',
    analyticsChartNoData: 'Keine Daten',
    analyticsChartBolleVsFatture: 'Lieferscheine vs Rechnungen',
    analyticsChartDeliveryNotes: 'Lieferscheine',
    analyticsSummaryPendingDocs: 'Ausstehende Dokumente',
    analyticsSummaryPendingNotes: 'Ausstehende Lieferscheine',
    analyticsSummaryArchivedInvoices: 'Archivierte Rechnungen',
    approvazioni_noPending: 'Keine Rechnungen ausstehend',
    approvazioni_allReviewed: 'Alle Rechnungen über dem Schwellenwert wurden überprüft.',
    approvazioni_viewInvoice: 'Rechnung ansehen →',
    approvazioni_rejectReason: 'Ablehnungsgrund (optional)',
    approvazioni_rejectPlaceholder: 'Z.B.: Betrag stimmt nicht mit Lieferschein überein...',
    approvazioni_confirmReject: 'Ablehnung bestätigen',
    approvazioni_approve: 'Genehmigen',
    approvazioni_reject: 'Ablehnen',
    approvazioni_threshold: 'Schwellenwert',
    attivitaFilterAll: 'Alle',
    attivitaFilterBolle: 'Lieferscheine',
    attivitaFilterFatture: 'Rechnungen',
    attivitaFilterDocumenti: 'Dokumente',
    attivitaFilterOperatori: 'Operatoren',
    attivitaError: 'Aktivitäten konnten nicht geladen werden.',
    attivitaNoRecent: 'Keine neueren Aktivitäten',
    attivitaRecentTitle: 'Letzte Aktivität',
    rekkiSyncTitle: 'Rekki E-Mail-Synchronisation',
    rekkiSyncDesc: 'Durchsucht das E-Mail-Postfach des Standorts und ordnet Rekki-Bestellungen automatisch zu',
    rekkiSyncMobileTap: 'Rekki-E-Mails synchronisieren',
    rekkiSyncNeverRun: 'Nie ausgeführt',
    rekkiSyncTapUpdate: 'tippen zum Aktualisieren',
    rekkiSyncTapStart: 'tippen zum Starten',
    rekkiSyncButtonLabel: 'LIEFERSCHEIN / RECHNUNG SCANNEN',
    rekkiSyncInProgress: 'Scan läuft',
    rekkiSyncProcessing: 'Rekki-E-Mails werden verarbeitet…',
    rekkiSyncStop: 'Stopp',
    rekkiSyncCheckNow: 'Jetzt prüfen',
    rekkiSyncStarting: 'Scan wird gestartet...',
    rekkiSyncDays: '{n} Tage',
    rekkiSyncLastScan: 'Letzter Scan',
    rekkiSyncEmails: 'E-Mails',
    rekkiSyncDocuments: 'Dokumente',
    rekkiSyncMatched: 'Zugeordnet',
    rekkiSyncUnmatched: 'Zuzuordnen',
    rekkiSyncRecentEmails: 'Zuletzt verarbeitete E-Mails',
    rekkiSyncNoData: 'Keine Preise erkannt',
    rekkiSyncNoDataDesc: 'Drücken Sie «Jetzt prüfen», um die Rekki-E-Mails von {nome} zu scannen',
    rekkiImapNotConfigured: 'E-Mail-Postfach nicht konfiguriert',
    rekkiImapNotConfiguredDesc: 'Konfigurieren Sie die IMAP-Zugangsdaten unter Einstellungen → Standort, um die Synchronisation zu aktivieren.',
    rekkiPhaseQueued: 'In der Warteschlange...',
    rekkiPhaseConnect: 'Verbindung zum Postfach...',
    rekkiPhaseSearch: 'Rekki-E-Mails suchen...',
    rekkiPhaseProcess: 'E-Mails verarbeiten...',
    rekkiPhasePersist: 'Daten speichern...',
    rekkiPhaseDone: 'Abgeschlossen',
    rekkiPhaseError: 'Fehler',
    rekkiDoneResult: 'Abgeschlossen — {n} E-Mails verarbeitet',
    rekkiErrUnknown: 'Unbekannter Fehler',
    rekkiErrNetwork: 'Netzwerkfehler',
    analyticsSinceFY: 'seit GJ-Beginn',
    backupPageTitle: 'Datensicherung',
    backupPageDesc: 'Automatische wöchentliche CSV-Exporte · Jeden Montag um 02:00 UTC',
    auditTitle: 'Preisrückforderungs-Audit',
    auditDesc: 'Analysiert alle historischen Rechnungen auf Überpreise gegenüber vereinbarten Rekki-Preisen',
    auditDateFrom: 'Von',
    auditDateTo: 'Bis',
    auditRunBtn: 'Audit starten',
    auditRunning: 'Analyse läuft...',
    auditSyncConfirm: 'Diese Operation analysiert alle historischen Rechnungen und aktualisiert die Referenzdaten in der Preisliste. Fortfahren?',
    auditSyncTitle: 'Verlauf mit Rekki synchronisieren',
    auditSyncDesc: 'Analysiert alle bisherigen Rechnungen und aktualisiert automatisch Referenzdaten, um Sperren «Dokumentdatum zu alt» aufzuheben',
    auditSyncBtn: 'Synchronisieren',
    auditSyncing: 'Läuft...',
    auditKpiSpreco: 'Gesamtverlust',
    auditKpiAnomalies: 'Anomalien',
    auditKpiProducts: 'Produkte',
    auditKpiFatture: 'Rechnungen',
    auditNoOvercharges: 'Keine Überpreise festgestellt!',
    auditNoOverchargesDesc: 'Alle berechneten Preise entsprechen den vereinbarten Rekki-Preisen oder liegen darunter',
    auditColFattura: 'Rechnung',
    auditColProdotto: 'Produkt',
    auditColPagato: 'Gezahlt',
    auditColPattuito: 'Vereinbart',
    auditColSpreco: 'Verlust',
    auditHelpTitle: 'Wie funktioniert der Audit?',
    auditHelpP1: 'Der Audit analysiert alle Rechnungen im ausgewählten Zeitraum und:',
    auditHelpLi1: 'Extrahiert Positionen aus jeder Rechnung mittels KI',
    auditHelpLi2: 'Vergleicht gezahlte Preise mit vereinbarten Rekki-Preisen (Preisliste)',
    auditHelpLi3: 'Identifiziert alle Fälle, in denen ein höherer Preis bezahlt wurde',
    auditHelpLi4: 'Berechnet den Gesamtverlust anhand der gekauften Mengen',
    auditHelpCta: '💡 Verwenden Sie diesen Bericht, um Gutschriften vom Lieferanten anzufordern',
    auditErrStatus: 'Fehler {status}',
    auditErrGeneric: 'Fehler beim Audit',
    auditErrSync: 'Fehler bei der Synchronisierung',
    auditCsvDate: 'Datum',
    auditCsvInvoiceNum: 'Rechnungsnummer',
    auditCsvProduct: 'Produkt',
    auditCsvRekkiId: 'Rekki-ID',
    auditCsvPaid: 'Gezahlt',
    auditCsvAgreed: 'Vereinbart',
    auditCsvDiffPct: 'Differenz %',
    auditCsvQty: 'Menge',
    auditCsvWaste: 'Verlust',
    sedeErrCreating: 'Fehler beim Erstellen des Standorts.',
    sedeErrSavingProfile: 'Fehler beim Speichern des Profils.',
    sedePinUpdated: 'PIN aktualisiert.',
    sedeErrUpdatingPin: 'Fehler beim Aktualisieren des PINs.',
    sedeErrSavingPin: 'Fehler beim Speichern des Standort-PINs.',
    sedeLocSaved: 'Lokalisierung gespeichert.',
    sedeErrLoadData: 'Fehler beim Laden der Daten.',
    sedeErrUpdating: 'Fehler beim Aktualisieren des Standorts.',
    sedeUpdated: 'Standort aktualisiert.',
    sedeDeleted: 'Standort gelöscht.',
    sedeErrSavingImap: 'Fehler beim Speichern der IMAP-Einstellungen.',
    sedeWizardStepOf: 'Schritt {step} von 3',
    sedeWizardNext: 'Weiter',
    sedeWizardBack: '← Zurück',
    sedeWizardSkip: 'Überspringen',
    sedeWizardNameLabel: 'Standortname',
    sedeWizardEmailConfigTitle: 'E-Mail-Einrichtung',
    sedeWizardEmailConfigDesc: 'Zum Empfangen von Rechnungen per E-Mail. Kann auch später eingerichtet werden.',
    sedeWizardAppPassRequired: 'App-Passwort erforderlich.',
    sedeWizardAddOperatorsTitle: 'Operatoren hinzufügen',
    sedeWizardAddOperatorsDesc: 'Operatoren melden sich mit Name + PIN an (mind. 4 Ziffern).',
    sedeWizardCreateBtn: 'Standort + {n} Operatoren erstellen',
    sedeWizardCreatingBtn: 'Wird erstellt…',
    sedeWizardStartSetup: 'Geführte Einrichtung starten',
    sedeEmailNotConfigured: 'E-Mail nicht eingerichtet.',
    sedeCreatedSuccess: 'Standort "{nome}" erfolgreich erstellt.',
    gmailBadgeTitle: '💡 Bereit für die Preisrevision?',
    gmailBadgeDescConfigured: 'Gmail API ist konfiguriert! Verbinde dein Konto, um den automatischen Scanner zu aktivieren und potenzielle Erstattungen bei {nome} zurückzuholen.',
    gmailBadgeDescNotConfigured: 'Richte Gmail ein (2 Min.), um E-Mails von {nome} automatisch zu scannen und unbefugte Überzahlungen zu erkennen.',
    gmailBadgeCTAConnect: 'Verbinden & Scannen',
    gmailBadgeCTASetup: 'Jetzt einrichten',
    gmailBadgeDismiss: 'Ausblenden',
    gmailBadgeAPIConfigured: 'API Konfiguriert',
    gmailBadgeConnectAccount: 'Konto verbinden',
    gmailBadgePriceCheck: 'Preiskontrolle',
    gmailBadgePriceCheckSub: 'Auto-Anomalien',
    gmailBadgeRecoverySub: '2J. Verlauf',
    autoSyncTitle: 'Auto-Sync Rechnung',
    autoSyncDesc: 'Produkte aus der Rechnung automatisch extrahieren und mit der Preisliste vergleichen',
    autoSyncBtn: 'Rechnung analysieren',
    autoSyncBtnLoading: 'Analyse läuft...',
    autoSyncTotal: 'Gesamt',
    autoSyncAnomalies: 'Anomalien',
    autoSyncNewItems: 'Neu',
    autoSyncProduct: 'Produkt',
    autoSyncPrice: 'Preis',
    autoSyncNewItem: 'Neu',
    autoSyncAnomalyWarning: '{n} Produkt{s} mit anomalem Preisanstieg',
    autoSyncConfirmBtn: '{n} Produkte bestätigen',
    autoSyncImporting: 'Importieren...',
    autoSyncErrAnalysis: 'Fehler bei der Analyse',
    autoSyncErrImport: 'Fehler beim Import',
  },
}

const dict: Record<Locale, Translations> = { it, en, es, fr, de }

export function getTranslations(locale: Locale = 'en'): Translations {
  return dict[locale] ?? dict.en
}

export type { Translations }
