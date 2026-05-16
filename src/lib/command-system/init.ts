import { inizializzaComandi } from './commands'

let initialized = false

export function INITIALIZE_COMMANDS(): void {
  if (initialized) return
  inizializzaComandi()
  initialized = true
}
