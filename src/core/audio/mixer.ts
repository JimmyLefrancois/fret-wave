/**
 * Mixage : volumes séparés (master, guitare, drone, métronome), courbe de curseur → gain, réglages mémorisés.
 * Pur (le stockage est injecté) : testé sans navigateur.
 */

export const CHANNELS = ['master', 'guitar', 'backing', 'drone', 'metronome'] as const;
export type Channel = (typeof CHANNELS)[number];

export const CHANNEL_LABEL: Record<Channel, string> = {
  master: 'Général',
  guitar: 'Guitare',
  backing: 'Accompagnement',
  drone: 'Drone',
  metronome: 'Métronome',
};

export type Volumes = Record<Channel, number>;

/**
 * Valeurs par défaut (curseurs 0-1). Équilibre choisi par calcul puis mesure (voir MUSIC_DESIGN.md §11.4) : le drone et
 * le métronome sont des soutiens, ils restent nettement sous la guitare.
 */
export const DEFAULT_VOLUMES: Readonly<Volumes> = { master: 0.95, guitar: 0.9, backing: 0.82, drone: 0.8, metronome: 0.85 };

/** Plage de la courbe : le curseur à 0 coupe, à 1 = 0 dB, entre les deux −DB_RANGE → 0 dB, linéaire en dB. */
export const DB_RANGE = 50;

export function sliderToDb(v: number): number {
  const x = Math.max(0, Math.min(1, v));
  return x <= 0 ? -Infinity : -DB_RANGE * (1 - x);
}

export function sliderToGain(v: number): number {
  const db = sliderToDb(v);
  return db === -Infinity ? 0 : 10 ** (db / 20);
}

export function gainToSlider(g: number): number {
  if (g <= 0) return 0;
  return Math.max(0, Math.min(1, 1 + (20 * Math.log10(g)) / DB_RANGE));
}

export const clamp01 = (v: number): number => (Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : 0);

// ---------------------------------------------------------------------------------------------------------------
// Réglages audio mémorisés
// ---------------------------------------------------------------------------------------------------------------

export interface AudioSettings {
  volumes: Volumes;
  instrument: string;
  /** Écart moyen entre cordes d'un strum (ms). */
  strumSpreadMs: number;
  /** 0 = mécanique, 1 = très humain (gigue de timing et de vélocité du strum). */
  humanize: number;
  /** Réverbération légère de la guitare (0-1). */
  reverb: number;
}

export const DEFAULT_SETTINGS: Readonly<AudioSettings> = {
  volumes: { ...DEFAULT_VOLUMES },
  instrument: 'nylon',
  strumSpreadMs: 14,
  humanize: 0.5,
  reverb: 0.5,
};

export const SETTINGS_KEY = 'fretwave.audio.v1';

export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

/** Lit les réglages ; toute valeur absente, illisible ou hors plage retombe sur le défaut (jamais d'exception). */
export function loadSettings(store: KeyValueStore | null, knownInstruments: readonly string[] = ['nylon', 'electric']): AudioSettings {
  const out: AudioSettings = { ...DEFAULT_SETTINGS, volumes: { ...DEFAULT_VOLUMES } };
  if (!store) return out;
  let raw: unknown;
  try {
    const s = store.getItem(SETTINGS_KEY);
    raw = s ? JSON.parse(s) : null;
  } catch {
    return out;
  }
  if (typeof raw !== 'object' || raw === null) return out;
  const r = raw as Record<string, unknown>;
  const vols = r.volumes as Record<string, unknown> | undefined;
  if (vols && typeof vols === 'object') {
    for (const c of CHANNELS) if (typeof vols[c] === 'number' && Number.isFinite(vols[c] as number)) out.volumes[c] = clamp01(vols[c] as number);
  }
  if (typeof r.instrument === 'string' && knownInstruments.includes(r.instrument)) out.instrument = r.instrument;
  if (typeof r.strumSpreadMs === 'number' && Number.isFinite(r.strumSpreadMs)) out.strumSpreadMs = Math.max(4, Math.min(40, r.strumSpreadMs));
  if (typeof r.humanize === 'number' && Number.isFinite(r.humanize)) out.humanize = clamp01(r.humanize);
  if (typeof r.reverb === 'number' && Number.isFinite(r.reverb)) out.reverb = clamp01(r.reverb);
  return out;
}

export function saveSettings(store: KeyValueStore | null, s: AudioSettings): void {
  if (!store) return;
  try {
    store.setItem(SETTINGS_KEY, JSON.stringify(s));
  } catch {
    /* stockage plein ou interdit (navigation privée) : le réglage reste valable pour la session */
  }
}
