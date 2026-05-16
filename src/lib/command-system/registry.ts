import type { Command, CommandContext, CommandGroupInfo, CommandId } from './types'

const comandi = new Map<CommandId, Command>()

export const GRUPPI: CommandGroupInfo[] = [
  { id: 'documento', label: 'Documento', ordine: 1 },
  { id: 'fattura', label: 'Fattura', ordine: 2 },
  { id: 'statement', label: 'Estratto Conto', ordine: 3 },
  { id: 'generale', label: 'Generale', ordine: 4 },
]

export function registraComando(cmd: Command): void {
  comandi.set(cmd.id, cmd)
}

export function getComando(id: CommandId): Command | undefined {
  return comandi.get(id)
}

export function tuttiComandi(): Command[] {
  return Array.from(comandi.values())
}

export function comandiPerGruppo(gruppo: CommandGroupInfo['id']): Command[] {
  return Array.from(comandi.values()).filter((c) => c.gruppo === gruppo)
}

export async function comandiApplicabili(ctx: CommandContext): Promise<Command[]> {
  const risultati: Command[] = []
  for (const cmd of comandi.values()) {
    const applicabile = await Promise.resolve(cmd.predicato(ctx))
    if (applicabile) risultati.push(cmd)
  }
  return risultati
}

export function registraComandiMulti(...cmds: Command[]): void {
  for (const cmd of cmds) {
    registraComando(cmd)
  }
}
