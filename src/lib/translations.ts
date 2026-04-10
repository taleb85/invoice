export type Locale = 'it' | 'en' | 'es' | 'fr' | 'de'

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
  { value: 'Europe/Rome', label: 'Roma (CET/CEST)' },
  { value: 'Europe/London', label: 'Londra (GMT/BST)' },
  { value: 'Europe/Paris', label: 'Parigi (CET/CEST)' },
  { value: 'Europe/Berlin', label: 'Berlino (CET/CEST)' },
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
  nav: {
    dashboard: string
    fornitori: string
    bolle: string
    fatture: string
    archivio: string
    logEmail: string
    sedi: string
    impostazioni: string
    nuovaBolla: string
    esci: string
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
    saving: string
    attachment: string
    openAttachment: string
    detail: string
    add: string
    rename: string
    role: string
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
    syncing: string
    sendReminders: string
    sending: string
    viewLog: string
    sedeOverview: string
    manageSedi: string
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
    saving: string
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
    fotoLabel: string
    fornitoreLabel: string
    dataLabel: string
    dettaglio: string
    fattureCollegate: string
    aggiungi: string
    nessunaFatturaCollegata: string
    allegatoLink: string
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
  }
  impostazioni: {
    title: string
    subtitle: string
    lingua: string
    valuta: string
    fuso: string
    preview: string
    saved: string
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
  }
  sedi: {
    title: string
    subtitle: string
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
    renameTitle: string
    deleteTitle: string
  }
}

const it: Translations = {
  nav: {
    dashboard: 'Dashboard',
    fornitori: 'Fornitori',
    bolle: 'Bolle',
    fatture: 'Fatture',
    archivio: 'Archivio',
    logEmail: 'Log Email',
    sedi: 'Sedi e Utenti',
    impostazioni: 'Impostazioni',
    nuovaBolla: 'Nuova Bolla',
    esci: 'Esci',
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
    saving: 'Salvataggio...',
    attachment: 'Allegato',
    openAttachment: 'Apri allegato',
    detail: 'Dettaglio',
    add: '+ Aggiungi',
    rename: 'Rinomina',
    role: 'Ruolo',
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
    syncing: 'Sincronizzazione...',
    sendReminders: 'Invia Solleciti',
    sending: 'Invio in corso...',
    viewLog: 'Vedi Log',
    sedeOverview: 'Panoramica per Sede',
    manageSedi: 'Gestisci Sedi →',
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
    saving: 'Salvataggio...',
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
    fotoLabel: 'Foto / Allegato Bolla',
    fornitoreLabel: 'Fornitore',
    dataLabel: 'Data Bolla',
    dettaglio: 'Dettaglio Bolla',
    fattureCollegate: 'Fatture collegate',
    aggiungi: '+ Aggiungi',
    nessunaFatturaCollegata: 'Nessuna fattura collegata.',
    allegatoLink: 'Allegato →',
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
  },
  impostazioni: {
    title: 'Impostazioni',
    subtitle: 'Personalizza lingua, valuta e fuso orario',
    lingua: 'Lingua',
    valuta: 'Valuta',
    fuso: 'Fuso orario',
    preview: 'Anteprima',
    saved: 'Impostazioni salvate — aggiornamento in corso…',
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
  },
  sedi: {
    title: 'Sedi e Utenti',
    subtitle: 'Gestisci le sedi, la sincronizzazione email e gli operatori',
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
    adminRole: 'Admin',
    renameTitle: 'Rinomina',
    deleteTitle: 'Elimina',
  },
}

const en: Translations = {
  nav: {
    dashboard: 'Dashboard',
    fornitori: 'Suppliers',
    bolle: 'Delivery Notes',
    fatture: 'Invoices',
    archivio: 'Archive',
    logEmail: 'Email Log',
    sedi: 'Locations & Users',
    impostazioni: 'Settings',
    nuovaBolla: 'New Delivery Note',
    esci: 'Sign Out',
  },
  common: { save: 'Save', cancel: 'Cancel', delete: 'Delete', edit: 'Edit', new: 'New', loading: 'Loading...', error: 'Error', success: 'Success', noData: 'No data', document: 'Document', actions: 'Actions', date: 'Date', status: 'Status', supplier: 'Supplier', notes: 'Notes', saving: 'Saving...', attachment: 'Attachment', openAttachment: 'Open attachment', detail: 'Detail', add: '+ Add', rename: 'Rename', role: 'Role' },
  status: { inAttesa: 'Pending', completato: 'Completed', completata: 'Completed' },
  dashboard: { title: 'Dashboard', subtitle: 'Purchasing overview', suppliers: 'Suppliers', totalBills: 'Total delivery notes', pendingBills: 'Pending notes', invoices: 'Invoices', recentBills: 'Recent delivery notes', viewAll: 'View all →', syncEmail: 'Sync Email', syncing: 'Syncing...', sendReminders: 'Send Reminders', sending: 'Sending...', viewLog: 'View Log', sedeOverview: 'Overview by Location', manageSedi: 'Manage Locations →' },
  fornitori: { title: 'Suppliers', new: 'New Supplier', nome: 'Name / Company', email: 'Email', piva: 'VAT Number', noSuppliers: 'No suppliers yet.', addFirst: 'Add the first supplier →', editTitle: 'Edit Supplier', saveChanges: 'Save Changes', notFound: 'Supplier not found.', deleteConfirm: 'Delete this supplier? All linked delivery notes and invoices will also be deleted.', importaDaFattura: 'Import from Invoice', countLabel: 'suppliers registered', namePlaceholder: 'e.g. Smith & Co Ltd', emailPlaceholder: 'supplier@example.com', pivaLabel: 'VAT Number', pivaPlaceholder: 'GB123456789', saving: 'Saving...' },
  bolle: { title: 'Delivery Notes', new: 'New Delivery Note', uploadInvoice: 'Upload Invoice', viewDocument: 'View Document', noBills: 'No delivery notes yet.', addFirst: 'Register the first delivery note →', deleteConfirm: 'Delete this delivery note? Linked invoices will also be deleted.', ocrScanning: 'Recognizing supplier…', ocrMatched: 'Supplier recognized', ocrNotFound: 'Select supplier manually', ocrAnalyzing: 'Analyzing…', ocrAutoRecognized: 'Recognized automatically', ocrRead: 'Read:', selectManually: 'Select supplier', saveNote: 'Save Delivery Note', savingNote: 'Saving…', analyzingNote: 'Analyzing document…', takePhotoOrFile: 'Take photo or choose file', ocrHint: 'Supplier will be recognized automatically', cameraBtn: 'Camera', fileBtn: 'Choose file', countSingolo: 'delivery note registered', countPlural: 'delivery notes registered', fotoLabel: 'Photo / Delivery Note File', fornitoreLabel: 'Supplier', dataLabel: 'Delivery Note Date', dettaglio: 'Delivery Note Detail', fattureCollegate: 'Linked invoices', aggiungi: '+ Add', nessunaFatturaCollegata: 'No linked invoices.', allegatoLink: 'Attachment →' },
  fatture: { title: 'Invoices', new: 'New Invoice', noInvoices: 'No invoices yet.', addFirst: 'Add the first invoice →', invoice: 'Invoice', openBill: 'Open delivery note →', deleteConfirm: 'Delete this invoice? This action is irreversible.', countLabel: 'invoices received', headerBolla: 'Delivery Note', headerAllegato: 'Attachment', apri: 'Open →', caricaFatturaTitle: 'Upload Invoice', bollaMarkata: 'The delivery note will be marked as complete', collegataABolla: 'Linked to a delivery note', bollaPasseraCompletato: 'On save the delivery note will be set to "completed"', dataFattura: 'Invoice Date', fileFattura: 'Invoice File', caricaPdfFoto: 'Upload PDF or take photo', maxSize: 'PDF, JPG, PNG, WebP — max 10 MB', savingInProgress: 'Saving...', salvaChiudiBolla: 'Save and Close Delivery Note', dettaglio: 'Detail', bollaCollegata: 'Linked delivery note' },
  archivio: { title: 'Archive', subtitle: 'suppliers', noBills: 'No delivery notes', noInvoices: 'No invoices', withBill: 'With note', noEmail: 'No email', bollaS: 'note', bollaP: 'notes', fatturaS: 'invoice', fatturaP: 'invoices', editLink: 'Edit →', nuova: '+ New', nuovaFattura: '+ Invoice', documento: 'Document' },
  impostazioni: { title: 'Settings', subtitle: 'Customize language, currency and timezone', lingua: 'Language', valuta: 'Currency', fuso: 'Timezone', preview: 'Preview', saved: 'Settings saved — reloading…' },
  log: { title: 'Email Sync Log', subtitle: 'History of emails processed by automatic synchronization.', sender: 'Sender', subject: 'Subject', stato: 'Status', detail: 'Detail', retry: 'Retry', retrying: 'Retrying…', success: 'Success', bollaNotFound: 'Document Received', supplierNotFound: 'Unknown sender', noLogs: 'No logs yet.', emptyHint: 'Run an email sync from the Dashboard.', totalLogs: 'Total logs', linkedInvoices: 'Documents received', withErrors: 'With errors', vediFile: 'View file' },
  sedi: { title: 'Locations & Users', subtitle: 'Manage locations, email sync and operators', newSede: 'New Location', noSedi: 'No locations yet. Start by adding the first one.', users: 'Users', imap: 'Email Configuration (IMAP)', imapSubtitle: "Configure this location's email inbox. Invoices received here will be automatically matched to this location's suppliers.", imapHost: 'IMAP Host', imapHostPlaceholder: 'imap.gmail.com', imapPort: 'Port', imapUser: 'Email / Username', imapPassword: 'Password', imapPasswordPlaceholder: 'Password or App Password', testConnection: 'Test connection', saveConfig: 'Save configuration', notConfigured: 'Email not configured', accessDenied: 'Access restricted to administrators', accessDeniedHint: 'Contact your admin to get access.', creatingBtn: 'Creating...', createBtn: 'Create', nomePlaceholder: 'e.g. London Office', nessunUtente: 'No users found.', emailHeader: 'Email', sedeHeader: 'Location', ruoloHeader: 'Role', nessunaSedeOption: '— No location —', operatoreRole: 'Operator', adminRole: 'Admin', renameTitle: 'Rename', deleteTitle: 'Delete' },
}

const es: Translations = {
  nav: { dashboard: 'Panel', fornitori: 'Proveedores', bolle: 'Albaranes', fatture: 'Facturas', archivio: 'Archivo', logEmail: 'Log Email', sedi: 'Sedes y Usuarios', impostazioni: 'Configuración', nuovaBolla: 'Nuevo Albarán', esci: 'Cerrar sesión' },
  common: { save: 'Guardar', cancel: 'Cancelar', delete: 'Eliminar', edit: 'Editar', new: 'Nuevo', loading: 'Cargando...', error: 'Error', success: 'Éxito', noData: 'Sin datos', document: 'Documento', actions: 'Acciones', date: 'Fecha', status: 'Estado', supplier: 'Proveedor', notes: 'Notas', saving: 'Guardando...', attachment: 'Adjunto', openAttachment: 'Abrir adjunto', detail: 'Detalle', add: '+ Añadir', rename: 'Renombrar', role: 'Rol' },
  status: { inAttesa: 'Pendiente', completato: 'Completado', completata: 'Completada' },
  dashboard: { title: 'Panel', subtitle: 'Resumen de compras', suppliers: 'Proveedores', totalBills: 'Total albaranes', pendingBills: 'Albaranes pendientes', invoices: 'Facturas', recentBills: 'Albaranes recientes', viewAll: 'Ver todos →', syncEmail: 'Sincronizar Email', syncing: 'Sincronizando...', sendReminders: 'Enviar Recordatorios', sending: 'Enviando...', viewLog: 'Ver Log', sedeOverview: 'Resumen por Sede', manageSedi: 'Gestionar Sedes →' },
  fornitori: { title: 'Proveedores', new: 'Nuevo Proveedor', nome: 'Nombre / Empresa', email: 'Email', piva: 'NIF/CIF', noSuppliers: 'Sin proveedores.', addFirst: 'Añadir el primero →', editTitle: 'Editar Proveedor', saveChanges: 'Guardar Cambios', notFound: 'Proveedor no encontrado.', deleteConfirm: '¿Eliminar este proveedor? También se eliminarán todos los albaranes y facturas vinculados.', importaDaFattura: 'Importar de Factura', countLabel: 'proveedores registrados', namePlaceholder: 'Ej. Empresa S.L.', emailPlaceholder: 'proveedor@ejemplo.com', pivaLabel: 'NIF/CIF', pivaPlaceholder: 'A12345678', saving: 'Guardando...' },
  bolle: { title: 'Albaranes', new: 'Nuevo Albarán', uploadInvoice: 'Subir Factura', viewDocument: 'Ver Documento', noBills: 'Sin albaranes.', addFirst: 'Registrar el primero →', deleteConfirm: '¿Eliminar este albarán? También se eliminarán las facturas vinculadas.', ocrScanning: 'Reconociendo proveedor…', ocrMatched: 'Proveedor reconocido', ocrNotFound: 'Seleccionar proveedor manualmente', ocrAnalyzing: 'Analizando…', ocrAutoRecognized: 'Reconocido automáticamente', ocrRead: 'Leído:', selectManually: 'Seleccionar proveedor', saveNote: 'Guardar Albarán', savingNote: 'Guardando…', analyzingNote: 'Analizando documento…', takePhotoOrFile: 'Tomar foto o elegir archivo', ocrHint: 'El proveedor se reconocerá automáticamente', cameraBtn: 'Cámara', fileBtn: 'Elegir archivo', countSingolo: 'albarán registrado', countPlural: 'albaranes registrados', fotoLabel: 'Foto / Archivo Albarán', fornitoreLabel: 'Proveedor', dataLabel: 'Fecha Albarán', dettaglio: 'Detalle Albarán', fattureCollegate: 'Facturas vinculadas', aggiungi: '+ Añadir', nessunaFatturaCollegata: 'Sin facturas vinculadas.', allegatoLink: 'Adjunto →' },
  fatture: { title: 'Facturas', new: 'Nueva Factura', noInvoices: 'Sin facturas.', addFirst: 'Añadir la primera →', invoice: 'Factura', openBill: 'Abrir albarán →', deleteConfirm: '¿Eliminar esta factura? La operación es irreversible.', countLabel: 'facturas recibidas', headerBolla: 'Albarán', headerAllegato: 'Adjunto', apri: 'Abrir →', caricaFatturaTitle: 'Subir Factura', bollaMarkata: 'El albarán se marcará como completado', collegataABolla: 'Vinculada a un albarán', bollaPasseraCompletato: 'Al guardar el albarán pasará a "completado"', dataFattura: 'Fecha Factura', fileFattura: 'Archivo Factura', caricaPdfFoto: 'Subir PDF o tomar foto', maxSize: 'PDF, JPG, PNG, WebP — máx 10 MB', savingInProgress: 'Guardando...', salvaChiudiBolla: 'Guardar y Cerrar Albarán', dettaglio: 'Detalle', bollaCollegata: 'Albarán vinculado' },
  archivio: { title: 'Archivo', subtitle: 'proveedores', noBills: 'Sin albaranes', noInvoices: 'Sin facturas', withBill: 'Con albarán', noEmail: 'Sin email', bollaS: 'albarán', bollaP: 'albaranes', fatturaS: 'factura', fatturaP: 'facturas', editLink: 'Editar →', nuova: '+ Nuevo', nuovaFattura: '+ Factura', documento: 'Documento' },
  impostazioni: { title: 'Configuración', subtitle: 'Personalizar idioma, moneda y zona horaria', lingua: 'Idioma', valuta: 'Moneda', fuso: 'Zona horaria', preview: 'Vista previa', saved: 'Configuración guardada — actualizando…' },
  log: { title: 'Log Sincronización Email', subtitle: 'Historial de emails procesados por la sincronización automática.', sender: 'Remitente', subject: 'Asunto', stato: 'Estado', detail: 'Detalle', retry: 'Reintentar', retrying: 'Reintentando…', success: 'Éxito', bollaNotFound: 'Documento Recibido', supplierNotFound: 'Remitente desconocido', noLogs: 'Sin logs.', emptyHint: 'Ejecuta una sincronización de email desde el Panel.', totalLogs: 'Total logs', linkedInvoices: 'Documentos recibidos', withErrors: 'Con errores', vediFile: 'Ver archivo' },
  sedi: { title: 'Sedes y Usuarios', subtitle: 'Gestionar sedes, sincronización de email y operadores', newSede: 'Nueva Sede', noSedi: 'Sin sedes. Empieza añadiendo la primera.', users: 'Usuarios', imap: 'Configuración Email (IMAP)', imapSubtitle: 'Configura el buzón de esta sede. Las facturas recibidas aquí se asociarán automáticamente a los proveedores de la sede.', imapHost: 'Host IMAP', imapHostPlaceholder: 'imap.gmail.com', imapPort: 'Puerto', imapUser: 'Email / Usuario', imapPassword: 'Contraseña', imapPasswordPlaceholder: 'Contraseña o Contraseña de aplicación', testConnection: 'Probar conexión', saveConfig: 'Guardar configuración', notConfigured: 'Email no configurado', accessDenied: 'Acceso restringido a administradores', accessDeniedHint: 'Contacta al admin para obtener acceso.', creatingBtn: 'Creando...', createBtn: 'Crear', nomePlaceholder: 'Ej. Oficina Madrid', nessunUtente: 'No se encontraron usuarios.', emailHeader: 'Email', sedeHeader: 'Sede', ruoloHeader: 'Rol', nessunaSedeOption: '— Sin sede —', operatoreRole: 'Operador', adminRole: 'Admin', renameTitle: 'Renombrar', deleteTitle: 'Eliminar' },
}

const fr: Translations = {
  nav: { dashboard: 'Tableau de bord', fornitori: 'Fournisseurs', bolle: 'Bons de livraison', fatture: 'Factures', archivio: 'Archive', logEmail: 'Log Email', sedi: 'Sites & Utilisateurs', impostazioni: 'Paramètres', nuovaBolla: 'Nouveau BL', esci: 'Déconnexion' },
  common: { save: 'Enregistrer', cancel: 'Annuler', delete: 'Supprimer', edit: 'Modifier', new: 'Nouveau', loading: 'Chargement...', error: 'Erreur', success: 'Succès', noData: 'Aucune donnée', document: 'Document', actions: 'Actions', date: 'Date', status: 'Statut', supplier: 'Fournisseur', notes: 'Notes', saving: 'Enregistrement...', attachment: 'Pièce jointe', openAttachment: 'Ouvrir la pièce jointe', detail: 'Détail', add: '+ Ajouter', rename: 'Renommer', role: 'Rôle' },
  status: { inAttesa: 'En attente', completato: 'Complété', completata: 'Complétée' },
  dashboard: { title: 'Tableau de bord', subtitle: 'Aperçu des achats', suppliers: 'Fournisseurs', totalBills: 'Total BL', pendingBills: 'BL en attente', invoices: 'Factures', recentBills: 'BL récents', viewAll: 'Voir tout →', syncEmail: 'Sync Email', syncing: 'Synchronisation...', sendReminders: 'Envoyer Rappels', sending: 'Envoi en cours...', viewLog: 'Voir Log', sedeOverview: 'Vue par Site', manageSedi: 'Gérer les Sites →' },
  fornitori: { title: 'Fournisseurs', new: 'Nouveau Fournisseur', nome: 'Nom / Société', email: 'Email', piva: 'N° TVA', noSuppliers: 'Aucun fournisseur.', addFirst: 'Ajouter le premier →', editTitle: 'Modifier Fournisseur', saveChanges: 'Enregistrer', notFound: 'Fournisseur introuvable.', deleteConfirm: 'Supprimer ce fournisseur ? Tous les BL et factures liés seront supprimés.', importaDaFattura: 'Importer depuis Facture', countLabel: 'fournisseurs enregistrés', namePlaceholder: 'Ex. Dupont & Fils SARL', emailPlaceholder: 'fournisseur@exemple.fr', pivaLabel: 'N° TVA', pivaPlaceholder: 'FR12345678901', saving: 'Enregistrement...' },
  bolle: { title: 'Bons de livraison', new: 'Nouveau BL', uploadInvoice: 'Uploader Facture', viewDocument: 'Voir Document', noBills: 'Aucun BL.', addFirst: 'Créer le premier →', deleteConfirm: 'Supprimer ce BL ? Les factures liées seront supprimées.', ocrScanning: 'Reconnaissance fournisseur…', ocrMatched: 'Fournisseur reconnu', ocrNotFound: 'Sélectionner manuellement', ocrAnalyzing: 'Analyse en cours…', ocrAutoRecognized: 'Reconnu automatiquement', ocrRead: 'Lu :', selectManually: 'Sélectionner fournisseur', saveNote: 'Enregistrer BL', savingNote: 'Enregistrement…', analyzingNote: 'Analyse du document…', takePhotoOrFile: 'Prendre photo ou choisir fichier', ocrHint: 'Le fournisseur sera reconnu automatiquement', cameraBtn: 'Caméra', fileBtn: 'Choisir fichier', countSingolo: 'bon de livraison enregistré', countPlural: 'bons de livraison enregistrés', fotoLabel: 'Photo / Fichier BL', fornitoreLabel: 'Fournisseur', dataLabel: 'Date BL', dettaglio: 'Détail BL', fattureCollegate: 'Factures liées', aggiungi: '+ Ajouter', nessunaFatturaCollegata: 'Aucune facture liée.', allegatoLink: 'Pièce jointe →' },
  fatture: { title: 'Factures', new: 'Nouvelle Facture', noInvoices: 'Aucune facture.', addFirst: 'Ajouter la première →', invoice: 'Facture', openBill: 'Ouvrir BL →', deleteConfirm: 'Supprimer cette facture ? Action irréversible.', countLabel: 'factures reçues', headerBolla: 'Bon de livraison', headerAllegato: 'Pièce jointe', apri: 'Ouvrir →', caricaFatturaTitle: 'Uploader Facture', bollaMarkata: 'Le BL sera marqué comme complété', collegataABolla: 'Liée à un bon de livraison', bollaPasseraCompletato: 'À l\'enregistrement le BL passera à "complété"', dataFattura: 'Date Facture', fileFattura: 'Fichier Facture', caricaPdfFoto: 'Uploader PDF ou prendre photo', maxSize: 'PDF, JPG, PNG, WebP — max 10 Mo', savingInProgress: 'Enregistrement...', salvaChiudiBolla: 'Enregistrer et Clôturer BL', dettaglio: 'Détail', bollaCollegata: 'BL lié' },
  archivio: { title: 'Archive', subtitle: 'fournisseurs', noBills: 'Aucun BL', noInvoices: 'Aucune facture', withBill: 'Avec BL', noEmail: 'Aucun email', bollaS: 'bon', bollaP: 'bons', fatturaS: 'facture', fatturaP: 'factures', editLink: 'Modifier →', nuova: '+ Nouveau', nuovaFattura: '+ Facture', documento: 'Document' },
  impostazioni: { title: 'Paramètres', subtitle: 'Langue, devise et fuseau horaire', lingua: 'Langue', valuta: 'Devise', fuso: 'Fuseau horaire', preview: 'Aperçu', saved: 'Paramètres sauvegardés — rechargement…' },
  log: { title: 'Log Sync Email', subtitle: 'Historique des emails traités par la synchronisation automatique.', sender: 'Expéditeur', subject: 'Objet', stato: 'Statut', detail: 'Détail', retry: 'Réessayer', retrying: 'Réessai…', success: 'Succès', bollaNotFound: 'Document Reçu', supplierNotFound: 'Expéditeur inconnu', noLogs: 'Aucun log.', emptyHint: 'Lancez une synchronisation email depuis le Tableau de bord.', totalLogs: 'Total logs', linkedInvoices: 'Documents reçus', withErrors: 'Avec erreurs', vediFile: 'Voir fichier' },
  sedi: { title: 'Sites & Utilisateurs', subtitle: 'Gérer les sites, la sync email et les opérateurs', newSede: 'Nouveau Site', noSedi: 'Aucun site. Commencez par en ajouter un.', users: 'Utilisateurs', imap: 'Configuration Email (IMAP)', imapSubtitle: "Configurez la boîte mail de ce site. Les factures reçues ici seront associées automatiquement aux fournisseurs du site.", imapHost: 'Hôte IMAP', imapHostPlaceholder: 'imap.gmail.com', imapPort: 'Port', imapUser: 'Email / Utilisateur', imapPassword: 'Mot de passe', imapPasswordPlaceholder: 'Mot de passe ou Mot de passe d\'application', testConnection: 'Tester la connexion', saveConfig: 'Enregistrer la configuration', notConfigured: 'Email non configuré', accessDenied: 'Accès réservé aux administrateurs', accessDeniedHint: 'Contactez votre admin pour obtenir l\'accès.', creatingBtn: 'Création...', createBtn: 'Créer', nomePlaceholder: 'Ex. Bureau Paris', nessunUtente: 'Aucun utilisateur trouvé.', emailHeader: 'Email', sedeHeader: 'Site', ruoloHeader: 'Rôle', nessunaSedeOption: '— Aucun site —', operatoreRole: 'Opérateur', adminRole: 'Admin', renameTitle: 'Renommer', deleteTitle: 'Supprimer' },
}

const de: Translations = {
  nav: { dashboard: 'Dashboard', fornitori: 'Lieferanten', bolle: 'Lieferscheine', fatture: 'Rechnungen', archivio: 'Archiv', logEmail: 'E-Mail-Log', sedi: 'Standorte & Nutzer', impostazioni: 'Einstellungen', nuovaBolla: 'Neuer Lieferschein', esci: 'Abmelden' },
  common: { save: 'Speichern', cancel: 'Abbrechen', delete: 'Löschen', edit: 'Bearbeiten', new: 'Neu', loading: 'Laden...', error: 'Fehler', success: 'Erfolg', noData: 'Keine Daten', document: 'Dokument', actions: 'Aktionen', date: 'Datum', status: 'Status', supplier: 'Lieferant', notes: 'Notizen', saving: 'Speichern...', attachment: 'Anhang', openAttachment: 'Anhang öffnen', detail: 'Detail', add: '+ Hinzufügen', rename: 'Umbenennen', role: 'Rolle' },
  status: { inAttesa: 'Ausstehend', completato: 'Abgeschlossen', completata: 'Abgeschlossen' },
  dashboard: { title: 'Dashboard', subtitle: 'Einkaufsübersicht', suppliers: 'Lieferanten', totalBills: 'Lieferscheine gesamt', pendingBills: 'Ausstehende Scheine', invoices: 'Rechnungen', recentBills: 'Aktuelle Lieferscheine', viewAll: 'Alle anzeigen →', syncEmail: 'E-Mail synchronisieren', syncing: 'Synchronisierung...', sendReminders: 'Mahnungen senden', sending: 'Senden...', viewLog: 'Log anzeigen', sedeOverview: 'Übersicht nach Standort', manageSedi: 'Standorte verwalten →' },
  fornitori: { title: 'Lieferanten', new: 'Neuer Lieferant', nome: 'Name / Firma', email: 'E-Mail', piva: 'USt-IdNr.', noSuppliers: 'Keine Lieferanten.', addFirst: 'Ersten hinzufügen →', editTitle: 'Lieferant bearbeiten', saveChanges: 'Änderungen speichern', notFound: 'Lieferant nicht gefunden.', deleteConfirm: 'Diesen Lieferanten löschen? Alle verknüpften Lieferscheine und Rechnungen werden ebenfalls gelöscht.', importaDaFattura: 'Aus Rechnung importieren', countLabel: 'Lieferanten registriert', namePlaceholder: 'z.B. Müller GmbH', emailPlaceholder: 'lieferant@beispiel.de', pivaLabel: 'USt-IdNr.', pivaPlaceholder: 'DE123456789', saving: 'Speichern...' },
  bolle: { title: 'Lieferscheine', new: 'Neuer Lieferschein', uploadInvoice: 'Rechnung hochladen', viewDocument: 'Dokument anzeigen', noBills: 'Keine Lieferscheine.', addFirst: 'Ersten erstellen →', deleteConfirm: 'Diesen Lieferschein löschen? Verknüpfte Rechnungen werden ebenfalls gelöscht.', ocrScanning: 'Lieferant wird erkannt…', ocrMatched: 'Lieferant erkannt', ocrNotFound: 'Lieferant manuell auswählen', ocrAnalyzing: 'Analyse läuft…', ocrAutoRecognized: 'Automatisch erkannt', ocrRead: 'Gelesen:', selectManually: 'Lieferant auswählen', saveNote: 'Lieferschein speichern', savingNote: 'Wird gespeichert…', analyzingNote: 'Dokument wird analysiert…', takePhotoOrFile: 'Foto aufnehmen oder Datei wählen', ocrHint: 'Lieferant wird automatisch erkannt', cameraBtn: 'Kamera', fileBtn: 'Datei wählen', countSingolo: 'Lieferschein registriert', countPlural: 'Lieferscheine registriert', fotoLabel: 'Foto / Lieferschein-Datei', fornitoreLabel: 'Lieferant', dataLabel: 'Lieferscheindatum', dettaglio: 'Lieferschein-Details', fattureCollegate: 'Zugeordnete Rechnungen', aggiungi: '+ Hinzufügen', nessunaFatturaCollegata: 'Keine zugeordneten Rechnungen.', allegatoLink: 'Anhang →' },
  fatture: { title: 'Rechnungen', new: 'Neue Rechnung', noInvoices: 'Keine Rechnungen.', addFirst: 'Erste hinzufügen →', invoice: 'Rechnung', openBill: 'Lieferschein öffnen →', deleteConfirm: 'Diese Rechnung löschen? Aktion kann nicht rückgängig gemacht werden.', countLabel: 'eingegangene Rechnungen', headerBolla: 'Lieferschein', headerAllegato: 'Anhang', apri: 'Öffnen →', caricaFatturaTitle: 'Rechnung hochladen', bollaMarkata: 'Der Lieferschein wird als abgeschlossen markiert', collegataABolla: 'Mit Lieferschein verknüpft', bollaPasseraCompletato: 'Beim Speichern wird der Lieferschein auf "abgeschlossen" gesetzt', dataFattura: 'Rechnungsdatum', fileFattura: 'Rechnungsdatei', caricaPdfFoto: 'PDF hochladen oder Foto aufnehmen', maxSize: 'PDF, JPG, PNG, WebP — max 10 MB', savingInProgress: 'Wird gespeichert...', salvaChiudiBolla: 'Speichern und Lieferschein schließen', dettaglio: 'Details', bollaCollegata: 'Verknüpfter Lieferschein' },
  archivio: { title: 'Archiv', subtitle: 'Lieferanten', noBills: 'Keine Lieferscheine', noInvoices: 'Keine Rechnungen', withBill: 'Mit Schein', noEmail: 'Keine E-Mail', bollaS: 'Schein', bollaP: 'Scheine', fatturaS: 'Rechnung', fatturaP: 'Rechnungen', editLink: 'Bearbeiten →', nuova: '+ Neu', nuovaFattura: '+ Rechnung', documento: 'Dokument' },
  impostazioni: { title: 'Einstellungen', subtitle: 'Sprache, Währung und Zeitzone', lingua: 'Sprache', valuta: 'Währung', fuso: 'Zeitzone', preview: 'Vorschau', saved: 'Einstellungen gespeichert — wird neu geladen…' },
  log: { title: 'E-Mail-Sync-Log', subtitle: 'Verlauf der von der automatischen Synchronisierung verarbeiteten E-Mails.', sender: 'Absender', subject: 'Betreff', stato: 'Status', detail: 'Detail', retry: 'Erneut versuchen', retrying: 'Versuche erneut…', success: 'Erfolg', bollaNotFound: 'Dokument Empfangen', supplierNotFound: 'Unbekannter Absender', noLogs: 'Keine Logs.', emptyHint: 'Führen Sie eine E-Mail-Synchronisierung vom Dashboard aus durch.', totalLogs: 'Logs gesamt', linkedInvoices: 'Empfangene Dokumente', withErrors: 'Mit Fehlern', vediFile: 'Datei anzeigen' },
  sedi: { title: 'Standorte & Nutzer', subtitle: 'Standorte, E-Mail-Sync und Operatoren verwalten', newSede: 'Neuer Standort', noSedi: 'Keine Standorte. Fügen Sie den ersten hinzu.', users: 'Nutzer', imap: 'E-Mail-Konfiguration (IMAP)', imapSubtitle: 'Konfigurieren Sie das E-Mail-Postfach dieses Standorts. Eingehende Rechnungen werden automatisch den Lieferanten des Standorts zugeordnet.', imapHost: 'IMAP-Host', imapHostPlaceholder: 'imap.gmail.com', imapPort: 'Port', imapUser: 'E-Mail / Nutzer', imapPassword: 'Passwort', imapPasswordPlaceholder: 'Passwort oder App-Passwort', testConnection: 'Verbindung testen', saveConfig: 'Konfiguration speichern', notConfigured: 'E-Mail nicht konfiguriert', accessDenied: 'Zugang nur für Administratoren', accessDeniedHint: 'Wenden Sie sich an Ihren Administrator, um Zugang zu erhalten.', creatingBtn: 'Erstellen...', createBtn: 'Erstellen', nomePlaceholder: 'z.B. Büro Berlin', nessunUtente: 'Keine Nutzer gefunden.', emailHeader: 'E-Mail', sedeHeader: 'Standort', ruoloHeader: 'Rolle', nessunaSedeOption: '— Kein Standort —', operatoreRole: 'Operator', adminRole: 'Admin', renameTitle: 'Umbenennen', deleteTitle: 'Löschen' },
}

const dict: Record<Locale, Translations> = { it, en, es, fr, de }

export function getTranslations(locale: Locale = 'it'): Translations {
  return dict[locale] ?? dict.it
}

export type { Translations }
