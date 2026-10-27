/** Crochets de mesure pour le navigateur piloté (DEV seulement, absents du build de production). */
import * as audio from '../core/audio';
import * as tab from '../core/tab';
import * as theory from '../core/theory';
import { VOICINGS } from '../data/voicings';

export function installDevHooks(): void {
  if (!import.meta.env.DEV) return;
  (window as unknown as Record<string, unknown>).__audio = { engine: audio.AudioEngine.get(), audio, tab, theory, VOICINGS };
}
