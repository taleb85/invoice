import type { Locale } from './translations'

export type GuidaItem = { title: string; desc: string; tip?: string }
export type GuidaSection = {
  id: string
  color: string
  title: string
  items: GuidaItem[]
}

type GuidaContent = {
  pageTitle: string
  pageSubtitle: string
  fnLabel: string   // "X funzioni"
  tipLabel: string  // "Suggerimento:"
  sections: GuidaSection[]
}

const IT: GuidaContent = {
  pageTitle: 'Guida all\'utilizzo',
  pageSubtitle: 'Tutte le funzionalità di FLUXO spiegate in dettaglio.',
  fnLabel: 'funzioni',
  tipLabel: 'Suggerimento:',
  sections: [
    {
      id: 'dashboard', color: 'blue', title: 'Dashboard',
      items: [
        { title: 'KPI in evidenza', desc: 'I riquadri colorati mostrano un riepilogo istantaneo: fornitori attivi, bolle totali, bolle in attesa e fatture registrate. Cliccandoli si accede direttamente alla sezione corrispondente.' },
        { title: 'Sincronizza Email', desc: 'Avvia la scansione della casella email configurata per la sede. Legge i nuovi messaggi, estrae i documenti allegati (PDF di fatture, bolle, estratti conto) e li aggiunge alla coda "Documenti da Elaborare".', tip: 'Eseguilo ogni mattina o dopo che un fornitore ha inviato documenti.' },
        { title: 'Invia Solleciti', desc: 'Invia automaticamente una email a tutti i fornitori con bolle aperte senza fattura associata. Il testo del sollecito viene adattato alla lingua del fornitore se disponibile.' },
        { title: 'Vedi Log', desc: 'Apre la pagina del log di sincronizzazione email con mittente, oggetto, esito del parsing AI e link al documento allegato.' },
        { title: 'Bolle recenti', desc: 'Tabella delle ultime bolle con fornitore, data, importo e stato: "In attesa" (senza fattura) o "Completato" (con fattura associata).' },
      ],
    },
    {
      id: 'fornitori', color: 'cyan', title: 'Fornitori',
      items: [
        { title: 'Scheda fornitore', desc: 'Ogni fornitore ha una scheda con avatar, nome, email e P.IVA. I tre contatori (Bolle, Fatture, Pending) mostrano il volume di lavoro attivo.' },
        { title: 'Tab Bolle', desc: 'Lista di tutte le bolle di consegna (DDT) del fornitore. Ogni riga mostra data, numero, importo e stato. Clicca "Apri" per vedere il dettaglio o il PDF.' },
        { title: 'Tab Fatture', desc: '"Associata" (blu) = fattura collegata a bolle; "Senza Bolla" (grigio) = collegamento ancora mancante.' },
        { title: 'Tab Estratto Conto', desc: 'Mostra gli statement ricevuti da quel fornitore con il risultato del triple-check automatico. Da qui puoi inviare solleciti mirati.' },
        { title: 'KPI cliccabili', desc: 'I quattro riquadri nel riepilogo (Bolle, Fatture, Pending, Riconciliazione) sono attivi: cliccandoli si passa direttamente alla tab corrispondente.', tip: 'Riconciliazione 100% = tutte le bolle hanno una fattura associata.' },
        { title: 'Nuova Bolla', desc: 'Il pulsante nell\'intestazione apre il form di creazione bolla con il fornitore già selezionato.' },
      ],
    },
    {
      id: 'bolle', color: 'green', title: 'Bolle (DDT)',
      items: [
        { title: 'Cos\'è una bolla', desc: 'Un DDT (Documento di Trasporto) è la conferma di ricezione merce. Precede sempre la fattura: prima si riceve la merce con il DDT, poi il fornitore emette la fattura.' },
        { title: 'Stati della bolla', desc: '"In attesa" (ambra) = bolla non ancora collegata a nessuna fattura. "Completato" (verde) = abbinata a una fattura, ciclo chiuso.' },
        { title: 'Rilevamento automatico', desc: 'Quando arriva un\'email con PDF allegato, l\'AI riconosce il DDT, estrae numero, data e importo, e crea la bolla associandola al fornitore corretto.' },
      ],
    },
    {
      id: 'fatture', color: 'purple', title: 'Fatture',
      items: [
        { title: 'Dati estratti dall\'AI', desc: 'Quando arriva una fattura PDF via email, GPT-4 estrae automaticamente: numero fattura, ragione sociale, P.IVA, data e importo totale IVA inclusa.' },
        { title: 'Associazione a bolle', desc: 'Collega la fattura alle bolle che copre selezionando le checkbox, oppure usa "✦ Suggerisci auto" che trova la combinazione esatta.', tip: 'Se la somma non coincide esattamente, appare "Mancano £X" o "Eccedenza £X" — puoi comunque procedere.' },
        { title: 'Scarto documento', desc: 'Se un documento non è rilevante (spam, conferme d\'ordine), clicca "Scarta" per rimuoverlo dalla coda. Resterà nel log con stato "Scartato".' },
      ],
    },
    {
      id: 'statements', color: 'orange', title: 'Estratti Conto (Statements)',
      items: [
        { title: 'Cos\'è uno Statement', desc: 'I fornitori inviano periodicamente un estratto conto con tutte le transazioni del periodo. Il sistema lo riconosce automaticamente dalle email con oggetto "Statement" o "Estratto Conto".' },
        { title: 'Triple Check automatico', desc: 'Per ogni riga dello statement: (1) esiste la fattura nel sistema? (2) esistono le bolle? (3) l\'importo coincide? Il risultato appare nella tab "Stato Verifica".' },
        { title: 'Badge di stato', desc: '"Matched" (verde) = tutto OK. "Missing Invoice" (arancione) = fattura mancante. "DDT Missing" (ambra) = bolle mancanti. "Amount Error" (rosso) = importo non coincide.' },
        { title: 'Colonna Checks', desc: 'Quattro quadratini: verde = superato, grigio = mancante. Rappresentano: riga ricevuta · fattura trovata · bolle presenti · importo corretto.' },
        { title: 'Pulsante Reminder', desc: 'Invia una email al fornitore chiedendo il documento mancante. Il testo viene adattato alla lingua del fornitore. Dopo l\'invio mostra "Inviato ✓" con data e ora.', tip: 'Disabilitato se il fornitore non ha un\'email registrata.' },
        { title: 'Filtri rapidi', desc: 'I chip nell\'intestazione filtrano le righe per tipo di anomalia. Clicca "Clear filter" per tornare alla vista completa.' },
      ],
    },
    {
      id: 'documenti', color: 'amber', title: 'Documenti da Elaborare',
      items: [
        { title: 'Card documento', desc: 'Ogni email con allegato genera una card con nome fornitore, oggetto email, data ricezione e link al PDF. L\'icona matita permette di correggere il fornitore se l\'AI l\'ha riconosciuto in modo errato.' },
        { title: 'Badge "Estratto mensile"', desc: 'Se il documento è classificato come Statement, appare questo badge blu. Cliccandolo si rimuove la classificazione.' },
        { title: 'Selezione bolle (checkbox)', desc: 'Seleziona le bolle da abbinare alla fattura. Le bolle dello stesso fornitore appaiono per prime. Il totale selezionato e la differenza dall\'importo AI sono mostrati in tempo reale.' },
        { title: '✦ Suggerisci auto', desc: 'Il sistema prova tutte le combinazioni di bolle e pre-seleziona quelle che sommano all\'importo esatto della fattura.' },
        { title: 'Associa', desc: 'Collega le bolle selezionate alla fattura. Si attiva appena si seleziona almeno una bolla. Con più bolle mostra il conteggio: "Associa (2)".' },
        { title: 'Scarta', desc: 'Marca il documento come non pertinente. Scompare dalla coda ma resta tracciato nel log.' },
      ],
    },
    {
      id: 'impostazioni', color: 'slate', title: 'Impostazioni',
      items: [
        { title: 'Lingua / Locale', desc: 'Cambia la lingua dell\'interfaccia tra Italiano, English, Español, Français e Deutsch. Influenza anche il formato delle date e i separatori numerici (1.234,56 in IT/DE vs 1,234.56 in EN).' },
        { title: 'Valuta', desc: 'Imposta il simbolo di valuta mostrato ovunque nell\'app (€, £, $, ecc.). Non converte gli importi — cambia solo il simbolo.' },
        { title: 'Fuso Orario', desc: 'Le date sono salvate in UTC nel database. Il fuso orario selezionato converte e mostra le date nella tua ora locale.', tip: 'Per le sedi UK: "Europe/London". Per l\'Italia: "Europe/Rome".' },
      ],
    },
  ],
}

const EN: GuidaContent = {
  pageTitle: 'User Guide',
  pageSubtitle: 'All FLUXO features explained in detail.',
  fnLabel: 'features',
  tipLabel: 'Tip:',
  sections: [
    {
      id: 'dashboard', color: 'blue', title: 'Dashboard',
      items: [
        { title: 'KPI overview', desc: 'The coloured tiles show an instant summary: active suppliers, total delivery notes, pending notes, and registered invoices. Click any tile to jump directly to that section.' },
        { title: 'Sync Email', desc: 'Starts scanning the mailbox configured for this location. It reads new messages, extracts attached documents (PDFs of invoices, delivery notes, statements) and adds them to the "Documents to Process" queue.', tip: 'Run it every morning or after a supplier sends documents.' },
        { title: 'Send Reminders', desc: 'Automatically sends an email to all suppliers who have open delivery notes without an associated invoice. The reminder text is adapted to the supplier\'s language if available.' },
        { title: 'View Log', desc: 'Opens the email sync log page showing sender, subject, AI parsing result and a link to the attached document.' },
        { title: 'Recent Delivery Notes', desc: 'Table of the latest delivery notes with supplier, date, amount and status: "Pending" (no invoice) or "Completed" (invoice associated).' },
      ],
    },
    {
      id: 'fornitori', color: 'cyan', title: 'Suppliers',
      items: [
        { title: 'Supplier card', desc: 'Each supplier has a card with avatar initials, name, email and VAT number. The three counters (Notes, Invoices, Pending) show the active workload.' },
        { title: 'Delivery Notes tab', desc: 'List of all delivery notes from this supplier. Each row shows date, number, amount and status. Click "Open" to view details or the PDF.' },
        { title: 'Invoices tab', desc: '"Associated" (blue) = invoice linked to delivery notes; "Without Note" (grey) = link still missing.' },
        { title: 'Statement tab', desc: 'Shows statements received from this supplier with the automatic triple-check result. From here you can send targeted reminders.' },
        { title: 'Clickable KPIs', desc: 'The four tiles in the summary tab (Notes, Invoices, Pending, Reconciliation) are active: clicking them switches directly to the corresponding tab.', tip: 'Reconciliation 100% = all delivery notes have an associated invoice.' },
        { title: 'New Note / New Invoice', desc: 'The header buttons open creation forms with the supplier already pre-selected.' },
      ],
    },
    {
      id: 'bolle', color: 'green', title: 'Delivery Notes (DDT)',
      items: [
        { title: 'What is a delivery note', desc: 'A delivery note (DDT) is the proof of goods received. It always precedes the invoice: goods arrive with a DDT, then the supplier issues the invoice.' },
        { title: 'Delivery note statuses', desc: '"Pending" (amber) = note not yet linked to an invoice. "Completed" (green) = matched to an invoice, cycle closed.' },
        { title: 'Automatic detection', desc: 'When an email arrives with a PDF attachment, the AI recognises it as a DDT, extracts number, date and amount, and creates the note linked to the correct supplier.' },
      ],
    },
    {
      id: 'fatture', color: 'purple', title: 'Invoices',
      items: [
        { title: 'AI-extracted data', desc: 'When an invoice PDF arrives by email, GPT-4 automatically extracts: invoice number, supplier name, VAT number, date and total amount including VAT.' },
        { title: 'Linking to delivery notes', desc: 'Link the invoice to the delivery notes it covers by selecting the checkboxes, or use "✦ Auto-suggest" which finds the exact matching combination.', tip: 'If the sum doesn\'t match exactly, "Missing £X" or "Excess £X" is shown — you can still proceed.' },
        { title: 'Discard document', desc: 'If a document is not relevant (spam, order confirmations), click "Discard" to remove it from the queue. It remains in the log with status "Discarded".' },
      ],
    },
    {
      id: 'statements', color: 'orange', title: 'Statements',
      items: [
        { title: 'What is a Statement', desc: 'Suppliers periodically send a statement listing all transactions for the period. The system detects it automatically from emails with subject "Statement" or "Estratto Conto".' },
        { title: 'Automatic Triple Check', desc: 'For each statement line: (1) does the invoice exist in the system? (2) do the delivery notes exist? (3) does the amount match? Results appear in the "Verification Status" tab.' },
        { title: 'Status badges', desc: '"Matched" (green) = all OK. "Missing Invoice" (orange) = no matching invoice found. "DDT Missing" (amber) = invoice present but delivery notes missing. "Amount Error" (red) = documents present but amount doesn\'t match.' },
        { title: 'Checks column', desc: 'Four coloured squares: green = passed, grey = missing. Represent: row received · invoice found · delivery notes present · amount correct.' },
        { title: 'Reminder button', desc: 'Sends an email to the supplier requesting the missing document. The text is adapted to the supplier\'s language. After sending it shows "Sent ✓" with date and time.', tip: 'Disabled if the supplier has no registered email.' },
        { title: 'Quick filters', desc: 'The chips in the table header filter rows by anomaly type. Click "Clear filter" to return to the full view.' },
      ],
    },
    {
      id: 'documenti', color: 'amber', title: 'Documents to Process',
      items: [
        { title: 'Document card', desc: 'Each email with an attachment generates a card showing supplier name, email subject, received date and a link to open the PDF. The pencil icon lets you correct the supplier if the AI got it wrong.' },
        { title: '"Monthly Statement" badge', desc: 'If the document is classified as a Statement, this blue badge appears. Clicking it removes the classification.' },
        { title: 'Delivery note selection (checkbox)', desc: 'Select the delivery notes to link to the invoice. Notes from the same supplier appear first. The selected total and difference from the AI amount are shown in real time.' },
        { title: '✦ Auto-suggest', desc: 'The system tries all combinations of available delivery notes and pre-selects those that sum to the exact invoice amount.' },
        { title: 'Associate', desc: 'Links the selected delivery notes to the invoice. Activates as soon as at least one note is selected. With multiple notes it shows the count: "Associate (2)".' },
        { title: 'Discard', desc: 'Marks the document as irrelevant. It disappears from the queue but remains tracked in the log.' },
      ],
    },
    {
      id: 'impostazioni', color: 'slate', title: 'Settings',
      items: [
        { title: 'Language / Locale', desc: 'Switch the interface language between Italian, English, Spanish, French and German. Also affects date formats and number separators (1,234.56 in EN vs 1.234,56 in IT/DE).' },
        { title: 'Currency', desc: 'Sets the currency symbol shown throughout the app (€, £, $, etc.). It does not convert amounts — it only changes the display symbol.' },
        { title: 'Timezone', desc: 'All dates are stored as UTC in the database. The selected timezone converts and displays dates in your local time.', tip: 'For UK locations: "Europe/London". For Italy: "Europe/Rome".' },
      ],
    },
  ],
}

const ES: GuidaContent = {
  pageTitle: 'Guía de uso',
  pageSubtitle: 'Todas las funciones de FLUXO explicadas en detalle.',
  fnLabel: 'funciones',
  tipLabel: 'Consejo:',
  sections: [
    {
      id: 'dashboard', color: 'blue', title: 'Panel',
      items: [
        { title: 'Indicadores KPI', desc: 'Los bloques de colores muestran un resumen instantáneo: proveedores activos, albaranes totales, albaranes pendientes y facturas registradas. Haz clic para acceder directamente a cada sección.' },
        { title: 'Sincronizar Email', desc: 'Inicia el escaneo del buzón configurado para la sede. Lee los nuevos mensajes, extrae los documentos adjuntos y los añade a la cola "Documentos a procesar".', tip: 'Ejecútalo cada mañana o cuando un proveedor envíe documentos.' },
        { title: 'Enviar Recordatorios', desc: 'Envía automáticamente un email a todos los proveedores con albaranes abiertos sin factura asociada. El texto se adapta al idioma del proveedor si está disponible.' },
        { title: 'Ver Log', desc: 'Abre la página del registro de sincronización de email con remitente, asunto, resultado del parsing IA y enlace al documento adjunto.' },
        { title: 'Albaranes recientes', desc: 'Tabla de los últimos albaranes con proveedor, fecha, importe y estado: "Pendiente" (sin factura) o "Completado" (con factura asociada).' },
      ],
    },
    {
      id: 'fornitori', color: 'cyan', title: 'Proveedores',
      items: [
        { title: 'Ficha de proveedor', desc: 'Cada proveedor tiene una ficha con avatar, nombre, email y NIF. Los tres contadores (Albaranes, Facturas, Pendiente) muestran la carga de trabajo activa.' },
        { title: 'Pestaña Albaranes', desc: 'Lista de todos los albaranes del proveedor. Cada fila muestra fecha, número, importe y estado. Haz clic en "Abrir" para ver el detalle o el PDF.' },
        { title: 'Pestaña Facturas', desc: '"Asociada" (azul) = factura vinculada a albaranes; "Sin Albarán" (gris) = vínculo aún pendiente.' },
        { title: 'Pestaña Extracto', desc: 'Muestra los estados de cuenta recibidos de ese proveedor con el resultado del triple control automático.' },
        { title: 'KPIs clicables', desc: 'Los cuatro bloques del resumen son activos: al hacer clic se cambia directamente a la pestaña correspondiente.', tip: 'Reconciliación 100% = todos los albaranes tienen factura asociada.' },
        { title: 'Nuevo Albarán / Nueva Factura', desc: 'Los botones del encabezado abren los formularios de creación con el proveedor ya preseleccionado.' },
      ],
    },
    {
      id: 'bolle', color: 'green', title: 'Albaranes (DDT)',
      items: [
        { title: 'Qué es un albarán', desc: 'Un albarán es la confirmación de recepción de mercancía. Siempre precede a la factura: primero llega la mercancía con el albarán, luego el proveedor emite la factura.' },
        { title: 'Estados del albarán', desc: '"Pendiente" (ámbar) = aún no vinculado a ninguna factura. "Completado" (verde) = asociado a una factura, ciclo cerrado.' },
        { title: 'Detección automática', desc: 'Cuando llega un email con PDF adjunto, la IA lo reconoce como albarán, extrae número, fecha e importe, y crea el registro vinculado al proveedor correcto.' },
      ],
    },
    {
      id: 'fatture', color: 'purple', title: 'Facturas',
      items: [
        { title: 'Datos extraídos por IA', desc: 'Cuando llega una factura PDF por email, GPT-4 extrae automáticamente: número de factura, razón social, NIF, fecha e importe total con IVA.' },
        { title: 'Asociación a albaranes', desc: 'Vincula la factura a los albaranes que cubre seleccionando las casillas, o usa "✦ Auto-sugerir" que encuentra la combinación exacta.', tip: 'Si la suma no coincide exactamente, se muestra "Faltan X€" o "Excedente X€" — puedes continuar de todas formas.' },
        { title: 'Descartar documento', desc: 'Si un documento no es relevante, haz clic en "Descartar" para retirarlo de la cola. Permanece en el registro con estado "Descartado".' },
      ],
    },
    {
      id: 'statements', color: 'orange', title: 'Extractos de Cuenta',
      items: [
        { title: 'Qué es un Statement', desc: 'Los proveedores envían periódicamente un extracto con todas las transacciones del período. El sistema lo detecta automáticamente en emails con asunto "Statement" o "Extracto".' },
        { title: 'Triple Control automático', desc: 'Para cada línea del extracto: (1) ¿existe la factura en el sistema? (2) ¿existen los albaranes? (3) ¿coincide el importe? Los resultados aparecen en "Estado de Verificación".' },
        { title: 'Badges de estado', desc: '"Matched" (verde) = todo OK. "Missing Invoice" (naranja) = factura no encontrada. "DDT Missing" (ámbar) = albaranes faltantes. "Amount Error" (rojo) = importe no coincide.' },
        { title: 'Columna Checks', desc: 'Cuatro cuadrados: verde = superado, gris = faltante. Representan: línea recibida · factura encontrada · albaranes presentes · importe correcto.' },
        { title: 'Botón Reminder', desc: 'Envía un email al proveedor solicitando el documento faltante. El texto se adapta al idioma del proveedor. Tras el envío muestra "Enviado ✓".', tip: 'Deshabilitado si el proveedor no tiene email registrado.' },
        { title: 'Filtros rápidos', desc: 'Los chips del encabezado filtran las filas por tipo de anomalía. Haz clic en "Clear filter" para volver a la vista completa.' },
      ],
    },
    {
      id: 'documenti', color: 'amber', title: 'Documentos a Procesar',
      items: [
        { title: 'Tarjeta de documento', desc: 'Cada email con adjunto genera una tarjeta con nombre del proveedor, asunto, fecha de recepción y enlace al PDF. El icono lápiz permite corregir el proveedor si la IA lo detectó mal.' },
        { title: 'Badge "Extracto mensual"', desc: 'Si el documento es un extracto, aparece este badge azul. Al hacer clic se elimina la clasificación.' },
        { title: 'Selección de albaranes', desc: 'Selecciona los albaranes a vincular a la factura. Los del mismo proveedor aparecen primero. El total seleccionado y la diferencia con el importe IA se muestran en tiempo real.' },
        { title: '✦ Auto-sugerir', desc: 'El sistema prueba todas las combinaciones de albaranes y preselecciona los que sumen exactamente el importe de la factura.' },
        { title: 'Asociar', desc: 'Vincula los albaranes seleccionados a la factura. Se activa en cuanto se selecciona al menos uno. Con varios muestra el conteo: "Asociar (2)".' },
        { title: 'Descartar', desc: 'Marca el documento como no relevante. Desaparece de la cola pero queda registrado en el log.' },
      ],
    },
    {
      id: 'impostazioni', color: 'slate', title: 'Configuración',
      items: [
        { title: 'Idioma / Locale', desc: 'Cambia el idioma entre Italiano, English, Español, Français y Deutsch. También afecta el formato de fechas y separadores numéricos.' },
        { title: 'Moneda', desc: 'Establece el símbolo de moneda mostrado en toda la app (€, £, $, etc.). No convierte importes — solo cambia el símbolo.' },
        { title: 'Zona horaria', desc: 'Las fechas se guardan en UTC. La zona horaria seleccionada las convierte a tu hora local.', tip: 'Para sedes UK: "Europe/London". Para España: "Europe/Madrid".' },
      ],
    },
  ],
}

const FR: GuidaContent = {
  pageTitle: 'Guide d\'utilisation',
  pageSubtitle: 'Toutes les fonctionnalités de FLUXO expliquées en détail.',
  fnLabel: 'fonctions',
  tipLabel: 'Conseil :',
  sections: [
    {
      id: 'dashboard', color: 'blue', title: 'Tableau de bord',
      items: [
        { title: 'Indicateurs KPI', desc: 'Les blocs colorés affichent un résumé instantané : fournisseurs actifs, bons de livraison totaux, bons en attente et factures enregistrées. Cliquez pour accéder directement à chaque section.' },
        { title: 'Synchroniser Email', desc: 'Lance le scan de la boîte email configurée pour le site. Lit les nouveaux messages, extrait les pièces jointes (PDF de factures, bons, relevés) et les ajoute à la file "Documents à traiter".', tip: 'Lancez-le chaque matin ou dès qu\'un fournisseur envoie des documents.' },
        { title: 'Envoyer des Rappels', desc: 'Envoie automatiquement un email à tous les fournisseurs ayant des bons de livraison ouverts sans facture associée. Le texte est adapté à la langue du fournisseur si disponible.' },
        { title: 'Voir le Journal', desc: 'Ouvre la page du journal de synchronisation email avec expéditeur, objet, résultat du parsing IA et lien vers la pièce jointe.' },
        { title: 'Bons récents', desc: 'Tableau des derniers bons avec fournisseur, date, montant et statut : "En attente" (sans facture) ou "Terminé" (avec facture associée).' },
      ],
    },
    {
      id: 'fornitori', color: 'cyan', title: 'Fournisseurs',
      items: [
        { title: 'Fiche fournisseur', desc: 'Chaque fournisseur a une fiche avec avatar, nom, email et numéro de TVA. Les trois compteurs (Bons, Factures, En attente) montrent la charge de travail active.' },
        { title: 'Onglet Bons de livraison', desc: 'Liste de tous les bons du fournisseur. Chaque ligne affiche date, numéro, montant et statut. Cliquez "Ouvrir" pour voir le détail ou le PDF.' },
        { title: 'Onglet Factures', desc: '"Associée" (bleu) = facture liée à des bons; "Sans Bon" (gris) = lien encore manquant.' },
        { title: 'Onglet Relevé', desc: 'Affiche les relevés reçus de ce fournisseur avec le résultat du triple contrôle automatique.' },
        { title: 'KPIs cliquables', desc: 'Les quatre blocs du résumé sont actifs : cliquez pour basculer directement vers l\'onglet correspondant.', tip: 'Réconciliation 100% = tous les bons ont une facture associée.' },
        { title: 'Nouveau Bon / Nouvelle Facture', desc: 'Les boutons de l\'en-tête ouvrent les formulaires de création avec le fournisseur déjà présélectionné.' },
      ],
    },
    {
      id: 'bolle', color: 'green', title: 'Bons de livraison',
      items: [
        { title: 'Qu\'est-ce qu\'un bon', desc: 'Un bon de livraison est la confirmation de réception des marchandises. Il précède toujours la facture : les marchandises arrivent avec le bon, puis le fournisseur émet la facture.' },
        { title: 'Statuts du bon', desc: '"En attente" (ambre) = bon non encore lié à une facture. "Terminé" (vert) = associé à une facture, cycle fermé.' },
        { title: 'Détection automatique', desc: 'Quand un email arrive avec un PDF en pièce jointe, l\'IA reconnaît le bon, extrait numéro, date et montant, et crée l\'enregistrement lié au bon fournisseur.' },
      ],
    },
    {
      id: 'fatture', color: 'purple', title: 'Factures',
      items: [
        { title: 'Données extraites par l\'IA', desc: 'Quand une facture PDF arrive par email, GPT-4 extrait automatiquement : numéro de facture, raison sociale, TVA, date et montant total TTC.' },
        { title: 'Association aux bons', desc: 'Liez la facture aux bons qu\'elle couvre en sélectionnant les cases à cocher, ou utilisez "✦ Auto-suggérer" qui trouve la combinaison exacte.', tip: 'Si la somme ne correspond pas exactement, "Manque X€" ou "Excédent X€" est affiché — vous pouvez quand même continuer.' },
        { title: 'Rejeter le document', desc: 'Si un document n\'est pas pertinent, cliquez "Rejeter" pour le retirer de la file. Il reste dans le journal avec le statut "Rejeté".' },
      ],
    },
    {
      id: 'statements', color: 'orange', title: 'Relevés de compte',
      items: [
        { title: 'Qu\'est-ce qu\'un relevé', desc: 'Les fournisseurs envoient périodiquement un relevé listant toutes les transactions de la période. Le système le détecte automatiquement dans les emails avec objet "Statement" ou "Relevé".' },
        { title: 'Triple contrôle automatique', desc: 'Pour chaque ligne du relevé : (1) la facture existe-t-elle ? (2) les bons existent-ils ? (3) le montant correspond-il ? Les résultats apparaissent dans "État de Vérification".' },
        { title: 'Badges de statut', desc: '"Matched" (vert) = tout OK. "Missing Invoice" (orange) = facture introuvable. "DDT Missing" (ambre) = bons manquants. "Amount Error" (rouge) = montant incorrect.' },
        { title: 'Colonne Checks', desc: 'Quatre carrés : vert = réussi, gris = manquant. Ils représentent : ligne reçue · facture trouvée · bons présents · montant correct.' },
        { title: 'Bouton Rappel', desc: 'Envoie un email au fournisseur demandant le document manquant. Le texte est adapté à la langue du fournisseur. Après envoi affiche "Envoyé ✓".', tip: 'Désactivé si le fournisseur n\'a pas d\'email enregistré.' },
        { title: 'Filtres rapides', desc: 'Les puces dans l\'en-tête filtrent les lignes par type d\'anomalie. Cliquez "Clear filter" pour revenir à la vue complète.' },
      ],
    },
    {
      id: 'documenti', color: 'amber', title: 'Documents à Traiter',
      items: [
        { title: 'Carte document', desc: 'Chaque email avec pièce jointe génère une carte avec nom du fournisseur, objet, date de réception et lien vers le PDF. L\'icône crayon permet de corriger le fournisseur si l\'IA s\'est trompée.' },
        { title: 'Badge "Relevé mensuel"', desc: 'Si le document est un relevé, ce badge bleu apparaît. Cliquer dessus supprime la classification.' },
        { title: 'Sélection des bons', desc: 'Sélectionnez les bons à lier à la facture. Les bons du même fournisseur apparaissent en premier. Le total sélectionné et la différence avec le montant IA sont affichés en temps réel.' },
        { title: '✦ Auto-suggérer', desc: 'Le système essaie toutes les combinaisons de bons et présélectionne ceux dont la somme correspond exactement au montant de la facture.' },
        { title: 'Associer', desc: 'Lie les bons sélectionnés à la facture. S\'active dès qu\'au moins un bon est sélectionné. Avec plusieurs bons affiche le compte : "Associer (2)".' },
        { title: 'Rejeter', desc: 'Marque le document comme non pertinent. Disparaît de la file mais reste enregistré dans le journal.' },
      ],
    },
    {
      id: 'impostazioni', color: 'slate', title: 'Paramètres',
      items: [
        { title: 'Langue / Locale', desc: 'Changez la langue entre Italien, English, Español, Français et Deutsch. Affecte également le format des dates et les séparateurs numériques.' },
        { title: 'Devise', desc: 'Définit le symbole de devise affiché dans toute l\'application (€, £, $, etc.). Ne convertit pas les montants — change uniquement le symbole.' },
        { title: 'Fuseau horaire', desc: 'Les dates sont stockées en UTC. Le fuseau sélectionné les convertit à votre heure locale.', tip: 'Pour les sites UK : "Europe/London". Pour la France : "Europe/Paris".' },
      ],
    },
  ],
}

const DE: GuidaContent = {
  pageTitle: 'Benutzerhandbuch',
  pageSubtitle: 'Alle FLUXO-Funktionen im Detail erklärt.',
  fnLabel: 'Funktionen',
  tipLabel: 'Tipp:',
  sections: [
    {
      id: 'dashboard', color: 'blue', title: 'Dashboard',
      items: [
        { title: 'KPI-Übersicht', desc: 'Die farbigen Kacheln zeigen eine sofortige Zusammenfassung: aktive Lieferanten, Gesamtlieferscheine, ausstehende Scheine und erfasste Rechnungen. Klicken Sie, um direkt zum jeweiligen Bereich zu gelangen.' },
        { title: 'E-Mail synchronisieren', desc: 'Startet den Scan des für diesen Standort konfigurierten Postfachs. Liest neue Nachrichten, extrahiert angehängte Dokumente (PDFs von Rechnungen, Lieferscheinen, Kontoauszügen) und fügt sie der Warteschlange hinzu.', tip: 'Jeden Morgen ausführen oder sobald ein Lieferant Dokumente sendet.' },
        { title: 'Erinnerungen senden', desc: 'Sendet automatisch eine E-Mail an alle Lieferanten mit offenen Lieferscheinen ohne zugehörige Rechnung. Der Text wird an die Sprache des Lieferanten angepasst.' },
        { title: 'Log anzeigen', desc: 'Öffnet die E-Mail-Synchronisierungs-Log-Seite mit Absender, Betreff, KI-Parsing-Ergebnis und Link zum angehängten Dokument.' },
        { title: 'Aktuelle Lieferscheine', desc: 'Tabelle der neuesten Lieferscheine mit Lieferant, Datum, Betrag und Status: "Ausstehend" (ohne Rechnung) oder "Abgeschlossen" (mit zugehöriger Rechnung).' },
      ],
    },
    {
      id: 'fornitori', color: 'cyan', title: 'Lieferanten',
      items: [
        { title: 'Lieferantenkarte', desc: 'Jeder Lieferant hat eine Karte mit Avatar, Name, E-Mail und USt-IdNr. Die drei Zähler (Lieferscheine, Rechnungen, Ausstehend) zeigen die aktive Arbeitslast.' },
        { title: 'Reiter Lieferscheine', desc: 'Liste aller Lieferscheine dieses Lieferanten. Jede Zeile zeigt Datum, Nummer, Betrag und Status. Klicken Sie "Öffnen" für Details oder das PDF.' },
        { title: 'Reiter Rechnungen', desc: '"Zugeordnet" (blau) = Rechnung mit Lieferscheinen verknüpft; "Ohne Schein" (grau) = Verknüpfung fehlt noch.' },
        { title: 'Reiter Kontoauszug', desc: 'Zeigt die von diesem Lieferanten empfangenen Auszüge mit dem Ergebnis der automatischen Dreifachprüfung.' },
        { title: 'Klickbare KPIs', desc: 'Die vier Kacheln in der Übersicht sind aktiv: Klicken wechselt direkt zum entsprechenden Reiter.', tip: 'Abstimmung 100% = alle Lieferscheine haben eine zugehörige Rechnung.' },
        { title: 'Neuer Lieferschein / Neue Rechnung', desc: 'Die Header-Schaltflächen öffnen Erstellungsformulare mit dem bereits vorausgefüllten Lieferanten.' },
      ],
    },
    {
      id: 'bolle', color: 'green', title: 'Lieferscheine',
      items: [
        { title: 'Was ist ein Lieferschein', desc: 'Ein Lieferschein ist die Empfangsbestätigung für Waren. Er geht immer der Rechnung voraus: Waren kommen mit Lieferschein, dann stellt der Lieferant die Rechnung aus.' },
        { title: 'Lieferschein-Status', desc: '"Ausstehend" (gelb) = noch nicht mit einer Rechnung verknüpft. "Abgeschlossen" (grün) = einer Rechnung zugeordnet, Zyklus geschlossen.' },
        { title: 'Automatische Erkennung', desc: 'Wenn eine E-Mail mit PDF-Anhang ankommt, erkennt die KI den Lieferschein, extrahiert Nummer, Datum und Betrag und erstellt den Eintrag verknüpft mit dem richtigen Lieferanten.' },
      ],
    },
    {
      id: 'fatture', color: 'purple', title: 'Rechnungen',
      items: [
        { title: 'KI-extrahierte Daten', desc: 'Wenn eine Rechnungs-PDF per E-Mail eintrifft, extrahiert GPT-4 automatisch: Rechnungsnummer, Firmenname, USt-IdNr., Datum und Gesamtbetrag inkl. MwSt.' },
        { title: 'Verknüpfung mit Lieferscheinen', desc: 'Verknüpfen Sie die Rechnung mit den abgedeckten Lieferscheinen durch Auswahl der Checkboxen, oder nutzen Sie "✦ Auto-Vorschlag" für die exakte Kombination.', tip: 'Stimmt die Summe nicht genau, wird "Fehlend X€" oder "Überschuss X€" angezeigt — Sie können trotzdem fortfahren.' },
        { title: 'Dokument verwerfen', desc: 'Wenn ein Dokument nicht relevant ist, klicken Sie "Verwerfen". Es verschwindet aus der Warteschlange bleibt aber im Log mit Status "Verworfen".' },
      ],
    },
    {
      id: 'statements', color: 'orange', title: 'Kontoauszüge',
      items: [
        { title: 'Was ist ein Kontoauszug', desc: 'Lieferanten senden regelmäßig einen Auszug mit allen Transaktionen des Zeitraums. Das System erkennt ihn automatisch in E-Mails mit Betreff "Statement" oder "Kontoauszug".' },
        { title: 'Automatische Dreifachprüfung', desc: 'Für jede Auszugszeile: (1) Gibt es die Rechnung im System? (2) Gibt es die Lieferscheine? (3) Stimmt der Betrag? Ergebnisse erscheinen im Reiter "Prüfungsstatus".' },
        { title: 'Status-Badges', desc: '"Matched" (grün) = alles OK. "Missing Invoice" (orange) = Rechnung nicht gefunden. "DDT Missing" (gelb) = Lieferscheine fehlen. "Amount Error" (rot) = Betrag stimmt nicht.' },
        { title: 'Checks-Spalte', desc: 'Vier farbige Quadrate: grün = bestanden, grau = fehlend. Stehen für: Zeile empfangen · Rechnung gefunden · Lieferscheine vorhanden · Betrag korrekt.' },
        { title: 'Erinnerungs-Schaltfläche', desc: 'Sendet eine E-Mail an den Lieferanten mit der Anforderung des fehlenden Dokuments. Text wird an die Sprache des Lieferanten angepasst. Nach dem Senden wird "Gesendet ✓" angezeigt.', tip: 'Deaktiviert, wenn der Lieferant keine registrierte E-Mail hat.' },
        { title: 'Schnellfilter', desc: 'Die Chips im Tabellenkopf filtern Zeilen nach Anomalietyp. Klicken Sie "Clear filter" um zur vollständigen Ansicht zurückzukehren.' },
      ],
    },
    {
      id: 'documenti', color: 'amber', title: 'Zu verarbeitende Dokumente',
      items: [
        { title: 'Dokumentkarte', desc: 'Jede E-Mail mit Anhang erzeugt eine Karte mit Lieferantenname, Betreff, Empfangsdatum und PDF-Link. Das Bleistift-Symbol ermöglicht die Korrektur des Lieferanten, wenn die KI ihn falsch erkannt hat.' },
        { title: 'Badge "Monatlicher Auszug"', desc: 'Wenn das Dokument als Kontoauszug klassifiziert wird, erscheint dieses blaue Badge. Klicken entfernt die Klassifizierung.' },
        { title: 'Lieferschein-Auswahl', desc: 'Wählen Sie die mit der Rechnung zu verknüpfenden Lieferscheine aus. Scheine desselben Lieferanten erscheinen zuerst. Die ausgewählte Summe und die Differenz zum KI-Betrag werden in Echtzeit angezeigt.' },
        { title: '✦ Auto-Vorschlag', desc: 'Das System probiert alle Kombinationen aus und wählt die Lieferscheine vor, deren Summe genau dem Rechnungsbetrag entspricht.' },
        { title: 'Zuordnen', desc: 'Verknüpft die ausgewählten Lieferscheine mit der Rechnung. Aktiviert sich, sobald mindestens ein Schein ausgewählt ist. Mit mehreren Scheinen wird die Anzahl angezeigt: "Zuordnen (2)".' },
        { title: 'Verwerfen', desc: 'Markiert das Dokument als nicht relevant. Verschwindet aus der Warteschlange, bleibt aber im Log erfasst.' },
      ],
    },
    {
      id: 'impostazioni', color: 'slate', title: 'Einstellungen',
      items: [
        { title: 'Sprache / Locale', desc: 'Wechseln Sie die Sprache zwischen Italiano, English, Español, Français und Deutsch. Beeinflusst auch Datumsformate und Zahlentrennzeichen.' },
        { title: 'Währung', desc: 'Setzt das in der gesamten App angezeigte Währungssymbol (€, £, $, usw.). Konvertiert keine Beträge — ändert nur das Symbol.' },
        { title: 'Zeitzone', desc: 'Datumsangaben werden als UTC gespeichert. Die gewählte Zeitzone konvertiert sie in Ihre Ortszeit.', tip: 'Für UK-Standorte: "Europe/London". Für Deutschland: "Europe/Berlin".' },
      ],
    },
  ],
}

const CONTENT: Record<Locale, GuidaContent> = {
  it: IT,
  en: EN,
  es: ES,
  fr: FR,
  de: DE,
}

export function getGuidaContent(locale: Locale): GuidaContent {
  return CONTENT[locale] ?? CONTENT.en
}
