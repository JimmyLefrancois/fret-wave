/**
 * Synchro automatique du journal et des coches d'accords quand le compte est connecté (D117, D140).
 * Déclenchée à l'ouverture, après chaque tentative ou coche (regroupées), au retour de la page et au retour du réseau. Sans session, elle ne
 * fait rien ; hors build de production, elle n'existe pas.
 */
import { ACCOUNTS_ENABLED, fetchAccount } from '../core/account/client';
import { syncChordMarks, syncJournal } from '../core/account/journalSync';
import { CHORD_MARKS_CHANGED } from '../core/progress/chordMarks';
import { JOURNAL_CHANGED, JOURNAL_SYNCED, progressStore } from '../core/progress/journal';

const DEBOUNCE_MS = 1500;

let started = false;
let enabled = false;
let timer: number | undefined;
let running: Promise<void> | null = null;
let again = false;

async function run(): Promise<void> {
  if (!enabled) return;
  if (running) {
    // une tentative arrive pendant l'envoi : on repasse une fois de plus à la fin
    again = true;
    return running;
  }
  running = (async () => {
    do {
      again = false;
      // une panne sur les coches n'empêche pas le journal, et inversement : chacune repassera à la prochaine synchro
      const journal = await syncJournal(progressStore());
      const marks = journal === 'signedOut' ? journal : await syncChordMarks(progressStore());
      if (marks === 'signedOut') {
        enabled = false;
        return;
      }
    } while (again);
    window.dispatchEvent(new Event(JOURNAL_SYNCED));
  })().finally(() => {
    running = null;
  });
  return running;
}

function schedule(): void {
  if (!enabled) return;
  window.clearTimeout(timer);
  timer = window.setTimeout(() => void run(), DEBOUNCE_MS);
}

export async function startJournalSync(): Promise<void> {
  if (!ACCOUNTS_ENABLED || started) return;
  started = true;
  window.addEventListener(JOURNAL_CHANGED, schedule);
  window.addEventListener(CHORD_MARKS_CHANGED, schedule);
  window.addEventListener('online', () => void run());
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void run();
  });
  try {
    enabled = (await fetchAccount()) !== null;
  } catch {
    enabled = false;
  }
  await run();
}
