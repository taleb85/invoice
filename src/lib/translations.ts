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
  }
  login: {
    /** Sotto il logo FLUXO (maiuscole via CSS) */
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
    total: string
  }
  status: {
    inAttesa: string
    completato: string
    completata: string
  }
  dashboard: {
    title: string
    subtitle: string
    suppliers: string
    totalBills: string
    pendingBills: string
    invoices: string
    recentBills: string
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
    /** KPI sheet: lista bolle in attesa vuota */
    kpiNoPendingBills: string
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
    /** Sottotitolo card Fornitori (KPI dashboard operatore) */
    kpiFornitoriSub: string
    /** Card Da processare: sottotitolo sotto il conteggio (coda documenti) */
    kpiDaProcessareSub: string
    /** Operatore: profilo senza sede assegnata */
    operatorNoSede: string
    /** Banner: OCR ha proposto un fornitore non in rubrica — {name} = nome estratto */
    suggestedSupplierBanner: string
    suggestedSupplierAdd: string
    suggestedSupplierImport: string
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
    /** Email non lette rilevate in casella nel periodo — {found} */
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
    rekkiLookupByVat: string
    rekkiSaveRekkiMapping: string
    rekkiConnectedBadge: string
    rekkiCachedListBanner: string
    rekkiLookupNeedVat: string
    /** Dopo incolla link Rekki e blur */
    rekkiIdExtractedFromLink: string
    /** Un solo risultato API P.IVA → salvataggio automatico */
    rekkiAutoLinkedSingle: string
    saving: string
    // supplier detail page tabs & KPIs
    tabRiepilogo: string
    tabListino: string
    tabStrategyConto: string
    kpiBolleTotal: string
    kpiFatture: string
    kpiPending: string
    kpiReconciliation: string
    subAperte: string
    subConfermate: string
    subDaAbbinare: string
    subChiuse: string
    /** KPI Riepilogo fornitore — sottotitolo card listino */
    subListinoRows: string
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
    /** Attesa caricamento scheda fornitore (logo + messaggio) */
    loadingProfile: string
    logoUrlLabel: string
    logoUrlPlaceholder: string
    logoUrlHint: string
  }
  bolle: {
    title: string
    new: string
    uploadInvoice: string
    viewDocument: string
    noBills: string
    addFirst: string
    deleteConfirm: string
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
    stmtClickHint: string
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
    gotoFatturaDraft: string
    gotoBollaDraft: string
    toggleAddStatement: string
    toggleRemoveStatement: string
    /** Chip corto: tipo documento in coda */
    docKindEstratto: string
    docKindBolla: string
    docKindFattura: string
    docKindHintBolla: string
    docKindHintFattura: string
    docKindGroupAria: string
    finalizeNeedsSupplier: string
    btnFinalizeFattura: string
    btnFinalizeBolla: string
    btnFinalizeStatement: string
    btnFinalizing: string
    finalizeSuccess: string
    // PendingMatchesTab — empty states
    noPendingDocs: string
    noDocsFound: string
    noBolleAttesa: string
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
    ocrFormatToggleTitle: string
    allBolleInvoicedOk: string
    aiStatementTotalLabel: string
    statementLinkedBolleLine: string
    selectedSumLabel: string
    selectedBolle_one: string
    selectedBolle_other: string
    receivedOn: string
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
    noAddressRegistered: string
    noFiscalRegistered: string
    clientSince: string
    fromInvoiceBtn: string
    listinoAnalyze: string
    listinoAnalyzing: string
    listinoNoInvoicesFile: string
    listinoNoProducts: string
    saveNProducts: string
    clickAddFirst: string
    monthNavResetTitle: string
    addingAlias: string
    addEmailAlias: string
    listinoImportPanelTitle: string
    listinoImportSelectInvoiceLabel: string
    listinoImportProductsSelected: string
    listinoImportPriceListDateLabel: string
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
  },
  login: {
    brandTagline: 'Gestione fatture',
    subtitle: 'Accesso sede: il tuo nome e codice a 4 cifre',
    adminSubtitle: 'Portale Gestionale',
    adminSubtitleHint:
      'Email e password per il Portale Gestionale. Per nome operatore e codice usa «Accesso Sede» (responsabile sede e operatori).',
    nameLabel: 'Nome',
    namePlaceholder: 'MARIO',
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
  },
  nav: {
    dashboard: 'Dashboard',
    dashboardAdmin: 'Profilo admin',
    operatori: 'Operatori',
    fornitori: 'Fornitori',
    bolle: 'Bolle',
    fatture: 'Fatture',
    archivio: 'Archivio',
    logEmail: 'Log Email',
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
    total: 'Totale',
  },
  status: {
    inAttesa: 'In attesa',
    completato: 'Completato',
    completata: 'Completata',
  },
  dashboard: {
    title: 'Dashboard',
    subtitle: 'Panoramica degli acquisti',
    suppliers: 'Fornitori',
    totalBills: 'Bolle totali',
    pendingBills: 'Bolle in attesa',
    invoices: 'Fatture',
    recentBills: 'Bolle recenti',
    viewAll: 'Vedi tutte →',
    syncEmail: 'Sincronizza Email',
    emailSyncScopeLookback: 'Finestra giorni (sede)',
    emailSyncScopeFiscal: 'Anno fiscale',
    emailSyncFiscalYearSelectAria: 'Periodo per la sincronizzazione email',
    emailSyncScopeHint:
      'IT, FR, DE, ES: anno civile. UK: anno fiscale che termina il 5 aprile (tax year). Ogni sede usa il proprio paese.',
    emailSyncLookbackSedeDefault: 'Default sede (IMAP)',
    emailSyncLookbackDaysN: 'Ultimi {n} giorni',
    emailSyncLookbackDaysAria: 'Quanti giorni indietro cercare le email non lette',
    emailSyncLookbackDaysHint:
      'Default sede: usa i giorni impostati sulla sede. Altrimenti limita la ricerca IMAP agli ultimi N giorni (solo email non lette).',
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
    kpiNoPendingBills: 'Nessuna bolla in attesa.',
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
    adminGlobalTitle: 'Dashboard globale',
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
    kpiFornitoriSub: 'Anagrafica e ricerca',
    kpiDaProcessareSub: 'documenti in coda',
    operatorNoSede:
      'Nessuna sede associata al tuo profilo. Contatta l’amministratore per collegarti alla filiale corretta.',
    suggestedSupplierBanner: 'Rilevato nuovo fornitore: {name}. Vuoi aggiungerlo?',
    suggestedSupplierAdd: 'Nuovo fornitore',
    suggestedSupplierImport: 'Importa da OCR',
    enterAsSede: 'Entra come sede',
    syncHealthAlert: 'Problema sincronizzazione (IMAP o OCR)',
    syncHealthOcrCount: 'Fallimenti OCR (48h): {n}',
    viewingAsSedeBanner: 'Stai visualizzando la dashboard come:',
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
    rekkiLookupByVat: 'Cerca su Rekki (P.IVA)',
    rekkiSaveRekkiMapping: 'Salva collegamento Rekki',
    rekkiConnectedBadge: 'Rekki',
    rekkiCachedListBanner: 'Dati in cache (connessione assente). Le modifiche potrebbero non essere aggiornate.',
    rekkiLookupNeedVat: 'Aggiungi la P.IVA al fornitore per cercare su Rekki.',
    rekkiIdExtractedFromLink: 'ID fornitore ricavato dal link Rekki.',
    rekkiAutoLinkedSingle: 'Un solo fornitore trovato per questa P.IVA — collegamento Rekki salvato.',
    saving: 'Salvataggio...',
    tabRiepilogo: 'Riepilogo',
    tabListino: 'Listino / Prezzi',
    tabStrategyConto: 'Estratto Conto',
    kpiBolleTotal: 'Bolle totali',
    kpiFatture: 'Fatture registrate',
    kpiPending: 'Documenti in attesa',
    kpiReconciliation: 'Riconciliazione',
    subAperte: 'aperte',
    subConfermate: 'confermate',
    subDaAbbinare: 'da abbinare',
    subChiuse: 'bolle chiuse',
    subListinoRows: 'righe listino nel periodo',
    subStatementsNoneInMonth: 'nessun estratto nel mese',
    subStatementsAllVerified: 'tutti verificati OK',
    subStatementsWithIssues: 'con anomalie',
    helpText: 'Vai alla tab <b>Estratto Conto</b> per abbinare documenti e bolle, o a <b>Bolle</b> e <b>Fatture</b> per vedere lo storico completo.',
    listinoSetupTitle: 'Tabella Listino non ancora creata',
    listinoSetupSubtitle: 'Attiva il tracking prezzi per prodotto in 2 click:',
    listinoSetupStep1: 'Clicca <strong class="font-bold text-slate-100">"Copia SQL"</strong> qui sotto',
    listinoSetupStep2: 'Apri <a href="https://supabase.com/dashboard/project/dubocvwsdzrqrrxsedas/sql/new" target="_blank" rel="noopener noreferrer" class="font-semibold text-amber-200 underline decoration-amber-200/50 transition-colors hover:text-slate-100">SQL Editor ↗</a>, incolla e clicca <strong class="font-bold text-slate-100">"Run"</strong>',
    listinoSetupShowSQL: 'Mostra SQL completo ▸',
    listinoCopySQL: 'Copia SQL',
    listinoCopied: 'Copiato!',
    listinoProdotti: 'Listino Prodotti',
    listinoProdottiTracked: 'prodotti tracciati',
    listinoNoData: 'Nessun prezzo prodotto registrato',
    listinoNoDataHint: 'Inserisci i prezzi direttamente nella tabella <code class="font-mono text-slate-300">listino_prezzi</code> su Supabase.',
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
    loadingProfile: 'Stiamo caricando anagrafica, documenti e riepilogo del fornitore…',
    logoUrlLabel: 'Logo fornitore (URL)',
    logoUrlPlaceholder: 'https://esempio.it/logo.png',
    logoUrlHint:
      'Indirizzo HTTPS di un’immagine (PNG, JPG o SVG). Se il link non è valido o non si carica, restano le iniziali del nome.',
  },
  bolle: {
    title: 'Bolle',
    new: 'Nuova Bolla',
    uploadInvoice: 'Carica Fattura',
    viewDocument: 'Vedi Documento',
    noBills: 'Nessuna bolla ancora.',
    addFirst: 'Registra la prima bolla →',
    deleteConfirm: 'Eliminare questa bolla? Verranno eliminate anche le fatture collegate.',
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
    scannerModeAuto: 'Rilevamento automatico',
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
  },
  log: {
    title: 'Log Sincronizzazione Email',
    subtitle: 'Storico delle email elaborate dalla sincronizzazione automatica.',
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
    emptyHint: 'Esegui una sincronizzazione email dalla Dashboard.',
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
    operatorPinTooShort: 'Il PIN deve essere di almeno 4 caratteri.',
  },
  statements: {
    heading: 'Verifica Estratti Conto Mensili',
    tabVerifica: 'Estratti Conto',
    tabDocumenti: 'Da Processare',
    schedaNavDaProcessareDesc: 'Allegati in arrivo: associa fornitori, bolle e fatture.',
    schedaNavVerificaDesc: 'Controllo mensile estratti conto vs bolle e fatture.',
    statusOk: 'OK',
    statusFatturaMancante: 'Fattura mancante',
    statusBolleManc: 'Bolle mancanti',
    statusErrImporto: 'Errore importo',
    statusRekkiPrezzo: 'Prezzo Rekki vs fattura',
    stmtReceived: 'Estratti conto ricevuti',
    stmtClickHint: '— clicca per vedere il Triple-Check',
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
    gotoFatturaDraft: 'Vai alla fattura bozza →',
    gotoBollaDraft: 'Vai alla bolla bozza →',
    toggleAddStatement: 'Aggiungi a estratto conto',
    toggleRemoveStatement: 'Rimuovi da estratto conto',
    docKindEstratto: 'Estratto',
    docKindBolla: 'Bolla',
    docKindFattura: 'Fattura',
    docKindHintBolla: 'Segna come bolla di consegna (DDT), non estratto conto né fattura da incrociare',
    docKindHintFattura: 'Segna come fattura da associare alle bolle in attesa',
    docKindGroupAria: 'Tipo di documento',
    finalizeNeedsSupplier: 'Associa un fornitore per finalizzare.',
    btnFinalizeFattura: 'Registra fattura (senza bolla)',
    btnFinalizeBolla: 'Crea bolla da allegato',
    btnFinalizeStatement: 'Archivia estratto',
    btnFinalizing: 'Finalizzazione…',
    finalizeSuccess: 'Documento registrato.',
    noPendingDocs: 'Nessun documento da esaminare',
    noDocsFound: 'Nessun documento trovato',
    noBolleAttesa: 'Nessuna bolla in attesa disponibile',
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
    ocrFormatToggleTitle: 'Forza interpretazione numerica alternativa',
    allBolleInvoicedOk: 'Tutte le bolle hanno una fattura corrispondente — estratto verificato ✓',
    aiStatementTotalLabel: 'Totale estratto (IA):',
    statementLinkedBolleLine: '{matched}/{total} bolle associate',
    selectedSumLabel: 'Selezionate:',
    selectedBolle_one: '({n} bolla)',
    selectedBolle_other: '({n} bolle)',
    receivedOn: 'Ricevuto il',
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
    badgeNeedsHuman: 'Serve abbinamento',
    rememberAssociationTitle: 'Ricordare questa associazione per il futuro?',
    rememberAssociationSave: 'Salva email mittente',
    rekkiDocumentLink: 'Rekki',
  },
  appStrings: {
    brandFooter: 'FLUXO · Gestione Acquisti',
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
    backToHome: 'Torna alla dashboard',
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
    imapLookbackLastDays: 'Legge email non lette degli ultimi {n} giorni',
    imapLookbackUnlimited: 'Legge tutte le email non lette (nessun limite)',
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
    noAddressRegistered: 'Nessun indirizzo registrato',
    noFiscalRegistered: 'Nessun dato fiscale registrato',
    clientSince: 'Cliente dal',
    fromInvoiceBtn: 'Da Fattura',
    listinoAnalyze: 'Analizza',
    listinoAnalyzing: 'Analisi AI…',
    listinoNoInvoicesFile: 'Nessuna fattura con file allegato trovata per questo fornitore.',
    listinoNoProducts: 'Nessun prodotto trovato in questa fattura. Prova con un\'altra.',
    saveNProducts: 'Salva {n} prodotti',
    clickAddFirst: 'Clicca «Aggiungi» per inserire il primo prodotto.',
    monthNavResetTitle: 'Torna al mese corrente',
    addingAlias: 'Aggiunta…',
    addEmailAlias: '+ Aggiungi email',
    listinoImportPanelTitle: 'Importa prodotti da fattura',
    listinoImportSelectInvoiceLabel: 'Seleziona fattura',
    listinoImportProductsSelected: '{selected} / {total} prodotti selezionati',
    listinoImportPriceListDateLabel: 'Data listino',
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
  },
  login: {
    brandTagline: 'Invoice management',
    subtitle: 'Branch access: your name and 4-digit code',
    adminSubtitle: 'Management portal',
    adminSubtitleHint:
      'Use your admin email and password for the management portal. For operator name and PIN, use Branch access (branch admins and operators).',
    nameLabel: 'Name',
    namePlaceholder: 'JOHN',
    pinLabel: 'Branch access code',
    pinDigits: '(4 digits)',
    lookingUp: 'Checking name…',
    enterFirstName: 'Enter only the name and press Tab',
    emailLabel: 'Email',
    emailPlaceholder: 'admin@company.com',
    passwordLabel: 'Password',
    passwordPlaceholder: 'Minimum 6 characters',
    loginBtn: 'Sign In',
    adminLink: 'Management portal →',
    operatorLink: '← Branch access',
    pinIncorrect: 'Incorrect code. Please try again.',
    invalidCredentials: 'Invalid credentials.',
    verifying: 'Verifying…',
    accessing: 'Signing in…',
    notFound: 'User not found.',
    adminOnlyEmail: 'This sign-in is for administrators only. Use branch access or ask for an admin account.',
    adminGateLabel: 'Admin screen unlock code',
    adminGateHint: 'Enter the PIN to unlock email and password.',
    adminGateWrong: 'Invalid code.',
  },
  nav: {
    dashboard: 'Dashboard',
    dashboardAdmin: 'Admin',
    operatori: 'Operators',
    fornitori: 'Suppliers',
    bolle: 'Delivery Notes',
    fatture: 'Invoices',
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
  },
  common: { save: 'Save', cancel: 'Cancel', delete: 'Delete', edit: 'Edit', new: 'New', loading: 'Loading...', error: 'Error', success: 'Success', noData: 'No data', document: 'Document', actions: 'Actions', date: 'Date', status: 'Status', supplier: 'Supplier', notes: 'Notes', phone: 'Phone', saving: 'Saving...', attachment: 'Attachment', openAttachment: 'Open attachment', detail: 'Detail', add: 'Add', rename: 'Rename', role: 'Role', aiExtracted: 'AI Extracted Data', matched: 'Matched', notMatched: 'Not matched', recordSupplierLinked: 'Linked', company: 'Company', invoiceNum: 'Invoice No.', total: 'Total' },
  status: { inAttesa: 'Pending', completato: 'Completed', completata: 'Completed' },
  dashboard: { title: 'Dashboard', subtitle: 'Purchasing overview', suppliers: 'Suppliers', totalBills: 'Total delivery notes', pendingBills: 'Pending notes', invoices: 'Invoices', recentBills: 'Recent delivery notes', viewAll: 'View all →', syncEmail: 'Sync Email', emailSyncScopeLookback: 'Recent days (location lookback)', emailSyncScopeFiscal: 'Fiscal year', emailSyncFiscalYearSelectAria: 'Email sync period', emailSyncScopeHint: 'IT, FR, DE, ES: calendar year. UK: tax year ending 5 April. Each location uses its own country.', emailSyncLookbackSedeDefault: 'Location default (IMAP)', emailSyncLookbackDaysN: 'Last {n} days', emailSyncLookbackDaysAria: 'How far back to search for unread mail', emailSyncLookbackDaysHint: 'Location default uses the days set on the branch. Otherwise limit the IMAP search to the last N days (unread only).', emailSyncDocumentKindAria: 'Document types to import when syncing email', emailSyncDocumentKindHint: 'All: default. New supplier: only senders not in your directory. Delivery note / Invoice: force draft type. Statement: only emails whose subject looks like a bank/supplier statement.', emailSyncDocumentKindAll: 'All documents', emailSyncDocumentKindFornitore: 'New supplier', emailSyncDocumentKindBolla: 'Delivery note (DDT)', emailSyncDocumentKindFattura: 'Invoice', emailSyncDocumentKindEstratto: 'Statement', syncing: 'Syncing...', sendReminders: 'Send reminders', sending: 'Sending...', viewLog: 'View Log', sedeOverview: 'Overview by Location', manageSedeNamed: 'Manage {name} →', manageSedi: 'Manage locations →', sedeImapOn: 'Email active', digitalizzaRicevuto: 'Digital receipt', kpiNoPendingBills: 'No pending delivery notes.', errorCountSuffix: 'errors', manualReceiptLabel: 'Received (no delivery note)', manualReceiptPlaceholder: 'e.g. 5 kg squid, 2 crates lemons', manualReceiptRegister: 'Register delivery', manualReceiptRegistering: 'Saving…', manualReceiptSaved: 'Delivery registered.', manualReceiptNeedTextOrPhoto: 'Enter a description or attach a photo.', manualReceiptRemovePhoto: 'Remove photo', manualReceiptNeedSupplier: 'Select a supplier.', manualReceiptRegisterFailed: 'Registration failed.', manualReceiptEmailSupplierLabel: 'Email the supplier to request the purchase order and delivery note (DDT)', manualReceiptEmailSupplierHint: 'Add the supplier’s email on their profile to enable.', manualReceiptEmailSent: 'Request email sent to the supplier.', manualReceiptEmailFailed: 'Delivery saved, but the email could not be sent.', manualReceiptEmailDescPhotoOnly: 'A photo was attached to this delivery registration (no text description).', adminGlobalTitle: 'Global dashboard', adminGlobalSubtitle: 'Summary of all locations. Pick a branch from the menu or a card for the operational view.', adminGlobalTotalsLabel: 'Network totals', adminOpenBranchDashboard: 'Operational view', adminSedeSettingsLink: 'Branch page', adminDocQueueShort: 'In queue', rekkiOrder: 'Order on Rekki', manualDeliveryNeedSede: 'Select an active operator or ensure your profile is linked to a location to register a delivery.', kpiPriceListSub: 'rows in price list', listinoOverviewHint: 'Price list lines for suppliers in your scope. Open a supplier to edit or import from an invoice.', listinoOverviewEmpty: 'No price list rows in this scope.', listinoOverviewOpenSupplier: 'Open supplier →', listinoOverviewLimitNote: 'Showing the latest {n} rows.', fattureRiepilogoTitle: 'Invoice totals', fattureRiepilogoHint: 'Sum of amounts in your scope. The table lists the latest invoices by date; open one for attachment and links.', fattureRiepilogoEmpty: 'No invoices in this scope.', fattureRiepilogoLimitNote: 'Showing the latest {n} invoices (by date).', fattureRiepilogoOpenInvoice: 'Open invoice →', fattureRiepilogoCountLabel: '{n} invoices', fattureRiepilogoLinkAll: 'All invoices →', kpiStatementNone: 'No statements yet', kpiStatementAllOk: 'No anomalies', kpiStatementIssuesFooter: 'of {t} statements checked', kpiFornitoriSub: 'Directory & search', kpiDaProcessareSub: 'documents in queue', operatorNoSede: 'No branch is linked to your profile. Ask an administrator to assign you to the correct location.', suggestedSupplierBanner: 'New supplier detected: {name}. Add them?', suggestedSupplierAdd: 'New supplier', suggestedSupplierImport: 'Import from OCR', enterAsSede: 'Enter as location', syncHealthAlert: 'Sync issue (IMAP or OCR)', syncHealthOcrCount: 'OCR failures (48h): {n}', viewingAsSedeBanner: 'You are viewing the dashboard as:', exitSedeView: 'Back to admin overview', emailSyncQueued: 'Queued — another sync is finishing…', emailSyncPhaseConnect: 'Connecting…', emailSyncConnectToServer: 'Connecting to IMAP (network, TLS, sign-in)…', emailSyncConnectOpeningMailbox: 'Opening the Inbox…', emailSyncPhaseSearch: 'Scanning message text…', emailSyncPhaseProcess: 'Attachment analysis with Vision AI…', emailSyncPhasePersist: 'Saving to database…', emailSyncPhaseDone: 'Sync completed.', emailSyncStalled: 'No updates for a while — Vision AI can take several minutes on many attachments. Please wait…', emailSyncStalledHint: 'This only means the live sync stream is quiet — normal during long OCR. Real IMAP retry counts appear in the red banner above during the connect phase.', emailSyncImapRetryLine: 'IMAP connection: attempt {current} of {max}', emailSyncCountsHint: 'Found · new in app · processed · PDF/body units', emailSyncMailboxGlobal: 'Global IMAP inbox (environment variables)', emailSyncMailboxSede: 'Inbox: {name}', emailSyncSupplierFilterLine: 'Supplier filter: {name}', emailSyncStatFoundLine: 'Found in mailbox: {found}', emailSyncStatImportedLine: 'New in app (documents imported): {imported}', emailSyncStatProcessedLine: 'Emails fully processed: {processed}', emailSyncStatIgnoredLine: 'Skipped or no result: {ignored}', emailSyncStatDraftsLine: 'Auto-created delivery note drafts: {drafts}', emailSyncStatAlreadyLine: 'Already processed in a past sync (not imported again): {n}', emailSyncStatUnitsLine: 'Units to scan (PDF/image attachments + eligible email bodies): {done} / {total}', emailSyncStripDetailsExpandAria: 'Show email sync details', emailSyncStripDetailsCollapseAria: 'Hide email sync details', emailSyncStop: 'Stop', emailSyncStopAria: 'Stop email sync', emailSyncDismiss: 'Dismiss', emailSyncDismissAria: 'Dismiss email sync summary', potentialSupplierFromEmailBodyBanner: 'Potential supplier from email text: {name}. Associate them?', potentialSupplierFromEmailBodyCta: 'Open new supplier' },
  fornitori: { title: 'Suppliers', new: 'New Supplier', nome: 'Name / Company', email: 'Email', piva: 'VAT Number', noSuppliers: 'No suppliers yet.', addFirst: 'Add the first supplier →', editTitle: 'Edit Supplier', saveChanges: 'Save Changes', notFound: 'Supplier not found.', deleteConfirm: 'Delete this supplier? All linked delivery notes and invoices will also be deleted.', importaDaFattura: 'Import from Invoice', countLabel: 'suppliers registered', namePlaceholder: 'e.g. Smith & Co Ltd', emailPlaceholder: 'supplier@example.com', pivaLabel: 'VAT Number', pivaPlaceholder: 'GB123456789', addressLabel: 'Address (optional)', addressPlaceholder: 'Street, postcode, city', rekkiLinkLabel: 'Rekki link (optional)', rekkiLinkPlaceholder: 'https://…', rekkiIdLabel: 'Rekki ID (optional)', rekkiIdPlaceholder: 'e.g. supplier ID on Rekki', rekkiIntegrationTitle: 'Rekki integration', rekkiLookupByVat: 'Search Rekki (VAT)', rekkiSaveRekkiMapping: 'Save Rekki link', rekkiConnectedBadge: 'Rekki', rekkiCachedListBanner: 'Cached data (offline). Updates may be stale.', rekkiLookupNeedVat: 'Add the VAT number on the supplier record to search Rekki.', rekkiIdExtractedFromLink: 'Supplier ID extracted from the Rekki link.', rekkiAutoLinkedSingle: 'Only one Rekki supplier matched this VAT — Rekki link saved.', saving: 'Saving...', tabRiepilogo: 'Overview', tabListino: 'Price List', tabStrategyConto: 'Statement', kpiBolleTotal: 'Total delivery notes', kpiFatture: 'Invoices received', kpiPending: 'Pending documents', kpiReconciliation: 'Reconciliation', subAperte: 'open', subConfermate: 'confirmed', subDaAbbinare: 'to match', subChiuse: 'notes closed', subListinoRows: 'price list rows in period', subStatementsNoneInMonth: 'none this month', subStatementsAllVerified: 'all verified OK', subStatementsWithIssues: 'with issues', helpText: 'Go to the <b>Statement</b> tab to match documents and delivery notes, or to <b>Delivery Notes</b> and <b>Invoices</b> for the full history.', listinoSetupTitle: 'Price list table not yet created', listinoSetupSubtitle: 'Activate per-product price tracking in 2 clicks:', listinoSetupStep1: 'Click <strong class="font-bold text-slate-100">"Copy SQL"</strong> below', listinoSetupStep2: 'Open the <a href="https://supabase.com/dashboard/project/dubocvwsdzrqrrxsedas/sql/new" target="_blank" rel="noopener noreferrer" class="font-semibold text-amber-200 underline decoration-amber-200/50 transition-colors hover:text-slate-100">SQL Editor ↗</a>, paste and click <strong class="font-bold text-slate-100">"Run"</strong>', listinoSetupShowSQL: 'Show full SQL ▸', listinoCopySQL: 'Copy SQL', listinoCopied: 'Copied!', listinoProdotti: 'Products Price List', listinoProdottiTracked: 'products tracked', listinoNoData: 'No product prices recorded', listinoNoDataHint: 'Enter prices directly in the <code class="font-mono text-slate-300">listino_prezzi</code> table on Supabase.', listinoTotale: 'Total spent', listinoDaBolle: 'From delivery notes', listinoDaFatture: 'From invoices', listinoStorico: 'Document history', listinoDocs: 'documents', listinoNoDocs: 'No documents with amount recorded', listinoColData: 'Date', listinoColTipo: 'Type', listinoColNumero: 'Number', listinoColImporto: 'Amount', listinoColTotale: 'Total', preferredLanguageEmail: 'Preferred language (for emails)', languageInheritSede: '— Inherit from location —', recognizedEmailsTitle: 'Recognized emails', recognizedEmailsHint: 'Additional addresses from which this supplier may send documents. Email scanning matches them automatically.', recognizedEmailPlaceholder: 'e.g. invoices@supplier.example.com', recognizedEmailLabelOptional: 'Label (optional)', displayNameLabel: 'Short display name', displayNameHint: 'Optional. Shown in the mobile bottom bar and compact lists instead of the full legal name.', displayNamePlaceholder: 'e.g. Amalfi', loadingProfile: 'Loading supplier profile, documents and summary…', logoUrlLabel: 'Supplier logo (URL)', logoUrlPlaceholder: 'https://example.com/logo.png', logoUrlHint: 'HTTPS image (PNG, JPG or SVG). If it fails to load, initials are shown.', syncEmailNeedSede: 'Assign a location to the supplier to sync email.' },
  bolle: { title: 'Delivery Notes', new: 'New Delivery Note', uploadInvoice: 'Upload Invoice', viewDocument: 'View Document', noBills: 'No delivery notes yet.', addFirst: 'Register the first delivery note →', deleteConfirm: 'Delete this delivery note? Linked invoices will also be deleted.', ocrScanning: 'Recognizing supplier…', ocrMatched: 'Supplier recognized', ocrNotFound: 'Select supplier manually', ocrAnalyzing: 'Analyzing…', ocrAutoRecognized: 'Recognized automatically', ocrRead: 'Read:', selectManually: 'Select supplier', saveNote: 'Save Delivery Note', savingNote: 'Saving…', analyzingNote: 'Analyzing document…', takePhotoOrFile: 'Take photo or choose file', ocrHint: 'Supplier will be recognized automatically', cameraBtn: 'Camera', fileBtn: 'Choose file', countSingolo: 'delivery note registered', countPlural: 'delivery notes registered', countTodaySingolo: 'delivery note today', countTodayPlural: 'delivery notes today', noBillsToday: 'No delivery notes for today.', listShowAll: 'All delivery notes', listShowToday: 'Today only', listAllPending: 'Pending only', fotoLabel: 'Photo / Delivery Note File', fornitoreLabel: 'Supplier', dataLabel: 'Delivery Note Date', dettaglio: 'Delivery Note Detail', fattureCollegate: 'Linked invoices', aggiungi: '+ Add', nessunaFatturaCollegata: 'No linked invoices.', allegatoLink: 'Attachment →', statoCompletato: 'Completed', statoInAttesa: 'Pending', apri: 'Open', colNumero: 'Number', colAttachmentKind: 'Attachment', attachmentKindPdf: 'PDF', attachmentKindImage: 'Image', attachmentKindOther: 'File', nessunaBollaRegistrata: 'No delivery notes registered', creaLaPrimaBolla: 'Create the first delivery note →', vediDocumento: 'View document', dateFromDocumentHint: 'From document', prezzoDaApp: 'App price', verificaPrezzoFornitore: 'Verify supplier price', rekkiPrezzoIndicativoBadge: '⚠️ Indicative price from Rekki app', listinoRekkiRefTitle: 'Reference price list (Rekki)', listinoRekkiRefHint: 'With Rekki ID set on the supplier, compare this delivery note total with the latest imported list prices.', listinoRekkiRefEmpty: 'No price list rows for this supplier.', scannerTitle: 'AI Scanner', scannerWhatLabel: 'What are you uploading?', scannerModeAuto: 'Auto-detect', scannerModeBolla: 'Delivery note / DDT', scannerModeFattura: 'Invoice', scannerModeSupplier: 'New supplier', scannerFlowBolla: 'Delivery note registration', scannerFlowFattura: 'Invoice registration', scannerSaveFattura: 'Save invoice', scannerSavingFattura: 'Saving invoice…', scannerCreateSupplierCta: 'Create supplier from extracted data', scannerCreateSupplierFromUnrecognized: 'Create supplier from this document', scannerPdfPreview: 'PDF attached — preview not available' },
  fatture: { title: 'Invoices', new: 'New Invoice', noInvoices: 'No invoices yet.', addFirst: 'Add the first invoice →', invoice: 'Invoice', openBill: 'Open delivery note →', deleteConfirm: 'Delete this invoice? This action is irreversible.', countLabel: 'invoices received', headerBolla: 'Delivery Note', headerAllegato: 'Attachment', apri: 'Open →', caricaFatturaTitle: 'Upload Invoice', bollaMarkata: 'The delivery note will be marked as complete', collegataABolla: 'Linked to a delivery note', bollaPasseraCompletato: 'On save the delivery note will be set to "completed"', dataFattura: 'Invoice Date', fileFattura: 'Invoice File', caricaPdfFoto: 'Upload PDF or take photo', maxSize: 'PDF, JPG, PNG, WebP — max 10 MB', savingInProgress: 'Saving...', salvaChiudiBolla: 'Save and Close Delivery Note', dettaglio: 'Detail', bollaCollegata: 'Linked delivery note', statusAssociata: 'Matched', statusSenzaBolla: 'No delivery note', colNumFattura: 'Invoice No.', nessunaFatturaRegistrata: 'No invoices registered' },
  archivio: { title: 'Archive', subtitle: 'suppliers', noBills: 'No delivery notes', noInvoices: 'No invoices', withBill: 'With note', noEmail: 'No email', bollaS: 'note', bollaP: 'notes', fatturaS: 'invoice', fatturaP: 'invoices', editLink: 'Edit →', nuova: '+ New', nuovaFattura: '+ Invoice', documento: 'Document', pendingDocCount: '({n} pending)', linkAssociateStatements: 'Match →' },
  impostazioni: { title: 'Settings', subtitle: 'Customize currency and timezone', lingua: 'Language', valuta: 'Currency', fuso: 'Timezone', preview: 'Preview', saved: 'Settings saved — reloading…', sectionLocalisation: 'Localisation', accountSection: 'Account', changeSede: 'Switch branch', addOperatorsPickSede: 'Choose the active branch under Locations first — then you can add operators (name + PIN) here.' },
  log: { title: 'Email Sync Log', subtitle: 'History of emails processed by automatic synchronization.', sender: 'Sender', subject: 'Subject', stato: 'Status', detail: 'Detail', retry: 'Retry', retrying: 'Retrying…', success: 'Success', bollaNotFound: 'Document Received', supplierNotFound: 'Unknown sender', noLogs: 'No logs yet.', emptyHint: 'Run an email sync from the Dashboard.', totalLogs: 'Total logs', linkedInvoices: 'Documents received', withErrors: 'With errors', vediFile: 'View file', supplierSuggested: 'Suggested supplier', aiSuggest: 'AI suggestion', aiSuggestTitle: 'Suggested company data (OCR)', aiSuggestLoading: 'Analyzing…', aiSuggestError: 'Could not analyze the document.', openCreateSupplier: 'Open create supplier', associateRememberHint: 'After saving, the sender email will be linked to this supplier for future syncs.', colAttachment: 'Attachment', colSede: 'Location', colLogId: 'Log ID' },
  sedi: { title: 'Location & Users', titleGlobalAdmin: 'Locations', subtitle: 'Manage your location, email sync and operators', subtitleGlobalAdmin: 'Manage locations, email sync and operators', newSede: 'New Location', noSedi: 'No locations yet. Start by adding the first one.', users: 'Users', imap: 'Email Configuration (IMAP)', imapSubtitle: "Configure this location's email inbox. Invoices received here will be automatically matched to this location's suppliers.", imapHost: 'IMAP Host', imapHostPlaceholder: 'imap.gmail.com', imapPort: 'Port', imapUser: 'Email / Username', imapPassword: 'Password', imapPasswordPlaceholder: 'Password or App Password', testConnection: 'Test connection', saveConfig: 'Save configuration', notConfigured: 'Email not configured', accessDenied: 'Access restricted to administrators', accessDeniedHint: 'Contact your admin to get access.', creatingBtn: 'Creating...', createBtn: 'Create', nomePlaceholder: 'e.g. London Office', nessunUtente: 'No users found.', emailHeader: 'Email', sedeHeader: 'Location', ruoloHeader: 'Role', nessunaSedeOption: '— No location —', operatoreRole: 'Operator', adminRole: 'Management portal', adminSedeRole: 'Branch administrator', profileRoleAdmin: 'Management portal', adminScopedSediHint: 'You only see the location linked to your profile. New locations and the “Unassigned users” section are for the main administrator (admin with no location on profile).', renameTitle: 'Rename', deleteTitle: 'Delete', addOperatorSedeTitle: 'New operator', addOperatorSedeDesc: 'They sign in with name and PIN (min. 4 characters). Email is generated automatically.', operatorDisplayNameLabel: 'Display name', operatorPinMinLabel: 'PIN (min. 4 characters)', operatorNameRequired: 'Enter the operator’s name.', operatorPinTooShort: 'PIN must be at least 4 characters.' },
  statements: {
    heading: 'Monthly Statement Verification',
    tabVerifica: 'Statement',
    tabDocumenti: 'Pending Documents',
    schedaNavDaProcessareDesc: 'Incoming attachments: link suppliers, delivery notes and invoices.',
    schedaNavVerificaDesc: 'Monthly statement check vs delivery notes and invoices.',

    statusOk: 'OK',
    statusFatturaMancante: 'Missing Invoice',
    statusBolleManc: 'Missing Delivery Notes',
    statusErrImporto: 'Amount Mismatch',
    statusRekkiPrezzo: 'Rekki price vs invoice',
    stmtReceived: 'Received Statements',
    stmtClickHint: '— click to see Triple-Check',
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
    gotoFatturaDraft: 'Go to invoice draft →',
    gotoBollaDraft: 'Go to delivery note draft →',
    toggleAddStatement: 'Add to statement',
    toggleRemoveStatement: 'Remove from statement',
    docKindEstratto: 'Statement',
    docKindBolla: 'Delivery note',
    docKindFattura: 'Invoice',
    docKindHintBolla: 'Mark as delivery note (GRN), not a monthly statement or invoice to match',
    docKindHintFattura: 'Mark as invoice to match with pending delivery notes',
    docKindGroupAria: 'Document type',
    finalizeNeedsSupplier: 'Link a supplier to finalize.',
    btnFinalizeFattura: 'Save invoice (no delivery note)',
    btnFinalizeBolla: 'Create delivery note from file',
    btnFinalizeStatement: 'Archive statement',
    btnFinalizing: 'Saving…',
    finalizeSuccess: 'Document saved.',
    noPendingDocs: 'No documents to review',
    noDocsFound: 'No documents found',
    noBolleAttesa: 'No pending delivery notes available',
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
    ocrFormatToggleTitle: 'Force alternate numeric format interpretation',
    allBolleInvoicedOk: 'Every delivery note has a matching invoice — statement verified ✓',
    aiStatementTotalLabel: 'AI-extracted statement total:',
    statementLinkedBolleLine: '{matched}/{total} delivery notes matched',
    selectedSumLabel: 'Selected:',
    selectedBolle_one: '({n} delivery note)',
    selectedBolle_other: '({n} delivery notes)',
    receivedOn: 'Received on',
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
    badgeNeedsHuman: 'Needs match',
    rememberAssociationTitle: 'Remember this sender–supplier link for next time?',
    rememberAssociationSave: 'Save sender email',
    rekkiDocumentLink: 'Rekki',
  },
  appStrings: {
    brandFooter: 'FLUXO · Purchase Management',
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
    imapLookbackLastDays: 'Reads unread mail from the last {n} days',
    imapLookbackUnlimited: 'Reads all unread mail (no date limit)',
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
    noAddressRegistered: 'No address on file',
    noFiscalRegistered: 'No tax data on file',
    clientSince: 'Customer since',
    fromInvoiceBtn: 'From invoice',
    listinoAnalyze: 'Analyse',
    listinoAnalyzing: 'AI analysis…',
    listinoNoInvoicesFile: 'No invoice with an attachment for this supplier.',
    listinoNoProducts: 'No line items found on this invoice. Try another.',
    saveNProducts: 'Save {n} products',
    clickAddFirst: 'Click Add to enter the first product.',
    monthNavResetTitle: 'Jump to current month',
    addingAlias: 'Adding…',
    addEmailAlias: '+ Add email',
    listinoImportPanelTitle: 'Import products from invoice',
    listinoImportSelectInvoiceLabel: 'Select invoice',
    listinoImportProductsSelected: '{selected} / {total} products selected',
    listinoImportPriceListDateLabel: 'Price list date',
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
  },
  login: {
    brandTagline: 'Gestión de facturas',
    subtitle: 'Acceso: tu nombre y PIN de 4 cifras',
    adminSubtitle: 'Portal de gestión',
    adminSubtitleHint:
      'Correo y contraseña para el portal de gestión. Para nombre de operador y PIN, usa «Acceso operador» (admins de sede y operadores).',
    nameLabel: 'Nombre',
    namePlaceholder: 'JUAN',
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
  },
  nav: { dashboard: 'Panel', dashboardAdmin: 'Admin', operatori: 'Operadores', fornitori: 'Proveedores', bolle: 'Albaranes', fatture: 'Facturas', archivio: 'Archivo', logEmail: 'Log Email', sedi: 'Sede y Usuarios', sediTitle: 'Sede', sediNavGroupMaster: 'Sedes', gestisciSedeNamed: 'Gestionar {name}', gestisciSedi: 'Gestionar sedes', tuttiFornitori: 'Todos los proveedores', cerca: 'Buscar…', nessunRisultato: 'Sin resultados', altriRisultati: 'más — busca arriba', impostazioni: 'Configuración', nuovaBolla: 'Nuevo Albarán', ricevuto: 'Recibo', operatorActiveHint: 'Indica quién está operando', esci: 'Cerrar sesión', guida: 'Ayuda', sedeGlobalOverview: 'Vista global', bottomNavBackToSede: 'Volver a la sede', bottomNavScannerAi: 'Escáner IA', bottomNavProfile: 'Perfil', bottomNavSediMap: 'Mapa de sedes', bottomNavGlobalReports: 'Informes globales', bottomNavNewOrder: 'Nuevo pedido', bottomNavPriceHistory: 'Historial de precios', bottomNavContact: 'Contactar', addNewDelivery: 'Nuevo albarán', openRekki: 'Rekki', ariaMain: 'Navegación principal', ariaAdmin: 'Navegación de administrador', ariaFornitore: 'Navegación de proveedor', ariaCallSupplier: 'Llamar al proveedor', notifications: 'Notificaciones', noNotifications: 'Sin notificaciones', errorAlert: 'Errores de sincronización (24h)' },
  common: { save: 'Guardar', cancel: 'Cancelar', delete: 'Eliminar', edit: 'Editar', new: 'Nuevo', loading: 'Cargando...', error: 'Error', success: 'Éxito', noData: 'Sin datos', document: 'Documento', actions: 'Acciones', date: 'Fecha', status: 'Estado', supplier: 'Proveedor', notes: 'Notas', phone: 'Teléfono', saving: 'Guardando...', attachment: 'Adjunto', openAttachment: 'Abrir adjunto', detail: 'Detalle', add: 'Añadir', rename: 'Renombrar', role: 'Rol', aiExtracted: 'Datos extraídos por IA', matched: 'Asociado', notMatched: 'No asociado', recordSupplierLinked: 'Vinculado', company: 'Empresa', invoiceNum: 'N.º Factura', total: 'Total' },
  status: { inAttesa: 'Pendiente', completato: 'Completado', completata: 'Completada' },
  dashboard: { title: 'Panel', subtitle: 'Resumen de compras', suppliers: 'Proveedores', totalBills: 'Total albaranes', pendingBills: 'Albaranes pendientes', invoices: 'Facturas', recentBills: 'Albaranes recientes', viewAll: 'Ver todos →', syncEmail: 'Sincronizar Email', emailSyncScopeLookback: 'Días recientes (sede)', emailSyncScopeFiscal: 'Año fiscal', emailSyncFiscalYearSelectAria: 'Periodo de sincronización de email', emailSyncScopeHint: 'IT, FR, DE, ES: año civil. UK: año fiscal que termina el 5 abr. Cada sede usa su país.', emailSyncLookbackSedeDefault: 'Predeterminado de sede (IMAP)', emailSyncLookbackDaysN: 'Últimos {n} días', emailSyncLookbackDaysAria: 'Cuántos días atrás buscar correo no leído', emailSyncLookbackDaysHint: 'Predeterminado de sede: usa los días configurados en la sede. Si no, limita la búsqueda IMAP a los últimos N días (solo no leídos).', emailSyncDocumentKindAria: 'Tipo de documentos a importar al sincronizar el correo', emailSyncDocumentKindHint: 'Todos: predeterminado. Nuevo proveedor: solo remitentes no dados de alta. Albarán / Factura: fuerza el tipo de borrador. Extracto: solo correos cuyo asunto parece un extracto (statement).', emailSyncDocumentKindAll: 'Todos los documentos', emailSyncDocumentKindFornitore: 'Nuevo proveedor', emailSyncDocumentKindBolla: 'Albarán (DDT)', emailSyncDocumentKindFattura: 'Factura', emailSyncDocumentKindEstratto: 'Extracto de cuenta', syncing: 'Sincronizando...', sendReminders: 'Enviar recordatorios', sending: 'Enviando...', viewLog: 'Ver Log', sedeOverview: 'Resumen por Sede', manageSedeNamed: 'Gestionar {name} →', manageSedi: 'Gestionar sedes →', sedeImapOn: 'Email activa', digitalizzaRicevuto: 'Digitalizar recibo', kpiNoPendingBills: 'No hay albaranes pendientes.', errorCountSuffix: 'errores', manualReceiptLabel: 'Recibido (sin albarán)', manualReceiptPlaceholder: 'p. ej. 5 kg calamares, 2 cajas limones', manualReceiptRegister: 'Registrar entrega', manualReceiptRegistering: 'Registrando…', manualReceiptSaved: 'Entrega registrada.', manualReceiptNeedTextOrPhoto: 'Introduce una descripción o adjunta una foto.', manualReceiptRemovePhoto: 'Quitar foto', manualReceiptNeedSupplier: 'Selecciona un proveedor.', manualReceiptRegisterFailed: 'No se pudo registrar.', manualReceiptEmailSupplierLabel: 'Enviar email al proveedor para pedir el pedido y el albarán (DDT)', manualReceiptEmailSupplierHint: 'Añade el email del proveedor en su ficha.', manualReceiptEmailSent: 'Email de solicitud enviado al proveedor.', manualReceiptEmailFailed: 'Entrega guardada, pero no se pudo enviar el email.', manualReceiptEmailDescPhotoOnly: 'Foto adjunta al registro de entrega (sin texto).', adminGlobalTitle: 'Panel global', adminGlobalSubtitle: 'Resumen de todas las sedes. Elige una filial en el menú o en la tarjeta para la vista operativa.', adminGlobalTotalsLabel: 'Totales de la red', adminOpenBranchDashboard: 'Vista operativa', adminSedeSettingsLink: 'Ficha sede', adminDocQueueShort: 'En cola', rekkiOrder: 'Pedir en Rekki', manualDeliveryNeedSede: 'Selecciona un operador activo o asegúrate de que tu perfil esté vinculado a una sede para registrar una entrega.', kpiPriceListSub: 'líneas en el listino', listinoOverviewHint: 'Líneas de listín de precios de los proveedores en tu ámbito. Abre un proveedor para editar o importar desde factura.', listinoOverviewEmpty: 'Sin líneas de listín en este ámbito.', listinoOverviewOpenSupplier: 'Abrir proveedor →', listinoOverviewLimitNote: 'Mostrando las últimas {n} filas.', fattureRiepilogoTitle: 'Total facturas', fattureRiepilogoHint: 'Suma de importes en tu ámbito. La tabla muestra las últimas facturas por fecha; abre una para el adjunto y enlaces.', fattureRiepilogoEmpty: 'No hay facturas en este ámbito.', fattureRiepilogoLimitNote: 'Mostrando las últimas {n} facturas (por fecha).', fattureRiepilogoOpenInvoice: 'Abrir factura →', fattureRiepilogoCountLabel: '{n} facturas', fattureRiepilogoLinkAll: 'Todas las facturas →', kpiStatementNone: 'Sin extractos', kpiStatementAllOk: 'Sin anomalías', kpiStatementIssuesFooter: 'de {t} extractos revisados', kpiFornitoriSub: 'Directorio y búsqueda', kpiDaProcessareSub: 'documentos en cola', operatorNoSede: 'Tu perfil no tiene sede asignada. Pide a un administrador que te vincule a la filial correcta.', suggestedSupplierBanner: 'Nuevo proveedor detectado: {name}. ¿Añadirlo?', suggestedSupplierAdd: 'Nuevo proveedor', suggestedSupplierImport: 'Importar desde OCR', enterAsSede: 'Entrar como sede', syncHealthAlert: 'Problema de sincronización (IMAP u OCR)', syncHealthOcrCount: 'Fallos OCR (48h): {n}', viewingAsSedeBanner: 'Estás viendo el panel como:', exitSedeView: 'Volver a vista admin', emailSyncQueued: 'En cola — otra sincronización está terminando…', emailSyncPhaseConnect: 'Conectando…', emailSyncConnectToServer: 'Conexión al servidor IMAP (red, cifrado, acceso)…', emailSyncConnectOpeningMailbox: 'Abriendo la carpeta Bandeja de entrada…', emailSyncPhaseSearch: 'Escaneando textos…', emailSyncPhaseProcess: 'Análisis de adjuntos con Vision IA…', emailSyncPhasePersist: 'Guardando en la base de datos…', emailSyncPhaseDone: 'Sincronización completada.', emailSyncStalled: 'Sin novedades — con muchos adjuntos la visión puede tardar varios minutos. Espera…', emailSyncStalledHint: 'Solo indica que el flujo no envía novedades (normal con OCR largo). Los reintentos reales de IMAP aparecen arriba en rojo en la fase de conexión.', emailSyncImapRetryLine: 'Conexión IMAP: intento {current} de {max}', emailSyncCountsHint: 'Encontradas · nuevas en app · procesadas · unidades PDF/texto', emailSyncMailboxGlobal: 'Bandeja IMAP global (variables de entorno)', emailSyncMailboxSede: 'Bandeja: {name}', emailSyncSupplierFilterLine: 'Filtro proveedor: {name}', emailSyncStatFoundLine: 'Encontradas en el buzón: {found}', emailSyncStatImportedLine: 'Nuevas en la app (documentos importados): {imported}', emailSyncStatProcessedLine: 'Correos procesados (leídos y analizados): {processed}', emailSyncStatIgnoredLine: 'Omitidas o sin resultado: {ignored}', emailSyncStatDraftsLine: 'Borradores de albarán creados: {drafts}', emailSyncStatAlreadyLine: 'Ya procesadas en una sincronización anterior (sin importar de nuevo): {n}', emailSyncStatUnitsLine: 'Unidades a analizar (adjuntos PDF/imagen o cuerpo largo): {done} / {total}', emailSyncStripDetailsExpandAria: 'Mostrar detalles de sincronización de correo', emailSyncStripDetailsCollapseAria: 'Ocultar detalles de sincronización de correo', emailSyncStop: 'Detener', emailSyncStopAria: 'Detener sincronización de correo', emailSyncDismiss: 'Cerrar', emailSyncDismissAria: 'Cerrar resumen de sincronización de correo', potentialSupplierFromEmailBodyBanner: 'Posible proveedor (texto del correo): {name}. ¿Asociarlo?', potentialSupplierFromEmailBodyCta: 'Abrir nuevo proveedor' },
  fornitori: { title: 'Proveedores', new: 'Nuevo Proveedor', nome: 'Nombre / Empresa', email: 'Email', piva: 'NIF/CIF', noSuppliers: 'Sin proveedores.', addFirst: 'Añadir el primero →', editTitle: 'Editar Proveedor', saveChanges: 'Guardar Cambios', notFound: 'Proveedor no encontrado.', deleteConfirm: '¿Eliminar este proveedor? También se eliminarán todos los albaranes y facturas vinculados.', importaDaFattura: 'Importar de Factura', countLabel: 'proveedores registrados', namePlaceholder: 'Ej. Empresa S.L.', emailPlaceholder: 'proveedor@ejemplo.com', pivaLabel: 'NIF/CIF', pivaPlaceholder: 'A12345678', addressLabel: 'Dirección (opc.)', addressPlaceholder: 'Calle, CP, ciudad', rekkiLinkLabel: 'Enlace Rekki (opc.)', rekkiLinkPlaceholder: 'https://…', rekkiIdLabel: 'ID Rekki (opc.)', rekkiIdPlaceholder: 'ej. ID proveedor en Rekki', rekkiIntegrationTitle: 'Integración Rekki', rekkiLookupByVat: 'Buscar en Rekki (IVA)', rekkiSaveRekkiMapping: 'Guardar enlace Rekki', rekkiConnectedBadge: 'Rekki', rekkiCachedListBanner: 'Datos en caché (sin conexión).', rekkiLookupNeedVat: 'Añade el NIF/CIF del proveedor para buscar en Rekki.', rekkiIdExtractedFromLink: 'ID de proveedor extraído del enlace Rekki.', rekkiAutoLinkedSingle: 'Solo un proveedor Rekki coincide con este NIF/CIF — enlace guardado.', saving: 'Guardando...', tabRiepilogo: 'Resumen', tabListino: 'Lista de Precios', tabStrategyConto: 'Extracto', kpiBolleTotal: 'Total albaranes', kpiFatture: 'Facturas recibidas', kpiPending: 'Documentos pendientes', kpiReconciliation: 'Conciliación', subAperte: 'abiertos', subConfermate: 'confirmadas', subDaAbbinare: 'por asociar', subChiuse: 'albaranes cerrados', subListinoRows: 'líneas de lista en el período', subStatementsNoneInMonth: 'ninguno este mes', subStatementsAllVerified: 'todos verificados OK', subStatementsWithIssues: 'con incidencias', helpText: 'Ve a la pestaña <b>Extracto</b> para asociar documentos y albaranes, o a <b>Albaranes</b> y <b>Facturas</b> para ver el historial completo.', listinoSetupTitle: 'Tabla de precios no creada aún', listinoSetupSubtitle: 'Activa el seguimiento de precios por producto en 2 clics:', listinoSetupStep1: 'Haz clic en <strong class="font-bold text-slate-100">"Copiar SQL"</strong> abajo', listinoSetupStep2: 'Abre el <a href="https://supabase.com/dashboard/project/dubocvwsdzrqrrxsedas/sql/new" target="_blank" rel="noopener noreferrer" class="font-semibold text-amber-200 underline decoration-amber-200/50 transition-colors hover:text-slate-100">SQL Editor ↗</a>, pega y haz clic en <strong class="font-bold text-slate-100">"Run"</strong>', listinoSetupShowSQL: 'Ver SQL completo ▸', listinoCopySQL: 'Copiar SQL', listinoCopied: '¡Copiado!', listinoProdotti: 'Lista de Precios', listinoProdottiTracked: 'productos seguidos', listinoNoData: 'Sin precios de producto registrados', listinoNoDataHint: 'Introduce los precios directamente en la tabla <code class="font-mono text-slate-300">listino_prezzi</code> en Supabase.', listinoTotale: 'Total gastado', listinoDaBolle: 'De albaranes', listinoDaFatture: 'De facturas', listinoStorico: 'Historial de documentos', listinoDocs: 'documentos', listinoNoDocs: 'Sin documentos con importe registrado', listinoColData: 'Fecha', listinoColTipo: 'Tipo', listinoColNumero: 'Número', listinoColImporto: 'Importe', listinoColTotale: 'Total', preferredLanguageEmail: 'Idioma preferido (para correos)', languageInheritSede: '— Heredar de la sede —', recognizedEmailsTitle: 'Correos reconocidos', recognizedEmailsHint: 'Direcciones adicionales desde las que este proveedor puede enviar documentos. El escaneo de correo las empareja automáticamente.', recognizedEmailPlaceholder: 'ej. facturas@proveedor.es', recognizedEmailLabelOptional: 'Etiqueta (opc.)', displayNameLabel: 'Nombre corto (lista y barra)', displayNameHint: 'Opcional. Si lo rellenas, se usa en la barra inferior en móvil y en listas compactas en lugar del nombre completo.', displayNamePlaceholder: 'ej. Amalfi', loadingProfile: 'Cargando ficha, documentos y resumen del proveedor…', logoUrlLabel: 'Logo del proveedor (URL)', logoUrlPlaceholder: 'https://ejemplo.com/logo.png', logoUrlHint: 'Imagen HTTPS (PNG, JPG o SVG). Si no carga, se muestran las iniciales.', syncEmailNeedSede: 'Asigna una sede al proveedor para sincronizar el correo.' },
  bolle: { title: 'Albaranes', new: 'Nuevo Albarán', uploadInvoice: 'Subir Factura', viewDocument: 'Ver Documento', noBills: 'Sin albaranes.', addFirst: 'Registrar el primero →', deleteConfirm: '¿Eliminar este albarán? También se eliminarán las facturas vinculadas.', ocrScanning: 'Reconociendo proveedor…', ocrMatched: 'Proveedor reconocido', ocrNotFound: 'Seleccionar proveedor manualmente', ocrAnalyzing: 'Analizando…', ocrAutoRecognized: 'Reconocido automáticamente', ocrRead: 'Leído:', selectManually: 'Seleccionar proveedor', saveNote: 'Guardar Albarán', savingNote: 'Guardando…', analyzingNote: 'Analizando documento…', takePhotoOrFile: 'Tomar foto o elegir archivo', ocrHint: 'El proveedor se reconocerá automáticamente', cameraBtn: 'Cámara', fileBtn: 'Elegir archivo', countSingolo: 'albarán registrado', countPlural: 'albaranes registrados', countTodaySingolo: 'albarán hoy', countTodayPlural: 'albaranes hoy', noBillsToday: 'Sin albaranes para hoy.', listShowAll: 'Todos los albaranes', listShowToday: 'Solo hoy', listAllPending: 'Solo pendientes', fotoLabel: 'Foto / Archivo Albarán', fornitoreLabel: 'Proveedor', dataLabel: 'Fecha Albarán', dettaglio: 'Detalle Albarán', fattureCollegate: 'Facturas vinculadas', aggiungi: '+ Añadir', nessunaFatturaCollegata: 'Sin facturas vinculadas.', allegatoLink: 'Adjunto →', statoCompletato: 'Completado', statoInAttesa: 'En espera', apri: 'Abrir', colNumero: 'Número', colAttachmentKind: 'Adjunto', attachmentKindPdf: 'PDF', attachmentKindImage: 'Imagen', attachmentKindOther: 'Archivo', nessunaBollaRegistrata: 'Sin albaranes registrados', creaLaPrimaBolla: 'Crear el primer albarán →', vediDocumento: 'Ver documento', dateFromDocumentHint: 'Del documento', prezzoDaApp: 'Precio de la app', verificaPrezzoFornitore: 'Verificar precio del proveedor', rekkiPrezzoIndicativoBadge: '⚠️ Precio orientativo de la app Rekki', listinoRekkiRefTitle: 'Lista de precios de referencia (Rekki)', listinoRekkiRefHint: 'Con ID Rekki en el proveedor, compara el total del albarán con los últimos precios importados.', listinoRekkiRefEmpty: 'Sin líneas de listino para este proveedor.', scannerTitle: 'Escáner IA', scannerWhatLabel: '¿Qué estás subiendo?', scannerModeAuto: 'Detección automática', scannerModeBolla: 'Albarán / DDT', scannerModeFattura: 'Factura', scannerModeSupplier: 'Nuevo proveedor', scannerFlowBolla: 'Registro de albarán', scannerFlowFattura: 'Registro de factura', scannerSaveFattura: 'Guardar factura', scannerSavingFattura: 'Guardando factura…', scannerCreateSupplierCta: 'Crear proveedor con datos leídos', scannerCreateSupplierFromUnrecognized: 'Crear proveedor desde este documento', scannerPdfPreview: 'PDF adjunto — vista previa no disponible' },
  fatture: { title: 'Facturas', new: 'Nueva Factura', noInvoices: 'Sin facturas.', addFirst: 'Añadir la primera →', invoice: 'Factura', openBill: 'Abrir albarán →', deleteConfirm: '¿Eliminar esta factura? La operación es irreversible.', countLabel: 'facturas recibidas', headerBolla: 'Albarán', headerAllegato: 'Adjunto', apri: 'Abrir →', caricaFatturaTitle: 'Subir Factura', bollaMarkata: 'El albarán se marcará como completado', collegataABolla: 'Vinculada a un albarán', bollaPasseraCompletato: 'Al guardar el albarán pasará a "completado"', dataFattura: 'Fecha Factura', fileFattura: 'Archivo Factura', caricaPdfFoto: 'Subir PDF o tomar foto', maxSize: 'PDF, JPG, PNG, WebP — máx 10 MB', savingInProgress: 'Guardando...', salvaChiudiBolla: 'Guardar y Cerrar Albarán', dettaglio: 'Detalle', bollaCollegata: 'Albarán vinculado', statusAssociata: 'Asociada', statusSenzaBolla: 'Sin albarán', colNumFattura: 'N.º Factura', nessunaFatturaRegistrata: 'Sin facturas registradas' },
  archivio: { title: 'Archivo', subtitle: 'proveedores', noBills: 'Sin albaranes', noInvoices: 'Sin facturas', withBill: 'Con albarán', noEmail: 'Sin email', bollaS: 'albarán', bollaP: 'albaranes', fatturaS: 'factura', fatturaP: 'facturas', editLink: 'Editar →', nuova: '+ Nuevo', nuovaFattura: '+ Factura', documento: 'Documento', pendingDocCount: '({n} en cola)', linkAssociateStatements: 'Asociar →' },
  impostazioni: { title: 'Configuración', subtitle: 'Personalizar moneda y zona horaria', lingua: 'Idioma', valuta: 'Moneda', fuso: 'Zona horaria', preview: 'Vista previa', saved: 'Configuración guardada — actualizando…', sectionLocalisation: 'Localización', accountSection: 'Cuenta', changeSede: 'Cambiar sede', addOperatorsPickSede: 'Elige la sede activa en Sedes — luego podrás crear operadores (nombre + PIN) aquí.' },
  log: { title: 'Log Sincronización Email', subtitle: 'Historial de emails procesados por la sincronización automática.', sender: 'Remitente', subject: 'Asunto', stato: 'Estado', detail: 'Detalle', retry: 'Reintentar', retrying: 'Reintentando…', success: 'Éxito', bollaNotFound: 'Documento Recibido', supplierNotFound: 'Remitente desconocido', noLogs: 'Sin logs.', emptyHint: 'Ejecuta una sincronización de email desde el Panel.', totalLogs: 'Total logs', linkedInvoices: 'Documentos recibidos', withErrors: 'Con errores', vediFile: 'Ver archivo', supplierSuggested: 'Proveedor sugerido', aiSuggest: 'Sugerencia IA', aiSuggestTitle: 'Datos sugeridos (OCR)', aiSuggestLoading: 'Analizando…', aiSuggestError: 'No se pudo analizar el documento.', openCreateSupplier: 'Abrir alta de proveedor', associateRememberHint: 'Tras guardar, el email del remitente quedará vinculado para futuras sincronizaciones.', colAttachment: 'Adjunto', colSede: 'Sede', colLogId: 'ID log' },
  sedi: { title: 'Sede y Usuarios', titleGlobalAdmin: 'Sedes', subtitle: 'Gestionar la sede, la sincronización de email y los operadores', subtitleGlobalAdmin: 'Gestionar las sedes, la sincronización de email y los operadores', newSede: 'Nueva Sede', noSedi: 'Sin sedes. Empieza añadiendo la primera.', users: 'Usuarios', imap: 'Configuración Email (IMAP)', imapSubtitle: 'Configura el buzón de esta sede. Las facturas recibidas aquí se asociarán automáticamente a los proveedores de la sede.', imapHost: 'Host IMAP', imapHostPlaceholder: 'imap.gmail.com', imapPort: 'Puerto', imapUser: 'Email / Usuario', imapPassword: 'Contraseña', imapPasswordPlaceholder: 'Contraseña o Contraseña de aplicación', testConnection: 'Probar conexión', saveConfig: 'Guardar configuración', notConfigured: 'Email no configurado', accessDenied: 'Acceso restringido a administradores', accessDeniedHint: 'Contacta al admin para obtener acceso.', creatingBtn: 'Creando...', createBtn: 'Crear', nomePlaceholder: 'Ej. Oficina Madrid', nessunUtente: 'No se encontraron usuarios.', emailHeader: 'Email', sedeHeader: 'Sede', ruoloHeader: 'Rol', nessunaSedeOption: '— Sin sede —', operatoreRole: 'Operador', adminRole: 'Portal de gestión', adminSedeRole: 'Administrador de sede', profileRoleAdmin: 'Portal de gestión', adminScopedSediHint: 'Solo ves la sede vinculada a tu perfil. Las sedes nuevas y «Usuarios sin sede» los gestiona el administrador principal (admin sin sede en el perfil).', renameTitle: 'Renombrar', deleteTitle: 'Eliminar', addOperatorSedeTitle: 'Nuevo operador', addOperatorSedeDesc: 'Accede con nombre y PIN (mín. 4 caracteres). El email se genera automáticamente.', operatorDisplayNameLabel: 'Nombre mostrado', operatorPinMinLabel: 'PIN (mín. 4 caracteres)', operatorNameRequired: 'Introduce el nombre del operador.', operatorPinTooShort: 'El PIN debe tener al menos 4 caracteres.' },
  statements: {
    heading: 'Verificación de Extractos Mensuales',
    tabVerifica: 'Estado de cuenta',
    tabDocumenti: 'Pendiente de procesar',
    schedaNavDaProcessareDesc: 'Adjuntos entrantes: vincula proveedores, albaranes y facturas.',
    schedaNavVerificaDesc: 'Revisión mensual del extracto frente a albaranes y facturas.',
    statusOk: 'OK',
    statusFatturaMancante: 'Factura faltante',
    statusBolleManc: 'Albaranes faltantes',
    statusErrImporto: 'Error de importe',
    statusRekkiPrezzo: 'Precio Rekki vs factura',
    stmtReceived: 'Extractos recibidos',
    stmtClickHint: '— clic para ver el Triple-Check',
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
    gotoFatturaDraft: 'Ir al borrador de factura →',
    gotoBollaDraft: 'Ir al borrador de albarán →',
    toggleAddStatement: 'Añadir al extracto',
    toggleRemoveStatement: 'Quitar del extracto',
    docKindEstratto: 'Extracto',
    docKindBolla: 'Albarán',
    docKindFattura: 'Factura',
    docKindHintBolla: 'Marcar como albarán de entrega, no extracto ni factura a cruzar',
    docKindHintFattura: 'Marcar como factura para asociar con albaranes pendientes',
    docKindGroupAria: 'Tipo de documento',
    finalizeNeedsSupplier: 'Vincula un proveedor para finalizar.',
    btnFinalizeFattura: 'Registrar factura (sin albarán)',
    btnFinalizeBolla: 'Crear albarán desde el archivo',
    btnFinalizeStatement: 'Archivar extracto',
    btnFinalizing: 'Guardando…',
    finalizeSuccess: 'Documento registrado.',
    noPendingDocs: 'No hay documentos para revisar',
    noDocsFound: 'No se encontraron documentos',
    noBolleAttesa: 'No hay albaranes pendientes disponibles',
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
    ocrFormatToggleTitle: 'Forzar interpretación numérica alternativa',
    allBolleInvoicedOk: 'Todos los albaranes tienen factura correspondiente — extracto verificado ✓',
    aiStatementTotalLabel: 'Total del extracto (IA):',
    statementLinkedBolleLine: '{matched}/{total} albaranes asociados',
    selectedSumLabel: 'Seleccionadas:',
    selectedBolle_one: '({n} albarán)',
    selectedBolle_other: '({n} albaranes)',
    receivedOn: 'Recibido el',
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
    badgeNeedsHuman: 'Requiere asociación',
    rememberAssociationTitle: '¿Recordar esta asociación remitente–proveedor?',
    rememberAssociationSave: 'Guardar email del remitente',
    rekkiDocumentLink: 'Rekki',
  },
  appStrings: {
    brandFooter: 'FLUXO · Gestión de compras',
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
    imapLookbackLastDays: 'Lee correo no leído de los últimos {n} días',
    imapLookbackUnlimited: 'Lee todo el correo no leído (sin límite)',
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
    noAddressRegistered: 'Sin dirección registrada',
    noFiscalRegistered: 'Sin datos fiscales',
    clientSince: 'Cliente desde',
    fromInvoiceBtn: 'Desde factura',
    listinoAnalyze: 'Analizar',
    listinoAnalyzing: 'Análisis con IA…',
    listinoNoInvoicesFile: 'Ninguna factura con archivo adjunto para este proveedor.',
    listinoNoProducts: 'No se encontraron líneas en esta factura. Prueba otra.',
    saveNProducts: 'Guardar {n} productos',
    clickAddFirst: 'Pulsa Añadir para introducir el primer producto.',
    monthNavResetTitle: 'Ir al mes actual',
    addingAlias: 'Añadiendo…',
    addEmailAlias: '+ Añadir email',
    listinoImportPanelTitle: 'Importar productos desde factura',
    listinoImportSelectInvoiceLabel: 'Seleccionar factura',
    listinoImportProductsSelected: '{selected} / {total} productos seleccionados',
    listinoImportPriceListDateLabel: 'Fecha del tarifario',
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
  },
  login: {
    brandTagline: 'Gestion des factures',
    subtitle: 'Accès : votre nom et code à 4 chiffres',
    adminSubtitle: 'Portail de gestion',
    adminSubtitleHint:
      'E-mail et mot de passe pour le portail de gestion. Pour le nom d’opérateur et le PIN, utilisez « Accès opérateur » (admins de site et opérateurs).',
    nameLabel: 'Nom',
    namePlaceholder: 'JEAN',
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
  },
  nav: { dashboard: 'Tableau de bord', dashboardAdmin: 'Admin', operatori: 'Opérateurs', fornitori: 'Fournisseurs', bolle: 'Bons de livraison', fatture: 'Factures', archivio: 'Archive', logEmail: 'Log Email', sedi: 'Site et Utilisateurs', sediTitle: 'Site', sediNavGroupMaster: 'Sites', gestisciSedeNamed: 'Gérer {name}', gestisciSedi: 'Gérer les sites', tuttiFornitori: 'Tous les fournisseurs', cerca: 'Rechercher…', nessunRisultato: 'Aucun résultat', altriRisultati: 'de plus — cherchez ci-dessus', impostazioni: 'Paramètres', nuovaBolla: 'Nouveau BL', ricevuto: 'Reçu', operatorActiveHint: 'Indiquez qui est actif', esci: 'Déconnexion', guida: 'Aide', sedeGlobalOverview: 'Vue globale', bottomNavBackToSede: 'Retour au site', bottomNavScannerAi: 'Scanner IA', bottomNavProfile: 'Profil', bottomNavSediMap: 'Carte des sites', bottomNavGlobalReports: 'Rapports globaux', bottomNavNewOrder: 'Nouvelle commande', bottomNavPriceHistory: 'Historique des prix', bottomNavContact: 'Contacter', addNewDelivery: 'Nouveau BL', openRekki: 'Rekki', ariaMain: 'Navigation principale', ariaAdmin: 'Navigation administrateur', ariaFornitore: 'Navigation fournisseur', ariaCallSupplier: 'Appeler le fournisseur', notifications: 'Notifications', noNotifications: 'Aucune notification', errorAlert: 'Erreurs de synchro (24h)' },
  common: { save: 'Enregistrer', cancel: 'Annuler', delete: 'Supprimer', edit: 'Modifier', new: 'Nouveau', loading: 'Chargement...', error: 'Erreur', success: 'Succès', noData: 'Aucune donnée', document: 'Document', actions: 'Actions', date: 'Date', status: 'Statut', supplier: 'Fournisseur', notes: 'Notes', phone: 'Téléphone', saving: 'Enregistrement...', attachment: 'Pièce jointe', openAttachment: 'Ouvrir la pièce jointe', detail: 'Détail', add: 'Ajouter', rename: 'Renommer', role: 'Rôle', aiExtracted: 'Données extraites par IA', matched: 'Associé', notMatched: 'Non associé', recordSupplierLinked: 'Lié', company: 'Société', invoiceNum: 'N° Facture', total: 'Total' },
  status: { inAttesa: 'En attente', completato: 'Complété', completata: 'Complétée' },
  dashboard: { title: 'Tableau de bord', subtitle: 'Aperçu des achats', suppliers: 'Fournisseurs', totalBills: 'Total BL', pendingBills: 'BL en attente', invoices: 'Factures', recentBills: 'BL récents', viewAll: 'Voir tout →', syncEmail: 'Sync Email', emailSyncScopeLookback: 'Jours récents (site)', emailSyncScopeFiscal: 'Exercice fiscal', emailSyncFiscalYearSelectAria: 'Période de synchronisation e-mail', emailSyncScopeHint: 'IT, FR, DE, ES : année civile. UK : exercice se terminant le 5 avr. Chaque site utilise son pays.', emailSyncLookbackSedeDefault: 'Défaut du site (IMAP)', emailSyncLookbackDaysN: '{n} derniers jours', emailSyncLookbackDaysAria: 'Combien de jours en arrière chercher les e-mails non lus', emailSyncLookbackDaysHint: 'Défaut du site : utilise les jours définis sur la fiche site. Sinon limite la recherche IMAP aux N derniers jours (non lus uniquement).', emailSyncDocumentKindAria: 'Type de documents à importer lors de la synchro e-mail', emailSyncDocumentKindHint: 'Tout : défaut. Nouveau fournisseur : expéditeurs absents de l’annuaire. BL / Facture : force le type de brouillon. Relevé : e-mails dont l’objet ressemble à un relevé (statement).', emailSyncDocumentKindAll: 'Tous les documents', emailSyncDocumentKindFornitore: 'Nouveau fournisseur', emailSyncDocumentKindBolla: 'Bon de livraison (BL)', emailSyncDocumentKindFattura: 'Facture', emailSyncDocumentKindEstratto: 'Relevé / extrait', syncing: 'Synchronisation...', sendReminders: 'Envoyer les relances', sending: 'Envoi en cours...', viewLog: 'Voir Log', sedeOverview: 'Vue par Site', manageSedeNamed: 'Gérer {name} →', manageSedi: 'Gérer les sites →', sedeImapOn: 'E-mail active', digitalizzaRicevuto: 'Numériser le reçu', kpiNoPendingBills: 'Aucun BL en attente.', errorCountSuffix: 'erreurs', manualReceiptLabel: 'Reçu (sans bon de livraison)', manualReceiptPlaceholder: 'ex. 5 kg calamars, 2 caisses citrons', manualReceiptRegister: 'Enregistrer la livraison', manualReceiptRegistering: 'Enregistrement…', manualReceiptSaved: 'Livraison enregistrée.', manualReceiptNeedTextOrPhoto: 'Saisissez une description ou ajoutez une photo.', manualReceiptRemovePhoto: 'Retirer la photo', manualReceiptNeedSupplier: 'Sélectionnez un fournisseur.', manualReceiptRegisterFailed: 'Enregistrement impossible.', manualReceiptEmailSupplierLabel: 'Envoyer un e-mail au fournisseur pour demander le bon de commande et le BL', manualReceiptEmailSupplierHint: 'Ajoutez l’e-mail du fournisseur sur sa fiche.', manualReceiptEmailSent: 'E-mail de demande envoyé au fournisseur.', manualReceiptEmailFailed: 'Réception enregistrée, mais l’e-mail n’a pas pu être envoyé.', manualReceiptEmailDescPhotoOnly: 'Photo jointe à l’enregistrement du reçu (sans texte).', adminGlobalTitle: 'Tableau global', adminGlobalSubtitle: 'Synthèse de tous les sites. Choisissez une filiale dans le menu ou sur la carte pour la vue opérationnelle.', adminGlobalTotalsLabel: 'Totaux réseau', adminOpenBranchDashboard: 'Vue opérationnelle', adminSedeSettingsLink: 'Fiche site', adminDocQueueShort: 'En file', rekkiOrder: 'Commander sur Rekki', manualDeliveryNeedSede: 'Sélectionnez un opérateur actif ou assurez-vous que votre profil est rattaché à un site pour enregistrer une livraison.', kpiPriceListSub: 'lignes au tarif', listinoOverviewHint: 'Lignes de tarifs des fournisseurs visibles. Ouvrez une fiche fournisseur pour modifier ou importer depuis une facture.', listinoOverviewEmpty: 'Aucune ligne tarif dans ce périmètre.', listinoOverviewOpenSupplier: 'Ouvrir le fournisseur →', listinoOverviewLimitNote: 'Affichage des {n} dernières lignes.', fattureRiepilogoTitle: 'Total factures', fattureRiepilogoHint: 'Somme des montants dans votre périmètre. Le tableau liste les dernières factures par date; ouvrez une fiche pour la pièce jointe et les liens.', fattureRiepilogoEmpty: 'Aucune facture dans ce périmètre.', fattureRiepilogoLimitNote: 'Affichage des {n} dernières factures (par date).', fattureRiepilogoOpenInvoice: 'Ouvrir la facture →', fattureRiepilogoCountLabel: '{n} factures', fattureRiepilogoLinkAll: 'Toutes les factures →', kpiStatementNone: 'Aucun relevé', kpiStatementAllOk: 'Aucune anomalie', kpiStatementIssuesFooter: 'sur {t} relevés vérifiés', kpiFornitoriSub: 'Annuaire et recherche', kpiDaProcessareSub: 'documents en attente', operatorNoSede: 'Aucun site n’est lié à votre profil. Demandez à un administrateur de vous affecter à la bonne filiale.', suggestedSupplierBanner: 'Nouveau fournisseur détecté : {name}. L’ajouter ?', suggestedSupplierAdd: 'Nouveau fournisseur', suggestedSupplierImport: 'Importer depuis OCR', enterAsSede: 'Entrer comme site', syncHealthAlert: 'Problème de synchronisation (IMAP ou OCR)', syncHealthOcrCount: 'Échecs OCR (48h) : {n}', viewingAsSedeBanner: 'Vous consultez le tableau de bord comme :', exitSedeView: 'Retour vue admin', emailSyncQueued: 'En file — une autre synchronisation se termine…', emailSyncPhaseConnect: 'Connexion…', emailSyncConnectToServer: 'Connexion au serveur IMAP (réseau, chiffrement, authentification)…', emailSyncConnectOpeningMailbox: 'Ouverture du dossier Boîte de réception…', emailSyncPhaseSearch: 'Analyse des textes…', emailSyncPhaseProcess: 'Analyse des pièces jointes (Vision IA)…', emailSyncPhasePersist: 'Enregistrement en base…', emailSyncPhaseDone: 'Synchronisation terminée.', emailSyncStalled: 'Pas de nouvelles — avec beaucoup de pièces jointes, la Vision peut prendre plusieurs minutes. Patience…', emailSyncStalledHint: 'Cela signifie seulement qu’aucune mise à jour du flux n’arrive (fréquent pendant un OCR long). Les vraies tentatives IMAP s’affichent en rouge ci-dessus pendant la phase de connexion.', emailSyncImapRetryLine: 'Connexion IMAP : tentative {current} sur {max}', emailSyncCountsHint: 'Trouvées · nouveaux dans l’app · traités · unités PDF/texte', emailSyncMailboxGlobal: 'Boîte IMAP globale (variables d\'environnement)', emailSyncMailboxSede: 'Boîte : {name}', emailSyncSupplierFilterLine: 'Filtre fournisseur : {name}', emailSyncStatFoundLine: 'Trouvées en boîte : {found}', emailSyncStatImportedLine: 'Nouveaux dans l’app (documents importés) : {imported}', emailSyncStatProcessedLine: 'E-mails traités (lus et analysés) : {processed}', emailSyncStatIgnoredLine: 'Ignorés ou sans résultat : {ignored}', emailSyncStatDraftsLine: 'Brouillons de BL créés : {drafts}', emailSyncStatAlreadyLine: 'Déjà traitées lors d’une synchro précédente (pas réimportées) : {n}', emailSyncStatUnitsLine: 'Unités à analyser (pièces PDF/image ou corps de mail éligible) : {done} / {total}', emailSyncStripDetailsExpandAria: 'Afficher les détails de la synchronisation e-mail', emailSyncStripDetailsCollapseAria: 'Masquer les détails de la synchronisation e-mail', emailSyncStop: 'Arrêter', emailSyncStopAria: 'Interrompre la synchronisation e-mail', emailSyncDismiss: 'Fermer', emailSyncDismissAria: 'Fermer le récapitulatif de synchronisation e-mail', potentialSupplierFromEmailBodyBanner: 'Fournisseur potentiel (texte e-mail) : {name}. L’associer ?', potentialSupplierFromEmailBodyCta: 'Ouvrir nouveau fournisseur' },
  fornitori: { title: 'Fournisseurs', new: 'Nouveau Fournisseur', nome: 'Nom / Société', email: 'Email', piva: 'N° TVA', noSuppliers: 'Aucun fournisseur.', addFirst: 'Ajouter le premier →', editTitle: 'Modifier Fournisseur', saveChanges: 'Enregistrer', notFound: 'Fournisseur introuvable.', deleteConfirm: 'Supprimer ce fournisseur ? Tous les BL et factures liés seront supprimés.', importaDaFattura: 'Importer depuis Facture', countLabel: 'fournisseurs enregistrés', namePlaceholder: 'Ex. Dupont & Fils SARL', emailPlaceholder: 'fournisseur@exemple.fr', pivaLabel: 'N° TVA', pivaPlaceholder: 'FR12345678901', addressLabel: 'Adresse (facultatif)', addressPlaceholder: 'Rue, CP, ville', rekkiLinkLabel: 'Lien Rekki (facultatif)', rekkiLinkPlaceholder: 'https://…', rekkiIdLabel: 'ID Rekki (facultatif)', rekkiIdPlaceholder: 'ex. ID fournisseur sur Rekki', rekkiIntegrationTitle: 'Intégration Rekki', rekkiLookupByVat: 'Rechercher Rekki (TVA)', rekkiSaveRekkiMapping: 'Enregistrer le lien Rekki', rekkiConnectedBadge: 'Rekki', rekkiCachedListBanner: 'Données en cache (hors ligne).', rekkiLookupNeedVat: 'Ajoutez le numéro de TVA du fournisseur pour rechercher sur Rekki.', rekkiIdExtractedFromLink: 'ID fournisseur extrait du lien Rekki.', rekkiAutoLinkedSingle: 'Un seul fournisseur Rekki correspond à cette TVA — lien enregistré.', saving: 'Enregistrement...', tabRiepilogo: 'Résumé', tabListino: 'Tarifs', tabStrategyConto: 'Relevé', kpiBolleTotal: 'Total BL', kpiFatture: 'Factures reçues', kpiPending: 'Documents en attente', kpiReconciliation: 'Rapprochement', subAperte: 'ouverts', subConfermate: 'confirmées', subDaAbbinare: 'à associer', subChiuse: 'BL clôturés', subListinoRows: 'lignes au tarif', subStatementsNoneInMonth: 'aucun ce mois-ci', subStatementsAllVerified: 'tous vérifiés OK', subStatementsWithIssues: 'avec anomalies', helpText: 'Allez dans l\'onglet <b>Relevé</b> pour associer documents et BL, ou dans <b>BL</b> et <b>Factures</b> pour l\'historique complet.', listinoSetupTitle: 'Table de prix pas encore créée', listinoSetupSubtitle: 'Activez le suivi des prix par produit en 2 clics :', listinoSetupStep1: 'Cliquez sur <strong class="font-bold text-slate-100">"Copier SQL"</strong> ci-dessous', listinoSetupStep2: 'Ouvrez le <a href="https://supabase.com/dashboard/project/dubocvwsdzrqrrxsedas/sql/new" target="_blank" rel="noopener noreferrer" class="font-semibold text-amber-200 underline decoration-amber-200/50 transition-colors hover:text-slate-100">SQL Editor ↗</a>, collez et cliquez sur <strong class="font-bold text-slate-100">"Run"</strong>', listinoSetupShowSQL: 'Afficher le SQL complet ▸', listinoCopySQL: 'Copier SQL', listinoCopied: 'Copié !', listinoProdotti: 'Liste des Prix', listinoProdottiTracked: 'produits suivis', listinoNoData: 'Aucun prix de produit enregistré', listinoNoDataHint: 'Saisissez les prix directement dans la table <code class="font-mono text-slate-300">listino_prezzi</code> sur Supabase.', listinoTotale: 'Total dépensé', listinoDaBolle: 'Des BL', listinoDaFatture: 'Des factures', listinoStorico: 'Historique des documents', listinoDocs: 'documents', listinoNoDocs: 'Aucun document avec montant enregistré', listinoColData: 'Date', listinoColTipo: 'Type', listinoColNumero: 'Numéro', listinoColImporto: 'Montant', listinoColTotale: 'Total', preferredLanguageEmail: 'Langue préférée (e-mails)', languageInheritSede: '— Hériter du site —', recognizedEmailsTitle: 'E-mails reconnus', recognizedEmailsHint: 'Adresses supplémentaires à partir desquelles ce fournisseur peut envoyer des documents. La synchronisation e-mail les associe automatiquement.', recognizedEmailPlaceholder: 'ex. factures@fournisseur.fr', recognizedEmailLabelOptional: 'Libellé (facultatif)', displayNameLabel: 'Nom court (liste & barre)', displayNameHint: 'Facultatif. Affiché dans la barre du bas sur mobile et les listes compactes à la place du nom légal complet.', displayNamePlaceholder: 'ex. Amalfi', loadingProfile: 'Chargement de la fiche, des documents et du récapitulatif fournisseur…', logoUrlLabel: 'Logo fournisseur (URL)', logoUrlPlaceholder: 'https://exemple.fr/logo.png', logoUrlHint: 'Image HTTPS (PNG, JPG ou SVG). En cas d’échec, les initiales s’affichent.', syncEmailNeedSede: 'Associez un site au fournisseur pour synchroniser les e-mails.' },
  bolle: { title: 'Bons de livraison', new: 'Nouveau BL', uploadInvoice: 'Uploader Facture', viewDocument: 'Voir Document', noBills: 'Aucun BL.', addFirst: 'Créer le premier →', deleteConfirm: 'Supprimer ce BL ? Les factures liées seront supprimées.', ocrScanning: 'Reconnaissance fournisseur…', ocrMatched: 'Fournisseur reconnu', ocrNotFound: 'Sélectionner manuellement', ocrAnalyzing: 'Analyse en cours…', ocrAutoRecognized: 'Reconnu automatiquement', ocrRead: 'Lu :', selectManually: 'Sélectionner fournisseur', saveNote: 'Enregistrer BL', savingNote: 'Enregistrement…', analyzingNote: 'Analyse du document…', takePhotoOrFile: 'Prendre photo ou choisir fichier', ocrHint: 'Le fournisseur sera reconnu automatiquement', cameraBtn: 'Caméra', fileBtn: 'Choisir fichier', countSingolo: 'bon de livraison enregistré', countPlural: 'bons de livraison enregistrés', countTodaySingolo: 'BL aujourd’hui', countTodayPlural: 'BL aujourd’hui', noBillsToday: 'Aucun BL pour aujourd’hui.', listShowAll: 'Tous les BL', listShowToday: 'Aujourd’hui seulement', listAllPending: 'En attente seulement', fotoLabel: 'Photo / Fichier BL', fornitoreLabel: 'Fournisseur', dataLabel: 'Date BL', dettaglio: 'Détail BL', fattureCollegate: 'Factures liées', aggiungi: '+ Ajouter', nessunaFatturaCollegata: 'Aucune facture liée.', allegatoLink: 'Pièce jointe →', statoCompletato: 'Complété', statoInAttesa: 'En attente', apri: 'Ouvrir', colNumero: 'Numéro', colAttachmentKind: 'Pièce jointe', attachmentKindPdf: 'PDF', attachmentKindImage: 'Image', attachmentKindOther: 'Fichier', nessunaBollaRegistrata: 'Aucun BL enregistré', creaLaPrimaBolla: 'Créer le premier BL →', vediDocumento: 'Voir le document', dateFromDocumentHint: 'Issu du document', prezzoDaApp: 'Prix issu de l’app', verificaPrezzoFornitore: 'Vérifier le prix fournisseur', rekkiPrezzoIndicativoBadge: '⚠️ Prix indicatif depuis l’app Rekki', listinoRekkiRefTitle: 'Tarif de référence (Rekki)', listinoRekkiRefHint: 'Avec l’ID Rekki sur le fournisseur, comparez le total du BL aux derniers prix importés.', listinoRekkiRefEmpty: 'Aucune ligne de tarif pour ce fournisseur.', scannerTitle: 'Scanner IA', scannerWhatLabel: 'Que chargez-vous ?', scannerModeAuto: 'Détection auto', scannerModeBolla: 'Bon de livraison / DDT', scannerModeFattura: 'Facture', scannerModeSupplier: 'Nouveau fournisseur', scannerFlowBolla: 'Enregistrement BL', scannerFlowFattura: 'Enregistrement facture', scannerSaveFattura: 'Enregistrer la facture', scannerSavingFattura: 'Enregistrement facture…', scannerCreateSupplierCta: 'Créer le fournisseur avec les données lues', scannerCreateSupplierFromUnrecognized: 'Créer le fournisseur depuis ce document', scannerPdfPreview: 'PDF joint — aperçu non disponible' },
  fatture: { title: 'Factures', new: 'Nouvelle Facture', noInvoices: 'Aucune facture.', addFirst: 'Ajouter la première →', invoice: 'Facture', openBill: 'Ouvrir BL →', deleteConfirm: 'Supprimer cette facture ? Action irréversible.', countLabel: 'factures reçues', headerBolla: 'Bon de livraison', headerAllegato: 'Pièce jointe', apri: 'Ouvrir →', caricaFatturaTitle: 'Uploader Facture', bollaMarkata: 'Le BL sera marqué comme complété', collegataABolla: 'Liée à un bon de livraison', bollaPasseraCompletato: 'À l\'enregistrement le BL passera à "complété"', dataFattura: 'Date Facture', fileFattura: 'Fichier Facture', caricaPdfFoto: 'Uploader PDF ou prendre photo', maxSize: 'PDF, JPG, PNG, WebP — max 10 Mo', savingInProgress: 'Enregistrement...', salvaChiudiBolla: 'Enregistrer et Clôturer BL', dettaglio: 'Détail', bollaCollegata: 'BL lié', statusAssociata: 'Associée', statusSenzaBolla: 'Sans BL', colNumFattura: 'N° Facture', nessunaFatturaRegistrata: 'Aucune facture enregistrée' },
  archivio: { title: 'Archive', subtitle: 'fournisseurs', noBills: 'Aucun BL', noInvoices: 'Aucune facture', withBill: 'Avec BL', noEmail: 'Aucun email', bollaS: 'bon', bollaP: 'bons', fatturaS: 'facture', fatturaP: 'factures', editLink: 'Modifier →', nuova: '+ Nouveau', nuovaFattura: '+ Facture', documento: 'Document', pendingDocCount: '({n} en attente)', linkAssociateStatements: 'Associer →' },
  impostazioni: { title: 'Paramètres', subtitle: 'Devise et fuseau horaire', lingua: 'Langue', valuta: 'Devise', fuso: 'Fuseau horaire', preview: 'Aperçu', saved: 'Paramètres sauvegardés — rechargement…', sectionLocalisation: 'Localisation', accountSection: 'Compte', changeSede: 'Changer de site', addOperatorsPickSede: 'Choisissez d’abord le site actif dans Sites — puis vous pourrez créer des opérateurs (nom + PIN) ici.' },
  log: { title: 'Log Sync Email', subtitle: 'Historique des emails traités par la synchronisation automatique.', sender: 'Expéditeur', subject: 'Objet', stato: 'Statut', detail: 'Détail', retry: 'Réessayer', retrying: 'Réessai…', success: 'Succès', bollaNotFound: 'Document Reçu', supplierNotFound: 'Expéditeur inconnu', noLogs: 'Aucun log.', emptyHint: 'Lancez une synchronisation email depuis le Tableau de bord.', totalLogs: 'Total logs', linkedInvoices: 'Documents reçus', withErrors: 'Avec erreurs', vediFile: 'Voir fichier', supplierSuggested: 'Fournisseur suggéré', aiSuggest: 'Suggestion IA', aiSuggestTitle: 'Données suggérées (OCR)', aiSuggestLoading: 'Analyse…', aiSuggestError: 'Impossible d’analyser le document.', openCreateSupplier: 'Ouvrir création fournisseur', associateRememberHint: 'Après enregistrement, l’e-mail de l’expéditeur sera lié pour les prochaines synchronisations.', colAttachment: 'Pièce jointe', colSede: 'Site', colLogId: 'ID log' },
  sedi: { title: 'Site et Utilisateurs', titleGlobalAdmin: 'Sites', subtitle: 'Gérer le site, la sync e-mail et les opérateurs', subtitleGlobalAdmin: 'Gérer les sites, la sync e-mail et les opérateurs', newSede: 'Nouveau Site', noSedi: 'Aucun site. Commencez par en ajouter un.', users: 'Utilisateurs', imap: 'Configuration Email (IMAP)', imapSubtitle: "Configurez la boîte mail de ce site. Les factures reçues ici seront associées automatiquement aux fournisseurs du site.", imapHost: 'Hôte IMAP', imapHostPlaceholder: 'imap.gmail.com', imapPort: 'Port', imapUser: 'Email / Utilisateur', imapPassword: 'Mot de passe', imapPasswordPlaceholder: 'Mot de passe ou Mot de passe d\'application', testConnection: 'Tester la connexion', saveConfig: 'Enregistrer la configuration', notConfigured: 'Email non configuré', accessDenied: 'Accès réservé aux administrateurs', accessDeniedHint: 'Contactez votre admin pour obtenir l\'accès.', creatingBtn: 'Création...', createBtn: 'Créer', nomePlaceholder: 'Ex. Bureau Paris', nessunUtente: 'Aucun utilisateur trouvé.', emailHeader: 'Email', sedeHeader: 'Site', ruoloHeader: 'Rôle', nessunaSedeOption: '— Aucun site —', operatoreRole: 'Opérateur', adminRole: 'Portail de gestion', adminSedeRole: 'Administrateur de site', profileRoleAdmin: 'Portail de gestion', adminScopedSediHint: 'Vous ne voyez que le site lié à votre profil. Les nouveaux sites et les « Utilisateurs sans site » sont réservés à l’administrateur principal (admin sans site sur le profil).', renameTitle: 'Renommer', deleteTitle: 'Supprimer', addOperatorSedeTitle: 'Nouvel opérateur', addOperatorSedeDesc: 'Connexion avec nom et PIN (min. 4 caractères). L’e-mail est généré automatiquement.', operatorDisplayNameLabel: 'Nom affiché', operatorPinMinLabel: 'PIN (min. 4 caractères)', operatorNameRequired: 'Saisissez le nom de l’opérateur.', operatorPinTooShort: 'Le PIN doit comporter au moins 4 caractères.' },
  statements: {
    heading: 'Vérification des Relevés Mensuels',
    tabVerifica: 'Relevé de Compte',
    tabDocumenti: 'Documents en Attente',
    schedaNavDaProcessareDesc: 'Pièces jointes reçues : liez fournisseurs, BL et factures.',
    schedaNavVerificaDesc: 'Contrôle mensuel du relevé par rapport aux BL et factures.',
    statusOk: 'OK',
    statusFatturaMancante: 'Facture manquante',
    statusBolleManc: 'BL manquants',
    statusErrImporto: 'Erreur de montant',
    statusRekkiPrezzo: 'Prix Rekki vs facture',
    stmtReceived: 'Relevés reçus',
    stmtClickHint: '— cliquez pour voir le Triple-Check',
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
    gotoFatturaDraft: 'Voir le brouillon facture →',
    gotoBollaDraft: 'Voir le brouillon BL →',
    toggleAddStatement: 'Ajouter au relevé',
    toggleRemoveStatement: 'Retirer du relevé',
    docKindEstratto: 'Relevé',
    docKindBolla: 'BL',
    docKindFattura: 'Facture',
    docKindHintBolla: 'Marquer comme bon de livraison, pas relevé mensuel ni facture à rapprocher',
    docKindHintFattura: 'Marquer comme facture à rapprocher avec les BL en attente',
    docKindGroupAria: 'Type de document',
    finalizeNeedsSupplier: 'Associez un fournisseur pour finaliser.',
    btnFinalizeFattura: 'Enregistrer la facture (sans BL)',
    btnFinalizeBolla: 'Créer un BL à partir du fichier',
    btnFinalizeStatement: 'Archiver le relevé',
    btnFinalizing: 'Enregistrement…',
    finalizeSuccess: 'Document enregistré.',
    noPendingDocs: 'Aucun document à examiner',
    noDocsFound: 'Aucun document trouvé',
    noBolleAttesa: 'Aucun bon de livraison en attente disponible',
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
    ocrFormatToggleTitle: 'Forcer l’interprétation numérique alternative',
    allBolleInvoicedOk: 'Tous les bons de livraison ont une facture correspondante — relevé vérifié ✓',
    aiStatementTotalLabel: 'Total extrait du relevé (IA) :',
    statementLinkedBolleLine: '{matched}/{total} BL associés',
    selectedSumLabel: 'Sélection :',
    selectedBolle_one: '({n} BL)',
    selectedBolle_other: '({n} BL)',
    receivedOn: 'Reçu le',
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
    badgeNeedsHuman: 'Association requise',
    rememberAssociationTitle: 'Mémoriser cette association expéditeur–fournisseur ?',
    rememberAssociationSave: 'Enregistrer l’e-mail de l’expéditeur',
    rekkiDocumentLink: 'Rekki',
  },
  appStrings: {
    brandFooter: 'FLUXO · Gestion des achats',
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
    imapLookbackLastDays: 'Lit les e-mails non lus des {n} derniers jours',
    imapLookbackUnlimited: 'Lit tous les e-mails non lus (sans limite)',
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
    noAddressRegistered: 'Aucune adresse enregistrée',
    noFiscalRegistered: 'Aucune donnée fiscale',
    clientSince: 'Client depuis',
    fromInvoiceBtn: 'Depuis facture',
    listinoAnalyze: 'Analyser',
    listinoAnalyzing: 'Analyse IA…',
    listinoNoInvoicesFile: 'Aucune facture avec pièce jointe pour ce fournisseur.',
    listinoNoProducts: 'Aucune ligne trouvée sur cette facture. Essayez une autre.',
    saveNProducts: 'Enregistrer {n} produits',
    clickAddFirst: 'Cliquez sur Ajouter pour saisir le premier produit.',
    monthNavResetTitle: 'Aller au mois en cours',
    addingAlias: 'Ajout…',
    addEmailAlias: '+ Ajouter un e-mail',
    listinoImportPanelTitle: 'Importer les produits depuis une facture',
    listinoImportSelectInvoiceLabel: 'Sélectionner la facture',
    listinoImportProductsSelected: '{selected} / {total} produits sélectionnés',
    listinoImportPriceListDateLabel: 'Date du tarif',
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
  },
  login: {
    brandTagline: 'Rechnungsverwaltung',
    subtitle: 'Zugang: Ihr Name und 4-stelliger PIN',
    adminSubtitle: 'Verwaltungsportal',
    adminSubtitleHint:
      'E-Mail und Passwort für das Verwaltungsportal. Für Operatorenname und PIN nutzen Sie «Operator-Zugang» (Standort-Admins und Operatoren).',
    nameLabel: 'Name',
    namePlaceholder: 'MAX',
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
  },
  nav: { dashboard: 'Dashboard', dashboardAdmin: 'Admin', operatori: 'Operatoren', fornitori: 'Lieferanten', bolle: 'Lieferscheine', fatture: 'Rechnungen', archivio: 'Archiv', logEmail: 'E-Mail-Log', sedi: 'Standort & Nutzer', sediTitle: 'Standort', sediNavGroupMaster: 'Standorte', gestisciSedeNamed: '{name} verwalten', gestisciSedi: 'Standorte verwalten', tuttiFornitori: 'Alle Lieferanten', cerca: 'Suchen…', nessunRisultato: 'Keine Ergebnisse', altriRisultati: 'weitere — suche oben', impostazioni: 'Einstellungen', nuovaBolla: 'Neuer Lieferschein', ricevuto: 'Beleg', operatorActiveHint: 'Wer ist gerade aktiv?', esci: 'Abmelden', guida: 'Hilfe', sedeGlobalOverview: 'Globale Übersicht', bottomNavBackToSede: 'Zurück zum Standort', bottomNavScannerAi: 'KI-Scanner', bottomNavProfile: 'Profil', bottomNavSediMap: 'Standortkarte', bottomNavGlobalReports: 'Globale Berichte', bottomNavNewOrder: 'Neue Bestellung', bottomNavPriceHistory: 'Preisverlauf', bottomNavContact: 'Kontakt', addNewDelivery: 'Neuer Lieferschein', openRekki: 'Rekki', ariaMain: 'Hauptnavigation', ariaAdmin: 'Administrator-Navigation', ariaFornitore: 'Lieferanten-Navigation', ariaCallSupplier: 'Lieferanten anrufen', notifications: 'Benachrichtigungen', noNotifications: 'Keine Benachrichtigungen', errorAlert: 'Sync-Fehler (24h)' },
  common: { save: 'Speichern', cancel: 'Abbrechen', delete: 'Löschen', edit: 'Bearbeiten', new: 'Neu', loading: 'Laden...', error: 'Fehler', success: 'Erfolg', noData: 'Keine Daten', document: 'Dokument', actions: 'Aktionen', date: 'Datum', status: 'Status', supplier: 'Lieferant', notes: 'Notizen', phone: 'Telefon', saving: 'Speichern...', attachment: 'Anhang', openAttachment: 'Anhang öffnen', detail: 'Detail', add: 'Hinzufügen', rename: 'Umbenennen', role: 'Rolle', aiExtracted: 'KI-extrahierte Daten', matched: 'Zugeordnet', notMatched: 'Nicht zugeordnet', recordSupplierLinked: 'Verknüpft', company: 'Unternehmen', invoiceNum: 'Rechnungs-Nr.', total: 'Gesamt' },
  status: { inAttesa: 'Ausstehend', completato: 'Abgeschlossen', completata: 'Abgeschlossen' },
  dashboard: { title: 'Dashboard', subtitle: 'Einkaufsübersicht', suppliers: 'Lieferanten', totalBills: 'Lieferscheine gesamt', pendingBills: 'Ausstehende Scheine', invoices: 'Rechnungen', recentBills: 'Aktuelle Lieferscheine', viewAll: 'Alle anzeigen →', syncEmail: 'E-Mail synchronisieren', emailSyncScopeLookback: 'Letzte Tage (Standort)', emailSyncScopeFiscal: 'Geschäftsjahr', emailSyncFiscalYearSelectAria: 'Zeitraum für E-Mail-Sync', emailSyncScopeHint: 'IT, FR, DE, ES: Kalenderjahr. UK: Steuerjahr bis 5. Apr. Jeder Standort nutzt sein Land.', emailSyncLookbackSedeDefault: 'Standort-Standard (IMAP)', emailSyncLookbackDaysN: 'Letzte {n} Tage', emailSyncLookbackDaysAria: 'Wie weit zurück nach ungelesenen Mails suchen', emailSyncLookbackDaysHint: 'Standort-Standard: nutzt die auf dem Standort hinterlegten Tage. Sonst IMAP-Suche auf die letzten N Tage begrenzen (nur ungelesen).', emailSyncDocumentKindAria: 'Dokumenttyp für den E-Mail-Import', emailSyncDocumentKindHint: 'Alle: Standard. Neuer Lieferant: nur Absender ohne Eintrag. Lieferschein / Rechnung: Entwurfstyp erzwingen. Kontoauszug: nur Mails mit Betreff wie Statement/Auszug.', emailSyncDocumentKindAll: 'Alle Dokumente', emailSyncDocumentKindFornitore: 'Neuer Lieferant', emailSyncDocumentKindBolla: 'Lieferschein (DDT)', emailSyncDocumentKindFattura: 'Rechnung', emailSyncDocumentKindEstratto: 'Kontoauszug', syncing: 'Synchronisierung...', sendReminders: 'Zahlungserinnerungen senden', sending: 'Senden...', viewLog: 'Log anzeigen', sedeOverview: 'Übersicht nach Standort', manageSedeNamed: '{name} verwalten →', manageSedi: 'Standorte verwalten →', sedeImapOn: 'E-Mail aktiv', digitalizzaRicevuto: 'Beleg digitalisieren', kpiNoPendingBills: 'Keine ausstehenden Lieferscheine.', errorCountSuffix: 'Fehler', manualReceiptLabel: 'Eingang (ohne Lieferschein)', manualReceiptPlaceholder: 'z. B. 5 kg Tintenfisch, 2 Kisten Zitronen', manualReceiptRegister: 'Lieferung erfassen', manualReceiptRegistering: 'Wird gespeichert…', manualReceiptSaved: 'Lieferung erfasst.', manualReceiptNeedTextOrPhoto: 'Beschreibung eingeben oder Foto anhängen.', manualReceiptRemovePhoto: 'Foto entfernen', manualReceiptNeedSupplier: 'Bitte einen Lieferanten wählen.', manualReceiptRegisterFailed: 'Registrierung fehlgeschlagen.', manualReceiptEmailSupplierLabel: 'E-Mail an Lieferanten: Bestellung und Lieferschein anfordern', manualReceiptEmailSupplierHint: 'E-Mail des Lieferanten im Profil hinterlegen.', manualReceiptEmailSent: 'Anfrage-E-Mail an Lieferanten gesendet.', manualReceiptEmailFailed: 'Eingang gespeichert, E-Mail konnte nicht gesendet werden.', manualReceiptEmailDescPhotoOnly: 'Foto zur Eingangsregistrierung beigefügt (ohne Text).', adminGlobalTitle: 'Globales Dashboard', adminGlobalSubtitle: 'Überblick über alle Standorte. Wählen Sie eine Filiale im Menü oder auf der Karte für die operative Ansicht.', adminGlobalTotalsLabel: 'Netzwerk-Gesamtwerte', adminOpenBranchDashboard: 'Operative Ansicht', adminSedeSettingsLink: 'Standort-Seite', adminDocQueueShort: 'In Warteschlange', rekkiOrder: 'Bei Rekki bestellen', manualDeliveryNeedSede: 'Wählen Sie einen aktiven Operator oder stellen Sie sicher, dass Ihr Profil mit einem Standort verknüpft ist, um eine Lieferung zu erfassen.', kpiPriceListSub: 'Zeilen in der Preisliste', listinoOverviewHint: 'Preislistenzeilen für Lieferanten in Ihrem Bereich. Lieferant öffnen zum Bearbeiten oder Import aus Rechnung.', listinoOverviewEmpty: 'Keine Preislistenzeilen in diesem Bereich.', listinoOverviewOpenSupplier: 'Lieferant öffnen →', listinoOverviewLimitNote: 'Die letzten {n} Zeilen.', fattureRiepilogoTitle: 'Rechnungssummen', fattureRiepilogoHint: 'Summe der Beträge in Ihrem Bereich. Die Tabelle zeigt die neuesten Rechnungen nach Datum; öffnen Sie eine für Anhang und Verknüpfungen.', fattureRiepilogoEmpty: 'Keine Rechnungen in diesem Bereich.', fattureRiepilogoLimitNote: 'Die letzten {n} Rechnungen (nach Datum).', fattureRiepilogoOpenInvoice: 'Rechnung öffnen →', fattureRiepilogoCountLabel: '{n} Rechnungen', fattureRiepilogoLinkAll: 'Alle Rechnungen →', kpiStatementNone: 'Kein Kontoauszug', kpiStatementAllOk: 'Keine Auffälligkeiten', kpiStatementIssuesFooter: 'von {t} geprüften Auszügen', kpiFornitoriSub: 'Stamm & Suche', kpiDaProcessareSub: 'Dokumente in Warteschlange', operatorNoSede: 'Ihrem Profil ist kein Standort zugeordnet. Bitte einen Administrator, Sie der richtigen Filiale zuzuweisen.', suggestedSupplierBanner: 'Neuer Lieferant erkannt: {name}. Hinzufügen?', suggestedSupplierAdd: 'Neuer Lieferant', suggestedSupplierImport: 'Aus OCR importieren', enterAsSede: 'Als Standort ansehen', syncHealthAlert: 'Synchronisationsproblem (IMAP oder OCR)', syncHealthOcrCount: 'OCR-Fehler (48h): {n}', viewingAsSedeBanner: 'Sie sehen das Dashboard als:', exitSedeView: 'Zurück zur Admin-Übersicht', emailSyncQueued: 'In Warteschlange — eine andere Synchronisation läuft…', emailSyncPhaseConnect: 'Verbindung…', emailSyncConnectToServer: 'Verbindung zum IMAP-Server (Netzwerk, TLS, Anmeldung)…', emailSyncConnectOpeningMailbox: 'Posteingangsordner wird geöffnet…', emailSyncPhaseSearch: 'Texte einlesen…', emailSyncPhaseProcess: 'Anhang-Analyse mit Vision-KI…', emailSyncPhasePersist: 'Speichern in der Datenbank…', emailSyncPhaseDone: 'Synchronisation abgeschlossen.', emailSyncStalled: 'Keine Updates — bei vielen Anhängen kann die Vision mehrere Minuten brauchen. Bitte warten…', emailSyncStalledHint: 'Hier fehlen nur Stream-Updates (bei langer Texterkennung normal). Echte IMAP-Wiederholungen siehst du oben im roten Banner in der Verbindungsphase.', emailSyncImapRetryLine: 'IMAP-Verbindung: Versuch {current} von {max}', emailSyncCountsHint: 'Gefunden · neu in der App · verarbeitet · PDF/Text-Einheiten', emailSyncMailboxGlobal: 'Globales IMAP-Postfach (Umgebungsvariablen)', emailSyncMailboxSede: 'Postfach: {name}', emailSyncSupplierFilterLine: 'Lieferantenfilter: {name}', emailSyncStatFoundLine: 'Im Postfach gefunden: {found}', emailSyncStatImportedLine: 'Neu in der App (importierte Dokumente): {imported}', emailSyncStatProcessedLine: 'E-Mails vollständig verarbeitet: {processed}', emailSyncStatIgnoredLine: 'Übersprungen / ohne Ergebnis: {ignored}', emailSyncStatDraftsLine: 'Autom. erstellte Lieferschein-Entwürfe: {drafts}', emailSyncStatAlreadyLine: 'Bereits in einer früheren Synchronisation verarbeitet (kein erneuter Import): {n}', emailSyncStatUnitsLine: 'Zu analysierende Einheiten (PDF/Bild-Anhänge oder langer Mailtext): {done} / {total}', emailSyncStripDetailsExpandAria: 'E-Mail-Sync-Details anzeigen', emailSyncStripDetailsCollapseAria: 'E-Mail-Sync-Details ausblenden', emailSyncStop: 'Stoppen', emailSyncStopAria: 'E-Mail-Synchronisation abbrechen', emailSyncDismiss: 'Schließen', emailSyncDismissAria: 'E-Mail-Sync-Zusammenfassung schließen', potentialSupplierFromEmailBodyBanner: 'Möglicher Lieferant (E-Mail-Text): {name}. Zuordnen?', potentialSupplierFromEmailBodyCta: 'Neuen Lieferanten anlegen' },
  fornitori: { title: 'Lieferanten', new: 'Neuer Lieferant', nome: 'Name / Firma', email: 'E-Mail', piva: 'USt-IdNr.', noSuppliers: 'Keine Lieferanten.', addFirst: 'Ersten hinzufügen →', editTitle: 'Lieferant bearbeiten', saveChanges: 'Änderungen speichern', notFound: 'Lieferant nicht gefunden.', deleteConfirm: 'Diesen Lieferanten löschen? Alle verknüpften Lieferscheine und Rechnungen werden ebenfalls gelöscht.', importaDaFattura: 'Aus Rechnung importieren', countLabel: 'Lieferanten registriert', namePlaceholder: 'z.B. Müller GmbH', emailPlaceholder: 'lieferant@beispiel.de', pivaLabel: 'USt-IdNr.', pivaPlaceholder: 'DE123456789', addressLabel: 'Adresse (optional)', addressPlaceholder: 'Straße, PLZ, Ort', rekkiLinkLabel: 'Rekki-Link (optional)', rekkiLinkPlaceholder: 'https://…', rekkiIdLabel: 'Rekki-ID (optional)', rekkiIdPlaceholder: 'z. B. Lieferanten-ID bei Rekki', rekkiIntegrationTitle: 'Rekki-Integration', rekkiLookupByVat: 'Bei Rekki suchen (USt-IdNr.)', rekkiSaveRekkiMapping: 'Rekki-Verknüpfung speichern', rekkiConnectedBadge: 'Rekki', rekkiCachedListBanner: 'Zwischengespeicherte Daten (offline).', rekkiLookupNeedVat: 'Tragen Sie die USt-IdNr. des Lieferanten ein, um bei Rekki zu suchen.', rekkiIdExtractedFromLink: 'Lieferanten-ID aus dem Rekki-Link übernommen.', rekkiAutoLinkedSingle: 'Nur ein Rekki-Lieferant passt zu dieser USt-IdNr. — Verknüpfung gespeichert.', saving: 'Speichern...', tabRiepilogo: 'Übersicht', tabListino: 'Preisliste', tabStrategyConto: 'Kontoauszug', kpiBolleTotal: 'Lieferscheine gesamt', kpiFatture: 'Rechnungen eingegangen', kpiPending: 'Ausstehende Dokumente', kpiReconciliation: 'Abstimmung', subAperte: 'offen', subConfermate: 'bestätigt', subDaAbbinare: 'zuzuordnen', subChiuse: 'Scheine geschlossen', subListinoRows: 'Preislisten-Einträge im Zeitraum', subStatementsNoneInMonth: 'keiner in diesem Monat', subStatementsAllVerified: 'alle geprüft OK', subStatementsWithIssues: 'mit Abweichungen', helpText: 'Gehe zum Tab <b>Kontoauszug</b>, um Dokumente und Lieferscheine zuzuordnen, oder zu <b>Lieferscheine</b> und <b>Rechnungen</b> für den vollständigen Verlauf.', listinoSetupTitle: 'Preisliste noch nicht erstellt', listinoSetupSubtitle: 'Produktpreise in 2 Klicks aktivieren:', listinoSetupStep1: 'Klicke auf <strong class="font-bold text-slate-100">"SQL kopieren"</strong> unten', listinoSetupStep2: 'Öffne den <a href="https://supabase.com/dashboard/project/dubocvwsdzrqrrxsedas/sql/new" target="_blank" rel="noopener noreferrer" class="font-semibold text-amber-200 underline decoration-amber-200/50 transition-colors hover:text-slate-100">SQL Editor ↗</a>, füge ein und klicke <strong class="font-bold text-slate-100">"Run"</strong>', listinoSetupShowSQL: 'Vollständiges SQL anzeigen ▸', listinoCopySQL: 'SQL kopieren', listinoCopied: 'Kopiert!', listinoProdotti: 'Produktpreisliste', listinoProdottiTracked: 'Produkte verfolgt', listinoNoData: 'Keine Produktpreise erfasst', listinoNoDataHint: 'Preise direkt in der Tabelle <code class="font-mono text-slate-300">listino_prezzi</code> auf Supabase eingeben.', listinoTotale: 'Gesamtausgaben', listinoDaBolle: 'Aus Lieferscheinen', listinoDaFatture: 'Aus Rechnungen', listinoStorico: 'Dokumentenverlauf', listinoDocs: 'Dokumente', listinoNoDocs: 'Keine Dokumente mit Betrag erfasst', listinoColData: 'Datum', listinoColTipo: 'Typ', listinoColNumero: 'Nummer', listinoColImporto: 'Betrag', listinoColTotale: 'Gesamt', preferredLanguageEmail: 'Bevorzugte Sprache (für E-Mails)', languageInheritSede: '— Vom Standort übernehmen —', recognizedEmailsTitle: 'Erkannte E-Mail-Adressen', recognizedEmailsHint: 'Zusätzliche Adressen, von denen dieser Lieferant Dokumente senden darf. Der E-Mail-Scan ordnet sie automatisch zu.', recognizedEmailPlaceholder: 'z. B. rechnungen@lieferant.de', recognizedEmailLabelOptional: 'Bezeichnung (optional)', displayNameLabel: 'Kurzname (Liste & Leiste)', displayNameHint: 'Optional. Wird in der mobilen unteren Leiste und kompakten Listen statt des vollen Namens angezeigt.', displayNamePlaceholder: 'z. B. Amalfi', loadingProfile: 'Lieferantenprofil, Belege und Übersicht werden geladen…', logoUrlLabel: 'Lieferantenlogo (URL)', logoUrlPlaceholder: 'https://beispiel.de/logo.png', logoUrlHint: 'HTTPS-Bild (PNG, JPG oder SVG). Bei Ladefehler werden Initialen angezeigt.', syncEmailNeedSede: 'Weisen Sie dem Lieferanten einen Standort zu, um E-Mails zu synchronisieren.' },
  bolle: { title: 'Lieferscheine', new: 'Neuer Lieferschein', uploadInvoice: 'Rechnung hochladen', viewDocument: 'Dokument anzeigen', noBills: 'Keine Lieferscheine.', addFirst: 'Ersten erstellen →', deleteConfirm: 'Diesen Lieferschein löschen? Verknüpfte Rechnungen werden ebenfalls gelöscht.', ocrScanning: 'Lieferant wird erkannt…', ocrMatched: 'Lieferant erkannt', ocrNotFound: 'Lieferant manuell auswählen', ocrAnalyzing: 'Analyse läuft…', ocrAutoRecognized: 'Automatisch erkannt', ocrRead: 'Gelesen:', selectManually: 'Lieferant auswählen', saveNote: 'Lieferschein speichern', savingNote: 'Wird gespeichert…', analyzingNote: 'Dokument wird analysiert…', takePhotoOrFile: 'Foto aufnehmen oder Datei wählen', ocrHint: 'Lieferant wird automatisch erkannt', cameraBtn: 'Kamera', fileBtn: 'Datei wählen', countSingolo: 'Lieferschein registriert', countPlural: 'Lieferscheine registriert', countTodaySingolo: 'Lieferschein heute', countTodayPlural: 'Lieferscheine heute', noBillsToday: 'Keine Lieferscheine für heute.', listShowAll: 'Alle Lieferscheine', listShowToday: 'Nur heute', listAllPending: 'Nur ausstehend', fotoLabel: 'Foto / Lieferschein-Datei', fornitoreLabel: 'Lieferant', dataLabel: 'Lieferscheindatum', dettaglio: 'Lieferschein-Details', fattureCollegate: 'Zugeordnete Rechnungen', aggiungi: '+ Hinzufügen', nessunaFatturaCollegata: 'Keine zugeordneten Rechnungen.', allegatoLink: 'Anhang →', statoCompletato: 'Abgeschlossen', statoInAttesa: 'Ausstehend', apri: 'Öffnen', colNumero: 'Nummer', colAttachmentKind: 'Anhang', attachmentKindPdf: 'PDF', attachmentKindImage: 'Bild', attachmentKindOther: 'Datei', nessunaBollaRegistrata: 'Keine Lieferscheine registriert', creaLaPrimaBolla: 'Ersten Lieferschein erstellen →', vediDocumento: 'Dokument anzeigen', dateFromDocumentHint: 'Aus Dokument', prezzoDaApp: 'Preis aus der App', verificaPrezzoFornitore: 'Lieferantenpreis prüfen', rekkiPrezzoIndicativoBadge: '⚠️ Richtpreis aus der Rekki-App', listinoRekkiRefTitle: 'Referenz-Preisliste (Rekki)', listinoRekkiRefHint: 'Mit Rekki-ID beim Lieferanten vergleichen Sie den Lieferschein-Gesamtbetrag mit den zuletzt importierten Preisen.', listinoRekkiRefEmpty: 'Keine Preislistenzeilen für diesen Lieferanten.', scannerTitle: 'KI-Scanner', scannerWhatLabel: 'Was laden Sie hoch?', scannerModeAuto: 'Automatisch erkennen', scannerModeBolla: 'Lieferschein / DDT', scannerModeFattura: 'Rechnung', scannerModeSupplier: 'Neuer Lieferant', scannerFlowBolla: 'Lieferschein erfassen', scannerFlowFattura: 'Rechnung erfassen', scannerSaveFattura: 'Rechnung speichern', scannerSavingFattura: 'Rechnung wird gespeichert…', scannerCreateSupplierCta: 'Lieferant aus gelesenen Daten anlegen', scannerCreateSupplierFromUnrecognized: 'Lieferant aus diesem Dokument anlegen', scannerPdfPreview: 'PDF angehängt — keine Vorschau' },
  fatture: { title: 'Rechnungen', new: 'Neue Rechnung', noInvoices: 'Keine Rechnungen.', addFirst: 'Erste hinzufügen →', invoice: 'Rechnung', openBill: 'Lieferschein öffnen →', deleteConfirm: 'Diese Rechnung löschen? Aktion kann nicht rückgängig gemacht werden.', countLabel: 'eingegangene Rechnungen', headerBolla: 'Lieferschein', headerAllegato: 'Anhang', apri: 'Öffnen →', caricaFatturaTitle: 'Rechnung hochladen', bollaMarkata: 'Der Lieferschein wird als abgeschlossen markiert', collegataABolla: 'Mit Lieferschein verknüpft', bollaPasseraCompletato: 'Beim Speichern wird der Lieferschein auf "abgeschlossen" gesetzt', dataFattura: 'Rechnungsdatum', fileFattura: 'Rechnungsdatei', caricaPdfFoto: 'PDF hochladen oder Foto aufnehmen', maxSize: 'PDF, JPG, PNG, WebP — max 10 MB', savingInProgress: 'Wird gespeichert...', salvaChiudiBolla: 'Speichern und Lieferschein schließen', dettaglio: 'Details', bollaCollegata: 'Verknüpfter Lieferschein', statusAssociata: 'Zugeordnet', statusSenzaBolla: 'Kein Lieferschein', colNumFattura: 'Rechnungs-Nr.', nessunaFatturaRegistrata: 'Keine Rechnungen registriert' },
  archivio: { title: 'Archiv', subtitle: 'Lieferanten', noBills: 'Keine Lieferscheine', noInvoices: 'Keine Rechnungen', withBill: 'Mit Schein', noEmail: 'Keine E-Mail', bollaS: 'Schein', bollaP: 'Scheine', fatturaS: 'Rechnung', fatturaP: 'Rechnungen', editLink: 'Bearbeiten →', nuova: '+ Neu', nuovaFattura: '+ Rechnung', documento: 'Dokument', pendingDocCount: '({n} ausstehend)', linkAssociateStatements: 'Zuordnen →' },
  impostazioni: { title: 'Einstellungen', subtitle: 'Währung und Zeitzone', lingua: 'Sprache', valuta: 'Währung', fuso: 'Zeitzone', preview: 'Vorschau', saved: 'Einstellungen gespeichert — wird neu geladen…', sectionLocalisation: 'Lokalisierung', accountSection: 'Konto', changeSede: 'Standort wechseln', addOperatorsPickSede: 'Wählen Sie zuerst den aktiven Standort unter Standorte — dann können Sie hier Operatoren anlegen (Name + PIN).' },
  log: { title: 'E-Mail-Sync-Log', subtitle: 'Verlauf der von der automatischen Synchronisierung verarbeiteten E-Mails.', sender: 'Absender', subject: 'Betreff', stato: 'Status', detail: 'Detail', retry: 'Erneut versuchen', retrying: 'Versuche erneut…', success: 'Erfolg', bollaNotFound: 'Dokument Empfangen', supplierNotFound: 'Unbekannter Absender', noLogs: 'Keine Logs.', emptyHint: 'Führen Sie eine E-Mail-Synchronisierung vom Dashboard aus durch.', totalLogs: 'Logs gesamt', linkedInvoices: 'Empfangene Dokumente', withErrors: 'Mit Fehlern', vediFile: 'Datei anzeigen', supplierSuggested: 'Vorgeschlagener Lieferant', aiSuggest: 'KI-Vorschlag', aiSuggestTitle: 'Vorgeschlagene Stammdaten (OCR)', aiSuggestLoading: 'Analyse…', aiSuggestError: 'Dokument konnte nicht analysiert werden.', openCreateSupplier: 'Lieferant anlegen öffnen', associateRememberHint: 'Nach dem Speichern wird die Absender-E-Mail für künftige Synchronisierungen verknüpft.', colAttachment: 'Anhang', colSede: 'Standort', colLogId: 'Log-ID' },
  sedi: { title: 'Standort & Nutzer', titleGlobalAdmin: 'Standorte', subtitle: 'Standort, E-Mail-Sync und Operatoren verwalten', subtitleGlobalAdmin: 'Standorte, E-Mail-Synchronisation und Operatoren verwalten', newSede: 'Neuer Standort', noSedi: 'Keine Standorte. Fügen Sie den ersten hinzu.', users: 'Nutzer', imap: 'E-Mail-Konfiguration (IMAP)', imapSubtitle: 'Konfigurieren Sie das E-Mail-Postfach dieses Standorts. Eingehende Rechnungen werden automatisch den Lieferanten des Standorts zugeordnet.', imapHost: 'IMAP-Host', imapHostPlaceholder: 'imap.gmail.com', imapPort: 'Port', imapUser: 'E-Mail / Nutzer', imapPassword: 'Passwort', imapPasswordPlaceholder: 'Passwort oder App-Passwort', testConnection: 'Verbindung testen', saveConfig: 'Konfiguration speichern', notConfigured: 'E-Mail nicht konfiguriert', accessDenied: 'Zugang nur für Administratoren', accessDeniedHint: 'Wenden Sie sich an Ihren Administrator, um Zugang zu erhalten.', creatingBtn: 'Erstellen...', createBtn: 'Erstellen', nomePlaceholder: 'z.B. Büro Berlin', nessunUtente: 'Keine Nutzer gefunden.', emailHeader: 'E-Mail', sedeHeader: 'Standort', ruoloHeader: 'Rolle', nessunaSedeOption: '— Kein Standort —', operatoreRole: 'Operator', adminRole: 'Verwaltungsportal', adminSedeRole: 'Standort-Administrator', profileRoleAdmin: 'Verwaltungsportal', adminScopedSediHint: 'Sie sehen nur den Standort, der mit Ihrem Profil verknüpft ist. Neue Standorte und «Benutzer ohne Standort» verwaltet der Hauptadministrator (Admin ohne Standort im Profil).', renameTitle: 'Umbenennen', deleteTitle: 'Löschen', addOperatorSedeTitle: 'Neuer Operator', addOperatorSedeDesc: 'Anmeldung mit Name und PIN (mind. 4 Zeichen). E-Mail wird automatisch erzeugt.', operatorDisplayNameLabel: 'Anzeigename', operatorPinMinLabel: 'PIN (mind. 4 Zeichen)', operatorNameRequired: 'Geben Sie den Namen des Operators ein.', operatorPinTooShort: 'Der PIN muss mindestens 4 Zeichen haben.' },
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
    stmtClickHint: '— klicken für Triple-Check',
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
    gotoFatturaDraft: 'Zum Rechnungsentwurf →',
    gotoBollaDraft: 'Zum Lieferschein-Entwurf →',
    toggleAddStatement: 'Zum Auszug hinzufügen',
    toggleRemoveStatement: 'Aus Auszug entfernen',
    docKindEstratto: 'Auszug',
    docKindBolla: 'Lieferschein',
    docKindFattura: 'Rechnung',
    docKindHintBolla: 'Als Lieferschein markieren, kein Monatsauszug und keine zu zuordnende Rechnung',
    docKindHintFattura: 'Als Rechnung markieren, mit offenen Lieferscheinen abgleichen',
    docKindGroupAria: 'Dokumenttyp',
    finalizeNeedsSupplier: 'Lieferanten zuordnen, um abzuschließen.',
    btnFinalizeFattura: 'Rechnung speichern (ohne Lieferschein)',
    btnFinalizeBolla: 'Lieferschein aus Datei anlegen',
    btnFinalizeStatement: 'Auszug archivieren',
    btnFinalizing: 'Wird gespeichert…',
    finalizeSuccess: 'Dokument gespeichert.',
    noPendingDocs: 'Keine Dokumente zu prüfen',
    noDocsFound: 'Keine Dokumente gefunden',
    noBolleAttesa: 'Keine ausstehenden Lieferscheine verfügbar',
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
    ocrFormatToggleTitle: 'Alternative Zahleninterpretation erzwingen',
    allBolleInvoicedOk: 'Alle Lieferscheine haben eine passende Rechnung — Auszug geprüft ✓',
    aiStatementTotalLabel: 'Auszugssumme (KI):',
    statementLinkedBolleLine: '{matched}/{total} Lieferscheine zugeordnet',
    selectedSumLabel: 'Ausgewählt:',
    selectedBolle_one: '({n} Lieferschein)',
    selectedBolle_other: '({n} Lieferscheine)',
    receivedOn: 'Empfangen am',
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
    badgeNeedsHuman: 'Zuordnung nötig',
    rememberAssociationTitle: 'Diese Absender–Lieferant-Zuordnung merken?',
    rememberAssociationSave: 'Absender-E-Mail speichern',
    rekkiDocumentLink: 'Rekki',
  },
  appStrings: {
    brandFooter: 'FLUXO · Einkaufsverwaltung',
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
    imapLookbackLastDays: 'Liest ungelesene Mails der letzten {n} Tage',
    imapLookbackUnlimited: 'Liest alle ungelesenen Mails (ohne Limit)',
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
    noAddressRegistered: 'Keine Adresse hinterlegt',
    noFiscalRegistered: 'Keine Steuerdaten',
    clientSince: 'Kunde seit',
    fromInvoiceBtn: 'Aus Rechnung',
    listinoAnalyze: 'Analysieren',
    listinoAnalyzing: 'KI-Analyse…',
    listinoNoInvoicesFile: 'Keine Rechnung mit Anhang für diesen Lieferanten.',
    listinoNoProducts: 'Keine Positionen auf dieser Rechnung. Andere versuchen.',
    saveNProducts: '{n} Produkte speichern',
    clickAddFirst: 'Klicken Sie auf Hinzufügen für das erste Produkt.',
    monthNavResetTitle: 'Zum aktuellen Monat',
    addingAlias: 'Wird hinzugefügt…',
    addEmailAlias: '+ E-Mail hinzufügen',
    listinoImportPanelTitle: 'Produkte aus Rechnung importieren',
    listinoImportSelectInvoiceLabel: 'Rechnung auswählen',
    listinoImportProductsSelected: '{selected} / {total} Produkte ausgewählt',
    listinoImportPriceListDateLabel: 'Preislistendatum',
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
  },
}

const dict: Record<Locale, Translations> = { it, en, es, fr, de }

export function getTranslations(locale: Locale = 'en'): Translations {
  return dict[locale] ?? dict.en
}

export type { Translations }
