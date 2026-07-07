---
name: "auto-commit"
description: "Commits all changes automatically at the end of each modification session. Invoke when user wants the AI to commit after every code change."
---

# Auto-Commit

Questa skill impone il commit automatico dopo ogni modifica al codice.

## Regole

1. **Ogni volta che completi una modifica** a uno o più file, devi eseguire un commit git.
2. **Messaggio di commit**: Scrivi un messaggio descrittivo in italiano che riassuma cosa è stato modificato (es. "fix: corretto bug nel calcolo IVA").
3. **Non aspettare richiesta esplicita**: A differenza del comportamento predefinito, non devi chiedere all'utente se vuole un commit — devi farlo automaticamente.
4. **Commit atomici**: Raggruppa nello stesso commit solo modifiche logicamente correlate. Se stai facendo due attività indipendenti, fai due commit separati.
5. **Fasi del commit**:
   - Staging: `git add <file1> <file2> ...` (aggiungi solo i file modificati, non usare `git add -A`)
   - Commit: `git commit -m "messaggio descrittivo"`
6. **Non pusare**: Fai solo commit locali, non fare push automatico.

## Quando si attiva

- Dopo ogni modifica a file del progetto (bug fix, refactoring, nuova funzionalità, modifiche traduzioni, ecc.)
- Alla fine di ogni sessione di modifica prima di passare a un'altra attività

## Esempi

```
Modifica: correzione typo in en.ts
→ git commit -m "fix: corretto typo 'delivery notes and delivery notes' in en.ts"

Modifica: 3 bug fix in file separati
→ git add src/file1.ts src/file2.ts src/file3.ts
→ git commit -m "fix: risolti 3 bug nel calcolo IVA e duplicati bolla"
```
