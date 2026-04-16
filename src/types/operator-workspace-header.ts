export type OperatorWorkspaceHeaderPayload = {
  operatorScoped: boolean
  fiscalYear: number
  sollecitiFornitori: number
  counts: {
    ordini: number
    bolle: number
    fatture: number
    statements: number
    listino: number
    documenti: number
  } | null
}
