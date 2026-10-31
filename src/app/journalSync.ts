/**
 * Synchro automatique du journal quand le compte est connecté (D117). Déclenchée à l'ouverture, après
 * chaque tentative (regroupée), au retour de la page et au retour du réseau. Sans session, elle ne
 * fait rien ; hors build de production, elle n'existe pas.
 */
import { ACCOUNTS_ENABLED, fetchAccount } from '../core/account/client';
import { syncJournal } from '../core/account/journalSync';
import { JOURNAL_CHANGED, progressStore } from '../core/progress/journal';

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
      if ((await syncJournal(progressStore())) === 'signedOut') {
        enabled = false;
        return;
      }
    } while (again);
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
